/**
 * 《八方旅人》风全屏底层铜版画三级舆图渲染器。
 *
 * 将离屏铜版画立体浮雕底图（copperplatePainter）与菱形纹章、黑针危级标牌及大篷车图标合成输出，
 * 自动感知左右悬浮墨栏留白，把地图黄金视觉焦点稳稳锚定在屏幕开放视野中央。
 */
import { REGION_CATALOG, REGION_IDS } from '../../content/regions.ts';
import { CARAVAN_VISION_RADIUS } from '../../domain/routeDraw.ts';
import type { CircusState, MapZoomMode, RegionMap, RouteEvaluation } from '../../types.ts';
import {
  paintRegionCopperplateDetails,
  paintWorldCopperplateDetails,
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

export interface ViewportTransform {
  viewX: number;
  viewY: number;
  viewW: number;
  viewH: number;
  canvasW: number;
  canvasH: number;
}

interface CachedSurface {
  signature: string;
  canvas: HTMLCanvasElement;
}

const OFFSCREEN_CACHE = new WeakMap<object, CachedSurface>();

function getBakedOffscreen(
  key: object,
  signature: string,
  w: number,
  h: number,
  rasterize: (buf: Uint8ClampedArray) => void,
  paintVectors: (ctx: CanvasRenderingContext2D) => void,
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
  paintVectors(ctx);
  OFFSCREEN_CACHE.set(key, { signature, canvas: c });
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
  const availW = canvasW >= 1000 ? canvasW * 0.67 : Math.max(160, canvasW - 32);
  const availH = canvasH >= 600 ? canvasH * 0.88 : Math.max(140, canvasH - 24);
  const aspect = availW / Math.max(1, availH);
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

function stageMetrics(vp: ViewportTransform) {
  // 留出左侧悬浮尖角选单与右侧半透明队伍栏的视觉重心偏置，使大陆主体居于开阔区中央
  const padLeft = vp.canvasW >= 1000 ? vp.canvasW * 0.12 : 16;
  const padRight = vp.canvasW >= 1000 ? vp.canvasW * 0.21 : 16;
  const padTop = vp.canvasH >= 600 ? vp.canvasH * 0.07 : 12;
  const padBottom = vp.canvasH >= 600 ? vp.canvasH * 0.05 : 12;
  const availW = Math.max(160, vp.canvasW - padLeft - padRight);
  const availH = Math.max(140, vp.canvasH - padTop - padBottom);
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

function paintSunburstAndVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // 顶部星盘下方暖阳金光漫射（复刻《八方旅人》地图顶部圣光感）
  const sun = ctx.createRadialGradient(w * 0.46, h * 0.04, 10, w * 0.46, h * 0.08, Math.max(w, h) * 0.55);
  sun.addColorStop(0, 'rgba(255, 244, 206, 0.38)');
  sun.addColorStop(0.38, 'rgba(246, 214, 148, 0.14)');
  sun.addColorStop(1, 'rgba(246, 214, 148, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  // 四周古旧烟熏暗角，与外围雕花金框及左右墨栏自然过渡
  const vig = ctx.createRadialGradient(w * 0.46, h * 0.5, Math.min(w, h) * 0.28, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  vig.addColorStop(0, 'rgba(32, 20, 10, 0)');
  vig.addColorStop(0.76, 'rgba(34, 22, 12, 0.18)');
  vig.addColorStop(1, 'rgba(20, 13, 8, 0.52)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function drawWorldCanvas(canvas: HTMLCanvasElement, state: CircusState, vp: ViewportTransform): void {
  const ctx = canvas.getContext('2d')!;
  const world = state.world.worldMap;
  const sig = `world:${world.seed}:${world.terrainBase64.length}`;

  const off = getBakedOffscreen(
    world,
    sig,
    world.width,
    world.height,
    buf => rasterizeWorldCopperplate(world, buf),
    offCtx => paintWorldCopperplateDetails(offCtx, world),
  );

  // 全屏底图外延铺满古铜版海面底色与细排线经纬网，使宽屏左右墨栏底下亦呈现连贯海图肌理
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

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const topLeft = mapToCanvasPx(0, 0, vp);
  const botRight = mapToCanvasPx(world.width, world.height, vp);
  ctx.drawImage(off, topLeft.px, topLeft.py, botRight.px - topLeft.px, botRight.py - topLeft.py);

  paintSunburstAndVignette(ctx, canvas.width, canvas.height);

  // 已展开区域内的探明城郭与村寨菱形微缩纹章
  for (const rId of REGION_IDS) {
    const rMap = state.world.regions[rId].map;
    if (!rMap) continue;
    const refPos = rId === state.world.currentRegionId ? state.world.pos : { x: -999, y: -999 };
    for (const poi of Object.values(rMap.pois)) {
      if (!isSettlementRevealed(rMap, poi, refPos)) continue;
      const wx = (rMap.worldOffsetX + poi.x) / 10;
      const wy = (rMap.worldOffsetY + poi.y) / 10;
      const pt = mapToCanvasPx(wx, wy, vp);
      if (poi.kind === 'city') drawCityIcon(ctx, pt.px, pt.py, 15, poi.scouted);
      else drawVillageIcon(ctx, pt.px, pt.py, 12, poi.scouted);
    }
  }

  // 标注 9 大自然疆域：当前所在疆域立起八方旅人竖向黑针危级标牌，其余疆域采用古典铜版衬线铭文
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const id of REGION_IDS) {
    const b = world.regionBounds[id];
    const pt = mapToCanvasPx(b.centerX, b.centerY, vp);
    const meta = REGION_CATALOG[id];
    if (id === state.world.currentRegionId) {
      drawOctopathBannerCallout(ctx, pt.px, pt.py - 4, meta.name, `危级 LV.${meta.dangerTier}`, true);
    } else {
      const loaded = Boolean(state.world.regions[id].map);
      ctx.font = '600 12px "Noto Serif SC", serif';
      ctx.strokeStyle = 'rgba(244, 230, 198, 0.88)';
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
  const sig = `reg:${map.seed}:${map.exploredMaskBase64}:${Math.round(cx)}:${Math.round(cy)}`;

  const off = getBakedOffscreen(
    map,
    sig,
    map.width,
    map.height,
    buf => rasterizeRegionCopperplate(map, state.world.pos, buf),
    offCtx => paintRegionCopperplateDetails(offCtx, map, state.world.pos),
  );

  ctx.fillStyle = '#c4ac84';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.imageSmoothingEnabled = vp.viewW > 90;
  const p0 = mapToCanvasPx(0, 0, vp);
  const p1 = mapToCanvasPx(map.width, map.height, vp);
  ctx.drawImage(off, p0.px, p0.py, p1.px - p0.px, p1.py - p0.py);

  paintSunburstAndVignette(ctx, canvas.width, canvas.height);

  const { scale: pxPerTile } = stageMetrics(vp);
  const citySize = Math.max(22, Math.min(34, pxPerTile * 3.5));
  const villageSize = Math.max(17, Math.min(26, pxPerTile * 2.8));
  const gateSize = Math.max(16, Math.min(23, pxPerTile * 2.5));
  const caravanSize = Math.max(25, Math.min(38, pxPerTile * 3.9));

  // 手动划线路径预览（古典深褐双层墨迹 + 受阻朱砂红虚线）
  if (routeDraft && routeDraft.points.length >= 2) {
    if (routeDraft.validPoints.length >= 2) {
      ctx.beginPath();
      const first = mapToCanvasPx(routeDraft.validPoints[0]!.x, routeDraft.validPoints[0]!.y, vp);
      ctx.moveTo(first.px, first.py);
      for (let i = 1; i < routeDraft.validPoints.length; i += 1) {
        const p = mapToCanvasPx(routeDraft.validPoints[i]!.x, routeDraft.validPoints[i]!.y, vp);
        ctx.lineTo(p.px, p.py);
      }
      ctx.strokeStyle = 'rgba(250, 236, 204, 0.75)';
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

  // 显示范围内已探明的跨区关口菱形图标与指引铭牌
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const gate of collectVisibleGateMarkers(map, state.world.pos, vp)) {
    const pos = mapToCanvasPx(gate.x + 0.5, gate.y + 0.5, vp);
    drawGateIcon(ctx, pos.px, pos.py, gateSize);
    const destMeta = state.world.regions[gate.targetRegionId];
    drawOctopathBannerCallout(ctx, pos.px, pos.py - gateSize * 0.45, `往 ${destMeta.name}`, `危级 LV.${destMeta.dangerTier}`, false);
  }

  // 显示范围内已探明的城郭与村寨：菱形纹章 + 八方旅人竖向黑针标牌
  const visiblePois = collectVisibleSettlementMarkers(map, state.world.pos, vp, state.world.currentPoiId);
  const regDanger = state.world.regions[state.world.currentRegionId].dangerTier;
  let parkedNearPoi = false;
  for (const marker of visiblePois) {
    if (Math.hypot(marker.x - cx, marker.y - cy) < 2.2) parkedNearPoi = true;
    const pos = mapToCanvasPx(marker.x + 0.5, marker.y + 0.5, vp);
    const sz = marker.kind === 'city' ? citySize : villageSize;
    if (marker.kind === 'city') {
      drawCityIcon(ctx, pos.px, pos.py, sz, marker.scouted);
      drawOctopathBannerCallout(
        ctx,
        pos.px,
        pos.py - sz * 0.5,
        marker.label,
        marker.scouted ? `危级 LV.${regDanger}` : '待侦查',
        marker.isCurrent || marker.scouted,
      );
    } else {
      drawVillageIcon(ctx, pos.px, pos.py, sz, marker.scouted);
      if (marker.isCurrent) {
        drawOctopathBannerCallout(ctx, pos.px, pos.py - sz * 0.48, marker.label, '驻扎中', true);
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

  // 大篷车风灯视野金环与专属篷车棋子
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

  const wagonOffsetX = parkedNearPoi ? caravanSize * 0.62 : 0;
  const wagonOffsetY = parkedNearPoi ? caravanSize * 0.22 : 0;
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
