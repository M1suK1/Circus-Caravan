import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGION_CATALOG } from '../src/content/regions.ts';
import { BEAST_SPECIES } from '../src/content/species.ts';
import { act } from '../src/rules/act.ts';
import { createInitialState } from '../src/rules/state.ts';
import type { GameAction, SettlementPoi } from '../src/types.ts';

const root = resolve(import.meta.dirname, '..');
const readText = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

test('s7 世界书忠实提炼 docs 设定且灾厄与天使/恶魔仅保留故事蓝图机制参考、不固化固定剧情', async () => {
  assert.equal(
    existsSync(resolve(root, 'src/content/worldbook.ts')),
    true,
    '缺少基于 docs 的世界书模块 src/content/worldbook.ts',
  );
  const wbMod = await import('../src/content/worldbook.ts') as {
    WORLDBOOK_ENTRIES?: { id: string; category: string; title: string; content: string; keywords: string[] }[];
  };
  const entries = wbMod.WORLDBOOK_ENTRIES ?? [];
  assert.ok(entries.length >= 10, `世界书条目过少，当前仅 ${entries.length} 条`);

  const joined = entries.map(e => `${e.title}\n${e.content}`).join('\n');
  for (const requiredConcept of ['神圣圣徽帝国', '穹顶魔导帝国', '赫利俄斯铜沙帝国', '晨曦救赎教', '灰烬铸炉教', '星渊万灵教', '苍灰解放阵线']) {
    assert.ok(joined.includes(requiredConcept), `世界书缺少 docs 核心设定: ${requiredConcept}`);
  }
  // 校验灾厄与隐秘天使/伪装恶魔仅作为蓝图机制参考，不固化具体固定剧情人物
  assert.ok(joined.includes('故事蓝图'), '世界书应注明灾厄与隐秘博弈复用故事蓝图生成机制');
  assert.equal(joined.includes('冯·克劳斯'), false, '世界书不得固化 docs 示例恶魔 NPC 固定剧本人物');
  assert.equal(joined.includes('戈登勋爵'), false, '世界书不得固化 docs 示例恶魔 NPC 固定剧本人物');

  const engineSrc = readText('src/components/Modals/EngineConfigDialog.tsx');
  assert.ok(engineSrc.includes('WORLDBOOK_ENTRIES'), 'EngineConfigDialog 必须接入 WORLDBOOK_ENTRIES 世界书浏览器');
});

test('s7 奇幻生物与魔物娘图鉴整合及地形遭遇概率分配归一化', async () => {
  assert.ok(
    BEAST_SPECIES.length >= 70,
    `整合 docs 图鉴后物种总量应 >= 70（27 奇兽 + 27 魔物娘 + 6 魔王军 + 7 驯化 + 9 精英），实际=${BEAST_SPECIES.length}`,
  );
  assert.equal(
    existsSync(resolve(root, 'src/domain/encounters.ts')),
    true,
    '缺少遭遇概率分配引擎 src/domain/encounters.ts',
  );

  const encMod = await import('../src/domain/encounters.ts') as {
    getTerrainBaseEncounterChance?: (terrain: string) => number;
    computeTerrainEncounterTable?: (
      regionId: string,
      terrain: string,
      timeSlot?: string,
    ) => { speciesId: string; name: string; category: string; probabilityPct: number }[];
  };
  assert.equal(typeof encMod.getTerrainBaseEncounterChance, 'function');
  assert.equal(typeof encMod.computeTerrainEncounterTable, 'function');

  assert.ok(
    encMod.getTerrainBaseEncounterChance!('warzone') > encMod.getTerrainBaseEncounterChance!('road'),
    '交火战区基础遭遇概率应高于安全干道',
  );
  assert.equal(encMod.getTerrainBaseEncounterChance!('ocean'), 0, '深海不可通行格遭遇率为 0');

  const forestTable = encMod.computeTerrainEncounterTable!('ancient_forest', 'forest', 'dusk');
  assert.ok(forestTable.length >= 4, '古老之森密林应匹配多种奇兽与魔物娘');
  const sumPct = forestTable.reduce((s, r) => s + r.probabilityPct, 0);
  assert.ok(Math.abs(sumPct - 100) <= 0.6, `地形遭遇概率之和应归一化为 100%，实际=${sumPct.toFixed(2)}%`);

  const common = forestTable.find(e => e.category === 'beast');
  const elite = forestTable.find(e => e.category === 'elite');
  assert.ok(common && elite, '古老之森密林应同时包含常规奇兽与区域精英');
  assert.ok(common.probabilityPct > elite.probabilityPct * 2, '常规奇兽遭遇概率应显著高于区域 5 星精英');

  const state = createInitialState({ seed: 2026 });
  const extState = state as unknown as { encounteredSpeciesIds?: string[] };
  assert.ok(Array.isArray(extState.encounteredSpeciesIds), '初始存档必须包含 encounteredSpeciesIds 遭遇图鉴列表');
  assert.ok(extState.encounteredSpeciesIds!.length >= 1, '初始状态应记录起手/起点已遇见的生物');
});

test('s7 右键点击地图弹出地形生态信息与曾经遇到的奇幻生物（且不破坏右键拖拽平移）', () => {
  const cartoSrc = readText('src/components/Cartography/CartographyView.tsx');
  assert.ok(cartoSrc.includes('map-terrain-inspect-note'), 'CartographyView 必须包含右键地形勘测信息卡片 #map-terrain-inspect-note');
  assert.ok(cartoSrc.includes('encounteredSpeciesIds'), '右键地形信息卡片必须筛选并展示曾经遇到的奇幻生物');
  assert.ok(cartoSrc.includes('button === 2'), 'CartographyView 必须检测右键轻点（displacement < 6px）弹出地形勘测');
});

test('s7 进入城市和村庄时打开驻地信息并可访问相关建筑（休整/开演/补给/货站/拍卖）', async () => {
  assert.equal(
    existsSync(resolve(root, 'src/domain/settlements.ts')),
    true,
    '缺少城村建筑体系模块 src/domain/settlements.ts',
  );
  const setMod = await import('../src/domain/settlements.ts') as {
    buildSettlementBuildings?: (
      poi: SettlementPoi,
      region: typeof REGION_CATALOG.empire_heart,
    ) => { id: string; kind: string; name: string; actionHint: string }[];
  };
  assert.equal(typeof setMod.buildSettlementBuildings, 'function');

  const state = createInitialState({ seed: 2026, spawnRegionId: 'empire_heart' });
  const map = state.world.regions.empire_heart.map!;
  const city = Object.values(map.pois).find(p => p.kind === 'city')!;
  const village = Object.values(map.pois).find(p => p.kind === 'village')!;

  const cityBuildings = setMod.buildSettlementBuildings!(city, REGION_CATALOG.empire_heart);
  const villageBuildings = setMod.buildSettlementBuildings!(village, REGION_CATALOG.empire_heart);
  assert.ok(cityBuildings.length >= 5, `城郭应至少拥有 5 座可访问建筑，实际=${cityBuildings.length}`);
  assert.ok(villageBuildings.length >= 3, `村庄应至少拥有 3 座可访问建筑，实际=${villageBuildings.length}`);
  assert.ok(cityBuildings.some(b => b.kind === 'stage_square'), '城郭必须包含剧场广场建筑');
  assert.ok(villageBuildings.some(b => b.kind === 'tavern'), '村庄必须包含旅店酒馆建筑');

  // 校验旅店休整与广场搭棚开演动作闭环
  const fatiguedState = {
    ...state,
    gold: 1000,
    performers: state.performers.map(p => ({ ...p, hp: Math.max(20, p.hp - 30), fatigue: 40 })),
  };
  const rested = act(fatiguedState, { type: 'tavernRest', poiId: village.id } as unknown as GameAction);
  assert.equal(rested.ok, true, `旅店休整应当成功: ${rested.message}`);
  assert.ok(rested.state.performers[0]!.fatigue < 40, '旅店休整后应降低全团疲劳度');
  assert.ok(rested.state.gold < 1000, '旅店休整应扣除相应食宿费用');

  const performed = act(rested.state, { type: 'stagePerform', poiId: village.id } as unknown as GameAction);
  assert.equal(performed.ok, true, `聚落广场开演应当成功: ${performed.message}`);
  assert.ok(performed.state.gold > rested.state.gold, '搭棚开演应赚取票房金币收入');

  const scoutSrc = readText('src/components/Modals/ScoutDialog.tsx');
  assert.ok(scoutSrc.includes('buildSettlementBuildings'), 'ScoutDialog 驻地弹窗必须展示并允许点击访问相关建筑');

  const appSrc = readText('src/App.tsx');
  assert.ok(
    /executeRoute[\s\S]*currentPoiId[\s\S]*setModal\(\s*\{\s*type:\s*'scout'/.test(appSrc),
    '大篷车沿路线进入城市或村庄时，App.tsx 应自动打开该驻地信息与建筑面板',
  );
});
