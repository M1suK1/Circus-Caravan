import type { ReactNode } from 'react';
import {
  Bell,
  BookOpen,
  Caravan as CaravanIcon,
  ChevronRight,
  Compass,
  Cpu,
  Flame,
  FolderKanban,
  HelpCircle,
  Map as MapIcon,
  Package,
  RefreshCw,
  Save,
  ScrollText,
  Settings2,
  Shield,
  Sparkles,
  Sun,
  Wrench,
} from 'lucide-react';
import type { AppPage, CircusState, RouteEvaluation } from '../types.ts';
import { CaravanCrestIcon } from './CaravanCrestIcon.tsx';

const NAV_ITEMS: { id: AppPage; label: string; tone: 'crimson' | 'forest' | 'amber' | 'indigo'; Icon: typeof MapIcon }[] = [
  { id: 'map', label: '地图', tone: 'crimson', Icon: MapIcon },
  { id: 'caravan', label: '马车', tone: 'forest', Icon: CaravanIcon },
  { id: 'supplies', label: '物资', tone: 'amber', Icon: Package },
  { id: 'records', label: '记录', tone: 'indigo', Icon: ScrollText },
];

const PAGE_HEADINGS: Record<AppPage, { kicker: string; title: string; subtitle: string; code: string }> = {
  map: {
    kicker: '舆图测绘 · 迷雾寻路',
    title: '风灯所照之处，即是归途。',
    subtitle: '在古羊皮舆图上亲手划出前路：避开深水、断桥与焦土战线，探明沿途城郭与荒原村寨。',
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
  onPage,
  onOpenEngine,
  onOpenCardbox,
  onOpenGuide,
  onOpenSettings,
  unreadCount,
}: {
  page: AppPage;
  onPage: (page: AppPage) => void;
  onOpenEngine: () => void;
  onOpenCardbox: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  unreadCount: number;
}) {
  return (
    <aside id="main-sidebar" className="side-rail" aria-label="主功能导航栏">
      <button
        id="brand-home"
        type="button"
        className="brand-mark"
        title="残响大篷车 · 返回羊皮纸舆图"
        aria-label="残响大篷车，返回地图"
        onClick={() => onPage('map')}
      >
        <span className="brand-crest">
          <CaravanCrestIcon size={28} />
        </span>
      </button>
      <div className="rail-rule" />
      <nav aria-label="核心模块切换">
        {NAV_ITEMS.map(({ id, label, tone, Icon }) => (
          <button
            key={id}
            id={`nav-${id}`}
            type="button"
            aria-current={page === id ? 'page' : undefined}
            className={`silk-bookmark tone-${tone} ${page === id ? 'active' : ''}`}
            onClick={() => onPage(id)}
          >
            <span className="silk-bookmark-ribbon" aria-hidden="true" />
            <span className="silk-bookmark-content">
              <Icon size={16} strokeWidth={1.85} />
              <span>{label}</span>
            </span>
          </button>
        ))}
      </nav>
      <div className="rail-bottom">
        <button
          id="open-llm-console"
          type="button"
          className="rail-utility"
          title="叙事引擎与提示词控制台"
          aria-label="打开叙事引擎控制台"
          onClick={onOpenEngine}
        >
          <Cpu size={16} />
        </button>
        <button
          id="open-cardbox"
          type="button"
          className="rail-utility"
          title="角色卡手札库"
          aria-label="打开角色卡库"
          onClick={onOpenCardbox}
        >
          <FolderKanban size={16} />
        </button>
        <button
          id="open-guide"
          type="button"
          className="rail-utility"
          title="冒险手记与地图图例"
          aria-label="打开冒险指南"
          onClick={onOpenGuide}
        >
          <BookOpen size={16} />
          {unreadCount > 0 && <em className="rail-badge">{unreadCount}</em>}
        </button>
        <button
          id="open-settings"
          type="button"
          className="rail-utility"
          title="快速读取本地归档"
          aria-label="读取存档设置"
          onClick={onOpenSettings}
        >
          <Settings2 size={16} />
        </button>
        <span className="rail-edition">巡游手记</span>
      </div>
    </aside>
  );
}

export function Topbar({
  state,
  dirty,
  onSave,
  onNewRandom,
  onOpenNotifications,
  notifCount,
}: {
  state: CircusState;
  dirty: boolean;
  onSave: () => void;
  onNewRandom: () => void;
  onOpenNotifications: () => void;
  notifCount: number;
}) {
  const region = state.world.regions[state.world.currentRegionId];
  const avgDurability = Math.round(
    state.caravan.wagons.reduce((sum, w) => sum + w.durability, 0) / Math.max(1, state.caravan.wagons.length),
  );
  const slotLabel = state.timeSlot === 'dawn' ? '拂晓启程' : state.timeSlot === 'noon' ? '烈日赶路' : state.timeSlot === 'dusk' ? '暮色扎营' : '灯火夜演';

  return (
    <header id="main-topbar" className="topbar">
      <div className="wordmark">
        <strong>{state.caravan.name}<span className="logo-dot">.</span></strong>
        <span>CIRCUS CARAVAN</span>
      </div>

      <div className="scene-time">
        <Sun size={16} strokeWidth={1.7} />
        <div>
          <span className="eyebrow">第 {state.day} 日 · {slotLabel}</span>
          <strong>{region.name}</strong>
        </div>
      </div>

      <div className="top-resources" role="group" aria-label="核心资源速览">
        <div className="resource gold" title={`隐居基金目标 ${state.retirement.targetGold.toLocaleString()} 金币`}>
          <Sparkles size={14} />
          <span>
            <small>金币</small>
            <b>{state.gold.toLocaleString('zh-CN')}<em>/{(state.retirement.targetGold / 1000).toFixed(0)}k</em></b>
          </span>
        </div>
        <div className="resource">
          <Package size={14} />
          <span>
            <small>粮/料</small>
            <b>{state.supplies.rations}<em>/{state.supplies.fodder}</em></b>
          </span>
        </div>
        <div className="resource">
          <Flame size={14} />
          <span>
            <small>灯油</small>
            <b>{state.supplies.fuel}</b>
          </span>
        </div>
        <div className="resource durability">
          <Wrench size={14} />
          <span>
            <small>耐久</small>
            <b>{avgDurability}%</b>
          </span>
        </div>

        <span id="save-status-pill" className={`save-indicator ${dirty ? 'dirty' : ''}`}>
          <i />{dirty ? '未归档' : '已归档'}
        </span>

        <button id="btn-save-game" type="button" className="btn sm" onClick={onSave}>
          <Save size={12} />存档
        </button>
        <button id="btn-new-random" type="button" className="btn sm" title="随机出生大区新开一局" onClick={onNewRandom}>
          <RefreshCw size={12} />随机重开
        </button>
        <button
          id="open-notifications"
          type="button"
          className="icon-btn"
          aria-label="打开风灯告警与通知中心"
          title="风灯告警与通知"
          onClick={onOpenNotifications}
        >
          <Bell size={14} />
          {notifCount > 0 && <span className="notif-dot" />}
        </button>
      </div>
    </header>
  );
}

export function PageHeading({ page, right }: { page: AppPage; right?: ReactNode }) {
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
      {right}
    </div>
  );
}

export function HelmBar({
  state,
  routeDraft,
  onClearRoute,
  onLaunchRoute,
  onOpenGuide,
}: {
  state: CircusState;
  routeDraft: RouteEvaluation | null;
  onClearRoute: () => void;
  onLaunchRoute: () => void;
  onOpenGuide: () => void;
}) {
  const region = state.world.regions[state.world.currentRegionId];
  const map = region.map;
  const poi = state.world.currentPoiId && map ? map.pois[state.world.currentPoiId] : undefined;
  const poiLabel = poi ? (poi.scouted && poi.details ? poi.details.name : poi.placeholderName) : '荒野扎营中';

  return (
    <footer id="bottom-helm-bar" className="helm-bar">
      <div className="helm-status">
        <Shield size={14} style={{ color: '#e6a94e', flexShrink: 0 }} />
        {routeDraft && routeDraft.distanceTiles > 0 ? (
          <span>
            <b>已绘路线 {routeDraft.distanceTiles} 里</b> · 均速 ×{routeDraft.avgSpeedMultiplier} · 预计 {routeDraft.travelDays} 日 ·
            消耗 口粮 {routeDraft.rationsCost} / 灯油 {routeDraft.fuelCost} / 车损 ~{routeDraft.durabilityCost}
            {routeDraft.blocked && <em style={{ color: '#f07c6e', marginLeft: 8, fontStyle: 'normal' }}>（{routeDraft.blockReason}）</em>}
          </span>
        ) : (
          <span>
            当前驻地：<b>{region.name}</b>（{Math.round(state.world.pos.x)}, {Math.round(state.world.pos.y)}）· {poiLabel} · 在区域或跟随地图上按住拖拽即可划线定路
          </span>
        )}
      </div>
      <div className="helm-controls">
        <button id="helm-help-btn" type="button" className="btn sm" onClick={onOpenGuide}>
          <HelpCircle size={12} />测绘指南
        </button>
        {routeDraft && routeDraft.distanceTiles > 0 && (
          <>
            <button id="route-clear-btn" type="button" className="btn sm" onClick={onClearRoute}>
              擦除墨线
            </button>
            <button
              id="route-launch-btn"
              type="button"
              className="btn sm primary"
              disabled={routeDraft.validPoints.length < 2}
              onClick={onLaunchRoute}
            >
              沿线启程
            </button>
          </>
        )}
      </div>
    </footer>
  );
}
