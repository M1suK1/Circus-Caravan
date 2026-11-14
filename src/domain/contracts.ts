/**
 * 货运与客运委托生成、接单校验与目标聚落解析（纯函数）。
 */
import { REGION_CATALOG } from '../content/regions.ts';
import type {
  CircusState,
  FactionId,
  FreightContract,
  PassengerContract,
  RegionId,
  SettlementPoi,
} from '../types.ts';
import { createRng, hashInt } from './worldGen.ts';

const CARGO_TEMPLATES: { title: string; baseWeight: number; fragile?: boolean; contraband?: boolean }[] = [
  { title: '封蜡风灯煤油桶', baseWeight: 28 },
  { title: '防潮急救草药箱', baseWeight: 22, fragile: true },
  { title: '铆接蒸汽机轴件', baseWeight: 42 },
  { title: '晶石灯塔稳压芯', baseWeight: 26, fragile: true },
  { title: '腌肉干粮战备箱', baseWeight: 35 },
  { title: '未报关魔导禁书匣', baseWeight: 18, contraband: true },
  { title: '黑市麻醉秘药坛', baseWeight: 24, contraband: true, fragile: true },
];

const PASSENGER_NAMES = [
  '沈默药师 · 艾琳',
  '逃难钟表匠 · 汉斯',
  '测绘学徒 · 诺拉',
  '吟游抄谱人 · 尤里',
  '寻亲旅商 · 梅林',
  '落魄星象徒 · 赛拉',
  '边境修女 · 克拉拉',
];

const PASSENGER_HOOKS = [
  '随身提着一只不断轻响的黄铜罗盘，只愿在夜演后付清尾款。',
  '正赶往目的地聚落赎回失散的妹妹，途中或许能打听些商路消息。',
  '背囊里裹着发黄的旧地图残页，一路上总是盯着省界山脉发呆。',
  '自称普通商队书记官，但夜里从不熄灭床头的那盏冷光提灯。',
];

function candidateDestinations(
  state: CircusState,
  originRegionId: RegionId,
  originPoiId: string,
): { regionId: RegionId; poiId: string; poiName: string; isCrossRegion: boolean }[] {
  const out: { regionId: RegionId; poiId: string; poiName: string; isCrossRegion: boolean }[] = [];
  const originMap = state.world.regions[originRegionId]?.map;
  if (originMap) {
    for (const poi of Object.values(originMap.pois)) {
      if (poi.id === originPoiId) continue;
      out.push({
        regionId: originRegionId,
        poiId: poi.id,
        poiName: poi.scouted && poi.details ? poi.details.name : poi.placeholderName,
        isCrossRegion: false,
      });
    }
  }
  const neighbors = state.world.regions[originRegionId]?.neighbors ?? REGION_CATALOG[originRegionId].neighbors;
  for (const nb of neighbors) {
    const nbMap = state.world.regions[nb.targetRegionId]?.map;
    if (nbMap) {
      const firstPoi = Object.values(nbMap.pois)[0];
      if (firstPoi) {
        out.push({
          regionId: nb.targetRegionId,
          poiId: firstPoi.id,
          poiName: firstPoi.scouted && firstPoi.details ? firstPoi.details.name : firstPoi.placeholderName,
          isCrossRegion: true,
        });
        continue;
      }
    }
    out.push({
      regionId: nb.targetRegionId,
      poiId: `${nb.targetRegionId}-poi-0`,
      poiName: `${REGION_CATALOG[nb.targetRegionId].name}主城`,
      isCrossRegion: true,
    });
  }
  return out;
}

export function generateFreightOffers(state: CircusState, poi: SettlementPoi): FreightContract[] {
  const dests = candidateDestinations(state, poi.regionId, poi.id);
  if (!dests.length) return [];

  const takenIds = new Set(state.freightOrders.map(o => o.id));
  const seed = hashInt(`${state.world.seed}:freight:${poi.id}:${state.day}`);
  const rng = createRng(seed);
  const regionProfile = REGION_CATALOG[poi.regionId];
  const count = poi.kind === 'city' ? 3 : 2;
  const offers: FreightContract[] = [];

  for (let i = 0; i < count; i += 1) {
    const id = `fr-${poi.id}-${state.day}-${i}`;
    if (takenIds.has(id)) continue;
    const tpl = CARGO_TEMPLATES[Math.floor(rng() * CARGO_TEMPLATES.length)]!;
    const dest = dests[Math.floor(rng() * dests.length)]!;
    const destDanger = REGION_CATALOG[dest.regionId].dangerTier;
    const dangerMult = 1 + (regionProfile.dangerTier + destDanger) * 0.14;
    const distanceFactor = dest.isCrossRegion ? 1.55 : 1.0;
    const contrabandBonus = tpl.contraband ? 1.45 : 1.0;
    const weight = Math.max(12, Math.round(tpl.baseWeight * (0.85 + rng() * 0.3)));
    const rewardGold = Math.round(weight * 5.2 * dangerMult * distanceFactor * contrabandBonus);
    const issuerFaction: FactionId | 'neutral' = tpl.contraband
      ? 'rust_syndicate'
      : poi.details?.ownerFaction ?? regionProfile.dominantFaction;
    offers.push({
      id,
      title: tpl.title,
      fromRegionId: poi.regionId,
      fromPoiId: poi.id,
      toRegionId: dest.regionId,
      toPoiId: dest.poiId,
      issuerFaction,
      weight,
      rewardGold,
      deadlineDay: state.day + (dest.isCrossRegion ? 6 : 4),
      fragile: tpl.fragile,
      contraband: tpl.contraband,
      status: 'open',
    });
  }
  return offers;
}

export function generatePassengerOffers(state: CircusState, poi: SettlementPoi): PassengerContract[] {
  const dests = candidateDestinations(state, poi.regionId, poi.id);
  if (!dests.length) return [];

  const takenIds = new Set(state.passengerOrders.map(o => o.id));
  const seed = hashInt(`${state.world.seed}:pax:${poi.id}:${state.day}`);
  const rng = createRng(seed);
  const count = poi.kind === 'city' ? 2 : 1;
  const offers: PassengerContract[] = [];

  for (let i = 0; i < count; i += 1) {
    const id = `pax-${poi.id}-${state.day}-${i}`;
    if (takenIds.has(id)) continue;
    const dest = dests[Math.floor(rng() * dests.length)]!;
    const seatsNeeded = rng() > 0.78 ? 2 : 1;
    const destDanger = REGION_CATALOG[dest.regionId].dangerTier;
    const baseFare = dest.isCrossRegion ? 210 : 125;
    const fareGold = Math.round(baseFare * seatsNeeded * (1 + destDanger * 0.15));
    offers.push({
      id,
      name: PASSENGER_NAMES[Math.floor(rng() * PASSENGER_NAMES.length)]!,
      originPoiId: poi.id,
      destRegionId: dest.regionId,
      destPoiId: dest.poiId,
      seatsNeeded,
      fareGold,
      deadlineDay: state.day + (dest.isCrossRegion ? 6 : 4),
      storyHook: PASSENGER_HOOKS[Math.floor(rng() * PASSENGER_HOOKS.length)]!,
      status: 'waiting',
    });
  }
  return offers;
}

export function describeDestinationPoi(state: CircusState, regionId: RegionId, poiId: string): string {
  const region = state.world.regions[regionId];
  const poi = region?.map?.pois[poiId];
  if (poi) return `${region.name} · ${poi.scouted && poi.details ? poi.details.name : poi.placeholderName}`;
  return `${REGION_CATALOG[regionId].name} · 边境主聚落`;
}

export function isAtContractDestination(
  state: CircusState,
  targetRegionId: RegionId,
  targetPoiId: string,
): boolean {
  if (state.world.currentRegionId !== targetRegionId) return false;
  if (state.world.currentPoiId === targetPoiId) return true;
  const map = state.world.regions[targetRegionId]?.map;
  if (!map) return false;
  // 若委托下单时尚未生成目标区小地图（使用占位 ID `<regionId>-poi-0`），抵达该区任意聚落即可交付
  if (targetPoiId === `${targetRegionId}-poi-0` && Boolean(state.world.currentPoiId)) return true;
  const poi = map.pois[targetPoiId];
  if (!poi) return false;
  return Math.hypot(state.world.pos.x - (poi.x + 0.5), state.world.pos.y - (poi.y + 0.5)) <= 2.4;
}
