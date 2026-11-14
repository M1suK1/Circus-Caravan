/**
 * 参考宝可梦属性系统的奇兽与魔物娘六大属性归类与相克矩阵（纯函数）。
 */
import type { BeastCategory, BeastElement } from '../types.ts';

export interface ElementProfile {
  id: BeastElement;
  label: string;
  shortName: string;
  color: string;
  bg: string;
  strongAgainst: BeastElement[];
  weakTo: BeastElement[];
  ecologyNote: string;
}

export const ELEMENT_TAXONOMY: Record<BeastElement, ElementProfile> = {
  flame: {
    id: 'flame',
    label: '炽焰系',
    shortName: '火',
    color: '#a63429',
    bg: 'rgba(166, 52, 41, 0.14)',
    strongAgainst: ['frost', 'spore'],
    weakTo: ['starlight', 'iron'],
    ecologyNote: '活跃于焦土、火山裂谷与赤沙荒道，火力充沛但惧怕星潮与重甲压制。',
  },
  frost: {
    id: 'frost',
    label: '冰霜系',
    shortName: '冰',
    color: '#2b6e91',
    bg: 'rgba(43, 110, 145, 0.14)',
    strongAgainst: ['spore', 'void'],
    weakTo: ['flame', 'iron'],
    ecologyNote: '生于永冻边塞与寒风冰川，能冻结林孢与虚空侵蚀，却畏惧烈焰与锻铁冲击。',
  },
  spore: {
    id: 'spore',
    label: '草孢系',
    shortName: '草',
    color: '#3b684b',
    bg: 'rgba(59, 104, 75, 0.14)',
    strongAgainst: ['iron', 'starlight'],
    weakTo: ['flame', 'frost'],
    ecologyNote: '繁衍于古老之森、腐雾泥沼与绿洲泉眼，藤蔓与孢雾能缠蚀铁器并遮蔽星辉。',
  },
  iron: {
    id: 'iron',
    label: '钢机系',
    shortName: '钢',
    color: '#6b5340',
    bg: 'rgba(107, 83, 64, 0.15)',
    strongAgainst: ['frost', 'starlight'],
    weakTo: ['flame', 'spore'],
    ecologyNote: '盘踞锈铁荒原、废墟工坊与战壕前线，护甲坚固耐寒，但会被烈火熔蚀与菌孢腐蚀。',
  },
  starlight: {
    id: 'starlight',
    label: '星潮系',
    shortName: '星',
    color: '#9e6b1e',
    bg: 'rgba(184, 115, 36, 0.15)',
    strongAgainst: ['flame', 'void'],
    weakTo: ['spore', 'iron'],
    ecologyNote: '出没于雾海港湾、浮空遗城与星辉水域，幻光能涤荡焰灰与幽冥，偏弱于自然菌毯与重铁。',
  },
  void: {
    id: 'void',
    label: '幽冥系',
    shortName: '幽',
    color: '#5b3f73',
    bg: 'rgba(91, 63, 115, 0.15)',
    strongAgainst: ['starlight', 'void'],
    weakTo: ['frost', 'starlight'],
    ecologyNote: '潜行于旧日废墟与交火暗影，擅精神震慑与空间折叠，同类相残且畏寒冰封锁。',
  },
};

export const ELEMENT_IDS: BeastElement[] = ['flame', 'frost', 'spore', 'iron', 'starlight', 'void'];

export const CATEGORY_LABELS: Record<BeastCategory, string> = {
  beast: '常规奇兽',
  monstergirl: '野生魔物娘',
  demon_army: '魔王军专有',
  domesticated: '聚落驯化亚人',
  elite: '区域精英传奇',
};

export function getElementProfile(element: BeastElement): ElementProfile {
  return ELEMENT_TAXONOMY[element];
}

export function computeTypeEffectiveness(attacker: BeastElement, defender: BeastElement): number {
  const atk = ELEMENT_TAXONOMY[attacker];
  if (atk.strongAgainst.includes(defender)) return 2;
  if (atk.weakTo.includes(defender)) return 0.5;
  return 1;
}
