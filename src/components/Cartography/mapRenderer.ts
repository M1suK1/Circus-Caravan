/**
 * 《八方旅人》风全屏底层铜版画舆图渲染器（最近邻锐利像素底图 + 高 DPI 屏幕空间版画笔触 + 连续无级缩放相机）。
 */
import { REGION_CATALOG, REGION_IDS } from '../../content/regions.ts';
import { regionTerrainArray } from '../../domain/regionGen.ts';
import { CARAVAN_VISION_RADIUS, exploredMaskArray } from '../../domain/routeDraw.ts';
import { TERRAIN_ORDER, valueNoise2d, worldTerrainArray } from '../../domain/worldGen.ts';
import type { CircusState, MapZoomMode, RegionMap, RouteEvaluation } from '../../types.ts';
import {
  rasterizeRegionCopperplate,
  rasterizeWorldCopperplate,
} from './copperplatePainter.ts';
import {
  collectVisibleGateMarkers,
  collectVisibleSettlementMarkers,
  drawCaravanIcon,
  drawCityIcon,
  drawGateIcon,
  drawOctopathBannerCallout,
  drawVillageIcon,
  isSettlementRevealed,
} from './mapIcons.ts';

export interface RegionCamera {
  /** 疆域缩放倍率：1.0 为疆域全览，5.2 对应跟随车队近景，最大支持 8.5× */
  zoomScale?: number;
  centerX?: number;
  centerY?: number;
}

export interface ViewportTransform {
  viewX: number;
  viewY: number;
  viewW: number;
  viewH: number;
  canvasW: number;
  canvasH: number;
  zoomScale: number;
}

export const MIN_REGION_ZOOM = 1;
export const MAX_REGION_ZOOM = 8.5;
export const FOLLOW_DEFAULT_ZOOM = 5.2;

interface CachedSurface {
  signature: string;
  canvas: HTMLCanvasElement;
}

const OFFSCREEN_CACHE = new WeakMap<object, CachedSurface>();

function getBakedPixelSurface(
  key: object,
  signature: string,
  w: number,
  h: number,
  rasterize: (buf: Uint8ClampedArray) => void,
): HTMLCanvasElement {
  const existing = OFFSCREEN_CACHE.get(key);
  if (existing && existing.signature === signature && existing.canvas.width === w && existing.canvas.height === h) {
    return existing.canvas;
  }
  const c = existing?.canvas ?? document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  rasterize(img.data);
  ctx.putImageData(img, 0, 0);
  OFFSCREEN_CACHE.set(key, { signature, canvas: c });
  return c;
}

function openStageBox(canvasW: number, canvasH: number) {
  const padLeft = canvasW >= 1000 ? canvasW * 0.12 : 16;
  const padRight = canvasW >= 1000 ? canvasW * 0.21 : 16;
  const padTop = canvasH >= 600 ? canvasH * 0.07 : 12;
  const padBottom = canvasH >= 600 ? canvasH * 0.05 : 12;
  const availW = Math.max(160, canvasW - padLeft - padRight);
  const availH = Math.max(140, canvasH - padTop - padBottom);
  return { padLeft, padTop, availW, availH };
}

export function computeViewport(
  state: CircusState,
  zoom: MapZoomMode,
  canvasW: number,
  canvasH: number,
  camera?: RegionCamera,
): ViewportTransform {
  const regionMap = state.world.regions[state.world.currentRegionId].map;
  if (zoom === 'world' || !regionMap) {
    return { viewX: 0, viewY: 0, viewW: 128, viewH: 128, canvasW, canvasH, zoomScale: 1 };
  }

  const { availW, availH } = openStageBox(canvasW, canvasH);
  const baseScale = Math.min(availW / regionMap.width, availH / regionMap.height);
  const defaultZoom = zoom === 'follow' ? FOLLOW_DEFAULT_ZOOM : 1;
  const zoomScale = Math.max(MIN_REGION_ZOOM, Math.min(MAX_REGION_ZOOM, camera?.zoomScale ?? defaultZoom));
  const scale = baseScale * zoomScale;
  const viewW = availW / scale;
  const viewH = availH / scale;

  const targetCx = camera?.centerX ?? (zoom === 'follow' ? state.world.pos.x : regionMap.width / 2);
  const targetCy = camera?.centerY ?? (zoom === 'follow' ? state.world.pos.y : regionMap.height / 2);

  const viewX = viewW >= regionMap.width
    ? (regionMap.width - viewW) / 2
    : Math.max(0, Math.min(regionMap.width - viewW, targetCx - viewW / 2));
  const viewY = viewH >= regionMap.height
    ? (regionMap.height - viewH) / 2
    : Math.max(0, Math.min(regionMap.height - viewH, targetCy - viewH / 2));

  return { viewX, viewY, viewW, viewH, canvasW, canvasH, zoomScale };
}

function stageMetrics(vp: ViewportTransform) {
  const { padLeft, padTop, availW, availH } = openStageBox(vp.canvasW, vp.canvasH);
  const scale = Math.min(availW / vp.viewW, availH / vp.viewH);
  const drawW = vp.viewW * scale;
  const drawH = vp.viewH * scale;
  const offX = padLeft + (availW - drawW) / 2;
  const offY = padTop + (availH - drawH) / 2;
  return { scale, offX, offY };
}

export function mapToCanvasPx(
  mx: number,
  my: number,
  vp: ViewportTransform,
): { px: number; py: number } {
  const { scale, offX, offY } = stageMetrics(vp);
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
  const { scale, offX, offY } = stageMetrics(vp);
  return {
    x: vp.viewX + (px - offX) / scale,
    y: vp.viewY + (py - offY) / scale,
  };
}

/**
 * 以鼠标所在屏幕像素 (cursorPx, cursorPy) 为锚点计算无级缩放后的相机中心，
 * 确保滚轮缩放前后光标下的地图格点纹丝不动。
 */
export function zoomRegionAroundCursor(
  state: CircusState,
  currentVp: ViewportTransform,
  cursorPx: number,
  cursorPy: number,
  rawNextZoom: number,
): Required<RegionCamera> {
  const regionMap = state.world.regions[state.world.currentRegionId].map;
  const zoomScale = Math.max(MIN_REGION_ZOOM, Math.min(MAX_REGION_ZOOM, Number(rawNextZoom.toFixed(3))));
  if (!regionMap) {
    return { zoomScale, centerX: state.world.pos.x, centerY: state.world.pos.y };
  }
  const anchor = canvasPxToMap(cursorPx, cursorPy, currentVp);
  const { padLeft, padTop, availW, availH } = openStageBox(currentVp.canvasW, currentVp.canvasH);
  const baseScale = Math.min(availW / regionMap.width, availH / regionMap.height);
  const nextScale = baseScale * zoomScale;
  const nextViewW = availW / nextScale;
  const nextViewH = availH / nextScale;
  const nextViewX = anchor.x - (cursorPx - padLeft) / nextScale;
  const nextViewY = anchor.y - (cursorPy - padTop) / nextScale;
  return {
    zoomScale,
    centerX: nextViewX + nextViewW / 2,
    centerY: nextViewY + nextViewH / 2,
  };
}

function paintSunburstAndVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sun = ctx.createRadialGradient(w * 0.46, h * 0.04, 10, w * 0.46, h * 0.08, Math.max(w, h) * 0.55);
  sun.addColorStop(0, 'rgba(255, 244, 206, 0.34)');
  sun.addColorStop(0.38, 'rgba(246, 214, 148, 0.12)');
  sun.addColorStop(1, 'rgba(246, 214, 148, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  const vig = ctx.createRadialGradient(w * 0.46, h * 0.5, Math.min(w, h) * 0.28, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  vig.addColorStop(0, 'rgba(32, 20, 10, 0)');
  vig.addColorStop(0.78, 'rgba(34, 22, 12, 0.16)');
  vig.addColorStop(1, 'rgba(20, 13, 8, 0.48)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** 在最近邻锐利像素底图之上，按主画布高 DPI 分辨率绘制山峰人字笔触与林木墨弧（杜绝低分放大糊化） */
function paintWorldScreenInk(ctx: CanvasRenderingContext2D, state: CircusState, vp: ViewportTransform): void {
  const world = state.world.worldMap;
  const terArr = worldTerrainArray(world);
  const { scale } = stageMetrics(vp);
  if (scale < 2.2) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let y = 3; y < world.height - 3; y += 2) {
    for (let x = 3; x < world.width - 3; x += 2) {
      const ter = TERRAIN_ORDER[terArr[y * world.width + x]!] ?? 'ocean';
      if (ter !== 'mountain' && ter !== 'forest') continue;
      const jx = (valueNoise2d(x, y, 1.7, world.seed + 41) - 0.5) * 0.6;
      const jy = (valueNoise2d(x, y, 1.7, world.seed + 83) - 0.5) * 0.6;
      const { px, py } = mapToCanvasPx(x + 0.5 + jx, y + 0.5 + jy, vp);

      if (ter === 'mountain') {
        const mw = scale * 1.15;
        const mh = scale * 1.05;
        ctx.beginPath();
        ctx.moveTo(px - mw, py + mh * 0.75);
        ctx.lineTo(px, py - mh);
        ctx.lineTo(px + mw, py + mh * 0.75);
        ctx.strokeStyle = 'rgba(44, 26, 13, 0.82)';
        ctx.lineWidth = Math.max(1.1, scale * 0.22);
        ctx.stroke();
      } else if (((x + y) & 2) === 0) {
        ctx.beginPath();
        ctx.arc(px, py, scale * 0.52, Math.PI, 0);
        ctx.strokeStyle = 'rgba(58, 50, 30, 0.56)';
        ctx.lineWidth = Math.max(1.0, scale * 0.18);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function paintRegionScreenInk(
  ctx: CanvasRenderingContext2D,
  map: RegionMap,
  caravanPos: { x: number; y: number },
  vp: ViewportTransform,
): void {
  const { scale } = stageMetrics(vp);
  if (scale < 1.8) return;
  const terArr = regionTerrainArray(map);
  const mask = exploredMaskArray(map);
  const cx = caravanPos.x;
  const cy = caravanPos.y;
  const r2 = CARAVAN_VISION_RADIUS * CARAVAN_VISION_RADIUS;

  const minX = Math.max(2, Math.floor(vp.viewX - 4));
  const maxX = Math.min(map.width - 3, Math.ceil(vp.viewX + vp.viewW + 4));
  const minY = Math.max(2, Math.floor(vp.viewY - 4));
  const maxY = Math.min(map.height - 3, Math.ceil(vp.viewY + vp.viewH + 4));

  const isRevealed = (x: number, y: number): boolean => {
    const idx = y * map.width + x;
    return Boolean((mask[idx >> 3]! >> (idx & 7)) & 1) || (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2;
  };

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const step = scale >= 7 ? 2 : 3;

  for (let y = minY - (minY % step); y <= maxY; y += step) {
    for (let x = minX - (minX % step); x <= maxX; x += step) {
      if (x < 2 || y < 2) continue;
      const ter = TERRAIN_ORDER[terArr[y * map.width + x]!] ?? 'outside';
      if (ter === 'outside') continue;
      const rev = isRevealed(x, y);

      if (!rev) {
        if (isRevealed(x - 2, y) || isRevealed(x + 2, y) || isRevealed(x, y - 2) || isRevealed(x, y + 2)) {
          const { px, py } = mapToCanvasPx(x + 0.5, y + 0.5, vp);
          const cr = (1.7 + valueNoise2d(x, y, 2.8, map.seed + 701) * 1.1) * scale;
          ctx.beginPath();
          ctx.arc(px, py, cr, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(248, 236, 210, 0.84)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(116, 86, 52, 0.48)';
          ctx.lineWidth = Math.max(1.0, scale * 0.2);
          ctx.stroke();
        }
        continue;
      }

      if (ter === 'mountain') {
        const { px, py } = mapToCanvasPx(x + 0.5, y + 0.5, vp);
        const mw = scale * 1.45;
        const mh = scale * 1.3;
        ctx.beginPath();
        ctx.moveTo(px - mw, py + mh * 0.72);
        ctx.lineTo(px, py - mh);
        ctx.lineTo(px + mw, py + mh * 0.72);
        ctx.strokeStyle = 'rgba(44, 26, 13, 0.82)';
        ctx.lineWidth = Math.max(1.15, scale * 0.22);
        ctx.stroke();
      } else if (ter === 'forest') {
        const { px, py } = mapToCanvasPx(x + 0.5, y + 0.5, vp);
        ctx.beginPath();
        ctx.arc(px - scale * 0.42, py + scale * 0.15, scale * 0.62, Math.PI, 0);
        ctx.arc(px + scale * 0.45, py + scale * 0.15, scale * 0.56, Math.PI, 0);
        ctx.strokeStyle = 'rgba(58, 50, 30, 0.56)';
        ctx.lineWidth = Math.max(1.0, scale * 0.18);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawWorldCanvas(canvas: HTMLCanvasElement, state: CircusState, vp: ViewportTransform): void {
  const ctx = canvas.getContext('2d')!;
  const world = state.world.worldMap;
  const sig = `world-px:${world.seed}:${world.terrainBase64.length}`;

  const off = getBakedPixelSurface(
    world,
    sig,
    world.width,
    world.height,
    buf => rasterizeWorldCopperplate(world, buf),
  );

  ctx.fillStyle = '#7e8781';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(54, 46, 36, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 6; y < canvas.height; y += 7) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  for (let x = 48; x < canvas.width; x += 96) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  ctx.stroke();

  // 强制最近邻像素采样并对齐整数物理像素，彻底消除 128×128 大陆全图插值发糊
  ctx.imageSmoothingEnabled = false;
  const topLeft = mapToCanvasPx(0, 0, vp);
  const botRight = mapToCanvasPx(world.width, world.height, vp);
  const dx = Math.round(topLeft.px);
  const dy = Math.round(topLeft.py);
  const dw = Math.round(botRight.px - topLeft.px);
  const dh = Math.round(botRight.py - topLeft.py);
  ctx.drawImage(off, dx, dy, dw, dh);

  paintWorldScreenInk(ctx, state, vp);
  paintSunburstAndVignette(ctx, canvas.width, canvas.height);

  for (const rId of REGION_IDS) {
    const rMap = state.world.regions[rId].map;
    if (!rMap) continue;
    const refPos = rId === state.world.currentRegionId ? state.world.pos : { x: -999, y: -999 };
    for (const poi of Object.values(rMap.pois)) {
      if (!isSettlementRevealed(rMap, poi, refPos)) continue;
      const wx = (rMap.worldOffsetX + poi.x + 0.5) / 10;
      const wy = (rMap.worldOffsetY + poi.y + 0.5) / 10;
      const pt = mapToCanvasPx(wx, wy, vp);
      if (poi.kind === 'city') drawCityIcon(ctx, pt.px, pt.py, 15, poi.scouted);
      else drawVillageIcon(ctx, pt.px, pt.py, 12, poi.scouted);
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const id of REGION_IDS) {
    const b = world.regionBounds[id];
    const pt = mapToCanvasPx(b.centerX + 0.5, b.centerY + 0.5, vp);
    const meta = REGION_CATALOG[id];
    if (id === state.world.currentRegionId) {
      drawOctopathBannerCallout(ctx, pt.px, pt.py - 4, meta.name, `危级 LV.${meta.dangerTier}`, true);
    } else {
      const loaded = Boolean(state.world.regions[id].map);
      ctx.font = '600 12px "Noto Serif SC", serif';
      ctx.strokeStyle = 'rgba(244, 230, 198, 0.9)';
      ctx.lineWidth = 3;
      ctx.strokeText(meta.name, pt.px, pt.py);
      ctx.fillStyle = loaded ? '#23170e' : '#4f3e2d';
      ctx.fillText(meta.name, pt.px, pt.py);
    }
  }

  const curMap = state.world.regions[state.world.currentRegionId].map;
  if (curMap) {
    const wx = (curMap.worldOffsetX + state.world.pos.x) / 10;
    const wy = (curMap.worldOffsetY + state.world.pos.y) / 10;
    const pin = mapToCanvasPx(wx, wy, vp);
    drawCaravanIcon(ctx, pin.px, pin.py, 26);
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
  const cx = state.world.pos.x;
  const cy = state.world.pos.y;
  const sig = `reg-px:${map.seed}:${map.exploredMaskBase64}:${Math.floor(cx)}:${Math.floor(cy)}`;

  const off = getBakedPixelSurface(
    map,
    sig,
    map.width,
    map.height,
    buf => rasterizeRegionCopperplate(map, state.world.pos, buf),
  );

  ctx.fillStyle = '#c4ac84';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 疆域底图同样强制最近邻锐利像素贴图，缩放至任何倍率皆清晰分明
  ctx.imageSmoothingEnabled = false;
  const p0 = mapToCanvasPx(0, 0, vp);
  const p1 = mapToCanvasPx(map.width, map.height, vp);
  ctx.drawImage(
    off,
    Math.round(p0.px),
    Math.round(p0.py),
    Math.round(p1.px - p0.px),
    Math.round(p1.py - p0.py),
  );

  paintRegionScreenInk(ctx, map, state.world.pos, vp);
  paintSunburstAndVignette(ctx, canvas.width, canvas.height);

  const { scale: pxPerTile } = stageMetrics(vp);
  const citySize = Math.max(21, Math.min(34, pxPerTile * 3.2));
  const villageSize = Math.max(17, Math.min(26, pxPerTile * 2.5));
  const gateSize = Math.max(16, Math.min(23, pxPerTile * 2.3));
  const caravanSize = Math.max(24, Math.min(36, pxPerTile * 3.5));

  if (routeDraft && routeDraft.points.length >= 2) {
    if (routeDraft.validPoints.length >= 2) {
      ctx.beginPath();
      const first = mapToCanvasPx(routeDraft.validPoints[0]!.x, routeDraft.validPoints[0]!.y, vp);
      ctx.moveTo(first.px, first.py);
      for (let i = 1; i < routeDraft.validPoints.length; i += 1) {
        const p = mapToCanvasPx(routeDraft.validPoints[i]!.x, routeDraft.validPoints[i]!.y, vp);
        ctx.lineTo(p.px, p.py);
      }
      ctx.strokeStyle = 'rgba(250, 236, 204, 0.78)';
      ctx.lineWidth = 4.6;
      ctx.stroke();
      ctx.setLineDash([7, 4]);
      ctx.strokeStyle = '#22150c';
      ctx.lineWidth = 2.4;
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
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const gate of collectVisibleGateMarkers(map, state.world.pos, vp)) {
    const pos = mapToCanvasPx(gate.x + 0.5, gate.y + 0.5, vp);
    drawGateIcon(ctx, pos.px, pos.py, gateSize);
    const destMeta = state.world.regions[gate.targetRegionId];
    drawOctopathBannerCallout(ctx, pos.px, pos.py - gateSize * 0.45, `往 ${destMeta.name}`, `危级 LV.${destMeta.dangerTier}`, false);
  }

  const visiblePois = collectVisibleSettlementMarkers(map, state.world.pos, vp, state.world.currentPoiId);
  const regDanger = state.world.regions[state.world.currentRegionId].dangerTier;
  for (const marker of visiblePois) {
    const pos = mapToCanvasPx(marker.x + 0.5, marker.y + 0.5, vp);
    const sz = marker.kind === 'city' ? citySize : villageSize;
    const overlapCaravan = Math.hypot(marker.x + 0.5 - cx, marker.y + 0.5 - cy) < 2.0;
    const bannerLift = overlapCaravan ? Math.max(sz * 0.55, caravanSize * 0.78) : sz * 0.5;
    if (marker.kind === 'city') {
      drawCityIcon(ctx, pos.px, pos.py, sz, marker.scouted);
      drawOctopathBannerCallout(
        ctx,
        pos.px,
        pos.py - bannerLift,
        marker.label,
        marker.scouted ? `危级 LV.${regDanger}` : '待侦查',
        marker.isCurrent || marker.scouted,
      );
    } else {
      drawVillageIcon(ctx, pos.px, pos.py, sz, marker.scouted);
      if (marker.isCurrent) {
        drawOctopathBannerCallout(ctx, pos.px, pos.py - bannerLift, marker.label, '驻扎中', true);
      } else {
        ctx.font = '600 11.5px "Noto Serif SC", serif';
        ctx.strokeStyle = 'rgba(250, 240, 216, 0.94)';
        ctx.lineWidth = 3.2;
        ctx.strokeText(marker.label, pos.px, pos.py - sz * 0.58);
        ctx.fillStyle = marker.scouted ? '#1f140c' : '#5b4734';
        ctx.fillText(marker.label, pos.px, pos.py - sz * 0.58);
      }
    }
  }

  // 大篷车图标严格锚定在真实逻辑坐标 (cx, cy) 正中心，确保指针划线起点 1:1 零偏移
  const cPx = mapToCanvasPx(cx, cy, vp);
  const edgePx = mapToCanvasPx(cx + CARAVAN_VISION_RADIUS, cy, vp);
  const visPx = Math.max(14, Math.abs(edgePx.px - cPx.px));
  ctx.beginPath();
  ctx.arc(cPx.px, cPx.py, visPx, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(218, 162, 68, 0.52)';
  ctx.lineWidth = 1.3;
  ctx.setLineDash([6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  drawCaravanIcon(ctx, cPx.px, cPx.py, caravanSize);
}

export function renderCartographyCanvas(
  canvas: HTMLCanvasElement,
  state: CircusState,
  zoom: MapZoomMode,
  routeDraft: RouteEvaluation | null,
  camera?: RegionCamera,
): ViewportTransform {
  const vp = computeViewport(state, zoom, canvas.width, canvas.height, camera);
  const regionMap = state.world.regions[state.world.currentRegionId].map;
  if (zoom === 'world' || !regionMap) {
    drawWorldCanvas(canvas, state, vp);
  } else {
    drawRegionCanvas(canvas, state, regionMap, vp, routeDraft);
  }
  return vp;
}
