import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { CaravanView } from './components/CaravanView.tsx';
import { CartographyView } from './components/Cartography/CartographyView.tsx';
import { BeastDialog } from './components/Modals/BeastDialog.tsx';
import { BestiaryDialog } from './components/Modals/BestiaryDialog.tsx';
import { DayLedgerDialog } from './components/Modals/DayLedgerDialog.tsx';
import { EngineConfigDialog } from './components/Modals/EngineConfigDialog.tsx';
import { GuideDialog, NotificationsDrawer } from './components/Modals/GuideAndNotifs.tsx';
import { PerformerDialog } from './components/Modals/PerformerDialog.tsx';
import { RetirementDialog } from './components/Modals/RetirementDialog.tsx';
import { ScoutDialog } from './components/Modals/ScoutDialog.tsx';
import { OrnateAtlasFrame } from './components/OrnateAtlasFrame.tsx';
import { RecordsView } from './components/RecordsView.tsx';
import { HelmBar, PageHeading, RightTroupeLedger, SideRail } from './components/Shell.tsx';
import { SuppliesView } from './components/SuppliesView.tsx';
import { VellumDogEar } from './components/VellumDogEar.tsx';
import { findAutoRoute } from './domain/pathfinding.ts';
import {
  evaluateRouteStroke,
  polylineLength,
  samplePolylineAtDistance,
  slicePolylineFromDistance,
} from './domain/routeDraw.ts';
import { hydrateCircusAssets, slimCircusAssets } from './engine/portraitAssets.ts';
import { kvGet, kvSet } from './engine/store.ts';
import { act } from './rules/act.ts';
import { loadState, SAVE_CURRENT_KEY, serializeState } from './rules/persistence.ts';
import { createInitialState } from './rules/state.ts';
import type {
  AppPage,
  Beast,
  CircusState,
  GameAction,
  MapZoomMode,
  Performer,
  RouteEvaluation,
  SettlementDetails,
  SettlementPoi,
} from './types.ts';

type ModalState =
  | { type: 'scout'; poi: SettlementPoi }
  | { type: 'performer'; id: string }
  | { type: 'beast'; beast: Beast }
  | { type: 'bestiary' }
  | { type: 'engine' }
  | { type: 'guide' }
  | { type: 'notifications' }
  | { type: 'ledger' }
  | { type: 'retirement' }
  | null;

interface TravelAnimState {
  pos: { x: number; y: number };
  remainingPoints: { x: number; y: number }[];
}

export function App() {
  const [state, setState] = useState<CircusState>(() => createInitialState());
  const [page, setPage] = useState<AppPage>('map');
  const [zoom, setZoom] = useState<MapZoomMode>('region');
  const [evadeWar, setEvadeWar] = useState(false);
  const [routeDraft, setRouteDraft] = useState<RouteEvaluation | null>(null);
  const [routeHistory, setRouteHistory] = useState<(RouteEvaluation | null)[]>([]);
  const [travelAnim, setTravelAnim] = useState<TravelAnimState | null>(null);
  const animRafRef = useRef<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<{ text: string; warn?: boolean } | null>(null);

  const notify = useCallback((text: string, warn = false) => {
    setToast({ text, warn });
  }, []);

  const stopTravelAnimation = useCallback(() => {
    if (animRafRef.current !== null) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }
    setTravelAnim(null);
  }, []);

  useEffect(() => () => {
    if (animRafRef.current !== null) cancelAnimationFrame(animRafRef.current);
  }, []);

  const dispatch = useCallback((action: GameAction) => {
    const prevDay = state.day;
    const res = act(state, action);
    setState(res.state);
    if (res.ok) setDirty(true);
    if (res.message) notify(res.message, !res.ok);
    const rolledOver = res.ok && res.state.day > prevDay && res.state.lastLedger && res.state.lastLedger.day >= prevDay;
    if (rolledOver && !(action.type === 'executeRoute' && res.state.world.currentPoiId)) {
      setModal({ type: 'ledger' });
    }
    return res;
  }, [state, notify]);

  const handleAssistSketchTo = useCallback((tx: number, ty: number) => {
    if (travelAnim) return;
    const map = state.world.regions[state.world.currentRegionId].map;
    if (!map) return;
    const autoPts = findAutoRoute(map, state.world.pos, { x: tx + 0.5, y: ty + 0.5 }, evadeWar);
    if (autoPts.length < 2) {
      notify('未能找到通往该据点的可行陆路或桥梁。', true);
      return;
    }
    const draft = evaluateRouteStroke(map, autoPts, state, evadeWar);
    setRouteHistory(prev => [...prev, routeDraft]);
    setRouteDraft(draft);
    setPage('map');
    if (zoom === 'world') setZoom('region');
    notify(
      draft.blocked
        ? `寻路遇阻：${draft.blockReason}`
        : `已沿主干道规划路径（${draft.distanceTiles} 里），可继续补画或按 Enter 启程。`,
      draft.blocked,
    );
  }, [state, evadeWar, zoom, notify, travelAnim, routeDraft]);

  const handleUndoRoute = useCallback(() => {
    if (travelAnim || !routeDraft) return;
    if (routeHistory.length === 0) {
      setRouteDraft(null);
      return;
    }
    const prev = routeHistory[routeHistory.length - 1] ?? null;
    setRouteHistory(h => h.slice(0, -1));
    setRouteDraft(prev);
  }, [travelAnim, routeDraft, routeHistory]);

  const handleLaunchRoute = useCallback(() => {
    if (travelAnim || !routeDraft || routeDraft.validPoints.length < 2) return;
    const points = routeDraft.validPoints.map(p => ({ ...p }));
    const totalLen = polylineLength(points);
    if (totalLen < 0.05) {
      const res = dispatch({ type: 'executeRoute', points, evadeWar });
      if (res.ok) setRouteDraft(null);
      return;
    }

    const durationMs = Math.max(650, Math.min(2600, Math.round(totalLen * 44)));
    const startMs = performance.now();

    const step = (now: number) => {
      const rawT = Math.min(1, (now - startMs) / durationMs);
      const ease = rawT < 0.5
        ? 2 * rawT * rawT
        : 1 - Math.pow(-2 * rawT + 2, 2) / 2;
      const dist = totalLen * ease;
      const pos = samplePolylineAtDistance(points, dist);
      const remainingPoints = slicePolylineFromDistance(points, dist);
      setTravelAnim({ pos, remainingPoints });

      if (rawT < 1) {
        animRafRef.current = requestAnimationFrame(step);
      } else {
        animRafRef.current = null;
        setTravelAnim(null);
        const res = dispatch({ type: 'executeRoute', points, evadeWar });
        if (res.ok) {
          setRouteDraft(null);
          setRouteHistory([]);
          const landedId = res.state.world.currentPoiId;
          const landedPoi = landedId
            ? res.state.world.regions[res.state.world.currentRegionId].map?.pois[landedId]
            : undefined;
          if (landedPoi) {
            setModal({ type: 'scout', poi: landedPoi });
          }
        }
      }
    };

    setTravelAnim({ pos: points[0]!, remainingPoints: points });
    animRafRef.current = requestAnimationFrame(step);
  }, [travelAnim, routeDraft, dispatch, evadeWar]);

  const handleSave = async () => {
    const slimmed = await slimCircusAssets(state);
    await kvSet(SAVE_CURRENT_KEY, serializeState(slimmed));
    setDirty(false);
    notify('羊皮纸手稿已分片归档至本地与浏览器存储。');
  };

  const handleLoadQuick = async () => {
    stopTravelAnimation();
    const raw = await kvGet<string>(SAVE_CURRENT_KEY);
    if (!raw) {
      notify('尚未找到本地归档记录。', true);
      return;
    }
    const hydrated = await hydrateCircusAssets(loadState(raw));
    setState(hydrated);
    setDirty(false);
    setRouteDraft(null);
    setRouteHistory([]);
    notify('已读回最近一份手稿存档。');
  };

  const handleBuySupply = (key: keyof CircusState['supplies'], amount: number, cost: number) => {
    if (state.gold < cost) {
      notify('巡游金币不足，无法采购这批补给。', true);
      return;
    }
    setState(prev => ({
      ...prev,
      gold: prev.gold - cost,
      supplies: { ...prev.supplies, [key]: prev.supplies[key] + amount },
    }));
    setDirty(true);
    notify(`已补给 +${amount}，花费 ${cost} 金币。`);
  };

  // 八方旅人全局键盘快捷键支持（Escape 仅关闭浮窗/弹窗，绝不误清空分次绘制的路线）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        if (modal) setModal(null);
        else if (page !== 'map') setPage('map');
      } else if (e.key === 'Enter' && page === 'map' && !modal && !travelAnim && routeDraft && routeDraft.validPoints.length >= 2) {
        e.preventDefault();
        handleLaunchRoute();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && page === 'map' && !modal && !travelAnim && routeDraft) {
        e.preventDefault();
        handleUndoRoute();
      } else if (!modal && page === 'map') {
        if (e.key === '1') setZoom('world');
        else if (e.key === '2') setZoom('region');
        else if (e.key === '3') setZoom('follow');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal, page, travelAnim, routeDraft, handleLaunchRoute, handleUndoRoute]);

  const activePerformer: Performer | undefined = modal?.type === 'performer'
    ? state.performers.find(p => p.id === modal.id)
    : undefined;
  const activeRegion = state.world.regions[state.world.currentRegionId];
  const scaleLabel = zoom === 'world' ? '大陆全图 128×128' : zoom === 'region' ? '疆域详图 10×' : '近景跟随测绘';

  return (
    <div className="app-shell octo-shell">
      <CartographyView
        state={state}
        zoom={zoom}
        interactive={page === 'map' && !modal}
        travelAnim={travelAnim}
        onZoom={setZoom}
        routeDraft={routeDraft}
        onRouteDraft={setRouteDraft}
        onCommitStroke={prevDraft => {
          setRouteHistory(h => [...h, prevDraft]);
        }}
        evadeWar={evadeWar}
        onToggleEvadeWar={() => setEvadeWar(v => !v)}
        onOpenScout={poi => setModal({ type: 'scout', poi })}
        onAssistSketchTo={handleAssistSketchTo}
        onAttemptCapture={(speciesId, useBait) => {
          dispatch({ type: 'attemptWildCapture', speciesId, useBait });
        }}
      />

      {page !== 'map' && (
        <main id="main-stage" className="app-main octo-stage-overlay">
          <div id="main-stage-sheet" className="vellum-sheet">
            <VellumDogEar id="main-vellum-dogear" />
            <PageHeading
              page={page}
              onCloseOverlay={() => setPage('map')}
            />

            {page === 'caravan' && (
              <CaravanView
                state={state}
                onUpgradeWagon={wagonId => dispatch({ type: 'upgradeWagon', wagonId })}
                onRepairWagon={wagonId => dispatch({ type: 'repairWagon', wagonId })}
                onHireCandidate={candidateId => dispatch({ type: 'hireCandidate', candidateId })}
                onSelectPerformer={perf => setModal({ type: 'performer', id: perf.id })}
                onImportCardAsPerformer={(card, role) => dispatch({ type: 'importCardAsPerformer', card, role })}
                onPlaceCardAsNpc={(card, poiId) => dispatch({ type: 'placeCardAsNpc', card, poiId })}
                onNotify={notify}
              />
            )}

            {page === 'supplies' && (
              <SuppliesView
                state={state}
                onSelectBeast={beast => setModal({ type: 'beast', beast })}
                onOpenBestiary={() => setModal({ type: 'bestiary' })}
                onBuySupply={handleBuySupply}
                onNotify={notify}
              />
            )}

            {page === 'records' && (
              <RecordsView
                state={state}
                onOpenRetirement={() => setModal({ type: 'retirement' })}
              />
            )}
          </div>
        </main>
      )}

      <OrnateAtlasFrame regionName={activeRegion.name} scaleLabel={scaleLabel} />

      <SideRail
        page={page}
        dirty={dirty}
        onPage={setPage}
        onSave={() => void handleSave()}
        onNewRandom={() => {
          stopTravelAnimation();
          setRouteDraft(null);
          setRouteHistory([]);
          setPage('map');
          dispatch({ type: 'newGame', seed: Math.floor(Math.random() * 999_999) + 1 });
        }}
        onOpenEngine={() => setModal({ type: 'engine' })}
        onOpenCardbox={() => { setPage('caravan'); notify('可在右侧「角色卡双栖指派台」导入并试配角色卡。'); }}
        onOpenBestiary={() => setModal({ type: 'bestiary' })}
        onOpenGuide={() => setModal({ type: 'guide' })}
        unreadCount={state.logs.length > 0 ? Math.min(9, state.logs.length) : 0}
      />

      <RightTroupeLedger
        state={state}
        dirty={dirty}
        notifCount={state.logs.length}
        onLoadQuick={() => void handleLoadQuick()}
        onOpenNotifications={() => setModal({ type: 'notifications' })}
        onSelectPerformer={perf => setModal({ type: 'performer', id: perf.id })}
        onOpenScout={poi => setModal({ type: 'scout', poi })}
        onAssistSketchTo={handleAssistSketchTo}
        onCrossBorder={targetRegionId => {
          stopTravelAnimation();
          const res = dispatch({ type: 'crossBorder', targetRegionId });
          if (res.ok) {
            setRouteDraft(null);
            setRouteHistory([]);
          }
        }}
        onAdvanceTimeSlot={() => dispatch({ type: 'advanceTimeSlot' })}
        onOpenLedger={() => setModal({ type: 'ledger' })}
        onOpenRetirement={() => setModal({ type: 'retirement' })}
      />

      <HelmBar
        state={state}
        page={page}
        routeDraft={routeDraft}
        isTraveling={Boolean(travelAnim)}
        onUndoRoute={handleUndoRoute}
        onClearRoute={() => {
          if (!travelAnim) {
            setRouteDraft(null);
            setRouteHistory([]);
          }
        }}
        onLaunchRoute={handleLaunchRoute}
        onEndDay={() => dispatch({ type: 'endDay' })}
        onReturnMap={() => setPage('map')}
        onOpenGuide={() => setModal({ type: 'guide' })}
      />

      {toast && (
        <div id="toast-region" className="toast-region" role="status" aria-live="polite">
          <div className={`parchment-toast ${toast.warn ? 'warn' : ''}`}>
            {toast.warn ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            <span>{toast.text}</span>
            <button id="toast-close-btn" type="button" aria-label="关闭提示" onClick={() => setToast(null)}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {modal?.type === 'scout' && (
        <ScoutDialog
          state={state}
          poi={activeRegion.map?.pois[modal.poi.id] ?? modal.poi}
          onClose={() => setModal(null)}
          onCommitScout={(poiId: string, details: SettlementDetails) => {
            dispatch({ type: 'scoutSettlement', poiId, details });
          }}
          onAction={action => { dispatch(action); }}
          onNotify={msg => notify(msg)}
        />
      )}

      {modal?.type === 'performer' && activePerformer && (
        <PerformerDialog
          performer={activePerformer}
          day={state.day}
          regionName={activeRegion.name}
          onClose={() => setModal(null)}
          onChangeExpression={(performerId, expression) => dispatch({ type: 'setPerformerExpression', performerId, expression })}
          onChangePortrait={(performerId, portrait) => dispatch({ type: 'setPerformerPortrait', performerId, portrait })}
          onNotify={notify}
        />
      )}

      {modal?.type === 'beast' && (
        <BeastDialog
          beast={modal.beast}
          onClose={() => setModal(null)}
          onNotify={msg => notify(msg)}
        />
      )}

      {modal?.type === 'bestiary' && (
        <BestiaryDialog
          state={state}
          onClose={() => setModal(null)}
          onAttemptCapture={(speciesId, useBait) => {
            dispatch({ type: 'attemptWildCapture', speciesId, useBait });
          }}
        />
      )}

      {modal?.type === 'engine' && (
        <EngineConfigDialog
          onClose={() => setModal(null)}
          onNotify={msg => notify(msg)}
        />
      )}

      {modal?.type === 'guide' && (
        <GuideDialog onClose={() => setModal(null)} />
      )}

      {modal?.type === 'notifications' && (
        <NotificationsDrawer logs={state.logs} onClose={() => setModal(null)} />
      )}

      {modal?.type === 'ledger' && state.lastLedger && (
        <DayLedgerDialog
          ledger={state.lastLedger}
          nextDay={state.day}
          onClose={() => setModal(null)}
        />
      )}

      {(state.phase === 'retired' || modal?.type === 'retirement') && (
        <RetirementDialog
          state={state}
          onRetire={haven => {
            const res = dispatch({ type: 'retire', haven });
            if (res.ok) setModal(null);
          }}
          onNewGame={() => {
            stopTravelAnimation();
            setRouteDraft(null);
            setRouteHistory([]);
            setModal(null);
            setPage('map');
            dispatch({ type: 'newGame', seed: Math.floor(Math.random() * 999_999) + 1 });
          }}
          onClose={state.phase === 'retired' ? undefined : () => setModal(null)}
        />
      )}
    </div>
  );
}
