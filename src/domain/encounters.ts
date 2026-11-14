/**
 * 九大地区与微观地形奇幻生物/魔物娘遭遇概率分配与行军遭遇演算（纯函数）。
 */
import { BEAST_SPECIES } from '../content/species.ts';
import { createRng, hashInt, TERRAIN_ORDER } from './worldGen.ts';
import { regionTerrainArray } from './regionGen.ts';
import type { BeastCategory, BeastSpecies, RegionId, RegionMap, TerrainType, TimeSlot } from '../types.ts';

export interface EncounterEntry {
  speciesId: string;
  name: string;
  category: BeastCategory;
  element: BeastSpecies['element'];
  cageCost: 1 | 2;
  probabilityPct: number;
  passiveEffect?: string;
  description: string;
}

const BASE_CHANCE_PCT: Record<TerrainType, number> = {
  outside: 0,
  ocean: 0,
  mountain: 26,
  lake: 20,
  river: 20,
  coast: 25,
  bridge: 14,
  border_gate: 18,
  road: 12,
  village: 18,
  city: 18,
  wasteland: 22,
  forest: 32,
  swamp: 32,
  ruin: 34,
  warzone: 38,
};

export function getTerrainBaseEncounterChance(terrain: TerrainType): number {
  return BASE_CHANCE_PCT[terrain] ?? 0;
}

function habitatMatches(speciesHabitats: TerrainType[] | undefined, terrain: TerrainType): boolean {
  if (!speciesHabitats?.length) return false;
  if (speciesHabitats.includes(terrain)) return true;
  if (terrain === 'river' || terrain === 'lake') {
    return speciesHabitats.includes('river') || speciesHabitats.includes('lake') || speciesHabitats.includes('coast');
  }
  if (terrain === 'coast') return speciesHabitats.includes('lake') || speciesHabitats.includes('river');
  if (terrain === 'bridge') return speciesHabitats.includes('road') || speciesHabitats.includes('river');
  if (terrain === 'border_gate') return speciesHabitats.includes('road') || speciesHabitats.includes('wasteland');
  return false;
}

function rawEncounterWeight(species: BeastSpecies, terrain: TerrainType, timeSlot: TimeSlot): number {
  const cat: BeastCategory = species.category ?? 'beast';
  const diffScale = Math.max(1, species.captureDifficulty / 24);
  const nightBonus = timeSlot === 'night' || timeSlot === 'dusk' ? 1.35 : 1;

  switch (cat) {
    case 'beast':
      return 100 / diffScale;
    case 'domesticated':
      return terrain === 'city' || terrain === 'village' ? 76 : 42;
    case 'monstergirl':
      return 56 / diffScale;
    case 'demon_army':
      return (terrain === 'warzone' || terrain === 'ruin' ? 32 : 20) * nightBonus;
    case 'elite':
      return 6.5 * nightBonus;
  }
}

export function computeTerrainEncounterTable(
  regionId: RegionId,
  terrain: TerrainType,
  timeSlot: TimeSlot = 'dawn',
): EncounterEntry[] {
  if (terrain === 'outside' || terrain === 'ocean') return [];

  let matched = BEAST_SPECIES.filter(
    s => s.habitatRegions.includes(regionId) && habitatMatches(s.habitats, terrain),
  );
  // 若该大区个别稀疏地形未直接匹配到物种，回退至本区通用陆生栖息物种（保证生态完整）
  if (matched.length === 0) {
    matched = BEAST_SPECIES.filter(
      s => s.habitatRegions.includes(regionId) && (s.category === 'beast' || s.category === 'monstergirl'),
    );
  }
  if (matched.length === 0) return [];

  const weighted = matched.map(species => ({
    species,
    weight: rawEncounterWeight(species, terrain, timeSlot),
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;

  return weighted
    .map(({ species, weight }) => ({
      speciesId: species.id,
      name: species.name,
      category: species.category ?? 'beast',
      element: species.element,
      cageCost: species.cageCost,
      probabilityPct: Number(((weight / totalWeight) * 100).toFixed(1)),
      passiveEffect: species.passiveEffect,
      description: species.description,
    }))
    .sort((a, b) => b.probabilityPct - a.probabilityPct);
}

export function seedStarterEncounters(regionId: RegionId): string[] {
  const localRoad = computeTerrainEncounterTable(regionId, 'road', 'dawn')
    .filter(e => e.category !== 'elite')
    .slice(0, 2)
    .map(e => e.speciesId);
  const localVillage = computeTerrainEncounterTable(regionId, 'village', 'dawn')
    .filter(e => e.category === 'domesticated' || e.category === 'beast')
    .slice(0, 1)
    .map(e => e.speciesId);
  return [...new Set(['ember_fox_pup', ...localRoad, ...localVillage])];
}

export function rollRouteEncounters(
  map: RegionMap,
  points: readonly { x: number; y: number }[],
  regionId: RegionId,
  timeSlot: TimeSlot,
  seed: number,
): BeastSpecies[] {
  if (points.length < 2) return [];
  const terArr = regionTerrainArray(map);
  const visitedTerrains = new Set<TerrainType>();

  for (const pt of points) {
    const gx = Math.floor(pt.x);
    const gy = Math.floor(pt.y);
    if (gx < 0 || gy < 0 || gx >= map.width || gy >= map.height) continue;
    const ter = TERRAIN_ORDER[terArr[gy * map.width + gx]!] ?? 'outside';
    if (getTerrainBaseEncounterChance(ter) > 0) visitedTerrains.add(ter);
  }

  const rng = createRng(hashInt(`encounter:${seed}:${points.length}:${Math.round(points[points.length - 1]!.x)}`));
  const hits: BeastSpecies[] = [];
  const seenIds = new Set<string>();

  for (const ter of visitedTerrains) {
    const chance = getTerrainBaseEncounterChance(ter) / 100;
    if (rng() > chance) continue;
    const table = computeTerrainEncounterTable(regionId, ter, timeSlot);
    if (!table.length) continue;

    let roll = rng() * 100;
    let picked = table[table.length - 1]!;
    for (const row of table) {
      roll -= row.probabilityPct;
      if (roll <= 0) {
        picked = row;
        break;
      }
    }
    const spec = BEAST_SPECIES.find(s => s.id === picked.speciesId);
    if (spec && !seenIds.has(spec.id)) {
      seenIds.add(spec.id);
      hits.push(spec);
    }
  }

  return hits;
}
