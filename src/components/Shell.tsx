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

const NAV_ITEMS: { id: AppPage; label: string; Icon: typeof MapIcon }[] = [
  { id: 'map', label: '地图', Icon: MapIcon },
  { id: 'caravan', label: '马车', Icon: CaravanIcon },
  { id: 'supplies', label: '物资', Icon: Package },
  { id: 'records', label: '记录', Icon: ScrollText },
];

const PAGE_HEADINGS: Record<AppPage, { kicker: string; title: string; subtitle: string; code: string }> = {
  map: {
    kicker: '舆图测绘 · 迷雾寻路',
    title: '风灯所照之处，即是归途。',
    subtitle: '在羊皮纸舆图上亲手划出前路：避开深水、断桥与焦土战线，让微光穿透末世荒野的迷雾。',
    code: 'ATLAS // 128×128 & 10× CARTOGRAPHY',
  },
  caravan: {
    kicker: '车队整备 · 演员花名册',
    title: '破篷车里，载着最后一场欢笑。',
    subtitle: '修缮与扩建五节车厢，照料随行艺人；每一张外部角色卡都可登上舞台或留驻远方城镇。',
    code: 'CARAVAN // WAGONS & TROUPE',
  },
  supplies: {
    kicker: '行囊辎重 · 奇兽笼舍',
    title: '算准口粮、兽料与下一站的希望。',
    subtitle: '平衡货舱载重、客座与重型兽笼，决定将驯养进阶的奇幻生物留作压轴，或送上拍卖行换取路费。',
    code: 'LOGISTICS // SUPPLIES & MENAGERIE',
  },
  records: {
    kicker: '行旅编年 · 势力格局',
    title: '记下每一道车辙与每一场掌声。',
    subtitle: '关注大陆多方势力的战火推移与残响电台传闻，向着带全团隐居世外净土的目标稳步迈进。',
    code: 'CHRONICLE // FACTIONS & RETIREMENT',
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
        title="返回羊皮纸舆图"
        aria-label="残响大篷车，返回地图"
        onClick={() => onPage('map')}
      >
        <span className="brand-crest">
          <Compass size={22} strokeWidth={1.8} />
        </span>
      </button>
      <div className="rail-rule" />
      <nav aria-label="核心模块切换">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`nav-${id}`}
            type="button"
            aria-current={page === id ? 'page' : undefined}
            className={`nav-item ${page === id ? 'active' : ''}`}
            onClick={() => onPage(id)}
          >
            <Icon size={20} strokeWidth={1.7} />
            <span>{label}</span>
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
          <Cpu size={18} />
        </button>
        <button
          id="open-cardbox"
          type="button"
          className="rail-utility"
          title="角色卡手札库"
          aria-label="打开角色卡库"
          onClick={onOpenCardbox}
        >
          <FolderKanban size={18} />
        </button>
        <button
          id="open-guide"
          type="button"
          className="rail-utility"
          title="冒险手记与地图图例"
          aria-label="打开冒险指南"
          onClick={onOpenGuide}
        >
          <BookOpen size={18} />
          {unreadCount > 0 && <em className="rail-badge">{unreadCount}</em>}
        </button>
        <button
          id="open-settings"
          type="button"
          className="rail-utility"
          title="系统与存档设置"
          aria-label="打开设置"
          onClick={onOpenSettings}
        >
          <Settings2 size={18} />
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
        <span>CIRCUS CARAVAN · PARCHMENT ATLAS</span>
      </div>

      <div className="scene-time">
        <Sun size={20} strokeWidth={1.6} />
        <div>
          <span className="eyebrow">第 {state.day} 日 · {slotLabel}</span>
          <strong>{region.name}</strong>
        </div>
      </div>

      <div className="top-resources" role="group" aria-label="核心资源速览">
        <div className="resource gold" title={`隐居基金目标 ${state.retirement.targetGold.toLocaleString()} 金币`}>
          <Sparkles size={16} />
          <span>
            <small>巡游金币</small>
            <b>{state.gold.toLocaleString('zh-CN')}<em>/ {(state.retirement.targetGold / 1000).toFixed(0)}k</em></b>
          </span>
        </div>
        <div className="resource">
          <Package size={16} />
          <span>
            <small>口粮 / 兽料</small>
            <b>{state.supplies.rations}<em>/ {state.supplies.fodder}</em></b>
          </span>
        </div>
        <div className="resource">
          <Flame size={16} />
          <span>
            <small>魔导灯油</small>
            <b>{state.supplies.fuel}</b>
          </span>
        </div>
        <div className="resource durability">
          <Wrench size={16} />
          <span>
            <small>车队平均耐久</small>
            <b>{avgDurability}%</b>
          </span>
        </div>

        <span id="save-status-pill" className={`save-indicator ${dirty ? 'dirty' : ''}`}>
          <i />{dirty ? '有未落盘改动' : '手稿已归档'}
        </span>

        <button id="btn-save-game" type="button" className="btn sm" onClick={onSave}>
          <Save size={13} />存档
        </button>
        <button id="btn-new-random" type="button" className="btn sm ghost" title="随机出生大区新开一局" onClick={onNewRandom}>
          <RefreshCw size={13} />随机重开
        </button>
        <button
          id="open-notifications"
          type="button"
          className="icon-btn"
          aria-label="打开风灯告警与通知中心"
          title="风灯告警与通知"
          onClick={onOpenNotifications}
        >
          <Bell size={16} />
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
      <div>
        <div className="breadcrumb">
          <Compass size={12} />
          <span>残响大篷车</span>
          <ChevronRight size={12} />
          <b>{meta.kicker}</b>
          <em className="heading-code">{meta.code}</em>
        </div>
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
        <Shield size={15} style={{ color: 'var(--amber)' }} />
        {routeDraft && routeDraft.distanceTiles > 0 ? (
          <span>
            <b>已绘路线 {routeDraft.distanceTiles} 里</b> · 均速 ×{routeDraft.avgSpeedMultiplier} · 预计 {routeDraft.travelDays} 日 ·
            消耗 口粮 {routeDraft.rationsCost} / 灯油 {routeDraft.fuelCost} / 车损 ~{routeDraft.durabilityCost}
            {routeDraft.blocked && <em style={{ color: 'var(--crimson)', marginLeft: 8, fontStyle: 'normal' }}>（{routeDraft.blockReason}）</em>}
          </span>
        ) : (
          <span>
            当前位置：<b>{region.name}</b>（{Math.round(state.world.pos.x)}, {Math.round(state.world.pos.y)}）· {poiLabel} · 在区域或跟随地图上按住拖拽即可划线定路
          </span>
        )}
      </div>
      <div className="helm-controls">
        <button id="helm-help-btn" type="button" className="btn sm ghost" onClick={onOpenGuide}>
          <HelpCircle size={13} />测绘指南
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
