import { buildFallbackBlueprint } from '../content/promptTemplates.ts';
import { findBeastSpecies } from '../content/species.ts';
import { computeRegionReputationUpdate, getRegionReputation, getReputationModifiers } from '../domain/reputation.ts';
import { createRng, hashInt } from '../domain/worldGen.ts';
import type { ActionResult, CircusState, GameAction } from '../types.ts';
import { clone, pushLog } from './core.ts';
import { advanceClockSlots } from './timeOps.ts';

function applyRepDelta(next: CircusState, delta: number, reason: string): void {
  const region = next.world.regions[next.world.currentRegionId];
  const upd = computeRegionReputationUpdate(region, delta, next.day, reason);
  region.reputation = upd.reputation;
  region.reputationHistory = upd.reputationHistory;
  const dom = region.dominantFaction;
  if (dom !== 'neutral' && next.world.factions[dom] && upd.factionDelta !== 0) {
    next.world.factions[dom].standing += upd.factionDelta;
  }
}

export function applyResolveLandmark(
  state: CircusState,
  action: Extract<GameAction, { type: 'resolveLandmark' }>,
): ActionResult {
  if (state.phase === 'retired') {
    return { state, ok: false, message: '剧团已隐居收摊，无法探索野外地标。' };
  }
  const next = clone(state);
  const region = next.world.regions[next.world.currentRegionId];
  const lm = region.map?.landmarks?.[action.landmarkId];
  if (!lm) return { state, ok: false, message: '找不到该野外兴趣点。' };
  if (lm.resolved) return { state, ok: false, message: `「${lm.name}」已经探索完毕。` };

  const rng = createRng(hashInt(`${next.world.seed}:lm:${lm.id}:${next.day}`));
  const primary = action.choice === 'primary';
  let msg = '';

  switch (lm.kind) {
    case 'ancient_ruin': {
      if (primary) {
        const parts = 2 + Math.floor(rng() * 3);
        const props = 2 + Math.floor(rng() * 2);
        next.supplies.spareParts += parts;
        next.supplies.props += props;
        msg = `在「${lm.name}」发掘出旧纪元修车零件 +${parts}、彩粉道具 +${props}。`;
      } else {
        next.caravan.fame += 4;
        next.retirement.sanctuaryDiscovered = true;
        msg = `从「${lm.name}」残存壁画抄录了隐秘航路线索，剧团传唱度 +4。`;
      }
      break;
    }
    case 'wild_lair': {
      const sp = lm.linkedSpeciesId ? findBeastSpecies(lm.linkedSpeciesId) : undefined;
      if (sp && !next.encounteredSpeciesIds.includes(sp.id)) {
        next.encounteredSpeciesIds.push(sp.id);
      }
      if (primary) {
        next.supplies.fodder += 3;
        msg = sp
          ? `在「${lm.name}」追踪到「${sp.name}」踪迹并记入图鉴，另拾得鲜草料 +3。`
          : `在「${lm.name}」采集到新鲜奇兽草料 +3。`;
      } else {
        next.caravan.morale = Math.min(100, next.caravan.morale + 5);
        msg = sp
          ? `静观「${sp.name}」生态并完善图鉴笔记，全团士气 +5。`
          : `静观荒野兽道记下避险路线，全团士气 +5。`;
      }
      break;
    }
    case 'refugee_camp': {
      if (primary) {
        applyRepDelta(next, 9, `在「${lm.name}」举行流民义演`);
        next.caravan.fame += 5;
        for (const p of next.performers) p.morale = Math.min(100, p.morale + 6);
        msg = `在「${lm.name}」举行暖灯义演！${region.name}区域声望 +9、名望 +5。`;
      } else {
        if (next.supplies.rations < 4) {
          return { state, ok: false, message: '口粮不足 4 份，暂无法向流民营地施粮。' };
        }
        next.supplies.rations -= 4;
        applyRepDelta(next, 12, `向「${lm.name}」救济干粮`);
        next.caravan.morale = Math.min(100, next.caravan.morale + 8);
        msg = `向「${lm.name}」流民施舍 4 份口粮，区域声望 +12、全团士气 +8。`;
      }
      break;
    }
    case 'smuggler_cove': {
      if (primary) {
        if (next.gold < 65) return { state, ok: false, message: '金币不足 65 金，暗桩老板拒绝出货。' };
        next.gold -= 65;
        next.supplies.tamingNets += 2;
        msg = `在「${lm.name}」黑市暗桩折价购入麻醉捕获网 +2（花费 65 金）。`;
      } else {
        next.supplies.fuel += 3;
        next.rumors.unshift({
          id: `rumor-smug-${next.day}-${lm.id}`,
          day: next.day,
          regionId: region.id,
          text: `「${lm.name}」船夫暗语：邻区近来巡逻加紧，但沿海夜航油料仍可便宜走私。`,
        });
        msg = `从「${lm.name}」换得密道风闻与私货灯油 +3。`;
      }
      break;
    }
    case 'watchtower_post': {
      const mod = getReputationModifiers(getRegionReputation(region));
      if (primary) {
        if (mod.tollFree) {
          next.caravan.fame += 3;
          msg = `凭借「${region.name}」传唱口碑，在「${lm.name}」免税放行并获赠前沿情报（名望 +3）。`;
        } else {
          if (next.gold < 40) return { state, ok: false, message: '交纳哨站登记税需 40 金。' };
          next.gold -= 40;
          applyRepDelta(next, 4, `在「${lm.name}」配合哨站登记`);
          msg = `在「${lm.name}」缴纳 40 金过路查验税，区域声望 +4。`;
        }
      } else {
        if (next.gold < 50) return { state, ok: false, message: '购置军粮需 50 金。' };
        next.gold -= 50;
        next.supplies.rations += 6;
        msg = `从「${lm.name}」哨兵处购入军用干粮 +6（50 金）。`;
      }
      break;
    }
    case 'shrine_hearth': {
      if (primary) {
        next.caravan.morale = Math.min(100, next.caravan.morale + 12);
        for (const p of next.performers) p.fatigue = Math.max(0, p.fatigue - 15);
        msg = `在「${lm.name}」燃起暖灯祈愿，全团士气 +12、疲劳 -15。`;
      } else {
        region.calamityBlueprint ??= buildFallbackBlueprint(region.id, next.world.seed, next.world.worldDecay);
        const bp = region.calamityBlueprint;
        const nextClue = bp.clues.find(c => !bp.discoveredClues.includes(c));
        if (nextClue) bp.discoveredClues.push(nextClue);
        msg = nextClue
          ? `石碑映出隐秘纹路：「${nextClue}」`
          : `「${lm.name}」祭坛已解出本区全部灾厄线索（共 ${bp.discoveredClues.length} 条）。`;
      }
      break;
    }
  }

  lm.discovered = true;
  lm.resolved = true;
  const finalState = advanceClockSlots(next, 1);
  pushLog(finalState, 'scout', msg);
  return { state: finalState, ok: true, message: msg };
}
