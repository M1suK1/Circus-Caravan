import test from 'node:test';
import assert from 'node:assert/strict';
import { REGION_CATALOG, REGION_IDS } from '../src/content/regions.ts';
import {
  fallbackSettlementDetails,
  generateRegionMap,
  pickRandomSpawnRegion,
  surroundingTerrainsOf,
} from '../src/domain/regionGen.ts';
import { act } from '../src/rules/act.ts';
import { createInitialState } from '../src/rules/state.ts';

test('s1 9 大奇幻地区目录完整，且包含人类帝国/魔法都市/魔王城/古老之森等，邻接关系双向对称', () => {
  assert.equal(REGION_IDS.length, 9);
  for (const required of ['empire_heart', 'arcane_city', 'demon_realm', 'ancient_forest'] as const) {
    assert.ok(REGION_CATALOG[required], `缺少核心奇幻地区: ${required}`);
  }
  const opp = { north: 'south', south: 'north', east: 'west', west: 'east' } as const;
  for (const id of REGION_IDS) {
    const region = REGION_CATALOG[id];
    assert.ok(region.neighbors.length >= 2, `${id} 至少应接壤 2 个相邻区域`);
    for (const edge of region.neighbors) {
      const target = REGION_CATALOG[edge.targetRegionId];
      assert.ok(target, `${id} 指向不存在的邻区 ${edge.targetRegionId}`);
      const back = target.neighbors.find(n => n.targetRegionId === id);
      assert.ok(back && back.direction === opp[edge.direction], `${id} <-> ${edge.targetRegionId} 方位不对称`);
    }
  }
});

test('s1 开局支持随机出生点，且严格只生成当前所在区域小地图（其余 8 区 map 为 undefined）', () => {
  const spawns = new Set<string>();
  for (let seed = 101; seed <= 140; seed += 1) {
    spawns.add(pickRandomSpawnRegion(seed));
  }
  assert.ok(spawns.size >= 4, '不同随机种子应当能落在不同的出生大区');

  const state = createInitialState({ seed: 2026 });
  const loaded = REGION_IDS.filter(id => Boolean(state.world.regions[id].map));
  assert.deepEqual(loaded, [state.world.currentRegionId], '开局必须只加载当前出生大区小地图');

  for (const id of REGION_IDS) {
    if (id !== state.world.currentRegionId) {
      assert.equal(state.world.regions[id].map, undefined, `未出境大区 ${id} 不得提前生成小地图`);
    }
  }
});

test('s1 小地图程序化生成：具备明确边界、出境口、多种地形，且道路连通所有聚落与边界门', () => {
  const map = generateRegionMap('ancient_forest', 777);
  assert.equal(map.width, 18);
  assert.equal(map.height, 12);
  assert.equal(map.tiles.length, 18 * 12);

  // 外圈全部为 boundary 或 border_gate
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1) {
        const tile = map.tiles[y * map.width + x]!;
        assert.ok(tile.terrain === 'boundary' || tile.terrain === 'border_gate', `边界 (${x},${y}) 非边界类型: ${tile.terrain}`);
      }
    }
  }

  // 每个邻区都在边界上有对应的 border_gate
  const expectedNeighbors = REGION_CATALOG.ancient_forest.neighbors;
  assert.equal(map.gates.length, expectedNeighbors.length);
  for (const gate of map.gates) {
    const tile = map.tiles[gate.y * map.width + gate.x]!;
    assert.equal(tile.terrain, 'border_gate');
    assert.equal(tile.gateToRegionId, gate.targetRegionId);
  }

  // 包含多种地形（荒地/道路/城市/村庄/沼泽等）
  const terrains = new Set(map.tiles.map(t => t.terrain));
  assert.ok(terrains.has('road'), '应生成道路');
  assert.ok(terrains.has('city'), '应生成城市');
  assert.ok(terrains.has('village'), '应生成村庄');
  assert.ok(terrains.has('forest') || terrains.has('swamp') || terrains.has('wasteland'), '应生成生态地形');

  // BFS 检验所有聚落和出境口从任一聚落出发皆可达（不穿过 boundary/mountain/water）
  const pois = Object.values(map.pois);
  assert.ok(pois.length >= 4, '每个地区至少应生成 4 个城市/村庄点位');
  const start = pois[0]!;
  const blocked = new Set(['boundary', 'mountain', 'water']);
  const visited = new Set<string>([`${start.x},${start.y}`]);
  const queue = [{ x: start.x, y: start.y }];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      const tile = map.tiles[ny * map.width + nx]!;
      if (blocked.has(tile.terrain)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  for (const poi of pois) {
    assert.ok(visited.has(`${poi.x},${poi.y}`), `聚落 ${poi.id} 必须道路可达`);
  }
  for (const gate of map.gates) {
    assert.ok(visited.has(`${gate.x},${gate.y}`), `出境口 ${gate.direction} 必须可达`);
  }
});

test('s1 城市/村庄初生时仅确定位置与占位，只有侦查后才填充详细信息', () => {
  const state = createInitialState({ seed: 99, spawnRegionId: 'empire_heart' });
  const map = state.world.regions.empire_heart.map!;
  const allPois = Object.values(map.pois);
  const unscouted = allPois.filter(p => !p.scouted);
  assert.ok(unscouted.length >= 3, '除出生起点外，其余城市/村庄生成时不应提前填详情');
  for (const poi of unscouted) {
    assert.equal(poi.details, undefined, `未侦查聚落 ${poi.id} 不得预先生成 details`);
    assert.ok(Number.isInteger(poi.x) && Number.isInteger(poi.y));
  }

  // 执行侦查：带入周边地形并填充详细信息
  const target = unscouted[0]!;
  const surroundings = surroundingTerrainsOf(map, target.x, target.y);
  assert.ok(surroundings.length > 0);
  const details = fallbackSettlementDetails(target, REGION_CATALOG.empire_heart, surroundings, 99);
  const scouted = act(state, { type: 'scoutSettlement', poiId: target.id, details });
  assert.equal(scouted.ok, true);
  const updated = scouted.state.world.regions.empire_heart.map!.pois[target.id]!;
  assert.equal(updated.scouted, true);
  assert.equal(updated.details?.name, details.name);
});

test('s1 只有跨边界出境时才懒加载目标区域小地图，且大篷车落入入境口', () => {
  const state = createInitialState({ seed: 512, spawnRegionId: 'empire_heart' });
  const originMap = state.world.regions.empire_heart.map!;
  const gate = originMap.gates[0]!;
  assert.equal(state.world.regions[gate.targetRegionId].map, undefined, '出境前目标区域不得加载');

  // 未站在边界口直接出境应拒绝
  const blocked = act(state, { type: 'crossBorder', direction: gate.direction });
  assert.equal(blocked.ok, false);

  // 移动到边界口再出境
  const atGate = {
    ...state,
    world: { ...state.world, pos: { x: gate.x, y: gate.y } },
  };
  const crossed = act(atGate, { type: 'crossBorder', direction: gate.direction });
  assert.equal(crossed.ok, true, crossed.message);
  assert.equal(crossed.state.world.currentRegionId, gate.targetRegionId);
  assert.ok(crossed.state.world.regions[gate.targetRegionId].map, '出境后应当场懒加载目标地区小地图');

  const destMap = crossed.state.world.regions[gate.targetRegionId].map!;
  const opp = { north: 'south', south: 'north', east: 'west', west: 'east' } as const;
  const entryGate = destMap.gates.find(g => g.direction === opp[gate.direction])!;
  assert.deepEqual(crossed.state.world.pos, { x: entryGate.x, y: entryGate.y }, '入境后位置应落在新地区对应入口处');
});
