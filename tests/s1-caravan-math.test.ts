import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beastCageCost,
  canRetire,
  computeCaravanCapacity,
  dailyUpkeep,
  usedCageSlots,
  usedSeats,
  usedWeight,
} from '../src/domain/caravanMath.ts';
import { createInitialState } from '../src/rules/state.ts';

test('s1 车厢容量按等级精确派生：5 类车厢升级分别增加载重/客座/兽笼上限', () => {
  const state = createInitialState({ seed: 10 });
  const baseCap = computeCaravanCapacity(state.caravan.wagons);
  assert.ok(baseCap.maxWeight >= 100);
  assert.ok(baseCap.maxSeats >= 4);
  assert.ok(baseCap.maxCageSlots >= 2);

  const upgradedWagons = state.caravan.wagons.map(w =>
    w.kind === 'cargo' || w.kind === 'passenger' || w.kind === 'cage'
      ? { ...w, level: w.level + 1 }
      : w,
  );
  const nextCap = computeCaravanCapacity(upgradedWagons);
  assert.ok(nextCap.maxWeight > baseCap.maxWeight, '货厢升级应提升最大载重');
  assert.ok(nextCap.maxSeats > baseCap.maxSeats, '客车厢升级应提升最大席位');
  assert.ok(nextCap.maxCageSlots > baseCap.maxCageSlots, '兽笼车升级应提升兽笼格数');
});

test('s1 兽笼格数：1 阶生物占 1 格，2/3 阶巨型或进阶生物按物种配置占 2 格', () => {
  assert.equal(beastCageCost('ember_fox_pup'), 1);
  assert.equal(beastCageCost('cinder_guard_lion'), 2);

  const state = createInitialState({ seed: 11 });
  state.beasts = [
    {
      id: 'b1', speciesId: 'ember_fox_pup', nickname: '小火星', stage: 1,
      level: 1, exp: 0, tameness: 50, hunger: 80, appeal: 30, combatPower: 12, talents: [],
    },
    {
      id: 'b2', speciesId: 'cinder_guard_lion', nickname: '赤鬃', stage: 2,
      level: 5, exp: 0, tameness: 70, hunger: 80, appeal: 65, combatPower: 48, talents: [],
    },
  ];
  assert.equal(usedCageSlots(state), 3);
});

test('s1 席位与载重校验：演员 + 乘客计入席位，携带货物计入载重', () => {
  const state = createInitialState({ seed: 12 });
  const performerCount = state.performers.length;
  assert.equal(usedSeats(state), performerCount);

  state.passengerOrders.push({
    id: 'p1', name: '逃难学者', originPoiId: 'p0', destRegionId: 'arcane_city',
    destPoiId: 'p1', seatsNeeded: 2, fareGold: 300, status: 'aboard',
  });
  assert.equal(usedSeats(state), performerCount + 2);

  state.freightOrders.push({
    id: 'f1', title: '密封魔药箱', fromRegionId: 'empire_heart', fromPoiId: 'p0',
    toRegionId: 'arcane_city', toPoiId: 'p1', issuerFaction: 'iron_guild',
    weight: 45, rewardGold: 400, deadlineDay: 20, status: 'carrying',
  });
  assert.equal(usedWeight(state), 45);
});

test('s1 每日补给消耗与隐居条件校验', () => {
  const state = createInitialState({ seed: 13 });
  state.beasts.push({
    id: 'b1', speciesId: 'ember_fox_pup', nickname: '小火', stage: 1,
    level: 1, exp: 0, tameness: 50, hunger: 90, appeal: 30, combatPower: 10, talents: [],
  });
  const upkeep = dailyUpkeep(state);
  assert.ok(upkeep.rations >= state.performers.length);
  assert.ok(upkeep.fodder >= 1);
  assert.ok(upkeep.wages > 0);

  assert.equal(canRetire(state), false, '资金不足 targetGold 时不能隐居');
  state.gold = state.retirement.targetGold;
  assert.equal(canRetire(state), true, '攒够隐居资金且处于安全区即可触发隐居');
});
