import type { CircusState, GameLog } from '../types.ts';

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function pushLog(state: CircusState, kind: GameLog['kind'], text: string): void {
  const id = `log-${state.day}-${state.logs.length + 1}`;
  state.logs.unshift({ id, day: state.day, kind, text });
  if (state.logs.length > 150) state.logs.length = 150;
}
