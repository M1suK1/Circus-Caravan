import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Eye,
  Globe,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Route,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { REGION_IDS } from '../../content/regions.ts';
import { regionTerrainAt } from '../../domain/regionGen.ts';
import { isTileExplored } from '../../domain/routeDraw.ts';
import { worldRegionAt } from '../../domain/worldGen.ts';
import type { CircusState, MapZoomMode, RouteEvaluation, SettlementPoi } from '../../types.ts';
import { LegendCaravanSvg, LegendCitySvg, LegendVillageSvg } from '../CaravanCrestIcon.tsx';
import { isSettlementRevealed } from './mapIcons.ts';
import {
  FOLLOW_DEFAULT_ZOOM,
  MAX_REGION_ZOOM,
  MIN_REGION_ZOOM,
  renderCartographyCanvas,
  type RegionCamera,
  type ViewportTransform,
  zoomRegionAroundCursor,
} from './mapRenderer.ts';
import { useRouteSketch } from './useRouteSketch.ts';

const TERRAIN_CN: Record<string, string> = {
  outside: '疆域之外',
  ocean: '无垠海域',
  coast: '碎石海岸',
  lake: '内陆湖泊',
  river: '大河水道',
  bridge: '跨河木桥',
  border_gate: '跨区关口',
  wasteland: '荒野废土',
  road: '石砌古道',
  forest: '幽暗密林',
  swamp: '腐雾泥沼',
  mountain: '险峻山脊',
  ruin: '旧纪元废墟',
  warzone: '焦土交火区',
  city: '城郭街区',
  village: '荒原村寨',
};

export function CartographyView({
  state,
  zoom,
  interactive,
  travelAnim,
  onZoom,
  routeDraft,
  onRouteDraft,
  evadeWar,
  onToggleEvadeWar,
  onOpenScout,
  onAssistSketchTo,
}: {
  state: CircusState;
  zoom: MapZoomMode;
  interactive: boolean;
  travelAnim?: { pos: { x: number; y: number }; remainingPoints: { x: number; y: number }[] } | null;
  onZoom: (mode: MapZoomMode) => void;
  routeDraft: RouteEvaluation | null;
  onRouteDraft: (draft: RouteEvaluation | null) => void;
  evadeWar: boolean;
  onToggleEvadeWar: () => void;
  onOpenScout: (poi: SettlementPoi) => void;
  onAssistSketchTo: (tx: number, ty: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vpStateRef = useRef<ViewportTransform | null>(null);
  const downClientRef = useRef<{ x: number; y: number; button: number } | null>(null);
  const [focusedPoiId, setFocusedPoiId] = useState<string | null>(null);
  const [cursorLabel, setCursorLabel] = useState<string>('');

  const region = state.world.regions[state.world.currentRegionId];
  const map = region.map;
  const displayPos = travelAnim?.pos ?? state.world.pos;

  const [camera, setCamera] = useState<Required<RegionCamera>>(() => ({
    zoomScale: 1,
    centerX: state.world.pos.x,
    centerY: state.world.pos.y,
  }));
  const [followLocked, setFollowLocked] = useState<boolean>(zoom === 'follow');

  useEffect(() => {
    setFocusedPoiId(null);
    if (zoom === 'region') {
      setFollowLocked(false);
      setCamera({
        zoomScale: 1,
        centerX: map ? map.width / 2 : state.world.pos.x,
        centerY: map ? map.height / 2 : state.world.pos.y,
      });
    } else if (zoom === 'follow') {
      setFollowLocked(true);
      setCamera({
        zoomScale: FOLLOW_DEFAULT_ZOOM,
        centerX: state.world.pos.x,
        centerY: state.world.pos.y,
      });
    }
  }, [zoom, state.world.currentRegionId, state.world.seed]);

  // 马车平滑行驶动画或静止落位时，若开启车队锁定则镜头同步平滑跟随
  useEffect(() => {
    if (followLocked && zoom !== 'world') {
      setCamera(prev => ({
        ...prev,
        centerX: displayPos.x,
        centerY: displayPos.y,
      }));
    }
  }, [displayPos.x, displayPos.y, followLocked, zoom]);

  const loadedCount = useMemo(
    () => REGION_IDS.filter(id => Boolean(state.world.regions[id].map)).length,
    [state.world.regions],
  );

  const handlePanCamera = useCallback((updater: (prev: Required<RegionCamera>) => Required<RegionCamera>) => {
    setFollowLocked(false);
    setCamera(updater);
  }, []);

  const sketch = useRouteSketch(state, zoom, evadeWar, routeDraft, onRouteDraft, handlePanCamera);

  const syncAndRender = useCallback(() => {
    const canvas = canvasRef.current;
    const host = viewportRef.current;
    if (!canvas || !host) return;
    const rect = host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(640, Math.round(rect.width * dpr));
    const h = Math.max(360, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const vp = renderCartographyCanvas(canvas, state, zoom, routeDraft, camera, travelAnim ?? undefined);
    vpStateRef.current = vp;
    sketch.setViewport(vp);
  }, [state, zoom, routeDraft, camera, travelAnim, sketch]);

  useEffect(() => {
    syncAndRender();
  }, [syncAndRender]);

  useEffect(() => {
    const host = viewportRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      syncAndRender();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [syncAndRender]);

  const stepZoom = (factor: number, cursorPx?: number, cursorPy?: number) => {
    if (zoom === 'world') {
      onZoom('region');
      setFollowLocked(true);
      setCamera({
        zoomScale: 1.6,
        centerX: displayPos.x,
        centerY: displayPos.y,
      });
      return;
    }
    const vp = vpStateRef.current;
    if (!vp) return;
    const nextZoom = Math.max(MIN_REGION_ZOOM, Math.min(MAX_REGION_ZOOM, camera.zoomScale * factor));
    const anchorPx = cursorPx ?? vp.canvasW * 0.46;
    const anchorPy = cursorPy ?? vp.canvasH * 0.5;
    setFollowLocked(false);
    setCamera(zoomRegionAroundCursor(state, vp, anchorPx, anchorPy, nextZoom));
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    if (zoom === 'world') {
      if (e.deltaY < 0) stepZoom(factor);
      return;
    }
    if (e.deltaY > 0 && camera.zoomScale <= MIN_REGION_ZOOM + 0.03) {
      onZoom('world');
      return;
    }
    const { px, py } = sketch.toCanvasPx(e.clientX, e.clientY, e.currentTarget);
    stepZoom(factor, px, py);
  };

  const currentTerrain = map
    ? regionTerrainAt(map, Math.floor(displayPos.x), Math.floor(displayPos.y))
    : 'wasteland';

  const focusedPoi = focusedPoiId && map ? map.pois[focusedPoiId] : undefined;
  const canDraw = interactive && !travelAnim;

  return (
    <div id="octo-atlas-underlay" className={`octo-atlas-underlay ${interactive ? '' : 'dimmed'}`}>
      <div ref={viewportRef} className="atlas-viewport">
        <canvas
          id="cartography-canvas"
          ref={canvasRef}
          className={`atlas-canvas ${zoom === 'world' || sketch.panning ? 'pan-mode' : ''}`}
          onContextMenu={e => e.preventDefault()}
          onWheel={handleWheel}
          onPointerDown={e => {
            if (!canDraw) return;
            downClientRef.current = { x: e.clientX, y: e.clientY, button: e.button };
            sketch.onPointerDown(e);
          }}
          onPointerMove={e => {
            if (!interactive) return;
            if (!travelAnim) sketch.onPointerMove(e);
            if (map && zoom !== 'world') {
              const pt = sketch.toMapPoint(e.clientX, e.clientY, e.currentTarget);
              if (pt) {
                const gx = Math.floor(pt.x);
                const gy = Math.floor(pt.y);
                const explored = isTileExplored(map, gx, gy);
                const t = regionTerrainAt(map, gx, gy);
                setCursorLabel(
                  t === 'outside'
                    ? '疆域之外'
                    : explored
                      ? `(${gx},${gy}) ${TERRAIN_CN[t] ?? t}`
                      : `(${gx},${gy}) 云雾未探明`,
                );
              }
            } else {
              setCursorLabel('');
            }
          }}
          onPointerLeave={() => setCursorLabel('')}
          onPointerUp={e => {
            if (!canDraw) return;
            sketch.onPointerUp(e);
            const start = downClientRef.current;
            downClientRef.current = null;
            if (start && start.button === 0 && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) {
              const pt = sketch.toMapPoint(e.clientX, e.clientY, e.currentTarget);
              if (pt && zoom === 'world') {
                const clickedReg = worldRegionAt(state.world.worldMap, Math.floor(pt.x), Math.floor(pt.y));
                if (clickedReg === state.world.currentRegionId) {
                  onZoom('region');
                }
              } else if (pt && map && zoom !== 'world') {
                const hit = Object.values(map.pois).find(
                  poi => isSettlementRevealed(map, poi, state.world.pos) && Math.hypot(poi.x + 0.5 - pt.x, poi.y + 0.5 - pt.y) <= 3.6,
                );
                if (hit) {
                  sketch.restorePreStrokeDraft();
                  setFocusedPoiId(hit.id);
                }
              }
            }
          }}
        />

        {interactive && (
          <div className="octo-map-hud">
            <div className="octo-zoom-cluster" role="toolbar" aria-label="舆图视距与无级缩放">
              <button
                id="map-zoom-world"
                type="button"
                aria-pressed={zoom === 'world'}
                className={`octo-zoom-pill ${zoom === 'world' ? 'active' : ''}`}
                onClick={() => onZoom('world')}
              >
                <Globe size={12} /><span>1 · 大陆全图</span>
              </button>
              <button
                id="map-zoom-region"
                type="button"
                aria-pressed={zoom === 'region' && camera.zoomScale <= 1.05}
                className={`octo-zoom-pill ${zoom === 'region' && camera.zoomScale <= 1.05 ? 'active' : ''}`}
                onClick={() => {
                  onZoom('region');
                  setFollowLocked(false);
                  setCamera({
                    zoomScale: 1,
                    centerX: map ? map.width / 2 : displayPos.x,
                    centerY: map ? map.height / 2 : displayPos.y,
                  });
                }}
              >
                <Compass size={12} /><span>2 · 疆域全览</span>
              </button>
              <button
                id="map-zoom-follow"
                type="button"
                aria-pressed={zoom !== 'world' && followLocked && camera.zoomScale >= 3.5}
                className={`octo-zoom-pill ${zoom !== 'world' && followLocked && camera.zoomScale >= 3.5 ? 'active' : ''}`}
                onClick={() => {
                  onZoom('follow');
                  setFollowLocked(true);
                  setCamera({
                    zoomScale: FOLLOW_DEFAULT_ZOOM,
                    centerX: displayPos.x,
                    centerY: displayPos.y,
                  });
                }}
              >
                <LocateFixed size={12} /><span>3 · 跟随车队</span>
              </button>

              <div className="octo-zoom-stepper" role="group" aria-label="疆域地图无级缩放倍率">
                <button
                  id="map-zoom-out"
                  type="button"
                  className="octo-step-btn"
                  aria-label="缩小地图视野"
                  title="缩小视野（亦可使用鼠标滚轮）"
                  disabled={zoom === 'world' || camera.zoomScale <= MIN_REGION_ZOOM + 0.01}
                  onClick={() => stepZoom(1 / 1.3)}
                >
                  <Minus size={11} />
                </button>
                <button
                  id="map-recenter-caravan"
                  type="button"
                  className="octo-zoom-readout"
                  title="点击将镜头居中锁定回大篷车（右键拖拽可平移视野）"
                  onClick={() => {
                    if (zoom === 'world') onZoom('region');
                    setFollowLocked(true);
                    setCamera(prev => ({
                      zoomScale: Math.max(2.2, prev.zoomScale),
                      centerX: displayPos.x,
                      centerY: displayPos.y,
                    }));
                  }}
                >
                  {zoom === 'world' ? '128²' : `${camera.zoomScale.toFixed(1)}×`}
                </button>
                <button
                  id="map-zoom-in"
                  type="button"
                  className="octo-step-btn"
                  aria-label="放大地图视野"
                  title="放大视野（亦可使用鼠标滚轮定点缩放）"
                  disabled={zoom !== 'world' && camera.zoomScale >= MAX_REGION_ZOOM - 0.01}
                  onClick={() => stepZoom(1.3)}
                >
                  <Plus size={11} />
                </button>
              </div>

              <button
                id="map-evade-war-toggle"
                type="button"
                className={`octo-zoom-pill stealth ${evadeWar ? 'amber' : ''}`}
                aria-pressed={evadeWar}
                onClick={onToggleEvadeWar}
                title="开启后采用熄灯绕行策略：速度降低但避开交火盘查、节省灯油"
              >
                <ShieldAlert size={12} /><span>{evadeWar ? '熄灯潜行：开' : '常规行军'}</span>
              </button>
            </div>

            {focusedPoi && (
              <div id="map-poi-quick-note" className="paper-note tone-ivory pinned octo-poi-popover">
                <div className="card-head" style={{ marginBottom: 4 }}>
                  <h3>
                    {focusedPoi.scouted && focusedPoi.details ? focusedPoi.details.name : focusedPoi.placeholderName}
                  </h3>
                  <button
                    id="close-poi-popover"
                    type="button"
                    aria-label="关闭据点便签"
                    onClick={() => setFocusedPoiId(null)}
                  >
                    <X size={13} />
                  </button>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 7 }}>
                  {focusedPoi.scouted && focusedPoi.details
                    ? focusedPoi.details.summary
                    : `${focusedPoi.kind === 'city' ? '多格城郭遗址' : '荒原风灯村寨'} · 坐标 (${focusedPoi.x}, ${focusedPoi.y})，尚未派遣斥候生成详情。`}
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    id="popover-sketch-btn"
                    type="button"
                    className="btn sm"
                    onClick={() => onAssistSketchTo(focusedPoi.x, focusedPoi.y)}
                  >
                    <Route size={11} />沿主道寻路
                  </button>
                  <button
                    id="popover-scout-btn"
                    type="button"
                    className="btn sm primary"
                    onClick={() => onOpenScout(focusedPoi)}
                  >
                    {focusedPoi.scouted ? <><Eye size={11} />查阅卷宗</> : <><Sparkles size={11} />侦查生成</>}
                  </button>
                </div>
              </div>
            )}

            <div className="octo-bottom-hud">
              <div className="octo-coord-strip">
                <MapPin size={12} />
                <span>
                  {region.name} ({Math.floor(displayPos.x)},{Math.floor(displayPos.y)}) · {TERRAIN_CN[currentTerrain]} · 已展疆域 {loadedCount}/9
                  {zoom !== 'world' ? ' · 支持分次续画 / 滚轮缩放 / 右键拖移' : ''}
                  {cursorLabel ? ` ｜ 光标 ${cursorLabel}` : ''}
                </span>
              </div>
              <div className="octo-legend-strip" aria-label="铜版舆图图例">
                <span><LegendCaravanSvg />大篷车</span>
                <span><LegendCitySvg />城郭</span>
                <span><LegendVillageSvg />村寨</span>
                <span><i className="legend-swatch" style={{ background: '#c29c68' }} />古道(1.4×)</span>
                <span><i className="legend-swatch" style={{ background: '#a4a06e' }} />林地</span>
                <span><i className="legend-swatch" style={{ background: '#547680' }} />河海</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
