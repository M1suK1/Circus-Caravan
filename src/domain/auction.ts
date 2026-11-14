/**
 * 奇幻生物拍卖行定价与当日挂单演算（纯函数）。
 */
import { REGION_CATALOG } from '../content/regions.ts';
import { findBeastSpecies } from '../content/species.ts';
import type { AuctionListing, Beast, RegionId } from '../types.ts';
import { createRng, hashInt } from './worldGen.ts';

export interface AuctionQuote {
  price: number;
  scarcityBonus: number;
  dailySwingPct: number;
  isSentientGirl: boolean;
}

export function isSentientMonsterGirl(speciesId: string): boolean {
  const sp = findBeastSpecies(speciesId);
  if (!sp) return false;
  return sp.category === 'monstergirl' || sp.category === 'domesticated' || sp.category === 'demon_army';
}

export function computeAuctionQuote(
  beast: Beast,
  regionId: RegionId,
  day: number,
  worldSeed: number,
): AuctionQuote {
  const sp = findBeastSpecies(beast.speciesId);
  const baseValue = sp?.baseAuctionValue ?? 420;
  const stageMult = beast.stage === 3 ? 1.75 : beast.stage === 2 ? 1.35 : 1.0;
  const levelBonus = 1 + Math.max(0, beast.level - 1) * 0.12;
  const tamenessFactor = 0.78 + (Math.min(100, Math.max(0, beast.tameness)) / 100) * 0.44;
  // 异域稀缺溢价：非原生栖息地大区可卖出更高收藏价
  const isNative = sp?.habitatRegions.includes(regionId) ?? false;
  const scarcityBonus = isNative ? 1.0 : 1.24;
  // 商皇朝（sand_oasis / iron_wastes）与魔法都市（arcane_city）对奇兽与魔物娘拍卖溢价更高
  const regionBias = regionId === 'sand_oasis' || regionId === 'arcane_city' || regionId === 'demon_realm'
    ? 1.15
    : 1.0;
  const rng = createRng(hashInt(`${worldSeed}:auction:${beast.id}:${regionId}:${day}`));
  const dailySwing = 0.85 + rng() * 0.30; // ±15% 日内行情波动
  const dangerPremium = 1 + (REGION_CATALOG[regionId].dangerTier - 1) * 0.04;

  const price = Math.max(
    120,
    Math.round(baseValue * stageMult * levelBonus * tamenessFactor * scarcityBonus * regionBias * dangerPremium * dailySwing),
  );
  return {
    price,
    scarcityBonus,
    dailySwingPct: Math.round((dailySwing - 1) * 100),
    isSentientGirl: isSentientMonsterGirl(beast.speciesId),
  };
}

export function generateAuctionLots(
  beasts: readonly Beast[],
  regionId: RegionId,
  poiId: string,
  day: number,
  worldSeed: number,
): AuctionListing[] {
  return beasts.map(beast => {
    const q = computeAuctionQuote(beast, regionId, day, worldSeed);
    return {
      id: `lot-${poiId}-${beast.id}-${day}`,
      regionId,
      poiId,
      beastId: beast.id,
      reservePrice: Math.round(q.price * 0.85),
      currentBid: q.price,
      expiresDay: day,
    };
  });
}
