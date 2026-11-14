import type { ReactNode } from 'react';
import {
  Bell,
  BookOpen,
  Building2,
  Caravan as CaravanIcon,
  ChevronRight,
  Clock,
  Compass,
  Cpu,
  Eye,
  Flame,
  FolderKanban,
  Footprints,
  HelpCircle,
  Map as MapIcon,
  Package,
  RefreshCw,
  Route,
  Save,
  ScrollText,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { CIRCUS_ROLE_LABELS } from '../domain/cardAdapter.ts';
import { isTileExplored } from '../domain/routeDraw.ts';
import type { AppPage, CircusState, Performer, RegionId, RouteEvaluation, SettlementPoi } from '../types.ts';
import { CaravanCrestIcon } from './CaravanCrestIcon.tsx';
import { isSettlementRevealed } from './Cartography/mapIcons.ts';
import { GirlPortrait } from './GirlPortrait.tsx';

const NAV_ITEMS: { id: AppPage; label: string; tone: 'crimson' | 'forest' | 'amber' | 'indigo'; Icon: typeof MapIcon }[] = [
  { id: 'map', label: '大陆舆图', tone: 'crimson', Icon: MapIcon },
  { id: 'caravan', label: '大篷车队', tone: 'forest', Icon: CaravanIcon },
  { id: 'supplies', label: '行囊兽笼', tone: 'amber', Icon: Package },
  { id: 'records', label: '旅程编年', tone: 'indigo', Icon: ScrollText },
];

const PAGE_HEADINGS: Record<AppPage, { kicker: string; title: string; subtitle: string; code: string }> = {
  map: {
    kicker: '舆图测绘 · 迷雾寻路',
    title: '风灯所照之处，即是归途。',
    subtitle: '在铜版古舆图上亲手划出前路：避开深水、断桥与焦土战线，探明沿途城郭与荒原村寨。',
    code: 'ATLAS // 128×128 & 10×',
  },
  caravan: {
    kicker: '车队整备 · 演员花名册',
    title: '破篷车里，载着最后一场欢笑。',
    subtitle: '修缮与扩建五节车厢，照料随行艺人；外部角色卡可登台献艺或派驻城镇。',
    code: 'CARAVAN // WAGONS & TROUPE',
  },
  supplies: {
    kicker: '行囊辎重 · 奇兽笼舍',
    title: '算准口粮、兽料与下一站的希望。',
    subtitle: '平衡货舱载重、客座与重型兽笼，将驯养进阶的奇幻生物留作压轴或送上拍卖行。',
    code: 'LOGISTICS // MENAGERIE',
  },
  records: {
    kicker: '行旅编年 · 势力格局',
    title: '记下每一道车辙与每一场掌声。',
    subtitle: '关注多方势力战火推移与残响电台传闻，向着全团隐居世外净土的目标迈进。',
    code: 'CHRONICLE // RETIREMENT',
  },
};

export function SideRail({
  page,
  dirty,
  onPage,
  onSave,
  onNewRandom,
  onOpenEngine,
  onOpenCardbox,
  onOpenGuide,
  unreadCount,
}: {
  page: AppPage;
  dirty: boolean;
  onPage: (page: AppPage) => void;
  onSave: () => void;
  onNewRandom: () => void;
  onOpenEngine: () => void;
  onOpenCardbox: () => void;
  onOpenGuide: () => void;
  unreadCount: number;
}) {
  return (
    <aside id="main-sidebar" className="side-rail octo-left-menu" aria-label="八方旅人式主选单栏">
      <div className="octo-menu-header">
        <button
          id="brand-home"
          type="button"
          className="octo-brand-btn"
          title="残响大篷车 · 返回全屏舆图"
          aria-label="残响大篷车，返回大陆舆图"
          onClick={() => onPage('map')}
        >
          <span className="brand-crest">
            <CaravanCrestIcon size={22} />
          </span>
          <span className="octo-menu-title">选单</span>
        </button>
        <div className="octo-stud-rule" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </div>
      </div>

      <nav aria-label="核心模块切换">
        {NAV_ITEMS.map(({ id, label, tone, Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              id={`nav-${id}`}
              type="button"
              aria-current={active ? 'page' : undefined}
              className={`silk-bookmark tone-${tone} ${active ? 'active' : ''}`}
              onClick={() => onPage(id)}
            >
              <span className="silk-bookmark-ribbon" aria-hidden="true" />
              <span className="silk-bookmark-content">
                <span className={`octo-cursor ${active ? 'on' : ''}`} aria-hidden="true">
                  <ChevronRight size={13} strokeWidth={2.6} />
                </span>
                <Icon size={14} strokeWidth={1.85} />
                <span>{label}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="octo-menu-divider" aria-hidden="true" />

      <div className="octo-sub-commands" role="group" aria-label="系统与手札指令">
        <button id="open-llm-console" type="button" className="silk-bookmark sub" onClick={onOpenEngine}>
          <span className="silk-bookmark-ribbon" aria-hidden="true" />
          <span className="silk-bookmark-content">
            <Cpu size={13} />
            <span>叙事引擎</span>
          </span>
        </button>
        <button id="open-cardbox" type="button" className="silk-bookmark sub" onClick={onOpenCardbox}>
          <span className="silk-bookmark-ribbon" aria-hidden="true" />
          <span className="silk-bookmark-content">
            <FolderKanban size={13} />
            <span>角色卡库</span>
          </span>
        </button>
        <button id="open-guide" type="button" className="silk-bookmark sub" onClick={onOpenGuide}>
          <span className="silk-bookmark-ribbon" aria-hidden="true" />
          <span className="silk-bookmark-content">
            <BookOpen size={13} />
            <span>测绘指南</span>
            {unreadCount > 0 && <em className="rail-badge">{unreadCount}</em>}
          </span>
        </button>
        <button id="btn-save-game" type="button" className="silk-bookmark sub" onClick={onSave}>
          <span className="silk-bookmark-ribbon" aria-hidden="true" />
          <span className="silk-bookmark-content">
            <Save size={13} />
            <span>{dirty ? '归档手稿 *' : '归档手稿'}</span>
          </span>
        </button>
        <button id="btn-new-random" type="button" className="silk-bookmark sub" onClick={onNewRandom}>
          <span className="silk-bookmark-ribbon" aria-hidden="true" />
          <span className="silk-bookmark-content">
            <RefreshCw size={13} />
            <span>随机重开</span>
          </span>
        </button>
      </div>
    </aside>
  );
}

export function RightTroupeLedger({
  state,
  dirty,
  notifCount,
  onLoadQuick,
  onOpenNotifications,
  onSelectPerformer,
  onOpenScout,
  onAssistSketchTo,
  onCrossBorder,
}: {
  state: CircusState;
  dirty: boolean;
  notifCount: number;
  onLoadQuick: () => void;
  onOpenNotifications: () => void;
  onSelectPerformer: (performer: Performer) => void;
  onOpenScout: (poi: SettlementPoi) => void;
  onAssistSketchTo: (tx: number, ty: number) => void;
  onCrossBorder: (targetRegionId: RegionId) => void;
}) {
  const region = state.world.regions[state.world.currentRegionId];
  const map = region.map;
  const avgDurability = Math.round(
    state.caravan.wagons.reduce((sum, w) => sum + w.durability, 0) / Math.max(1, state.caravan.wagons.length),
  );
  const slotLabel = state.timeSlot === 'dawn' ? '拂晓' : state.timeSlot === 'noon' ? '正午' : state.timeSlot === 'dusk' ? '暮色' : '夜演';
  const currentPoi = state.world.currentPoiId && map ? map.pois[state.world.currentPoiId] : undefined;

  const discoveredPois = map
    ? Object.values(map.pois).filter(poi => isSettlementRevealed(map, poi, state.world.pos))
    : [];
  const gates = map
    ? map.gates.map(g => ({
        ...g,
        dist: Math.hypot(g.x - state.world.pos.x, g.y - state.world.pos.y),
        seen: isTileExplored(map, g.x, g.y) || Math.hypot(g.x - state.world.pos.x, g.y - state.world.pos.y) <= 12,
      }))
    : [];

  return (
    <aside id="right-troupe-ledger" className="octo-right-ledger" aria-label="右侧半透明剧团状态与行军账房">
      {/* 右上角计时、巡游金币与核心补给速览 */}
      <div className="octo-ledger-top">
        <div className="octo-chrono-row">
          <span className="octo-chrono">
            <Clock size={13} />
            <b>第 {String(state.day).padStart(3, '0')} 日 · {slotLabel}</b>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button id="heading-load-btn" type="button" className="octo-mini-btn" onClick={onLoadQuick}>
              读档
            </button>
            <button
              id="open-notifications"
              type="button"
              className="octo-bell-btn"
              aria-label="打开风灯告警与通知中心"
              title={dirty ? '存在未归档进度 · 查看日志通知' : '查看日志通知'}
              onClick={onOpenNotifications}
            >
              <Bell size={13} />
              {notifCount > 0 && <span className="notif-dot" />}
            </button>
          </div>
        </div>

        <div className="octo-gold-row" title={`隐居目标 ${state.retirement.targetGold.toLocaleString('zh-CN')} 金币`}>
          <span className="octo-currency-mark"><Sparkles size={13} />巡游金</span>
          <strong>{state.gold.toLocaleString('zh-CN')}</strong>
        </div>

        <div className="octo-supply-strip" role="group" aria-label="行军物资余量">
          <span><Package size={11} />粮/料 <b>{state.supplies.rations}/{state.supplies.fodder}</b></span>
          <span><Flame size={11} />灯油 <b>{state.supplies.fuel}</b></span>
          <span><Wrench size={11} />车况 <b>{avgDurability}%</b></span>
        </div>
      </div>

      {/* 中部：八方旅人式剧团成员微缩立绘、等级与 HP/SP 双色状态条 */}
      <div className="octo-section-label">
        <span>随行剧团成员</span>
        <small>{state.performers.length}/{state.caravan.maxSeats} 席</small>
      </div>
      <div className="octo-party-list" role="list">
        {state.performers.map(perf => {
          const hpPct = Math.max(0, Math.min(100, Math.round((perf.hp / Math.max(1, perf.maxHp)) * 100)));
          const spPct = Math.max(0, Math.min(100, Math.round(perf.morale)));
          return (
            <button
              key={perf.id}
              id={`ledger-performer-${perf.id}`}
              type="button"
              role="listitem"
              className="octo-member-row"
              title="点击开启篝火夜谈与舞台换装"
              onClick={() => onSelectPerformer(perf)}
            >
              <div className="octo-member-sprite">
                <GirlPortrait girl={perf} variant="avatar" />
              </div>
              <div className="octo-member-stats">
                <div className="octo-member-head">
                  <strong>{perf.name}</strong>
                  <span className="octo-role-tag">{CIRCUS_ROLE_LABELS[perf.role]}</span>
                  <b className="octo-lv">LV. <em>{perf.level}</em></b>
                </div>

                <div className="octo-stat-line">
                  <small>HP</small>
                  <b>{perf.hp}<span>/{perf.maxHp}</span></b>
                </div>
                <div className="octo-hp-bar" aria-hidden="true">
                  <i style={{ width: `${hpPct}%` }} />
                </div>

                <div className="octo-stat-line">
                  <small>士气</small>
                  <b>{perf.morale}<span>/100</span></b>
                </div>
                <div className="octo-sp-bar" aria-hidden="true">
                  <i style={{ width: `${spPct}%` }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 下部：当前疆域驻地侦查与邻近据点/关口快捷调度台 */}
      <div className="octo-section-label">
        <span>{region.name} · 斥候手札</span>
        <small>危级 LV.{region.dangerTier}</small>
      </div>

      <div className="octo-recon-deck">
        {currentPoi && (
          <div className="octo-recon-card active-poi">
            <div className="octo-recon-head">
              <span><Building2 size={12} />驻扎：{currentPoi.scouted && currentPoi.details ? currentPoi.details.name : currentPoi.placeholderName}</span>
              <button
                id="scout-current-poi-btn"
                type="button"
                className="octo-inline-action primary"
                onClick={() => onOpenScout(currentPoi)}
              >
                {currentPoi.scouted ? <><Eye size={11} />进入驻地</> : <><Sparkles size={11} />侦查</>}
              </button>
            </div>
            {currentPoi.scouted && currentPoi.details && (
              <p className="octo-recon-desc">{currentPoi.details.summary}</p>
            )}
          </div>
        )}

        <div className="octo-recon-subhead">
          <Footprints size={11} />
          <span>已探明聚落 ({discoveredPois.length}) 与边境关口</span>
        </div>

        <div className="octo-recon-list">
          {discoveredPois.map(poi => (
            <div key={poi.id} className="octo-recon-item">
              <div className="octo-recon-info">
                <b>{poi.scouted && poi.details ? poi.details.name : poi.placeholderName}</b>
                <small>{poi.kind === 'city' ? '城郭' : '村寨'} · ({poi.x},{poi.y})</small>
              </div>
              <div className="octo-recon-btns">
                <button
                  id={`assist-route-${poi.id}`}
                  type="button"
                  className="octo-inline-action"
                  title="沿主干道自动寻路前往此处"
                  onClick={() => onAssistSketchTo(poi.x, poi.y)}
                >
                  <Route size={10} />寻路
                </button>
                <button
                  id={`scout-list-${poi.id}`}
                  type="button"
                  className={`octo-inline-action ${poi.scouted ? '' : 'primary'}`}
                  onClick={() => onOpenScout(poi)}
                >
                  {poi.scouted ? '详览' : '侦查'}
                </button>
              </div>
            </div>
          ))}

          {gates.map(gate => (
            <div key={gate.targetRegionId} className="octo-recon-item gate">
              <div className="octo-recon-info">
                <b><Compass size={10} /> 往 {state.world.regions[gate.targetRegionId].name}</b>
                <small>{gate.seen ? `距 ${Math.round(gate.dist)} 里` : '迷雾未探明'}</small>
              </div>
              {gate.dist <= 4 ? (
                <button
                  id={`cross-border-${gate.targetRegionId}`}
                  type="button"
                  className="octo-inline-action primary"
                  onClick={() => onCrossBorder(gate.targetRegionId)}
                >
                  出境展开
                </button>
              ) : gate.seen ? (
                <button
                  id={`assist-gate-${gate.targetRegionId}`}
                  type="button"
                  className="octo-inline-action"
                  title="沿主干道自动寻路至边境关口"
                  onClick={() => onAssistSketchTo(gate.x, gate.y)}
                >
                  寻路
                </button>
              ) : (
                <span className="octo-fog-tag">未探明</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function PageHeading({
  page,
  onCloseOverlay,
  right,
}: {
  page: AppPage;
  onCloseOverlay?: () => void;
  right?: ReactNode;
}) {
  const meta = PAGE_HEADINGS[page];
  return (
    <div className="page-heading">
      <div className="page-heading-main">
        <span className="breadcrumb">
          <Compass size={11} />
          <b>{meta.kicker}</b>
          <em className="heading-code">{meta.code}</em>
          <ChevronRight size={11} />
        </span>
        <h1>{meta.title}</h1>
        <p>{meta.subtitle}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {right}
        {onCloseOverlay && (
          <button
            id="close-stage-overlay-btn"
            type="button"
            className="btn sm"
            title="收起卷宗返回全屏舆图 (ESC)"
            onClick={onCloseOverlay}
          >
            <X size={12} />返回舆图
          </button>
        )}
      </div>
    </div>
  );
}

export function HelmBar({
  state,
  page,
  routeDraft,
  isTraveling,
  onClearRoute,
  onLaunchRoute,
  onReturnMap,
  onOpenGuide,
}: {
  state: CircusState;
  page: AppPage;
  routeDraft: RouteEvaluation | null;
  isTraveling?: boolean;
  onClearRoute: () => void;
  onLaunchRoute: () => void;
  onReturnMap: () => void;
  onOpenGuide: () => void;
}) {
  const region = state.world.regions[state.world.currentRegionId];
  const map = region.map;
  const poi = state.world.currentPoiId && map ? map.pois[state.world.currentPoiId] : undefined;
  const poiLabel = poi ? (poi.scouted && poi.details ? poi.details.name : poi.placeholderName) : '荒野扎营中';

  return (
    <footer id="bottom-helm-bar" className="helm-bar octo-bottom-bar">
      <div className="helm-status">
        {routeDraft && routeDraft.distanceTiles > 0 ? (
          <span>
            <b>已绘墨线 {routeDraft.distanceTiles} 里</b> · 均速 ×{routeDraft.avgSpeedMultiplier} · 预计 {routeDraft.travelDays} 日 ·
            消耗 口粮 {routeDraft.rationsCost} / 灯油 {routeDraft.fuelCost} / 车损 ~{routeDraft.durabilityCost}
            {routeDraft.blocked && <em style={{ color: '#f07c6e', marginLeft: 8, fontStyle: 'normal' }}>（{routeDraft.blockReason}）</em>}
          </span>
        ) : page !== 'map' ? (
          <span>
            正在查阅「<b>{NAV_ITEMS.find(n => n.id === page)?.label}</b>」卷宗 · 底层舆图保持实时展开
          </span>
        ) : (
          <span>
            可分多次续画路线，点「擦除墨线」重置 · 当前：<b>{region.name}</b>（{Math.floor(state.world.pos.x)}, {Math.floor(state.world.pos.y)}）· {poiLabel}
          </span>
        )}
      </div>

      <div className="helm-controls">
        {routeDraft && routeDraft.distanceTiles > 0 && (
          <>
            <button
              id="route-clear-btn"
              type="button"
              className="octo-bar-action"
              disabled={Boolean(isTraveling)}
              onClick={onClearRoute}
            >
              擦除墨线
            </button>
            <button
              id="route-launch-btn"
              type="button"
              className="octo-bar-action primary"
              disabled={Boolean(isTraveling) || routeDraft.validPoints.length < 2}
              onClick={onLaunchRoute}
            >
              {isTraveling ? '车队行进中…' : '沿线启程'}
            </button>
          </>
        )}

        <div className="octo-keyhints" aria-label="快捷键操作提示">
          <span className="octo-hint-item">
            <kbd className="octo-keycap">1</kbd>
            <kbd className="octo-keycap">2</kbd>
            <kbd className="octo-keycap">3</kbd>
            <em>视距</em>
          </span>
          <span className="octo-hint-item">
            <kbd className="octo-keycap">拖拽</kbd>
            <em>绘路</em>
          </span>
          <span className="octo-hint-item">
            <kbd className="octo-keycap">Enter</kbd>
            <em>启程</em>
          </span>
          <button id="helm-esc-btn" type="button" className="octo-hint-btn" onClick={page !== 'map' ? onReturnMap : onOpenGuide}>
            <kbd className="octo-keycap">ESC</kbd>
            <em>{page !== 'map' ? '返回舆图' : '指南'}</em>
          </button>
          <button id="helm-help-btn" type="button" className="octo-hint-btn" onClick={onOpenGuide}>
            <HelpCircle size={12} />
          </button>
        </div>
      </div>
    </footer>
  );
}
