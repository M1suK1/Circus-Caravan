/**
 * LLM 六大叙事作用域模板、按需世界书上下文裁剪器与离线动态蓝图生成器。
 */
import type { RegionCalamityBlueprint, RegionId } from '../types.ts';
import { REGION_CATALOG } from './regions.ts';
import { WORLDBOOK_ENTRIES, type WorldbookEntry } from './worldbook.ts';

export type NarrativeScope =
  | 'scout'
  | 'campfire'
  | 'encounter'
  | 'blueprint'
  | 'rumor'
  | 'ending';

export const NARRATIVE_SCOPE_LABELS: Record<NarrativeScope, string> = {
  scout: '聚落初探简报 (scout)',
  campfire: '篝火夜谈与 VN (campfire)',
  encounter: '野外兴趣点奇遇 (encounter)',
  blueprint: '灾厄与隐秘蓝图 (blueprint)',
  rumor: '残响电台风闻 (rumor)',
  ending: '世外隐居尾声 (ending)',
};

export const DEFAULT_SCOPE_PROMPTS: Record<NarrativeScope, string> = {
  scout:
    '你是末世流浪马戏团的随行斥候。严格依据【大区基调】【区域声望】【周边十倍小地图地形】与【世界书激活词条】，输出结构化 JSON（name、summary、preferredActs、marketTraits、rumorLead），刻画破败中挣扎求生的城村细节。',
  campfire:
    '你是角色扮演叙事引擎。请保持随行演员的【性格】【口癖】【人生目标】与当前【羁绊/疲劳】，在末世风灯营地的氛围里生成 4-6 拍中文对话或视觉小说节拍，并严禁越界篡改玩家金币与物品数量。',
  encounter:
    '你是荒野见闻导演。结合【兴趣点类型】【当前地形】【随行团员与奇兽特性】，撰写一幕有因有果、兼具生存张力与微光的 120 字短遇，并用白名单提案标签反映小幅度士气或线索收获。',
  blueprint:
    '依据世界书《灾厄演化与潜伏天使/伪装恶魔（故事蓝图机制参考）》，不要固化固定剧本 NPC 姓名，而是按当前世界衰败度为大区动态构建 1 个局部灾厄阶段表、1 名伪装成凡人的潜伏天使、1 名挑拨仇恨的伪装恶魔与 3 条可被演出/搭车触发的破绽线索。',
  rumor:
    '你是大陆残响电台与酒馆耳目，用简练的地方市井口吻把玩家昨日的关键举动（高声望义演、走私查获、魔物娘拍卖等）编织成 1-2 条流传在商路上的鲜活风闻。',
  ending:
    '剧团即将带着积攒的金币与羁绊远离战乱隐居。请回顾玩家走过的大区、声望高低与每位团员/奇兽的经历，写下温情而克制、互不雷同的个人尾声与总评。',
};

export function selectActiveWorldbookEntries(
  enabledIds: Record<string, boolean> | undefined,
  regionId: RegionId,
  keywords: readonly string[],
  maxChars = 1400,
  maxEntries = 5,
): WorldbookEntry[] {
  const lowerKws = keywords.map(k => k.trim().toLowerCase()).filter(Boolean);
  const candidates = WORLDBOOK_ENTRIES.filter(entry => {
    const enabled = enabledIds ? Boolean(enabledIds[entry.id]) : entry.defaultEnabled;
    if (!enabled) return false;
    if (entry.regionIds !== 'all' && !entry.regionIds.includes(regionId)) return false;
    return true;
  });

  const scored = candidates.map(entry => {
    let score = entry.priority;
    if (entry.regionIds !== 'all' && entry.regionIds.includes(regionId)) score += 30;
    for (const kw of lowerKws) {
      if (entry.keywords.some(ek => ek.toLowerCase().includes(kw) || kw.includes(ek.toLowerCase()))) {
        score += 25;
      } else if (entry.content.toLowerCase().includes(kw)) {
        score += 10;
      }
    }
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const picked: WorldbookEntry[] = [];
  let charAcc = 0;
  for (const row of scored) {
    if (picked.length >= maxEntries) break;
    const cost = row.entry.title.length + row.entry.content.length + 12;
    if (picked.length > 0 && charAcc + cost > maxChars) break;
    picked.push(row.entry);
    charAcc += cost;
  }
  return picked;
}

const CALAMITY_NOUNS = ['灰雾锈疫', '魔脉暗蚀', '冻风熄火潮', '酸雨蚀骨雾', '沙暴枯竭症', '黑日躁狂风'];
const ANGEL_COVERS = ['修补旧水渠的哑巴匠人', '摆渡废河的盲眼老艄公', '在镇口施粥的破袍药徒', '抄写旧曲谱的落魄盲琴师'];
const DEVIL_COVERS = ['收缴重税的特使随从', '倒卖净水与灯油的行商掌柜', '兜售狂暴药剂的战地掮客', '假借祈福敛财的假神职顾问'];

function hashPick(seed: number, salt: number, len: number): number {
  const h = Math.abs(Math.imul(seed ^ (salt * 2654435761), 0x45d9f3b));
  return h % len;
}

export function buildFallbackBlueprint(
  regionId: RegionId,
  worldSeed: number,
  worldDecay: number,
): RegionCalamityBlueprint {
  const region = REGION_CATALOG[regionId];
  const seed = worldSeed + regionId.split('').reduce((s, c) => s + c.charCodeAt(0) * 17, 0);
  const calamityName = `${region.name}·${CALAMITY_NOUNS[hashPick(seed, 1, CALAMITY_NOUNS.length)]}`;
  const angelCover = ANGEL_COVERS[hashPick(seed, 2, ANGEL_COVERS.length)]!;
  const devilCover = DEVIL_COVERS[hashPick(seed, 3, DEVIL_COVERS.length)]!;
  const severity: 1 | 2 | 3 = worldDecay >= 65 ? 3 : worldDecay >= 45 ? 2 : 1;

  return {
    id: `bp-${regionId}-${seed}`,
    regionId,
    calamityName,
    severity,
    angelCover,
    devilCover,
    clues: [
      `舞台奏响希望曲目时，角落里的「${angelCover}」脚边落下带有微光的旧羽毛碎屑。`,
      `某位看似体面的「${devilCover}」在见到星光系奇兽幻象时突然捂耳退席，鞋印泛着焦黑。`,
      `荒野祭坛石碑记述：「${calamityName}」并非天灾，而是被恶意挑动的绝望所喂养。`,
    ],
    discoveredClues: [],
    source: 'fallback',
  };
}
