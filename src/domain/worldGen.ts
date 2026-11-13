/**
 * 128×128 世界地图程序化生成器（纯函数）。
 *
 * 生成逻辑：
 *  1. 中心连续大陆 + 四周海洋 + 外海离散岛屿。
 *  2. 9 个不规则大区按地理方位种子点 + 噪声扰动权重划分大陆。
 *  3. 生成高原山脉、4 条从内陆流向海洋的连续河流与多座内陆湖泊。
 */
import { REGION_IDS } from '../content/regions.ts';
import type {
  RegionBounds,
  RegionId,
  TerrainType,
  WorldLake,
  WorldMapData,
  WorldRiver,
} from '../types.ts';

export const WORLD_WIDTH = 128;
export const WORLD_HEIGHT = 128;

export const TERRAIN_ORDER: TerrainType[] = [
  'outside',
  'ocean',
  'coast',
  'lake',
  'river',
  'bridge',
  'border_gate',
  'wasteland',
  'road',
  'forest',
  'swamp',
  'mountain',
  'ruin',
  'warzone',
  'city',
  'village',
];

export const TERRAIN_TO_CODE: Record<TerrainType, number> = Object.fromEntries(
  TERRAIN_ORDER.map((t, idx) => [t, idx]),
) as Record<TerrainType, number>;

export function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function decodeBytes(b64: string, expectedLen?: number): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(expectedLen ?? binary.length);
  for (let i = 0; i < Math.min(binary.length, out.length); i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function decodeTerrainGrid(b64: string, len: number): Uint8Array {
  return decodeBytes(b64, len);
}

export function hashInt(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2d(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2d(x: number, y: number, scale: number, seed: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const n00 = hash2d(ix, iy, seed);
  const n10 = hash2d(ix + 1, iy, seed);
  const n01 = hash2d(ix, iy + 1, seed);
  const n11 = hash2d(ix + 1, iy + 1, seed);
  const nx0 = n00 + (n10 - n00) * ux;
  const nx1 = n01 + (n11 - n01) * ux;
  return nx0 + (nx1 - nx0) * uy;
}

export function fbm2d(x: number, y: number, seed: number): number {
  return (
    valueNoise2d(x, y, 22, seed) * 0.56 +
    valueNoise2d(x, y, 10, seed + 17) * 0.28 +
    valueNoise2d(x, y, 4.5, seed + 53) * 0.16
  );
}

const REGION_ANCHORS: Record<RegionId, { x: number; y: number }> = {
  frost_bastion: { x: 34, y: 26 },
  ancient_forest: { x: 64, y: 24 },
  demon_realm: { x: 94, y: 28 },
  iron_wastes: { x: 28, y: 62 },
  empire_heart: { x: 64, y: 62 },
  arcane_city: { x: 96, y: 60 },
  sand_oasis: { x: 32, y: 94 },
  sunken_marsh: { x: 64, y: 96 },
  dawn_coast: { x: 94, y: 94 },
};

export function pickRandomSpawnRegion(seed: number, preferred?: RegionId): RegionId {
  if (preferred && REGION_IDS.includes(preferred)) return preferred;
  const rng = createRng(hashInt(`spawn:${seed}`));
  return REGION_IDS[Math.floor(rng() * REGION_IDS.length)] ?? 'empire_heart';
}

export function generateWorldMap(seed: number): WorldMapData {
  const rng = createRng(hashInt(`world:${seed}`));
  const total = WORLD_WIDTH * WORLD_HEIGHT;
  const terrain = new Uint8Array(total);
  const regionGrid = new Uint8Array(total).fill(255);
  const elevation = new Float32Array(total);

  // 1. 中心大陆 + 四周海洋 + 外围岛屿高度场
  const islands = Array.from({ length: 5 }, (_, idx) => {
    const angle = (idx / 5) * Math.PI * 2 + rng() * 0.9;
    const dist = 48 + rng() * 10;
    return {
      x: Math.round(64 + Math.cos(angle) * dist),
      y: Math.round(64 + Math.sin(angle) * dist),
      r: 4 + rng() * 3.5,
    };
  });

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const idx = y * WORLD_WIDTH + x;
      if (x <= 3 || y <= 3 || x >= WORLD_WIDTH - 4 || y >= WORLD_HEIGHT - 4) {
        terrain[idx] = TERRAIN_TO_CODE.ocean;
        elevation[idx] = 0;
        continue;
      }
      const nx = (x - 64) / 47;
      const ny = (y - 64) / 46;
      const radial = Math.hypot(nx, ny);
      const n = fbm2d(x, y, seed);
      let h = 1.05 - radial * 0.95 + (n - 0.5) * 0.52;

      for (const isl of islands) {
        const d = Math.hypot(x - isl.x, y - isl.y) / isl.r;
        if (d < 1.2) h = Math.max(h, 0.72 - d * 0.35 + (n - 0.5) * 0.2);
      }
      elevation[idx] = h;
      if (h < 0.32) {
        terrain[idx] = TERRAIN_TO_CODE.ocean;
      } else if (h > 0.92) {
        terrain[idx] = TERRAIN_TO_CODE.mountain;
      } else if (h < 0.36) {
        terrain[idx] = TERRAIN_TO_CODE.coast;
      } else {
        terrain[idx] = TERRAIN_TO_CODE.wasteland;
      }
    }
  }

  // 2. 不规则 9 大区域划分（带噪声偏移的 Voronoi）
  const anchors = REGION_IDS.map((id, i) => ({
    id,
    idx: i,
    x: REGION_ANCHORS[id].x + (rng() - 0.5) * 6,
    y: REGION_ANCHORS[id].y + (rng() - 0.5) * 6,
  }));

  const minX = new Int16Array(9).fill(127);
  const minY = new Int16Array(9).fill(127);
  const maxX = new Int16Array(9).fill(0);
  const maxY = new Int16Array(9).fill(0);
  const sumX = new Int32Array(9);
  const sumY = new Int32Array(9);
  const counts = new Int32Array(9);

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const idx = y * WORLD_WIDTH + x;
      if (terrain[idx] === TERRAIN_TO_CODE.ocean) continue;
      const warpX = (valueNoise2d(x, y, 14, seed + 101) - 0.5) * 14;
      const warpY = (valueNoise2d(x, y, 14, seed + 202) - 0.5) * 14;
      let best = 0;
      let bestDist = Infinity;
      for (const anchor of anchors) {
        const d = Math.hypot(x + warpX - anchor.x, y + warpY - anchor.y);
        if (d < bestDist) {
          bestDist = d;
          best = anchor.idx;
        }
      }
      regionGrid[idx] = best;
      if (x < minX[best]!) minX[best] = x;
      if (y < minY[best]!) minY[best] = y;
      if (x > maxX[best]!) maxX[best] = x;
      if (y > maxY[best]!) maxY[best] = y;
      sumX[best] += x;
      sumY[best] += y;
      counts[best] += 1;
    }
  }

  // 3. 湖泊（3–5 座）
  const lakes: WorldLake[] = [];
  for (let i = 0; i < 4; i += 1) {
    const cx = Math.round(34 + rng() * 60);
    const cy = Math.round(34 + rng() * 60);
    const radius = 2 + Math.floor(rng() * 2);
    if (terrain[cy * WORLD_WIDTH + cx] === TERRAIN_TO_CODE.ocean) continue;
    lakes.push({ id: `lake-${i + 1}`, centerX: cx, centerY: cy, radius });
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy <= radius * radius + 1) {
          const lx = cx + dx;
          const ly = cy + dy;
          const li = ly * WORLD_WIDTH + lx;
          if (terrain[li] !== TERRAIN_TO_CODE.ocean) {
            terrain[li] = TERRAIN_TO_CODE.lake;
          }
        }
      }
    }
  }

  // 4. 河流（4 条从内陆高地流向海岸/海洋的连续水道）
  const rivers: WorldRiver[] = [];
  const riverDirs: [number, number][] = [
    [-1, -0.4],
    [1, -0.35],
    [0.9, 0.7],
    [-0.5, 0.95],
  ];
  for (let i = 0; i < riverDirs.length; i += 1) {
    let rx = Math.round(52 + rng() * 24);
    let ry = Math.round(48 + rng() * 28);
    const [vx, vy] = riverDirs[i]!;
    const points: { x: number; y: number }[] = [{ x: rx, y: ry }];
    for (let step = 0; step < 75; step += 1) {
      const jitterX = (rng() - 0.5) * 1.1;
      const jitterY = (rng() - 0.5) * 1.1;
      rx = Math.max(1, Math.min(WORLD_WIDTH - 2, Math.round(rx + vx + jitterX)));
      ry = Math.max(1, Math.min(WORLD_HEIGHT - 2, Math.round(ry + vy + jitterY)));
      const last = points[points.length - 1]!;
      // 插入连续曼哈顿衔接点防止斜角断裂
      if (last.x !== rx && last.y !== ry) {
        points.push({ x: rx, y: last.y });
      }
      if (last.x !== rx || last.y !== ry) {
        points.push({ x: rx, y: ry });
      }
      if (terrain[ry * WORLD_WIDTH + rx] === TERRAIN_TO_CODE.ocean) break;
    }
    for (const pt of points) {
      const idx = pt.y * WORLD_WIDTH + pt.x;
      if (terrain[idx] !== TERRAIN_TO_CODE.ocean && terrain[idx] !== TERRAIN_TO_CODE.lake) {
        terrain[idx] = TERRAIN_TO_CODE.river;
      }
    }
    rivers.push({ id: `river-${i + 1}`, points });
  }

  // 5. 生态润色（部分森林/沼泽着色供世界地图预览）
  for (let y = 4; y < WORLD_HEIGHT - 4; y += 1) {
    for (let x = 4; x < WORLD_WIDTH - 4; x += 1) {
      const idx = y * WORLD_WIDTH + x;
      if (terrain[idx] !== TERRAIN_TO_CODE.wasteland) continue;
      const regIdx = regionGrid[idx]!;
      const regId = REGION_IDS[regIdx];
      if (!regId) continue;
      const n = valueNoise2d(x, y, 7, seed + 303);
      if (regId === 'ancient_forest' && n > 0.35) terrain[idx] = TERRAIN_TO_CODE.forest;
      else if (regId === 'sunken_marsh' && n > 0.36) terrain[idx] = TERRAIN_TO_CODE.swamp;
      else if (regId === 'demon_realm' && n > 0.65) terrain[idx] = TERRAIN_TO_CODE.warzone;
      else if (n > 0.72) terrain[idx] = TERRAIN_TO_CODE.forest;
    }
  }

  const regionBounds = {} as Record<RegionId, RegionBounds>;
  for (let i = 0; i < REGION_IDS.length; i += 1) {
    const id = REGION_IDS[i]!;
    const count = Math.max(1, counts[i]!);
    const bMinX = minX[i]! <= maxX[i]! ? minX[i]! : Math.max(8, REGION_ANCHORS[id].x - 8);
    const bMinY = minY[i]! <= maxY[i]! ? minY[i]! : Math.max(8, REGION_ANCHORS[id].y - 8);
    const bMaxX = minX[i]! <= maxX[i]! ? maxX[i]! : Math.min(119, REGION_ANCHORS[id].x + 8);
    const bMaxY = minY[i]! <= maxY[i]! ? maxY[i]! : Math.min(119, REGION_ANCHORS[id].y + 8);
    regionBounds[id] = {
      minX: bMinX,
      minY: bMinY,
      maxX: bMaxX,
      maxY: bMaxY,
      centerX: Math.round(sumX[i]! / count) || REGION_ANCHORS[id].x,
      centerY: Math.round(sumY[i]! / count) || REGION_ANCHORS[id].y,
    };
  }

  return {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    seed,
    terrainBase64: encodeBytes(terrain),
    regionGridBase64: encodeBytes(regionGrid),
    regionBounds,
    rivers,
    lakes,
  };
}

const WORLD_TERRAIN_CACHE = new WeakMap<WorldMapData, { str: string; arr: Uint8Array }>();
const WORLD_REGION_CACHE = new WeakMap<WorldMapData, { str: string; arr: Uint8Array }>();

export function worldTerrainArray(world: WorldMapData): Uint8Array {
  const cached = WORLD_TERRAIN_CACHE.get(world);
  if (cached && cached.str === world.terrainBase64) return cached.arr;
  const arr = decodeBytes(world.terrainBase64, world.width * world.height);
  WORLD_TERRAIN_CACHE.set(world, { str: world.terrainBase64, arr });
  return arr;
}

export function worldRegionArray(world: WorldMapData): Uint8Array {
  const cached = WORLD_REGION_CACHE.get(world);
  if (cached && cached.str === world.regionGridBase64) return cached.arr;
  const arr = decodeBytes(world.regionGridBase64, world.width * world.height);
  WORLD_REGION_CACHE.set(world, { str: world.regionGridBase64, arr });
  return arr;
}

export function worldTerrainAt(world: WorldMapData, x: number, y: number): TerrainType {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return 'ocean';
  const arr = worldTerrainArray(world);
  return TERRAIN_ORDER[arr[y * world.width + x]!] ?? 'ocean';
}

export function worldRegionAt(world: WorldMapData, x: number, y: number): RegionId | undefined {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return undefined;
  const arr = worldRegionArray(world);
  const code = arr[y * world.width + x]!;
  return code < REGION_IDS.length ? REGION_IDS[code] : undefined;
}
