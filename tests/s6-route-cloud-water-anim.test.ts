import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateRouteStroke } from '../src/domain/routeDraw.ts';
import * as routeDrawMod from '../src/domain/routeDraw.ts';
import { encodeBytes, TERRAIN_TO_CODE } from '../src/domain/worldGen.ts';
import type { RegionMap, WorldMapData } from '../src/types.ts';

const root = resolve(import.meta.dirname, '..');
const readText = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

test('s6 路线支持分多次画成，只有点击擦除才重置', () => {
  const sketchSrc = readText('src/components/Cartography/useRouteSketch.ts');
  assert.ok(
    sketchSrc.includes('routeDraft') && sketchSrc.includes('validPoints'),
    'useRouteSketch 必须接收现有 routeDraft 并从 validPoints 末端续画下一段路线',
  );
  assert.equal(
    /strokeRef\.current\s*=\s*\[\{\s*x:\s*state\.world\.pos\.x,\s*y:\s*state\.world\.pos\.y\s*\},\s*pt\]/.test(sketchSrc),
    false,
    'useRouteSketch 不得每次落笔都强行丢弃既有路线重置为从马车出发的新线段',
  );

  const cartoSrc = readText('src/components/Cartography/CartographyView.tsx');
  assert.equal(
    /if\s*\(hit\)\s*\{[^}]*onRouteDraft\(null\)/s.test(cartoSrc),
    false,
    '点击据点菱形标牌不得清空已绘制的分段路线',
  );

  const appSrc = readText('src/App.tsx');
  assert.equal(
    /else if\s*\(routeDraft\)\s*setRouteDraft\(null\)/.test(appSrc),
    false,
    '按 Escape 键不得静默抹掉草稿路线，必须仅通过点击擦除重置',
  );
});

test('s6 沿主干道自动寻路至已发现村庄：绕开河障并优先沿石砌干道与木桥通行', async () => {
  assert.equal(
    existsSync(resolve(root, 'src/domain/pathfinding.ts')),
    true,
    '缺少沿主干道 A* 自动寻路模块 src/domain/pathfinding.ts',
  );
  const pathMod = await import('../src/domain/pathfinding.ts') as {
    findAutoRoute?: (
      map: RegionMap,
      start: { x: number; y: number },
      target: { x: number; y: number },
      evadeWar?: boolean,
    ) => { x: number; y: number }[];
  };
  assert.equal(typeof pathMod.findAutoRoute, 'function', 'pathfinding.ts 必须导出 findAutoRoute');

  // 构造 24x24 测试区域：x=12 列全为深水河流，仅 y=18 处有跨河木桥，且干道从起点 (4,5) 顺 (4,18)->(18,18)->(18,5) 通往目标村庄
  const w = 24;
  const h = 24;
  const grid = new Uint8Array(w * h).fill(TERRAIN_TO_CODE.wasteland);
  for (let y = 0; y < h; y += 1) {
    grid[y * w + 12] = TERRAIN_TO_CODE.river;
  }
  for (let y = 5; y <= 18; y += 1) {
    grid[y * w + 4] = TERRAIN_TO_CODE.road;
    grid[y * w + 18] = TERRAIN_TO_CODE.road;
  }
  for (let x = 4; x <= 18; x += 1) {
    grid[18 * w + x] = x === 12 ? TERRAIN_TO_CODE.bridge : TERRAIN_TO_CODE.road;
  }
  grid[5 * w + 4] = TERRAIN_TO_CODE.village;
  grid[5 * w + 18] = TERRAIN_TO_CODE.village;

  const map: RegionMap = {
    regionId: 'empire_heart',
    scale: 10,
    worldOffsetX: 0,
    worldOffsetY: 0,
    width: w,
    height: h,
    seed: 123,
    terrainBase64: encodeBytes(grid),
    exploredMaskBase64: encodeBytes(new Uint8Array(Math.ceil((w * h) / 8)).fill(255)),
    gates: [],
    pois: {},
  };

  const route = pathMod.findAutoRoute!(map, { x: 4.5, y: 5.5 }, { x: 18.5, y: 5.5 }, false);
  assert.ok(route.length >= 3, '绕河沿道路自动寻路应返回多段折线路径');
  const evalRes = evaluateRouteStroke(map, route, { performers: [], passengerOrders: [] }, false);
  assert.equal(evalRes.blocked, false, `自动寻路结果必须全程可通行不撞河: ${evalRes.blockReason}`);
  assert.ok(
    route.some(pt => Math.floor(pt.y) === 18 && Math.floor(pt.x) === 12),
    '寻路路径必须经过 y=18 的跨河木桥并沿主干道抵达村庄',
  );
  // 校验道路优先：中段轨迹绝大部分落在道路/桥梁上而非横穿荒野
  const onRoad = route.filter(pt => {
    const t = grid[Math.floor(pt.y) * w + Math.floor(pt.x)];
    return t === TERRAIN_TO_CODE.road || t === TERRAIN_TO_CODE.bridge || t === TERRAIN_TO_CODE.village;
  }).length;
  assert.ok(onRoad / route.length >= 0.75, `寻路应优先沿主干道行走（当前道路占比 ${(onRoad / route.length).toFixed(2)}）`);

  const appSrc = readText('src/App.tsx');
  assert.ok(appSrc.includes('findAutoRoute'), 'App.tsx 自动寻路入口必须调用 findAutoRoute');
});

test('s6 水体周围去除深色像素块边缘，改为柔和浅滩过渡', async () => {
  const painter = await import('../src/components/Cartography/copperplatePainter.ts');
  const w = 16;
  const h = 16;
  const terrain = new Uint8Array(w * h).fill(TERRAIN_TO_CODE.wasteland);
  // 右半侧 x >= 8 为海洋，(8, y) 紧贴海岸线（d=1）
  for (let y = 0; y < h; y += 1) {
    for (let x = 8; x < w; x += 1) {
      terrain[y * w + x] = TERRAIN_TO_CODE.ocean;
    }
  }
  const regionGrid = new Uint8Array(w * h).fill(0);
  const world: WorldMapData = {
    width: w,
    height: h,
    seed: 99,
    terrainBase64: encodeBytes(terrain),
    regionGridBase64: encodeBytes(regionGrid),
    regionBounds: {} as WorldMapData['regionBounds'],
    rivers: [],
    lakes: [],
  };
  const buf = new Uint8ClampedArray(w * h * 4);
  painter.rasterizeWorldCopperplate(world, buf);

  // 检查贴岸水体 (8, 8) 的像素亮度，绝不能是旧版浓黑褐方块 [54, 38, 25]
  const p = (8 * w + 8) * 4;
  const lum = (buf[p]! + buf[p + 1]! + buf[p + 2]!) / 3;
  assert.ok(lum >= 120, `水体紧邻陆地的边缘 (8,8) 不得使用深色像素块（当前亮度 ${lum.toFixed(1)}, rgb=${buf[p]},${buf[p + 1]},${buf[p + 2]}）`);
});

test('s6 迷雾边缘改用蓬松云朵形状，彻底废弃圆圈描边', () => {
  const rendererSrc = readText('src/components/Cartography/mapRenderer.ts');
  const painterSrc = readText('src/components/Cartography/copperplatePainter.ts');

  assert.equal(
    /ctx\.arc\([^)]*Math\.PI\s*\*\s*2\)/.test(painterSrc),
    false,
    'copperplatePainter.ts 不得再在迷雾交界处绘制圆圈 (Math.PI * 2)',
  );
  assert.ok(
    rendererSrc.includes('drawCloudBank') || rendererSrc.includes('bezierCurveTo'),
    'mapRenderer.ts 迷雾交界处必须使用多瓣云朵轮廓函数 drawCloudBank / bezierCurveTo 绘制云朵形状',
  );
  assert.equal(
    /if\s*\(!rev\)\s*\{[\s\S]*?ctx\.arc\(px,\s*py,\s*cr,\s*0,\s*Math\.PI\s*\*\s*2\)/.test(rendererSrc),
    false,
    'mapRenderer.ts 迷雾边界不得使用单一圆形 arc(..., 0, Math.PI * 2) 表现',
  );
});

test('s6 马车移动平滑动画：弧长插值、剩余线段裁剪与 requestAnimationFrame 调度', () => {
  const mod = routeDrawMod as Record<string, unknown>;
  const polylineLength = mod.polylineLength as ((pts: readonly { x: number; y: number }[]) => number) | undefined;
  const sampleAt = mod.samplePolylineAtDistance as ((pts: readonly { x: number; y: number }[], dist: number) => { x: number; y: number }) | undefined;
  const sliceFrom = mod.slicePolylineFromDistance as ((pts: readonly { x: number; y: number }[], dist: number) => { x: number; y: number }[]) | undefined;

  assert.equal(typeof polylineLength, 'function', 'routeDraw.ts 必须导出 polylineLength');
  assert.equal(typeof sampleAt, 'function', 'routeDraw.ts 必须导出 samplePolylineAtDistance');
  assert.equal(typeof sliceFrom, 'function', 'routeDraw.ts 必须导出 slicePolylineFromDistance');

  const pts = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }];
  assert.equal(polylineLength!(pts), 7);
  const mid = sampleAt!(pts, 5);
  assert.ok(Math.abs(mid.x - 3) < 1e-6 && Math.abs(mid.y - 2) < 1e-6, `距离 5 处应插值到 (3, 2)，实际=(${mid.x}, ${mid.y})`);

  const remaining = sliceFrom!(pts, 5);
  assert.equal(remaining.length, 2);
  assert.ok(Math.abs(remaining[0]!.y - 2) < 1e-6 && remaining[1]!.y === 4, '裁剪后剩余线段应从当前动画车队坐标连向终点');

  const appSrc = readText('src/App.tsx');
  assert.ok(appSrc.includes('requestAnimationFrame'), 'App.tsx 必须使用 requestAnimationFrame 驱动马车平滑行军动画');
});
