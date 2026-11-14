/**
 * 10× 区域小地图水系聚焦塑造与孤立水洼清理（纯函数）。
 *
 * 除沉没泽国外，其余大区禁止散碎小水洼，水体集中呈完整湖泊或连续河流；焚沙裂谷极大降低水体生成概率。
 */
import { TERRAIN_ORDER, TERRAIN_TO_CODE, valueNoise2d } from './worldGen.ts';
import type { RegionId, TerrainType, WorldMapData } from '../types.ts';

function isPassableLand(t: TerrainType): boolean {
  return t !== 'outside' && t !== 'ocean' && t !== 'mountain' && t !== 'lake' && t !== 'river';
}

export function applyRegionHydrology(params: {
  world: WorldMapData;
  regionId: RegionId;
  terrain: Uint8Array;
  width: number;
  height: number;
  worldOffsetX: number;
  worldOffsetY: number;
  worldLakeTiles: number;
  regionSeed: number;
  rng: () => number;
}): void {
  const {
    world,
    regionId,
    terrain,
    width,
    height,
    worldOffsetX,
    worldOffsetY,
    worldLakeTiles,
    regionSeed,
    rng,
  } = params;

  const SCALE = 10;
  const isMarsh = regionId === 'sunken_marsh';
  const isArid = regionId === 'sand_oasis';

  // 1. 精确映射世界河流线段并在 10× 缩放廊道中平滑加宽（焚沙裂谷河道较窄）
  const riverHalf = isArid ? 0 : 1;
  for (const river of world.rivers) {
    for (let i = 1; i < river.points.length; i += 1) {
      const p0 = river.points[i - 1]!;
      const p1 = river.points[i]!;
      const x0 = (p0.x + 0.5) * SCALE - worldOffsetX;
      const y0 = (p0.y + 0.5) * SCALE - worldOffsetY;
      const x1 = (p1.x + 0.5) * SCALE - worldOffsetX;
      const y1 = (p1.y + 0.5) * SCALE - worldOffsetY;
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        const cx = Math.round(x0 + (x1 - x0) * t);
        const cy = Math.round(y0 + (y1 - y0) * t);
        for (let dy = -riverHalf; dy <= riverHalf; dy += 1) {
          for (let dx = -riverHalf; dx <= riverHalf; dx += 1) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const idx = ny * width + nx;
            const cur = TERRAIN_ORDER[terrain[idx]!];
            if (cur !== 'outside' && cur !== 'ocean' && cur !== 'lake') {
              terrain[idx] = TERRAIN_TO_CODE.river;
            }
          }
        }
      }
    }
  }

  // 2. 集中湖泊塑造：沉没泽国生成多片湿地水泊；其他地区至多 1 座集中大湖；焚沙裂谷低概率仅 1 处小绿洲
  const carveConcentratedLake = (cx: number, cy: number, radius: number) => {
    for (let dy = -radius - 1; dy <= radius + 1; dy += 1) {
      for (let dx = -radius - 1; dx <= radius + 1; dx += 1) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 3 || ny < 3 || nx >= width - 3 || ny >= height - 3) continue;
        const warp = (valueNoise2d(nx, ny, 4.0, regionSeed + 557) - 0.5) * 1.4;
        if (Math.hypot(dx, dy) <= radius + warp) {
          const idx = ny * width + nx;
          const cur = TERRAIN_ORDER[terrain[idx]!];
          if (cur !== 'outside' && cur !== 'ocean' && cur !== 'river') {
            terrain[idx] = TERRAIN_TO_CODE.lake;
          }
        }
      }
    }
  };

  if (isMarsh) {
    for (let p = 0; p < 5; p += 1) {
      const lx = Math.round(width * (0.2 + rng() * 0.6));
      const ly = Math.round(height * (0.2 + rng() * 0.6));
      if (isPassableLand(TERRAIN_ORDER[terrain[ly * width + lx]!]!)) {
        carveConcentratedLake(lx, ly, 3 + Math.floor(rng() * 3));
      }
    }
  } else if (worldLakeTiles < 16) {
    const shouldCarve = isArid ? rng() < 0.25 : regionId !== 'demon_realm' || rng() < 0.45;
    if (shouldCarve) {
      const rad = isArid ? 2 : 4 + Math.floor(rng() * 2);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const lx = Math.round(width * (0.22 + rng() * 0.56));
        const ly = Math.round(height * (0.22 + rng() * 0.56));
        if (isPassableLand(TERRAIN_ORDER[terrain[ly * width + lx]!]!)) {
          carveConcentratedLake(lx, ly, rad);
          break;
        }
      }
    }
  }

  // 3. 清除任何残留孤立单格小水洼
  if (!isMarsh) {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = y * width + x;
        const t = TERRAIN_ORDER[terrain[idx]!]!;
        if (t !== 'lake' && t !== 'river') continue;
        const hasWaterNeighbor =
          TERRAIN_ORDER[terrain[idx + 1]!] === 'lake' || TERRAIN_ORDER[terrain[idx + 1]!] === 'river' ||
          TERRAIN_ORDER[terrain[idx - 1]!] === 'lake' || TERRAIN_ORDER[terrain[idx - 1]!] === 'river' ||
          TERRAIN_ORDER[terrain[idx + width]!] === 'lake' || TERRAIN_ORDER[terrain[idx + width]!] === 'river' ||
          TERRAIN_ORDER[terrain[idx - width]!] === 'lake' || TERRAIN_ORDER[terrain[idx - width]!] === 'river';
        if (!hasWaterNeighbor) {
          terrain[idx] = TERRAIN_TO_CODE.wasteland;
        }
      }
    }
  }
}
