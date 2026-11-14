import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpenCheck, Coins, Flame, Package, Radio, Sunrise, Wrench, X } from 'lucide-react';
import type { DayLedger } from '../../types.ts';

export function DayLedgerDialog({
  ledger,
  nextDay,
  onClose,
}: {
  ledger: DayLedger;
  nextDay: number;
  onClose: () => void;
}) {
  const [displayGold, setDisplayGold] = useState(ledger.startingGold);

  useEffect(() => {
    const start = ledger.startingGold;
    const end = ledger.endingGold;
    if (start === end || typeof window === 'undefined') {
      setDisplayGold(end);
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplayGold(end);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const duration = 520;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayGold(Math.round(start + (end - start) * eased));
      if (p < 1) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [ledger.day, ledger.startingGold, ledger.endingGold]);

  const netDelta = ledger.endingGold - ledger.startingGold;

  return (
    <div id="day-ledger-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="day-ledger-title">
      <div id="day-ledger-modal" className="modal-scroll wide vellum-sheet ledger-sheet">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">CARAVAN NIGHT LEDGER · 第 {String(ledger.day).padStart(3, '0')} 日结账册</span>
            <h2 id="day-ledger-title">风灯日结收支与生存稽核簿</h2>
          </div>
          <button id="day-ledger-close-btn" type="button" className="icon-btn" aria-label="关闭日结账册" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="ledger-kpi-row">
          <div className="ledger-kpi-card">
            <small><Coins size={12} />结余巡游金</small>
            <strong>{displayGold.toLocaleString('zh-CN')} 金</strong>
            <span className={netDelta >= 0 ? 'pos' : 'neg'}>
              期初 {ledger.startingGold.toLocaleString('zh-CN')} · 日薪实付 -{ledger.wagesPaid}
            </span>
          </div>
          <div className="ledger-kpi-card">
            <small><Package size={12} />口粮消耗</small>
            <strong className={ledger.rationsShortage > 0 ? 'neg' : ''}>-{ledger.rationsUsed} 份</strong>
            <span>需求 {ledger.rationsNeeded} 份{ledger.rationsShortage > 0 ? ` · 缺 ${ledger.rationsShortage}` : ' · 足额'}</span>
          </div>
          <div className="ledger-kpi-card">
            <small><Flame size={12} />兽料消耗</small>
            <strong className={ledger.fodderShortage > 0 ? 'neg' : ''}>-{ledger.fodderUsed} 份</strong>
            <span>需求 {ledger.fodderNeeded} 份{ledger.fodderShortage > 0 ? ` · 缺 ${ledger.fodderShortage}` : ' · 足额'}</span>
          </div>
          <div className="ledger-kpi-card">
            <small><Wrench size={12} />平均车况</small>
            <strong>{ledger.avgDurabilityAfter}%</strong>
            <span>结算前 {ledger.avgDurabilityBefore}% · 衰败 {ledger.worldDecay}</span>
          </div>
        </div>

        {ledger.warnings.length > 0 && (
          <div className="ledger-warnings" role="alert">
            <div className="ledger-warn-head">
              <AlertTriangle size={14} />
              <b>生存危急警示（{ledger.warnings.length} 项）</b>
            </div>
            <ul>
              {ledger.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="paper-note tone-ivory ledger-lines-box" aria-label="逐项流水明细">
          <div className="card-head">
            <h3><BookOpenCheck size={14} />逐项账目明细</h3>
            <small>今日舞台票房累计 +{ledger.incomeTotal} 金</small>
          </div>
          <div className="ledger-lines">
            {ledger.lines.map((line, i) => (
              <div
                key={`${line.label}-${i}`}
                className={`ledger-line-row tone-${line.tone ?? 'default'}`}
                style={{ animationDelay: `${i * 55}ms` }}
              >
                <div className="ledger-line-main">
                  <b>{line.label}</b>
                  <small>{line.detail}</small>
                </div>
                <strong className="ledger-line-amount">{line.amountText}</strong>
              </div>
            ))}
          </div>
        </section>

        {ledger.newRumors.length > 0 && (
          <section className="paper-note tone-sage" style={{ marginTop: 10 }} aria-label="今夜残响电台风闻">
            <div className="card-head" style={{ marginBottom: 4 }}>
              <h3><Radio size={14} />今夜残响电台传回的新风闻</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {ledger.newRumors.map((r, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{r}</p>
              ))}
            </div>
          </section>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button id="day-ledger-continue-btn" type="button" className="btn primary" onClick={onClose}>
            <Sunrise size={14} />迎来第 {nextDay} 日拂晓
          </button>
        </div>
      </div>
    </div>
  );
}
