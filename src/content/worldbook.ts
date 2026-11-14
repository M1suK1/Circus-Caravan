/**
 * 《残响大篷车 · Circus Caravan》末世世界书知识库（提炼自 docs/ 设定集）。
 *
 * 注：九大地区末世灾厄与潜伏天使/伪装恶魔仅作为复用 night-sugar-office「故事蓝图」模式的机制规则参考，
 *     不固化具体固定灾厄名或固定剧本 NPC。
 */
import type { RegionId } from '../types.ts';

export type WorldbookCategory =
  | 'canon'
  | 'empires'
  | 'religions'
  | 'factions'
  | 'ecology'
  | 'blueprint_mechanics';

export interface WorldbookEntry {
  id: string;
  category: WorldbookCategory;
  title: string;
  keywords: string[];
  regionIds: RegionId[] | 'all';
  priority: number;
  defaultEnabled: boolean;
  content: string;
}

export const WORLDBOOK_CATEGORY_LABELS: Record<WorldbookCategory, string> = {
  canon: '末世总纲与终局',
  empires: '三大人类帝国',
  religions: '三种主要宗教',
  factions: '势力冲突与魔王军',
  ecology: '奇幻生物与魔物娘生态',
  blueprint_mechanics: '灾厄与隐秘博弈（蓝图机制）',
};

export const WORLDBOOK_ENTRIES: WorldbookEntry[] = [
  {
    id: 'wb-canon-circus',
    category: 'canon',
    title: '世界总纲：风灯微光与世外净土',
    keywords: ['大篷车', '末世', '隐居', '净土', 'sanctuary', '风灯'],
    regionIds: 'all',
    priority: 100,
    defaultEnabled: true,
    content: '旧神纪元崩裂后的残破末世，灰雾、战乱与资源枯竭割裂大陆。唯有悬挂暖黄魔导风灯的流浪马戏团穿行九大地区，在破败城村搭棚献艺，以演出、货运、载客与驯养奇兽维持生计，最终目标是在攒够隐居基金并探明净土航路后，带全团远离战火共同隐居。',
  },
  {
    id: 'wb-empire-holy-crest',
    category: 'empires',
    title: '神圣圣徽帝国（封建骑士与贵族残余）',
    keywords: ['人类帝国', '圣徽', '税卡', '骑士', '驯化铜环'],
    regionIds: ['empire_heart', 'frost_bastion'],
    priority: 90,
    defaultEnabled: true,
    content: '神圣圣徽帝国统治原人类文明中枢与部分北境边塞，石砌官道网密集但关卡税吏林立。帝国将魔物娘视为合法私产（契约农奴与战仆），未佩戴「帝国驯化铜环」或缺少《演出特许状》的异种族过卡时极易遭骑士团按无主逃奴扣押。',
  },
  {
    id: 'wb-empire-aether-spire',
    category: 'empires',
    title: '穹顶魔导帝国（浮空塔魔法寡头）',
    keywords: ['魔法都市', '浮空塔', '魔导', '炼金', '幻术'],
    regionIds: ['arcane_city', 'dawn_coast'],
    priority: 90,
    defaultEnabled: true,
    content: '穹顶魔导帝国依靠半坍塌的浮空晶石塔维系防御结界，崇尚精英魔导技术。城邦观众极度追捧华丽的星光与幻术大轴，票房溢价极高；但高阶法师议会暗中与黑市勾结，重金悬赏星光、虚空与冰霜系稀有魔物娘充当魔材实验体。',
  },
  {
    id: 'wb-empire-helios-brass',
    category: 'empires',
    title: '赫利俄斯铜沙帝国（商皇朝与蒸汽寡头）',
    keywords: ['铜沙', '焚沙裂谷', '锈铁', '巴扎', '契约', '赏金'],
    regionIds: ['sand_oasis', 'iron_wastes'],
    priority: 90,
    defaultEnabled: true,
    content: '赫利俄斯铜沙帝国横跨赤沙商道与蒸汽废土，信奉金币与契约至上。境内货运与载客报酬丰厚，但露天奴隶巴扎完全合法化；若公开违抗奴隶契约或拒绝交出被悬赏逃奴，将招致商会赏金猎人追杀。',
  },
  {
    id: 'wb-religion-dawn',
    category: 'religions',
    title: '晨曦救赎教（黎明圣教废奴阵线）',
    keywords: ['晨曦救赎教', '黎明圣教', '废奴', '庇护所', '希望值'],
    regionIds: 'all',
    priority: 85,
    defaultEnabled: true,
    content: '晨曦救赎教由底层修女、战地医师与废奴者组成，主张「众生皆有微光，怜悯高于秩序」，是黎明圣教势力的信仰母体。他们开设施粥棚与地下庇护所协助魔物娘逃亡，将提升城镇希望值的马戏团视为盟友，但坚决反对血腥斗兽与奴隶拍卖。',
  },
  {
    id: 'wb-religion-furnace',
    category: 'religions',
    title: '灰烬铸炉教（永火苦修派）',
    keywords: ['灰烬铸炉教', '灰烬军团', '矿坑', '火焰', '排外'],
    regionIds: ['iron_wastes', 'empire_heart', 'frost_bastion'],
    priority: 80,
    defaultEnabled: true,
    content: '灰烬铸炉教诞生于焦土战壕与矿坑，崇拜锻锤、炉火与绝对服从，为军工矿场与灰烬军团提供精神支柱。信徒排斥轻浮滑稽的喜剧，视魔物娘为廉价苦力与燃料，仅勉强认可展现力量与烈焰威压的节目。',
  },
  {
    id: 'wb-religion-star-abyss',
    category: 'religions',
    title: '星渊万灵教（泛灵与净土守望者）',
    keywords: ['星渊万灵教', '泛灵', '净土', '萨满', '传闻'],
    regionIds: ['ancient_forest', 'sunken_marsh', 'dawn_coast'],
    priority: 80,
    defaultEnabled: true,
    content: '星渊万灵教靠古老歌谣维系，信徒多为森林游侠、沼泽艄公、老船长与野生魔物娘部落。他们视挂着暖黄风灯的马戏团为当代点灯萨满，常通过古老星象与传闻替良善旅人指引隐秘渡口与净土线索。',
  },
  {
    id: 'wb-factions-conflict',
    category: 'factions',
    title: '多方势力冲突与奴隶贸易夹缝',
    keywords: ['铁轨商会', '灰烬军团', '锈蚀黑市', '黎明圣教', '奴隶'],
    regionIds: 'all',
    priority: 88,
    defaultEnabled: true,
    content: '大陆核心撕裂围绕「魔物娘奴隶贸易与反抗战」展开：铁轨商会垄断正规干道与镀金契约拍卖，灰烬军团强征战仆，锈蚀黑市充当盗猎源头；唯有黎明圣教与魔王军高举废奴旗帜。拍卖高阶魔物娘虽能快速凑齐隐居资金，却会重创圣教好感与剧团人心。',
  },
  {
    id: 'wb-faction-demon-army',
    category: 'factions',
    title: '魔王军：苍灰解放阵线（魔物娘正规军）',
    keywords: ['魔王军', '苍灰解放阵线', '魔王城', '解放', '逃兵'],
    regionIds: ['demon_realm', 'empire_heart', 'arcane_city', 'iron_wastes'],
    priority: 84,
    defaultEnabled: true,
    content: '由脱逃魔物娘集结而成的武装解放阵线「苍灰解放阵线」，按种族天赋编有重甲盾卫、远程狙击、夜战情报、炼金工兵、战地医官与亡灵仪仗。她们袭击奴隶押运线并试探人类马戏团——若见团长平等善待同胞，可从敌对警戒转为默许通行的暗中友军。',
  },
  {
    id: 'wb-ecology-pyramid',
    category: 'ecology',
    title: '奇幻生物与魔物娘四阶生态金字塔',
    keywords: ['奇幻生物', '魔物娘', '区域精英', '驯化', '兽笼', '捕获网'],
    regionIds: 'all',
    priority: 82,
    defaultEnabled: true,
    content: '大陆生态呈四层结构：① 27 种区域常规奇兽（荒野开荒与后勤产出主力）；② 7 类被驯化聚落亚人公民（城村常见、身处居留铜牌与贬奴夹缝）及 27 种野生地区魔物娘；③ 6 种魔王军专有魔物娘（前线与废墟游走）；④ 9 种区域精英传奇生物（狮鹫、古龙、元素精灵、凤凰、利维坦等，仅在核心高危地形极低概率现身）。',
  },
  {
    id: 'wb-blueprint-calamity-mechanism',
    category: 'blueprint_mechanics',
    title: '灾厄演化与潜伏天使/伪装恶魔（故事蓝图机制参考）',
    keywords: ['灾厄', '潜伏天使', '伪装恶魔', '故事蓝图', 'StoryPlan', '破局'],
    regionIds: 'all',
    priority: 76,
    defaultEnabled: true,
    content: '【机制参考 · 非固定剧本】各地末世灾厄与「潜伏天使 vs 伪装恶魔」博弈复用故事蓝图（StoryPlan / StoryGraph）动态生成与推进：不同地区按当前状态动态衍生局部灾厄等级（影响耗油、粮价、迷雾回退或车损）与披着凡人职业外衣的高维潜伏者。线索通过「舞台演出观众反应」「搭车乘客破绽」「斥候与灵性生物直觉」自然浮现，最终导向协助天使平息灾厄或接受恶魔重金诱惑等动态分支结局。',
  },
];

export function filterWorldbookEntries(
  category: WorldbookCategory | 'all',
  regionId?: RegionId,
): WorldbookEntry[] {
  return WORLDBOOK_ENTRIES.filter(entry => {
    if (category !== 'all' && entry.category !== category) return false;
    if (regionId && entry.regionIds !== 'all' && !entry.regionIds.includes(regionId)) return false;
    return true;
  });
}
