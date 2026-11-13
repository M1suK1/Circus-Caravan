/**
 * 大篷车容量、消耗与隐居条件纯计算函数。
 */
import { findBeastSpecies } from '../content/species.ts';
import type { CircusState, Wagon, WagonKind } from '../types.ts';

export const WAGON_LABELS: Record<WagonKind, string> = {
  stage: '篷布舞台车',
  cage: '奇幻兽笼车',
  cargo: '重型货厢车',
  passenger: '风灯客车厢',
  workshop: '工坊医疗车',
};

export function computeCaravanCapacity(wagons: readonly Wagon[]): {
  maxWeight: number;
  maxSeats: number;
  maxCageSlots: number;
} {
  let maxWeight = 60;
  let maxSeats = 3;
  let maxCageSlots = 1;
  for (const wagon of wagons) {
    if (wagon.kind === 'cargo') maxWeight += 60 + wagon.level * 40;
    if (wagon.kind === 'passenger') maxSeats += 2 + wagon.level * 2;
    if (wagon.kind === 'cage') maxCageSlots += 1 + wagon.level * 2;
    if (wagon.kind === 'workshop') maxWeight += wagon.level * 15;
  }
  return { maxWeight, maxSeats, maxCageSlots };
}

export function beastCageCost(speciesId: string): number {
  return findBeastSpecies(speciesId)?.cageCost ?? 1;
}

export function usedCageSlots(state: Pick<CircusState, 'beasts'>): number {
  return state.beasts.reduce((sum, beast) => sum + beastCageCost(beast.speciesId), 0);
}

export function usedSeats(state: Pick<CircusState, 'performers' | 'passengerOrders'>): number {
  const crewSeats = state.performers.length;
  const passengerSeats = state.passengerOrders
    .filter(order => order.status === 'aboard')
    .reduce((sum, order) => sum + order.seatsNeeded, 0);
  return crewSeats + passengerSeats;
}

export function usedWeight(state: Pick<CircusState, 'freightOrders'>): number {
  return state.freightOrders
    .filter(order => order.status === 'carrying')
    .reduce((sum, order) => sum + order.weight, 0);
}

export function dailyUpkeep(state: Pick<CircusState, 'performers' | 'passengerOrders' | 'beasts'>): {
  rations: number;
  fodder: number;
  wages: number;
} {
  const passengers = state.passengerOrders
    .filter(order => order.status === 'aboard')
    .reduce((sum, order) => sum + order.seatsNeeded, 0);
  const rations = state.performers.length + passengers;
  const fodder = state.beasts.reduce((sum, beast) => sum + beastCageCost(beast.speciesId), 0);
  const wages = state.performers.reduce((sum, performer) => sum + performer.wagePerDay, 0);
  return { rations, fodder, wages };
}

export function wagonUpgradeCost(wagon: Wagon): number {
  return 450 * wagon.level + 250;
}

export function wagonRepairCost(wagon: Wagon): number {
  const missing = Math.max(0, wagon.maxDurability - wagon.durability);
  return Math.max(40, Math.round(missing * 5));
}

export function canRetire(state: CircusState): boolean {
  if (state.phase === 'retired') return false;
  if (state.gold < state.retirement.targetGold) return false;
  const region = state.world.regions[state.world.currentRegionId];
  if (!region || region.dangerTier >= 5) return false;
  return state.caravan.morale >= 10;
}
