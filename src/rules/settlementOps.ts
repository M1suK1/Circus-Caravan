import { REGION_CATALOG } from '../content/regions.ts';
import { computeShowPayout, computeTavernRestCost } from '../domain/settlements.ts';
import type { ActionResult, CircusState, GameAction } from '../types.ts';
import { clone, pushLog } from './core.ts';

export function applyTavernRest(
  state: CircusState,
  action: Extract<GameAction, { type: 'tavernRest' }>,
): ActionResult {
  if (state.phase === 'retired') return { state, ok: false, message: '剧团已隐居收摊。' };
  const next = clone(state);
  const region = next.world.regions[next.world.currentRegionId];
  const poi = region.map?.pois[action.poiId];
  if (!poi) return { state, ok: false, message: '找不到当前聚落。' };

  const cost = computeTavernRestCost(next, poi.kind === 'city');
  if (next.gold < cost) {
    return { state, ok: false, message: `旅店投宿需要 ${cost} 金币，当前余额不足。` };
  }

  next.gold -= cost;
  for (const perf of next.performers) {
    perf.hp = perf.maxHp;
    perf.fatigue = Math.max(0, perf.fatigue - 35);
    perf.morale = Math.min(100, perf.morale + 8);
  }
  next.caravan.morale = Math.min(100, next.caravan.morale + 6);
  const name = poi.details?.name ?? poi.placeholderName;
  pushLog(next, 'crew', `在「${name}」旅店热汤休整（花费 ${cost} 金），全团体力与士气回升。`);
  return { state: next, ok: true, message: `在 ${name} 旅店休整一夜，全团精力充沛！` };
}

export function applyStagePerform(
  state: CircusState,
  action: Extract<GameAction, { type: 'stagePerform' }>,
): ActionResult {
  if (state.phase === 'retired') return { state, ok: false, message: '剧团已隐居收摊。' };
  const next = clone(state);
  const region = next.world.regions[next.world.currentRegionId];
  const poi = region.map?.pois[action.poiId];
  if (!poi) return { state, ok: false, message: '找不到当前聚落广场。' };

  const payout = computeShowPayout(next, poi, region.dangerTier);
  const totalEarned = payout.revenue + payout.tipBonus;
  const propsUsed = next.supplies.props > 0 ? 1 : 0;

  next.gold += totalEarned;
  next.supplies.props = Math.max(0, next.supplies.props - propsUsed);
  next.caravan.fame += payout.fameGain;
  for (const perf of next.performers) {
    perf.fatigue = Math.min(100, perf.fatigue + 12);
    perf.morale = Math.min(100, perf.morale + 5);
    perf.bond = Math.min(100, perf.bond + 2);
  }
  poi.visitedCount += 1;
  poi.lastShowDay = next.day;
  if (poi.details) {
    poi.details.hope = Math.min(100, poi.details.hope + payout.hopeGain);
  }

  const name = poi.details?.name ?? poi.placeholderName;
  next.recentShows.unshift({
    id: `show-${next.day}-${poi.id}`,
    day: next.day,
    regionId: region.id,
    poiId: poi.id,
    slots: [],
    ticketRevenue: payout.revenue,
    tipBonus: payout.tipBonus,
    hopeGain: payout.hopeGain,
    fatigueCost: 12,
    highlightSummary: `在「${name}」点亮暖灯开演，票房 ${payout.revenue} 金 + 打赏 ${payout.tipBonus} 金。`,
  });
  next.recentShows = next.recentShows.slice(0, 20);

  pushLog(next, 'show', `在「${name}」巡演大获成功，净赚 ${totalEarned} 金，聚落希望值 +${payout.hopeGain}。`);
  return { state: next, ok: true, message: `演出圆满落幕！获得门票与打赏共 ${totalEarned} 金。` };
}

export function applySettlementBuySupply(
  state: CircusState,
  action: Extract<GameAction, { type: 'settlementBuySupply' }>,
): ActionResult {
  if (state.phase === 'retired') return { state, ok: false, message: '剧团已隐居收摊。' };
  const next = clone(state);
  if (next.gold < action.cost) {
    return { state, ok: false, message: `金币不足，购买需要 ${action.cost} 金。` };
  }
  next.gold -= action.cost;
  next.supplies[action.supplyKey] += action.amount;
  const poi = next.world.regions[next.world.currentRegionId].map?.pois[action.poiId];
  const name = poi?.details?.name ?? poi?.placeholderName ?? '聚落商铺';
  pushLog(next, 'crew', `在「${name}」采买补给 +${action.amount}，花费 ${action.cost} 金。`);
  return { state: next, ok: true, message: `采买成功（+${action.amount}），花费 ${action.cost} 金。` };
}

export function applySettlementAidOrPass(
  state: CircusState,
  action: Extract<GameAction, { type: 'settlementAidOrPass' }>,
): ActionResult {
  if (state.phase === 'retired') return { state, ok: false, message: '剧团已隐居收摊。' };
  const next = clone(state);
  const region = next.world.regions[next.world.currentRegionId];
  const poi = region.map?.pois[action.poiId];
  const factionId = poi?.details?.ownerFaction && poi.details.ownerFaction !== 'neutral'
    ? poi.details.ownerFaction
    : REGION_CATALOG[region.id].dominantFaction;

  if (action.mode === 'ration_aid') {
    next.supplies.rations += 6;
    next.supplies.fodder += 3;
    pushLog(next, 'faction', '黎明圣教庇护所为风灯马戏团提供了应急口粮 +6、兽料 +3。');
    return { state: next, ok: true, message: '从庇护所领取了应急口粮 +6、兽料 +3。' };
  }

  if (factionId === 'neutral') {
    return { state, ok: false, message: '该自由地区无需办理势力通行证。' };
  }
  const faction = next.world.factions[factionId];
  if (faction.hasPass) {
    return { state, ok: false, message: `已持有「${faction.name}」合法通行凭证，无需重复购买。` };
  }
  const fee = 240;
  if (next.gold < fee) {
    return { state, ok: false, message: `办理「${faction.name}」通行证需 ${fee} 金。` };
  }
  next.gold -= fee;
  faction.hasPass = true;
  faction.standing = Math.min(100, faction.standing + 8);
  pushLog(next, 'faction', `花费 ${fee} 金办理了「${faction.name}」商路通行凭证。`);
  return { state: next, ok: true, message: `已购得「${faction.name}」通行凭证！` };
}
