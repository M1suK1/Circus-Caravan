import { useEffect, useState } from 'react';
import { Award, CheckCircle2, Compass, Home, Mountain, PawPrint, RotateCcw, Sparkles, Users, X } from 'lucide-react';
import { REGION_CATALOG } from '../../content/regions.ts';
import { canRetire } from '../../domain/caravanMath.ts';
import { computeRetireTier } from '../../rules/endingOps.ts';
import type { CircusState } from '../../types.ts';

const TIER_LABEL: Record<'modest' | 'prosperous' | 'legendary', string> = {
  modest: '安身小筑（朴素归隐）',
  prosperous: '余烬丰年（富足归隐）',
  legendary: '风灯传奇（传世净土）',
};

export function RetirementDialog({
  state,
  onRetire,
  onNewGame,
  onClose,
}: {
  state: CircusState;
  onRetire: (haven: 'quiet_farm' | 'hidden_valley') => void;
  onNewGame: () => void;
  onClose?: () => void;
}) {
  const [haven, setHaven] = useState<'quiet_farm' | 'hidden_valley'>(state.retirement.chosenHaven ?? 'hidden_valley');
  const ending = state.retirement.ending;
  const fullText = ending?.narrative ?? '';
  const [shownLen, setShownLen] = useState(0);

  useEffect(() => {
    if (!ending || !fullText) return;
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShownLen(fullText.length);
      return;
    }
    setShownLen(0);
    const timer = window.setInterval(() => {
      setShownLen(prev => {
        if (prev >= fullText.length) {
          window.clearInterval(timer);
          return fullText.length;
        }
        return prev + 3;
      });
    }, 24);
    return () => window.clearInterval(timer);
  }, [ending?.achievedDay, fullText]);

  if (state.phase === 'retired' && ending) {
    return (
      <div id="ending-scroll-backdrop" className="ending-scroll-backdrop" role="dialog" aria-modal="true" aria-labelledby="ending-scroll-title">
        <article id="ending-scroll" className="vellum-sheet ending-scroll-sheet">
          <div className="modal-head">
            <div>
              <span className="modal-eyebrow">CIRCUS CARAVAN EPILOGUE · 第 {ending.achievedDay} 日终局隐居卷轴</span>
              <h2 id="ending-scroll-title">{TIER_LABEL[ending.tier]}</h2>
            </div>
            <span className="wax-pill forest">
              <Award size={13} />{state.retirement.chosenHaven === 'hidden_valley' ? '隐世山谷' : '静谧农庄'}
            </span>
          </div>

          <section className="paper-note tone-ivory pinned ending-narrative-box" aria-label="归隐序章">
            <p>{fullText.slice(0, shownLen)}{shownLen < fullText.length ? '｜' : ''}</p>
          </section>

          <div className="two-col-grid" style={{ marginTop: 12 }}>
            <section className="paper-note tone-kraft" aria-label="同行艺人尾声">
              <div className="card-head">
                <h3><Users size={14} />同行剧团伙伴 ({ending.accompanyingPerformers.length})</h3>
              </div>
              <div className="ending-epilogue-list">
                {ending.accompanyingPerformers.map(p => (
                  <article key={p.id} className="poi-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <b>{p.name}</b>
                    <small style={{ lineHeight: 1.65 }}>{p.epilogue}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="paper-note tone-sage" aria-label="随行奇兽与魔物娘尾声">
              <div className="card-head">
                <h3><PawPrint size={14} />随行奇幻同伴 ({ending.accompanyingBeasts.length})</h3>
              </div>
              <div className="ending-epilogue-list">
                {ending.accompanyingBeasts.length > 0 ? ending.accompanyingBeasts.map(b => (
                  <article key={b.id} className="poi-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <b>{b.name}</b>
                    <small style={{ lineHeight: 1.65 }}>{b.epilogue}</small>
                  </article>
                )) : (
                  <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>本次旅途未带兽笼同伴同行，车厢里只留下一串旧风灯与演出木箱。</p>
                )}
              </div>
            </section>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <small style={{ color: 'var(--ink-muted)' }}>
              终局留存：巡游金 {state.gold.toLocaleString('zh-CN')} · 大陆声望 {state.caravan.fame} · 图鉴发现 {state.encounteredSpeciesIds.length} 种
            </small>
            <button id="ending-newgame-btn" type="button" className="btn primary" onClick={onNewGame}>
              <RotateCcw size={14} />开始新的巡游
            </button>
          </div>
        </article>
      </div>
    );
  }

  const ready = canRetire(state);
  const region = state.world.regions[state.world.currentRegionId];
  const expectedTier = computeRetireTier(state);

  return (
    <div id="retirement-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="retirement-modal-title">
      <div id="retirement-modal" className="modal-scroll wide vellum-sheet">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">SANCTUARY RETIREMENT · 世外隐居抉择</span>
            <h2 id="retirement-modal-title">带着风灯与同伴收摊归隐</h2>
          </div>
          {onClose && (
            <button id="retirement-modal-close" type="button" className="icon-btn" aria-label="关闭隐居抉择窗" onClick={onClose}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="ledger-kpi-row" style={{ marginBottom: 12 }}>
          <div className="ledger-kpi-card">
            <small>隐居基金门槛</small>
            <strong className={state.gold >= state.retirement.targetGold ? 'pos' : 'neg'}>
              {state.gold.toLocaleString('zh-CN')} / {state.retirement.targetGold.toLocaleString('zh-CN')}
            </strong>
          </div>
          <div className="ledger-kpi-card">
            <small>所在地区安全性</small>
            <strong className={region.dangerTier < 5 ? 'pos' : 'neg'}>
              {REGION_CATALOG[region.id].name} · LV.{region.dangerTier}
            </strong>
          </div>
          <div className="ledger-kpi-card">
            <small>车队士气与预期评价</small>
            <strong>{TIER_LABEL[expectedTier]}</strong>
          </div>
        </div>

        <div className="haven-card-grid">
          <button
            id="haven-choice-quiet_farm"
            type="button"
            className={`haven-card ${haven === 'quiet_farm' ? 'active' : ''}`}
            onClick={() => setHaven('quiet_farm')}
          >
            <div className="haven-card-head">
              <Home size={18} />
              <b>静谧向阳农庄</b>
            </div>
            <p>远离帝国税卡与主干道的旧日牧场，有风车谷仓与温暖烤炉，最适合卸下戏服与兽笼安度余生。</p>
          </button>

          <button
            id="haven-choice-hidden_valley"
            type="button"
            className={`haven-card ${haven === 'hidden_valley' ? 'active' : ''}`}
            onClick={() => setHaven('hidden_valley')}
          >
            <div className="haven-card-head">
              <Mountain size={18} />
              <b>隐世山谷木屋</b>
            </div>
            <p>被省界山脊与微光泉眼护佑的世外桃源，可搭起常驻小木剧场，让随行魔物娘与奇兽自由奔跑。</p>
          </button>
        </div>

        <div className="paper-note tone-kraft" style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            <Compass size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            同行名单：{state.performers.map(p => p.name).join('、')}
            {state.beasts.length > 0 ? ` 以及 ${state.beasts.map(b => b.nickname).join('、')}` : ''}
          </div>
          <button
            id="retire-confirm-btn"
            type="button"
            className="btn primary"
            disabled={!ready}
            onClick={() => onRetire(haven)}
          >
            {ready ? <><CheckCircle2 size={14} />确认收摊归隐</> : <><Sparkles size={14} />尚不满足隐居条件</>}
          </button>
        </div>
      </div>
    </div>
  );
}
