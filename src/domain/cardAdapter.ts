/**
 * 角色卡双栖适配器：将通用 GirlCard 转为马戏团演员（Performer）或地图驻地 NPC（WorldNpc），
 * 并支持将团内演员反向打包回 GirlCard。
 */
import { cardHash } from '../engine/cardCodec.ts';
import type {
  CircusRole,
  FactionId,
  GirlCard,
  NpcOccupation,
  Performer,
  RegionId,
  StatKey,
  WorldNpc,
} from '../types.ts';

export const CIRCUS_ROLE_LABELS: Record<CircusRole, string> = {
  acrobat: '空中杂技师',
  tamer: '奇兽驯养师',
  illusionist: '光影幻术师',
  clown: '荒诞丑角',
  bard: '篝火吟游者',
  scout: '迷雾斥候',
};

export function inferCircusRole(stats: Record<StatKey, number>, hint?: CircusRole): CircusRole {
  if (hint) return hint;
  const pairs: { role: CircusRole; score: number }[] = [
    { role: 'illusionist', score: stats.magic * 1.15 },
    { role: 'scout', score: (stats.insight + stats.agility) * 0.58 },
    { role: 'acrobat', score: stats.agility * 1.1 },
    { role: 'tamer', score: (stats.empathy + stats.insight) * 0.56 },
    { role: 'bard', score: (stats.empathy + stats.magic) * 0.55 },
    { role: 'clown', score: stats.empathy * 1.05 },
  ];
  pairs.sort((a, b) => b.score - a.score);
  return pairs[0]!.role;
}

export function cardToPerformer(
  card: GirlCard,
  options: { day: number; id?: string; role?: CircusRole; hash?: string } = { day: 1 },
): Performer {
  const g = card.girl;
  const role = inferCircusRole(g.stats, options.role ?? g.roleHint);
  const hash = options.hash ?? cardHash(card);
  const maxHp = Math.round(90 + g.level * 12 + g.stats.empathy * 0.4);
  const wardrobe = (g.wardrobe ?? []).map(outfit => ({ ...outfit }));
  return {
    id: options.id ?? `perf-${hash}-${options.day}`,
    cardHash: hash,
    name: g.name,
    codename: g.codename,
    title: g.title,
    role,
    element: g.element,
    stats: { ...g.stats },
    level: g.level,
    exp: 0,
    hp: maxHp,
    maxHp,
    fatigue: 0,
    morale: 72,
    bond: 35,
    wagePerDay: 20 + g.level * 8,
    color: g.color,
    quote: g.quote,
    goal: g.goal,
    appearance: g.appearance,
    personality: g.personality,
    outfitDescription: g.outfitDescription,
    portrait: g.portrait ?? '',
    portraitSpec: g.portraitSpec ? { ...g.portraitSpec } : undefined,
    wardrobe,
    outfitId: g.outfitId ?? wardrobe[0]?.id ?? 'custom',
    expression: g.expression ?? 'calm',
    importedVariants: g.importedVariants ? { ...g.importedVariants } : undefined,
    voice: g.voice ? { tone: g.voice.tone, habits: [...g.voice.habits], samples: [...g.voice.samples] } : undefined,
    traits: (g.traits ?? []).map(trait => ({ ...trait, tags: [...trait.tags] })),
    skillIds: [...g.skillIds],
  };
}

export function cardToWorldNpc(
  card: GirlCard,
  options: {
    regionId: RegionId;
    poiId?: string;
    occupation?: NpcOccupation;
    faction?: FactionId | 'neutral';
    id?: string;
    hash?: string;
  },
): WorldNpc {
  const g = card.girl;
  const hash = options.hash ?? cardHash(card);
  return {
    id: options.id ?? `npc-${hash}-${options.regionId}`,
    cardHash: hash,
    name: g.name,
    title: g.title,
    occupation: options.occupation ?? 'merchant',
    faction: options.faction ?? 'neutral',
    regionId: options.regionId,
    poiId: options.poiId,
    color: g.color,
    quote: g.quote,
    appearance: g.appearance,
    personality: g.personality,
    portrait: g.portrait ?? '',
    portraitSpec: g.portraitSpec ? { ...g.portraitSpec } : undefined,
    expression: g.expression ?? 'calm',
    voice: g.voice ? { tone: g.voice.tone, habits: [...g.voice.habits], samples: [...g.voice.samples] } : undefined,
    disposition: 45,
  };
}

export function performerToCard(performer: Performer, options: { day?: number } = {}): GirlCard {
  return {
    format: 'circus-caravan/card',
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceDay: options.day ?? 1,
    girl: {
      name: performer.name,
      codename: performer.codename,
      title: performer.title,
      element: performer.element,
      color: performer.color,
      quote: performer.quote,
      goal: performer.goal,
      appearance: performer.appearance,
      personality: performer.personality,
      outfitDescription: performer.outfitDescription,
      level: performer.level,
      stats: { ...performer.stats },
      skillIds: [...performer.skillIds],
      traitIds: performer.traits.map(trait => trait.id),
      traits: performer.traits.map(trait => ({ ...trait, tags: [...trait.tags] })),
      voice: performer.voice
        ? { tone: performer.voice.tone, habits: [...performer.voice.habits], samples: [...performer.voice.samples] }
        : undefined,
      portrait: performer.portrait || undefined,
      portraitSpec: performer.portraitSpec ? { ...performer.portraitSpec } : undefined,
      wardrobe: performer.wardrobe.map(outfit => ({ ...outfit })),
      outfitId: performer.outfitId,
      expression: performer.expression,
      importedVariants: performer.importedVariants ? { ...performer.importedVariants } : undefined,
      roleHint: performer.role,
    },
  };
}
