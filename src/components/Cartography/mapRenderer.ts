/**
 * 羊皮纸三级地图渲染器（128×128 世界全图 / 10× 区域全图 / 跟随马车局部图）。
 *
 * 使用离屏 ImageData 像素缓冲区渲染，单帧绘制耗时 < 5ms，避免十余万 DOM 节点卡顿。
 */
import { REGION_CATALOG, REGION_IDS } from '../../content/regions.ts';
import { regionTerrainArray } from '../../domain/regionGen.ts';
import { CARAVAN_VISION_RADIUS, exploredMaskArray } from '../../domain/routeDraw.ts';
import { TERRAIN_ORDER, worldRegionArray, worldTerrainArray } from '../../domain/worldGen.ts';
import type { CircusState, MapZoomMode, RegionMap, RouteEvaluation, TerrainType } from '../../types.ts';

const TERRAIN_RGB: Record<TerrainType, [number, number, number]> = {
  outside: [219, 197, 156],
  ocean: [70, 108, 134],
  coast: [162, 179, 168],
  lake: [62, 114, 146],
  river: [72, 126, 158],
  bridge: [164, 114, 62],
  border_gate: [184, 115, 36],
  wasteland: [224, 204, 166],
  road: [189, 152, 102],
  forest: [96, 134, 96],
  swamp: [120, 132, 102],
  mountain: [142, 118, 92],
  ruin: [168, 136, 114],
  warzone: [168, 76, 66],
  city: [166, 52, 41],
  village: [194, 114, 58],
};

const FOG_RGB: [number, number, number] = [216, 196, 158];

export interface ViewportTransform {
  viewX: number;
  viewY: number;
  viewW: number;
  viewH: number;
  canvasW: number;
  canvasH: number;
}

const OFFSCREEN_CACHE = new WeakMap<object, HTMLCanvasElement>();

function getOffscreen(key: object, w: number, h: number, fill: (buf: Uint8ClampedArray) => void): HTMLCanvasElement {
  const existing = OFFSCREEN_CACHE.get(key);
  if (existing && existing.width === w && existing.height === h) {
    const ctx = existing.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    fill(img.data);
    ctx.putImageData(img, 0, 0);
    return existing;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  fill(img.data);
  ctx.putImageData(img, 0, 0);
  OFFSCREEN_CACHE.set(key, c);
  return c;
}

export function computeViewport(
  state: CircusState,
  zoom: MapZoomMode,
  canvasW: number,
  canvasH: number,
): ViewportTransform {
  const regionMap = state.world.regions[state.world.currentRegionId].map;
  if (zoom === 'world' || !regionMap) {
    return { viewX: 0, viewY: 0, viewW: 128, viewH: 128, canvasW, canvasH };
  }
  if (zoom === 'region') {
    return { viewX: 0, viewY: 0, viewW: regionMap.width, viewH: regionMap.height, canvasW, canvasH };
  }
  // follow 模式：围绕马车保持约 48×30 格局部高精视野
  const aspect = canvasW / Math.max(1, canvasH);
  const viewH = 44;
  const viewW = Math.round(viewH * aspect);
  const vx = Math.max(0, Math.min(regionMap.width - viewW, state.world.pos.x - viewW / 2));
  const vy = Math.max(0, Math.min(regionMap.height - viewH, state.world.pos.y - viewH / 2));
  return {
    viewX: Math.max(0, vx),
    viewY: Math.max(0, vy),
    viewW: Math.min(regionMap.width, viewW),
    viewH: Math.min(regionMap.height, viewH),
    canvasW,
    canvasH,
  };
}

export function mapToCanvasPx(
  mx: number,
  my: number,
  vp: ViewportTransform,
): { px: number; py: number } {
  const scale = Math.min(vp.canvasW / vp.viewW, vp.canvasH / vp.viewH);
  const drawW = vp.viewW * scale;
  const drawH = vp.viewH * scale;
  const offX = (vp.canvasW - drawW) / 2;
  const offY = (vp.canvasH - drawH) / 2;
  return {
    px: offX + (mx - vp.viewX) * scale,
    py: offY + (my - vp.viewY) * scale,
  };
}

export function canvasPxToMap(
  px: number,
  py: number,
  vp: ViewportTransform,
): { x: number; y: number } {
  const scale = Math.min(vp.canvasW / vp.viewW, vp.canvasH / vp.viewH);
  const drawW = vp.viewW * scale;
  const drawH = vp.viewH * scale;
  const offX = (vp.canvasW - drawW) / 2;
  const offY = (vp.canvasH - drawH) / 2;
  return {
    x: vp.viewX + (px - offX) / scale,
    y: vp.viewY + (py - offY) / scale,
  };
}

function drawWorldCanvas(canvas: HTMLCanvasElement, state: CircusState, vp: ViewportTransform): void {
  const ctx = canvas.getContext('2d')!;
  const world = state.world.worldMap;
  const terArr = worldTerrainArray(world);
  const regArr = worldRegionArray(world);

  const off = getOffscreen(world, world.width, world.height, data => {
    for (let y = 0; y < world.height; y += 1) {
      for (let x = 0; x < world.width; x += 1) {
        const idx = y * world.width + x;
        const ter = TERRAIN_ORDER[terArr[idx]!] ?? 'ocean';
        const rgb = TERRAIN_RGB[ter];
        const rIdx = regArr[idx]!;
        let isBorder = false;
        if (rIdx < 9 && x + 1 < world.width && y + 1 < world.height) {
          if (regArr[idx + 1] !== rIdx || regArr[idx + world.width] !== rIdx) isBorder = true;
        }
        const p = idx * 4;
        data[p] = isBorder ? 112 : rgb[0];
        data[p + 1] = isBorder ? 80 : rgb[1];
        data[p + 2] = isBorder ? 48 : rgb[2];
        data[p + 3] = 255;
      }
    }
  });

  ctx.fillStyle = '#3f6985';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const topLeft = mapToCanvasPx(0, 0, vp);
  const botRight = mapToCanvasPx(world.width, world.height, vp);
  ctx.drawImage(off, topLeft.px, topLeft.py, botRight.px - topLeft.px, botRight.py - topLeft.py);

  // 标注 9 大区域手写风名称
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const id of REGION_IDS) {
    const b = world.regionBounds[id];
    const pt = mapToCanvasPx(b.centerX, b.centerY, vp);
    const active = id === state.world.currentRegionId;
    const loaded = Boolean(state.world.regions[id].map);
    ctx.font = `${active ? '700 13px' : '600 11px'} "Noto Serif SC", serif`;
    ctx.fillStyle = 'rgba(250, 242, 224, 0.85)';
    ctx.strokeStyle = 'rgba(250, 242, 224, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(REGION_CATALOG[id].name, pt.px, pt.py);
    ctx.fillStyle = active ? '#a63429' : loaded ? '#2a1f18' : '#6d5844';
    ctx.fillText(REGION_CATALOG[id].name, pt.px, pt.py);
  }

  // 绘制当前大篷车在世界地图上的坐标图钉
  const curMap = state.world.regions[state.world.currentRegionId].map;
  if (curMap) {
    const wx = (curMap.worldOffsetX + state.world.pos.x) / 10;
    const wy = (curMap.worldOffsetY + state.world.pos.y) / 10;
    const pin = mapToCanvasPx(wx, wy, vp);
    ctx.beginPath();
    ctx.arc(pin.px, pin.py, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#a63429';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#faf2e0';
    ctx.stroke();
  }
}

function drawRegionCanvas(
  canvas: HTMLCanvasElement,
  state: CircusState,
  map: RegionMap,
  vp: ViewportTransform,
  routeDraft: RouteEvaluation | null,
): void {
  const ctx = canvas.getContext('2d')!;
  const terArr = regionTerrainArray(map);
  const mask = exploredMaskArray(map);
  const cx = state.world.pos.x;
  const cy = state.world.pos.y;
  const r2 = CARAVAN_VISION_RADIUS * CARAVAN_VISION_RADIUS;

  const off = getOffscreen(map, map.width, map.height, data => {
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const idx = y * map.width + x;
        const ter = TERRAIN_ORDER[terArr[idx]!] ?? 'outside';
        const explored = Boolean((mask[idx >> 3]! >> (idx & 7)) & 1);
        const liveSeen = (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2;
        const p = idx * 4;

        if (!explored && !liveSeen && ter !== 'outside') {
          // 羊皮纸迷雾遮罩（仅加细微格纹）
          const shade = ((x + y) & 1) === 0 ? 4 : -4;
          data[p] = FOG_RGB[0] + shade;
          data[p + 1] = FOG_RGB[1] + shade;
          data[p + 2] = FOG_RGB[2] + shade;
          data[p + 3] = 255;
        } else {
          const rgb = TERRAIN_RGB[ter];
          // 曾到过但不在当前视野内的地貌略微做旧柔化，与实时视野形成高级层次感
          const dim = !liveSeen && ter !== 'outside' ? 0.88 : 1;
          data[p] = Math.round(rgb[0] * dim + (1 - dim) * 230);
          data[p + 1] = Math.round(rgb[1] * dim + (1 - dim) * 212);
          data[p + 2] = Math.round(rgb[2] * dim + (1 - dim) * 180);
          data[p + 3] = 255;
        }
      }
    }
  });

  ctx.fillStyle = '#d3bc94';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const p0 = mapToCanvasPx(0, 0, vp);
  const p1 = mapToCanvasPx(map.width, map.height, vp);
  ctx.drawImage(off, p0.px, p0.py, p1.px - p0.px, p1.py - p0.py);

  // 已揭露的多格城市与村庄名牌
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const poi of Object.values(map.pois)) {
    const idx = poi.y * map.width + poi.x;
    const seen = Boolean((mask[idx >> 3]! >> (idx & 7)) & 1)
      || (poi.x - cx) * (poi.x - cx) + (poi.y - cy) * (poi.y - cy) <= r2;
    if (!seen) continue;
    const pos = mapToCanvasPx(poi.x, poi.y - 1.5, vp);
    const label = poi.scouted && poi.details ? poi.details.name : poi.placeholderName;
    ctx.font = poi.kind === 'city' ? '700 12px "Noto Serif SC", serif' : '500 11px "Noto Sans SC", sans-serif';
    ctx.strokeStyle = 'rgba(250, 242, 224, 0.92)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, pos.px, pos.py);
    ctx.fillStyle = poi.scouted ? '#2a1f18' : '#7a6450';
    ctx.fillText(label, pos.px, pos.py);
  }

  // 边界出境口标牌（在视野或曾探明时显现）
  for (const gate of map.gates) {
    const idx = gate.y * map.width + gate.x;
    const seen = Boolean((mask[idx >> 3]! >> (idx & 7)) & 1)
      || (gate.x - cx) * (gate.x - cx) + (gate.y - cy) * (gate.y - cy) <= r2;
    if (!seen) continue;
    const pos = mapToCanvasPx(gate.x, gate.y, vp);
    ctx.beginPath();
    ctx.arc(pos.px, pos.py, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#b87324';
    ctx.fill();
    ctx.font = '600 10px "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#564234';
    ctx.fillText(`→ ${state.world.regions[gate.targetRegionId].name}`, pos.px, pos.py - 8);
  }

  // 手动划线路径预览（有效路径墨色虚线 + 截断阻碍红线）
  if (routeDraft && routeDraft.points.length >= 2) {
    if (routeDraft.validPoints.length >= 2) {
      ctx.beginPath();
      const first = mapToCanvasPx(routeDraft.validPoints[0]!.x, routeDraft.validPoints[0]!.y, vp);
      ctx.moveTo(first.px, first.py);
      for (let i = 1; i < routeDraft.validPoints.length; i += 1) {
        const p = mapToCanvasPx(routeDraft.validPoints[i]!.x, routeDraft.validPoints[i]!.y, vp);
        ctx.lineTo(p.px, p.py);
      }
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#2a1f18';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (routeDraft.blocked && routeDraft.validPoints.length > 0) {
      const tailStart = routeDraft.validPoints[routeDraft.validPoints.length - 1]!;
      const tailEnd = routeDraft.points[routeDraft.points.length - 1]!;
      const ps = mapToCanvasPx(tailStart.x, tailStart.y, vp);
      const pe = mapToCanvasPx(tailEnd.x, tailEnd.y, vp);
      ctx.beginPath();
      ctx.moveTo(ps.px, ps.py);
      ctx.lineTo(pe.px, pe.py);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#a63429';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 马车实时位置与暖灯视野光圈
  const cPx = mapToCanvasPx(cx, cy, vp);
  const edgePx = mapToCanvasPx(cx + CARAVAN_VISION_RADIUS, cy, vp);
  const visPx = Math.max(12, Math.abs(edgePx.px - cPx.px));
  ctx.beginPath();
  ctx.arc(cPx.px, cPx.py, visPx, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(184, 115, 36, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(cPx.px, cPx.py, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#a63429';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#faf2e0';
  ctx.stroke();
}

export function renderCartographyCanvas(
  canvas: HTMLCanvasElement,
  state: CircusState,
  zoom: MapZoomMode,
  routeDraft: RouteEvaluation | null,
): ViewportTransform {
  const vp = computeViewport(state, zoom, canvas.width, canvas.height);
  const regionMap = state.world.regions[state.world.currentRegionId].map;
  if (zoom === 'world' || !regionMap) {
    drawWorldCanvas(canvas, state, vp);
  } else {
    drawRegionCanvas(canvas, state, regionMap, vp, routeDraft);
  }
  return vp;
}
