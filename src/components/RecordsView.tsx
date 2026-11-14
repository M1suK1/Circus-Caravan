import { useState } from 'react';
import { Award, Flag, Radio, ScrollText, ShieldAlert, Sparkles } from 'lucide-react';
import { FACTIONS, FACTION_IDS } from '../content/factions.ts';
import { canRetire } from '../domain/caravanMath.ts';
import type { CircusState, GameLog } from '../types.ts';

const LOG_KIND_CN: Record<GameLog['kind'], string> = {
  travel: '行旅与跨区',
  scout: '聚落侦查',
  show: '巡演盛况',
  beast: '奇兽培育',
  crew: '车队整备',
  freight: '货运客运',
  faction: '势力交涉',
  system: '手稿归档',
};

export function RecordsView({
  state,
  onNotify,
}: {
  state: CircusState;
  onNotify: (msg: string, warn?: boolean) => void;
}) {
  const [kindFilter, setKindFilter] = useState<'all' | GameLog['kind']>('all');
  const logs = kindFilter === 'all' ? state.logs : state.logs.filter(l => l.kind === kindFilter);
  const retirePct = Math.min(100, Math.round((state.gold / Math.max(1, state.retirement.targetGold)) * 100));

  return (
    <div className="view-fill" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <section className="paper-note tone-kraft pinned" style={{ flexShrink: 0 }} aria-label="终局隐居筹备进度">
        <div className="card-head" style={{ marginBottom: 5 }}>
          <h2><Award size={15} />世外隐居终局筹备台</h2>
          <span className={`wax-pill ${canRetire(state) ? 'forest' : 'amber'}`}>
            进度 {retirePct}% ({state.gold.toLocaleString()} / {state.retirement.targetGold.toLocaleString()} 金)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'rgba(108, 76, 42, 0.18)', overflow: 'hidden' }}>
            <div style={{ width: `${retirePct}%`, height: '100%', background: 'linear-gradient(90deg, #b87324, #3b684b)', transition: 'width 0.3s ease' }} />
          </div>
          <small style={{ color: 'var(--ink-soft)' }}>
            攒够 {state.retirement.targetGold.toLocaleString()} 金并在非极危区收摊，即可带团员与驯兽远离战乱隐居
          </small>
          <button
            id="retire-ending-preview-btn"
            type="button"
            className="btn sm primary"
            disabled={!canRetire(state)}
            onClick={() => onNotify('终局条件已满足！完整结局结算将在后续接入全团个人尾声叙事。')}
          >
            <Sparkles size={12} />{canRetire(state) ? '宣布收摊 · 共同隐居' : '积累隐居基金中'}
          </button>
        </div>
      </section>

      <div className="two-col-grid view-fill">
        <section className="paper-note tone-ivory" aria-label="行旅编年日志">
          <div className="card-head">
            <h3><ScrollText size={14} />行旅手札编年</h3>
            <select
              id="records-log-filter"
              aria-label="筛选日志分类"
              value={kindFilter}
              onChange={e => setKindFilter(e.target.value as 'all' | GameLog['kind'])}
              style={{ padding: '2px 7px', borderRadius: 4, border: '1px solid var(--umber-strong)', background: 'var(--vellum-bright)', fontSize: 11 }}
            >
              <option value="all">全部手记</option>
              <option value="travel">行军与跨区</option>
              <option value="scout">聚落侦查</option>
              <option value="crew">成员与车厢</option>
              <option value="system">系统归档</option>
            </select>
          </div>
          <div className="poi-list">
            {logs.map(log => (
              <div key={log.id} className="poi-row">
                <div className="poi-row-info">
                  <b>第 {log.day} 日 · {LOG_KIND_CN[log.kind]}</b>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{log.text}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="paper-note tone-sage" aria-label="多方势力外交与残响电台">
          <div className="card-head">
            <h3><Flag size={14} />大陆多方势力态势</h3>
            <small>战火区域请开启熄灯潜行或绕行</small>
          </div>
          <div className="factions-grid">
            {FACTION_IDS.map(id => {
              const meta = FACTIONS[id];
              const st = state.world.factions[id];
              return (
                <div key={id} className="poi-row">
                  <div className="poi-row-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <b>{meta.name}</b>
                      <span className={`wax-pill ${st.hasPass ? 'forest' : 'crimson'}`}>
                        {st.hasPass ? '通行证' : '无证'}
                      </span>
                      {st.atWarWith.length > 0 && (
                        <span className="wax-pill crimson"><ShieldAlert size={10} />交战</span>
                      )}
                    </div>
                    <small>{meta.description}</small>
                  </div>
                  <strong style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: st.standing >= 0 ? 'var(--forest)' : 'var(--crimson)' }}>
                    {st.standing >= 0 ? `+${st.standing}` : st.standing}
                  </strong>
                </div>
              );
            })}
          </div>

          <div className="card-head" style={{ marginTop: 10 }}>
            <h3><Radio size={14} />残响电台与商路传闻</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {state.rumors.map(r => (
              <div key={r.id} className="poi-row">
                <small style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>[第 {r.day} 日] {r.text}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
