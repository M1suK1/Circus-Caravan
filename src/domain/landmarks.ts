/**
 * 野外地图兴趣点（Field Landmarks）程序化布局与可见性纯计算（纯函数）。
 */
import { BEAST_SPECIES } from '../content/species.ts';
import type {
  FieldLandmark,
  LandmarkKind,
  RegionGate,
  RegionId,
  RegionMap,
  SettlementPoi,
  TerrainType,
} from '../types.ts';
import { createRng, hashInt, TERRAIN_ORDER } from './worldGen.ts';

export interface LandmarkMetaInfo {
  kind: LandmarkKind;
  label: string;
  subtitle: string;
  preferredTerrains: TerrainType[];
  primaryLabel: string;
  secondaryLabel: string;
}

export const LANDMARK_META: Record<LandmarkKind, LandmarkMetaInfo> = {
  ancient_ruin: {
    kind: 'ancient_ruin',
    label: '旧纪元遗迹',
    subtitle: '残破石柱与地下贮藏室',
    preferredTerrains: ['ruin', 'wasteland'],
    primaryLabel: '搜刮可用零件与道具',
    secondaryLabel: '测绘旧纪元壁画线索',
  },
  wild_lair: {
    kind: 'wild_lair',
    label: '奇兽灵泉巢穴',
    subtitle: '野生奇兽与亚人隐栖踪迹',
    preferredTerrains: ['forest', 'swamp', 'mountain', 'wasteland'],
    primaryLabel: '投网尝试蹲守捕捉',
    secondaryLabel: '静观记录生态习性',
  },
  refugee_camp: {
    kind: 'refugee_camp',
    label: '荒野流民营地',
    subtitle: '逃离战火的零散帐篷群',
    preferredTerrains: ['wasteland', 'road'],
    primaryLabel: '就地义演（大幅涨区域声望）',
    secondaryLabel: '施舍 4 份口粮换取口碑',
  },
  smuggler_cove: {
    kind: 'smuggler_cove',
    label: '隐秘渡口暗桩',
    subtitle: '走私舢板与暗夜接头灯',
    preferredTerrains: ['coast', 'river', 'swamp', 'wasteland'],
    primaryLabel: '暗桩折价购捕兽网 (65 金)',
    secondaryLabel: '打听邻区密道与黑市风闻',
  },
  watchtower_post: {
    kind: 'watchtower_post',
    label: '商路哨站税卡',
    subtitle: '高架瞭望塔与木栅关卡',
    preferredTerrains: ['road', 'bridge', 'wasteland'],
    primaryLabel: '报验口碑或缴税领取路引',
    secondaryLabel: '向哨兵购置军用口粮',
  },
  shrine_hearth: {
    kind: 'shrine_hearth',
    label: '星渊微光祭坛',
    subtitle: '刻着旧神星纹的苔石碑',
    preferredTerrains: ['forest', 'lake', 'wasteland', 'ruin'],
    primaryLabel: '燃起暖灯祈愿（恢复士气）',
    secondaryLabel: '解读灾厄与隐秘天使线索',
  },
};

const LANDMARK_NAMES: Record<LandmarkKind, string[]> = {
  ancient_ruin: ['倾颓星象塔基', '旧纪元地下粮仓', '断矛石柱廊', '锈铜工坊遗骸'],
  wild_lair: ['萤火浅潭兽穴', '枯木盘根巢', '冷泉岩隙窝棚', '长草浅谷栖地'],
  refugee_camp: ['北风流民火堆', '破篷车避难营', '焦土逃奴歇脚处', '荒原泥屋聚集点'],
  smuggler_cove: ['芦苇暗渡码头', '熄灯残桥私埠', '雾湾走私礁石', '铁锚旧河湾'],
  watchtower_post: ['石砌商路箭楼', '古道木栅关卡', '跨河收费哨所', '灰烟巡防岗亭'],
  shrine_hearth: ['星渊守望石碑', '微光风灯残坛', '长夜祈火石环', '净土古路界石'],
};

const PASSABLE_LAND_MASK = new Set<TerrainType>([
  'wasteland',
  'road',
  'forest',
  'swamp',
  'ruin',
  'warzone',
  'coast',
  'bridge',
]);

function countPassableNeighbors(terrain: Uint8Array, width: number, height: number, x: number, y: number): number {
  let count = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) continue;
    const t = TERRAIN_ORDER[terrain[ny * width + nx]!] ?? 'outside';
    if (PASSABLE_LAND_MASK.has(t)) count += 1;
  }
  return count;
}

export function generateRegionLandmarks(
  regionId: RegionId,
  terrain: Uint8Array,
  width: number,
  height: number,
  pois: Record<string, SettlementPoi>,
  gates: readonly RegionGate[],
  regionSeed: number,
): Record<string, FieldLandmark> {
  const rng = createRng(hashInt(`${regionSeed}:landmarks:${regionId}`));
  const targetCount = 4 + Math.floor(rng() * 4); // 4..7 个
  const kinds: LandmarkKind[] = [
    'ancient_ruin',
    'wild_lair',
    'refugee_camp',
    'smuggler_cove',
    'watchtower_post',
    'shrine_hearth',
  ];

  // 收集各可通行候选格
  const candidatesByTerrain = new Map<TerrainType, { x: number; y: number }[]>();
  for (let y = 3; y < height - 3; y += 1) {
    for (let x = 3; x < width - 3; x += 1) {
      const t = TERRAIN_ORDER[terrain[y * width + x]!] ?? 'outside';
      if (!PASSABLE_LAND_MASK.has(t)) continue;
      if (countPassableNeighbors(terrain, width, height, x, y) < 2) continue;
      let list = candidatesByTerrain.get(t);
      if (!list) {
        list = [];
        candidatesByTerrain.set(t, list);
      }
      list.push({ x, y });
    }
  }

  const regionalSpecies = BEAST_SPECIES.filter(sp => sp.habitatRegions.includes(regionId));
  const poiList = Object.values(pois);
  const placed: FieldLandmark[] = [];

  const canPlace = (x: number, y: number) => {
    for (const poi of poiList) {
      if (Math.hypot(poi.x - x, poi.y - y) < 8) return false;
    }
    for (const gate of gates) {
      if (Math.hypot(gate.x - x, gate.y - y) < 7) return false;
    }
    for (const lm of placed) {
      if (Math.hypot(lm.x - x, lm.y - y) < 13) return false;
    }
    return true;
  };

  for (let i = 0; i < targetCount; i += 1) {
    const kind = kinds[(i + Math.floor(rng() * kinds.length)) % kinds.length]!;
    const meta = LANDMARK_META[kind];
    let picked: { x: number; y: number; terrain: TerrainType } | undefined;

    for (const pref of meta.preferredTerrains) {
      const pool = candidatesByTerrain.get(pref);
      if (!pool?.length) continue;
      for (let attempt = 0; attempt < 48; attempt += 1) {
        const cand = pool[Math.floor(rng() * pool.length)]!;
        if (canPlace(cand.x, cand.y)) {
          picked = { x: cand.x, y: cand.y, terrain: pref };
          break;
        }
      }
      if (picked) break;
    }

    if (!picked) {
      const fallbackPool = candidatesByTerrain.get('wasteland') ?? candidatesByTerrain.get('road');
      if (fallbackPool?.length) {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const cand = fallbackPool[Math.floor(rng() * fallbackPool.length)]!;
          if (canPlace(cand.x, cand.y)) {
            picked = { x: cand.x, y: cand.y, terrain: TERRAIN_ORDER[terrain[cand.y * width + cand.x]!] ?? 'wasteland' };
            break;
          }
        }
      }
    }
    if (!picked) continue;

    const names = LANDMARK_NAMES[kind];
    const name = names[Math.floor(rng() * names.length)]!;
    const linkedSpeciesId = kind === 'wild_lair' && regionalSpecies.length
      ? regionalSpecies[Math.floor(rng() * regionalSpecies.length)]!.id
      : undefined;

    placed.push({
      id: `${regionId}-lm-${i + 1}`,
      regionId,
      kind,
      x: picked.x,
      y: picked.y,
      terrain: picked.terrain,
      name,
      summary: meta.subtitle,
      discovered: false,
      resolved: false,
      linkedSpeciesId,
    });
  }

  return Object.fromEntries(placed.map(lm => [lm.id, lm]));
}

export function isLandmarkRevealed(
  map: RegionMap,
  lm: FieldLandmark,
  caravanPos: { x: number; y: number },
  visionRadius = 12,
): boolean {
  if (lm.discovered || lm.resolved) return true;
  if ((lm.x - caravanPos.x) ** 2 + (lm.y - caravanPos.y) ** 2 <= visionRadius * visionRadius) {
    return true;
  }
  const bytes = Math.ceil((map.width * map.height) / 8);
  const bin = typeof atob === 'function' ? atob(map.exploredMaskBase64) : '';
  if (bin.length < bytes) return false;
  const idx = lm.y * map.width + lm.x;
  const byteVal = bin.charCodeAt(idx >> 3);
  return Boolean((byteVal >> (idx & 7)) & 1);
}

export function findReachedLandmark(
  map: RegionMap,
  x: number,
  y: number,
): FieldLandmark | undefined {
  const list = Object.values(map.landmarks ?? {});
  return list.find(lm => Math.hypot(lm.x + 0.5 - x, lm.y + 0.5 - y) <= 2.1);
}
