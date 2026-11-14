/**
 * 128×128 世界地图程序化生成器（纯函数）。
 *
 * 组合板块构造地貌（worldTectonics）与测地线自然疆域划分（worldProvinces），
 * 输出紧凑 base64 编码的世界地图与真实接壤邻区图。
 */
import { REGION_IDS } from '../content/regions.ts';
import type {
  RegionBounds,
  RegionId,
  RegionNeighbor,
  TerrainType,
  WorldMapData,
} from '../types.ts';
import { extractWorldNeighbors, partitionRegionsGeodesic } from './worldProvinces.ts';
import {
  buildTectonicContinent,
  carveHydrology,
  createRng,
  fbm2d,
  hashInt,
  valueNoise2d,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './worldTectonics.ts';

export { createRng, fbm2d, hashInt, valueNoise2d, WORLD_HEIGHT, WORLD_WIDTH };

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

export function pickRandomSpawnRegion(seed: number, preferred?: RegionId): RegionId {
  if (preferred && REGION_IDS.includes(preferred)) return preferred;
  const rng = createRng(hashInt(`spawn:${seed}`));
  return REGION_IDS[Math.floor(rng() * REGION_IDS.length)] ?? 'empire_heart';
}

export function generateWorldMap(seed: number): WorldMapData {
  const total = WORLD_WIDTH * WORLD_HEIGHT;
  const field = buildTectonicContinent(seed);
  const { lakes, rivers, isLake, isRiver } = carveHydrology(field, seed);
  const regionGrid = partitionRegionsGeodesic(field, isLake, isRiver, seed);

  const terrain = new Uint8Array(total);
  const minX = new Int16Array(9).fill(WORLD_WIDTH - 1);
  const minY = new Int16Array(9).fill(WORLD_HEIGHT - 1);
  const maxX = new Int16Array(9).fill(0);
  const maxY = new Int16Array(9).fill(0);
  const sumX = new Int32Array(9);
  const sumY = new Int32Array(9);
  const counts = new Int32Array(9);

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const idx = y * WORLD_WIDTH + x;
      if (field.isOcean[idx]) {
        terrain[idx] = TERRAIN_TO_CODE.ocean;
        continue;
      }
      const rIdx = regionGrid[idx]!;
      if (rIdx < 9) {
        if (x < minX[rIdx]!) minX[rIdx] = x;
        if (y < minY[rIdx]!) minY[rIdx] = y;
        if (x > maxX[rIdx]!) maxX[rIdx] = x;
        if (y > maxY[rIdx]!) maxY[rIdx] = y;
        sumX[rIdx] += x;
        sumY[rIdx] += y;
        counts[rIdx] += 1;
      }

      if (isLake[idx]) {
        terrain[idx] = TERRAIN_TO_CODE.lake;
      } else if (isRiver[idx]) {
        terrain[idx] = TERRAIN_TO_CODE.river;
      } else if (field.isMountain[idx]) {
        terrain[idx] = TERRAIN_TO_CODE.mountain;
      } else if (field.isCoast[idx]) {
        terrain[idx] = TERRAIN_TO_CODE.coast;
      } else {
        const regId = REGION_IDS[rIdx];
        const n = valueNoise2d(x, y, 7, seed + 303);
        if (regId === 'ancient_forest' && n > 0.34) terrain[idx] = TERRAIN_TO_CODE.forest;
        else if (regId === 'sunken_marsh' && n > 0.36) terrain[idx] = TERRAIN_TO_CODE.swamp;
        else if (regId === 'demon_realm' && n > 0.64) terrain[idx] = TERRAIN_TO_CODE.warzone;
        else if (regId === 'arcane_city' && n > 0.68) terrain[idx] = TERRAIN_TO_CODE.ruin;
        else if (n > 0.72) terrain[idx] = TERRAIN_TO_CODE.forest;
        else terrain[idx] = TERRAIN_TO_CODE.wasteland;
      }
    }
  }

  const regionBounds = {} as Record<RegionId, RegionBounds>;
  for (let i = 0; i < REGION_IDS.length; i += 1) {
    const id = REGION_IDS[i]!;
    const count = Math.max(1, counts[i]!);
    const hasCells = minX[i]! <= maxX[i]!;
    regionBounds[id] = {
      minX: hasCells ? minX[i]! : 48,
      minY: hasCells ? minY[i]! : 48,
      maxX: hasCells ? maxX[i]! : 80,
      maxY: hasCells ? maxY[i]! : 80,
      centerX: hasCells ? Math.round(sumX[i]! / count) : 64,
      centerY: hasCells ? Math.round(sumY[i]! / count) : 64,
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

const WORLD_TERRAIN_CACHE = new WeakMap<WorldMapData, Uint8Array>();
const WORLD_REGION_CACHE = new WeakMap<WorldMapData, Uint8Array>();
const WORLD_NEIGHBOR_CACHE = new WeakMap<WorldMapData, Record<RegionId, RegionNeighbor[]>>();

export function worldTerrainArray(world: WorldMapData): Uint8Array {
  let arr = WORLD_TERRAIN_CACHE.get(world);
  if (!arr) {
    arr = decodeBytes(world.terrainBase64, world.width * world.height);
    WORLD_TERRAIN_CACHE.set(world, arr);
  }
  return arr;
}

export function worldRegionArray(world: WorldMapData): Uint8Array {
  let arr = WORLD_REGION_CACHE.get(world);
  if (!arr) {
    arr = decodeBytes(world.regionGridBase64, world.width * world.height);
    WORLD_REGION_CACHE.set(world, arr);
  }
  return arr;
}

export function computeWorldNeighbors(world: WorldMapData): Record<RegionId, RegionNeighbor[]> {
  let cached = WORLD_NEIGHBOR_CACHE.get(world);
  if (!cached) {
    cached = extractWorldNeighbors(worldRegionArray(world), world.regionBounds);
    WORLD_NEIGHBOR_CACHE.set(world, cached);
  }
  return cached;
}

export function worldTerrainAt(world: WorldMapData, x: number, y: number): TerrainType {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return 'ocean';
  const code = worldTerrainArray(world)[y * world.width + x]!;
  return TERRAIN_ORDER[code] ?? 'ocean';
}

export function worldRegionAt(world: WorldMapData, x: number, y: number): RegionId | undefined {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return undefined;
  const code = worldRegionArray(world)[y * world.width + x]!;
  return code < REGION_IDS.length ? REGION_IDS[code] : undefined;
}
