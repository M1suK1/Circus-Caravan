/**
 * 《八方旅人》风双墨边象牙菱形地标纹章、竖向黑针危级标牌与大篷车棋子图标。
 */
import { isLandmarkRevealed } from '../../domain/landmarks.ts';
import { CARAVAN_VISION_RADIUS, exploredMaskArray } from '../../domain/routeDraw.ts';
import type { FieldLandmark, LandmarkKind, RegionGate, RegionMap, SettlementPoi } from '../../types.ts';

export interface MapViewportBounds {
  viewX: number;
  viewY: number;
  viewW: number;
  viewH: number;
  canvasW: number;
  canvasH: number;
}

export interface VisibleSettlementMarker {
  id: string;
  kind: 'city' | 'village';
  x: number;
  y: number;
  label: string;
  scouted: boolean;
  isCurrent: boolean;
}

export function isPointInViewport(
  x: number,
  y: number,
  vp: MapViewportBounds,
  marginTiles = 2.5,
): boolean {
  return (
    x >= vp.viewX - marginTiles &&
    x <= vp.viewX + vp.viewW + marginTiles &&
    y >= vp.viewY - marginTiles &&
    y <= vp.viewY + vp.viewH + marginTiles
  );
}

export function isSettlementRevealed(
  map: RegionMap,
  poi: SettlementPoi,
  caravanPos: { x: number; y: number },
): boolean {
  const mask = exploredMaskArray(map);
  const r2 = CARAVAN_VISION_RADIUS * CARAVAN_VISION_RADIUS;
  if ((poi.x - caravanPos.x) ** 2 + (poi.y - caravanPos.y) ** 2 <= r2) return true;
  const anchorIdx = poi.y * map.width + poi.x;
  if (Boolean((mask[anchorIdx >> 3]! >> (anchorIdx & 7)) & 1)) return true;
  for (const cell of poi.footprint) {
    if ((cell.x - caravanPos.x) ** 2 + (cell.y - caravanPos.y) ** 2 <= r2) return true;
    const idx = cell.y * map.width + cell.x;
    if (Boolean((mask[idx >> 3]! >> (idx & 7)) & 1)) return true;
  }
  return false;
}

export function collectVisibleSettlementMarkers(
  map: RegionMap,
  caravanPos: { x: number; y: number },
  vp: MapViewportBounds,
  currentPoiId?: string,
): VisibleSettlementMarker[] {
  const out: VisibleSettlementMarker[] = [];
  for (const poi of Object.values(map.pois)) {
    if (!isPointInViewport(poi.x, poi.y, vp)) continue;
    if (!isSettlementRevealed(map, poi, caravanPos)) continue;
    out.push({
      id: poi.id,
      kind: poi.kind,
      x: poi.x,
      y: poi.y,
      label: poi.scouted && poi.details ? poi.details.name : poi.placeholderName,
      scouted: poi.scouted,
      isCurrent: poi.id === currentPoiId,
    });
  }
  return out;
}

export function collectVisibleGateMarkers(
  map: RegionMap,
  caravanPos: { x: number; y: number },
  vp: MapViewportBounds,
): RegionGate[] {
  const mask = exploredMaskArray(map);
  const r2 = CARAVAN_VISION_RADIUS * CARAVAN_VISION_RADIUS;
  return map.gates.filter(gate => {
    if (!isPointInViewport(gate.x, gate.y, vp)) return false;
    const idx = gate.y * map.width + gate.x;
    const explored = Boolean((mask[idx >> 3]! >> (idx & 7)) & 1);
    const liveSeen = (gate.x - caravanPos.x) ** 2 + (gate.y - caravanPos.y) ** 2 <= r2;
    return explored || liveSeen;
  });
}

function drawDiamondCrestBase(ctx: CanvasRenderingContext2D, r: number, active: boolean): void {
  // 底部墨影
  ctx.beginPath();
  ctx.moveTo(0, -r + 2);
  ctx.lineTo(r, 2);
  ctx.lineTo(0, r + 2.5);
  ctx.lineTo(-r, 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(18, 12, 8, 0.44)';
  ctx.fill();

  // 外层深炭黑铁墨框菱形
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r, 0);
  ctx.closePath();
  ctx.fillStyle = active ? '#fbf2dc' : '#ead9b7';
  ctx.fill();
  ctx.lineWidth = Math.max(1.6, r * 0.14);
  ctx.strokeStyle = '#1b130d';
  ctx.stroke();

  // 内层细金铜版压线
  const ir = r * 0.78;
  ctx.beginPath();
  ctx.moveTo(0, -ir);
  ctx.lineTo(ir, 0);
  ctx.lineTo(0, ir);
  ctx.lineTo(-ir, 0);
  ctx.closePath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = active ? '#a87634' : '#7b6346';
  ctx.stroke();
}

/** 八方旅人风多格城郭图标：双黑边象牙菱形底章 + 双塔城垣与尖顶主堡版画雕刻 */
export function drawCityIcon(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  scouted: boolean,
): void {
  const r = size * 0.62;
  ctx.save();
  ctx.translate(px, py);
  drawDiamondCrestBase(ctx, r, scouted);

  const u = size * 0.042;
  ctx.fillStyle = scouted ? '#e7cba0' : '#cab592';
  ctx.strokeStyle = '#22160e';
  ctx.lineWidth = Math.max(1.1, size * 0.055);
  ctx.beginPath();
  ctx.rect(-7.2 * u, -1.8 * u, 3.8 * u, 7.8 * u);
  ctx.rect(3.4 * u, -1.8 * u, 3.8 * u, 7.8 * u);
  ctx.rect(-3.8 * u, -0.4 * u, 7.6 * u, 6.4 * u);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-4.6 * u, -0.4 * u);
  ctx.lineTo(0, -7.8 * u);
  ctx.lineTo(4.6 * u, -0.4 * u);
  ctx.closePath();
  ctx.fillStyle = scouted ? '#9e3125' : '#66523e';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 6.0 * u, 1.9 * u, Math.PI, 0);
  ctx.fillStyle = '#24170f';
  ctx.fill();
  ctx.restore();
}

/** 八方旅人风荒原村寨图标：双黑边象牙菱形底章 + 斜顶木屋聚落版画 */
export function drawVillageIcon(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  scouted: boolean,
): void {
  const r = size * 0.56;
  ctx.save();
  ctx.translate(px, py);
  drawDiamondCrestBase(ctx, r, scouted);

  const u = size * 0.045;
  ctx.fillStyle = scouted ? '#f2dfc0' : '#d2be9c';
  ctx.strokeStyle = '#24170f';
  ctx.lineWidth = Math.max(1.05, size * 0.055);
  ctx.beginPath();
  ctx.rect(-4.8 * u, -0.2 * u, 9.6 * u, 5.8 * u);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-6.4 * u, 0.3 * u);
  ctx.lineTo(0, -6.2 * u);
  ctx.lineTo(6.4 * u, 0.3 * u);
  ctx.closePath();
  ctx.fillStyle = scouted ? '#b86328' : '#735c44';
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = scouted ? '#d9922e' : '#4d3b2b';
  ctx.fillRect(-1.4 * u, 1.8 * u, 2.8 * u, 3.7 * u);
  ctx.restore();
}

/** 绘制跨区边境石拱门菱形路标图标 */
export function drawGateIcon(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
): void {
  const r = size * 0.52;
  const u = size * 0.045;
  ctx.save();
  ctx.translate(px, py);
  drawDiamondCrestBase(ctx, r, true);

  ctx.strokeStyle = '#23160e';
  ctx.fillStyle = '#ba7b2d';
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.rect(-5.0 * u, -4.4 * u, 10.0 * u, 2.2 * u);
  ctx.rect(-4.1 * u, -2.2 * u, 2.4 * u, 7.2 * u);
  ctx.rect(1.7 * u, -2.2 * u, 2.4 * u, 7.2 * u);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * 绘制《八方旅人》标志性「竖向黑针引线 + 半透明烟熏黑褐金线标牌 + 危级侧翼小标签」。
 */
export function drawOctopathBannerCallout(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  title: string,
  badgeText?: string,
  emphasized = false,
): void {
  ctx.save();
  ctx.font = `${emphasized ? '700 13px' : '600 11.5px'} "Noto Serif SC", serif`;
  const titleW = Math.max(54, ctx.measureText(title).width);
  const badgeW = badgeText ? Math.max(46, badgeText.length * 8.5 + 12) : 0;
  const boxW = titleW + 22 + (badgeW ? badgeW + 6 : 0);
  const boxH = emphasized ? 23 : 20;
  const needleLen = emphasized ? 17 : 12;
  const boxTop = py - needleLen - boxH;
  const boxLeft = px - boxW / 2;

  // 竖向锋利黑针尖刺（Sunshade Catacombs / 诺布尔寇德 同款）
  ctx.beginPath();
  ctx.moveTo(px, py - 2);
  ctx.lineTo(px - 3.2, py - needleLen);
  ctx.lineTo(px + 3.2, py - needleLen);
  ctx.closePath();
  ctx.fillStyle = 'rgba(15, 11, 8, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(224, 188, 122, 0.72)';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // 半透明烟熏黑褐横幅底板 + 上下双金细线
  ctx.fillStyle = emphasized ? 'rgba(16, 12, 9, 0.9)' : 'rgba(22, 17, 13, 0.82)';
  ctx.fillRect(boxLeft, boxTop, boxW, boxH);
  ctx.strokeStyle = emphasized ? 'rgba(236, 198, 126, 0.85)' : 'rgba(206, 172, 112, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(boxLeft, boxTop);
  ctx.lineTo(boxLeft + boxW, boxTop);
  ctx.moveTo(boxLeft, boxTop + boxH);
  ctx.lineTo(boxLeft + boxW, boxTop + boxH);
  ctx.stroke();

  // 标题衬线白金文字
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = emphasized ? '#fff5df' : '#f2e4c8';
  ctx.fillText(title, boxLeft + 10, boxTop + boxH / 2 + 0.5);

  // 右侧危级 / 状态徽章（如「危级 LV.3」）
  if (badgeText) {
    const bx = boxLeft + 12 + titleW;
    const by = boxTop + 3;
    const bh = boxH - 6;
    ctx.fillStyle = emphasized ? 'rgba(158, 49, 38, 0.88)' : 'rgba(62, 46, 30, 0.88)';
    ctx.fillRect(bx, by, badgeW, bh);
    ctx.font = '600 9.5px "JetBrains Mono", "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fae7c0';
    ctx.fillText(badgeText, bx + badgeW / 2, boxTop + boxH / 2 + 0.5);
  }

  ctx.restore();
}

/** 绘制残响大篷车专属风灯篷车棋子图标 */
export function drawCaravanIcon(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
): void {
  const u = size * 0.042;
  ctx.save();
  ctx.translate(px, py);

  const glow = ctx.createRadialGradient(0, 0, size * 0.08, 0, 0, size * 0.84);
  glow.addColorStop(0, 'rgba(255, 224, 128, 0.85)');
  glow.addColorStop(0.52, 'rgba(222, 142, 42, 0.32)');
  glow.addColorStop(1, 'rgba(222, 142, 42, 0)');
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.84, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, 8.6 * u, 11 * u, 3.2 * u, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20, 12, 6, 0.48)';
  ctx.fill();

  // 车顶迎风巡游三角旗
  ctx.beginPath();
  ctx.moveTo(-1 * u, -8.8 * u);
  ctx.lineTo(-1 * u, -13.5 * u);
  ctx.lineTo(5.6 * u, -11.4 * u);
  ctx.lineTo(-1 * u, -9.6 * u);
  ctx.fillStyle = '#f5c462';
  ctx.fill();
  ctx.strokeStyle = '#1e1109';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // 拱形红白马戏大篷顶
  ctx.beginPath();
  ctx.moveTo(-9.5 * u, -0.8 * u);
  ctx.bezierCurveTo(-9.5 * u, -9.4 * u, 8.5 * u, -9.4 * u, 8.5 * u, -0.8 * u);
  ctx.closePath();
  ctx.fillStyle = '#fcf2dc';
  ctx.fill();
  ctx.lineWidth = Math.max(1.4, size * 0.062);
  ctx.strokeStyle = '#1e1109';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-4.2 * u, -0.8 * u);
  ctx.quadraticCurveTo(-2.5 * u, -8.2 * u, -0.5 * u, -8.8 * u);
  ctx.quadraticCurveTo(1.5 * u, -8.2 * u, 3.2 * u, -0.8 * u);
  ctx.closePath();
  ctx.fillStyle = '#ad3326';
  ctx.fill();

  // 篷车木厢与暖黄小窗
  ctx.fillStyle = '#cc8a3c';
  ctx.strokeStyle = '#1e1109';
  ctx.beginPath();
  ctx.rect(-8.8 * u, -0.8 * u, 16.6 * u, 6.8 * u);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffefba';
  ctx.fillRect(-3.0 * u, 0.8 * u, 5.0 * u, 3.4 * u);
  ctx.strokeRect(-3.0 * u, 0.8 * u, 5.0 * u, 3.4 * u);

  // 车头悬挂暖光风灯
  ctx.beginPath();
  ctx.moveTo(7.8 * u, -1.2 * u);
  ctx.lineTo(11.2 * u, -1.2 * u);
  ctx.lineTo(11.2 * u, 1.5 * u);
  ctx.strokeStyle = '#1e1109';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(11.2 * u, 2.7 * u, 2.3 * u, 0, Math.PI * 2);
  ctx.fillStyle = '#fff7c7';
  ctx.fill();
  ctx.stroke();

  for (const wx of [-5.2 * u, 4.4 * u]) {
    ctx.beginPath();
    ctx.arc(wx, 6.6 * u, 3.5 * u, 0, Math.PI * 2);
    ctx.fillStyle = '#2d190d';
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, size * 0.055);
    ctx.strokeStyle = '#f4cb7c';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(wx, 6.6 * u, 1.15 * u, 0, Math.PI * 2);
    ctx.fillStyle = '#faecd0';
    ctx.fill();
  }

  ctx.restore();
}

export function collectVisibleLandmarkMarkers(
  map: RegionMap,
  caravanPos: { x: number; y: number },
  vp: MapViewportBounds,
): FieldLandmark[] {
  return Object.values(map.landmarks ?? {}).filter(
    lm => isPointInViewport(lm.x, lm.y, vp) && isLandmarkRevealed(map, lm, caravanPos, CARAVAN_VISION_RADIUS),
  );
}

const LANDMARK_GLYPH_COLOR: Record<LandmarkKind, string> = {
  ancient_ruin: '#6f5133',
  wild_lair: '#2e6f4a',
  refugee_camp: '#b06324',
  smuggler_cove: '#614178',
  watchtower_post: '#8e2b24',
  shrine_hearth: '#c48f2c',
};

/** 绘制野外兴趣点八角铜印图标（区别于城村菱形纹章） */
export function drawLandmarkIcon(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  kind: LandmarkKind,
  resolved: boolean,
): void {
  const r = size * 0.44;
  ctx.save();
  ctx.translate(px, py);

  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const ang = (Math.PI / 4) * i + Math.PI / 8;
    const vx = Math.cos(ang) * r;
    const vy = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.fillStyle = resolved ? '#cbbba0' : '#f7ebcf';
  ctx.fill();
  ctx.lineWidth = Math.max(1.3, size * 0.06);
  ctx.strokeStyle = resolved ? '#5f4e3d' : '#1e140c';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = resolved ? '#7a6c59' : LANDMARK_GLYPH_COLOR[kind];
  ctx.fill();

  if (resolved) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, 0);
    ctx.lineTo(-r * 0.04, r * 0.22);
    ctx.lineTo(r * 0.28, -r * 0.22);
    ctx.strokeStyle = '#fff5df';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.restore();
}
