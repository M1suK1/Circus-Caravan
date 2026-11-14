import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Eye,
  Globe,
  LocateFixed,
  MapPin,
  Minus,
  PawPrint,
  Plus,
  Route,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { REGION_CATALOG, REGION_IDS } from '../../content/regions.ts';
import { findBeastSpecies } from '../../content/species.ts';
import { getElementProfile } from '../../domain/creatureTaxonomy.ts';
import { computeTerrainEncounterTable, getTerrainBaseEncounterChance } from '../../domain/encounters.ts';
import { regionTerrainAt } from '../../domain/regionGen.ts';
import { isTileExplored, TERRAIN_COST, TERRAIN_SPEED } from '../../domain/routeDraw.ts';
import { worldRegionAt, worldTerrainAt } from '../../domain/worldGen.ts';
import type {
  CircusState,
  MapZoomMode,
  RegionId,
  RouteEvaluation,
  SettlementPoi,
  TerrainType,
} from '../../types.ts';
import { LegendCaravanSvg, LegendCitySvg, LegendVillageSvg } from '../CaravanCrestIcon.tsx';
import { CreaturePortrait } from '../CreaturePortrait.tsx';
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

interface TerrainInspection {
  gx: number;
  gy: number;
  regionId: RegionId;
  terrain: TerrainType;
  explored: boolean;
}

export function CartographyView({
  state,
  zoom,
  interactive,
  travelAnim,
  onZoom,
  routeDraft,
  onRouteDraft,
  onCommitStroke,
  evadeWar,
  onToggleEvadeWar,
  onOpenScout,
  onAssistSketchTo,
  onAttemptCapture,
}: {
  state: CircusState;
  zoom: MapZoomMode;
  interactive: boolean;
  travelAnim?: { pos: { x: number; y: number }; remainingPoints: { x: number; y: number }[] } | null;
  onZoom: (mode: MapZoomMode) => void;
  routeDraft: RouteEvaluation | null;
  onRouteDraft: (draft: RouteEvaluation | null) => void;
  onCommitStroke?: (prevDraft: RouteEvaluation | null, nextDraft: RouteEvaluation) => void;
  evadeWar: boolean;
  onToggleEvadeWar: () => void;
  onOpenScout: (poi: SettlementPoi) => void;
  onAssistSketchTo: (tx: number, ty: number) => void;
  onAttemptCapture: (speciesId: string, useBait: boolean) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vpStateRef = useRef<ViewportTransform | null>(null);
  const downClientRef = useRef<{ x: number; y: number; button: number } | null>(null);
  const [focusedPoiId, setFocusedPoiId] = useState<string | null>(null);
  const [inspectedTile, setInspectedTile] = useState<TerrainInspection | null>(null);
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
    setInspectedTile(null);
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

  const handleRightClickInspect = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const vp = vpStateRef.current;
    if (!vp) return;
    const pt = sketch.toMapPoint(clientX, clientY, canvas)
      ?? (() => {
        const { px, py } = sketch.toCanvasPx(clientX, clientY, canvas);
        return {
          x: vp.viewX + (px / Math.max(1, vp.canvasW)) * vp.viewW,
          y: vp.viewY + (py / Math.max(1, vp.canvasH)) * vp.viewH,
        };
      })();
    const gx = Math.floor(pt.x);
    const gy = Math.floor(pt.y);

    if (zoom === 'world') {
      const wTer = worldTerrainAt(state.world.worldMap, gx, gy);
      const wReg = worldRegionAt(state.world.worldMap, gx, gy) ?? state.world.currentRegionId;
      setFocusedPoiId(null);
      setInspectedTile({ gx, gy, regionId: wReg, terrain: wTer, explored: true });
      return;
    }

    if (!map) return;
    const ter = regionTerrainAt(map, gx, gy);
    if (ter === 'outside') return;
    const explored = isTileExplored(map, gx, gy) || Math.hypot(gx + 0.5 - displayPos.x, gy + 0.5 - displayPos.y) <= 12;
    setFocusedPoiId(null);
    setInspectedTile({ gx, gy, regionId: state.world.currentRegionId, terrain: ter, explored });
  };

  const currentTerrain = map
    ? regionTerrainAt(map, Math.floor(displayPos.x), Math.floor(displayPos.y))
    : 'wasteland';

  const focusedPoi = focusedPoiId && map ? map.pois[focusedPoiId] : undefined;
  const canDraw = interactive && !travelAnim;

  const inspectSummary = useMemo(() => {
    if (!inspectedTile) return null;
    const table = computeTerrainEncounterTable(inspectedTile.regionId, inspectedTile.terrain, state.timeSlot);
    const seenSet = new Set(state.encounteredSpeciesIds);
    const seenCreatures = table.filter(item => seenSet.has(item.speciesId));
    const unseenCount = Math.max(0, table.length - seenCreatures.length);
    const baseChance = getTerrainBaseEncounterChance(inspectedTile.terrain);
    const spd = TERRAIN_SPEED[inspectedTile.terrain];
    const cost = TERRAIN_COST[inspectedTile.terrain];
    return { table, seenCreatures, unseenCount, baseChance, spd, cost };
  }, [inspectedTile, state.timeSlot, state.encounteredSpeciesIds]);

  return (
    <>
      <div id="octo-atlas-underlay" className={`octo-atlas-underlay ${interactive ? '' : 'dimmed'}`}>
        <div ref={viewportRef} className="atlas-viewport">
        <canvas
          id="cartography-canvas"
          ref={canvasRef}
          className={`atlas-canvas ${zoom === 'world' || sketch.panning ? 'pan-mode' : ''}`}
          onContextMenu={e => e.preventDefault()}
          onWheel={handleWheel}
          onPointerDown={e => {
            if (!interactive) return;
            downClientRef.current = { x: e.clientX, y: e.clientY, button: e.button };
            if (!travelAnim || e.button === 2 || e.button === 1) {
              sketch.onPointerDown(e);
            }
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
            if (!interactive) return;
            const strokeResult = !travelAnim || e.button === 2 || e.button === 1
              ? sketch.onPointerUp(e)
              : null;
            const start = downClientRef.current;
            downClientRef.current = null;
            if (!start) return;
            const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);

            // 右键轻点（位移 < 6px）：勘测地形生态与曾经遇到的奇幻生物（拖拽 >= 6px 仍为平滑平移）
            if (start.button === 2 && dist < 6) {
              handleRightClickInspect(e.clientX, e.clientY, e.currentTarget);
              return;
            }

            if (canDraw && start.button === 0) {
              if (dist < 6) {
                const pt = sketch.toMapPoint(e.clientX, e.clientY, e.currentTarget);
                if (pt && zoom === 'world') {
                  const clickedReg = worldRegionAt(state.world.worldMap, Math.floor(pt.x), Math.floor(pt.y));
                  if (clickedReg === state.world.currentRegionId) {
                    onZoom('region');
                  }
                  return;
                }
                if (pt && map && zoom !== 'world') {
                  const hit = Object.values(map.pois).find(
                    poi => isSettlementRevealed(map, poi, state.world.pos) && Math.hypot(poi.x + 0.5 - pt.x, poi.y + 0.5 - pt.y) <= 3.6,
                  );
                  if (hit) {
                    sketch.restorePreStrokeDraft();
                    setInspectedTile(null);
                    setFocusedPoiId(hit.id);
                    return;
                  }
                }
              }
              if (strokeResult?.committed && strokeResult.committed.validPoints.length >= 2) {
                const prevLen = strokeResult.previous?.validPoints.length ?? 0;
                if (strokeResult.committed.validPoints.length > prevLen || strokeResult.committed !== strokeResult.previous) {
                  onCommitStroke?.(strokeResult.previous, strokeResult.committed);
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

            <div className="octo-bottom-hud">
              <div className="octo-coord-strip">
                <MapPin size={12} />
                <span>
                  {region.name} ({Math.floor(displayPos.x)},{Math.floor(displayPos.y)}) · {TERRAIN_CN[currentTerrain]} · 已展疆域 {loadedCount}/9
                  {zoom !== 'world' ? ' · 左键分次画线 / 右键查地形或拖移' : ' · 右键查大区生态'}
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

    {interactive && focusedPoi && (
      <div id="map-poi-quick-note" className="paper-note tone-ivory pinned octo-bottom-left-card">
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
            {focusedPoi.scouted ? <><Eye size={11} />进入驻地与建筑</> : <><Sparkles size={11} />侦查生成</>}
          </button>
        </div>
      </div>
    )}

    {/* 右键地图格点弹出的地形信息与曾经遇到的奇幻生物卡片（独立高层固定于屏幕左下角） */}
    {interactive && inspectedTile && inspectSummary && (
      <div id="map-terrain-inspect-note" className="paper-note tone-kraft pinned octo-bottom-left-card">
        <div className="card-head" style={{ marginBottom: 5 }}>
          <h3>
            <MapPin size={14} />
            {inspectedTile.explored
              ? `${TERRAIN_CN[inspectedTile.terrain] ?? inspectedTile.terrain} (${inspectedTile.gx}, ${inspectedTile.gy})`
              : `云雾未探明 (${inspectedTile.gx}, ${inspectedTile.gy})`}
          </h3>
          <button
            id="close-terrain-inspect"
            type="button"
            aria-label="关闭地形勘测卡"
            onClick={() => setInspectedTile(null)}
          >
            <X size={13} />
          </button>
        </div>

        {!inspectedTile.explored ? (
          <p style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
            该地块尚被未知流云迷雾遮蔽（所属：{REGION_CATALOG[inspectedTile.regionId].name}）。请指挥大篷车靠近点亮风灯后再右键勘测详细生态。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="stat-grid-2">
              <div className="metric-box">
                <small>行军速度 / 通行</small>
                <b>{inspectSummary.spd > 0 ? `×${inspectSummary.spd.toFixed(2)}` : '不可通行'}</b>
              </div>
              <div className="metric-box">
                <small>野外生物遭遇率</small>
                <b>{inspectSummary.baseChance}%</b>
              </div>
            </div>
            <small style={{ color: 'var(--ink-muted)' }}>
              所属：{REGION_CATALOG[inspectedTile.regionId].name} · 灯油 ×{inspectSummary.cost.fuel} · 车损 ×{inspectSummary.cost.wear}
            </small>

            <div style={{ borderTop: '1px dashed var(--umber-line)', paddingTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <b style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
                  <PawPrint size={12} style={{ color: 'var(--crimson)' }} />曾经遇到的奇幻生物
                </b>
                <small style={{ color: 'var(--ink-muted)' }}>未知物种 {inspectSummary.unseenCount} 种</small>
              </div>
              {inspectSummary.seenCreatures.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 132, overflowY: 'auto' }}>
                  {inspectSummary.seenCreatures.map(sp => {
                    const fullSp = findBeastSpecies(sp.speciesId);
                    const el = getElementProfile(sp.element);
                    return (
                      <div key={sp.speciesId} className="poi-row" style={{ padding: '4px 6px', gap: 7 }}>
                        {fullSp && <CreaturePortrait species={fullSp} size={32} />}
                        <div className="poi-row-info" style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <b>{sp.name}</b>
                            <span className="wax-pill" style={{ background: el.bg, color: el.color, borderColor: el.color, fontSize: 9.5 }}>
                              {el.shortName} · {sp.probabilityPct}%
                            </span>
                          </div>
                          <small>{sp.passiveEffect ?? sp.description}</small>
                        </div>
                        <button
                          id={`terrain-capture-${sp.speciesId}`}
                          type="button"
                          className="btn sm primary"
                          disabled={state.supplies.tamingNets < 1}
                          title="消耗 1 张麻醉捕捉网发起随机性格/特性捕捉"
                          onClick={() => onAttemptCapture(sp.speciesId, state.supplies.props > 0)}
                        >
                          捕捉
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                  尚未在此类地形留下遭遇记录；沿途经过此类区域时将按 {inspectSummary.baseChance}% 概率触发目击。
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    )}
    </>
  );
}
