/**
 * 时间流转与日历工具（纯函数）。
 */
import type { TimeSlot } from '../types.ts';

export const TIME_SLOT_ORDER: readonly TimeSlot[] = ['dawn', 'noon', 'dusk', 'night'] as const;

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  dawn: '拂晓',
  noon: '正午',
  dusk: '暮色',
  night: '夜演',
};

export const TIME_SLOT_HINTS: Record<TimeSlot, string> = {
  dawn: '晨雾散开，适合启程赶路与商铺补货',
  noon: '日照正盛，商路客流最旺',
  dusk: '暮色沉降，野外荒兽开始出没',
  night: '风灯亮起，城镇夜演票房达到顶峰',
};

export function nextTimeSlot(slot: TimeSlot): TimeSlot {
  const idx = TIME_SLOT_ORDER.indexOf(slot);
  if (idx < 0 || idx === TIME_SLOT_ORDER.length - 1) return 'dawn';
  return TIME_SLOT_ORDER[idx + 1]!;
}

export function isDayRollover(currentSlot: TimeSlot): boolean {
  return currentSlot === 'night';
}

export function timeSlotProgress(slot: TimeSlot): number {
  const idx = TIME_SLOT_ORDER.indexOf(slot);
  return Math.max(1, idx + 1) / TIME_SLOT_ORDER.length;
}

export function describeClock(day: number, slot: TimeSlot): string {
  return `第 ${String(Math.max(1, day)).padStart(3, '0')} 日 · ${TIME_SLOT_LABELS[slot]}`;
}
