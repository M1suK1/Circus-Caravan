/**
 * 9 大奇幻地区小地图程序化生成器（纯函数）。
 *
 * 规则：
 *  1. 每个大区尺寸为 18 × 12 网格，四周必为 `boundary`（区域边界），并在接壤方向生成 `border_gate`。
 *  2. 内部按照大区生态权重随机铺设荒地、沼泽、密林、山脉、水体、废墟与战区。
 *  3. 随机选择若干坐标安置城市（`city`）与村庄（`village`），并用 A* 寻路连出必通道路（`road`）。
 *  4. 聚落初生时仅确定位置与占位符（`scouted: false, details: undefined`），等待玩家侦查后再由 LLM 详述。
 */
import { REGION_CATALOG, REGION_IDS, type RegionProfile } from '../content/regions.ts';
import type {
  Direction,
  FogLevel,
  RegionGate,
  RegionId,
  RegionMap,
  SettlementDetails,
  SettlementPoi,
  TerrainTile,
  TerrainType,
} from '../types.ts';

export const REGION_WIDTH = 18;
export const REGION_HEIGHT = 12;

export function hashInt(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRandomSpawnRegion(seed: number, preferred?: RegionId): RegionId {
  if (preferred && REGION_CATALOG[preferred]) return preferred;
  const rng = createRng(hashInt(`spawn:${seed}`));
  return REGION_IDS[Math.floor(rng() * REGION_IDS.length)] ?? 'empire_heart';
}

function sampleTerrain(weights: Partial<Record<TerrainType, number>>, roll: number): TerrainType {
  const entries = Object.entries(weights) as [TerrainType, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let acc = roll * total;
  for (const [terrain, w] of entries) {
    acc -= w;
    if (acc <= 0) return terrain;
  }
  return 'wasteland';
}

function gateCoord(direction: Direction, rng: () => number): { x: number; y: number } {
  if (direction === 'north') return { x: 3 + Math.floor(rng() * (REGION_WIDTH - 6)), y: 0 };
  if (direction === 'south') return { x: 3 + Math.floor(rng() * (REGION_WIDTH - 6)), y: REGION_HEIGHT - 1 };
  if (direction === 'west') return { x: 0, y: 2 + Math.floor(rng() * (REGION_HEIGHT - 4)) };
  return { x: REGION_WIDTH - 1, y: 2 + Math.floor(rng() * (REGION_HEIGHT - 4)) };
}

function gateInsideAnchor(gate: RegionGate): { x: number; y: number } {
  if (gate.direction === 'north') return { x: gate.x, y: 1 };
  if (gate.direction === 'south') return { x: gate.x, y: REGION_HEIGHT - 2 };
  if (gate.direction === 'west') return { x: 1, y: gate.y };
  return { x: REGION_WIDTH - 2, y: gate.y };
}

function carveRoad(
  tiles: TerrainTile[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  rng: () => number,
): void {
  let cx = from.x;
  let cy = from.y;
  const maxSteps = REGION_WIDTH * REGION_HEIGHT;
  for (let step = 0; step < maxSteps && (cx !== to.x || cy !== to.y); step += 1) {
    const dx = to.x - cx;
    const dy = to.y - cy;
    const moveX = dx !== 0 && (dy === 0 || rng() < 0.55);
    if (moveX) cx += Math.sign(dx);
    else if (dy !== 0) cy += Math.sign(dy);
    const tile = tiles[cy * REGION_WIDTH + cx]!;
    if (tile.terrain !== 'city' && tile.terrain !== 'village' && tile.terrain !== 'border_gate' && tile.terrain !== 'boundary') {
      tile.terrain = 'road';
    }
  }
}

export function revealFogAround(map: RegionMap, cx: number, cy: number, radius = 2, fog: FogLevel = 'charted'): void {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (Math.abs(dx) + Math.abs(dy) > radius + 1) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const tile = map.tiles[ny * map.width + nx]!;
      if (fog === 'charted' || tile.fog === 'unseen') tile.fog = fog;
    }
  }
}

export function generateRegionMap(regionId: RegionId, worldSeed: number): RegionMap {
  const profile = REGION_CATALOG[regionId];
  const seed = hashInt(`${worldSeed}:${regionId}`);
  const rng = createRng(seed);
  const tiles: TerrainTile[] = [];

  for (let y = 0; y < REGION_HEIGHT; y += 1) {
    for (let x = 0; x < REGION_WIDTH; x += 1) {
      const isBorder = x === 0 || y === 0 || x === REGION_WIDTH - 1 || y === REGION_HEIGHT - 1;
      const terrain: TerrainType = isBorder ? 'boundary' : sampleTerrain(profile.terrainWeights, rng());
      tiles.push({ x, y, terrain, fog: 'unseen' });
    }
  }

  // 安放区域边界门
  const gates: RegionGate[] = profile.neighbors.map(n => {
    const coord = gateCoord(n.direction, rng);
    const tile = tiles[coord.y * REGION_WIDTH + coord.x]!;
    tile.terrain = 'border_gate';
    tile.gateToRegionId = n.targetRegionId;
    tile.fog = 'rumored';
    return { direction: n.direction, targetRegionId: n.targetRegionId, x: coord.x, y: coord.y };
  });

  // 安置城市与村庄位置（只定坐标，不预生成详情）
  const pois: Record<string, SettlementPoi> = {};
  const taken = new Set<string>();
  const wantedKinds: ('city' | 'village')[] = [
    ...Array.from({ length: profile.cityCount }, () => 'city' as const),
    ...Array.from({ length: profile.villageCount }, () => 'village' as const),
  ];

  const tooClose = (x: number, y: number) =>
    Object.values(pois).some(p => Math.abs(p.x - x) + Math.abs(p.y - y) < 4);

  wantedKinds.forEach((kind, idx) => {
    let px = 2 + Math.floor(rng() * (REGION_WIDTH - 4));
    let py = 2 + Math.floor(rng() * (REGION_HEIGHT - 4));
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const candX = 2 + Math.floor(rng() * (REGION_WIDTH - 4));
      const candY = 2 + Math.floor(rng() * (REGION_HEIGHT - 4));
      if (!taken.has(`${candX},${candY}`) && !tooClose(candX, candY)) {
        px = candX;
        py = candY;
        break;
      }
    }
    taken.add(`${px},${py}`);
    const id = `${regionId}-${kind}-${idx + 1}`;
    const tile = tiles[py * REGION_WIDTH + px]!;
    tile.terrain = kind;
    tile.poiId = id;
    tile.fog = 'rumored';
    pois[id] = {
      id,
      regionId,
      kind,
      x: px,
      y: py,
      scouted: false,
      placeholderName: kind === 'city' ? `迷雾城郭轮廓 #${idx + 1}` : `远方微光村落 #${idx + 1}`,
      visitedCount: 0,
    };
  });

  // 连接所有聚落 + 各出境口内部的锚点，确保地图 100% 道路可达
  const poiList = Object.values(pois);
  for (let i = 1; i < poiList.length; i += 1) {
    carveRoad(tiles, poiList[i - 1]!, poiList[i]!, rng);
  }
  for (const gate of gates) {
    const anchor = gateInsideAnchor(gate);
    const nearest = [...poiList].sort(
      (a, b) => Math.abs(a.x - anchor.x) + Math.abs(a.y - anchor.y) - (Math.abs(b.x - anchor.x) + Math.abs(b.y - anchor.y)),
    )[0];
    if (nearest) carveRoad(tiles, nearest, anchor, rng);
    const anchorTile = tiles[anchor.y * REGION_WIDTH + anchor.x]!;
    if (anchorTile.terrain === 'mountain' || anchorTile.terrain === 'water') anchorTile.terrain = 'road';
  }

  return { regionId, width: REGION_WIDTH, height: REGION_HEIGHT, seed, gates, tiles, pois };
}

export function surroundingTerrainsOf(map: RegionMap, x: number, y: number): TerrainType[] {
  const out: TerrainType[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      out.push(map.tiles[ny * map.width + nx]!.terrain);
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
  const hasWar = surroundings.includes('warzone');
  const trait = hasSwamp ? '沼雾潮湿·修车费高' : hasWar ? '战备戒严·口粮紧缺' : '路过商旅·盼望夜戏';

  return {
    name: `${prefix}${suffix}`,
    summary: `坐落在${region.name}一隅的${poi.kind === 'city' ? '残破城邦' : '孤立村落'}。虽被废土与余波包围，酒馆和广场的油灯仍顽强亮着，人们渴望能暂时忘记末日的一场马戏。`,
    hope: Math.max(15, 55 - region.dangerTier * 7 + Math.floor(rng() * 15)),
    ownerFaction: region.dominantFaction,
    preferredActs: [...region.preferredActs],
    marketTraits: [trait],
    rumorLead: `听说邻近区域仍有未熄灭的风灯商路，但边界处近期巡逻频繁。`,
    detailSource: 'fallback',
    npcIds: [],
  };
}
