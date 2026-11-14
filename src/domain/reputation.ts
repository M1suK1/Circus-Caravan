/**
 * 九大地区独立声望（Region Reputation）阶梯、经济/通行修正与变动计算（纯函数）。
 */
import { initialRegionReputation } from '../content/regions.ts';
import type { MacroRegion, RegionReputationTierId } from '../types.ts';

export interface ReputationTierInfo {
  id: RegionReputationTierId;
  label: string;
  tone: 'crimson' | 'amber' | 'neutral' | 'forest' | 'gold';
  summary: string;
}

export interface ReputationModifiers {
  showPayoutMult: number;
  tavernCostMult: number;
  shopPriceMult: number;
  tollFree: boolean;
  recruitBonus: boolean;
}

export function clampRegionReputation(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

export function getRegionReputation(region: Pick<MacroRegion, 'id' | 'reputation'>): number {
  return clampRegionReputation(
    typeof region.reputation === 'number' ? region.reputation : initialRegionReputation(region.id),
  );
}

export function getReputationTier(rep: number): ReputationTierInfo {
  if (rep <= -30) {
    return {
      id: 'hostile',
      label: '仇视驱逐',
      tone: 'crimson',
      summary: '商铺加价 +30%，哨站强制盘查罚款',
    };
  }
  if (rep < 0) {
    return {
      id: 'wary',
      label: '冷眼戒备',
      tone: 'amber',
      summary: '物价小幅上浮 +10%，城门盘问从严',
    };
  }
  if (rep < 25) {
    return {
      id: 'neutral',
      label: '过客微名',
      tone: 'neutral',
      summary: '普通商旅待遇，暂无特殊折扣',
    };
  }
  if (rep < 60) {
    return {
      id: 'warm_lantern',
      label: '暖灯口碑',
      tone: 'forest',
      summary: '演出票房 +20%，旅店休整费 -15%',
    };
  }
  return {
    id: 'legendary',
    label: '传唱传奇',
    tone: 'gold',
    summary: '演出票房 +35%，当地哨站免通行证放行',
  };
}

export function getReputationModifiers(rep: number): ReputationModifiers {
  if (rep <= -30) {
    return {
      showPayoutMult: 0.8,
      tavernCostMult: 1.25,
      shopPriceMult: 1.3,
      tollFree: false,
      recruitBonus: false,
    };
  }
  if (rep < 0) {
    return {
      showPayoutMult: 0.94,
      tavernCostMult: 1.08,
      shopPriceMult: 1.1,
      tollFree: false,
      recruitBonus: false,
    };
  }
  if (rep < 25) {
    return {
      showPayoutMult: 1.0,
      tavernCostMult: 1.0,
      shopPriceMult: 1.0,
      tollFree: false,
      recruitBonus: false,
    };
  }
  if (rep < 60) {
    return {
      showPayoutMult: 1.2,
      tavernCostMult: 0.85,
      shopPriceMult: 0.92,
      tollFree: false,
      recruitBonus: true,
    };
  }
  return {
    showPayoutMult: 1.35,
    tavernCostMult: 0.75,
    shopPriceMult: 0.85,
    tollFree: true,
    recruitBonus: true,
  };
}

export function computeRegionReputationUpdate(
  region: Pick<MacroRegion, 'id' | 'reputation' | 'reputationHistory'>,
  delta: number,
  day: number,
  reason: string,
): {
  reputation: number;
  reputationHistory: { day: number; delta: number; reason: string }[];
  factionDelta: number;
} {
  const prev = getRegionReputation(region);
  const next = clampRegionReputation(prev + delta);
  const history = [{ day, delta, reason }, ...(region.reputationHistory ?? [])].slice(0, 10);
  const factionDelta = delta === 0 ? 0 : Math.trunc(delta * 0.3);
  return {
    reputation: next,
    reputationHistory: history,
    factionDelta,
  };
}
