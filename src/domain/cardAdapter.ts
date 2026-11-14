/**
 * 角色卡双栖适配器：将通用 GirlCard 转为马戏团演员（Performer）或地图驻地 NPC（WorldNpc），
 * 并支持将团内演员反向打包回 GirlCard。
 */
import { findBeastSpecies } from '../content/species.ts';
import { cardHash } from '../engine/cardCodec.ts';
import type {
  Beast,
  CircusRole,
  CircusState,
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
  options: { day: number; id?: string; role?: CircusRole; hash?: string; preserveHistory?: boolean } = { day: 1 },
): Performer {
  const g = card.girl;
  const role = inferCircusRole(g.stats, options.role ?? g.roleHint);
  const hash = options.hash ?? cardHash(card);
  const level = options.preserveHistory ? g.level : 1;
  const stats = options.preserveHistory
    ? { ...g.stats }
    : {
        magic: Math.min(88, Math.max(45, g.stats.magic)),
        insight: Math.min(88, Math.max(45, g.stats.insight)),
        agility: Math.min(88, Math.max(45, g.stats.agility)),
        empathy: Math.min(88, Math.max(45, g.stats.empathy)),
      };
  const maxHp = Math.round(90 + level * 12 + stats.empathy * 0.4);
  const wardrobe = (g.wardrobe ?? []).map(outfit => ({ ...outfit }));
  return {
    id: options.id ?? `perf-${hash}-${options.day}`,
    cardHash: hash,
    name: g.name,
    codename: g.codename,
    title: g.title,
    role,
    element: g.element,
    stats,
    level,
    exp: 0,
    hp: maxHp,
    maxHp,
    fatigue: 0,
    morale: 72,
    bond: options.preserveHistory ? 45 : 30,
    wagePerDay: 20 + level * 8,
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

export function npcToPerformer(npc: WorldNpc, day: number): Performer {
  const roleMap: Record<NpcOccupation, CircusRole> = {
    mayor: 'bard',
    auctioneer: 'illusionist',
    merchant: 'tamer',
    warlord: 'acrobat',
    passenger: 'clown',
    rival_leader: 'acrobat',
  };
  const role = roleMap[npc.occupation] ?? 'bard';
  const maxHp = 116;
  return {
    id: `perf-npc-${npc.id}-${day}`,
    cardHash: npc.cardHash,
    name: npc.name,
    codename: npc.title,
    title: npc.title,
    role,
    element: '星光系',
    stats: { magic: 62, insight: 68, agility: 66, empathy: 74 },
    level: 1,
    exp: 0,
    hp: maxHp,
    maxHp,
    fatigue: 0,
    morale: 76,
    bond: Math.max(40, Math.min(80, npc.disposition)),
    wagePerDay: 26,
    color: npc.color,
    quote: npc.quote,
    goal: '告别一成不变的驿站，随大篷车去看看远方的净土。',
    appearance: npc.appearance,
    personality: npc.personality,
    outfitDescription: '从驻地收拾出来的轻便旅行斗篷',
    portrait: npc.portrait,
    portraitAsset: npc.portraitAsset,
    portraitSpec: npc.portraitSpec ? { ...npc.portraitSpec } : undefined,
    wardrobe: [],
    outfitId: 'custom',
    expression: npc.expression,
    voice: npc.voice ? { tone: npc.voice.tone, habits: [...npc.voice.habits], samples: [...npc.voice.samples] } : undefined,
    traits: [],
    skillIds: [],
  };
}

export function hasCardInUse(
  state: Pick<CircusState, 'performers' | 'worldNpcs'>,
  cardOrHash: GirlCard | string,
): boolean {
  if (typeof cardOrHash === 'string') {
    return (
      state.performers.some(p => p.cardHash === cardOrHash)
      || state.worldNpcs.some(n => n.cardHash === cardOrHash)
    );
  }
  const h = cardHash(cardOrHash);
  return (
    state.performers.some(
      p => p.cardHash === h || (p.name === cardOrHash.girl.name && p.codename === cardOrHash.girl.codename),
    )
    || state.worldNpcs.some(n => n.cardHash === h || n.name === cardOrHash.girl.name)
  );
}

export function beastToCard(beast: Beast, day = 1): GirlCard {
  const sp = findBeastSpecies(beast.speciesId);
  const elLabel = sp ? `${sp.element}系` : '星光系';
  return {
    format: 'circus-caravan/card',
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceDay: day,
    girl: {
      name: beast.nickname.slice(0, 20),
      codename: (sp?.name ?? beast.speciesId).slice(0, 24),
      title: (sp?.category === 'monstergirl' || sp?.category === 'domesticated' ? '随行亚人同伴' : '契约奇幻伙伴'),
      element: elLabel,
      color: '#c97b36',
      quote: sp?.description ?? '随大篷车穿行废土的忠实同伴。',
      goal: '跟着风灯一起离开战乱，去往安全的新家园。',
      appearance: sp?.description ?? '带着马戏团铜徽的奇幻同伴。',
      personality: '驯顺且富于灵性',
      outfitDescription: '马戏团绒布绶带与巡游铜牌',
      level: Math.max(1, Math.min(20, beast.level)),
      stats: {
        magic: Math.min(200, Math.max(25, 30 + beast.appeal)),
        insight: Math.min(200, Math.max(25, 35 + Math.round(beast.tameness * 0.5))),
        agility: Math.min(200, Math.max(25, 35 + beast.combatPower)),
        empathy: Math.min(200, Math.max(25, 30 + Math.round(beast.tameness * 0.7))),
      },
      skillIds: [],
      traitIds: beast.talents.map(t => t.id),
      traits: beast.talents.map(t => ({
        id: t.id,
        name: t.name.slice(0, 16),
        polarity: 'positive' as const,
        tags: ['兽笼同伴'],
        description: t.effect,
      })),
      roleHint: 'tamer',
    },
  };
}
