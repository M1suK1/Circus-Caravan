import { REGION_IDS } from '../content/regions.ts';
import { usedSeats } from '../domain/caravanMath.ts';
import { cardToWorldNpc, hasCardInUse, npcToPerformer } from '../domain/cardAdapter.ts';
import type { ActionResult, CircusState, GameAction, NpcOccupation } from '../types.ts';
import { clone, pushLog } from './core.ts';

const GUEST_OCCUPATIONS: NpcOccupation[] = ['merchant', 'mayor', 'auctioneer', 'passenger'];

export function applyRecruitWorldNpc(
  state: CircusState,
  action: Extract<GameAction, { type: 'recruitWorldNpc' }>,
): ActionResult {
  if (state.phase === 'retired') {
    return { state, ok: false, message: '剧团已隐居收摊。' };
  }
  const idx = state.worldNpcs.findIndex(n => n.id === action.npcId);
  if (idx < 0) return { state, ok: false, message: '找不到这位驻地 NPC。' };
  const npc = state.worldNpcs[idx]!;
  if (usedSeats(state) >= state.caravan.maxSeats) {
    return { state, ok: false, message: '风灯客车厢席位已满，请先扩建客车厢。' };
  }
  if (npc.disposition < 60 && state.world.currentPoiId !== npc.poiId) {
    return { state, ok: false, message: `需先抵达「${npc.name}」所在聚落或提升好感至 60 方可邀约登车。` };
  }

  const next = clone(state);
  const [removed] = next.worldNpcs.splice(idx, 1);
  const performer = npcToPerformer(removed!, next.day);
  next.performers.push(performer);

  for (const rId of REGION_IDS) {
    const pois = next.world.regions[rId].map?.pois;
    if (!pois) continue;
    for (const poi of Object.values(pois)) {
      if (poi.details) {
        poi.details.npcIds = poi.details.npcIds.filter(id => id !== removed!.id);
      }
    }
  }

  pushLog(next, 'crew', `驻地友人「${performer.name}」应邀登上大篷车，成为马戏团${performer.title}！`);
  return { state: next, ok: true, message: `${performer.name} 已正式加入大篷车！` };
}

export function applyInjectCardboxGuests(
  state: CircusState,
  action: Extract<GameAction, { type: 'injectCardboxGuests' }>,
): ActionResult {
  if (state.phase === 'retired') {
    return { state, ok: false, message: '剧团已隐居收摊。' };
  }
  const next = clone(state);
  const maxCount = Math.max(1, Math.min(8, action.maxCount ?? 6));

  // 收集当前已展开区域里的聚落锚点
  const targetPois: { regionId: typeof REGION_IDS[number]; poiId: string; faction: typeof state.world.regions['empire_heart']['dominantFaction'] }[] = [];
  for (const rId of REGION_IDS) {
    const reg = next.world.regions[rId];
    if (!reg.map) continue;
    for (const poi of Object.values(reg.map.pois)) {
      targetPois.push({
        regionId: rId,
        poiId: poi.id,
        faction: poi.details?.ownerFaction ?? reg.dominantFaction,
      });
    }
  }
  if (targetPois.length === 0) {
    return { state, ok: false, message: '尚无已展开的区域聚落可供客串。' };
  }

  let added = 0;
  let cursor = 0;
  for (const card of action.cards) {
    if (added >= maxCount) break;
    if (hasCardInUse(next, card)) continue;
    const slot = targetPois[cursor % targetPois.length]!;
    cursor += 1;
    const npc = cardToWorldNpc(card, {
      regionId: slot.regionId,
      poiId: slot.poiId,
      occupation: GUEST_OCCUPATIONS[(added + cursor) % GUEST_OCCUPATIONS.length],
      faction: slot.faction,
      id: `npc-guest-${next.worldNpcs.length + 1}-${next.day}`,
    });
    npc.disposition = 65;
    next.worldNpcs.push(npc);
    const poi = next.world.regions[slot.regionId].map?.pois[slot.poiId];
    if (poi?.details && !poi.details.npcIds.includes(npc.id)) {
      poi.details.npcIds.push(npc.id);
    }
    added += 1;
  }

  if (added === 0) {
    return { state, ok: false, message: '卡匣内的角色均已在剧团或世界城镇中登场（已自动去重）。' };
  }
  pushLog(next, 'system', `从角色卡匣派遣了 ${added} 位熟人角色入驻沿途城镇，旅行时可随时拜访或邀约同行。`);
  return { state: next, ok: true, message: `已将 ${added} 张角色卡客串投放到沿途城村。` };
}

export function applySetRegionBlueprint(
  state: CircusState,
  action: Extract<GameAction, { type: 'setRegionBlueprint' }>,
): ActionResult {
  const next = clone(state);
  const reg = next.world.regions[action.regionId];
  if (!reg) return { state, ok: false, message: '找不到指定大区。' };
  reg.calamityBlueprint = action.blueprint;
  return { state: next, ok: true };
}
