import { REGION_IDS } from '../content/regions.ts';
import { computeCaravanCapacity } from '../domain/caravanMath.ts';
import type { CircusState } from '../types.ts';
import { createInitialState } from './state.ts';

export const SAVE_CURRENT_KEY = 'circus-caravan/save/current';
export const SAVE_SLOT_PREFIX = 'circus-caravan/save/slot/';

export function serializeState(state: CircusState): string {
  return JSON.stringify(state);
}

export function normalizeState(raw: string | null): CircusState | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Partial<CircusState>;
  if (candidate.version !== 1 || !candidate.caravan || !candidate.world || !Array.isArray(candidate.performers)) {
    return null;
  }
  if (!REGION_IDS.includes(candidate.world.currentRegionId)) return null;
  const currentRegion = candidate.world.regions?.[candidate.world.currentRegionId];
  if (!currentRegion?.map) return null;

  const cap = computeCaravanCapacity(candidate.caravan.wagons ?? []);
  candidate.caravan.maxWeight = cap.maxWeight;
  candidate.caravan.maxSeats = cap.maxSeats;
  candidate.caravan.maxCageSlots = cap.maxCageSlots;
  candidate.worldNpcs ??= [];
  candidate.beasts ??= [];
  candidate.freightOrders ??= [];
  candidate.passengerOrders ??= [];
  candidate.recentShows ??= [];
  candidate.rumors ??= [];
  candidate.logs ??= [];
  return candidate as CircusState;
}

export function loadState(raw: string | null): CircusState {
  return normalizeState(raw) ?? createInitialState();
}
