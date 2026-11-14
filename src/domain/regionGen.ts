/**
 * 10× 区域小地图程序化生成器（继承世界地图形状、河湖位置，生成 1–3 座多格城市与主要道路）。
 */
import { REGION_CATALOG, REGION_IDS, type RegionProfile } from '../content/regions.ts';
import { applyRegionHydrology } from './regionHydrology.ts';
import {
  computeWorldNeighbors,
  createRng,
  decodeBytes,
  encodeBytes,
  hashInt,
  TERRAIN_ORDER,
  TERRAIN_TO_CODE,
  valueNoise2d,
} from './worldGen.ts';
import type {
  Direction,
  RegionGate,
  RegionId,
  RegionMap,
  SettlementDetails,
  SettlementPoi,
  TerrainType,
  WorldMapData,
} from '../types.ts';

const SCALE = 10;

function sampleEcoTerrain(
  weights: Partial<Record<TerrainType, number>>,
  roll: number,
  allowSwampWater: boolean,
): TerrainType {
  // 除沉没泽国外，禁止随机噪声散撒零碎水洼（水体必须集中成完整湖泊或连续河流）；同时禁止中部随机撒山堵路
  const entries = (Object.entries(weights) as [TerrainType, number][]).filter(
    ([terrain]) => terrain !== 'mountain' && (allowSwampWater || terrain !== 'lake'),
  );
  if (!entries.length) return 'wasteland';
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let acc = roll * total;
  for (const [terrain, w] of entries) {
    acc -= w;
    if (acc <= 0) return terrain;
  }
  return 'wasteland';
}

function isPassableBase(t: TerrainType): boolean {
  return t !== 'outside' && t !== 'ocean' && t !== 'mountain' && t !== 'lake' && t !== 'river';
}

export function generateRegionMap(world: WorldMapData, regionId: RegionId, worldSeed: number): RegionMap {
  const profile = REGION_CATALOG[regionId];
  const bounds = world.regionBounds[regionId];
  const width = (bounds.maxX - bounds.minX + 1) * SCALE;
  const height = (bounds.maxY - bounds.minY + 1) * SCALE;
  const worldOffsetX = bounds.minX * SCALE;
  const worldOffsetY = bounds.minY * SCALE;
  const regionSeed = hashInt(`${worldSeed}:region:${regionId}`);
  const rng = createRng(regionSeed);

  const worldTerrain = decodeBytes(world.terrainBase64, world.width * world.height);
  const worldRegions = decodeBytes(world.regionGridBase64, world.width * world.height);
  const regionIndex = REGION_IDS.indexOf(regionId);
  const terrain = new Uint8Array(width * height);

  // 1. 按 10× 等比映射世界地图不规则轮廓、海洋、大湖与生态地形（山脉严格继承世界疆域边界山）
  let worldLakeTiles = 0;

  for (let ly = 0; ly < height; ly += 1) {
    const wy = bounds.minY + Math.floor(ly / SCALE);
    for (let lx = 0; lx < width; lx += 1) {
      const wx = bounds.minX + Math.floor(lx / SCALE);
      const wIdx = wy * world.width + wx;
      const wReg = worldRegions[wIdx]!;
      const wTer = TERRAIN_ORDER[worldTerrain[wIdx]!] ?? 'ocean';
      const lIdx = ly * width + lx;

      if (wTer === 'ocean') {
        terrain[lIdx] = TERRAIN_TO_CODE.ocean;
        continue;
      }
      if (wReg !== regionIndex) {
        terrain[lIdx] = TERRAIN_TO_CODE.outside;
        continue;
      }
      if (wTer === 'lake') {
        terrain[lIdx] = TERRAIN_TO_CODE.lake;
        worldLakeTiles += 1;
        continue;
      }
      if (wTer === 'river') {
        terrain[lIdx] = TERRAIN_TO_CODE.river;
        continue;
      }
      if (wTer === 'coast') {
        terrain[lIdx] = TERRAIN_TO_CODE.coast;
        continue;
      }

      const n = valueNoise2d(lx, ly, 9, regionSeed + 41);
      if (wTer === 'mountain' && n > 0.18) {
        terrain[lIdx] = TERRAIN_TO_CODE.mountain;
      } else {
        const picked = sampleEcoTerrain(profile.terrainWeights, n, false);
        terrain[lIdx] = TERRAIN_TO_CODE[picked];
      }
    }
  }

  // 2. 集中水体（河道映射、沉没泽国湿地水泊、常规集中大湖、焚沙裂谷低概率小绿洲并清理孤立水洼）
  applyRegionHydrology({
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
  });

  // 3. 收集所有可用陆地格
  const landCells: { x: number; y: number }[] = [];
  for (let y = 3; y < height - 3; y += 1) {
    for (let x = 3; x < width - 3; x += 1) {
      const t = TERRAIN_ORDER[terrain[y * width + x]!]!;
      if (isPassableBase(t)) landCells.push({ x, y });
    }
  }

  // 4. 在真实接壤的大区接触边缘（或最近海岸渡口）开设跨区出境关口（border_gate）
  const gates: RegionGate[] = [];
  const liveNeighbors = computeWorldNeighbors(world)[regionId] ?? profile.neighbors;
  for (const neighbor of liveNeighbors) {
    const targetIdx = REGION_IDS.indexOf(neighbor.targetRegionId);
    const targetBounds = world.regionBounds[neighbor.targetRegionId];
    const targetLx = (targetBounds.centerX - bounds.minX) * SCALE;
    const targetLy = (targetBounds.centerY - bounds.minY) * SCALE;
    const candidates: { x: number; y: number }[] = [];
    for (let ly = 2; ly < height - 2; ly += 1) {
      for (let lx = 2; lx < width - 2; lx += 1) {
        const cur = TERRAIN_ORDER[terrain[ly * width + lx]!]!;
        if (!isPassableBase(cur) && cur !== 'coast') continue;
        const wx = bounds.minX + Math.floor(lx / SCALE);
        const wy = bounds.minY + Math.floor(ly / SCALE);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nwx = wx + dx;
          const nwy = wy + dy;
          if (nwx >= 0 && nwy >= 0 && nwx < world.width && nwy < world.height) {
            if (worldRegions[nwy * world.width + nwx] === targetIdx) {
              candidates.push({ x: lx, y: ly });
              break;
            }
          }
        }
      }
    }
    let chosen: { x: number; y: number } | undefined = candidates.length
      ? candidates[Math.floor(candidates.length * 0.5)]
      : undefined;
    if (!chosen && landCells.length) {
      let bestD = Infinity;
      for (let k = 0; k < landCells.length; k += 3) {
        const c = landCells[k]!;
        if (gates.some(g => Math.hypot(g.x - c.x, g.y - c.y) < 8)) continue;
        const d = Math.hypot(c.x - targetLx, c.y - targetLy);
        if (d < bestD) {
          bestD = d;
          chosen = c;
        }
      }
    }
    const finalGate = chosen ?? landCells[Math.floor(rng() * Math.max(1, landCells.length))] ?? { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    terrain[finalGate.y * width + finalGate.x] = TERRAIN_TO_CODE.border_gate;
    gates.push({ direction: neighbor.direction as Direction, targetRegionId: neighbor.targetRegionId, x: finalGate.x, y: finalGate.y });
  }

  // 5. 生成 1–3 座多格占地城市 + 2–4 座村庄（只定位置与占地，details 为 undefined）
  const pois: Record<string, SettlementPoi> = {};
  const cityCount = Math.min(3, Math.max(1, profile.cityCount));
  const villageCount = Math.min(4, Math.max(2, profile.villageCount));
  const poiAnchorList: { x: number; y: number; kind: 'city' | 'village' }[] = [];

  const farEnough = (x: number, y: number, minD: number) =>
    poiAnchorList.every(p => Math.hypot(p.x - x, p.y - y) >= minD);

  const canPlaceBlock = (cx: number, cy: number, half: number) => {
    for (let dy = -half; dy <= half; dy += 1) {
      for (let dx = -half; dx <= half; dx += 1) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 3 || ny < 3 || nx >= width - 3 || ny >= height - 3) return false;
        const t = TERRAIN_ORDER[terrain[ny * width + nx]!]!;
        if (!isPassableBase(t) && t !== 'coast') return false;
      }
    }
    return true;
  };

  for (let i = 0; i < cityCount; i += 1) {
    let placed: { x: number; y: number } | undefined;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const cand = landCells[Math.floor(rng() * landCells.length)];
      if (!cand) break;
      if (farEnough(cand.x, cand.y, Math.min(width, height) * 0.22) && canPlaceBlock(cand.x, cand.y, 2)) {
        placed = cand;
        break;
      }
    }
    if (!placed && landCells.length) {
      for (const cand of landCells) {
        if (farEnough(cand.x, cand.y, 12) && canPlaceBlock(cand.x, cand.y, 1)) {
          placed = cand;
          break;
        }
      }
    }
    if (!placed) continue;
    poiAnchorList.push({ x: placed.x, y: placed.y, kind: 'city' });
    const half = canPlaceBlock(placed.x, placed.y, 2) ? 2 : 1;
    const footprint: { x: number; y: number }[] = [];
    for (let dy = -half; dy <= half; dy += 1) {
      for (let dx = -half; dx <= half; dx += 1) {
        // 切掉四个角形成略微有机多边形城郭（仍然 >= 9~21 格）
        if (half === 2 && Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
        const fx = placed.x + dx;
        const fy = placed.y + dy;
        terrain[fy * width + fx] = TERRAIN_TO_CODE.city;
        footprint.push({ x: fx, y: fy });
      }
    }
    const id = `${regionId}-city-${i + 1}`;
    pois[id] = {
      id,
      regionId,
      kind: 'city',
      x: placed.x,
      y: placed.y,
      footprint,
      scouted: false,
      placeholderName: `未侦查城郭遗址 #${i + 1}`,
      visitedCount: 0,
    };
  }

  for (let i = 0; i < villageCount; i += 1) {
    let placed: { x: number; y: number } | undefined;
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const cand = landCells[Math.floor(rng() * landCells.length)];
      if (!cand) break;
      if (farEnough(cand.x, cand.y, 14) && canPlaceBlock(cand.x, cand.y, 1)) {
        placed = cand;
        break;
      }
    }
    if (!placed) continue;
    poiAnchorList.push({ x: placed.x, y: placed.y, kind: 'village' });
    const footprint = [{ x: placed.x, y: placed.y }, { x: placed.x + 1, y: placed.y }];
    for (const cell of footprint) terrain[cell.y * width + cell.x] = TERRAIN_TO_CODE.village;
    const id = `${regionId}-village-${i + 1}`;
    pois[id] = {
      id,
      regionId,
      kind: 'village',
      x: placed.x,
      y: placed.y,
      footprint,
      scouted: false,
      placeholderName: `远方风灯聚落 #${i + 1}`,
      visitedCount: 0,
    };
  }

  // 6. 主要道路连通所有城市、村庄与边界关口（跨河自动建桥 bridge）
  const carveMajorRoad = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    let cx = from.x;
    let cy = from.y;
    const steps = width * 2 + height * 2;
    for (let s = 0; s < steps && (cx !== to.x || cy !== to.y); s += 1) {
      const dx = to.x - cx;
      const dy = to.y - cy;
      if (dx !== 0 && (dy === 0 || rng() < 0.56)) cx += Math.sign(dx);
      else if (dy !== 0) cy += Math.sign(dy);
      const idx = cy * width + cx;
      const cur = TERRAIN_ORDER[terrain[idx]!]!;
      if (cur === 'city' || cur === 'village' || cur === 'border_gate' || cur === 'outside' || cur === 'ocean') continue;
      if (cur === 'river' || cur === 'lake') {
        terrain[idx] = TERRAIN_TO_CODE.bridge;
      } else {
        terrain[idx] = TERRAIN_TO_CODE.road;
      }
    }
  };

  const allPois = Object.values(pois);
  for (let i = 1; i < allPois.length; i += 1) {
    carveMajorRoad(allPois[i - 1]!, allPois[i]!);
  }
  for (const gate of gates) {
    const nearest = [...allPois].sort(
      (a, b) => Math.hypot(a.x - gate.x, a.y - gate.y) - Math.hypot(b.x - gate.x, b.y - gate.y),
    )[0];
    if (nearest) carveMajorRoad(nearest, gate);
  }

  const exploredMask = new Uint8Array(Math.ceil((width * height) / 8));

  return {
    regionId,
    scale: 10,
    worldOffsetX,
    worldOffsetY,
    width,
    height,
    seed: regionSeed,
    terrainBase64: encodeBytes(terrain),
    exploredMaskBase64: encodeBytes(exploredMask),
    gates,
    pois,
  };
}

const REGION_TERRAIN_CACHE = new WeakMap<RegionMap, { str: string; arr: Uint8Array }>();

export function regionTerrainArray(map: RegionMap): Uint8Array {
  const cached = REGION_TERRAIN_CACHE.get(map);
  if (cached && cached.str === map.terrainBase64) return cached.arr;
  const arr = decodeBytes(map.terrainBase64, map.width * map.height);
  REGION_TERRAIN_CACHE.set(map, { str: map.terrainBase64, arr });
  return arr;
}

export function regionTerrainAt(map: RegionMap, x: number, y: number): TerrainType {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return 'outside';
  const arr = regionTerrainArray(map);
  return TERRAIN_ORDER[arr[y * map.width + x]!] ?? 'outside';
}

export function surroundingTerrainsOf(map: RegionMap, x: number, y: number): TerrainType[] {
  const out: TerrainType[] = [];
  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const t = regionTerrainAt(map, x + dx, y + dy);
      if (t !== 'outside') out.push(t);
    }
  }
  return out;
}

const CITY_PREFIXES = ['灰塔', '铁锚', '余晖', '风铃', '碎碑', '白霜', '赤铜', '星落', '暗沼'];
const VILLAGE_SUFFIXES = ['炉火村', '渡口寨', '铃铛屯', '微光集', '歇脚亭', '旧井村', '苔石坞'];
const CITY_SUFFIXES = ['堡', '重镇', '集城', '要塞', '港市'];

export function fallbackSettlementDetails(
  poi: SettlementPoi,
  region: RegionProfile,
  surroundings: readonly TerrainType[],
  seed: number,
): SettlementDetails {
  const rng = createRng(hashInt(`poi:${seed}:${poi.id}`));
  const prefix = CITY_PREFIXES[Math.floor(rng() * CITY_PREFIXES.length)]!;
  const suffix = poi.kind === 'city'
    ? CITY_SUFFIXES[Math.floor(rng() * CITY_SUFFIXES.length)]!
    : VILLAGE_SUFFIXES[Math.floor(rng() * VILLAGE_SUFFIXES.length)]!;
  const hasSwamp = surroundings.includes('swamp');
  const hasRiver = surroundings.includes('river') || surroundings.includes('lake');
  const hasWar = surroundings.includes('warzone');
  const trait = hasWar
    ? '战备戒严·粮草溢价'
    : hasSwamp
      ? '沼雾潮湿·修车费高'
      : hasRiver
        ? '临河渡口·水路客运多'
        : '商路残站·盼望夜戏';

  return {
    name: `${prefix}${suffix}`,
    summary: `坐落在${region.name}一隅的${poi.kind === 'city' ? '多街区残破城邦' : '孤立村寨'}。虽四周余波未散，广场与酒馆的风灯仍在摇曳，民众翘首期盼一场能忘却苦难的马戏夜演。`,
    hope: Math.max(15, 55 - region.dangerTier * 7 + Math.floor(rng() * 15)),
    ownerFaction: region.dominantFaction,
    preferredActs: [...region.preferredActs],
    marketTraits: [trait],
    rumorLead: '斥候打听到邻近河道桥梁尚可通行，但前方商路尽头偶有军阀盘查。',
    detailSource: 'fallback',
    npcIds: [],
  };
}
