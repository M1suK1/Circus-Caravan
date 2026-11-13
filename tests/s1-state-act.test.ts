import test from 'node:test';
import assert from 'node:assert/strict';
import { REGION_IDS } from '../src/content/regions.ts';
import { act } from '../src/rules/act.ts';
import { loadState, serializeState } from '../src/rules/persistence.ts';
import { createInitialState } from '../src/rules/state.ts';
import type { GirlCard } from '../src/types.ts';

const testCard: GirlCard = {
  format: 'circus-caravan/card',
  version: 1,
  exportedAt: '2026-11-13T00:00:00.000Z',
  sourceDay: 1,
  girl: {
    name: '菲娜',
    codename: '星火',
    title: '火焰吞吐者',
    element: '赤焰系',
    color: '#e88d72',
    goal: '用不熄的火光点亮最后一座荒镇。',
    appearance: '赤红短发，指尖常带烟灰',
    personality: '豪爽乐观',
    outfitDescription: '镶铜铆钉戏服',
    level: 2,
    stats: { magic: 85, insight: 60, agility: 72, empathy: 70 },
    skillIds: ['flame-ring'],
    traitIds: [],
  },
};

test('s1 createInitialState 完整初始化 9 大地区、四大以上势力、5 节大篷车车厢与起手演员', () => {
  const state = createInitialState({ seed: 42 });
  assert.equal(Object.keys(state.world.regions).length, 9);
  assert.ok(Object.keys(state.world.factions).length >= 4);
  assert.equal(state.caravan.wagons.length, 5);
  assert.ok(state.performers.length >= 2);
  assert.ok(state.gold > 0);
  assert.ok(state.retirement.targetGold >= 20_000);
  assert.ok(REGION_IDS.includes(state.world.currentRegionId));
});

test('s1 act() 升级与维修车厢正确更新容量、扣费并拦截超支', () => {
  const state = createInitialState({ seed: 42 });
  state.gold = 5000;
  const cargo = state.caravan.wagons.find(w => w.kind === 'cargo')!;
  const beforeWeight = state.caravan.maxWeight;

  const up = act(state, { type: 'upgradeWagon', wagonId: cargo.id });
  assert.equal(up.ok, true, up.message);
  assert.ok(up.state.caravan.maxWeight > beforeWeight);
  assert.ok(up.state.gold < 5000);

  const poor = { ...up.state, gold: 10 };
  const denied = act(poor, { type: 'upgradeWagon', wagonId: cargo.id });
  assert.equal(denied.ok, false);
});

test('s1 act() 导入角色卡为演员受座位数限制，且可把角色卡投放为驻地 NPC', () => {
  const state = createInitialState({ seed: 42, spawnRegionId: 'empire_heart' });
  state.gold = 2000;

  // 导入角色卡为演员
  const hired = act(state, { type: 'importCardAsPerformer', card: testCard, role: 'illusionist' });
  assert.equal(hired.ok, true, hired.message);
  assert.ok(hired.state.performers.some(p => p.name === '菲娜' && p.role === 'illusionist'));

  // 投放至当前已侦查的起点聚落担任 NPC
  const startPoiId = hired.state.world.currentPoiId!;
  const placed = act(hired.state, {
    type: 'placeCardAsNpc',
    card: testCard,
    poiId: startPoiId,
    occupation: 'merchant',
  });
  assert.equal(placed.ok, true, placed.message);
  const npc = placed.state.worldNpcs.find(n => n.name === '菲娜');
  assert.ok(npc && npc.poiId === startPoiId);
  const poi = placed.state.world.regions.empire_heart.map!.pois[startPoiId]!;
  assert.ok(poi.details?.npcIds.includes(npc.id));

  // 席位满时拒绝继续招人
  const fullState = {
    ...placed.state,
    caravan: { ...placed.state.caravan, maxSeats: placed.state.performers.length },
  };
  const blocked = act(fullState, { type: 'importCardAsPerformer', card: testCard });
  assert.equal(blocked.ok, false);
});

test('s1 存档序列化与反序列化保持懒加载状态并容错坏输入', () => {
  const state = createInitialState({ seed: 88, spawnRegionId: 'arcane_city' });
  const json = serializeState(state);
  const restored = loadState(json);
  assert.equal(restored.world.currentRegionId, 'arcane_city');
  assert.ok(restored.world.regions.arcane_city.map);
  assert.equal(restored.world.regions.demon_realm.map, undefined);

  const fallback = loadState('{not-valid-json');
  assert.ok(fallback.performers.length >= 2);
});
