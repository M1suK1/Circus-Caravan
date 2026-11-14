import { REGION_CATALOG } from '../content/regions.ts';
import { computeAuctionQuote } from '../domain/auction.ts';
import { usedSeats, usedWeight } from '../domain/caravanMath.ts';
import {
  describeDestinationPoi,
  generateFreightOffers,
  generatePassengerOffers,
  isAtContractDestination,
} from '../domain/contracts.ts';
import type { ActionResult, CircusState, FreightContract, GameAction, PassengerContract, SettlementPoi } from '../types.ts';
import { clone, pushLog } from './core.ts';

function resolveCurrentPoi(state: CircusState): SettlementPoi | undefined {
  const map = state.world.regions[state.world.currentRegionId]?.map;
  if (!map) return undefined;
  if (state.world.currentPoiId && map.pois[state.world.currentPoiId]) {
    return map.pois[state.world.currentPoiId];
  }
  return Object.values(map.pois).find(
    p => Math.hypot(state.world.pos.x - (p.x + 0.5), state.world.pos.y - (p.y + 0.5)) <= 2.4,
  );
}

function findFreightOffer(state: CircusState, orderId: string): FreightContract | undefined {
  const curPoi = resolveCurrentPoi(state);
  if (curPoi) {
    const match = generateFreightOffers(state, curPoi).find(o => o.id === orderId);
    if (match) return match;
  }
  const map = state.world.regions[state.world.currentRegionId]?.map;
  if (!map) return undefined;
  for (const poi of Object.values(map.pois)) {
    const match = generateFreightOffers(state, poi).find(o => o.id === orderId);
    if (match) return match;
  }
  return undefined;
}

function findPassengerOffer(state: CircusState, orderId: string): PassengerContract | undefined {
  const curPoi = resolveCurrentPoi(state);
  if (curPoi) {
    const match = generatePassengerOffers(state, curPoi).find(o => o.id === orderId);
    if (match) return match;
  }
  const map = state.world.regions[state.world.currentRegionId]?.map;
  if (!map) return undefined;
  for (const poi of Object.values(map.pois)) {
    const match = generatePassengerOffers(state, poi).find(o => o.id === orderId);
    if (match) return match;
  }
  return undefined;
}

export function applyAcceptFreightOrder(
  state: CircusState,
  action: Extract<GameAction, { type: 'acceptFreightOrder' }>,
): ActionResult {
  if (state.phase === 'retired') {
    return { state, ok: false, message: '剧团已隐居收摊，不再承接货运委托。' };
  }
  if (state.freightOrders.some(o => o.id === action.orderId)) {
    return { state, ok: false, message: '该货运委托已在登记册中。' };
  }
  const offer = findFreightOffer(state, action.orderId);
  if (!offer) {
    return { state, ok: false, message: '货站已找不到该笔委托，可能已过期。' };
  }
  if (usedWeight(state) + offer.weight > state.caravan.maxWeight) {
    const over = usedWeight(state) + offer.weight - state.caravan.maxWeight;
    return { state, ok: false, message: `重型货厢载重不足（超出 ${over} 担），请先卸货或扩建货厢。` };
  }

  const next = clone(state);
  next.freightOrders.push({ ...offer, status: 'carrying' });
  const destLabel = describeDestinationPoi(next, offer.toRegionId, offer.toPoiId);
  pushLog(
    next,
    'freight',
    `承接货运「${offer.title}」（${offer.weight} 担 → ${destLabel}），酬金 ${offer.rewardGold} 金。`,
  );
  return { state: next, ok: true, message: `已装车承运「${offer.title}」，请在第 ${offer.deadlineDay} 日前送达。` };
}

export function applyAcceptPassengerOrder(
  state: CircusState,
  action: Extract<GameAction, { type: 'acceptPassengerOrder' }>,
): ActionResult {
  if (state.phase === 'retired') {
    return { state, ok: false, message: '剧团已隐居收摊，不再搭载付费旅客。' };
  }
  if (state.passengerOrders.some(o => o.id === action.orderId)) {
    return { state, ok: false, message: '该位旅客已在车厢名单中。' };
  }
  const offer = findPassengerOffer(state, action.orderId);
  if (!offer) {
    return { state, ok: false, message: '登记簿找不到这位待乘旅客。' };
  }
  if (usedSeats(state) + offer.seatsNeeded > state.caravan.maxSeats) {
    return { state, ok: false, message: `风灯客车厢席位不足（需 ${offer.seatsNeeded} 席），请先扩建客车厢。` };
  }

  const next = clone(state);
  next.passengerOrders.push({ ...offer, status: 'aboard' });
  const destLabel = describeDestinationPoi(next, offer.destRegionId, offer.destPoiId);
  pushLog(next, 'freight', `搭载旅客「${offer.name}」（占 ${offer.seatsNeeded} 席 → ${destLabel}），车资 ${offer.fareGold} 金。`);
  return { state: next, ok: true, message: `${offer.name} 已登车落座。` };
}

export function applyDeliverContract(
  state: CircusState,
  action: Extract<GameAction, { type: 'deliverContract' }>,
): ActionResult {
  if (state.phase === 'retired') {
    return { state, ok: false, message: '剧团已隐居收摊。' };
  }
  const next = clone(state);

  if (action.contractKind === 'freight') {
    const order = next.freightOrders.find(o => o.id === action.orderId && o.status === 'carrying');
    if (!order) return { state, ok: false, message: '找不到正在承运的该笔货运。' };
    if (!isAtContractDestination(next, order.toRegionId, order.toPoiId)) {
      return { state, ok: false, message: `需抵达「${describeDestinationPoi(next, order.toRegionId, order.toPoiId)}」方能交割。` };
    }
    order.status = 'delivered';
    next.gold += order.rewardGold;
    next.caravan.fame += 4;
    if (order.issuerFaction !== 'neutral' && next.world.factions[order.issuerFaction]) {
      next.world.factions[order.issuerFaction].standing += 3;
    }
    pushLog(next, 'freight', `顺利交割货运「${order.title}」，结清报酬 ${order.rewardGold} 金，剧团声望 +4。`);
    return { state: next, ok: true, message: `货运交割成功！入账 ${order.rewardGold} 金。` };
  }

  const pax = next.passengerOrders.find(o => o.id === action.orderId && o.status === 'aboard');
  if (!pax) return { state, ok: false, message: '找不到在途的该位旅客。' };
  if (!isAtContractDestination(next, pax.destRegionId, pax.destPoiId)) {
    return { state, ok: false, message: `需抵达「${describeDestinationPoi(next, pax.destRegionId, pax.destPoiId)}」方能送达结算。` };
  }
  pax.status = 'arrived';
  next.gold += pax.fareGold;
  next.caravan.fame += 3;
  next.caravan.morale = Math.min(100, next.caravan.morale + 2);
  pushLog(next, 'freight', `将旅客「${pax.name}」平安送达终点，收讫路费 ${pax.fareGold} 金。`);
  return { state: next, ok: true, message: `旅客平安抵达！入账车资 ${pax.fareGold} 金。` };
}

export function applySellBeast(
  state: CircusState,
  action: Extract<GameAction, { type: 'sellBeast' }>,
): ActionResult {
  if (state.phase === 'retired') {
    return { state, ok: false, message: '剧团已隐居收摊，无法再开市拍卖。' };
  }
  const region = state.world.regions[state.world.currentRegionId];
  const poi = region.map?.pois[action.poiId];
  if (!poi) return { state, ok: false, message: '找不到当前拍卖行所在聚落。' };

  const idx = state.beasts.findIndex(b => b.id === action.beastId);
  if (idx < 0) return { state, ok: false, message: '兽笼里找不到这只待拍生物。' };

  const next = clone(state);
  const [beast] = next.beasts.splice(idx, 1);
  const quote = computeAuctionQuote(beast!, region.id, next.day, next.world.seed);
  next.gold += quote.price;

  const poiName = poi.details?.name ?? poi.placeholderName;
  if (quote.isSentientGirl) {
    next.world.factions.dawn_order.standing -= 18;
    next.world.factions.demon_court.standing -= 6;
    next.world.factions.rust_syndicate.standing += 4;
    next.caravan.morale = Math.max(0, next.caravan.morale - 10);
    for (const perf of next.performers) {
      perf.morale = Math.max(0, perf.morale - 8);
    }
    const msg = `在「${poiName}」拍卖行将「${beast!.nickname}」高价售出（+${quote.price} 金），但贩卖具有知性的魔物娘严重动摇了全团士气，黎明圣教声望 -18。`;
    pushLog(next, 'faction', msg);
    return { state: next, ok: true, message: msg };
  }

  const msg = `在「${poiName}」拍卖行成交「${beast!.nickname}」，净入账 ${quote.price} 金（${REGION_CATALOG[region.id].name}行情）。`;
  pushLog(next, 'beast', msg);
  return { state: next, ok: true, message: msg };
}
