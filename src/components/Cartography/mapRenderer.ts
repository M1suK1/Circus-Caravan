/**
 * 羊皮纸三级地图渲染器（128×128 世界全图 / 10× 区域全图 / 跟随马车局部图）。
 *
 * 使用离屏 ImageData 像素缓冲区渲染地貌底图，再叠加可视范围内的城郭、村寨、关口与大篷车矢量图标。
 */
import { REGION_CATALOG, REGION_IDS } from '../../content/regions.ts';
import { regionTerrainArray } from '../../domain/regionGen.ts';
import { CARAVAN_VISION_RADIUS, exploredMaskArray } from '../../domain/routeDraw.ts';
import { TERRAIN_ORDER, worldRegionArray, worldTerrainArray } from '../../domain/worldGen.ts';
import type { CircusState, MapZoomMode, RegionMap, RouteEvaluation, TerrainType } from '../../types.ts';
import {
  collectVisibleGateMarkers,
  collectVisibleSettlementMarkers,
  drawCaravanIcon,
  drawCityIcon,
  drawGateIcon,
  drawVillageIcon,
  isSettlementRevealed,
} from './mapIcons.ts';

const TERRAIN_RGB: Record<TerrainType, [number, number, number]> = {
  outside: [214, 190, 148],
  ocean: [64, 102, 128],
  coast: [176, 184, 158],
  lake: [58, 112, 144],
  river: [68, 124, 156],
  bridge: [164, 114, 62],
  border_gate: [184, 115, 36],
  wasteland: [222, 200, 160],
  road: [184, 145, 94],
  forest: [92, 130, 90],
  swamp: [116, 128, 98],
  mountain: [136, 110, 84],
  ruin: [164, 132, 108],
  warzone: [168, 74, 62],
  city: [174, 68, 52],
  village: [194, 118, 62],
};

const FOG_RGB: [number, number, number] = [212, 189, 148];

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
  const aspect = canvasW / Math.max(1, canvasH);
  const viewH = 42;
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
        let isProvBorder = false;
        let isShoreline = false;
        if (x + 1 < world.width && y + 1 < world.height && x > 0 && y > 0) {
          const rightReg = regArr[idx + 1]!;
          const downReg = regArr[idx + world.width]!;
          if (rIdx < 9 && ((rightReg < 9 && rightReg !== rIdx) || (downReg < 9 && downReg !== rIdx))) {
            isProvBorder = true;
          }
          if (ter !== 'ocean') {
            if (
              TERRAIN_ORDER[terArr[idx + 1]!] === 'ocean' ||
              TERRAIN_ORDER[terArr[idx - 1]!] === 'ocean' ||
              TERRAIN_ORDER[terArr[idx + world.width]!] === 'ocean' ||
              TERRAIN_ORDER[terArr[idx - world.width]!] === 'ocean'
            ) {
              isShoreline = true;
            }
          }
        }
        const p = idx * 4;
        if (isShoreline) {
          data[p] = 88;
          data[p + 1] = 62;
          data[p + 2] = 38;
        } else if (isProvBorder) {
          data[p] = 122;
          data[p + 1] = 74;
          data[p + 2] = 44;
        } else {
          data[p] = rgb[0];
          data[p + 1] = rgb[1];
          data[p + 2] = rgb[2];
        }
        data[p + 3] = 255;
      }
    }
  });

  ctx.fillStyle = '#3c6480';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const topLeft = mapToCanvasPx(0, 0, vp);
  const botRight = mapToCanvasPx(world.width, world.height, vp);
  ctx.drawImage(off, topLeft.px, topLeft.py, botRight.px - topLeft.px, botRight.py - topLeft.py);

  // 已展开区域内的探明城郭与村寨微缩舆图图标
  for (const rId of REGION_IDS) {
    const rMap = state.world.regions[rId].map;
    if (!rMap) continue;
    const refPos = rId === state.world.currentRegionId ? state.world.pos : { x: -999, y: -999 };
    for (const poi of Object.values(rMap.pois)) {
      if (!isSettlementRevealed(rMap, poi, refPos)) continue;
      const wx = (rMap.worldOffsetX + poi.x) / 10;
      const wy = (rMap.worldOffsetY + poi.y) / 10;
      const pt = mapToCanvasPx(wx, wy, vp);
      if (poi.kind === 'city') drawCityIcon(ctx, pt.px, pt.py, 14, poi.scouted);
      else drawVillageIcon(ctx, pt.px, pt.py, 11, poi.scouted);
    }
  }

  // 标注 9 大自然疆域手写风名称
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const id of REGION_IDS) {
    const b = world.regionBounds[id];
    const pt = mapToCanvasPx(b.centerX, b.centerY, vp);
    const active = id === state.world.currentRegionId;
    const loaded = Boolean(state.world.regions[id].map);
    ctx.font = `${active ? '700 13px' : '600 11px'} "Noto Serif SC", serif`;
    ctx.strokeStyle = 'rgba(250, 242, 224, 0.92)';
    ctx.lineWidth = 3.2;
    ctx.strokeText(REGION_CATALOG[id].name, pt.px, pt.py);
    ctx.fillStyle = active ? '#a63429' : loaded ? '#2a1f18' : '#5e4b39';
    ctx.fillText(REGION_CATALOG[id].name, pt.px, pt.py);
  }

  // 绘制当前残响大篷车在世界地图上的专属篷车图标
  const curMap = state.world.regions[state.world.currentRegionId].map;
  if (curMap) {
    const wx = (curMap.worldOffsetX + state.world.pos.x) / 10;
    const wy = (curMap.worldOffsetY + state.world.pos.y) / 10;
    const pin = mapToCanvasPx(wx, wy, vp);
    drawCaravanIcon(ctx, pin.px, pin.py, 24);
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
          const shade = ((x + y) & 1) === 0 ? 4 : -4;
          data[p] = FOG_RGB[0] + shade;
          data[p + 1] = FOG_RGB[1] + shade;
          data[p + 2] = FOG_RGB[2] + shade;
          data[p + 3] = 255;
        } else {
          const rgb = TERRAIN_RGB[ter];
          const dim = !liveSeen && ter !== 'outside' ? 0.88 : 1;
          data[p] = Math.round(rgb[0] * dim + (1 - dim) * 228);
          data[p + 1] = Math.round(rgb[1] * dim + (1 - dim) * 208);
          data[p + 2] = Math.round(rgb[2] * dim + (1 - dim) * 174);
          data[p + 3] = 255;
        }
      }
    }
  });

  ctx.fillStyle = '#cfB588';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const p0 = mapToCanvasPx(0, 0, vp);
  const p1 = mapToCanvasPx(map.width, map.height, vp);
  ctx.drawImage(off, p0.px, p0.py, p1.px - p0.px, p1.py - p0.py);

  const pxPerTile = Math.min(vp.canvasW / vp.viewW, vp.canvasH / vp.viewH);
  const citySize = Math.max(20, Math.min(32, pxPerTile * 3.4));
  const villageSize = Math.max(16, Math.min(25, pxPerTile * 2.7));
  const gateSize = Math.max(15, Math.min(22, pxPerTile * 2.4));
  const caravanSize = Math.max(24, Math.min(36, pxPerTile * 3.8));

  // 手动划线路径预览（绘制在图标底层，避免墨线压脏图标）
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

  // 显示范围内且已探明的边界出境关口图标与铭牌
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const gate of collectVisibleGateMarkers(map, state.world.pos, vp)) {
    const pos = mapToCanvasPx(gate.x + 0.5, gate.y + 0.5, vp);
    drawGateIcon(ctx, pos.px, pos.py, gateSize);
    ctx.font = '600 10.5px "Noto Sans SC", sans-serif';
    ctx.strokeStyle = 'rgba(250, 242, 224, 0.92)';
    ctx.lineWidth = 2.8;
    const txt = `→ ${state.world.regions[gate.targetRegionId].name}`;
    ctx.strokeText(txt, pos.px, pos.py - gateSize * 0.56);
    ctx.fillStyle = '#564234';
    ctx.fillText(txt, pos.px, pos.py - gateSize * 0.56);
  }

  // 显示范围内且已探明的多格城市与荒原村寨专属图标 + 描边名牌
  const visiblePois = collectVisibleSettlementMarkers(map, state.world.pos, vp, state.world.currentPoiId);
  let parkedNearPoi = false;
  for (const marker of visiblePois) {
    if (Math.hypot(marker.x - cx, marker.y - cy) < 2.2) parkedNearPoi = true;
    const pos = mapToCanvasPx(marker.x + 0.5, marker.y + 0.5, vp);
    const sz = marker.kind === 'city' ? citySize : villageSize;
    if (marker.kind === 'city') {
      drawCityIcon(ctx, pos.px, pos.py, sz, marker.scouted);
    } else {
      drawVillageIcon(ctx, pos.px, pos.py, sz, marker.scouted);
    }
    ctx.font = marker.kind === 'city' ? '700 12px "Noto Serif SC", serif' : '600 11px "Noto Sans SC", sans-serif';
    ctx.strokeStyle = 'rgba(251, 243, 226, 0.95)';
    ctx.lineWidth = 3.2;
    ctx.strokeText(marker.label, pos.px, pos.py - sz * 0.58);
    ctx.fillStyle = marker.scouted ? '#261910' : '#6f5843';
    ctx.fillText(marker.label, pos.px, pos.py - sz * 0.58);
  }

  // 马车暖灯视野光圈与残响大篷车专属图标（驻扎聚落时轻微侧移并立，互不遮挡）
  const cPx = mapToCanvasPx(cx, cy, vp);
  const edgePx = mapToCanvasPx(cx + CARAVAN_VISION_RADIUS, cy, vp);
  const visPx = Math.max(14, Math.abs(edgePx.px - cPx.px));
  ctx.beginPath();
  ctx.arc(cPx.px, cPx.py, visPx, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(184, 115, 36, 0.48)';
  ctx.lineWidth = 1.3;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  const wagonOffsetX = parkedNearPoi ? caravanSize * 0.58 : 0;
  const wagonOffsetY = parkedNearPoi ? caravanSize * 0.20 : 0;
  drawCaravanIcon(ctx, cPx.px + wagonOffsetX, cPx.py + wagonOffsetY, caravanSize);
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
