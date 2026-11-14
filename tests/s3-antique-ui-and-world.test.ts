import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGION_IDS } from '../src/content/regions.ts';
import { CARAVAN_VISION_RADIUS, revealCircleInMask } from '../src/domain/routeDraw.ts';
import * as worldGenMod from '../src/domain/worldGen.ts';
import { act } from '../src/rules/act.ts';
import { createInitialState } from '../src/rules/state.ts';
import type { RegionId } from '../src/types.ts';

const root = resolve(import.meta.dirname, '..');
const readText = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

test('s3 古旧焦边卷角羊皮纸界面：具备离屏斑驳纹理生成器、重度焦褐边缘与右上立体折角 (.vellum-dogear)', () => {
  assert.equal(existsSync(resolve(root, 'src/styles/vellumTexture.ts')), true, '缺少离屏古羊皮纸斑驳纹理生成器 vellumTexture.ts');
  const mainTsx = readText('src/main.tsx');
  assert.ok(mainTsx.includes('vellumTexture'), 'main.tsx 启动时应初始化古羊皮纸斑驳纹理');

  const styles = readText('src/styles/parchment.css');
  assert.ok(styles.includes('--vellum-mottle-tex'), 'parchment.css 应引用 --vellum-mottle-tex 斑驳茶渍纹理');
  assert.ok(styles.includes('.vellum-dogear'), 'parchment.css 应定义右上卷曲折角 .vellum-dogear 样式');
  assert.match(styles, /\.vellum-sheet::before[\s\S]*calc\(100%\s*-\s*\d+px\)/, '羊皮纸右上角应切出真实折角斜口');

  const appTsx = readText('src/App.tsx');
  assert.ok(appTsx.includes('vellum-dogear'), 'App.tsx 主舞台卷轴应渲染右上卷曲折角节点');
});

test('s3 桌面端 100vh 一屏免滚动紧凑布局：锁定视口网格且地图画布采用弹性自适应而非固定 490px 最小高度', () => {
  const styles = readText('src/styles/parchment.css');
  assert.match(styles, /\.app-shell\s*\{[^}]*height:\s*100vh/s, '.app-shell 必须锁定 height: 100vh');
  assert.match(styles, /\.app-shell\s*\{[^}]*overflow:\s*hidden/s, '.app-shell 必须设置 overflow: hidden 杜绝整页滚动条');
  assert.equal(/\.atlas-viewport\s*\{[^}]*min-height:\s*490px/s.test(styles), false, '.atlas-viewport 不得写死 min-height: 490px 撑爆视口');
  assert.match(styles, /\.atlas-viewport\s*\{[^}]*flex:\s*1/s, '.atlas-viewport 应使用 flex: 1 自适应一屏剩余高度');

  const cartoView = readText('src/components/Cartography/CartographyView.tsx');
  assert.ok(cartoView.includes('ResizeObserver'), 'CartographyView 应通过 ResizeObserver 动态同步画布尺寸');
});

test('s3 大篷车专属图标取代夜糖猫耳图标，且地图可视范围内正确裁剪并绘制城市/村寨/大篷车图标', async () => {
  const favicon = readText('public/favicon.svg');
  assert.equal(favicon.toLowerCase().includes('#f4a9c8'), false, 'favicon.svg 不得残留夜糖粉色猫耳图标 (#f4a9c8)');
  assert.ok(favicon.includes('<circle'), 'favicon.svg 应包含大篷车车轮与风灯几何元素');

  assert.equal(existsSync(resolve(root, 'src/components/CaravanCrestIcon.tsx')), true, '缺少大篷车纹章组件 CaravanCrestIcon.tsx');
  const shell = readText('src/components/Shell.tsx');
  assert.ok(shell.includes('CaravanCrestIcon'), 'Shell.tsx 侧边栏徽章必须使用 CaravanCrestIcon');
  const caravanView = readText('src/components/CaravanView.tsx');
  assert.equal(caravanView.includes('夜糖'), false, 'CaravanView.tsx 可见界面文案不得残留「夜糖」字样');

  assert.equal(existsSync(resolve(root, 'src/components/Cartography/mapIcons.ts')), true, '缺少舆图图标模块 mapIcons.ts');
  const mapIcons = await import('../src/components/Cartography/mapIcons.ts');
  const state = createInitialState({ seed: 2026, spawnRegionId: 'empire_heart' });
  const map = state.world.regions.empire_heart.map!;

  // 全区域视口下：出生点村寨可见，而远方迷雾未探明的城市不会提前泄露图标
  const fullVp = { viewX: 0, viewY: 0, viewW: map.width, viewH: map.height, canvasW: 900, canvasH: 600 };
  const initialMarkers = mapIcons.collectVisibleSettlementMarkers(map, state.world.pos, fullVp);
  assert.ok(initialMarkers.some((m: { id: string }) => m.id === state.world.currentPoiId), '出生村寨在可视范围内必须生成图标标记');

  const farCity = Object.values(map.pois).find(
    p => p.kind === 'city' && Math.hypot(p.x - state.world.pos.x, p.y - state.world.pos.y) > CARAVAN_VISION_RADIUS + 8,
  );
  assert.ok(farCity, '区域内应存在尚未探明的远方城郭');
  assert.equal(
    initialMarkers.some((m: { id: string }) => m.id === farCity.id),
    false,
    '迷雾中未探明的远方城郭不得泄露图标',
  );

  // 揭开该城迷雾后：在全区域视口内显现，在偏离该城的局部跟随视口外自动裁剪隐藏
  revealCircleInMask(map, farCity.x, farCity.y, 6);
  const afterReveal = mapIcons.collectVisibleSettlementMarkers(map, state.world.pos, fullVp);
  assert.equal(
    afterReveal.some((m: { id: string; kind: string }) => m.id === farCity.id && m.kind === 'city'),
    true,
    '探明且处于显示范围内的城市必须显示城市图标',
  );

  const farAwayVp = {
    viewX: farCity.x > map.width / 2 ? 0 : Math.max(0, map.width - 30),
    viewY: farCity.y > map.height / 2 ? 0 : Math.max(0, map.height - 30),
    viewW: 24,
    viewH: 24,
    canvasW: 900,
    canvasH: 600,
  };
  const culled = mapIcons.collectVisibleSettlementMarkers(map, state.world.pos, farAwayVp);
  assert.equal(
    culled.some((m: { id: string }) => m.id === farCity.id),
    false,
    '滚出当前显示范围视口外的城市应被裁剪不绘制',
  );

  const rendererSrc = readText('src/components/Cartography/mapRenderer.ts');
  for (const fnName of ['drawCityIcon', 'drawVillageIcon', 'drawCaravanIcon']) {
    assert.ok(rendererSrc.includes(fnName), `mapRenderer.ts 必须调用 ${fnName} 渲染图标`);
  }
});

test('s3 世界地图大陆地貌拟真度：告别中心大圆套小圆，具备高复杂度曲折海岸线、海湾半岛不对称性与蜿蜒水系', () => {
  for (const seed of [2026, 4096, 8848]) {
    const world = worldGenMod.generateWorldMap(seed);
    let landArea = 0;
    let coastPerimeter = 0;
    const sectorMaxReach = new Float32Array(16);

    for (let y = 1; y < world.height - 1; y += 1) {
      for (let x = 1; x < world.width - 1; x += 1) {
        const isLand = worldGenMod.worldTerrainAt(world, x, y) !== 'ocean';
        if (!isLand) continue;
        landArea += 1;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (worldGenMod.worldTerrainAt(world, x + dx, y + dy) === 'ocean') {
            coastPerimeter += 1;
          }
        }
        const ang = Math.atan2(y - 64, x - 64);
        const bucket = Math.min(15, Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16));
        const dist = Math.hypot(x - 64, y - 64);
        if (dist > sectorMaxReach[bucket]!) sectorMaxReach[bucket] = dist;
      }
    }

    const complexity = coastPerimeter / Math.sqrt(Math.max(1, landArea));
    assert.ok(
      complexity >= 8.2,
      `seed=${seed} 海岸线复杂度过低 (${complexity.toFixed(2)})，疑似仍为光滑圆形大饼`,
    );

    const minReach = Math.min(...sectorMaxReach);
    const maxReach = Math.max(...sectorMaxReach);
    assert.ok(
      maxReach - minReach >= 16,
      `seed=${seed} 各方位海岸延伸差过小 (${(maxReach - minReach).toFixed(1)})，缺乏真实海湾内凹与半岛外伸`,
    );

    // 至少 4 条连续不断流的河流
    assert.ok(world.rivers.length >= 4, `seed=${seed} 应至少生成 4 条主要河流`);
    for (const river of world.rivers) {
      assert.ok(river.points.length >= 10, `河流 ${river.id} 长度过短`);
      for (let i = 1; i < river.points.length; i += 1) {
        const step = Math.abs(river.points[i]!.x - river.points[i - 1]!.x) + Math.abs(river.points[i]!.y - river.points[i - 1]!.y);
        assert.ok(step <= 1, `河流 ${river.id} 在第 ${i} 步发生斜向断裂`);
      }
    }
  }
});

test('s3 世界地图疆域划分：彻底告别九宫格，按地理测地线生成错落疆域且真实接壤关口全连通', () => {
  const computeNeighbors = (worldGenMod as Record<string, unknown>).computeWorldNeighbors as
    | ((world: ReturnType<typeof worldGenMod.generateWorldMap>) => Record<RegionId, { direction: string; targetRegionId: RegionId }[]>)
    | undefined;
  assert.equal(typeof computeNeighbors, 'function', 'worldGen.ts 必须导出 computeWorldNeighbors 提取真实省界邻接图');

  const world = worldGenMod.generateWorldMap(2026);
  const areas = new Map<RegionId, number>();
  for (const id of REGION_IDS) areas.set(id, 0);
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const r = worldGenMod.worldRegionAt(world, x, y);
      if (r) areas.set(r, (areas.get(r) ?? 0) + 1);
    }
  }

  const areaVals = [...areas.values()];
  const minArea = Math.min(...areaVals);
  const maxArea = Math.max(...areaVals);
  assert.ok(minArea >= 180, `存在面积过小的畸形地区 (${minArea} 格)`);
  assert.ok(maxArea / minArea >= 1.3, `9 大区面积过于均等 (${maxArea}/${minArea})，缺乏自然大国/半岛差异`);

  // 验证质心并非排列在规则 3×3 九宫格线上：按 Y 排序每 3 个一组，组内 Y 跨度均值应明显大于九宫格水平线
  const centers = REGION_IDS.map(id => world.regionBounds[id]).sort((a, b) => a.centerY - b.centerY);
  const rowSpans = [0, 3, 6].map(i => centers[i + 2]!.centerY - centers[i]!.centerY);
  const maxRowSpan = Math.max(...rowSpans);
  assert.ok(maxRowSpan >= 10, `区域中心仍然接近水平九宫格对齐 (maxRowSpan=${maxRowSpan})`);

  // 验证真实接壤图连通全部 9 大地区
  const adj = computeNeighbors!(world);
  const visited = new Set<RegionId>(['empire_heart']);
  const queue: RegionId[] = ['empire_heart'];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const edge of adj[cur] ?? []) {
      if (!visited.has(edge.targetRegionId)) {
        visited.add(edge.targetRegionId);
        queue.push(edge.targetRegionId);
      }
    }
  }
  assert.equal(visited.size, 9, `9 大地区必须通过陆路/浅滩关口全图连通，当前仅连通 ${visited.size}/9`);

  // 验证跨区行动精确落入对向配对关口
  const state = createInitialState({ seed: 2026, spawnRegionId: 'empire_heart' });
  const originMap = state.world.regions.empire_heart.map!;
  const gate = originMap.gates[0]!;
  const atGate = { ...state, world: { ...state.world, pos: { x: gate.x, y: gate.y } } };
  const crossed = act(atGate, { type: 'crossBorder', targetRegionId: gate.targetRegionId });
  assert.equal(crossed.ok, true, crossed.message);
  const destMap = crossed.state.world.regions[gate.targetRegionId].map!;
  const returnGate = destMap.gates.find(g => g.targetRegionId === 'empire_heart');
  assert.ok(returnGate, '目标区域应当存在返回原区域的配对关口');
  assert.ok(
    Math.hypot(crossed.state.world.pos.x - returnGate.x, crossed.state.world.pos.y - returnGate.y) <= 2,
    '跨过边境后应当精确落在对侧返回关口位置',
  );
});
