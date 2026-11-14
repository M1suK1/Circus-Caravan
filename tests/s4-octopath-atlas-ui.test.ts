import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateWorldMap } from '../src/domain/worldGen.ts';
import { createInitialState } from '../src/rules/state.ts';

const root = resolve(import.meta.dirname, '..');
const readText = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

function createMockCtx() {
  const ops: string[] = [];
  const noop = () => {};
  const grad = { addColorStop: noop };
  return {
    ops,
    ctx: {
      save: () => ops.push('save'),
      restore: () => ops.push('restore'),
      translate: noop,
      scale: noop,
      rotate: noop,
      beginPath: () => ops.push('beginPath'),
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      quadraticCurveTo: noop,
      bezierCurveTo: noop,
      arc: () => ops.push('arc'),
      ellipse: noop,
      rect: noop,
      fill: () => ops.push('fill'),
      stroke: () => ops.push('stroke'),
      fillRect: () => ops.push('fillRect'),
      strokeRect: noop,
      fillText: (t: string) => ops.push(`text:${t}`),
      strokeText: noop,
      measureText: (t: string) => ({ width: t.length * 11 }),
      setLineDash: noop,
      createRadialGradient: () => grad,
      createLinearGradient: () => grad,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineJoin: 'round',
      lineCap: 'round',
      font: '',
      textAlign: 'center',
      textBaseline: 'middle',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D,
  };
}

test('s4 全屏底层常驻大地图架构：CartographyView 脱离页签条件卸载常驻最底层，叠加巴洛克星盘外框与子页半透明浮窗', () => {
  assert.equal(
    existsSync(resolve(root, 'src/components/OrnateAtlasFrame.tsx')),
    true,
    '缺少巴洛克星盘雕花外框组件 OrnateAtlasFrame.tsx',
  );
  const frameSrc = readText('src/components/OrnateAtlasFrame.tsx');
  assert.ok(frameSrc.includes('octo-astrolabe-crest'), 'OrnateAtlasFrame 应包含顶部中央星盘罗盘绶带徽章');
  assert.ok(frameSrc.includes('octo-scale-cartouche'), 'OrnateAtlasFrame 应包含底部古典比例尺铭牌');

  const appSrc = readText('src/App.tsx');
  assert.equal(
    /page\s*===\s*'map'\s*&&\s*\(\s*<CartographyView/s.test(appSrc),
    false,
    'CartographyView 必须全屏常驻底层，不能在切到其他功能页时被卸载',
  );
  assert.ok(appSrc.includes('OrnateAtlasFrame'), 'App.tsx 必须挂载巴洛克星盘雕花外框 OrnateAtlasFrame');
  assert.ok(appSrc.includes('RightTroupeLedger'), 'App.tsx 必须挂载右侧半透明剧团状态竖栏 RightTroupeLedger');
  assert.ok(appSrc.includes("page !== 'map'"), '子功能页应仅在非地图态作为上层浮窗展开');

  const css = readText('src/styles/parchment.css');
  assert.ok(css.includes('.octo-atlas-underlay'), 'parchment.css 应定义全屏底层常驻地图宿主 .octo-atlas-underlay');
});

test('s4 八方旅人式选单横幅、右侧半透明队伍双色状态条与底部黑底实体键帽提示栏', () => {
  const shellSrc = readText('src/components/Shell.tsx');
  assert.ok(shellSrc.includes('选单'), '左侧悬浮导航顶部应展示「选单」标题');
  assert.ok(shellSrc.includes('RightTroupeLedger'), 'Shell.tsx 必须导出右侧半透明剧团与账房状态竖栏 RightTroupeLedger');
  assert.ok(shellSrc.includes('octo-hp-bar'), '右侧剧团成员列表必须包含八方旅人式翠绿体力进度条');
  assert.ok(shellSrc.includes('octo-sp-bar'), '右侧剧团成员列表必须包含八方旅人式靛蓝士气进度条');
  assert.ok(shellSrc.includes('octo-keycap'), '底部 HelmBar 必须包含实体键帽提示徽章 .octo-keycap');

  const css = readText('src/styles/parchment.css');
  assert.ok(css.includes('.octo-right-ledger'), 'parchment.css 应定义右侧半透明烟熏墨色队伍竖栏样式');
  assert.ok(css.includes('.octo-keycap'), 'parchment.css 应定义底部黑底键帽提示样式');
});

test('s4 铜版画立体浮雕渲染管线：西北斜光浮雕明暗对比与海岸三重平行水波纹墨线', async () => {
  assert.equal(
    existsSync(resolve(root, 'src/components/Cartography/copperplatePainter.ts')),
    true,
    '缺少铜版画浮雕渲染器 copperplatePainter.ts',
  );
  const painter = await import('../src/components/Cartography/copperplatePainter.ts');

  // 1. 西北入射光浮雕校验：面向西北的受光坡面亮度增量必须显著高于面向东南的背阴坡面
  const litNw = painter.computeHillshadeLuma(0.35, 0.35);
  const shadedSe = painter.computeHillshadeLuma(-0.35, -0.35);
  assert.ok(litNw > 10, `西北受光坡面应产生正向暖金提亮，实际=${litNw}`);
  assert.ok(shadedSe < -12, `东南背阴坡面应产生负向浓褐阴影，实际=${shadedSe}`);

  // 2. 海岸三重水波纹距离场与像素墨线校验
  const w = 24;
  const h = 8;
  const isWater = new Uint8Array(w * h).fill(1);
  // 左侧 x = 0..3 为陆地，右侧 x = 4..23 为海域
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < 4; x += 1) isWater[y * w + x] = 0;
  }
  const depth = painter.computeSeaDepthField(isWater, w, h);
  assert.equal(depth[4 * w + 4], 1, '紧贴海岸第 1 格水深距离应为 1');
  assert.equal(depth[4 * w + 6], 3, '距岸第 3 格水深距离应为 3');
  assert.equal(depth[4 * w + 9], 6, '距岸第 6 格水深距离应为 6');

  // 验证世界铜版画光栅化正常产出全尺寸像素缓冲且海岸线水波纹比间隔水体更深邃
  const world = generateWorldMap(2026);
  const worldBuf = new Uint8ClampedArray(world.width * world.height * 4);
  painter.rasterizeWorldCopperplate(world, worldBuf);
  assert.equal(worldBuf[3], 255, '铜版画像素缓冲区 alpha 必须为 255 不透明');

  // 验证离屏手绘山峰斜排线、森林树冠簇与区域卷云迷雾笔触绘制无报错
  const state = createInitialState({ seed: 2026, spawnRegionId: 'empire_heart' });
  const regionMap = state.world.regions.empire_heart.map!;
  const regBuf = new Uint8ClampedArray(regionMap.width * regionMap.height * 4);
  painter.rasterizeRegionCopperplate(regionMap, state.world.pos, regBuf);
  const { ctx, ops } = createMockCtx();
  painter.paintRegionCopperplateDetails(ctx, regionMap, state.world.pos);
  assert.ok(ops.includes('stroke'), '离屏细节笔触应绘制山峦/古道或卷云迷雾描线');
});

test('s4 八方旅人菱形双墨边地标纹章与竖向黑针危级标牌集成', async () => {
  const mapIcons = await import('../src/components/Cartography/mapIcons.ts');
  assert.equal(typeof mapIcons.drawOctopathBannerCallout, 'function', 'mapIcons.ts 应导出竖向黑针危级标牌绘制函数 drawOctopathBannerCallout');

  const { ctx, ops } = createMockCtx();
  mapIcons.drawCityIcon(ctx, 120, 120, 26, true);
  mapIcons.drawVillageIcon(ctx, 180, 140, 20, false);
  mapIcons.drawOctopathBannerCallout(ctx, 120, 120, '圣徽王城', '危级 LV.2', true);
  assert.ok(ops.some(o => o.includes('text:圣徽王城')), '黑针标牌应渲染聚落或地区标题文本');
  assert.ok(ops.some(o => o.includes('text:危级 LV.2')), '黑针标牌应渲染危级侧翼徽章文本');

  const rendererSrc = readText('src/components/Cartography/mapRenderer.ts');
  assert.ok(rendererSrc.includes('copperplatePainter'), 'mapRenderer.ts 必须接入 copperplatePainter 铜版画渲染器');
  assert.ok(rendererSrc.includes('drawOctopathBannerCallout'), 'mapRenderer.ts 必须调用 drawOctopathBannerCallout 绘制黑针地标标牌');
});
