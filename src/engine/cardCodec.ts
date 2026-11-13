/**
 * 通用角色卡编解码器（零领域硬编码）。
 *
 * 兼容导入：
 *  - `night-sugar/girl-card` v1（直接沿用玩家已有角色卡库与契约卡）
 *  - `circus-caravan/card` v1（大篷车导出卡）
 */
import type { Expression, GirlCard, Outfit, StatKey, Trait, TraitPolarity } from '../types.ts';
import { EXPRESSIONS, sanitizeExpressionVariants } from './expressions.ts';
import { safeOptimizedImageDataUrl, yieldToGC } from './image.ts';
import { sanitizeVoice } from './voice.ts';

const STAT_KEYS: StatKey[] = ['magic', 'insight', 'agility', 'empathy'];
const POLARITIES: TraitPolarity[] = ['positive', 'neutral', 'negative'];
const CARD_IMAGE_LIMIT = 2_800_000;

function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function cardHash(card: GirlCard): string {
  const g = card.girl;
  const variants = Object.entries(g.importedVariants ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${hash(value)}`)
    .join('|');
  return hash([
    g.name,
    g.codename,
    g.level,
    g.skillIds.join('|'),
    g.traitIds.join('|'),
    g.portrait?.length ?? 0,
    variants,
    g.factionTag ?? '',
    g.roleHint ?? '',
  ].join(':'));
}

export function cardPortrait(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.startsWith('/art/') && value.length < 200) return value;
  if (/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(value) && value.length <= CARD_IMAGE_LIMIT) return value;
  return undefined;
}

function fallbackPortrait(variants: Record<string, string>): string | undefined {
  return variants['custom:calm']
    ?? Object.entries(variants).find(([key]) => key.endsWith(':calm'))?.[1]
    ?? Object.values(variants)[0];
}

function dedupeCalmPortrait(variants: Record<string, string>, portrait: string | undefined): Record<string, string> {
  if (!portrait) return variants;
  const next = { ...variants };
  for (const key of Object.keys(next)) {
    if (key.endsWith(':calm') && next[key] === portrait) delete next[key];
  }
  return next;
}

export function resolveCardTraits(rawIds: unknown, rawDefs: unknown): Trait[] {
  const byId = new Map<string, Trait>();
  if (Array.isArray(rawDefs)) {
    for (const item of rawDefs) {
      if (!item || typeof item !== 'object') continue;
      const def = item as Record<string, unknown>;
      const id = typeof def.id === 'string' ? def.id.trim() : '';
      const name = typeof def.name === 'string' ? def.name.trim().slice(0, 16) : '';
      if (!id || !name || id.length > 64) continue;
      const tags = Array.isArray(def.tags)
        ? def.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0).slice(0, 4).map(tag => tag.trim().slice(0, 12))
        : [];
      byId.set(id, {
        id,
        name,
        polarity: POLARITIES.includes(def.polarity as TraitPolarity) ? def.polarity as TraitPolarity : 'neutral',
        tags: tags.length ? tags : ['自定义'],
        description: typeof def.description === 'string' && def.description.trim() ? def.description.trim().slice(0, 120) : '随角色卡带入的特性。',
      });
    }
  }
  const wanted = Array.isArray(rawIds) ? rawIds.filter((id): id is string => typeof id === 'string' && id.length <= 64) : [];
  const traits: Trait[] = [];
  const seen = new Set<string>();
  for (const id of wanted) {
    if (seen.has(id)) continue;
    const trait = byId.get(id) ?? {
      id,
      name: id.slice(0, 16),
      polarity: 'neutral' as const,
      tags: ['来历'],
      description: '从旧卡继承的特征印记。',
    };
    seen.add(id);
    traits.push(trait);
    if (traits.length >= 6) break;
  }
  return traits;
}

export function parseCardJson(raw: string): { ok: true; card: GirlCard } | { ok: false; message: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, message: '这不是有效的 JSON 文件。' }; }
  if (!parsed || typeof parsed !== 'object') return { ok: false, message: '卡片内容为空。' };
  const card = parsed as Partial<GirlCard>;
  if ((card.format !== 'night-sugar/girl-card' && card.format !== 'circus-caravan/card') || card.version !== 1) {
    return { ok: false, message: '不支持的角色卡格式或版本。' };
  }
  const g = card.girl;
  if (!g || typeof g !== 'object') return { ok: false, message: '卡片缺少角色资料。' };
  const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
  if (!text(g.name, 20) || !text(g.codename, 24) || !text(g.title, 48)) {
    return { ok: false, message: '名字、称号或代号不完整。' };
  }
  if (typeof g.element !== 'string' || typeof g.color !== 'string') {
    return { ok: false, message: '元素或代表色缺失。' };
  }
  if (!Number.isInteger(g.level) || g.level < 1 || g.level > 20) {
    return { ok: false, message: '等级必须在 1–20 之间。' };
  }
  if (!g.stats || typeof g.stats !== 'object') return { ok: false, message: '能力值缺失。' };
  for (const key of STAT_KEYS) {
    const value = (g.stats as Record<string, unknown>)[key];
    if (!Number.isFinite(value) || (value as number) < 10 || (value as number) > 200) {
      return { ok: false, message: `能力值 ${key} 超出 10–200。` };
    }
  }
  const skillIds = Array.isArray(g.skillIds)
    ? g.skillIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).slice(0, 6)
    : [];
  const traits = resolveCardTraits(g.traitIds, (g as Record<string, unknown>).traits);
  const importedVariants = sanitizeExpressionVariants(g.importedVariants);
  const mainPortrait = cardPortrait(g.portrait);
  const portrait = mainPortrait ?? fallbackPortrait(importedVariants);
  const variants = dedupeCalmPortrait(importedVariants, portrait);
  const wardrobe: Outfit[] | undefined = Array.isArray(g.wardrobe)
    ? g.wardrobe
      .filter(outfit => outfit && typeof outfit.id === 'string' && typeof outfit.name === 'string')
      .slice(0, 4)
      .map(outfit => ({ ...outfit, portrait: cardPortrait(outfit.portrait) }))
    : undefined;

  const normalized: GirlCard = {
    format: card.format,
    version: 1,
    exportedAt: typeof card.exportedAt === 'string' ? card.exportedAt : new Date().toISOString(),
    sourceDay: typeof card.sourceDay === 'number' ? card.sourceDay : 1,
    packHash: typeof card.packHash === 'string' ? card.packHash : undefined,
    girl: {
      name: g.name!.trim(),
      codename: g.codename!.trim(),
      title: g.title!.trim(),
      element: g.element,
      archetype: g.archetype,
      color: g.color,
      quote: typeof g.quote === 'string' ? g.quote.slice(0, 200) : undefined,
      goal: typeof g.goal === 'string' ? g.goal.slice(0, 160) : '在废土尽头找到能安稳过冬的地方。',
      appearance: typeof g.appearance === 'string' ? g.appearance.slice(0, 300) : '风尘仆仆的旅人模样。',
      personality: typeof g.personality === 'string' ? g.personality.slice(0, 240) : '沉稳。',
      outfitDescription: typeof g.outfitDescription === 'string' ? g.outfitDescription.slice(0, 300) : '旅途披风与演出便服。',
      voice: sanitizeVoice(g.voice),
      level: g.level,
      stats: Object.fromEntries(STAT_KEYS.map(key => [key, Math.round((g.stats as Record<string, number>)[key])])) as Record<StatKey, number>,
      skillIds,
      traitIds: traits.map(trait => trait.id),
      traits,
      portrait,
      portraitSpec: mainPortrait ? g.portraitSpec : undefined,
      wardrobe,
      outfitId: typeof g.outfitId === 'string' ? g.outfitId : (wardrobe?.[0]?.id ?? 'custom'),
      expression: EXPRESSIONS.includes(g.expression as Expression) ? g.expression : 'calm',
      importedVariants: Object.keys(variants).length ? variants : undefined,
      factionTag: typeof g.factionTag === 'string' ? g.factionTag : undefined,
      roleHint: g.roleHint,
    },
  };
  return { ok: true, card: normalized };
}

export async function optimizeCardImages(card: GirlCard): Promise<GirlCard> {
  if (typeof document === 'undefined') return card;
  const g = card.girl;
  let changed = false;

  let portrait = g.portrait;
  if (portrait && portrait.startsWith('data:image/') && portrait.length > 250_000) {
    portrait = await safeOptimizedImageDataUrl(portrait);
    changed = true;
    await yieldToGC(8);
  }

  let wardrobe = g.wardrobe;
  if (wardrobe && wardrobe.length > 0) {
    const nextWardrobe: Outfit[] = [];
    let wChanged = false;
    for (const outfit of wardrobe) {
      if (outfit.portrait && outfit.portrait.startsWith('data:image/') && outfit.portrait.length > 250_000) {
        const opt = await safeOptimizedImageDataUrl(outfit.portrait);
        nextWardrobe.push({ ...outfit, portrait: opt });
        wChanged = true;
        await yieldToGC(8);
      } else {
        nextWardrobe.push(outfit);
      }
    }
    if (wChanged) { wardrobe = nextWardrobe; changed = true; }
  }

  let importedVariants = g.importedVariants;
  if (importedVariants && Object.keys(importedVariants).length > 0) {
    const nextVariants: Record<string, string> = {};
    let vChanged = false;
    for (const [key, val] of Object.entries(importedVariants)) {
      if (typeof val === 'string' && val.startsWith('data:image/') && val.length > 250_000) {
        nextVariants[key] = await safeOptimizedImageDataUrl(val);
        vChanged = true;
        await yieldToGC(8);
      } else {
        nextVariants[key] = val;
      }
    }
    if (vChanged) { importedVariants = nextVariants; changed = true; }
  }

  if (!changed) return card;
  return { ...card, girl: { ...g, portrait, wardrobe, importedVariants } };
}
