import type { FactionId, FactionState } from '../types.ts';

export interface FactionMeta {
  id: FactionId;
  name: string;
  title: string;
  color: string;
  description: string;
  initialStanding: number;
  atWarWith: FactionId[];
}

export const FACTIONS: Record<FactionId, FactionMeta> = {
  human_empire: {
    id: 'human_empire',
    name: '人类帝国残军',
    title: '圣徽皇土守备团',
    color: '#d8b467',
    description: '固守旧皇都与石砌干道的封建武装，一边对过路商旅征收重税，一边竭力维持秩序的表象。',
    initialStanding: 10,
    atWarWith: ['demon_court'],
  },
  arcane_conclave: {
    id: 'arcane_conclave',
    name: '魔法都市议会',
    title: '浮空塔秘法联合',
    color: '#9aa8f8',
    description: '掌控残存魔导能源与浮石高塔的学者集团，对高雅幻术演出兴致浓厚，却轻视泥地里的杂耍班子。',
    initialStanding: 5,
    atWarWith: ['rust_syndicate'],
  },
  demon_court: {
    id: 'demon_court',
    name: '魔王城余烬领',
    title: '焦土黑域诸侯',
    color: '#d96b78',
    description: '盘踞火山灰域的魔族军阀与混血部族，崇尚力量与奇兽决斗，对普通人带着危险的好奇。',
    initialStanding: -15,
    atWarWith: ['human_empire', 'dawn_order'],
  },
  iron_guild: {
    id: 'iron_guild',
    name: '铁轨商会',
    title: '蒸汽干道行会',
    color: '#c49664',
    description: '控制矿脉、零件工坊与正规拍卖行的商业巨擘，只要付得起通行费与关税便一切好谈。',
    initialStanding: 15,
    atWarWith: [],
  },
  dawn_order: {
    id: 'dawn_order',
    name: '黎明圣教',
    title: '微光救济修会',
    color: '#f4d58d',
    description: '在荒芜村落间布施救济的苦行教团，热忱欢迎能给民众带来笑声与希望的巡游艺人。',
    initialStanding: 25,
    atWarWith: ['demon_court'],
  },
  rust_syndicate: {
    id: 'rust_syndicate',
    name: '锈蚀黑市',
    title: '暗道走私同盟',
    color: '#9e84a8',
    description: '活跃于沼泽与边境荒原的盗猎者与走私客，不看通行证，只认罕见奇幻生物与违禁货物。',
    initialStanding: 0,
    atWarWith: ['arcane_conclave'],
  },
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];

export function createInitialFactions(): Record<FactionId, FactionState> {
  const out = {} as Record<FactionId, FactionState>;
  for (const id of FACTION_IDS) {
    const meta = FACTIONS[id];
    out[id] = {
      id,
      name: meta.name,
      standing: meta.initialStanding,
      hasPass: id === 'dawn_order' || id === 'iron_guild',
      atWarWith: [...meta.atWarWith],
    };
  }
  return out;
}
