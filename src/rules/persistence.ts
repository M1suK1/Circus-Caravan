import { REGION_IDS } from '../content/regions.ts';
import { computeCaravanCapacity } from '../domain/caravanMath.ts';
import { seedStarterEncounters } from '../domain/encounters.ts';
import { computeWorldNeighbors } from '../domain/worldGen.ts';
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
  if (candidate.version !== 2 || !candidate.caravan || !candidate.world?.worldMap || !Array.isArray(candidate.performers)) {
    return null;
  }
  if (!REGION_IDS.includes(candidate.world.currentRegionId)) return null;
  const currentRegion = candidate.world.regions?.[candidate.world.currentRegionId];
  if (!currentRegion?.map) return null;

  const liveNeighbors = computeWorldNeighbors(candidate.world.worldMap);
  for (const rId of REGION_IDS) {
    if (candidate.world.regions?.[rId]) {
      candidate.world.regions[rId].neighbors = liveNeighbors[rId].map(n => ({ ...n }));
    }
  }
  if (candidate.world.currentPoiId && Number.isInteger(candidate.world.pos.x) && Number.isInteger(candidate.world.pos.y)) {
    candidate.world.pos = { x: candidate.world.pos.x + 0.5, y: candidate.world.pos.y + 0.5 };
  }
  const cap = computeCaravanCapacity(candidate.caravan.wagons ?? []);
  candidate.caravan.maxWeight = cap.maxWeight;
  candidate.caravan.maxSeats = cap.maxSeats;
  candidate.caravan.maxCageSlots = cap.maxCageSlots;
  candidate.worldNpcs ??= [];
  candidate.beasts ??= [];
  for (const beast of candidate.beasts) {
    beast.natureId ??= 'jolly';
    beast.abilityId ??= 'cute_charm';
  }
  candidate.encounteredSpeciesIds ??= seedStarterEncounters(candidate.world.currentRegionId);
  candidate.freightOrders ??= [];
  candidate.passengerOrders ??= [];
  candidate.recentShows ??= [];
  candidate.rumors ??= [];
  candidate.lastLedger ??= undefined;
  candidate.world.travelCarry ??= { days: 0, fuel: 0, rations: 0, wear: 0, rationsPaidToday: 0 };
  candidate.logs ??= [];
  return candidate as CircusState;
}

export function loadState(raw: string | null): CircusState {
  return normalizeState(raw) ?? createInitialState();
}
