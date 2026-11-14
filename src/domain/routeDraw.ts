/**
 * 手动划线探索、地形速度/消耗演算与迷雾位掩码管理（纯函数）。
 *
 * 严格遵循栅格几何约定：整数格 (gx, gy) 占据连续坐标区间 [gx, gx + 1) × [gy, gy + 1)，格心位于 (gx + 0.5, gy + 0.5)。
 */
import { regionTerrainArray } from './regionGen.ts';
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
  const gx = Math.floor(x);
  const gy = Math.floor(y);
  if (gx < 0 || gy < 0 || gx >= map.width || gy >= map.height) return false;
  const mask = exploredMaskArray(map);
  const idx = gy * map.width + gx;
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
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2 || (x - cx) ** 2 + (y - cy) ** 2 <= r2) {
        const idx = y * map.width + x;
        mask[idx >> 3] = mask[idx >> 3]! | (1 << (idx & 7));
      }
    }
  }
  map.exploredMaskBase64 = encodeBytes(mask);
}

function terrainAtGrid(terrainArr: Uint8Array, w: number, h: number, gx: number, gy: number): TerrainType {
  if (gx < 0 || gy < 0 || gx >= w || gy >= h) return 'outside';
  return TERRAIN_ORDER[terrainArr[gy * w + gx]!] ?? 'outside';
}

/**
 * 解析采样点 (sx, sy) 所在地形：
 *  1. 严格使用 Math.floor(sx), Math.floor(sy) 对齐栅格 [gx, gx + 1)，彻底根除 Math.round 造成的半格误偏移；
 *  2. 若手绘斜线跨过四邻接单格木桥或折线山道时轻微擦过格角（离双轴格边均 < 0.38 格，且该角两侧正交邻格皆可通行），
 *     平滑取用可通行邻格，防止在桥梁/弯道上无端报红线；而真正画入河道、海面或山体时仍立即拦截。
 */
function resolveSampleTerrain(
  terrainArr: Uint8Array,
  w: number,
  h: number,
  sx: number,
  sy: number,
): TerrainType {
  const gx = Math.floor(sx);
  const gy = Math.floor(sy);
  const direct = terrainAtGrid(terrainArr, w, h, gx, gy);
  if (isPassableTerrain(direct)) return direct;

  const fx = sx - gx;
  const fy = sy - gy;
  const nx = fx < 0.38 ? gx - 1 : fx > 0.62 ? gx + 1 : gx;
  const ny = fy < 0.38 ? gy - 1 : fy > 0.62 ? gy + 1 : gy;
  if (nx !== gx && ny !== gy) {
    const tx = terrainAtGrid(terrainArr, w, h, nx, gy);
    const ty = terrainAtGrid(terrainArr, w, h, gx, ny);
    if (isPassableTerrain(tx) && isPassableTerrain(ty)) {
      return TERRAIN_SPEED[tx] >= TERRAIN_SPEED[ty] ? tx : ty;
    }
  }
  return direct;
}

/** 根据车队沿手绘折线采样（步长 <= 0.33 格），计算速度、消耗与障碍截断 */
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

  const terrainArr = regionTerrainArray(map);
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
    if (segLen < 0.04) continue;
    const steps = Math.max(1, Math.ceil(segLen * 3));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      const sx = a.x + (b.x - a.x) * t;
      const sy = a.y + (b.y - a.y) * t;
      const gx = Math.floor(sx);
      const gy = Math.floor(sy);
      if (gx < 0 || gy < 0 || gx >= map.width || gy >= map.height) {
        blocked = true;
        blockReason = '路线超出当前区域范围，请在边境关口出境。';
        break;
      }
      const ter = resolveSampleTerrain(terrainArr, map.width, map.height, sx, sy);
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
  const reachedGate = map.gates.find(g => Math.hypot(g.x + 0.5 - end.x, g.y + 0.5 - end.y) <= 2.4);
  const reachedPoi = Object.values(map.pois).find(
    p => p.footprint.some(c => Math.hypot(c.x + 0.5 - end.x, c.y + 0.5 - end.y) <= 2.0),
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
