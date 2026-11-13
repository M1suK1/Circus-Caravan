/**
 * 手动划线探索、地形速度/消耗演算与迷雾位掩码管理（纯函数）。
 */
import { decodeBytes, encodeBytes, TERRAIN_ORDER } from './worldGen.ts';
import type { CircusState, RegionMap, RouteEvaluation, TerrainType } from '../types.ts';

export const CARAVAN_VISION_RADIUS = 12;

/** 地形行进速度倍率（越大走得越快） */
export const TERRAIN_SPEED: Record<TerrainType, number> = {
  outside: 0,
  ocean: 0,
  lake: 0,
  river: 0,
  mountain: 0,
  road: 1.4,
  bridge: 1.2,
  city: 1.25,
  village: 1.15,
  border_gate: 1.1,
  coast: 0.9,
  wasteland: 1.0,
  ruin: 0.8,
  forest: 0.72,
  warzone: 0.65,
  swamp: 0.45,
};

/** 地形灯油与车轮磨损倍率 */
export const TERRAIN_COST: Record<TerrainType, { fuel: number; wear: number }> = {
  outside: { fuel: 99, wear: 99 },
  ocean: { fuel: 99, wear: 99 },
  lake: { fuel: 99, wear: 99 },
  river: { fuel: 99, wear: 99 },
  mountain: { fuel: 99, wear: 99 },
  road: { fuel: 0.7, wear: 0.5 },
  bridge: { fuel: 0.8, wear: 0.7 },
  city: { fuel: 0.6, wear: 0.4 },
  village: { fuel: 0.7, wear: 0.5 },
  border_gate: { fuel: 0.8, wear: 0.6 },
  coast: { fuel: 1.1, wear: 1.0 },
  wasteland: { fuel: 1.0, wear: 1.0 },
  ruin: { fuel: 1.2, wear: 1.4 },
  forest: { fuel: 1.15, wear: 1.25 },
  warzone: { fuel: 1.35, wear: 1.6 },
  swamp: { fuel: 2.1, wear: 2.4 },
};

export function isPassableTerrain(t: TerrainType): boolean {
  return TERRAIN_SPEED[t] > 0;
}

const EXPLORED_MASK_CACHE = new WeakMap<RegionMap, { str: string; arr: Uint8Array }>();

export function exploredMaskArray(map: RegionMap): Uint8Array {
  const byteLen = Math.ceil((map.width * map.height) / 8);
  const cached = EXPLORED_MASK_CACHE.get(map);
  if (cached && cached.str === map.exploredMaskBase64) return cached.arr;
  const arr = decodeBytes(map.exploredMaskBase64, byteLen);
  EXPLORED_MASK_CACHE.set(map, { str: map.exploredMaskBase64, arr });
  return arr;
}

export function isTileExplored(map: RegionMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const mask = exploredMaskArray(map);
  const idx = y * map.width + x;
  return Boolean((mask[idx >> 3]! >> (idx & 7)) & 1);
}

export function revealCircleInMask(map: RegionMap, cx: number, cy: number, radius = CARAVAN_VISION_RADIUS): void {
  const byteLen = Math.ceil((map.width * map.height) / 8);
  const mask = decodeBytes(map.exploredMaskBase64, byteLen);
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(map.width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(map.height - 1, Math.ceil(cy + radius));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) {
        const idx = y * map.width + x;
        mask[idx >> 3] = mask[idx >> 3]! | (1 << (idx & 7));
      }
    }
  }
  map.exploredMaskBase64 = encodeBytes(mask);
}

/** 根据车队沿手绘折线采样（步长 0.5 格），计算速度、消耗与障碍截断 */
export function evaluateRouteStroke(
  map: RegionMap,
  rawPoints: readonly { x: number; y: number }[],
  state: Pick<CircusState, 'performers' | 'passengerOrders'>,
  evadeWar = false,
): RouteEvaluation {
  if (rawPoints.length < 2) {
    return {
      points: [...rawPoints],
      validPoints: [...rawPoints],
      distanceTiles: 0,
      travelDays: 0,
      rationsCost: 0,
      fuelCost: 0,
      durabilityCost: 0,
      blocked: false,
      avgSpeedMultiplier: 1,
    };
  }

  const terrainArr = decodeBytes(map.terrainBase64, map.width * map.height);
  const validPoints: { x: number; y: number }[] = [rawPoints[0]!];
  let distanceTiles = 0;
  let weightedDays = 0;
  let fuelAcc = 0;
  let wearAcc = 0;
  let speedSum = 0;
  let sampleCount = 0;
  let blocked = false;
  let blockReason: string | undefined;

  for (let i = 1; i < rawPoints.length && !blocked; i += 1) {
    const a = rawPoints[i - 1]!;
    const b = rawPoints[i]!;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 0.05) continue;
    const steps = Math.max(1, Math.ceil(segLen * 2));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      const sx = a.x + (b.x - a.x) * t;
      const sy = a.y + (b.y - a.y) * t;
      const gx = Math.round(sx);
      const gy = Math.round(sy);
      if (gx < 0 || gy < 0 || gx >= map.width || gy >= map.height) {
        blocked = true;
        blockReason = '路线超出当前区域范围，请在边境关口出境。';
        break;
      }
      const ter = TERRAIN_ORDER[terrainArr[gy * map.width + gx]!] ?? 'outside';
      if (!isPassableTerrain(ter)) {
        blocked = true;
        blockReason = ter === 'ocean'
          ? '前方为深海，大篷车无法渡海。'
          : ter === 'river' || ter === 'lake'
            ? '前方深水无桥，请绕行至桥梁渡河。'
            : ter === 'mountain'
              ? '前方险峰绝壁无法通行，请绕道。'
              : '路线触及区域外沿，请沿边界门出境。';
        break;
      }
      const stepDist = segLen / steps;
      const spd = TERRAIN_SPEED[ter];
      const cost = TERRAIN_COST[ter];
      distanceTiles += stepDist;
      weightedDays += stepDist / (12 * spd);
      fuelAcc += stepDist * 0.18 * cost.fuel;
      wearAcc += stepDist * 0.25 * cost.wear;
      speedSum += spd;
      sampleCount += 1;
      validPoints.push({ x: sx, y: sy });
    }
  }

  const end = validPoints[validPoints.length - 1]!;
  const endGx = Math.round(end.x);
  const endGy = Math.round(end.y);
  const reachedGate = map.gates.find(g => Math.hypot(g.x - endGx, g.y - endGy) <= 2.2);
  const reachedPoi = Object.values(map.pois).find(
    p => p.footprint.some(c => Math.hypot(c.x - endGx, c.y - endGy) <= 1.8),
  );

  const heads = state.performers.length + state.passengerOrders.filter(o => o.status === 'aboard').reduce((s, o) => s + o.seatsNeeded, 0);
  const travelDays = Math.max(0, Number((weightedDays * (evadeWar ? 1.25 : 1)).toFixed(2)));
  const rationsCost = Math.max(0, Math.round(travelDays * heads));
  const fuelCost = Math.max(0, Math.round(fuelAcc * (evadeWar ? 0.85 : 1)));
  const durabilityCost = Math.max(0, Math.round(wearAcc));

  return {
    points: [...rawPoints],
    validPoints,
    distanceTiles: Number(distanceTiles.toFixed(1)),
    travelDays,
    rationsCost,
    fuelCost,
    durabilityCost,
    blocked,
    blockReason,
    reachedGate,
    reachedPoiId: reachedPoi?.id,
    avgSpeedMultiplier: sampleCount ? Number((speedSum / sampleCount).toFixed(2)) : 1,
  };
}
