import type { VnBackdrop } from './types.ts';

export interface ResolvedBackdrop {
  gradient: string;
  image: string;
}

const PALETTE: Record<string, [string, string, string]> = {
  camp_fire: ['#382214', '#1d1314', '#0b080d'],
  tent_stage: ['#421f29', '#20131e', '#0c0911'],
  wasteland_road: ['#2a231c', '#181414', '#0b090c'],
  haven_square: ['#31241c', '#1c1518', '#0c090f'],
  war_ruin: ['#38161a', '#1d1014', '#0a0709'],
  sanctuary_valley: ['#203229', '#131d1b', '#090e0e'],
  night: ['#1a1522', '#110d17', '#08060c'],
};

export const BACKDROP_LABELS: Record<string, string> = {
  camp_fire: '大篷车篝火营地',
  tent_stage: '篷布巡演主舞台',
  wasteland_road: '末世荒野泥路',
  haven_square: '避难镇集市广场',
  war_ruin: '战火余烬废墟',
  sanctuary_valley: '世外净土山谷',
};

export const BACKDROP_IDS: readonly string[] = Object.keys(BACKDROP_LABELS);

export function isBackdropId(value: unknown): value is string {
  return typeof value === 'string' && BACKDROP_IDS.includes(value);
}

export function backdropChoicesText(): string {
  return BACKDROP_IDS.map(id => `${id}（${BACKDROP_LABELS[id]}）`).join('、');
}

export function resolveBackdrop(id: string, tint?: string): ResolvedBackdrop {
  const [first, second, third] = PALETTE[id] ?? PALETTE.night!;
  const glow = tint ?? first;
  return {
    gradient: `radial-gradient(120% 90% at 50% 14%, ${glow}dd 0%, ${second}f0 46%, ${third} 100%)`,
    image: '',
  };
}

export function backdropFromPreset(id: string): VnBackdrop {
  return { id: isBackdropId(id) ? id : 'camp_fire' };
}
