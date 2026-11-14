/**
 * 参考宝可梦「性格 (Nature)」与「特性 (Ability)」系统及随机野外捕捉检定引擎（纯函数）。
 */
import { createRng, hashInt } from './worldGen.ts';
import type { BeastCategory, BeastSpecies } from '../types.ts';

export interface CreatureNature {
  id: string;
  name: string;
  appealMult: number;
  powerMult: number;
  catchRateMult: number;
  tamenessGainBonus: number;
  note: string;
}

export interface CreatureAbility {
  id: string;
  name: string;
  catchBonus: number;
  appealBonus: number;
  powerBonus: number;
  description: string;
}

export const CREATURE_NATURES: CreatureNature[] = [
  { id: 'gentle', name: '温顺', appealMult: 1.05, powerMult: 0.90, catchRateMult: 1.28, tamenessGainBonus: 6, note: '亲人易驯（捕获率 +28%，战力 -10%）' },
  { id: 'adamant', name: '固执', appealMult: 0.95, powerMult: 1.15, catchRateMult: 0.82, tamenessGainBonus: -2, note: '桀骜好斗（战力 +15%，较难捕获）' },
  { id: 'jolly', name: '爽朗', appealMult: 1.12, powerMult: 1.00, catchRateMult: 1.05, tamenessGainBonus: 4, note: '天性开朗（观赏度 +12%，较易亲近）' },
  { id: 'timid', name: '胆小', appealMult: 1.00, powerMult: 0.92, catchRateMult: 0.78, tamenessGainBonus: 0, note: '极易受惊逃窜（捕获率 -22%）' },
  { id: 'brave', name: '勇敢', appealMult: 1.04, powerMult: 1.14, catchRateMult: 0.92, tamenessGainBonus: 2, note: '无畏前冲（战力 +14%）' },
  { id: 'modest', name: '内敛', appealMult: 1.15, powerMult: 0.90, catchRateMult: 1.06, tamenessGainBonus: 2, note: '气质沉静华美（观赏度 +15%）' },
  { id: 'impish', name: '淘气', appealMult: 1.08, powerMult: 1.04, catchRateMult: 0.95, tamenessGainBonus: 1, note: '鬼灵精怪（观赏与战力兼优）' },
  { id: 'calm', name: '温和', appealMult: 1.06, powerMult: 0.95, catchRateMult: 1.16, tamenessGainBonus: 5, note: '安分守礼（捕获率 +16%）' },
  { id: 'relaxed', name: '悠闲', appealMult: 1.02, powerMult: 0.96, catchRateMult: 1.18, tamenessGainBonus: 4, note: '反应慢半拍（极易套网）' },
  { id: 'hasty', name: '急躁', appealMult: 1.05, powerMult: 1.06, catchRateMult: 0.84, tamenessGainBonus: -1, note: '性子急躁易挣脱网兜' },
  { id: 'lonely', name: '怕寂寞', appealMult: 1.04, powerMult: 1.08, catchRateMult: 1.12, tamenessGainBonus: 5, note: '渴望陪伴（战力 +8%，捕获率 +12%）' },
  { id: 'serious', name: '认真', appealMult: 1.02, powerMult: 1.02, catchRateMult: 1.00, tamenessGainBonus: 2, note: '均衡稳健无明显偏科' },
];

export const CREATURE_ABILITIES: CreatureAbility[] = [
  { id: 'oblivious', name: '乐天迟钝', catchBonus: 0.16, appealBonus: 3, powerBonus: 0, description: '对危险后知后觉，捕获概率大幅提升 +16%' },
  { id: 'run_away', name: '逃跑本能', catchBonus: -0.16, appealBonus: 0, powerBonus: 0, description: '遇到捕网极易滑溜脱身（捕获概率 -16%）' },
  { id: 'intimidate', name: '威吓气场', catchBonus: -0.10, appealBonus: 2, powerBonus: 10, description: '气势凌人震慑盗匪（战力 +10，捕获略难）' },
  { id: 'cute_charm', name: '迷人之躯', catchBonus: 0.04, appealBonus: 11, powerBonus: 0, description: '舞台聚光焦点，观赏魅力额外 +11' },
  { id: 'steadfast', name: '不屈之心', catchBonus: -0.06, appealBonus: 2, powerBonus: 8, description: '越挫越勇护航可靠（战力 +8）' },
  { id: 'keen_eye', name: '锐利目光', catchBonus: 0.02, appealBonus: 5, powerBonus: 4, description: '夜间警戒敏锐（观赏 +5 / 战力 +4）' },
  { id: 'pickup', name: '拾荒奇缘', catchBonus: 0.08, appealBonus: 4, powerBonus: 0, description: '爱捡闪亮小物件，易被彩粉诱饵吸引' },
  { id: 'adaptability', name: '适应力', catchBonus: 0.05, appealBonus: 6, powerBonus: 6, description: '无论荒漠极寒皆能自如登台' },
  { id: 'aroma_veil', name: '芳香帷幕', catchBonus: 0.10, appealBonus: 8, powerBonus: 0, description: '散播安神芬芳，易被善意抚慰收服' },
  { id: 'sturdy', name: '结实硬甲', catchBonus: -0.04, appealBonus: 0, powerBonus: 9, description: '身板硬朗抗冲击（战力 +9）' },
  { id: 'static', name: '静电火花', catchBonus: 0.04, appealBonus: 7, powerBonus: 5, description: '偶尔迸出炫目微光引爆观众掌声' },
  { id: 'tangled_feet', name: '蹒跚舞步', catchBonus: 0.12, appealBonus: 6, powerBonus: 0, description: '滑稽踉跄反倒极易绊进捕获网' },
];

const NATURE_MAP = new Map(CREATURE_NATURES.map(n => [n.id, n]));
const ABILITY_MAP = new Map(CREATURE_ABILITIES.map(a => [a.id, a]));

export function findCreatureNature(id?: string): CreatureNature {
  return (id && NATURE_MAP.get(id)) || CREATURE_NATURES[0]!;
}

export function findCreatureAbility(id?: string): CreatureAbility {
  return (id && ABILITY_MAP.get(id)) || CREATURE_ABILITIES[0]!;
}

function categoryAbilityPool(cat?: BeastCategory): CreatureAbility[] {
  if (cat === 'elite') {
    return CREATURE_ABILITIES.filter(a => ['intimidate', 'steadfast', 'adaptability', 'keen_eye', 'cute_charm'].includes(a.id));
  }
  if (cat === 'monstergirl' || cat === 'demon_army' || cat === 'domesticated') {
    return CREATURE_ABILITIES.filter(a => a.id !== 'sturdy');
  }
  return CREATURE_ABILITIES;
}

export function rollNatureAndAbility(seed: number, category?: BeastCategory): {
  nature: CreatureNature;
  ability: CreatureAbility;
} {
  const rng = createRng(hashInt(`nat-ab:${seed}`));
  const nature = CREATURE_NATURES[Math.floor(rng() * CREATURE_NATURES.length)]!;
  const pool = categoryAbilityPool(category);
  const ability = pool[Math.floor(rng() * pool.length)]!;
  return { nature, ability };
}

export function computeCaptureProbability(input: {
  captureDifficulty: number;
  natureId: string;
  abilityId: string;
  hasTamer: boolean;
  useBait?: boolean;
}): number {
  const nature = findCreatureNature(input.natureId);
  const ability = findCreatureAbility(input.abilityId);
  // 难度 10..90 -> 基础成功率 ~0.78..0.16
  const base = Math.max(0.12, Math.min(0.84, 0.92 - input.captureDifficulty * 0.0085));
  const tamerMult = input.hasTamer ? 1.24 : 1.0;
  const baitMult = input.useBait ? 1.32 : 1.0;
  const raw = base * nature.catchRateMult * tamerMult * baitMult + ability.catchBonus;
  return Number(Math.max(0.06, Math.min(0.95, raw)).toFixed(3));
}

export function attemptCaptureRoll(
  species: BeastSpecies,
  options: { hasTamer: boolean; useBait?: boolean; rollSeed: number },
): {
  captured: boolean;
  probability: number;
  shakes: 1 | 2 | 3;
  nature: CreatureNature;
  ability: CreatureAbility;
  appeal: number;
  combatPower: number;
} {
  const { nature, ability } = rollNatureAndAbility(options.rollSeed * 97 + species.name.length, species.category);
  const probability = computeCaptureProbability({
    captureDifficulty: species.captureDifficulty,
    natureId: nature.id,
    abilityId: ability.id,
    hasTamer: options.hasTamer,
    useBait: options.useBait,
  });
  const rng = createRng(hashInt(`capture-roll:${species.id}:${options.rollSeed}`));
  const roll = rng();
  const captured = roll <= probability;
  const shakes: 1 | 2 | 3 = captured ? 3 : roll <= probability + 0.18 ? 2 : 1;
  const ivSpread = 0.92 + rng() * 0.18;
  const appeal = Math.max(12, Math.round(species.baseAppeal * nature.appealMult * ivSpread + ability.appealBonus));
  const combatPower = Math.max(8, Math.round(species.baseCombatPower * nature.powerMult * ivSpread + ability.powerBonus));

  return { captured, probability, shakes, nature, ability, appeal, combatPower };
}
