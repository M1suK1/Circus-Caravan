import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGION_CATALOG } from '../src/content/regions.ts';
import { buildFallbackBlueprint, DEFAULT_SCOPE_PROMPTS, selectActiveWorldbookEntries } from '../src/content/promptTemplates.ts';
import { beastToCard, hasCardInUse, npcToPerformer, performerToCard } from '../src/domain/cardAdapter.ts';
import { generateRegionLandmarks, LANDMARK_META } from '../src/domain/landmarks.ts';
import { getRegionReputation, getReputationModifiers, getReputationTier } from '../src/domain/reputation.ts';
import { evaluateRouteStroke } from '../src/domain/routeDraw.ts';
import { callNarrativeLlm, sanitizeLlmProposal } from '../src/engine/llmService.ts';
import { act } from '../src/rules/act.ts';
import { normalizeState, serializeState } from '../src/rules/persistence.ts';
import { createInitialState } from '../src/rules/state.ts';

test('s11 地图野外兴趣点：每张区域小地图生成 4-7 个地形契合的兴趣点且不重叠堵路', () => {
  const state = createInitialState({ seed: 1101, spawnRegionId: 'empire_heart' });
  const map = state.world.regions.empire_heart.map!;
  const landmarks = Object.values(map.landmarks ?? {});
  assert.ok(landmarks.length >= 4 && landmarks.length <= 7, `兴趣点数量应为 4-7，实际=${landmarks.length}`);

  for (const lm of landmarks) {
    assert.ok(LANDMARK_META[lm.kind], `未知兴趣点类型 ${lm.kind}`);
    assert.ok(lm.x >= 2 && lm.y >= 2 && lm.x < map.width - 2 && lm.y < map.height - 2);
    // 不可压在主城或关口中心上
    for (const poi of Object.values(map.pois)) {
      assert.ok(Math.hypot(lm.x - poi.x, lm.y - poi.y) >= 6, '兴趣点不应紧贴聚落重叠');
    }
  }

  // 路线终点靠近兴趣点应识别 reachedLandmarkId
  const target = landmarks[0]!;
  const evalRes = evaluateRouteStroke(
    map,
    [{ x: target.x + 0.5, y: target.y + 0.5 }, { x: target.x + 0.6, y: target.y + 0.5 }],
    state,
  );
  assert.equal(evalRes.reachedLandmarkId, target.id);

  // 探索并解决兴趣点会改变状态并推进 1 个时段
  const slotBefore = state.timeSlot;
  const res = act(state, { type: 'resolveLandmark', landmarkId: target.id, choice: 'primary' });
  assert.equal(res.ok, true, res.message);
  assert.equal(res.state.world.regions.empire_heart.map!.landmarks![target.id]!.resolved, true);
  assert.notEqual(res.state.timeSlot, slotBefore, '探索兴趣点应推进时间段');
});

test('s11 区域声望体系：五档阶梯、票房/关税修正及演出与黑市双向联动', () => {
  const state = createInitialState({ seed: 1102, spawnRegionId: 'empire_heart' });
  const region = state.world.regions.empire_heart;
  const baseRep = getRegionReputation(region);
  assert.ok(baseRep >= -20 && baseRep <= 30);

  assert.equal(getReputationTier(-45).id, 'hostile');
  assert.equal(getReputationTier(35).id, 'warm_lantern');
  assert.equal(getReputationTier(75).id, 'legendary');

  const warmMod = getReputationModifiers(40);
  const hostileMod = getReputationModifiers(-40);
  assert.ok(warmMod.showPayoutMult > 1.15, '暖灯口碑应提升演出票房');
  assert.ok(hostileMod.shopPriceMult > 1.2, '仇视驱逐应提高物价');
  assert.equal(getReputationModifiers(65).tollFree, true, '传唱传奇应可免证过卡');

  // 广场演出应提高当前区域声望
  const poi = Object.values(region.map!.pois)[0]!;
  const afterShow = act(state, { type: 'stagePerform', poiId: poi.id });
  assert.equal(afterShow.ok, true);
  assert.ok(
    getRegionReputation(afterShow.state.world.regions.empire_heart) > baseRep,
    '在聚落广场演出应提升本地区声望',
  );
});

test('s11 角色卡全生态复用：卡匣去重、客串注入、NPC转正登车与奇兽兼容导出', () => {
  let state = createInitialState({ seed: 1103, spawnRegionId: 'empire_heart' });
  state.caravan.maxSeats = 8;
  const starterCard = performerToCard(state.performers[0]!, { day: state.day });
  assert.equal(hasCardInUse(state, starterCard), true, '已在团演员角色卡应识别为占用中');

  // 构造两张外部角色卡注入世界
  const guestA = {
    ...starterCard,
    girl: { ...starterCard.girl, name: '米露', codename: '星灯旅人', title: '占星旅商' },
  };
  const guestB = {
    ...starterCard,
    girl: { ...starterCard.girl, name: '伊芙', codename: '风铃匠', title: '机械技师' },
  };
  assert.equal(hasCardInUse(state, guestA), false);

  const injected = act(state, { type: 'injectCardboxGuests', cards: [guestA, guestB], maxCount: 2 });
  assert.equal(injected.ok, true, injected.message);
  state = injected.state;
  assert.ok(state.worldNpcs.some(n => n.name === '米露'), '客串注入应生成 WorldNpc');

  // 邀约好感达标的 NPC 转正登车
  const npc = state.worldNpcs.find(n => n.name === '米露')!;
  npc.disposition = 85;
  const converted = npcToPerformer(npc, state.day);
  assert.equal(converted.name, '米露');

  const recruitRes = act(state, { type: 'recruitWorldNpc', npcId: npc.id });
  assert.equal(recruitRes.ok, true, recruitRes.message);
  assert.ok(recruitRes.state.performers.some(p => p.name === '米露'), '邀约后应成为正式剧团演员');
  assert.equal(recruitRes.state.worldNpcs.some(n => n.id === npc.id), false, '转正后应移出驻地 NPC 列表');

  // 奇兽/魔物娘导出兼容角色卡
  const bCard = beastToCard(state.beasts[0]!, state.day);
  assert.equal(bCard.format, 'circus-caravan/card');
});

test('s11 LLM 叙事底座：六大作用域、按需世界书裁剪、越界提案夹逼与离线降级兜底', async () => {
  assert.ok(DEFAULT_SCOPE_PROMPTS.scout && DEFAULT_SCOPE_PROMPTS.campfire && DEFAULT_SCOPE_PROMPTS.blueprint && DEFAULT_SCOPE_PROMPTS.ending);
  assert.ok(DEFAULT_SCOPE_PROMPTS.encounter && DEFAULT_SCOPE_PROMPTS.rumor);

  const selected = selectActiveWorldbookEntries(
    undefined,
    'arcane_city',
    ['浮空塔', '幻术'],
    900,
  );
  assert.ok(selected.length >= 1 && selected.length <= 5, '按需裁剪后的世界书词条数量应受预算控制');
  assert.ok(selected.some(e => e.id === 'wb-empire-aether-spire'), '应精准命中魔法都市相关词条');

  // 数值防越界夹逼
  const clamped = sanitizeLlmProposal({ bondDelta: 99, moraleDelta: -50, goldHack: 999999 });
  assert.equal(clamped.bondDelta, 3, 'LLM 提案羁绊修正不得越界');
  assert.equal(clamped.moraleDelta, -4, 'LLM 提案士气修正不得越界');

  // 离线无密钥自动静默降级至 fallback
  const fallbackResult = await callNarrativeLlm({
    scope: 'scout',
    regionId: 'empire_heart',
    userPrompt: '勘察当前城市',
    fallback: () => ({ name: '灰塔堡', summary: '本地兜底简报', ok: true }),
  });
  assert.equal(fallbackResult.source, 'fallback');
  assert.equal(fallbackResult.data.name, '灰塔堡');

  // 故事蓝图离线生成
  const bp = buildFallbackBlueprint('empire_heart', 2026, 35);
  assert.equal(bp.regionId, 'empire_heart');
  assert.ok(bp.clues.length >= 3);
  assert.ok(bp.angelCover && bp.devilCover);
});

test('s11 存档兼容与 UI 组件源码契约校验', () => {
  // 老存档无 landmarks / reputation 自动补全
  const legacy = JSON.parse(serializeState(createInitialState({ seed: 1104 }))) as Record<string, unknown>;
  const world = legacy.world as Record<string, unknown>;
  const regions = world.regions as Record<string, Record<string, unknown>>;
  delete regions.empire_heart.reputation;
  const loaded = normalizeState(JSON.stringify(legacy));
  assert.ok(loaded);
  assert.equal(typeof loaded.world.regions.empire_heart.reputation, 'number');

  // UI 零 emoji 与必要组件检查
  const root = resolve(import.meta.dirname, '..');
  const cardboxSrc = readFileSync(resolve(root, 'src/components/Modals/CardboxDialog.tsx'), 'utf8');
  const lmDialogSrc = readFileSync(resolve(root, 'src/components/Modals/LandmarkDialog.tsx'), 'utf8');
  const engineSrc = readFileSync(resolve(root, 'src/components/Modals/EngineConfigDialog.tsx'), 'utf8');
  const appSrc = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');

  assert.ok(cardboxSrc.includes('cardbox-modal'), '必须提供独立 CardboxDialog 卡匣模态框');
  assert.ok(lmDialogSrc.includes('landmark-modal'), '必须提供 LandmarkDialog 兴趣点探索弹窗');
  assert.ok(engineSrc.includes('offline') && engineSrc.includes('NARRATIVE_SCOPE_LABELS'), 'EngineConfigDialog 必须支持离线/在线模式与六大作用域配置');
  assert.ok(appSrc.includes('CardboxDialog') && appSrc.includes('LandmarkDialog'), 'App.tsx 必须挂载卡匣与兴趣点弹窗');

  const emojiRe = /[\u{1F300}-\u{1FAFF}]/u;
  for (const [name, src] of [
    ['CardboxDialog', cardboxSrc],
    ['LandmarkDialog', lmDialogSrc],
    ['EngineConfigDialog', engineSrc],
  ]) {
    assert.equal(emojiRe.test(src), false, `${name} 严禁使用 emoji`);
  }
  void REGION_CATALOG;
  void generateRegionLandmarks;
});
