/**
 * 独立卡库存储：按 hash 分片写入 IndexedDB / 本地 /api/kv。
 * 命名空间完全隔离为 `circus-caravan:cardbox:*`，绝不与其它项目共享键值。
 */
import type { GirlCard, PortraitSpec, StatKey } from '../types.ts';
import { cardHash, parseCardJson } from './cardCodec.ts';
import { CARD_FILE_BYTES_MAX, formatBytes } from './fileLimits.ts';
import { kvDelete, kvGet, kvSet } from './store.ts';

export const CARD_BOX_KEY = 'circus-caravan:cardbox:v1';
export const CARD_BOX_INDEX_KEY = 'circus-caravan:cardbox:v2';
export const CARD_RAW_PREFIX = 'circus-caravan:cardbox:card:';
export const CARD_BOX_LIMIT = 60;
export const CARD_BOX_MAX_BYTES = CARD_FILE_BYTES_MAX;

export interface CardBoxEntry {
  hash: string;
  name: string;
  level: number;
  element: string;
  factionTag: string;
  color: string;
  title: string;
  codename?: string;
  quote: string;
  stats: Record<StatKey, number>;
  skillIds: string[];
  portraitSpec?: PortraitSpec;
  fileName: string;
  addedAt: number;
  bytes: number;
  raw?: string;
}

const DEFAULT_COLOR = '#f4b860';

export function cardBoxByteSize(text: string): number {
  if (typeof TextEncoder === 'undefined') return text.length * 2;
  return new TextEncoder().encode(text).length;
}

export function formatByteSize(bytes: number): string {
  return formatBytes(bytes);
}

function statsOf(raw: unknown): Record<StatKey, number> {
  const source = (raw ?? {}) as Record<string, unknown>;
  const pick = (key: StatKey) => (Number.isFinite(source[key]) ? Math.round(source[key] as number) : 50);
  return { magic: pick('magic'), insight: pick('insight'), agility: pick('agility'), empathy: pick('empathy') };
}

function entryOf(card: GirlCard, fileName: string, raw: string): CardBoxEntry {
  const g = card.girl;
  return {
    hash: cardHash(card),
    name: g.name,
    level: g.level,
    element: g.element,
    factionTag: g.factionTag ?? 'none',
    color: g.color || DEFAULT_COLOR,
    title: g.title || '流浪艺人',
    codename: g.codename,
    quote: g.quote || '风灯亮着，戏就还能开场。',
    stats: { ...g.stats },
    skillIds: [...g.skillIds],
    portraitSpec: g.portraitSpec,
    fileName,
    addedAt: Date.now(),
    bytes: cardBoxByteSize(raw),
  };
}

function metaOf(entry: CardBoxEntry): CardBoxEntry {
  const { raw: _raw, ...meta } = entry;
  return meta as CardBoxEntry;
}

function normalizeCardBox(parsed: unknown): CardBoxEntry[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((row): row is CardBoxEntry => {
    if (!row || typeof row !== 'object') return false;
    const entry = row as Partial<CardBoxEntry>;
    return typeof entry.hash === 'string' && typeof entry.name === 'string';
  }).map(row => {
    const { raw: _raw, ...meta } = row as CardBoxEntry;
    return {
      ...meta,
      level: Number.isFinite(row.level) ? row.level : 1,
      element: typeof row.element === 'string' ? row.element : '星光系',
      factionTag: typeof row.factionTag === 'string' ? row.factionTag : 'none',
      color: typeof row.color === 'string' && row.color ? row.color : DEFAULT_COLOR,
      title: typeof row.title === 'string' && row.title ? row.title : '流浪艺人',
      quote: typeof row.quote === 'string' && row.quote ? row.quote : '风灯亮着，戏就还能开场。',
      stats: statsOf(row.stats),
      skillIds: Array.isArray(row.skillIds) ? row.skillIds.filter((id): id is string => typeof id === 'string').slice(0, 8) : [],
      fileName: typeof row.fileName === 'string' ? row.fileName : `${row.name}.json`,
      addedAt: Number.isFinite(row.addedAt) ? row.addedAt : 0,
      bytes: Number.isFinite(row.bytes) ? row.bytes : 0,
    };
  });
}

export async function loadCardBox(): Promise<CardBoxEntry[]> {
  try {
    const stored = await kvGet<unknown>(CARD_BOX_INDEX_KEY);
    if (Array.isArray(stored)) return normalizeCardBox(stored);
    return [];
  } catch {
    return [];
  }
}

export async function saveCardBox(entries: CardBoxEntry[]): Promise<boolean> {
  try {
    const kept = entries.slice(0, CARD_BOX_LIMIT);
    await kvSet(CARD_BOX_INDEX_KEY, kept.map(metaOf));
    for (const entry of kept) if (entry.raw) await kvSet(CARD_RAW_PREFIX + entry.hash, entry.raw);
    return true;
  } catch {
    return false;
  }
}

export async function readCardRaw(hash: string): Promise<string | undefined> {
  try {
    const raw = await kvGet<unknown>(CARD_RAW_PREFIX + hash);
    return typeof raw === 'string' ? raw : undefined;
  } catch {
    return undefined;
  }
}

export async function cardboxCards(hashes: string[]): Promise<GirlCard[]> {
  const cards: GirlCard[] = [];
  for (const hash of hashes) {
    const raw = await readCardRaw(hash);
    if (!raw) continue;
    const parsed = parseCardJson(raw);
    if (parsed.ok) cards.push(parsed.card);
  }
  return cards;
}

export async function cardboxAdd(
  inputs: { name: string; text: string }[],
  existing: CardBoxEntry[],
): Promise<{
  entries: CardBoxEntry[];
  added: CardBoxEntry[];
  duplicates: string[];
  failed: { name: string; message: string }[];
}> {
  const entries = [...existing];
  const added: CardBoxEntry[] = [];
  const duplicates: string[] = [];
  const failed: { name: string; message: string }[] = [];
  const seen = new Set(entries.map(entry => entry.hash));

  for (const input of inputs) {
    const size = cardBoxByteSize(input.text);
    if (size > CARD_BOX_MAX_BYTES) {
      failed.push({ name: input.name, message: `文件 ${formatByteSize(size)}，超过限制` });
      continue;
    }
    const parsed = parseCardJson(input.text);
    if (!parsed.ok) {
      failed.push({ name: input.name, message: parsed.message });
      continue;
    }
    const hash = cardHash(parsed.card);
    if (seen.has(hash)) {
      duplicates.push(parsed.card.girl.name);
      continue;
    }
    if (entries.length >= CARD_BOX_LIMIT) {
      failed.push({ name: input.name, message: `卡库已满（上限 ${CARD_BOX_LIMIT} 张）` });
      continue;
    }
    seen.add(hash);
    const entry = { ...entryOf(parsed.card, input.name, input.text), raw: input.text };
    entries.push(entry);
    added.push(entry);
  }

  if (added.length && !(await saveCardBox(entries))) {
    const kept = entries.filter(entry => !added.some(row => row.hash === entry.hash));
    await saveCardBox(kept);
    for (const entry of added) await kvDelete(CARD_RAW_PREFIX + entry.hash).catch(() => false);
    for (const entry of added) failed.push({ name: entry.fileName, message: '卡库写入失败，空间不足' });
    return { entries: kept, added: [], duplicates, failed };
  }
  return { entries: entries.map(metaOf), added: added.map(metaOf), duplicates, failed };
}

export async function cardboxRemove(hashes: string[], entries: CardBoxEntry[]): Promise<CardBoxEntry[]> {
  const drop = new Set(hashes);
  const kept = entries.filter(entry => !drop.has(entry.hash));
  await saveCardBox(kept);
  for (const hash of drop) await kvDelete(CARD_RAW_PREFIX + hash).catch(() => false);
  return kept;
}
