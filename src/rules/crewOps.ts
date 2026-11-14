import { findBeastSpecies } from '../content/species.ts';
import { beastCageCost, computeCaravanCapacity, usedCageSlots, usedSeats, wagonRepairCost, wagonUpgradeCost } from '../domain/caravanMath.ts';
import { cardToPerformer, cardToWorldNpc } from '../domain/cardAdapter.ts';
import { attemptCaptureRoll } from '../domain/naturesAndCapture.ts';
import type { ActionResult, CircusState, GameAction } from '../types.ts';
import { clone, pushLog } from './core.ts';
import { advanceClockSlots } from './timeOps.ts';

export function applyUpgradeWagon(state: CircusState, action: Extract<GameAction, { type: 'upgradeWagon' }>): ActionResult {
  const next = clone(state);
  const wagon = next.caravan.wagons.find(w => w.id === action.wagonId);
  if (!wagon) return { state, ok: false, message: '找不到指定车厢。' };
  if (wagon.level >= 5) return { state, ok: false, message: `${wagon.name} 已升至满级。` };
  const cost = wagonUpgradeCost(wagon);
  if (next.gold < cost) return { state, ok: false, message: `金币不足，升级需要 ${cost} 金。` };

  next.gold -= cost;
  wagon.level += 1;
  wagon.maxDurability = 100 + (wagon.level - 1) * 15;
  wagon.durability = wagon.maxDurability;
  const cap = computeCaravanCapacity(next.caravan.wagons);
  next.caravan.maxWeight = cap.maxWeight;
  next.caravan.maxSeats = cap.maxSeats;
  next.caravan.maxCageSlots = cap.maxCageSlots;
  pushLog(next, 'crew', `${wagon.name} 升至 Lv.${wagon.level}，大篷车承载上限提升。`);
  return { state: next, ok: true, message: `${wagon.name} 已升级至 Lv.${wagon.level}。` };
}

export function applyRepairWagon(state: CircusState, action: Extract<GameAction, { type: 'repairWagon' }>): ActionResult {
  const next = clone(state);
  const wagon = next.caravan.wagons.find(w => w.id === action.wagonId);
  if (!wagon) return { state, ok: false, message: '找不到指定车厢。' };
  if (wagon.durability >= wagon.maxDurability) return { state, ok: false, message: `${wagon.name} 状态完好，无需修理。` };
  const cost = wagonRepairCost(wagon);
  if (next.gold < cost) return { state, ok: false, message: `金币不足，修理需要 ${cost} 金。` };

  next.gold -= cost;
  wagon.durability = wagon.maxDurability;
  const cap = computeCaravanCapacity(next.caravan.wagons);
  next.caravan.maxWeight = cap.maxWeight;
  next.caravan.maxSeats = cap.maxSeats;
  next.caravan.maxCageSlots = cap.maxCageSlots;
  pushLog(next, 'crew', `修缮了 ${wagon.name}，耐久恢复至 ${wagon.durability}。`);
  return { state: next, ok: true, message: `${wagon.name} 已修缮完成。` };
}

export function applyHireCandidate(state: CircusState, action: Extract<GameAction, { type: 'hireCandidate' }>): ActionResult {
  const next = clone(state);
  const idx = next.recruitPool.findIndex(c => c.id === action.candidateId);
  if (idx < 0) return { state, ok: false, message: '招募名单里找不到这位艺人。' };
  const candidate = next.recruitPool[idx]!;
  if (usedSeats(next) >= next.caravan.maxSeats) {
    return { state, ok: false, message: '风灯客车厢席位已满，请先升级车厢。' };
  }
  if (next.gold < candidate.hireCost) {
    return { state, ok: false, message: `金币不足，签约需要 ${candidate.hireCost} 金。` };
  }

  next.gold -= candidate.hireCost;
  next.recruitPool.splice(idx, 1);
  next.performers.push({
    id: `perf-${candidate.id}-${next.day}`,
    cardHash: candidate.cardHash,
    name: candidate.name,
    codename: candidate.title,
    title: candidate.title,
    role: candidate.role,
    element: '星光系',
    stats: { ...candidate.stats },
    level: 1,
    exp: 0,
    hp: 115,
    maxHp: 115,
    fatigue: 0,
    morale: 75,
    bond: 30,
    wagePerDay: candidate.wagePerDay,
    color: candidate.color,
    quote: candidate.quote,
    goal: '随大篷车一起穿过荒野。',
    appearance: '背着随身戏箱的流浪艺人',
    personality: candidate.personality,
    outfitDescription: '巡游轻便戏服',
    portrait: candidate.portrait,
    portraitAsset: candidate.portraitAsset,
    wardrobe: [],
    outfitId: 'custom',
    expression: 'calm',
    traits: candidate.traits.map(t => ({ ...t, tags: [...t.tags] })),
    skillIds: [],
  });
  pushLog(next, 'crew', `签约了新成员「${candidate.name}」（${candidate.title}）。`);
  return { state: next, ok: true, message: `欢迎 ${candidate.name} 加入大篷车！` };
}

export function applyImportCardAsPerformer(
  state: CircusState,
  action: Extract<GameAction, { type: 'importCardAsPerformer' }>,
): ActionResult {
  const next = clone(state);
  if (usedSeats(next) >= next.caravan.maxSeats) {
    return { state, ok: false, message: '客车厢席位已满，无法再接纳新演员。' };
  }
  const performer = cardToPerformer(action.card, {
    day: next.day,
    role: action.role,
    id: `perf-card-${next.performers.length + 1}-${next.day}`,
  });
  next.performers.push(performer);
  pushLog(next, 'crew', `从角色卡库招募「${performer.name}」担任马戏团${performer.title}。`);
  return { state: next, ok: true, message: `${performer.name} 已作为演员登车。` };
}

export function applyPlaceCardAsNpc(
  state: CircusState,
  action: Extract<GameAction, { type: 'placeCardAsNpc' }>,
): ActionResult {
  const next = clone(state);
  const region = next.world.regions[next.world.currentRegionId];
  const map = region.map;
  if (!map) return { state, ok: false, message: '当前大区未加载。' };
  const poi = map.pois[action.poiId];
  if (!poi || !poi.scouted || !poi.details) {
    return { state, ok: false, message: '请先侦查该城市/村庄，再安排驻地 NPC。' };
  }
  const npc = cardToWorldNpc(action.card, {
    regionId: region.id,
    poiId: poi.id,
    occupation: action.occupation,
    faction: action.faction ?? poi.details.ownerFaction,
    id: `npc-card-${next.worldNpcs.length + 1}-${next.day}`,
  });
  next.worldNpcs.push(npc);
  poi.details.npcIds.push(npc.id);
  pushLog(next, 'system', `角色卡「${npc.name}」已派驻「${poi.details.name}」担任 NPC。`);
  return { state: next, ok: true, message: `${npc.name} 已入驻 ${poi.details.name}。` };
}

export function applySetPerformerExpression(
  state: CircusState,
  action: Extract<GameAction, { type: 'setPerformerExpression' }>,
): ActionResult {
  const next = clone(state);
  const performer = next.performers.find(p => p.id === action.performerId);
  if (!performer) return { state, ok: false, message: '找不到这位成员。' };
  performer.expression = action.expression;
  return { state: next, ok: true };
}

export function applySetPerformerPortrait(
  state: CircusState,
  action: Extract<GameAction, { type: 'setPerformerPortrait' }>,
): ActionResult {
  if (!action.portrait.startsWith('data:image/')) {
    return { state, ok: false, message: '请选择有效的立绘图片文件。' };
  }
  const next = clone(state);
  const performer = next.performers.find(p => p.id === action.performerId);
  if (!performer) return { state, ok: false, message: '找不到这位成员。' };
  performer.portrait = action.portrait;
  performer.portraitAsset = undefined;
  return { state: next, ok: true, message: `已更新「${performer.name}」的全身立绘。` };
}

export function applyAttemptWildCapture(
  state: CircusState,
  action: Extract<GameAction, { type: 'attemptWildCapture' }>,
): ActionResult {
  const species = findBeastSpecies(action.speciesId);
  if (!species) return { state, ok: false, message: '图鉴中找不到该奇幻生物物种。' };
  if (state.supplies.tamingNets < 1) {
    return { state, ok: false, message: '麻醉捕捉网已耗尽，请先在补给市集或城镇商铺购买。' };
  }
  if (usedCageSlots(state) + species.cageCost > state.caravan.maxCageSlots) {
    return {
      state,
      ok: false,
      message: `奇幻兽笼空间不足（需 ${species.cageCost} 格），请先扩建兽笼车厢。`,
    };
  }
  const useBait = Boolean(action.useBait && state.supplies.props > 0);
  const next = clone(state);
  next.supplies.tamingNets -= 1;
  if (useBait) next.supplies.props -= 1;
  if (!next.encounteredSpeciesIds.includes(species.id)) {
    next.encounteredSpeciesIds.push(species.id);
  }

  const hasTamer = next.performers.some(p => p.role === 'tamer');
  const rollSeed = action.rollSeed ?? (next.world.seed + next.day * 37 + next.beasts.length * 13 + next.supplies.tamingNets * 7);
  const outcome = attemptCaptureRoll(species, { hasTamer, useBait, rollSeed });
  const pct = Math.round(outcome.probability * 100);

  if (!outcome.captured) {
    const finalFail = advanceClockSlots(next, 1);
    const msg = `投出捕获网晃动 ${outcome.shakes} 下后，${outcome.nature.name}性格的「${species.name}」（${outcome.ability.name}）挣脱逃进了荒野（本次捕获率 ${pct}%）。`;
    pushLog(finalFail, 'beast', msg);
    return { state: finalFail, ok: true, message: msg };
  }

  next.beasts.push({
    id: `beast-${species.id}-${next.day}-${rollSeed}`,
    speciesId: species.id,
    nickname: species.name,
    stage: species.stage,
    level: 1,
    exp: 0,
    tameness: outcome.nature.id === 'gentle' || outcome.nature.id === 'calm' ? 68 : 52,
    hunger: 80,
    appeal: outcome.appeal,
    combatPower: outcome.combatPower,
    natureId: outcome.nature.id,
    abilityId: outcome.ability.id,
    caughtRegionId: next.world.currentRegionId,
    talents: species.passiveEffect
      ? [{ id: `tal-${species.id}`, name: outcome.ability.name, effect: species.passiveEffect, value: 10 }]
      : [],
  });
  // 保障调用 beastCageCost 保持一致性导入使用
  void beastCageCost;
  const finalWin = advanceClockSlots(next, 1);
  const msg = `捕获成功！「${species.name}」入笼（性格：${outcome.nature.name} · 特性：${outcome.ability.name} · 捕获率 ${pct}%）。`;
  pushLog(finalWin, 'beast', msg);
  return { state: finalWin, ok: true, message: msg };
}
