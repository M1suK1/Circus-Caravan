/**
 * 羊皮纸舆图手绘风矢量图标绘制与可视范围（Viewport + 迷雾视野）裁剪工具。
 *
 * 为显示范围内的多格城郭、村寨、跨区关口与残响大篷车提供高辨识度 Canvas 2D 图标。
 */
import { CARAVAN_VISION_RADIUS, exploredMaskArray } from '../../domain/routeDraw.ts';
import type { RegionGate, RegionMap, SettlementPoi } from '../../types.ts';

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

/** 绘制多格城郭图标：羊皮底章 + 双侧垛口箭楼 + 中央尖顶主堡与旌旗 */
export function drawCityIcon(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  scouted: boolean,
): void {
  const r = size * 0.54;
  ctx.save();
  ctx.translate(px, py);

  // 羊皮底章圆盘与外墨圈
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = scouted ? 'rgba(252, 241, 216, 0.96)' : 'rgba(232, 215, 184, 0.9)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.3, size * 0.075);
  ctx.strokeStyle = scouted ? '#8c271e' : '#5e4934';
  ctx.stroke();

  const u = size * 0.045;
  // 城墙与左右双塔楼
  ctx.fillStyle = scouted ? '#ead0a2' : '#cbb48e';
  ctx.strokeStyle = '#291a10';
  ctx.lineWidth = Math.max(1.1, size * 0.06);
  ctx.beginPath();
  ctx.rect(-7.5 * u, -2 * u, 4 * u, 8.5 * u);
  ctx.rect(3.5 * u, -2 * u, 4 * u, 8.5 * u);
  ctx.rect(-4 * u, -0.5 * u, 8 * u, 7 * u);
  ctx.fill();
  ctx.stroke();

  // 中央主堡尖顶
  ctx.beginPath();
  ctx.moveTo(-4.8 * u, -0.5 * u);
  ctx.lineTo(0, -7.8 * u);
  ctx.lineTo(4.8 * u, -0.5 * u);
  ctx.closePath();
  ctx.fillStyle = scouted ? '#a63429' : '#735a43';
  ctx.fill();
  ctx.stroke();

  // 塔顶小旗与城门拱洞
  if (scouted) {
    ctx.beginPath();
    ctx.moveTo(0, -7.8 * u);
    ctx.lineTo(0, -10.8 * u);
    ctx.lineTo(4.2 * u, -9.4 * u);
    ctx.lineTo(0, -8.2 * u);
    ctx.fillStyle = '#d98f2b';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 6.5 * u, 2.1 * u, Math.PI, 0);
  ctx.fillStyle = scouted ? '#3b2314' : '#5b4633';
  ctx.fill();

  ctx.restore();
}

/** 绘制荒原村寨图标：羊皮底章 + 斜顶木屋 + 烟囱与暖色门窗 */
export function drawVillageIcon(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  scouted: boolean,
): void {
  const r = size * 0.5;
  ctx.save();
  ctx.translate(px, py);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = scouted ? 'rgba(251, 241, 219, 0.94)' : 'rgba(232, 216, 187, 0.88)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.1, size * 0.07);
  ctx.strokeStyle = scouted ? '#9e5a24' : '#66513c';
  ctx.stroke();

  const u = size * 0.048;
  // 烟囱
  ctx.fillStyle = '#6e4e35';
  ctx.fillRect(2.6 * u, -6.2 * u, 2.0 * u, 4.2 * u);

  // 木屋墙体
  ctx.fillStyle = scouted ? '#f3dfc0' : '#d5c09e';
  ctx.strokeStyle = '#2b1b11';
  ctx.lineWidth = Math.max(1.05, size * 0.06);
  ctx.beginPath();
  ctx.rect(-5.2 * u, -0.5 * u, 10.4 * u, 6.6 * u);
  ctx.fill();
  ctx.stroke();

  // 人字茅草/木瓦斜顶
  ctx.beginPath();
  ctx.moveTo(-7.0 * u, 0.2 * u);
  ctx.lineTo(0, -6.6 * u);
  ctx.lineTo(7.0 * u, 0.2 * u);
  ctx.closePath();
  ctx.fillStyle = scouted ? '#c76c2e' : '#7d6349';
  ctx.fill();
  ctx.stroke();

  // 暖光小屋门窗
  ctx.fillStyle = scouted ? '#e8a238' : '#574331';
  ctx.fillRect(-1.6 * u, 2.0 * u, 3.2 * u, 4.1 * u);

  ctx.restore();
}

/** 绘制跨区关口石拱门界碑图标 */
export function drawGateIcon(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
): void {
  const u = size * 0.05;
  ctx.save();
  ctx.translate(px, py);

  ctx.beginPath();
  ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(250, 236, 206, 0.92)';
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#9c5f19';
  ctx.stroke();

  ctx.strokeStyle = '#2d1b10';
  ctx.fillStyle = '#c48332';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.rect(-5.5 * u, -5 * u, 11 * u, 2.4 * u);
  ctx.rect(-4.5 * u, -2.6 * u, 2.6 * u, 8.2 * u);
  ctx.rect(1.9 * u, -2.6 * u, 2.6 * u, 8.2 * u);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/** 绘制残响大篷车专属图标：拱顶红白马戏篷车 + 双木轮 + 巡游旗 + 檐角暖光风灯 */
export function drawCaravanIcon(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
): void {
  const u = size * 0.042;
  ctx.save();
  ctx.translate(px, py);

  // 底部暖金风灯光晕衬底
  const glow = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 0.78);
  glow.addColorStop(0, 'rgba(255, 214, 112, 0.75)');
  glow.addColorStop(0.55, 'rgba(218, 138, 42, 0.28)');
  glow.addColorStop(1, 'rgba(218, 138, 42, 0)');
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.78, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // 地面投影
  ctx.beginPath();
  ctx.ellipse(0, 8.5 * u, 10.5 * u, 3 * u, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(34, 19, 10, 0.35)';
  ctx.fill();

  // 车顶迎风小彩旗
  ctx.beginPath();
  ctx.moveTo(-1 * u, -8.8 * u);
  ctx.lineTo(-1 * u, -13.2 * u);
  ctx.lineTo(5.2 * u, -11.3 * u);
  ctx.lineTo(-1 * u, -9.6 * u);
  ctx.fillStyle = '#f2be5c';
  ctx.fill();
  ctx.strokeStyle = '#2a170c';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // 拱形马戏条纹大篷顶
  ctx.beginPath();
  ctx.moveTo(-9.5 * u, -0.8 * u);
  ctx.bezierCurveTo(-9.5 * u, -9.2 * u, 8.5 * u, -9.2 * u, 8.5 * u, -0.8 * u);
  ctx.closePath();
  ctx.fillStyle = '#fbf0d8';
  ctx.fill();
  ctx.lineWidth = Math.max(1.3, size * 0.06);
  ctx.strokeStyle = '#26150b';
  ctx.stroke();

  // 篷布绯红条纹肋片
  ctx.beginPath();
  ctx.moveTo(-4.2 * u, -0.8 * u);
  ctx.quadraticCurveTo(-2.5 * u, -8.2 * u, -0.5 * u, -8.6 * u);
  ctx.quadraticCurveTo(1.5 * u, -8.2 * u, 3.2 * u, -0.8 * u);
  ctx.closePath();
  ctx.fillStyle = '#b33629';
  ctx.fill();

  // 木质车厢与舞台小窗
  ctx.fillStyle = '#ce8d40';
  ctx.strokeStyle = '#26150b';
  ctx.beginPath();
  ctx.rect(-8.8 * u, -0.8 * u, 16.6 * u, 6.8 * u);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffebad';
  ctx.fillRect(-3.0 * u, 0.8 * u, 5.0 * u, 3.4 * u);
  ctx.strokeRect(-3.0 * u, 0.8 * u, 5.0 * u, 3.4 * u);

  // 车头伸出风灯杆与明亮风灯
  ctx.beginPath();
  ctx.moveTo(7.8 * u, -1.2 * u);
  ctx.lineTo(11.0 * u, -1.2 * u);
  ctx.lineTo(11.0 * u, 1.4 * u);
  ctx.strokeStyle = '#26150b';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(11.0 * u, 2.6 * u, 2.2 * u, 0, Math.PI * 2);
  ctx.fillStyle = '#fff5be';
  ctx.fill();
  ctx.stroke();

  // 前后双木辐车轮
  for (const wx of [-5.2 * u, 4.4 * u]) {
    ctx.beginPath();
    ctx.arc(wx, 6.6 * u, 3.4 * u, 0, Math.PI * 2);
    ctx.fillStyle = '#3b2213';
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, size * 0.055);
    ctx.strokeStyle = '#f2c879';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(wx, 6.6 * u, 1.1 * u, 0, Math.PI * 2);
    ctx.fillStyle = '#faecd0';
    ctx.fill();
  }

  ctx.restore();
}
