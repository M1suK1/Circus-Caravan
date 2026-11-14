import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateRouteStroke } from '../src/domain/routeDraw.ts';
import { encodeBytes, TERRAIN_TO_CODE } from '../src/domain/worldGen.ts';
import { act } from '../src/rules/act.ts';
import { createInitialState } from '../src/rules/state.ts';
import type { GameAction, RegionMap } from '../src/types.ts';

const root = resolve(import.meta.dirname, '..');
const readText = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

test('s5 大陆全图与疆域底图像素锐化：彻底禁用底图双线性插值模糊 (imageSmoothingEnabled = false)', () => {
  const rendererSrc = readText('src/components/Cartography/mapRenderer.ts');
  assert.equal(
    rendererSrc.includes('imageSmoothingEnabled = true'),
    false,
    'mapRenderer.ts 不得开启 imageSmoothingEnabled = true 糊化 128×128 大陆像素',
  );
  assert.equal(
    /imageSmoothingEnabled\s*=\s*vp\.viewW/.test(rendererSrc),
    false,
    '疆域地图底图不得按 viewW 开启平滑插值模糊像素格',
  );
  const falseMatches = rendererSrc.match(/imageSmoothingEnabled\s*=\s*false/g) ?? [];
  assert.ok(falseMatches.length >= 2, '世界全图与疆域图底图贴图均须强制 imageSmoothingEnabled = false');
});

test('s5 疆域全览到跟随车队支持滚轮定点无级缩放与自由相机锚定', async () => {
  const renderer = await import('../src/components/Cartography/mapRenderer.ts') as Record<string, unknown>;
  const computeViewport = renderer.computeViewport as (
    state: ReturnType<typeof createInitialState>,
    zoom: 'world' | 'region' | 'follow',
    canvasW: number,
    canvasH: number,
    camera?: { zoomScale?: number; centerX?: number; centerY?: number },
  ) => { viewX: number; viewY: number; viewW: number; viewH: number; canvasW: number; canvasH: number };
  const mapToCanvasPx = renderer.mapToCanvasPx as (
    mx: number,
    my: number,
    vp: ReturnType<typeof computeViewport>,
  ) => { px: number; py: number };
  const zoomRegionAroundCursor = renderer.zoomRegionAroundCursor as
    | ((
        state: ReturnType<typeof createInitialState>,
        currentVp: ReturnType<typeof computeViewport>,
        cursorPx: number,
        cursorPy: number,
        nextZoomScale: number,
      ) => { zoomScale: number; centerX: number; centerY: number })
    | undefined;

  assert.equal(typeof zoomRegionAroundCursor, 'function', 'mapRenderer.ts 应导出以光标为中心的无级缩放函数 zoomRegionAroundCursor');

  const state = createInitialState({ seed: 2026, spawnRegionId: 'empire_heart' });
  const map = state.world.regions.empire_heart.map!;
  const vp1 = computeViewport(state, 'region', 1600, 900, { zoomScale: 1 });
  const vp25 = computeViewport(state, 'region', 1600, 900, { zoomScale: 2.5, centerX: map.width / 2, centerY: map.height / 2 });
  const vp60 = computeViewport(state, 'region', 1600, 900, { zoomScale: 6.0, centerX: map.width / 2, centerY: map.height / 2 });

  assert.ok(vp1.viewW > vp25.viewW && vp25.viewW > vp60.viewW, `缩放倍率增大时可视宽度应连续单调收窄: ${vp1.viewW} -> ${vp25.viewW} -> ${vp60.viewW}`);
  assert.ok(vp1.viewH > vp25.viewH && vp25.viewH > vp60.viewH, `缩放倍率增大时可视高度应连续单调收窄: ${vp1.viewH} -> ${vp25.viewH} -> ${vp60.viewH}`);

  // 验证光标定点缩放：地图内部锚点在缩放前后保持在同一屏幕像素处
  const anchorTile = { x: map.width * 0.52, y: map.height * 0.48 };
  const cursorPx = mapToCanvasPx(anchorTile.x, anchorTile.y, vp25);
  const nextCam = zoomRegionAroundCursor!(state, vp25, cursorPx.px, cursorPx.py, 4.2);
  const vp42 = computeViewport(state, 'region', 1600, 900, nextCam);
  const afterPx = mapToCanvasPx(anchorTile.x, anchorTile.y, vp42);
  assert.ok(
    Math.hypot(afterPx.px - cursorPx.px, afterPx.py - cursorPx.py) < 1.0,
    '滚轮定点缩放后光标所指地图格不得发生屏幕跳变',
  );

  const cartoSrc = readText('src/components/Cartography/CartographyView.tsx');
  assert.ok(cartoSrc.includes('onWheel'), 'CartographyView 必须绑定鼠标滚轮无级缩放事件 onWheel');
  assert.ok(cartoSrc.includes('map-zoom-in') && cartoSrc.includes('map-zoom-out'), 'CartographyView 应提供缩放加减控制按钮');
});

test('s5 角色详情界面对标 night-sugar-office：左 38% 全身立绘舞台 + 右 62% 多标签角色档案与立绘替换', () => {
  const dialogSrc = readText('src/components/Modals/PerformerDialog.tsx');
  assert.ok(dialogSrc.includes('character-dossier'), 'PerformerDialog 必须使用 .character-dossier 双栏档案骨架');
  assert.ok(dialogSrc.includes('dossier-art'), '左侧必须包含 .dossier-art 全高立绘舞台');
  assert.ok(dialogSrc.includes('portrait-orbit'), '左侧立绘舞台应包含同心星轨环 .portrait-orbit');
  assert.ok(dialogSrc.includes('dossier-seal'), '左侧立绘舞台应包含巡演印章 .dossier-seal');
  assert.ok(dialogSrc.includes('variant="full"'), '左侧必须渲染全身立绘 variant="full"');
  assert.ok(dialogSrc.includes('dossier-content'), '右侧必须包含 .dossier-content 角色信息区');
  assert.ok(dialogSrc.includes('dossier-tabs'), '右侧必须包含 .dossier-tabs 多标签栏');
  assert.ok(dialogSrc.includes('performer-export-card'), '右侧姓名栏应支持导出角色卡按钮 #performer-export-card');

  const css = readText('src/styles/parchment.css');
  assert.match(css, /\.character-dossier\s*\{[^}]*grid-template-columns:/s, 'parchment.css 应定义 .character-dossier 左右分栏网格');

  const state = createInitialState({ seed: 42 });
  const perfId = state.performers[0]!.id;
  const res = act(state, {
    type: 'setPerformerPortrait',
    performerId: perfId,
    portrait: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  } as unknown as GameAction);
  assert.equal(res.ok, true, 'act 应支持 setPerformerPortrait 更新演员全身立绘');
  assert.ok(res.state.performers[0]!.portrait.startsWith('data:image/png;base64,'));
});

test('s5 根治地图划线偏移与假红线：格内右半侧紧贴河岸不误判落水、斜穿单格木桥畅通、无桥宽河准确拦截', () => {
  const w = 20;
  const h = 20;
  const grid = new Uint8Array(w * h).fill(TERRAIN_TO_CODE.wasteland);
  // 第 10 列 [10.0, 11.0) 为石砌道路，第 11..12 列 [11.0, 13.0) 为深水河流
  for (let y = 0; y < h; y += 1) {
    grid[y * w + 10] = TERRAIN_TO_CODE.road;
    grid[y * w + 11] = TERRAIN_TO_CODE.river;
    grid[y * w + 12] = TERRAIN_TO_CODE.river;
  }
  // 在 y = 10..11 处架设四邻接折线木桥：(10,10) -> (11,10) -> (11,11) -> (12,11) -> (13,11)
  grid[10 * w + 11] = TERRAIN_TO_CODE.bridge;
  grid[11 * w + 11] = TERRAIN_TO_CODE.bridge;
  grid[11 * w + 12] = TERRAIN_TO_CODE.bridge;

  const syntheticMap: RegionMap = {
    regionId: 'empire_heart',
    scale: 10,
    worldOffsetX: 0,
    worldOffsetY: 0,
    width: w,
    height: h,
    seed: 1,
    terrainBase64: encodeBytes(grid),
    exploredMaskBase64: encodeBytes(new Uint8Array(Math.ceil((w * h) / 8)).fill(255)),
    gates: [],
    pois: {},
  };
  const dummyParty = { performers: [], passengerOrders: [] };

  // 1. 沿第 10 列道路右半边 x = 10.85 纵向划线（视觉完全在道路像素内，紧邻 x=11 河流）
  const edgeRoadEval = evaluateRouteStroke(
    syntheticMap,
    [{ x: 10.85, y: 2.5 }, { x: 10.85, y: 8.5 }],
    dummyParty,
  );
  assert.equal(edgeRoadEval.blocked, false, `在可通行道路格右半边 (x=10.85) 划线不得误触隔壁 x=11 河流变红: ${edgeRoadEval.blockReason}`);

  // 2. 斜向跨过四邻接单格木桥 (10.5, 10.5) -> (12.5, 11.5)，轻微擦过格角仍应顺畅通行
  const bridgeEval = evaluateRouteStroke(
    syntheticMap,
    [{ x: 10.5, y: 10.5 }, { x: 12.5, y: 11.5 }, { x: 13.5, y: 11.5 }],
    dummyParty,
  );
  assert.equal(bridgeEval.blocked, false, `斜向划过单格折线木桥时不应因像素角点擦边而误判落水: ${bridgeEval.blockReason}`);

  // 3. 在无桥处 (y = 4.5) 直接横穿宽河 (9.5 -> 14.5) 依然必须可靠阻断并标红
  const riverBlockEval = evaluateRouteStroke(
    syntheticMap,
    [{ x: 9.5, y: 4.5 }, { x: 14.5, y: 4.5 }],
    dummyParty,
  );
  assert.equal(riverBlockEval.blocked, true, '直接横穿无桥深水河道必须保持红线拦截');

  // 4. 验证初始车队坐标对齐格心 (.5) 且大篷车渲染不再附加横向视觉偏移 wagonOffsetX
  const init = createInitialState({ seed: 99, spawnRegionId: 'empire_heart' });
  assert.equal(init.world.pos.x % 1, 0.5, '初始车队 X 坐标应对齐格心 (+0.5)');
  assert.equal(init.world.pos.y % 1, 0.5, '初始车队 Y 坐标应对齐格心 (+0.5)');
  const rendererSrc = readText('src/components/Cartography/mapRenderer.ts');
  assert.equal(rendererSrc.includes('wagonOffsetX'), false, '大篷车图标必须严格画在真实逻辑坐标中心，禁止附加虚假视觉偏移');
});
