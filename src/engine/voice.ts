import type { GirlVoice } from '../types.ts';

export const VOICE_TONE_MAX = 120;
export const VOICE_HABIT_MAX = 120;
export const VOICE_SAMPLE_MAX = 120;
export const VOICE_HABITS_LIMIT = 3;
export const VOICE_SAMPLES_LIMIT = 3;
export const VOICE_LINE_MAX = 900;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function cleanList(value: unknown, perItem: number, limit: number): string[] {
  const raw = typeof value === 'string'
    ? value.split(/\r?\n|"。?"|","|；|;/).filter(Boolean)
    : value;
  const list: unknown[] = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const text = clean(typeof item === 'string' ? item.replace(/^["']+|["']+$/g, '') : item).slice(0, perItem);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

export function sanitizeVoice(raw: unknown): GirlVoice | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, unknown>;
  const tone = clean(input.tone).slice(0, VOICE_TONE_MAX);
  const habits = cleanList(input.habits, VOICE_HABIT_MAX, VOICE_HABITS_LIMIT);
  const samples = cleanList(input.samples, VOICE_SAMPLE_MAX, VOICE_SAMPLES_LIMIT);
  if (!tone && !habits.length && !samples.length) return undefined;
  return { tone, habits, samples };
}

export function voiceLine(subject: { voice?: GirlVoice }): string {
  const voice = subject.voice;
  if (!voice) return '';
  const parts: string[] = [];
  if (voice.tone) parts.push(`说话方式：${voice.tone}`);
  if (voice.habits?.length) parts.push(`口头习惯：${voice.habits.join('、')}`);
  if (voice.samples?.length) parts.push(`例话：${voice.samples.map(sample => `「${sample}」`).join('')}`);
  const line = parts.join('；');
  return line ? line.slice(0, VOICE_LINE_MAX) : '';
}
