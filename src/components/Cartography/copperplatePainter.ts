/**
 * 《八方旅人》风暖褐铜版画立体浮雕地图烘焙器（离屏缓存，单次烘焙、帧间零重算）。
 *
 * 包含四大古典制图工艺：
 *  1. 连续高度场重建与西北向（NW）斜光立体浮雕（Hillshade）及山脚环境光遮蔽；
 *  2. 倒角海深距离场驱动的「浓墨海岸线 + 三重平行水波纹等深墨线 + 远海水平铜版排线」；
 *  3. 离屏矢量手绘人字峰峦斜排线（Hachures）、森林树冠簇墨弧与双虚线古商道；
 *  4. 区域迷雾暖白羊皮云层与交界处巴洛克弧形卷云花边（Cloud Volutes）。
 */
import { regionTerrainArray } from '../../domain/regionGen.ts';
import { CARAVAN_VISION_RADIUS, exploredMaskArray } from '../../domain/routeDraw.ts';
import {
  fbm2d,
  TERRAIN_ORDER,
  valueNoise2d,
  worldRegionArray,
  worldTerrainArray,
} from '../../domain/worldGen.ts';
import type { RegionMap, TerrainType, WorldMapData } from '../../types.ts';

const COPPER_TONE: Record<TerrainType, [number, number, number]> = {
  outside: [224, 202, 164],
  ocean: [144, 150, 143],
  coast: [212, 192, 152],
  lake: [136, 146, 142],
  river: [122, 136, 134],
  bridge: [176, 134, 84],
  border_gate: [196, 142, 74],
  wasteland: [228, 202, 156],
  road: [205, 174, 126],
  forest: [182, 172, 128],
  swamp: [168, 156, 122],
  mountain: [188, 156, 114],
  ruin: [186, 158, 128],
  warzone: [186, 124, 96],
  city: [198, 138, 98],
  village: [208, 156, 110],
};

const BASE_ELEV: Record<TerrainType, number> = {
  outside: 0.24,
  ocean: 0.0,
  lake: 0.08,
  river: 0.14,
  coast: 0.22,
  swamp: 0.28,
  bridge: 0.32,
  road: 0.35,
  wasteland: 0.38,
  village: 0.41,
  city: 0.44,
  border_gate: 0.46,
  forest: 0.49,
  warzone: 0.45,
  ruin: 0.54,
  mountain: 0.96,
};

/** 计算西北入射光（NW Azimuth）斜光浮雕明暗增量：dzdx>0, dzdy>0 表示坡面朝向西北受光。 */
export function computeHillshadeLuma(dzdx: number, dzdy: number): number {
  const sunDot = (dzdx + dzdy) * 0.7071;
  const slope = Math.hypot(dzdx, dzdy);
  if (sunDot >= 0) {
    return Math.min(40, sunDot * 68 - slope * 6);
  }
  return Math.max(-56, sunDot * 88 - slope * 13);
}

/** 计算所有水体格距最近陆地格的四邻接曼哈顿海深距离，用于绘制三重海岸水波纹。 */
export function computeSeaDepthField(isWater: Uint8Array, w: number, h: number): Int16Array {
  const total = w * h;
  const depth = new Int16Array(total).fill(999);
  const queue: number[] = [];
  for (let i = 0; i < total; i += 1) {
    if (!isWater[i]) {
      depth[i] = 0;
      queue.push(i);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const next = depth[cur]! + 1;
    if (next > 16) continue;
    if (cx > 0 && depth[cur - 1]! > next) { depth[cur - 1] = next; queue.push(cur - 1); }
    if (cx + 1 < w && depth[cur + 1]! > next) { depth[cur + 1] = next; queue.push(cur + 1); }
    if (cy > 0 && depth[cur - w]! > next) { depth[cur - w] = next; queue.push(cur - w); }
    if (cy + 1 < h && depth[cur + w]! > next) { depth[cur + w] = next; queue.push(cur + w); }
  }
  return depth;
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function applyWaterEngraving(
  rgb: [number, number, number],
  d: number,
  x: number,
  y: number,
  seed: number,
): [number, number, number] {
  const jitter = valueNoise2d(x, y, 3.6, seed + 811);
  // 紧贴陆地的浓墨海岸勾线
  if (d === 1) return [54, 38, 25];
  // 三道古典铜版画平行海岸水波纹环线（d = 3, 6, 9）
  if (d === 3 || (d === 4 && jitter > 0.78)) return [88, 74, 58];
  if (d === 6 || (d === 7 && jitter > 0.76)) return [106, 96, 80];
  if (d === 9 && jitter > 0.34) return [118, 112, 98];

  // 远海水深渐暗与水平断续铜版排线
  const sink = Math.min(20, d * 1.15);
  let r = rgb[0] - sink;
  let g = rgb[1] - sink * 0.9;
  let b = rgb[2] - sink * 0.8;
  if (d > 4 && y % 3 === 0 && jitter > 0.44) {
    r -= 15;
    g -= 15;
    b -= 14;
  }
  return [r, g, b];
}

export function rasterizeWorldCopperplate(world: WorldMapData, out: Uint8ClampedArray): void {
  const { width: w, height: h, seed } = world;
  const terArr = worldTerrainArray(world);
  const regArr = worldRegionArray(world);
  const total = w * h;

  const isWater = new Uint8Array(total);
  const elev = new Float32Array(total);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const ter = TERRAIN_ORDER[terArr[i]!] ?? 'ocean';
      if (ter === 'ocean' || ter === 'lake') isWater[i] = 1;
      const ridge = 1 - Math.abs(2 * valueNoise2d(x, y, 4.2, seed + 907) - 1);
      elev[i] = BASE_ELEV[ter] + (ter === 'mountain' ? ridge * 0.38 : (fbm2d(x, y, seed + 601) - 0.5) * 0.16);
    }
  }

  const seaDepth = computeSeaDepthField(isWater, w, h);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x;
      const ter = TERRAIN_ORDER[terArr[idx]!] ?? 'ocean';
      const p = idx * 4;

      if (isWater[idx]) {
        const [r, g, b] = applyWaterEngraving(COPPER_TONE[ter], seaDepth[idx]!, x, y, seed);
        out[p] = clampByte(r);
        out[p + 1] = clampByte(g);
        out[p + 2] = clampByte(b);
        out[p + 3] = 255;
        continue;
      }

      const xm = x > 0 ? x - 1 : x;
      const xp = x + 1 < w ? x + 1 : x;
      const ym = y > 0 ? y - 1 : y;
      const yp = y + 1 < h ? y + 1 : y;
      const dzdx = (elev[y * w + xp]! - elev[y * w + xm]!) * 1.45;
      const dzdy = (elev[yp * w + x]! - elev[ym * w + x]!) * 1.45;
      const shade = computeHillshadeLuma(dzdx, dzdy);
      const paperGrain = (valueNoise2d(x, y, 2.2, seed + 331) - 0.5) * 12;

      const rIdx = regArr[idx]!;
      let isBorder = false;
      if (rIdx < 9 && x + 1 < w && y + 1 < h) {
        const rr = regArr[idx + 1]!;
        const rd = regArr[idx + w]!;
        if ((rr < 9 && rr !== rIdx) || (rd < 9 && rd !== rIdx)) isBorder = true;
      }

      if (isBorder && ((x + y) & 1) === 0) {
        out[p] = 86;
        out[p + 1] = 56;
        out[p + 2] = 34;
        out[p + 3] = 255;
        continue;
      }

      const base = COPPER_TONE[ter];
      out[p] = clampByte(base[0] + shade + paperGrain);
      out[p + 1] = clampByte(base[1] + shade * 0.92 + paperGrain);
      out[p + 2] = clampByte(base[2] + shade * 0.78 + paperGrain);
      out[p + 3] = 255;
    }
  }
}

export function paintWorldCopperplateDetails(ctx: CanvasRenderingContext2D, world: WorldMapData): void {
  const { width: w, height: h, seed } = world;
  const terArr = worldTerrainArray(world);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (let y = 3; y < h - 3; y += 2) {
    for (let x = 3; x < w - 3; x += 2) {
      const idx = y * w + x;
      const ter = TERRAIN_ORDER[terArr[idx]!] ?? 'ocean';
      const jx = (valueNoise2d(x, y, 1.7, seed + 41) - 0.5) * 0.9;
      const jy = (valueNoise2d(x, y, 1.7, seed + 83) - 0.5) * 0.9;
      const px = x + 0.5 + jx;
      const py = y + 0.5 + jy;

      if (ter === 'mountain') {
        // 手绘人字山峰与东南背光面斜排线
        ctx.beginPath();
        ctx.moveTo(px - 1.5, py + 1.1);
        ctx.lineTo(px, py - 1.4);
        ctx.lineTo(px + 1.6, py + 1.1);
        ctx.fillStyle = 'rgba(92, 62, 36, 0.34)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(48, 30, 16, 0.78)';
        ctx.lineWidth = 0.55;
        ctx.stroke();
      } else if (ter === 'forest' && ((x + y) & 2) === 0) {
        ctx.beginPath();
        ctx.arc(px, py, 0.85, Math.PI, 0);
        ctx.strokeStyle = 'rgba(64, 56, 34, 0.52)';
        ctx.lineWidth = 0.45;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function rasterizeRegionCopperplate(
  map: RegionMap,
  caravanPos: { x: number; y: number },
  out: Uint8ClampedArray,
): void {
  const { width: w, height: h, seed } = map;
  const terArr = regionTerrainArray(map);
  const mask = exploredMaskArray(map);
  const total = w * h;
  const cx = caravanPos.x;
  const cy = caravanPos.y;
  const r2 = CARAVAN_VISION_RADIUS * CARAVAN_VISION_RADIUS;

  const isWater = new Uint8Array(total);
  const elev = new Float32Array(total);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const ter = TERRAIN_ORDER[terArr[i]!] ?? 'outside';
      if (ter === 'ocean' || ter === 'lake' || ter === 'river') isWater[i] = 1;
      const ridge = 1 - Math.abs(2 * valueNoise2d(x, y, 5.5, seed + 193) - 1);
      elev[i] = BASE_ELEV[ter] + (ter === 'mountain' ? ridge * 0.42 : (fbm2d(x, y, seed + 271) - 0.5) * 0.14);
    }
  }

  const seaDepth = computeSeaDepthField(isWater, w, h);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x;
      const ter = TERRAIN_ORDER[terArr[idx]!] ?? 'outside';
      const explored = Boolean((mask[idx >> 3]! >> (idx & 7)) & 1);
      const liveSeen = (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2;
      const p = idx * 4;

      if (ter === 'outside') {
        // 疆域外围柔和暗褐羊皮衬底，凸显当前区域不规则版图轮廓
        const cloud = (fbm2d(x * 0.6, y * 0.6, seed + 71) - 0.5) * 18;
        out[p] = clampByte(192 + cloud);
        out[p + 1] = clampByte(170 + cloud * 0.9);
        out[p + 2] = clampByte(134 + cloud * 0.8);
        out[p + 3] = 255;
        continue;
      }

      if (!explored && !liveSeen) {
        // 暖白羊皮流云迷雾（取代呆板方格迷雾）
        const billow = fbm2d(x * 0.55, y * 0.55, seed + 523);
        const fine = valueNoise2d(x, y, 3.5, seed + 619);
        const c = billow * 0.75 + fine * 0.25;
        out[p] = clampByte(222 + c * 26);
        out[p + 1] = clampByte(201 + c * 25);
        out[p + 2] = clampByte(164 + c * 22);
        out[p + 3] = 255;
        continue;
      }

      const dim = liveSeen ? 1 : 0.91;
      if (isWater[idx]) {
        const [wr, wg, wb] = applyWaterEngraving(COPPER_TONE[ter], seaDepth[idx]!, x, y, seed);
        out[p] = clampByte(wr * dim + (1 - dim) * 214);
        out[p + 1] = clampByte(wg * dim + (1 - dim) * 194);
        out[p + 2] = clampByte(wb * dim + (1 - dim) * 160);
        out[p + 3] = 255;
        continue;
      }

      const xm = x > 0 ? x - 1 : x;
      const xp = x + 1 < w ? x + 1 : x;
      const ym = y > 0 ? y - 1 : y;
      const yp = y + 1 < h ? y + 1 : y;
      const dzdx = (elev[y * w + xp]! - elev[y * w + xm]!) * 1.65;
      const dzdy = (elev[yp * w + x]! - elev[ym * w + x]!) * 1.65;
      const shade = computeHillshadeLuma(dzdx, dzdy);
      const grain = (valueNoise2d(x, y, 2.5, seed + 409) - 0.5) * 10;
      const base = COPPER_TONE[ter];

      const r = base[0] + shade + grain;
      const g = base[1] + shade * 0.92 + grain;
      const b = base[2] + shade * 0.78 + grain;
      out[p] = clampByte(r * dim + (1 - dim) * 218);
      out[p + 1] = clampByte(g * dim + (1 - dim) * 198);
      out[p + 2] = clampByte(b * dim + (1 - dim) * 162);
      out[p + 3] = 255;
    }
  }
}

export function paintRegionCopperplateDetails(
  ctx: CanvasRenderingContext2D,
  map: RegionMap,
  caravanPos: { x: number; y: number },
): void {
  const { width: w, height: h, seed } = map;
  const terArr = regionTerrainArray(map);
  const mask = exploredMaskArray(map);
  const cx = caravanPos.x;
  const cy = caravanPos.y;
  const r2 = CARAVAN_VISION_RADIUS * CARAVAN_VISION_RADIUS;

  const isRevealed = (x: number, y: number): boolean => {
    const idx = y * w + x;
    return Boolean((mask[idx >> 3]! >> (idx & 7)) & 1) || (x - cx) ** 2 + (y - cy) ** 2 <= r2;
  };

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. 已探明区域内的手绘山峰斜排线、森林林冠墨弧与古商道车辙
  for (let y = 3; y < h - 3; y += 3) {
    for (let x = 3; x < w - 3; x += 3) {
      if (!isRevealed(x, y)) continue;
      const ter = TERRAIN_ORDER[terArr[y * w + x]!] ?? 'outside';
      if (ter === 'outside') continue;
      const jx = (valueNoise2d(x, y, 2.1, seed + 59) - 0.5) * 1.4;
      const jy = (valueNoise2d(x, y, 2.1, seed + 97) - 0.5) * 1.4;
      const px = x + 0.5 + jx;
      const py = y + 0.5 + jy;

      if (ter === 'mountain') {
        ctx.beginPath();
        ctx.moveTo(px - 2.3, py + 1.6);
        ctx.lineTo(px, py - 2.1);
        ctx.lineTo(px + 2.4, py + 1.6);
        ctx.fillStyle = 'rgba(84, 54, 30, 0.32)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(46, 28, 14, 0.82)';
        ctx.lineWidth = 0.65;
        ctx.stroke();

        // 背阴坡面铜版斜排线（Hachure）
        ctx.beginPath();
        ctx.moveTo(px + 0.2, py - 1.4);
        ctx.lineTo(px + 1.3, py + 1.3);
        ctx.moveTo(px + 0.7, py - 0.5);
        ctx.lineTo(px + 1.8, py + 1.4);
        ctx.strokeStyle = 'rgba(52, 32, 16, 0.55)';
        ctx.lineWidth = 0.45;
        ctx.stroke();
      } else if (ter === 'forest') {
        ctx.beginPath();
        ctx.arc(px - 0.7, py + 0.3, 1.05, Math.PI * 1.05, -0.05);
        ctx.arc(px + 0.8, py + 0.3, 0.95, Math.PI * 1.05, -0.05);
        ctx.strokeStyle = 'rgba(62, 54, 32, 0.58)';
        ctx.lineWidth = 0.52;
        ctx.stroke();
      } else if (ter === 'road') {
        ctx.fillStyle = 'rgba(88, 58, 30, 0.52)';
        ctx.fillRect(x + 0.2, y + 0.2, 0.7, 0.7);
      }
    }
  }

  // 2. 迷雾交界处绘制巴洛克弧形卷云花边（Cloud Volutes）
  ctx.fillStyle = 'rgba(248, 236, 210, 0.86)';
  ctx.strokeStyle = 'rgba(116, 86, 52, 0.52)';
  ctx.lineWidth = 0.65;
  for (let y = 4; y < h - 4; y += 3) {
    for (let x = 4; x < w - 4; x += 3) {
      const ter = TERRAIN_ORDER[terArr[y * w + x]!] ?? 'outside';
      if (ter === 'outside' || isRevealed(x, y)) continue;
      if (isRevealed(x - 2, y) || isRevealed(x + 2, y) || isRevealed(x, y - 2) || isRevealed(x, y + 2)) {
        const r = 1.9 + valueNoise2d(x, y, 2.8, seed + 701) * 1.3;
        ctx.beginPath();
        ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}
