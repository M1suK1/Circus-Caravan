import { REGION_CATALOG } from '../content/regions.ts';
import {
  fallbackSettlementDetails,
  generateRegionMap,
  revealFogAround,
  surroundingTerrainsOf,
} from '../domain/regionGen.ts';
import type { ActionResult, CircusState, Direction, GameAction } from '../types.ts';
import { clone, pushLog } from './core.ts';

const OPPOSITE_DIR: Record<Direction, Direction> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

const BLOCKED_TERRAINS = new Set(['boundary', 'mountain', 'water']);

export function applyMoveInRegion(state: CircusState, action: Extract<GameAction, { type: 'moveInRegion' }>): ActionResult {
  const next = clone(state);
  const map = next.world.regions[next.world.currentRegionId].map;
  if (!map) return { state, ok: false, message: '当前大区尚未生成地形图。' };
  const { x, y } = action;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return { state, ok: false, message: '坐标超出区域范围。' };
  const tile = map.tiles[y * map.width + x]!;
  if (BLOCKED_TERRAINS.has(tile.terrain)) return { state, ok: false, message: '前方是无法通行的区域边界或险阻。' };

  next.world.pos = { x, y };
  next.world.currentPoiId = tile.poiId;
  revealFogAround(map, x, y, 2, 'charted');
  return { state: next, ok: true, message: `车队移动至 (${x}, ${y})。` };
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
  poi.details = { ...details, npcIds: [...details.npcIds], preferredActs: [...details.preferredActs], marketTraits: [...details.marketTraits] };
  revealFogAround(map, poi.x, poi.y, 1, 'charted');
  pushLog(next, 'scout', `斥候探明了「${details.name}」（${poi.kind === 'city' ? '城市' : '村庄'}）：${details.summary}`);
  return { state: next, ok: true, message: `已探明 ${details.name}。` };
}

export function applyCrossBorder(state: CircusState, action: Extract<GameAction, { type: 'crossBorder' }>): ActionResult {
  const next = clone(state);
  const currentRegion = next.world.regions[next.world.currentRegionId];
  const currentMap = currentRegion.map;
  if (!currentMap) return { state, ok: false, message: '当前区域地图缺失。' };

  const gate = currentMap.gates.find(g => g.direction === action.direction);
  if (!gate) return { state, ok: false, message: '该方向没有通往相邻地区的边界通道。' };
  if (next.world.pos.x !== gate.x || next.world.pos.y !== gate.y) {
    return { state, ok: false, message: '车队必须先抵达边界出境口才能跨区出境。' };
  }

  const targetRegion = next.world.regions[gate.targetRegionId];
  if (!targetRegion.map) {
    targetRegion.map = generateRegionMap(targetRegion.id, next.world.seed);
  }
  const destMap = targetRegion.map;
  const entryDir = OPPOSITE_DIR[action.direction];
  const entryGate = destMap.gates.find(g => g.direction === entryDir) ?? destMap.gates[0];
  const ex = entryGate?.x ?? Math.floor(destMap.width / 2);
  const ey = entryGate?.y ?? Math.floor(destMap.height / 2);

  next.world.currentRegionId = targetRegion.id;
  next.world.pos = { x: ex, y: ey };
  next.world.currentPoiId = undefined;
  revealFogAround(destMap, ex, ey, 2, 'charted');
  pushLog(next, 'travel', `车队跨过边境进入「${targetRegion.name}」——未知地形与新聚落正在迷雾前方展开。`);
  return { state: next, ok: true, message: `已出境抵达 ${targetRegion.name}。` };
}
