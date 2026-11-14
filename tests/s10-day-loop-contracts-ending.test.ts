import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeCaravanCapacity, usedSeats, usedWeight } from '../src/domain/caravanMath.ts';
import { computeAuctionQuote } from '../src/domain/auction.ts';
import { describeClock, isDayRollover, nextTimeSlot } from '../src/domain/calendar.ts';
import { generateFreightOffers, generatePassengerOffers } from '../src/domain/contracts.ts';
import { findAutoRoute } from '../src/domain/pathfinding.ts';
import { regionTerrainAt } from '../src/domain/regionGen.ts';
import { act } from '../src/rules/act.ts';
import { normalizeState, serializeState } from '../src/rules/persistence.ts';
import { createInitialState } from '../src/rules/state.ts';

test('s10 时段流转与跨日结算：dawn→noon→dusk→night→dawn，仅夜演跨日扣账并写入 lastLedger', () => {
  assert.equal(nextTimeSlot('dawn'), 'noon');
  assert.equal(nextTimeSlot('noon'), 'dusk');
  assert.equal(nextTimeSlot('dusk'), 'night');
  assert.equal(nextTimeSlot('night'), 'dawn');
  assert.equal(isDayRollover('dusk'), false);
  assert.equal(isDayRollover('night'), true);
  assert.ok(describeClock(3, 'dusk').includes('003'));

  let state = createInitialState({ seed: 1001, spawnRegionId: 'empire_heart' });
  const initDecay = state.world.worldDecay;
  const initGold = state.gold;

  // 白天推进不跨日
  let res = act(state, { type: 'advanceTimeSlot' });
  assert.equal(res.ok, true);
  assert.equal(res.state.day, 1);
  assert.equal(res.state.timeSlot, 'noon');
  assert.equal(res.state.lastLedger, undefined);

  res = act(res.state, { type: 'advanceTimeSlot' }); // dusk
  res = act(res.state, { type: 'advanceTimeSlot' }); // night
  assert.equal(res.state.day, 1);
  assert.equal(res.state.timeSlot, 'night');

  // night → dawn 触发跨日日结
  res = act(res.state, { type: 'advanceTimeSlot' });
  assert.equal(res.ok, true);
  state = res.state;
  assert.equal(state.day, 2);
  assert.equal(state.timeSlot, 'dawn');
  assert.ok(state.lastLedger, '跨日后必须产生 DayLedger');
  assert.equal(state.lastLedger.day, 1);
  assert.ok(state.gold < initGold, '有固定演员时每日结算应支付日薪');
  assert.equal(state.world.worldDecay, initDecay + 1, '跨日后世界衰败度应推进');
});

test('s10 生存压力惩戒：断粮、断料、欠薪均会产生明确罚则与账册警示，车厢归零失去承载', () => {
  const base = createInitialState({ seed: 1002, spawnRegionId: 'empire_heart' });
  base.supplies.rations = 0;
  base.supplies.fodder = 0;
  base.gold = 0;
  base.beasts.push({
    id: 'b-hungry',
    speciesId: 'ember_fox_pup',
    nickname: '小火',
    stage: 1,
    level: 1,
    exp: 0,
    tameness: 60,
    hunger: 80,
    appeal: 30,
    combatPower: 14,
    talents: [],
  });
  const initHp = base.performers[0]!.hp;
  const initMorale = base.caravan.morale;

  const res = act(base, { type: 'endDay' });
  assert.equal(res.ok, true);
  const next = res.state;
  assert.equal(next.day, 2);
  assert.ok(next.lastLedger);
  assert.ok(next.lastLedger.rationsShortage > 0, '断粮应记录口粮缺口');
  assert.ok(next.lastLedger.fodderShortage > 0, '断料应记录兽料缺口');
  assert.equal(next.lastLedger.unpaidWages, true, '金币不足应标记欠薪');
  assert.ok(next.lastLedger.warnings.length >= 3, '账册应生成三条生存警示');
  assert.ok(next.performers[0]!.hp < initHp, '断粮应扣减演员生命');
  assert.ok(next.caravan.morale < initMorale, '断粮与欠薪应明显打击车队士气');
  assert.ok(next.beasts[0]!.tameness < 60, '断料应降低奇兽驯服度');

  // 车厢耐久归零校验
  const fullCap = computeCaravanCapacity(next.caravan.wagons);
  const brokenWagons = next.caravan.wagons.map(w => (w.kind === 'cargo' ? { ...w, durability: 0 } : w));
  const brokenCap = computeCaravanCapacity(brokenWagons);
  assert.ok(brokenCap.maxWeight < fullCap.maxWeight, '货厢耐久归零时必须丧失载重加成');
});

test('s10 货站委托闭环：生成、载重/座位校验、接单、送达结算与逾期违约', () => {
  let state = createInitialState({ seed: 1003, spawnRegionId: 'empire_heart' });
  const map = state.world.regions.empire_heart.map!;
  const originPoi = Object.values(map.pois)[0]!;
  state.world.currentPoiId = originPoi.id;
  state.world.pos = { x: originPoi.x + 0.5, y: originPoi.y + 0.5 };

  const freightOffers = generateFreightOffers(state, originPoi);
  const passengerOffers = generatePassengerOffers(state, originPoi);
  assert.ok(freightOffers.length >= 2, '每个聚落应生成至少 2 条货运委托');
  assert.ok(passengerOffers.length >= 1, '每个聚落应生成至少 1 位客运旅客');

  const firstFreight = freightOffers[0]!;
  const firstPax = passengerOffers[0]!;

  // 正常接单
  let res = act(state, { type: 'acceptFreightOrder', orderId: firstFreight.id });
  assert.equal(res.ok, true);
  state = res.state;
  assert.equal(usedWeight(state), firstFreight.weight);

  res = act(state, { type: 'acceptPassengerOrder', orderId: firstPax.id });
  assert.equal(res.ok, true);
  state = res.state;
  assert.equal(usedSeats(state), state.performers.length + firstPax.seatsNeeded);

  // 超载拒绝
  const overWeightState = {
    ...state,
    caravan: { ...state.caravan, maxWeight: firstFreight.weight },
  };
  const nextFreight = freightOffers[1]!;
  const failRes = act(overWeightState, { type: 'acceptFreightOrder', orderId: nextFreight.id });
  assert.equal(failRes.ok, false, '超出最大载重时必须拒绝接单');

  // 送达结算（同区域目标 POI 交付）
  const destRegion = state.world.regions[firstFreight.toRegionId];
  state.world.currentRegionId = firstFreight.toRegionId;
  if (!destRegion.map) {
    destRegion.map = map;
  }
  state.world.currentPoiId = firstFreight.toPoiId;
  const goldBefore = state.gold;
  const deliverRes = act(state, { type: 'deliverContract', contractKind: 'freight', orderId: firstFreight.id });
  assert.equal(deliverRes.ok, true);
  assert.equal(deliverRes.state.gold, goldBefore + firstFreight.rewardGold);
  assert.equal(deliverRes.state.freightOrders.find(o => o.id === firstFreight.id)?.status, 'delivered');

  // 逾期违约测试
  const lateState = {
    ...deliverRes.state,
    day: (firstPax.deadlineDay ?? 4) + 2,
  };
  const endRes = act(lateState, { type: 'endDay' });
  assert.equal(endRes.ok, true);
  assert.equal(
    endRes.state.passengerOrders.find(o => o.id === firstPax.id)?.status,
    'abandoned',
    '超过期限的乘客订单在日结时应判为逾期离车',
  );
});

test('s10 拍卖行定价与卖出结算：售卖普通奇兽与魔物娘呈现声望分化', () => {
  const state = createInitialState({ seed: 1004, spawnRegionId: 'empire_heart' });
  const map = state.world.regions.empire_heart.map!;
  const poi = Object.values(map.pois)[0]!;
  state.world.currentPoiId = poi.id;

  const girlBeast = {
    id: 'b-girl-1',
    speciesId: 'dom_catgirl',
    nickname: '铃铛猫娘',
    stage: 1 as const,
    level: 2,
    exp: 0,
    tameness: 75,
    hunger: 90,
    appeal: 60,
    combatPower: 18,
    talents: [],
  };
  state.beasts.push(girlBeast);

  const quote = computeAuctionQuote(girlBeast, 'empire_heart', state.day, state.world.seed);
  assert.ok(quote.price > 0);
  assert.equal(quote.isSentientGirl, true);
  const dawnStandingBefore = state.world.factions.dawn_order.standing;
  const goldBefore = state.gold;

  const res = act(state, { type: 'sellBeast', beastId: 'b-girl-1', poiId: poi.id });
  assert.equal(res.ok, true);
  assert.ok(res.state.gold > goldBefore, '拍卖后应获得金币');
  assert.equal(res.state.beasts.some(b => b.id === 'b-girl-1'), false, '卖出后应移出兽笼');
  assert.ok(
    res.state.world.factions.dawn_order.standing < dawnStandingBefore,
    '拍卖魔物娘应降低黎明圣教声望',
  );
});

test('s10 隐居结局闭环：条件未满不可收摊，满足后生成含层级与全员尾声的结局卷轴并锁定游戏', () => {
  const state = createInitialState({ seed: 1005, spawnRegionId: 'empire_heart' });

  // 资金未达标禁止隐居
  const earlyRes = act(state, { type: 'retire', haven: 'quiet_farm' });
  assert.equal(earlyRes.ok, false);

  // 达标并处于安全大区
  state.gold = Math.round(state.retirement.targetGold * 1.6);
  state.caravan.fame = 65;
  const okRes = act(state, { type: 'retire', haven: 'hidden_valley' });
  assert.equal(okRes.ok, true);
  const retired = okRes.state;
  assert.equal(retired.phase, 'retired');
  assert.equal(retired.retirement.chosenHaven, 'hidden_valley');
  assert.ok(retired.retirement.ending, '必须生成 retirement.ending');
  assert.equal(retired.retirement.ending.tier, 'prosperous');
  assert.equal(retired.retirement.ending.accompanyingPerformers.length, retired.performers.length);
  assert.ok((retired.retirement.ending.narrative ?? '').length > 20);

  // 结局后阻断日结与行军
  const blockedDay = act(retired, { type: 'endDay' });
  assert.equal(blockedDay.ok, false, '已隐居结局后不可再推进日期');

  // 存档兼容老版本缺少 lastLedger 字段
  const legacy = JSON.parse(serializeState(createInitialState({ seed: 1006 }))) as Record<string, unknown>;
  delete legacy.lastLedger;
  const loaded = normalizeState(JSON.stringify(legacy));
  assert.ok(loaded);
  assert.equal(loaded.lastLedger, undefined);
});

test('s10 UI/渲染源码契约：日结账册、委托板、隐居卷轴、夜晚地图氛围及零 Emoji 规范', () => {
  const root = resolve(import.meta.dirname, '..');
  const shellSrc = readFileSync(resolve(root, 'src/components/Shell.tsx'), 'utf8');
  const scoutSrc = readFileSync(resolve(root, 'src/components/Modals/ScoutDialog.tsx'), 'utf8');
  const mapSrc = readFileSync(resolve(root, 'src/components/Cartography/mapRenderer.ts'), 'utf8');
  const ledgerSrc = readFileSync(resolve(root, 'src/components/Modals/DayLedgerDialog.tsx'), 'utf8');
  const retireSrc = readFileSync(resolve(root, 'src/components/Modals/RetirementDialog.tsx'), 'utf8');
  const boardSrc = readFileSync(resolve(root, 'src/components/Modals/ContractBoard.tsx'), 'utf8');

  assert.ok(shellSrc.includes('end-day-btn'), 'Shell 底栏必须包含 #end-day-btn 结束今日按钮');
  assert.ok(scoutSrc.includes('ContractBoard'), 'ScoutDialog 必须接入 ContractBoard 货站与拍卖行组件');
  assert.ok(mapSrc.includes("timeSlot === 'night'") || mapSrc.includes("timeSlot === 'dusk'"), 'mapRenderer 必须根据时间段渲染暮色/夜晚照明氛围');
  assert.ok(ledgerSrc.includes('day-ledger-modal'), 'DayLedgerDialog 必须包含账册弹窗标识');
  assert.ok(retireSrc.includes('ending-scroll'), 'RetirementDialog 必须包含 #ending-scroll 结局卷轴');
  assert.ok(boardSrc.includes('acceptFreightOrder') && boardSrc.includes('sellBeast'), 'ContractBoard 必须派发接单与拍卖动作');

  // 严禁 emoji
  const emojiRe = /[\u{1F300}-\u{1FAFF}]/u;
  for (const [name, src] of [
    ['DayLedgerDialog', ledgerSrc],
    ['RetirementDialog', retireSrc],
    ['ContractBoard', boardSrc],
  ]) {
    assert.equal(emojiRe.test(src), false, `${name} 严禁使用 emoji`);
  }
});

test('s10 行动驱动时间推进与防短距分次无损移动漏洞校验', () => {
  // 1. 演出、旅店休整、初次侦查、野外捕捉均自动推进对应时段，跨夜自动日结
  let s = createInitialState({ seed: 1007, spawnRegionId: 'empire_heart' });
  const map = s.world.regions.empire_heart.map!;
  const poi = Object.values(map.pois).find(p => p.scouted)!;
  const unscoutedPoi = Object.values(map.pois).find(p => !p.scouted)!;
  s.gold = 2000;

  assert.equal(s.timeSlot, 'dawn');
  s = act(s, { type: 'stagePerform', poiId: poi.id }).state;
  assert.equal(s.timeSlot, 'noon', '广场开演应推进 1 个时段');

  s = act(s, { type: 'scoutSettlement', poiId: unscoutedPoi.id }).state;
  assert.equal(s.timeSlot, 'dusk', '初次侦查聚落应推进 1 个时段');

  s = act(s, { type: 'tavernRest', poiId: poi.id }).state;
  assert.equal(s.day, 2, '暮色入店休整 2 个时段应自动跨入第 2 日');
  assert.equal(s.timeSlot, 'dawn');
  assert.ok(s.lastLedger && s.lastLedger.day === 1, '跨夜休整应触发第 1 日日结账册');

  s = act(s, { type: 'attemptWildCapture', speciesId: 'crest_bellfinch', rollSeed: 1 }).state;
  assert.equal(s.timeSlot, 'noon', '野外蹲守捕捉应推进 1 个时段');

  // 2. 短距离多次折线行军与连续累进扣费：绝不可无损白嫖移动
  const base = createInitialState({ seed: 1008, spawnRegionId: 'empire_heart' });
  const rMap = base.world.regions.empire_heart.map!;
  base.supplies.fuel = 100;
  base.supplies.rations = 100;

  // 从起点找一条较长的可行路网（约 12-18 格）
  let farTarget: { x: number; y: number } | null = null;
  let autoPath: { x: number; y: number }[] = [];
  for (let y = 4; y < rMap.height - 4 && !farTarget; y += 2) {
    for (let x = 4; x < rMap.width - 4; x += 2) {
      const d = Math.hypot(x + 0.5 - base.world.pos.x, y + 0.5 - base.world.pos.y);
      if (d < 12 || d > 22) continue;
      const t = regionTerrainAt(rMap, x, y);
      if (t === 'ocean' || t === 'outside' || t === 'river' || t === 'lake' || t === 'mountain') continue;
      const pts = findAutoRoute(rMap, base.world.pos, { x: x + 0.5, y: y + 0.5 });
      if (pts.length >= 6) {
        farTarget = { x: x + 0.5, y: y + 0.5 };
        autoPath = pts;
        break;
      }
    }
  }
  assert.ok(farTarget && autoPath.length >= 6, '应能在地图内找到可用于测试的 12+ 格可行路线');

  // 将该路线拆成逐段短距离（每次只走 1 步，约 1~1.5 格）分次执行 executeRoute
  let hopped = base;
  for (let i = 1; i < autoPath.length; i += 1) {
    const seg = [hopped.world.pos, autoPath[i]!];
    const res = act(hopped, { type: 'executeRoute', points: seg });
    if (res.ok) hopped = res.state;
  }

  assert.ok(hopped.supplies.fuel < 100, `多次短距行军累计必须消耗灯油（当前=${hopped.supplies.fuel}）`);
  assert.ok(hopped.supplies.rations < 100, `多次短距行军累计必须消耗口粮（当前=${hopped.supplies.rations}）`);
  assert.ok(
    hopped.day > 1 || hopped.timeSlot !== 'dawn',
    `多次短距行军累计必须推进时间（当前 day=${hopped.day}, slot=${hopped.timeSlot}）`,
  );
  const avgDur = hopped.caravan.wagons.reduce((acc, w) => acc + w.durability, 0) / hopped.caravan.wagons.length;
  assert.ok(avgDur < 100, `多次短距行军累计必须损耗车厢耐久（当前均况=${avgDur}）`);
});

