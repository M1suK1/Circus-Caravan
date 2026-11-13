import { useCallback, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { CaravanView } from './components/CaravanView.tsx';
import { CartographyView } from './components/Cartography/CartographyView.tsx';
import { BeastDialog } from './components/Modals/BeastDialog.tsx';
import { EngineConfigDialog } from './components/Modals/EngineConfigDialog.tsx';
import { GuideDialog, NotificationsDrawer } from './components/Modals/GuideAndNotifs.tsx';
import { PerformerDialog } from './components/Modals/PerformerDialog.tsx';
import { ScoutDialog } from './components/Modals/ScoutDialog.tsx';
import { RecordsView } from './components/RecordsView.tsx';
import { HelmBar, PageHeading, SideRail, Topbar } from './components/Shell.tsx';
import { SuppliesView } from './components/SuppliesView.tsx';
import { evaluateRouteStroke } from './domain/routeDraw.ts';
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
  | { type: 'engine' }
  | { type: 'guide' }
  | { type: 'notifications' }
  | null;

export function App() {
  const [state, setState] = useState<CircusState>(() => createInitialState());
  const [page, setPage] = useState<AppPage>('map');
  const [zoom, setZoom] = useState<MapZoomMode>('region');
  const [evadeWar, setEvadeWar] = useState(false);
  const [routeDraft, setRouteDraft] = useState<RouteEvaluation | null>(null);
  const [dirty, setDirty] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<{ text: string; warn?: boolean } | null>(null);

  const notify = useCallback((text: string, warn = false) => {
    setToast({ text, warn });
  }, []);

  const dispatch = useCallback((action: GameAction) => {
    const res = act(state, action);
    setState(res.state);
    if (res.ok) setDirty(true);
    if (res.message) notify(res.message, !res.ok);
    return res;
  }, [state, notify]);

  const handleAssistSketchTo = (tx: number, ty: number) => {
    const map = state.world.regions[state.world.currentRegionId].map;
    if (!map) return;
    const draft = evaluateRouteStroke(map, [state.world.pos, { x: tx, y: ty }], state, evadeWar);
    setRouteDraft(draft);
    if (zoom === 'world') setZoom('region');
    notify(draft.blocked ? `引线遇阻：${draft.blockReason}` : `已绘参考路线至目标（${draft.distanceTiles} 里），可微调或点击「沿线启程」。`, draft.blocked);
  };

  const handleLaunchRoute = () => {
    if (!routeDraft || routeDraft.validPoints.length < 2) return;
    const res = dispatch({ type: 'executeRoute', points: routeDraft.validPoints, evadeWar });
    if (res.ok) setRouteDraft(null);
  };

  const handleSave = async () => {
    const slimmed = await slimCircusAssets(state);
    await kvSet(SAVE_CURRENT_KEY, serializeState(slimmed));
    setDirty(false);
    notify('羊皮纸手稿已分片归档至本地与浏览器存储。');
  };

  const handleLoadQuick = async () => {
    const raw = await kvGet<string>(SAVE_CURRENT_KEY);
    if (!raw) {
      notify('尚未找到本地归档记录。', true);
      return;
    }
    const hydrated = await hydrateCircusAssets(loadState(raw));
    setState(hydrated);
    setDirty(false);
    setRouteDraft(null);
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

  const activePerformer: Performer | undefined = modal?.type === 'performer'
    ? state.performers.find(p => p.id === modal.id)
    : undefined;
  const activeRegion = state.world.regions[state.world.currentRegionId];

  return (
    <div className="app-shell">
      <SideRail
        page={page}
        onPage={setPage}
        onOpenEngine={() => setModal({ type: 'engine' })}
        onOpenCardbox={() => { setPage('caravan'); notify('请在下方「角色卡双栖指派台」导入并试配角色卡。'); }}
        onOpenGuide={() => setModal({ type: 'guide' })}
        onOpenSettings={() => void handleLoadQuick()}
        unreadCount={state.logs.length > 0 ? Math.min(9, state.logs.length) : 0}
      />

      <Topbar
        state={state}
        dirty={dirty}
        onSave={() => void handleSave()}
        onNewRandom={() => {
          setRouteDraft(null);
          dispatch({ type: 'newGame', seed: Math.floor(Math.random() * 999_999) + 1 });
        }}
        onOpenNotifications={() => setModal({ type: 'notifications' })}
        notifCount={state.logs.length}
      />

      <main id="main-stage" className="app-main">
        <div id="main-stage-sheet" className="vellum-sheet">
          <PageHeading
            page={page}
            right={
              <button id="heading-load-btn" type="button" className="btn sm" onClick={() => void handleLoadQuick()}>
                读回最近手稿
              </button>
            }
          />

          {page === 'map' && (
            <CartographyView
              state={state}
              zoom={zoom}
              onZoom={setZoom}
              routeDraft={routeDraft}
              onRouteDraft={setRouteDraft}
              evadeWar={evadeWar}
              onToggleEvadeWar={() => setEvadeWar(v => !v)}
              onOpenScout={poi => setModal({ type: 'scout', poi })}
              onCrossBorder={targetRegionId => {
                const res = dispatch({ type: 'crossBorder', targetRegionId });
                if (res.ok) setRouteDraft(null);
              }}
              onAssistSketchTo={handleAssistSketchTo}
            />
          )}

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
              onBuySupply={handleBuySupply}
              onNotify={notify}
            />
          )}

          {page === 'records' && (
            <RecordsView state={state} onNotify={notify} />
          )}
        </div>
      </main>

      <HelmBar
        state={state}
        routeDraft={routeDraft}
        onClearRoute={() => setRouteDraft(null)}
        onLaunchRoute={handleLaunchRoute}
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
          onNotify={msg => notify(msg)}
        />
      )}

      {modal?.type === 'performer' && activePerformer && (
        <PerformerDialog
          performer={activePerformer}
          regionName={activeRegion.name}
          onClose={() => setModal(null)}
          onChangeExpression={(performerId, expression) => dispatch({ type: 'setPerformerExpression', performerId, expression })}
        />
      )}

      {modal?.type === 'beast' && (
        <BeastDialog
          beast={modal.beast}
          onClose={() => setModal(null)}
          onNotify={msg => notify(msg)}
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
    </div>
  );
}
