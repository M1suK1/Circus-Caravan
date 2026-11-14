import type { ActionResult, CircusState, GameAction } from '../types.ts';
import {
  applyHireCandidate,
  applyImportCardAsPerformer,
  applyPlaceCardAsNpc,
  applyRepairWagon,
  applySetPerformerExpression,
  applySetPerformerPortrait,
  applyUpgradeWagon,
} from './crewOps.ts';
import { createInitialState } from './state.ts';
import {
  applySettlementAidOrPass,
  applySettlementBuySupply,
  applyStagePerform,
  applyTavernRest,
} from './settlementOps.ts';
import { applyCrossBorder, applyExecuteRoute, applyScoutSettlement } from './travelOps.ts';

export function act(state: CircusState, action: GameAction): ActionResult {
  switch (action.type) {
    case 'newGame':
      return { state: createInitialState({ seed: action.seed, spawnRegionId: action.spawnRegionId }), ok: true };
    case 'executeRoute':
      return applyExecuteRoute(state, action);
    case 'scoutSettlement':
      return applyScoutSettlement(state, action);
    case 'crossBorder':
      return applyCrossBorder(state, action);
    case 'upgradeWagon':
      return applyUpgradeWagon(state, action);
    case 'repairWagon':
      return applyRepairWagon(state, action);
    case 'hireCandidate':
      return applyHireCandidate(state, action);
    case 'importCardAsPerformer':
      return applyImportCardAsPerformer(state, action);
    case 'placeCardAsNpc':
      return applyPlaceCardAsNpc(state, action);
    case 'setPerformerExpression':
      return applySetPerformerExpression(state, action);
    case 'setPerformerPortrait':
      return applySetPerformerPortrait(state, action);
    case 'tavernRest':
      return applyTavernRest(state, action);
    case 'stagePerform':
      return applyStagePerform(state, action);
    case 'settlementBuySupply':
      return applySettlementBuySupply(state, action);
    case 'settlementAidOrPass':
      return applySettlementAidOrPass(state, action);
    default:
      return { state, ok: false, message: '未知操作。' };
  }
}
