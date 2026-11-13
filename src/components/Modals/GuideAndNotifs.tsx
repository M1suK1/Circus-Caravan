import { Bell, BookOpen, Compass, MapPin, ShieldAlert, X } from 'lucide-react';
import type { GameLog } from '../../types.ts';

export function GuideDialog({ onClose }: { onClose: () => void }) {
  return (
    <div id="guide-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="guide-modal-title">
      <div className="modal-scroll vellum-sheet">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">EXPEDITION HANDBOOK · 巡游测绘手记</span>
            <h2 id="guide-modal-title">羊皮纸地图与行动规则说明</h2>
          </div>
          <button id="guide-modal-close" type="button" className="icon-btn" aria-label="关闭指南" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
          <div className="paper-note tone-ivory pinned">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Compass size={15} style={{ color: 'var(--crimson)' }} />三级地图与按需懒加载
            </h3>
            <p style={{ color: 'var(--ink-soft)' }}>
              世界全图（128×128）生成中央大陆、海洋岛屿、9 个不规则大区与大河湖泊；切入「区域地图」时按 10× 放大当前大区并保留河湖位置与多格城市。未跨过边境关口前，其余大区不会提前生成。
            </p>
          </div>

          <div className="paper-note tone-kraft">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <MapPin size={15} style={{ color: 'var(--amber)' }} />手动划线与迷雾视野
            </h3>
            <p style={{ color: 'var(--ink-soft)' }}>
              取消传统点格子走法：在「区域地图」或「跟随马车」视图上按住鼠标/手指拖出墨水路线，系统会自动采样沿线地形并估算天数、口粮、灯油与车轮磨损。只有现在周围与曾经走过的地方才会揭开迷雾；若划线冲入海洋、无桥深河或悬崖，线段会自动红线截断提示。
            </p>
          </div>

          <div className="paper-note tone-sage">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <BookOpen size={15} style={{ color: 'var(--forest)' }} />先定位、侦查后由 LLM 详述
            </h3>
            <p style={{ color: 'var(--ink-soft)' }}>
              城市（多格占地）与村庄生成时只有坐标和轮廓。靠近平日未探明聚落并点击「侦查」，即可通过叙事引擎现场生成它的名字、困境、偏好节目与商路线索。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const NOTIF_KIND_CN: Record<GameLog['kind'], string> = {
  travel: '行旅',
  scout: '侦查',
  show: '演出',
  beast: '奇兽',
  crew: '车队',
  freight: '货运',
  faction: '势力',
  system: '归档',
};

export function NotificationsDrawer({
  logs,
  onClose,
}: {
  logs: GameLog[];
  onClose: () => void;
}) {
  return (
    <div id="notif-drawer-backdrop" className="drawer-backdrop" role="dialog" aria-modal="true" aria-label="风灯告警与通知中心">
      <div className="notif-drawer">
        <div className="modal-head" style={{ marginBottom: 4 }}>
          <div>
            <span className="modal-eyebrow">LANTERN DISPATCH · 内部告警与见闻</span>
            <h2 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={16} style={{ color: 'var(--crimson)' }} />通知与日志摘要
            </h2>
          </div>
          <button id="notif-drawer-close" type="button" className="icon-btn" aria-label="关闭通知抽屉" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {logs.slice(0, 12).map(log => (
          <div key={log.id} className="poi-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <span className="wax-pill amber">
              <ShieldAlert size={10} />第 {log.day} 日 · {NOTIF_KIND_CN[log.kind]}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink)' }}>{log.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
