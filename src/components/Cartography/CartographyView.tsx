import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Eye,
  Globe,
  LocateFixed,
  MapPin,
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
import { renderCartographyCanvas } from './mapRenderer.ts';
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
  const downClientRef = useRef<{ x: number; y: number } | null>(null);
  const [focusedPoiId, setFocusedPoiId] = useState<string | null>(null);
  const [cursorLabel, setCursorLabel] = useState<string>('');

  const region = state.world.regions[state.world.currentRegionId];
  const map = region.map;
  const loadedCount = useMemo(
    () => REGION_IDS.filter(id => Boolean(state.world.regions[id].map)).length,
    [state.world.regions],
  );

  const sketch = useRouteSketch(state, zoom, evadeWar, onRouteDraft);

  useEffect(() => {
    setFocusedPoiId(null);
  }, [state.world.currentRegionId, state.world.seed, zoom]);

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
    const vp = renderCartographyCanvas(canvas, state, zoom, routeDraft);
    sketch.setViewport(vp);
  }, [state, zoom, routeDraft, sketch]);

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

  const currentTerrain = map
    ? regionTerrainAt(map, Math.round(state.world.pos.x), Math.round(state.world.pos.y))
    : 'wasteland';

  const focusedPoi = focusedPoiId && map ? map.pois[focusedPoiId] : undefined;

  return (
    <div id="octo-atlas-underlay" className={`octo-atlas-underlay ${interactive ? '' : 'dimmed'}`}>
      <div ref={viewportRef} className="atlas-viewport">
        <canvas
          id="cartography-canvas"
          ref={canvasRef}
          className={`atlas-canvas ${zoom === 'world' ? 'pan-mode' : ''}`}
          onPointerDown={e => {
            if (!interactive) return;
            downClientRef.current = { x: e.clientX, y: e.clientY };
            sketch.onPointerDown(e);
          }}
          onPointerMove={e => {
            if (!interactive) return;
            sketch.onPointerMove(e);
            if (map && zoom !== 'world') {
              const pt = sketch.toMapPoint(e.clientX, e.clientY, e.currentTarget);
              if (pt) {
                const gx = Math.round(pt.x);
                const gy = Math.round(pt.y);
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
            if (!interactive) return;
            sketch.onPointerUp(e);
            const start = downClientRef.current;
            downClientRef.current = null;
            // 轻点地图（位移 < 6px）：世界全图点当前疆域直入 10× 详图；疆域图点菱形地标弹出斥候便签
            if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) {
              const pt = sketch.toMapPoint(e.clientX, e.clientY, e.currentTarget);
              if (pt && zoom === 'world') {
                const clickedReg = worldRegionAt(state.world.worldMap, Math.floor(pt.x), Math.floor(pt.y));
                if (clickedReg === state.world.currentRegionId) {
                  onZoom('region');
                }
              } else if (pt && map && zoom !== 'world') {
                const hit = Object.values(map.pois).find(
                  poi => isSettlementRevealed(map, poi, state.world.pos) && Math.hypot(poi.x + 0.5 - pt.x, poi.y + 0.5 - pt.y) <= 4.2,
                );
                if (hit) {
                  onRouteDraft(null);
                  setFocusedPoiId(hit.id);
                }
              }
            }
          }}
        />

        {interactive && (
          <div className="octo-map-hud">
            {/* 左上悬浮视距与潜行姿态控制条（避开左侧选单与顶部中央星盘） */}
            <div className="octo-zoom-cluster" role="tablist" aria-label="舆图视距切换">
              <button
                id="map-zoom-world"
                type="button"
                role="tab"
                aria-selected={zoom === 'world'}
                className={`octo-zoom-pill ${zoom === 'world' ? 'active' : ''}`}
                onClick={() => onZoom('world')}
              >
                <Globe size={12} /><span>1 · 大陆全图</span>
              </button>
              <button
                id="map-zoom-region"
                type="button"
                role="tab"
                aria-selected={zoom === 'region'}
                className={`octo-zoom-pill ${zoom === 'region' ? 'active' : ''}`}
                onClick={() => onZoom('region')}
              >
                <Compass size={12} /><span>2 · 疆域 10×</span>
              </button>
              <button
                id="map-zoom-follow"
                type="button"
                role="tab"
                aria-selected={zoom === 'follow'}
                className={`octo-zoom-pill ${zoom === 'follow' ? 'active' : ''}`}
                onClick={() => onZoom('follow')}
              >
                <LocateFixed size={12} /><span>3 · 跟随车队</span>
              </button>

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

            {/* 点选地图菱形地标时弹出的精致羊皮斥候便签（.paper-note） */}
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
                    <Route size={11} />引线前往
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

            {/* 左下悬浮坐标读数与微缩铜版图例 */}
            <div className="octo-bottom-hud">
              <div className="octo-coord-strip">
                <MapPin size={12} />
                <span>
                  {region.name} ({Math.round(state.world.pos.x)},{Math.round(state.world.pos.y)}) · {TERRAIN_CN[currentTerrain]} · 已展疆域 {loadedCount}/9
                  {cursorLabel ? ` ｜ 光标 ${cursorLabel}` : ''}
                </span>
              </div>
              <div className="octo-legend-strip" aria-label="铜版舆图图例">
                <span><LegendCaravanSvg />大篷车</span>
                <span><LegendCitySvg />城郭</span>
                <span><LegendVillageSvg />村寨</span>
                <span><i className="legend-swatch" style={{ background: '#b89868' }} />古道(1.4×)</span>
                <span><i className="legend-swatch" style={{ background: '#989068' }} />林地</span>
                <span><i className="legend-swatch" style={{ background: '#88928b' }} />河海</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
