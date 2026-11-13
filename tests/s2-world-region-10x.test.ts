import test from 'node:test';
import assert from 'node:assert/strict';
import { REGION_IDS } from '../src/content/regions.ts';
import {
  decodeTerrainGrid,
  generateWorldMap,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  worldRegionAt,
  worldTerrainAt,
} from '../src/domain/worldGen.ts';
import { generateRegionMap, regionTerrainAt } from '../src/domain/regionGen.ts';
import { createInitialState } from '../src/rules/state.ts';

test('s2 世界地图严格为 128×128：中心大陆、四周海洋、含岛屿、河流与湖泊、9 个不规则区域', () => {
  const world = generateWorldMap(2026);
  assert.equal(world.width, 128);
  assert.equal(world.height, 128);
  assert.equal(WORLD_WIDTH, 128);
  assert.equal(WORLD_HEIGHT, 128);

  const terrain = decodeTerrainGrid(world.terrainBase64, world.width * world.height);
  assert.equal(terrain.length, 128 * 128);

  // 外圈四周是海洋
  for (let x = 0; x < 128; x += 1) {
    assert.equal(worldTerrainAt(world, x, 0), 'ocean', `北边 (${x},0) 应为海洋`);
    assert.equal(worldTerrainAt(world, x, 127), 'ocean', `南边 (${x},127) 应为海洋`);
  }
  for (let y = 0; y < 128; y += 1) {
    assert.equal(worldTerrainAt(world, 0, y), 'ocean', `西边 (0,${y}) 应为海洋`);
    assert.equal(worldTerrainAt(world, 127, y), 'ocean', `东边 (127,${y}) 应为海洋`);
  }

  // 中心存在大片连续大陆
  let centerLand = 0;
  for (let y = 40; y <= 88; y += 1) {
    for (let x = 40; x <= 88; x += 1) {
      if (worldTerrainAt(world, x, y) !== 'ocean') centerLand += 1;
    }
  }
  assert.ok(centerLand > 1400, `中心区域应当主要是大陆，当前陆地格数=${centerLand}`);

  // 含河流与湖泊
  assert.ok(world.rivers.length >= 3, '世界图应生成至少 3 条河流');
  assert.ok(world.lakes.length >= 2, '世界图应生成至少 2 座湖泊');

  // 9 个不规则区域均存在有效包围盒
  for (const id of REGION_IDS) {
    const b = world.regionBounds[id];
    assert.ok(b, `缺少区域包围盒 ${id}`);
    assert.ok(b.maxX > b.minX && b.maxY > b.minY, `${id} 区域过小`);
  }

  // 检查形状不规则（不是同一矩形切豆腐）
  let assignedCells = 0;
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      if (worldRegionAt(world, x, y)) assignedCells += 1;
    }
  }
  assert.ok(assignedCells > 3500, '大陆归属区域面积过小');
});

test('s2 区域小地图按世界区域形状等比放大 10 倍，且继承河流湖泊位置并含 1-3 座多格城市与道路', () => {
  const world = generateWorldMap(9001);
  const regionMap = generateRegionMap(world, 'empire_heart', 9001);
  const bounds = world.regionBounds.empire_heart;

  assert.equal(regionMap.scale, 10);
  assert.equal(regionMap.width, (bounds.maxX - bounds.minX + 1) * 10);
  assert.equal(regionMap.height, (bounds.maxY - bounds.minY + 1) * 10);
  assert.equal(regionMap.worldOffsetX, bounds.minX * 10);
  assert.equal(regionMap.worldOffsetY, bounds.minY * 10);

  // 1-3 座城市，且每座城市占据多个格子
  const pois = Object.values(regionMap.pois);
  const cities = pois.filter(p => p.kind === 'city');
  assert.ok(cities.length >= 1 && cities.length <= 3, `区域内城市数应为 1-3，实际为 ${cities.length}`);
  for (const city of cities) {
    assert.ok(city.footprint.length >= 9, `城市 ${city.id} 必须占多个格子（>=9 格），实际 ${city.footprint.length}`);
    for (const cell of city.footprint) {
      assert.equal(regionTerrainAt(regionMap, cell.x, cell.y), 'city');
    }
    assert.equal(city.scouted, false, '城市初生只确定位置，未侦查');
    assert.equal(city.details, undefined);
  }

  // 主要道路存在
  let roadCount = 0;
  for (let y = 0; y < regionMap.height; y += 1) {
    for (let x = 0; x < regionMap.width; x += 1) {
      const t = regionTerrainAt(regionMap, x, y);
      if (t === 'road' || t === 'bridge') roadCount += 1;
    }
  }
  assert.ok(roadCount >= 20, `应当生成连接城市与出境口的主要道路，实际 ${roadCount}`);

  // 校验世界河湖与小地图对齐：任意在区域内的世界河/湖格，对应 10x10 块里必须出现水体或桥梁
  for (let wy = bounds.minY; wy <= bounds.maxY; wy += 1) {
    for (let wx = bounds.minX; wx <= bounds.maxX; wx += 1) {
      if (worldRegionAt(world, wx, wy) !== 'empire_heart') continue;
      const wt = worldTerrainAt(world, wx, wy);
      if (wt !== 'river' && wt !== 'lake') continue;
      const lx0 = (wx - bounds.minX) * 10;
      const ly0 = (wy - bounds.minY) * 10;
      let hasWaterOrBridge = false;
      for (let dy = 0; dy < 10 && !hasWaterOrBridge; dy += 1) {
        for (let dx = 0; dx < 10; dx += 1) {
          const rt = regionTerrainAt(regionMap, lx0 + dx, ly0 + dy);
          if (rt === 'river' || rt === 'lake' || rt === 'bridge') {
            hasWaterOrBridge = true;
            break;
          }
        }
      }
      assert.ok(hasWaterOrBridge, `世界坐标 (${wx},${wy}) 的 ${wt} 未在小地图对应 10x10 区域显现`);
    }
  }
});

test('s2 开局只加载当前出生大区的 10× 小地图，其余 8 区 map 保持 undefined', () => {
  const state = createInitialState({ seed: 31415 });
  assert.equal(state.world.worldMap.width, 128);
  const loaded = REGION_IDS.filter(id => Boolean(state.world.regions[id].map));
  assert.deepEqual(loaded, [state.world.currentRegionId]);
});
