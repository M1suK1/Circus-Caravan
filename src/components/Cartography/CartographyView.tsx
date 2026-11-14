import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Compass,
  Eye,
  Footprints,
  Globe,
  LocateFixed,
  MapPin,
  Navigation2,
  Route,
  ShieldAlert,
  Sparkles,
  Trees,
} from 'lucide-react';
import { REGION_IDS } from '../../content/regions.ts';
import { regionTerrainAt } from '../../domain/regionGen.ts';
import { isTileExplored } from '../../domain/routeDraw.ts';
import type { CircusState, MapZoomMode, RegionId, RouteEvaluation, SettlementPoi } from '../../types.ts';
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
  road: '石砌干道',
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
  onZoom,
  routeDraft,
  onRouteDraft,
  evadeWar,
  onToggleEvadeWar,
  onOpenScout,
  onCrossBorder,
  onAssistSketchTo,
}: {
  state: CircusState;
  zoom: MapZoomMode;
  onZoom: (mode: MapZoomMode) => void;
  routeDraft: RouteEvaluation | null;
  onRouteDraft: (draft: RouteEvaluation | null) => void;
  evadeWar: boolean;
  onToggleEvadeWar: () => void;
  onOpenScout: (poi: SettlementPoi) => void;
  onCrossBorder: (targetRegionId: RegionId) => void;
  onAssistSketchTo: (tx: number, ty: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const region = state.world.regions[state.world.currentRegionId];
  const map = region.map;
  const loadedCount = useMemo(() => REGION_IDS.filter(id => Boolean(state.world.regions[id].map)).length, [state.world.regions]);

  const sketch = useRouteSketch(state, zoom, evadeWar, onRouteDraft);

  const syncAndRender = useCallback(() => {
    const canvas = canvasRef.current;
    const host = viewportRef.current;
    if (!canvas || !host) return;
    const rect = host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(480, Math.round(rect.width * dpr));
    const h = Math.max(280, Math.round(rect.height * dpr));
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
  const [cursorLabel, setCursorLabel] = useState<string>('');

  const visiblePois = useMemo(() => {
    if (!map) return [];
    return Object.values(map.pois).filter(poi => isSettlementRevealed(map, poi, state.world.pos));
  }, [map, state.world.pos]);

  const reachableGates = useMemo(() => {
    if (!map) return [];
    return map.gates.map(g => ({
      ...g,
      dist: Math.hypot(g.x - state.world.pos.x, g.y - state.world.pos.y),
      seen: isTileExplored(map, g.x, g.y) || Math.hypot(g.x - state.world.pos.x, g.y - state.world.pos.y) <= 12,
    }));
  }, [map, state.world.pos.x, state.world.pos.y]);

  const currentPoi = state.world.currentPoiId && map ? map.pois[state.world.currentPoiId] : undefined;

  return (
    <div className="atlas-layout">
      <section className="atlas-stage-card" aria-label="羊皮纸测绘地图区">
        <div className="atlas-toolbar">
          <div className="silk-tab-row" role="tablist" aria-label="地图层级切换">
            <button
              id="map-zoom-world"
              type="button"
              role="tab"
              aria-selected={zoom === 'world'}
              className={`silk-tab tone-indigo ${zoom === 'world' ? 'active' : ''}`}
              onClick={() => onZoom('world')}
            >
              <Globe size={12} /><span>世界地图 (128×128)</span>
            </button>
            <button
              id="map-zoom-region"
              type="button"
              role="tab"
              aria-selected={zoom === 'region'}
              className={`silk-tab ${zoom === 'region' ? 'active' : ''}`}
              onClick={() => onZoom('region')}
            >
              <Compass size={12} /><span>区域地图 (10×放大)</span>
            </button>
            <button
              id="map-zoom-follow"
              type="button"
              role="tab"
              aria-selected={zoom === 'follow'}
              className={`silk-tab tone-amber ${zoom === 'follow' ? 'active' : ''}`}
              onClick={() => onZoom('follow')}
            >
              <LocateFixed size={12} /><span>跟随马车周边</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 6 }}>
            <button
              id="map-evade-war-toggle"
              type="button"
              className={`btn sm ${evadeWar ? 'amber' : ''}`}
              aria-pressed={evadeWar}
              onClick={onToggleEvadeWar}
              title="开启后采用熄灯绕行策略：速度降低但避开交火盘查、节省灯油"
            >
              <ShieldAlert size={12} />{evadeWar ? '战区熄灯潜行：开' : '常规行军姿态'}
            </button>
            <span className="wax-pill">已加载大区 {loadedCount}/9</span>
          </div>
        </div>

        <div ref={viewportRef} className="atlas-viewport">
          <canvas
            id="cartography-canvas"
            ref={canvasRef}
            className={`atlas-canvas ${zoom === 'world' ? 'pan-mode' : ''}`}
            onPointerDown={sketch.onPointerDown}
            onPointerMove={e => {
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
                        ? `光标 (${gx},${gy}) · ${TERRAIN_CN[t] ?? t}`
                        : `光标 (${gx},${gy}) · 未探明迷雾`,
                  );
                }
              } else {
                setCursorLabel('');
              }
            }}
            onPointerLeave={() => setCursorLabel('')}
            onPointerUp={sketch.onPointerUp}
          />

          <div className="atlas-overlay-hud">
            <div className="hud-top">
              <div className="hud-coord-badge">
                <MapPin size={12} style={{ color: 'var(--crimson)' }} />
                <span>
                  {region.name} · 大篷车 ({Math.round(state.world.pos.x)}, {Math.round(state.world.pos.y)}) · {TERRAIN_CN[currentTerrain]}
                  {cursorLabel ? ` ｜ ${cursorLabel}` : ''}
                </span>
              </div>
              <div className="hud-compass" aria-hidden="true">
                <Navigation2 size={14} style={{ color: 'var(--crimson)', transform: 'rotate(20deg)' }} />
                <span style={{ fontSize: 9.5 }}>北 · N</span>
              </div>
            </div>

            <div className="hud-bottom">
              <div className="hud-legend" aria-label="舆图图例">
                <span><LegendCaravanSvg />残响大篷车</span>
                <span><LegendCitySvg />城郭</span>
                <span><LegendVillageSvg />村寨</span>
                <span><i className="legend-swatch" style={{ background: '#b8915e' }} />干道(1.4×)</span>
                <span><i className="legend-swatch" style={{ background: '#5c825a' }} />密林</span>
                <span><i className="legend-swatch" style={{ background: '#748062' }} />沼泽</span>
                <span><i className="legend-swatch" style={{ background: '#447c9c' }} />河湖</span>
                <span><i className="legend-swatch" style={{ background: '#d4bd94' }} />迷雾</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="atlas-sidebar" aria-label="区域手账与侦查控制">
        <div className="paper-note tone-kraft pinned">
          <div className="card-head">
            <h3><Trees size={14} />{region.name}</h3>
            <span className={`wax-pill ${region.dangerTier >= 4 ? 'crimson' : 'amber'}`}>危级 {region.dangerTier}/5</span>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 6 }}>{region.theme}</p>
          {map && (
            <div className="stat-grid-2">
              <div className="metric-box">
                <small>10× 区域尺度</small>
                <b>{map.width} × {map.height}</b>
              </div>
              <div className="metric-box">
                <small>城郭 / 村寨</small>
                <b>{Object.values(map.pois).filter(p => p.kind === 'city').length} 城 · {Object.values(map.pois).filter(p => p.kind === 'village').length} 村</b>
              </div>
            </div>
          )}
        </div>

        {currentPoi && (
          <div className="paper-note tone-ivory pinned" style={{ borderColor: 'var(--crimson)' }}>
            <div className="card-head">
              <h3><Building2 size={14} />当前驻扎地</h3>
              <span className="wax-pill crimson">{currentPoi.kind === 'city' ? `城郭 (${currentPoi.footprint.length}格)` : '村寨'}</span>
            </div>
            {currentPoi.scouted && currentPoi.details ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <strong style={{ fontFamily: 'var(--font-display)', fontSize: 13.5 }}>{currentPoi.details.name}</strong>
                  <span className="wax-pill forest">希望 {currentPoi.details.hope}</span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{currentPoi.details.summary}</p>
                <button id="open-scouted-poi-btn" type="button" className="btn sm" onClick={() => onOpenScout(currentPoi)}>
                  <Eye size={12} />查看聚落卷宗与 NPC
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <strong>{currentPoi.placeholderName}</strong>
                <button id="scout-current-poi-btn" type="button" className="btn sm primary full" onClick={() => onOpenScout(currentPoi)}>
                  <Sparkles size={13} />侦查此地（LLM 生成详情）
                </button>
              </div>
            )}
          </div>
        )}

        <div className="paper-note tone-ivory atlas-sidebar-flex-note">
          <div className="card-head">
            <h3><Footprints size={14} />已探明据点</h3>
            <small>{visiblePois.length} 处</small>
          </div>
          <div className="poi-list">
            {visiblePois.length ? visiblePois.map(poi => (
              <div key={poi.id} className="poi-row">
                <div className="poi-row-info">
                  <b>{poi.scouted && poi.details ? poi.details.name : poi.placeholderName}</b>
                  <small>{poi.kind === 'city' ? `多格城市 (${poi.footprint.length}格)` : '荒野村寨'} · ({poi.x}, {poi.y})</small>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    id={`assist-route-${poi.id}`}
                    type="button"
                    className="btn sm ghost"
                    title="绘制参考墨线前往此处"
                    onClick={() => onAssistSketchTo(poi.x, poi.y)}
                  >
                    <Route size={11} />引线
                  </button>
                  <button
                    id={`scout-list-${poi.id}`}
                    type="button"
                    className={`btn sm ${poi.scouted ? '' : 'primary'}`}
                    onClick={() => onOpenScout(poi)}
                  >
                    {poi.scouted ? '详览' : '侦查'}
                  </button>
                </div>
              </div>
            )) : (
              <p style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>当前视野内尚无已知聚落，在羊皮纸上向远方划线探索吧。</p>
            )}
          </div>
        </div>

        <div className="paper-note tone-sage" style={{ maxHeight: 148, display: 'flex', flexDirection: 'column' }}>
          <div className="card-head">
            <h3><Compass size={14} />相邻省界关口</h3>
            <small>4 格内出境</small>
          </div>
          <div className="poi-list">
            {reachableGates.map(gate => (
              <div key={gate.targetRegionId} className="poi-row">
                <div className="poi-row-info">
                  <b>通往 {state.world.regions[gate.targetRegionId].name}</b>
                  <small>{gate.seen ? `(${gate.x}, ${gate.y}) · 距 ${Math.round(gate.dist)} 里` : '仍在迷雾深处'}</small>
                </div>
                {gate.dist <= 4 ? (
                  <button
                    id={`cross-border-${gate.targetRegionId}`}
                    type="button"
                    className="btn sm primary"
                    onClick={() => onCrossBorder(gate.targetRegionId)}
                  >
                    出境展开
                  </button>
                ) : gate.seen ? (
                  <button
                    id={`assist-gate-${gate.targetRegionId}`}
                    type="button"
                    className="btn sm"
                    onClick={() => onAssistSketchTo(gate.x, gate.y)}
                  >
                    引线
                  </button>
                ) : (
                  <span className="wax-pill">未探明</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
