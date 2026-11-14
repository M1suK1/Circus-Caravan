import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BEAST_SPECIES } from '../src/content/species.ts';
import * as routeDrawMod from '../src/domain/routeDraw.ts';
import { encodeBytes, TERRAIN_TO_CODE } from '../src/domain/worldGen.ts';
import { act } from '../src/rules/act.ts';
import { createInitialState } from '../src/rules/state.ts';
import type { Beast, GameAction, RegionMap, RouteEvaluation } from '../src/types.ts';

const root = resolve(import.meta.dirname, '..');
const readText = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

test('s8 地形详情卡改为左下角固定定位且受 max-height 约束不超出屏幕', () => {
  const cartoSrc = readText('src/components/Cartography/CartographyView.tsx');
  assert.ok(cartoSrc.includes('octo-bottom-left-card'), 'CartographyView 地形详情卡必须使用左下角容器类 .octo-bottom-left-card');

  const css = readText('src/styles/parchment.css');
  assert.match(
    css,
    /\.octo-bottom-left-card\s*\{[^}]*left:\s*\d+px[^}]*bottom:[^}]*max-height:[^}]*overflow-y:\s*auto/s,
    '.octo-bottom-left-card 必须固定在左下角并限定 max-height 与内部滚动，防止超出屏幕',
  );
});

test('s8 增量拼接路线（mergeRouteEvaluations）彻底解决分次续画第 3 笔及以上重置问题', () => {
  const mod = routeDrawMod as Record<string, unknown>;
  const mergeRoute = mod.mergeRouteEvaluations as
    | ((base: RouteEvaluation, ext: RouteEvaluation) => RouteEvaluation)
    | undefined;
  assert.equal(typeof mergeRoute, 'function', 'routeDraw.ts 必须导出 mergeRouteEvaluations');

  // 构造极易因浮点漂移误踩河岸的地形：x=10 可通行，x=11 为河流
  const w = 24;
  const h = 24;
  const grid = new Uint8Array(w * h).fill(TERRAIN_TO_CODE.road);
  for (let y = 0; y < h; y += 1) {
    grid[y * w + 11] = TERRAIN_TO_CODE.river;
  }
  const map: RegionMap = {
    regionId: 'empire_heart',
    scale: 10,
    worldOffsetX: 0,
    worldOffsetY: 0,
    width: w,
    height: h,
    seed: 7,
    terrainBase64: encodeBytes(grid),
    exploredMaskBase64: encodeBytes(new Uint8Array(Math.ceil((w * h) / 8)).fill(255)),
    gates: [],
    pois: {},
  };
  const party = { performers: [], passengerOrders: [] };

  // 连续模拟 4 次分笔续画，第 1 笔紧贴河岸 10.999999999999998 极限坐标
  let acc = routeDrawMod.evaluateRouteStroke(map, [{ x: 10.5, y: 2.5 }, { x: 10.999999999999998, y: 6.5 }], party);
  const targets = [
    { x: 10.8, y: 10.5 },
    { x: 10.6, y: 14.5 },
    { x: 10.4, y: 19.5 },
  ];
  for (let i = 0; i < targets.length; i += 1) {
    const tail = acc.validPoints[acc.validPoints.length - 1]!;
    const ext = routeDrawMod.evaluateRouteStroke(map, [tail, targets[i]!], party);
    acc = mergeRoute!(acc, ext);
    assert.equal(acc.blocked, false, `第 ${i + 2} 笔续画不应触发意外拦截或重置`);
    assert.ok(acc.validPoints.length > 4, `第 ${i + 2} 笔续画后有效点列应持续累积`);
  }
  assert.ok(acc.distanceTiles >= 16, `4 次续画后总里程应累计到位，实际=${acc.distanceTiles}`);

  const sketchSrc = readText('src/components/Cartography/useRouteSketch.ts');
  assert.ok(sketchSrc.includes('mergeRouteEvaluations'), 'useRouteSketch 必须采用 mergeRouteEvaluations 冻结前段并增量续画');
});

test('s8 奇兽与魔物娘图鉴完备：全量 84 物种含描述与程序化缺省立绘组件 CreaturePortrait', () => {
  assert.equal(
    existsSync(resolve(root, 'src/components/CreaturePortrait.tsx')),
    true,
    '缺少奇兽与魔物娘程序化缺省立绘组件 CreaturePortrait.tsx',
  );
  assert.equal(
    existsSync(resolve(root, 'src/components/Modals/BestiaryDialog.tsx')),
    true,
    '缺少奇兽魔物娘图鉴弹窗 BestiaryDialog.tsx',
  );

  for (const sp of BEAST_SPECIES) {
    assert.ok(sp.description && sp.description.trim().length >= 8, `物种 ${sp.id} 缺少图鉴描述`);
    assert.ok(sp.category, `物种 ${sp.id} 缺少分类 category`);
  }

  const beastDialogSrc = readText('src/components/Modals/BeastDialog.tsx');
  assert.ok(beastDialogSrc.includes('CreaturePortrait'), 'BeastDialog 必须展示奇兽/魔物娘立绘');
  const suppliesSrc = readText('src/components/SuppliesView.tsx');
  assert.ok(suppliesSrc.includes('CreaturePortrait'), 'SuppliesView 兽笼卡片必须展示奇兽/魔物娘立绘');
  const appSrc = readText('src/App.tsx');
  assert.ok(appSrc.includes('BestiaryDialog'), 'App.tsx 必须挂载奇兽与魔物娘图鉴弹窗 BestiaryDialog');
});

test('s8 宝可梦式属性归类与克制系统 (creatureTaxonomy.ts)', async () => {
  assert.equal(
    existsSync(resolve(root, 'src/domain/creatureTaxonomy.ts')),
    true,
    '缺少宝可梦式属性分类与克制模块 src/domain/creatureTaxonomy.ts',
  );
  const tax = await import('../src/domain/creatureTaxonomy.ts') as {
    ELEMENT_TAXONOMY?: Record<string, { label: string; strongAgainst: string[]; weakTo: string[] }>;
    computeTypeEffectiveness?: (atk: string, def: string) => number;
  };
  assert.ok(tax.ELEMENT_TAXONOMY && Object.keys(tax.ELEMENT_TAXONOMY).length === 6, '应完整覆盖 6 大元素属性归类');
  assert.equal(typeof tax.computeTypeEffectiveness, 'function');

  assert.equal(tax.computeTypeEffectiveness!('flame', 'frost'), 2, '炽焰克制冰霜应为 2×');
  assert.equal(tax.computeTypeEffectiveness!('frost', 'flame'), 0.5, '冰霜打炽焰应为 0.5× 抵抗');
  assert.equal(tax.computeTypeEffectiveness!('spore', 'iron'), 2, '草孢克制钢机应为 2×');
});

test('s8 宝可梦式性格与特性系统及捕获随机性检定 (naturesAndCapture.ts + attemptWildCapture)', async () => {
  assert.equal(
    existsSync(resolve(root, 'src/domain/naturesAndCapture.ts')),
    true,
    '缺少宝可梦式性格特性与随机捕捉模块 src/domain/naturesAndCapture.ts',
  );
  const natMod = await import('../src/domain/naturesAndCapture.ts') as {
    CREATURE_NATURES?: { id: string; name: string; catchRateMult: number }[];
    CREATURE_ABILITIES?: { id: string; name: string; catchBonus: number }[];
    computeCaptureProbability?: (input: {
      captureDifficulty: number;
      natureId: string;
      abilityId: string;
      hasTamer: boolean;
      useBait?: boolean;
    }) => number;
  };

  assert.ok((natMod.CREATURE_NATURES?.length ?? 0) >= 10, '至少应定义 10 种以上宝可梦式性格');
  assert.ok((natMod.CREATURE_ABILITIES?.length ?? 0) >= 10, '至少应定义 10 种以上宝可梦式特性');
  assert.equal(typeof natMod.computeCaptureProbability, 'function');

  const gentleRate = natMod.computeCaptureProbability!({
    captureDifficulty: 50,
    natureId: 'gentle',
    abilityId: 'oblivious',
    hasTamer: true,
    useBait: true,
  });
  const stubbornRate = natMod.computeCaptureProbability!({
    captureDifficulty: 50,
    natureId: 'adamant',
    abilityId: 'run_away',
    hasTamer: false,
    useBait: false,
  });
  assert.ok(gentleRate > stubbornRate + 0.15, `温顺+乐天+驯兽师+诱饵捕获率 (${gentleRate}) 应明显高于固执+逃跑 (${stubbornRate})`);

  // 验证真实捕捉随机性与性格/特性随机生成（不同随机数应产生捕获成功与逃脱两种结果，成功时入笼并带随机性格/特性）
  const baseState = createInitialState({ seed: 2026 });
  baseState.supplies.tamingNets = 20;
  baseState.supplies.props = 20;
  // 扩建兽笼上限以便测试多次捕获
  baseState.caravan.maxCageSlots = 10;

  let wins = 0;
  let losses = 0;
  const seenNatures = new Set<string>();
  const seenAbilities = new Set<string>();

  for (let rollSeed = 1; rollSeed <= 24; rollSeed += 1) {
    const res = act(baseState, {
      type: 'attemptWildCapture',
      speciesId: 'crest_bellfinch',
      useBait: false,
      rollSeed,
    } as unknown as GameAction);
    assert.equal(res.ok, true, `捕猎指令应合法执行（消耗网并掷骰）: ${res.message}`);
    assert.equal(res.state.supplies.tamingNets, 19, '每次尝试捕捉应消耗 1 张麻醉捕获网');
    if (res.state.beasts.length > baseState.beasts.length) {
      wins += 1;
      const caught = res.state.beasts[res.state.beasts.length - 1] as Beast & { natureId?: string; abilityId?: string };
      assert.ok(caught.natureId, '捕获入笼个体必须带有性格 natureId');
      assert.ok(caught.abilityId, '捕获入笼个体必须带有特性 abilityId');
      seenNatures.add(caught.natureId!);
      seenAbilities.add(caught.abilityId!);
    } else {
      losses += 1;
    }
  }
  assert.ok(wins >= 3 && losses >= 1, `捕捉必须具备随机性（既有成功也有逃脱），当前 wins=${wins}, losses=${losses}`);
  assert.ok(seenNatures.size >= 3, '多次捕捉应随机产出多种不同性格');
  assert.ok(seenAbilities.size >= 3, '多次捕捉应随机产出多种不同特性');
});
