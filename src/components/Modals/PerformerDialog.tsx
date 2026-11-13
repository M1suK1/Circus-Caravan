import { useMemo, useState } from 'react';
import { Clapperboard, MessageCircle, Send, Sparkles, User, X } from 'lucide-react';
import { CIRCUS_ROLE_LABELS } from '../../domain/cardAdapter.ts';
import { EXPRESSIONS, EXPRESSION_META } from '../../engine/expressions.ts';
import { VnReader } from '../../engine/vn/VnReader.tsx';
import type { VnBeat } from '../../engine/vn/types.ts';
import type { Expression, Performer } from '../../types.ts';
import { GirlPortrait } from '../GirlPortrait.tsx';

export function PerformerDialog({
  performer,
  regionName,
  onClose,
  onChangeExpression,
}: {
  performer: Performer;
  regionName: string;
  onClose: () => void;
  onChangeExpression: (performerId: string, exp: Expression) => void;
}) {
  const [tab, setTab] = useState<'dialogue' | 'vn'>('dialogue');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<{ role: 'player' | 'npc'; text: string }[]>([
    {
      role: 'npc',
      text: performer.quote ?? `外面的风沙又大起来了，不过只要风灯还在，${regionName}的观众就不会白等一场戏。`,
    },
  ]);

  const sendLine = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const reply = `（她拨了拨衣领上的铜扣，神情转向${EXPRESSION_META[performer.expression].label}）“${clean}……放心吧，${performer.goal}”`;
    setMessages(prev => [...prev, { role: 'player', text: clean }, { role: 'npc', text: reply }]);
    setDraft('');
  };

  const vnBeats: VnBeat[] = useMemo(() => [
    { kind: 'bg', backdrop: { id: 'camp_fire' } },
    { kind: 'scene', title: `${regionName} · 篝火夜谈` },
    { kind: 'say', speakerId: 'narrator', name: '旁白', text: `暮色落进大篷车营地，铜灯盏在风里轻晃。${performer.name}坐在篷布舞台阶梯边擦拭道具。`, segment: 0 },
    { kind: 'say', speakerId: performer.id, name: performer.name, text: messages[messages.length - 1]?.text ?? '今晚的观众肯定会记住那道火焰弧线。', expression: performer.expression, segment: 0 },
    { kind: 'end' },
  ], [performer, regionName, messages]);

  return (
    <div id="performer-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="performer-modal-title">
      <div className="modal-scroll wide">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">TROUPE DOSSIER & LLM CAMPFIRE · 成员档案与夜谈原型</span>
            <h2 id="performer-modal-title">{performer.name} · {CIRCUS_ROLE_LABELS[performer.role]}</h2>
          </div>
          <button id="performer-modal-close" type="button" className="icon-btn" aria-label="关闭成员档案" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="two-col-grid">
          <div className="parchment-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 120, height: 156, borderRadius: 8, overflow: 'hidden', background: '#171219', border: '1px solid var(--umber-strong)', flexShrink: 0 }}>
                <GirlPortrait girl={performer} variant="full" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <span className="wax-pill amber">{performer.title} · Lv.{performer.level}</span>
                <p style={{ color: 'var(--ink-soft)' }}>{performer.personality}</p>
                <small style={{ color: 'var(--ink-muted)' }}>心愿：{performer.goal}</small>
                <div className="stat-grid-2" style={{ marginTop: 4 }}>
                  <div className="metric-box"><small>魔术 / 洞察</small><b>{performer.stats.magic} / {performer.stats.insight}</b></div>
                  <div className="metric-box"><small>敏捷 / 亲和</small><b>{performer.stats.agility} / {performer.stats.empathy}</b></div>
                </div>
              </div>
            </div>

            <div>
              <small style={{ color: 'var(--ink-muted)', display: 'block', marginBottom: 6 }}>立绘表情差分切换（兼容 6 种表情）：</small>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EXPRESSIONS.map(exp => (
                  <button
                    key={exp}
                    id={`perf-exp-${exp}`}
                    type="button"
                    className={`btn sm ${performer.expression === exp ? 'primary' : ''}`}
                    onClick={() => onChangeExpression(performer.id, exp)}
                  >
                    {EXPRESSION_META[exp].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="parchment-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                id="perf-tab-dialogue"
                type="button"
                className={`btn sm ${tab === 'dialogue' ? 'primary' : ''}`}
                onClick={() => setTab('dialogue')}
              >
                <MessageCircle size={13} />LLM 篝火夜谈窗
              </button>
              <button
                id="perf-tab-vn"
                type="button"
                className={`btn sm ${tab === 'vn' ? 'primary' : ''}`}
                onClick={() => setTab('vn')}
              >
                <Clapperboard size={13} />VN 舞台预览
              </button>
            </div>

            {tab === 'dialogue' ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', padding: 8, background: 'rgba(255,251,242,0.7)', borderRadius: 6, border: '1px solid var(--umber-line)' }}>
                  {messages.map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
                      <span className={`wax-pill ${m.role === 'player' ? 'amber' : 'crimson'}`}>
                        {m.role === 'player' ? <><User size={10} />团长</> : <><Sparkles size={10} />{performer.name}</>}
                      </span>
                      <span style={{ lineHeight: 1.6 }}>{m.text}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['今晚的路线稳妥吗？', '大家士气怎么样？', '再跟我说说隐居山谷的事'].map((q, idx) => (
                    <button key={idx} id={`perf-quick-${idx}`} type="button" className="btn sm ghost" onClick={() => sendLine(q)}>
                      {q}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={e => { e.preventDefault(); sendLine(draft); }}
                  style={{ display: 'flex', gap: 8 }}
                >
                  <input
                    id="perf-chat-input"
                    type="text"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder={`对${performer.name}说点什么（前端对话原型）…`}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--umber-strong)', background: '#fffaf0' }}
                  />
                  <button id="perf-chat-send" type="submit" className="btn primary">
                    <Send size={13} />发送
                  </button>
                </form>
              </>
            ) : (
              <div style={{ minHeight: 280, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--umber-strong)' }}>
                <VnReader
                  beats={vnBeats}
                  cast={[{ id: performer.id, name: performer.name, girl: performer }]}
                  title={`${performer.name} · 营地短幕`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
