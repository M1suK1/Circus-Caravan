import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateRegionMap, regionTerrainAt } from '../src/domain/regionGen.ts';
import { generateWorldMap, worldRegionAt, worldTerrainAt } from '../src/domain/worldGen.ts';

const root = resolve(import.meta.dirname, '..');
const readText = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

test('s9 地形详情卡 CSS 层叠修复：.octo-bottom-left-card 必须在 .paper-note 之后定义且不被 position: relative 覆盖', () => {
  const css = readText('src/styles/parchment.css');
  const paperNoteIdx = css.indexOf('.paper-note {');
  const cardIdx = css.lastIndexOf('.octo-bottom-left-card {');
  assert.ok(paperNoteIdx >= 0 && cardIdx > paperNoteIdx, '.octo-bottom-left-card 必须在 .paper-note 之后声明（或使用更高优先级），防止 position: fixed 被覆盖');
  assert.match(
    css.slice(cardIdx),
    /\.octo-bottom-left-card\s*\{[^}]*position:\s*fixed/s,
    '左下角卡片必须真正生效 position: fixed',
  );
});

test('s9 支持撤回/擦除上一段墨线与图鉴筛选当前区域物种', () => {
  const shellSrc = readText('src/components/Shell.tsx');
  assert.ok(shellSrc.includes('route-undo-btn'), 'HelmBar 必须提供撤回/擦除上一段墨线按钮 #route-undo-btn');

  const appSrc = readText('src/App.tsx');
  assert.ok(appSrc.includes('routeHistory') && appSrc.includes('handleUndoRoute'), 'App.tsx 必须维护 routeHistory 栈并支持 handleUndoRoute');

  const bestiarySrc = readText('src/components/Modals/BestiaryDialog.tsx');
  assert.ok(bestiarySrc.includes('bestiary-only-region'), 'BestiaryDialog 必须提供筛选当前大区物种的控件 #bestiary-only-region');
});

test('s9 世界地图山脉尽量生成在疆域边界处而非大陆中间堵路', () => {
  for (const seed of [2026, 4096, 8848]) {
    const world = generateWorldMap(seed);
    let totalMountains = 0;
    let borderMountains = 0;

    for (let y = 2; y < world.height - 2; y += 1) {
      for (let x = 2; x < world.width - 2; x += 1) {
        if (worldTerrainAt(world, x, y) !== 'mountain') continue;
        totalMountains += 1;
        const myReg = worldRegionAt(world, x, y);
        let nearBorder = false;
        for (let dy = -3; dy <= 3 && !nearBorder; dy += 1) {
          for (let dx = -3; dx <= 3; dx += 1) {
            const other = worldRegionAt(world, x + dx, y + dy);
            if (other && myReg && other !== myReg) {
              nearBorder = true;
              break;
            }
          }
        }
        if (nearBorder) borderMountains += 1;
      }
    }

    assert.ok(totalMountains >= 25, `seed=${seed} 应保留适量边界山脉，实际=${totalMountains}`);
    const borderRatio = borderMountains / Math.max(1, totalMountains);
    assert.ok(
      borderRatio >= 0.72,
      `seed=${seed} 山脉应集中分布在疆域边界（>=72%），当前边界占比仅 ${(borderRatio * 100).toFixed(1)}% (${borderMountains}/${totalMountains})`,
    );
  }
});

test('s9 除沉没泽国外其余地区水体集中成湖泊或连续河流（无散碎水洼），且焚沙裂谷水体生成概率极低', () => {
  let oasisWaterRatioSum = 0;
  let marshWaterRatioSum = 0;
  const seeds = [2026, 4096, 8848];

  for (const seed of seeds) {
    const world = generateWorldMap(seed);

    // 非沉没泽国：检验 10× 区域中不存在大量散碎孤立水洼（邻域4格均非水体的孤立水块 == 0）
    for (const rId of ['empire_heart', 'ancient_forest', 'sand_oasis'] as const) {
      const rMap = generateRegionMap(world, rId, seed);
      let isolatedPuddles = 0;
      let waterTiles = 0;
      let regionLandTiles = 0;

      for (let y = 1; y < rMap.height - 1; y += 1) {
        for (let x = 1; x < rMap.width - 1; x += 1) {
          const t = regionTerrainAt(rMap, x, y);
          if (t === 'outside' || t === 'ocean') continue;
          regionLandTiles += 1;
          if (t === 'lake' || t === 'river') {
            waterTiles += 1;
            const n = [
              regionTerrainAt(rMap, x + 1, y),
              regionTerrainAt(rMap, x - 1, y),
              regionTerrainAt(rMap, x, y + 1),
              regionTerrainAt(rMap, x, y - 1),
            ];
            if (!n.some(nt => nt === 'lake' || nt === 'river' || nt === 'bridge')) {
              isolatedPuddles += 1;
            }
          }
        }
      }

      assert.equal(
        isolatedPuddles,
        0,
        `seed=${seed} ${rId} 不得生成孤立散碎小水洼，实际孤立水点数=${isolatedPuddles}`,
      );
      if (rId === 'sand_oasis') {
        oasisWaterRatioSum += waterTiles / Math.max(1, regionLandTiles);
      }
    }

    const marshMap = generateRegionMap(world, 'sunken_marsh', seed);
    let mWater = 0;
    let mTotal = 0;
    for (let y = 1; y < marshMap.height - 1; y += 1) {
      for (let x = 1; x < marshMap.width - 1; x += 1) {
        const t = regionTerrainAt(marshMap, x, y);
        if (t === 'outside' || t === 'ocean') continue;
        mTotal += 1;
        if (t === 'lake' || t === 'river') mWater += 1;
      }
    }
    marshWaterRatioSum += mWater / Math.max(1, mTotal);
  }

  const avgOasis = oasisWaterRatioSum / seeds.length;
  const avgMarsh = marshWaterRatioSum / seeds.length;
  assert.ok(avgOasis < 0.045, `焚沙裂谷平均水体占比应极低 (<4.5%)，实际=${(avgOasis * 100).toFixed(2)}%`);
  assert.ok(avgMarsh > avgOasis * 2, `沉没泽国平均水体占比 (${(avgMarsh * 100).toFixed(2)}%) 应显著高于焚沙裂谷 (${(avgOasis * 100).toFixed(2)}%)`);
});
