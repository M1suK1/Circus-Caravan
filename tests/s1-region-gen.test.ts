import test from 'node:test';
import assert from 'node:assert/strict';
import { REGION_CATALOG, REGION_IDS } from '../src/content/regions.ts';
import {
  fallbackSettlementDetails,
  generateRegionMap,
  regionTerrainAt,
  surroundingTerrainsOf,
} from '../src/domain/regionGen.ts';
import { generateWorldMap, pickRandomSpawnRegion } from '../src/domain/worldGen.ts';
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

test('s1 小地图程序化生成：基于世界图 10× 放大、含出境口与多格城市', () => {
  const world = generateWorldMap(777);
  const map = generateRegionMap(world, 'ancient_forest', 777);
  assert.equal(map.scale, 10);
  assert.ok(map.gates.length >= 2);
  for (const gate of map.gates) {
    assert.equal(regionTerrainAt(map, gate.x, gate.y), 'border_gate');
  }
  const pois = Object.values(map.pois);
  assert.ok(pois.length >= 3, '应生成多座城市与村庄');
});

test('s1 城市/村庄初生时仅确定位置与占位，只有侦查后才填充详细信息', () => {
  const state = createInitialState({ seed: 99, spawnRegionId: 'empire_heart' });
  const map = state.world.regions.empire_heart.map!;
  const allPois = Object.values(map.pois);
  const unscouted = allPois.filter(p => !p.scouted);
  assert.ok(unscouted.length >= 2, '除出生起点外，其余城市/村庄生成时不应提前填详情');
  for (const poi of unscouted) {
    assert.equal(poi.details, undefined, `未侦查聚落 ${poi.id} 不得预先生成 details`);
    assert.ok(poi.footprint.length >= 2);
  }

  const target = unscouted[0]!;
  const surroundings = surroundingTerrainsOf(map, target.x, target.y);
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

  const blocked = act(state, { type: 'crossBorder', targetRegionId: gate.targetRegionId, direction: gate.direction });
  assert.equal(blocked.ok, false);

  const atGate = {
    ...state,
    world: { ...state.world, pos: { x: gate.x, y: gate.y } },
  };
  const crossed = act(atGate, { type: 'crossBorder', targetRegionId: gate.targetRegionId, direction: gate.direction });
  assert.equal(crossed.ok, true, crossed.message);
  assert.equal(crossed.state.world.currentRegionId, gate.targetRegionId);
  assert.ok(crossed.state.world.regions[gate.targetRegionId].map, '出境后应当场懒加载目标地区小地图');
});
