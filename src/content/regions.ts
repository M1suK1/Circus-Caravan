import type { ActTag, FactionId, MacroRegion, RegionId, RegionNeighbor, TerrainType } from '../types.ts';

export interface RegionProfile {
  id: RegionId;
  name: string;
  subtitle: string;
  theme: string;
  dominantFaction: FactionId | 'neutral';
  dangerTier: 1 | 2 | 3 | 4 | 5;
  neighbors: RegionNeighbor[];
  preferredActs: ActTag[];
  /** 生态权重（仅用于内部非边界、非道路格的程序化地形采样） */
  terrainWeights: Partial<Record<TerrainType, number>>;
  villageCount: number;
  cityCount: number;
}

export const REGION_CATALOG: Record<RegionId, RegionProfile> = {
  frost_bastion: {
    id: 'frost_bastion',
    name: '极北霜壁',
    subtitle: '永冻矿垒与风雪边塞',
    theme: '冷冽冻原与废弃矿道交错的北方边疆，居民裹着厚兽皮缩在锅炉旁取暖。',
    dominantFaction: 'iron_guild',
    dangerTier: 3,
    neighbors: [
      { direction: 'east', targetRegionId: 'ancient_forest' },
      { direction: 'south', targetRegionId: 'iron_wastes' },
    ],
    preferredActs: ['flame', 'music'],
    terrainWeights: { wasteland: 45, mountain: 22, forest: 16, water: 7, ruin: 10 },
    villageCount: 4,
    cityCount: 2,
  },
  ancient_forest: {
    id: 'ancient_forest',
    name: '古老之森',
    subtitle: '遮天巨木与浓雾迷林',
    theme: '参天古木蔽日的苍翠废林，林间渗出沼泽毒雾，藏着大量原生奇幻兽与树梢村落。',
    dominantFaction: 'dawn_order',
    dangerTier: 2,
    neighbors: [
      { direction: 'west', targetRegionId: 'frost_bastion' },
      { direction: 'east', targetRegionId: 'demon_realm' },
      { direction: 'south', targetRegionId: 'empire_heart' },
    ],
    preferredActs: ['beast_tame', 'music', 'illusion'],
    terrainWeights: { forest: 48, swamp: 20, wasteland: 12, water: 10, ruin: 10 },
    villageCount: 5,
    cityCount: 1,
  },
  demon_realm: {
    id: 'demon_realm',
    name: '魔王城领',
    subtitle: '焦土黑域与余烬高塔',
    theme: '火山灰终年飘落的魔族残疆，破碎黑曜石城垒间盘踞着凶猛战兽与黑市角斗场。',
    dominantFaction: 'demon_court',
    dangerTier: 5,
    neighbors: [
      { direction: 'west', targetRegionId: 'ancient_forest' },
      { direction: 'south', targetRegionId: 'arcane_city' },
    ],
    preferredActs: ['flame', 'beast_tame', 'acrobatics'],
    terrainWeights: { wasteland: 38, mountain: 25, ruin: 18, warzone: 12, swamp: 7 },
    villageCount: 3,
    cityCount: 2,
  },
  iron_wastes: {
    id: 'iron_wastes',
    name: '锈铁荒原',
    subtitle: '齿轮废土与残破铁道',
    theme: '旧纪元蒸汽厂与断轨横陈的灰褐色荒野，铁轨商会的修车工坊和零件黑市在此林立。',
    dominantFaction: 'iron_guild',
    dangerTier: 2,
    neighbors: [
      { direction: 'north', targetRegionId: 'frost_bastion' },
      { direction: 'east', targetRegionId: 'empire_heart' },
      { direction: 'south', targetRegionId: 'sand_oasis' },
    ],
    preferredActs: ['acrobatics', 'comedy', 'flame'],
    terrainWeights: { wasteland: 52, ruin: 20, mountain: 14, swamp: 8, forest: 6 },
    villageCount: 4,
    cityCount: 2,
  },
  empire_heart: {
    id: 'empire_heart',
    name: '人类帝国',
    subtitle: '圣徽皇土与破碎城邦',
    theme: '曾经繁盛的帝国腹地，如今城墙斑驳、关卡森严，逃难的农夫与士兵都在盼一场能笑出声的夜戏。',
    dominantFaction: 'human_empire',
    dangerTier: 2,
    neighbors: [
      { direction: 'north', targetRegionId: 'ancient_forest' },
      { direction: 'west', targetRegionId: 'iron_wastes' },
      { direction: 'east', targetRegionId: 'arcane_city' },
      { direction: 'south', targetRegionId: 'sunken_marsh' },
    ],
    preferredActs: ['comedy', 'acrobatics', 'music'],
    terrainWeights: { wasteland: 42, forest: 24, water: 12, ruin: 12, warzone: 10 },
    villageCount: 5,
    cityCount: 2,
  },
  arcane_city: {
    id: 'arcane_city',
    name: '魔法都市',
    subtitle: '浮空塔废都与晶石环区',
    theme: '魔导晶石碎块浮在半空的奇迹遗城，法师学徒与平民混居在断塔下，狂热追捧奇幻幻术秀。',
    dominantFaction: 'arcane_conclave',
    dangerTier: 3,
    neighbors: [
      { direction: 'north', targetRegionId: 'demon_realm' },
      { direction: 'west', targetRegionId: 'empire_heart' },
      { direction: 'south', targetRegionId: 'dawn_coast' },
    ],
    preferredActs: ['illusion', 'music', 'beast_tame'],
    terrainWeights: { wasteland: 36, ruin: 28, water: 14, forest: 12, mountain: 10 },
    villageCount: 3,
    cityCount: 3,
  },
  sand_oasis: {
    id: 'sand_oasis',
    name: '焚沙裂谷',
    subtitle: '赤沙商道与盐湖绿洲',
    theme: '干涸盐床与赤沙漫卷的荒谷，孤立绿洲村落愿花重金收购补给并款待远方来客。',
    dominantFaction: 'neutral',
    dangerTier: 3,
    neighbors: [
      { direction: 'north', targetRegionId: 'iron_wastes' },
      { direction: 'east', targetRegionId: 'sunken_marsh' },
    ],
    preferredActs: ['flame', 'acrobatics', 'comedy'],
    terrainWeights: { wasteland: 58, mountain: 22, ruin: 12, water: 8 },
    villageCount: 4,
    cityCount: 2,
  },
  sunken_marsh: {
    id: 'sunken_marsh',
    name: '沉没泽国',
    subtitle: '腐雾湿地与高脚木城',
    theme: '酸雨积聚成无边泥沼，木桩搭起的村寨在浓雾里摇晃，走私船夫比正规军更熟悉这里的路。',
    dominantFaction: 'rust_syndicate',
    dangerTier: 4,
    neighbors: [
      { direction: 'north', targetRegionId: 'empire_heart' },
      { direction: 'west', targetRegionId: 'sand_oasis' },
      { direction: 'east', targetRegionId: 'dawn_coast' },
    ],
    preferredActs: ['illusion', 'comedy', 'beast_tame'],
    terrainWeights: { swamp: 48, water: 20, forest: 18, ruin: 8, wasteland: 6 },
    villageCount: 4,
    cityCount: 2,
  },
  dawn_coast: {
    id: 'dawn_coast',
    name: '曙光裂岸',
    subtitle: '雾海港湾与废弃灯塔',
    theme: '大陆东南尽头的破碎海岸线，雾港渔民仍在点亮残破灯塔，传说浓雾彼端藏着世外隐居净土。',
    dominantFaction: 'dawn_order',
    dangerTier: 2,
    neighbors: [
      { direction: 'north', targetRegionId: 'arcane_city' },
      { direction: 'west', targetRegionId: 'sunken_marsh' },
    ],
    preferredActs: ['music', 'illusion', 'comedy'],
    terrainWeights: { wasteland: 36, water: 24, forest: 18, swamp: 12, ruin: 10 },
    villageCount: 4,
    cityCount: 2,
  },
};

export const REGION_IDS = Object.keys(REGION_CATALOG) as RegionId[];

export function createInitialMacroRegions(): Record<RegionId, MacroRegion> {
  const out = {} as Record<RegionId, MacroRegion>;
  for (const id of REGION_IDS) {
    const profile = REGION_CATALOG[id];
    out[id] = {
      id,
      name: profile.name,
      subtitle: profile.subtitle,
      theme: profile.theme,
      dominantFaction: profile.dominantFaction,
      neighbors: profile.neighbors.map(n => ({ ...n })),
      dangerTier: profile.dangerTier,
      map: undefined,
    };
  }
  return out;
}
