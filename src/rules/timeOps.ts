import { REGION_CATALOG, REGION_IDS } from '../content/regions.ts';
import { isDayRollover, nextTimeSlot, TIME_SLOT_LABELS } from '../domain/calendar.ts';
import { computeCaravanCapacity, dailyUpkeep, usedWeight } from '../domain/caravanMath.ts';
import { createRng, hashInt } from '../domain/worldGen.ts';
import type { ActionResult, CircusState, DayLedger, DayLedgerLine } from '../types.ts';
import { clone, pushLog } from './core.ts';

function buildDailyRumor(state: CircusState, settledDay: number, idx: number): { regionId: typeof REGION_IDS[number]; text: string } {
  const rng = createRng(hashInt(`${state.world.seed}:rumor:${settledDay}:${idx}`));
  const regionId = REGION_IDS[Math.floor(rng() * REGION_IDS.length)]!;
  const region = REGION_CATALOG[regionId];
  const templates = [
    `「${region.name}」商路风闻：近日货栈对护送药箱与稳压芯的报价暗涨，流民都在盼着马戏团经过。`,
    `「${region.name}」暗哨传信：边境巡守加紧盘查无证违禁箱匣，走私客改往偏僻村落交货。`,
    `「${region.name}」酒馆闲谈：夜幕后荒野异动加剧，带着驯兽师的旅团更容易捕获稀罕奇兽。`,
    `「${region.name}」残响短波：大篷车风灯的传闻越传越广，部分城邦广场愿意为契合节目多付打赏。`,
  ];
  return {
    regionId,
    text: templates[Math.floor(rng() * templates.length)]!,
  };
}

export function applyEndDay(state: CircusState): ActionResult {
  if (state.phase === 'retired') {
    return { state, ok: false, message: '剧团已隐居收摊，无法继续推进日期。' };
  }
  if (state.world.traveling) {
    return { state, ok: false, message: '车队尚在半途行进中，请待抵达后再结束今日。' };
  }
  if (state.lastLedger && state.lastLedger.day >= state.day) {
    return { state, ok: false, message: '今日已完成日结，请勿重复扣账。' };
  }

  const next = clone(state);
  const settledDay = next.day;
  const startingGold = next.gold;
  const rng = createRng(hashInt(`${next.world.seed}:endday:${settledDay}`));
  const upkeep = dailyUpkeep(next);
  const lines: DayLedgerLine[] = [];
  const warnings: string[] = [];

  // 1. 口粮结算
  const rationsUsed = Math.min(next.supplies.rations, upkeep.rations);
  const rationsShortage = Math.max(0, upkeep.rations - rationsUsed);
  next.supplies.rations = Math.max(0, next.supplies.rations - rationsUsed);
  lines.push({
    label: '全团与旅客口粮消耗',
    category: rationsShortage > 0 ? 'warning' : 'expense',
    detail: `需 ${upkeep.rations} 份，实扣 ${rationsUsed} 份${rationsShortage > 0 ? `（短缺 ${rationsShortage} 份）` : ''}`,
    amountText: `-${rationsUsed} 粮`,
    tone: rationsShortage > 0 ? 'crimson' : 'amber',
  });
  if (rationsShortage > 0) {
    const ratio = Math.min(1, rationsShortage / Math.max(1, upkeep.rations));
    const hpPenalty = Math.max(6, Math.round(10 * ratio));
    for (const perf of next.performers) {
      perf.hp = Math.max(1, perf.hp - hpPenalty);
      perf.morale = Math.max(0, perf.morale - 10);
    }
    next.caravan.morale = Math.max(0, next.caravan.morale - 12);
    const w = `断粮警示：口粮短缺 ${rationsShortage} 份，全员生命 -${hpPenalty}、士气严重下滑。`;
    warnings.push(w);
    pushLog(next, 'system', w);
  }

  // 2. 兽料结算
  const fodderUsed = Math.min(next.supplies.fodder, upkeep.fodder);
  const fodderShortage = Math.max(0, upkeep.fodder - fodderUsed);
  next.supplies.fodder = Math.max(0, next.supplies.fodder - fodderUsed);
  if (upkeep.fodder > 0 || fodderShortage > 0) {
    lines.push({
      label: '奇兽笼厢兽料消耗',
      category: fodderShortage > 0 ? 'warning' : 'expense',
      detail: `需 ${upkeep.fodder} 份，实扣 ${fodderUsed} 份${fodderShortage > 0 ? `（短缺 ${fodderShortage} 份）` : ''}`,
      amountText: `-${fodderUsed} 料`,
      tone: fodderShortage > 0 ? 'crimson' : 'amber',
    });
  }
  if (fodderShortage > 0 && next.beasts.length > 0) {
    for (const beast of next.beasts) {
      beast.tameness = Math.max(0, beast.tameness - 10);
      beast.hunger = Math.max(0, beast.hunger - 22);
    }
    const w = `断料警示：兽料短缺 ${fodderShortage} 份，兽笼奇兽驯服度下降，随时可能暴躁越笼。`;
    warnings.push(w);
    pushLog(next, 'beast', w);
  }

  // 3. 艺人日薪结算
  let wagesPaid = 0;
  let unpaidWages = false;
  if (next.gold >= upkeep.wages) {
    next.gold -= upkeep.wages;
    wagesPaid = upkeep.wages;
  } else {
    wagesPaid = next.gold;
    next.gold = 0;
    unpaidWages = true;
    next.caravan.morale = Math.max(0, next.caravan.morale - 15);
    next.caravan.fame = Math.max(0, next.caravan.fame - 3);
    for (const perf of next.performers) {
      perf.morale = Math.max(0, perf.morale - 10);
    }
    if (rng() < 0.2 && next.recruitPool.length > 0) {
      const left = next.recruitPool.shift()!;
      pushLog(next, 'crew', `因长期拖欠薪饷，候补艺人「${left.name}」失望离去。`);
    }
    const w = `欠薪警示：应发日薪 ${upkeep.wages} 金，仅能实付 ${wagesPaid} 金，全团士气受挫。`;
    warnings.push(w);
    pushLog(next, 'crew', w);
  }
  lines.push({
    label: '随行演职员日薪',
    category: unpaidWages ? 'warning' : 'expense',
    detail: unpaidWages ? `应发 ${upkeep.wages} 金，资金不足仅发 ${wagesPaid} 金` : `${next.performers.length} 位团员今日薪资结清`,
    amountText: `-${wagesPaid} 金`,
    tone: unpaidWages ? 'crimson' : 'amber',
  });

  // 4. 车厢磨损与失能检测
  const avgDurabilityBefore = Math.round(
    next.caravan.wagons.reduce((s, w) => s + w.durability, 0) / Math.max(1, next.caravan.wagons.length),
  );
  const loadFactor = Math.floor(usedWeight(next) / 60);
  const wearPerWagon = 2 + loadFactor;
  const brokenWagons: string[] = [];
  for (const wagon of next.caravan.wagons) {
    wagon.durability = Math.max(0, wagon.durability - wearPerWagon);
    if (wagon.durability === 0) brokenWagons.push(wagon.name);
  }
  const avgDurabilityAfter = Math.round(
    next.caravan.wagons.reduce((s, w) => s + w.durability, 0) / Math.max(1, next.caravan.wagons.length),
  );
  const cap = computeCaravanCapacity(next.caravan.wagons);
  next.caravan.maxWeight = cap.maxWeight;
  next.caravan.maxSeats = cap.maxSeats;
  next.caravan.maxCageSlots = cap.maxCageSlots;
  if (brokenWagons.length > 0) {
    const w = `车毁警示：${brokenWagons.join('、')}耐久归零，已暂时失去对应承载功能，请尽快进城修缮。`;
    warnings.push(w);
    pushLog(next, 'crew', w);
  }
  lines.push({
    label: '车队风沙磨损',
    category: brokenWagons.length > 0 ? 'warning' : 'status',
    detail: `每节车厢耐久 -${wearPerWagon}（均况 ${avgDurabilityBefore}% → ${avgDurabilityAfter}%）`,
    amountText: `-${wearPerWagon}%`,
    tone: brokenWagons.length > 0 ? 'crimson' : undefined,
  });

  // 5. 疲劳恢复与世界衰败推进
  if (rationsShortage === 0) {
    for (const perf of next.performers) {
      perf.fatigue = Math.max(0, perf.fatigue - 20);
      if (perf.morale < 72) perf.morale = Math.min(72, perf.morale + 2);
    }
  }
  next.world.worldDecay = Math.min(100, next.world.worldDecay + 1);
  lines.push({
    label: '末世衰败与休整',
    category: 'status',
    detail: rationsShortage === 0 ? '全员夜间休息疲劳 -20，荒野灾厄缓慢侵蚀大陆' : '饥饿状态下夜间难以真正恢复体力',
    amountText: `衰败度 ${next.world.worldDecay}`,
  });

  // 6. 货运与客运期限检验
  const expiredContracts: string[] = [];
  for (const order of next.freightOrders) {
    if (order.status === 'carrying' && settledDay >= order.deadlineDay) {
      order.status = 'failed';
      next.caravan.fame = Math.max(0, next.caravan.fame - 8);
      const fine = Math.min(next.gold, Math.round(order.rewardGold * 0.25));
      next.gold -= fine;
      expiredContracts.push(order.title);
      const w = `逾期违约：货运「${order.title}」超过交期，声望 -8 并赔付违约金 ${fine} 金。`;
      warnings.push(w);
      pushLog(next, 'freight', w);
    }
  }
  for (const pax of next.passengerOrders) {
    if (pax.status === 'aboard' && pax.deadlineDay !== undefined && settledDay >= pax.deadlineDay) {
      pax.status = 'abandoned';
      next.caravan.fame = Math.max(0, next.caravan.fame - 5);
      expiredContracts.push(pax.name);
      const w = `旅客失期：「${pax.name}」久候未抵终点愤而下车，声望 -5。`;
      warnings.push(w);
      pushLog(next, 'freight', w);
    }
  }

  // 7. 刷新 1-2 条残响电台传闻
  const rumorCount = rng() > 0.45 ? 2 : 1;
  const newRumors: string[] = [];
  for (let i = 0; i < rumorCount; i += 1) {
    const r = buildDailyRumor(next, settledDay, i);
    next.rumors.unshift({
      id: `rumor-${settledDay}-${i}`,
      day: settledDay + 1,
      regionId: r.regionId,
      text: r.text,
    });
    newRumors.push(r.text);
  }
  next.rumors = next.rumors.slice(0, 18);

  // 8. 跨日时钟翻页与账册封存
  next.day = settledDay + 1;
  next.timeSlot = 'dawn';

  const incomeTotal = next.recentShows
    .filter(s => s.day === settledDay)
    .reduce((sum, s) => sum + s.ticketRevenue + s.tipBonus, 0);
  const expenseTotal = Math.max(0, startingGold - next.gold);

  const ledger: DayLedger = {
    day: settledDay,
    startingGold,
    endingGold: next.gold,
    incomeTotal,
    expenseTotal,
    rationsNeeded: upkeep.rations,
    rationsUsed,
    rationsShortage,
    fodderNeeded: upkeep.fodder,
    fodderUsed,
    fodderShortage,
    wagesDue: upkeep.wages,
    wagesPaid,
    unpaidWages,
    avgDurabilityBefore,
    avgDurabilityAfter,
    worldDecay: next.world.worldDecay,
    brokenWagons,
    expiredContracts,
    newRumors,
    lines,
    warnings,
  };
  next.lastLedger = ledger;

  pushLog(
    next,
    'system',
    `第 ${settledDay} 日结算完成：实付薪资 ${wagesPaid} 金，消耗口粮 ${rationsUsed}、兽料 ${fodderUsed}，迎来第 ${next.day} 日拂晓。`,
  );
  return {
    state: next,
    ok: true,
    message: warnings.length > 0 ? `第 ${settledDay} 日结完成（含 ${warnings.length} 项生存警示）` : `第 ${settledDay} 日顺利收摊，迎来第 ${next.day} 日拂晓。`,
  };
}

export function applyAdvanceTimeSlot(state: CircusState): ActionResult {
  if (state.phase === 'retired') {
    return { state, ok: false, message: '剧团已隐居收摊，无法继续推进时间。' };
  }
  if (state.world.traveling) {
    return { state, ok: false, message: '车队尚在行进中。' };
  }
  if (isDayRollover(state.timeSlot)) {
    return applyEndDay(state);
  }
  const next = clone(state);
  next.timeSlot = nextTimeSlot(state.timeSlot);
  return {
    state: next,
    ok: true,
    message: `时辰推移至第 ${next.day} 日 · ${TIME_SLOT_LABELS[next.timeSlot]}。`,
  };
}
