import { useEffect, useMemo, useRef, useState } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const region = state.world.regions[state.world.currentRegionId];
  const map = region.map;
  const loadedCount = useMemo(() => REGION_IDS.filter(id => Boolean(state.world.regions[id].map)).length, [state.world.regions]);

  const sketch = useRouteSketch(state, zoom, evadeWar, onRouteDraft);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(640, Math.round(rect.width * (window.devicePixelRatio || 1)));
    const h = Math.max(400, Math.round(rect.height * (window.devicePixelRatio || 1)));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const vp = renderCartographyCanvas(canvas, state, zoom, routeDraft);
    sketch.setViewport(vp);
  }, [state, zoom, routeDraft, sketch]);

  const currentTerrain = map
    ? regionTerrainAt(map, Math.round(state.world.pos.x), Math.round(state.world.pos.y))
    : 'wasteland';
  const [cursorLabel, setCursorLabel] = useState<string>('');

  const visiblePois = useMemo(() => {
    if (!map) return [];
    return Object.values(map.pois).filter(
      poi => isTileExplored(map, poi.x, poi.y) || Math.hypot(poi.x - state.world.pos.x, poi.y - state.world.pos.y) <= 14,
    );
  }, [map, state.world.pos.x, state.world.pos.y]);

  const reachableGates = useMemo(() => {
    if (!map) return [];
    return map.gates.map(g => ({
      ...g,
      dist: Math.hypot(g.x - state.world.pos.x, g.y - state.world.pos.y),
      seen: isTileExplored(map, g.x, g.y),
    }));
  }, [map, state.world.pos.x, state.world.pos.y]);

  const currentPoi = state.world.currentPoiId && map ? map.pois[state.world.currentPoiId] : undefined;

  return (
    <div className="atlas-layout">
      <section className="parchment-card atlas-stage-card" aria-label="羊皮纸测绘地图区">
        <div className="atlas-toolbar">
          <div className="zoom-tabs" role="tablist" aria-label="地图层级切换">
            <button
              id="map-zoom-world"
              type="button"
              role="tab"
              aria-selected={zoom === 'world'}
              className={`zoom-tab ${zoom === 'world' ? 'active' : ''}`}
              onClick={() => onZoom('world')}
            >
              <Globe size={14} />世界地图 (128×128)
            </button>
            <button
              id="map-zoom-region"
              type="button"
              role="tab"
              aria-selected={zoom === 'region'}
              className={`zoom-tab ${zoom === 'region' ? 'active' : ''}`}
              onClick={() => onZoom('region')}
            >
              <Compass size={14} />区域地图 (10×放大)
            </button>
            <button
              id="map-zoom-follow"
              type="button"
              role="tab"
              aria-selected={zoom === 'follow'}
              className={`zoom-tab ${zoom === 'follow' ? 'active' : ''}`}
              onClick={() => onZoom('follow')}
            >
              <LocateFixed size={14} />跟随马车周边
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              id="map-evade-war-toggle"
              type="button"
              className={`btn sm ${evadeWar ? 'amber' : ''}`}
              aria-pressed={evadeWar}
              onClick={onToggleEvadeWar}
              title="开启后将采用熄灯绕行策略：速度降低但避开交火盘查、节省灯油"
            >
              <ShieldAlert size={13} />{evadeWar ? '战区熄灯潜行：开' : '常规行军姿态'}
            </button>
            <span className="wax-pill">已加载大区 {loadedCount}/9</span>
          </div>
        </div>

        <div className="atlas-viewport">
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
                <MapPin size={13} style={{ color: 'var(--crimson)' }} />
                <span>
                  {region.name} · 马车 ({Math.round(state.world.pos.x)}, {Math.round(state.world.pos.y)}) · {TERRAIN_CN[currentTerrain]}
                  {cursorLabel ? ` ｜ ${cursorLabel}` : ''}
                </span>
              </div>
              <div className="hud-compass" aria-hidden="true">
                <Navigation2 size={16} style={{ color: 'var(--crimson)', transform: 'rotate(20deg)' }} />
                <span style={{ fontSize: 10 }}>北 · N</span>
              </div>
            </div>

            <div className="hud-bottom">
              <div className="hud-legend" aria-label="舆图图例">
                <span><i className="legend-swatch" style={{ background: '#bd9866' }} />干道 (1.4×速)</span>
                <span><i className="legend-swatch" style={{ background: '#608660' }} />密林 (0.72×速)</span>
                <span><i className="legend-swatch" style={{ background: '#788466' }} />沼泽 (0.45×速/高损)</span>
                <span><i className="legend-swatch" style={{ background: '#487e9e' }} />河湖 (需桥梁渡过)</span>
                <span><i className="legend-swatch" style={{ background: '#a63429' }} />多格城郭</span>
                <span><i className="legend-swatch" style={{ background: '#dbc59c' }} />未探明迷雾</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="atlas-sidebar" aria-label="区域手账与侦查控制">
        <div className="parchment-card">
          <div className="card-head">
            <h3><Trees size={15} />{region.name}</h3>
            <span className={`wax-pill ${region.dangerTier >= 4 ? 'crimson' : 'amber'}`}>危级 {region.dangerTier}/5</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>{region.theme}</p>
          {map && (
            <div className="stat-grid-2">
              <div className="metric-box">
                <small>小地图尺度 (10×)</small>
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
          <div className="parchment-card" style={{ borderColor: 'var(--crimson)' }}>
            <div className="card-head">
              <h3><Building2 size={15} />当前驻扎地</h3>
              <span className="wax-pill crimson">{currentPoi.kind === 'city' ? `城郭 (${currentPoi.footprint.length}格)` : '村寨'}</span>
            </div>
            {currentPoi.scouted && currentPoi.details ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>{currentPoi.details.name}</strong>
                <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{currentPoi.details.summary}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span className="wax-pill forest">希望值 {currentPoi.details.hope}</span>
                  {currentPoi.details.marketTraits.map(tr => <span key={tr} className="wax-pill">{tr}</span>)}
                </div>
                <button id="open-scouted-poi-btn" type="button" className="btn sm" onClick={() => onOpenScout(currentPoi)}>
                  <Eye size={13} />查看聚落卷宗与 NPC
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <strong>{currentPoi.placeholderName}</strong>
                <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>目前仅知坐标与占地轮廓，尚未派遣斥候接洽叙事生成聚落详情。</p>
                <button id="scout-current-poi-btn" type="button" className="btn primary full" onClick={() => onOpenScout(currentPoi)}>
                  <Sparkles size={14} />侦查此地（LLM 生成详情）
                </button>
              </div>
            )}
          </div>
        )}

        <div className="parchment-card">
          <div className="card-head">
            <h3><Footprints size={15} />视野内据点</h3>
            <small>{visiblePois.length} 处</small>
          </div>
          <div className="poi-list">
            {visiblePois.length ? visiblePois.map(poi => (
              <div key={poi.id} className="poi-row">
                <div className="poi-row-info">
                  <b>{poi.scouted && poi.details ? poi.details.name : poi.placeholderName}</b>
                  <small>{poi.kind === 'city' ? `多格城市 (${poi.footprint.length}格)` : '荒野村寨'} · ({poi.x}, {poi.y})</small>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    id={`assist-route-${poi.id}`}
                    type="button"
                    className="btn sm ghost"
                    title="绘制参考墨线前往此处"
                    onClick={() => onAssistSketchTo(poi.x, poi.y)}
                  >
                    <Route size={12} />引线
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
              <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>当前视野内尚无已知聚落，在羊皮纸上向远方划线探索吧。</p>
            )}
          </div>
        </div>

        <div className="parchment-card">
          <div className="card-head">
            <h3><Compass size={15} />跨区边境关口</h3>
            <small>靠近关口 4 格内可出境</small>
          </div>
          <div className="poi-list">
            {reachableGates.map(gate => (
              <div key={gate.direction} className="poi-row">
                <div className="poi-row-info">
                  <b>通往 {state.world.regions[gate.targetRegionId].name}</b>
                  <small>{gate.seen ? `坐标 (${gate.x}, ${gate.y}) · 距 ${Math.round(gate.dist)} 里` : '仍在迷雾深处'}</small>
                </div>
                {gate.dist <= 4 ? (
                  <button
                    id={`cross-border-${gate.targetRegionId}`}
                    type="button"
                    className="btn sm primary"
                    onClick={() => onCrossBorder(gate.targetRegionId)}
                  >
                    出境懒加载
                  </button>
                ) : gate.seen ? (
                  <button
                    id={`assist-gate-${gate.targetRegionId}`}
                    type="button"
                    className="btn sm"
                    onClick={() => onAssistSketchTo(gate.x, gate.y)}
                  >
                    引线前往
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
