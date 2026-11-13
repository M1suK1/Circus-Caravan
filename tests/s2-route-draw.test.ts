import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRouteStroke,
  isTileExplored,
  revealCircleInMask,
  TERRAIN_SPEED,
} from '../src/domain/routeDraw.ts';
import { regionTerrainAt } from '../src/domain/regionGen.ts';
import { act } from '../src/rules/act.ts';
import { createInitialState } from '../src/rules/state.ts';

test('s2 迷雾视野：刚生成小地图时仅揭示当前马车周围，远端未到过的地貌处于迷雾遮蔽', () => {
  const state = createInitialState({ seed: 4242, spawnRegionId: 'empire_heart' });
  const map = state.world.regions.empire_heart.map!;
  const sx = Math.round(state.world.pos.x);
  const sy = Math.round(state.world.pos.y);

  assert.equal(isTileExplored(map, sx, sy), true, '马车脚下应可见');

  // 找一个离马车非常远的区域内坐标
  let farX = -1;
  let farY = -1;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (regionTerrainAt(map, x, y) !== 'outside' && Math.hypot(x - sx, y - sy) > 40) {
        farX = x;
        farY = y;
        break;
      }
    }
    if (farX >= 0) break;
  }
  assert.ok(farX >= 0, '应当存在远端可验证格');
  assert.equal(isTileExplored(map, farX, farY), false, '远端未到过的地貌必须不可见');
});

test('s2 手动划线行动：不同地形影响行进速度与物资消耗，遇深水/海洋自动截断', () => {
  const state = createInitialState({ seed: 4242, spawnRegionId: 'empire_heart' });
  const map = state.world.regions.empire_heart.map!;
  const sx = state.world.pos.x;
  const sy = state.world.pos.y;

  // 验证地形速度表：道路快于荒地，荒地快于沼泽
  assert.ok(TERRAIN_SPEED.road > TERRAIN_SPEED.wasteland);
  assert.ok(TERRAIN_SPEED.wasteland > TERRAIN_SPEED.swamp);

  // 朝附近可通行点画一条 6 格线段
  let targetX = sx;
  let targetY = sy;
  for (let r = 6; r >= 2; r -= 1) {
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const tx = Math.round(sx + dx);
      const ty = Math.round(sy + dy);
      if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) {
        const t = regionTerrainAt(map, tx, ty);
        if (t !== 'outside' && t !== 'ocean' && t !== 'river' && t !== 'lake' && t !== 'mountain') {
          targetX = tx;
          targetY = ty;
          break;
        }
      }
    }
    if (targetX !== sx || targetY !== sy) break;
  }

  const draft = evaluateRouteStroke(map, [{ x: sx, y: sy }, { x: targetX, y: targetY }], state);
  assert.ok(draft.distanceTiles > 0);
  assert.ok(draft.fuelCost >= 0 && draft.rationsCost >= 0);

  // 执行划线行进：移动并揭露沿途迷雾
  const moved = act(state, { type: 'executeRoute', points: draft.validPoints });
  assert.equal(moved.ok, true, moved.message);
  assert.notEqual(
    `${moved.state.world.pos.x.toFixed(1)},${moved.state.world.pos.y.toFixed(1)}`,
    `${sx.toFixed(1)},${sy.toFixed(1)}`,
  );
  const afterMap = moved.state.world.regions.empire_heart.map!;
  assert.equal(isTileExplored(afterMap, Math.round(moved.state.world.pos.x), Math.round(moved.state.world.pos.y)), true);
  assert.equal(isTileExplored(afterMap, Math.round(sx), Math.round(sy)), true, '曾经到过的地点必须继续保持可见');
});

test('s2 划线触及海洋或无桥深水时拦截截断，不让车队直接冲进海里', () => {
  const state = createInitialState({ seed: 777, spawnRegionId: 'dawn_coast' });
  const map = state.world.regions.dawn_coast.map!;
  // 找一个靠近 ocean 的陆地格作为起点
  let landX = -1;
  let landY = -1;
  let oceanX = -1;
  let oceanY = -1;
  for (let y = 1; y < map.height - 1 && landX < 0; y += 1) {
    for (let x = 1; x < map.width - 1; x += 1) {
      const t = regionTerrainAt(map, x, y);
      if (t !== 'ocean' && t !== 'outside' && t !== 'river' && t !== 'lake' && t !== 'mountain') {
        const nt = regionTerrainAt(map, x + 3, y);
        if (nt === 'ocean' || nt === 'outside') {
          landX = x;
          landY = y;
          oceanX = x + 3;
          oceanY = y;
          break;
        }
      }
    }
  }
  if (landX >= 0) {
    revealCircleInMask(map, landX, landY, 5);
    const draft = evaluateRouteStroke(map, [{ x: landX, y: landY }, { x: oceanX, y: oceanY }], state);
    assert.equal(draft.blocked, true, '冲入海洋/界外应当触发截断');
    assert.ok(draft.blockReason);
  }
});
