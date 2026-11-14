import type { ActionResult, CircusState, GameAction } from '../types.ts';
import {
  applyInjectCardboxGuests,
  applyRecruitWorldNpc,
  applySetRegionBlueprint,
} from './cardOps.ts';
import {
  applyAcceptFreightOrder,
  applyAcceptPassengerOrder,
  applyDeliverContract,
  applySellBeast,
} from './contractOps.ts';
import {
  applyAttemptWildCapture,
  applyHireCandidate,
  applyImportCardAsPerformer,
  applyPlaceCardAsNpc,
  applyRepairWagon,
  applySetPerformerExpression,
  applySetPerformerPortrait,
  applyUpgradeWagon,
} from './crewOps.ts';
import { applyRetire } from './endingOps.ts';
import { applyResolveLandmark } from './landmarkOps.ts';
import { createInitialState } from './state.ts';
import {
  applySettlementAidOrPass,
  applySettlementBuySupply,
  applyStagePerform,
  applyTavernRest,
} from './settlementOps.ts';
import { applyAdvanceTimeSlot, applyEndDay } from './timeOps.ts';
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
    case 'attemptWildCapture':
      return applyAttemptWildCapture(state, action);
    case 'advanceTimeSlot':
      return applyAdvanceTimeSlot(state);
    case 'endDay':
      return applyEndDay(state);
    case 'retire':
      return applyRetire(state, action);
    case 'acceptFreightOrder':
      return applyAcceptFreightOrder(state, action);
    case 'acceptPassengerOrder':
      return applyAcceptPassengerOrder(state, action);
    case 'deliverContract':
      return applyDeliverContract(state, action);
    case 'sellBeast':
      return applySellBeast(state, action);
    case 'resolveLandmark':
      return applyResolveLandmark(state, action);
    case 'recruitWorldNpc':
      return applyRecruitWorldNpc(state, action);
    case 'injectCardboxGuests':
      return applyInjectCardboxGuests(state, action);
    case 'setRegionBlueprint':
      return applySetRegionBlueprint(state, action);
    default:
      return { state, ok: false, message: '未知操作。' };
  }
}
