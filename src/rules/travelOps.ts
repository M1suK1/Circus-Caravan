import { REGION_CATALOG } from '../content/regions.ts';
import {
  fallbackSettlementDetails,
  generateRegionMap,
  surroundingTerrainsOf,
} from '../domain/regionGen.ts';
import {
  CARAVAN_VISION_RADIUS,
  evaluateRouteStroke,
  revealCircleInMask,
} from '../domain/routeDraw.ts';
import type { ActionResult, CircusState, Direction, GameAction } from '../types.ts';
import { clone, pushLog } from './core.ts';

const OPPOSITE_DIR: Record<Direction, Direction> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

export function applyExecuteRoute(state: CircusState, action: Extract<GameAction, { type: 'executeRoute' }>): ActionResult {
  const next = clone(state);
  const map = next.world.regions[next.world.currentRegionId].map;
  if (!map) return { state, ok: false, message: '当前大区尚未生成小地图。' };

  const raw = action.points.length ? action.points : [next.world.pos];
  const withStart = Math.hypot(raw[0]!.x - next.world.pos.x, raw[0]!.y - next.world.pos.y) > 1.5
    ? [next.world.pos, ...raw]
    : raw;

  const evalResult = evaluateRouteStroke(map, withStart, next, Boolean(action.evadeWar));
  if (evalResult.validPoints.length < 2 || evalResult.distanceTiles <= 0) {
    return { state, ok: false, message: evalResult.blockReason ?? '路线过短，请在地图上拖出有效轨迹。' };
  }

  // 扣除资源（允许在困窘时降到 0 并扣减士气提示）
  next.supplies.fuel = Math.max(0, next.supplies.fuel - evalResult.fuelCost);
  next.supplies.rations = Math.max(0, next.supplies.rations - evalResult.rationsCost);
  if (evalResult.durabilityCost > 0) {
    for (const wagon of next.caravan.wagons) {
      wagon.durability = Math.max(10, wagon.durability - Math.ceil(evalResult.durabilityCost / 5));
    }
  }
  const dayStep = Math.floor(evalResult.travelDays);
  if (dayStep > 0) next.day += dayStep;

  // 沿途逐点揭露迷雾（玩家现在周围 + 曾经到过的地貌永久可见）
  for (const pt of evalResult.validPoints) {
    revealCircleInMask(map, pt.x, pt.y, CARAVAN_VISION_RADIUS);
  }
  const end = evalResult.validPoints[evalResult.validPoints.length - 1]!;
  next.world.pos = { x: Number(end.x.toFixed(2)), y: Number(end.y.toFixed(2)) };
  next.world.currentPoiId = evalResult.reachedPoiId;

  const poiLabel = evalResult.reachedPoiId
    ? (map.pois[evalResult.reachedPoiId]?.details?.name ?? map.pois[evalResult.reachedPoiId]?.placeholderName)
    : undefined;
  const note = poiLabel
    ? `车队沿路线行驶 ${evalResult.distanceTiles} 里，抵达「${poiLabel}」。`
    : evalResult.reachedGate
      ? `车队抵达通往「${next.world.regions[evalResult.reachedGate.targetRegionId].name}」的边境关口。`
      : `车队沿路线行驶 ${evalResult.distanceTiles} 里，消耗口粮 ${evalResult.rationsCost}、灯油 ${evalResult.fuelCost}。`;
  pushLog(next, 'travel', note);
  return { state: next, ok: true, message: note };
}

export function applyScoutSettlement(
  state: CircusState,
  action: Extract<GameAction, { type: 'scoutSettlement' }>,
): ActionResult {
  const next = clone(state);
  const region = next.world.regions[next.world.currentRegionId];
  const map = region.map;
  if (!map) return { state, ok: false, message: '当前大区尚未加载。' };
  const poi = map.pois[action.poiId];
  if (!poi) return { state, ok: false, message: '找不到该聚落锚点。' };

  const details = action.details ?? fallbackSettlementDetails(
    poi,
    REGION_CATALOG[region.id],
    surroundingTerrainsOf(map, poi.x, poi.y),
    next.world.seed + next.day,
  );
  poi.scouted = true;
  poi.details = {
    ...details,
    npcIds: [...details.npcIds],
    preferredActs: [...details.preferredActs],
    marketTraits: [...details.marketTraits],
  };
  revealCircleInMask(map, poi.x, poi.y, CARAVAN_VISION_RADIUS);
  pushLog(next, 'scout', `斥候探明了「${details.name}」（${poi.kind === 'city' ? '城市' : '村庄'}）：${details.summary}`);
  return { state: next, ok: true, message: `已探明 ${details.name}。` };
}

export function applyCrossBorder(state: CircusState, action: Extract<GameAction, { type: 'crossBorder' }>): ActionResult {
  const next = clone(state);
  const currentRegion = next.world.regions[next.world.currentRegionId];
  const currentMap = currentRegion.map;
  if (!currentMap) return { state, ok: false, message: '当前区域地图缺失。' };

  const gate = currentMap.gates.find(
    g => g.targetRegionId === action.targetRegionId && (!action.direction || g.direction === action.direction),
  );
  if (!gate) return { state, ok: false, message: '该方向没有通往相邻地区的边境关口。' };
  if (Math.hypot(next.world.pos.x - gate.x, next.world.pos.y - gate.y) > 4) {
    return { state, ok: false, message: '请先划线行进至边境关口附近（4 格内），再跨越区域边界。' };
  }

  const originRegionId = next.world.currentRegionId;
  const targetRegion = next.world.regions[gate.targetRegionId];
  if (!targetRegion.map) {
    targetRegion.map = generateRegionMap(next.world.worldMap, targetRegion.id, next.world.seed);
  }
  const destMap = targetRegion.map;
  const entryDir = OPPOSITE_DIR[gate.direction];
  const entryGate = destMap.gates.find(g => g.targetRegionId === originRegionId)
    ?? destMap.gates.find(g => g.direction === entryDir)
    ?? destMap.gates[0];
  const ex = entryGate?.x ?? Math.floor(destMap.width / 2);
  const ey = entryGate?.y ?? Math.floor(destMap.height / 2);

  next.world.currentRegionId = targetRegion.id;
  next.world.pos = { x: ex + 0.5, y: ey + 0.5 };
  next.world.currentPoiId = undefined;
  revealCircleInMask(destMap, ex, ey, CARAVAN_VISION_RADIUS);
  pushLog(next, 'travel', `车队跨过边境进入「${targetRegion.name}」，10× 区域地形已展开。`);
  return { state: next, ok: true, message: `已出境抵达 ${targetRegion.name}。` };
}
