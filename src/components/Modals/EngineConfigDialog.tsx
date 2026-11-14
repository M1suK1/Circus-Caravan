import { useState } from 'react';
import { BookOpen, Cpu, FileCode2, KeyRound, Sparkles, X } from 'lucide-react';
import {
  filterWorldbookEntries,
  WORLDBOOK_CATEGORY_LABELS,
  WORLDBOOK_ENTRIES,
  type WorldbookCategory,
} from '../../content/worldbook.ts';

export function EngineConfigDialog({
  onClose,
  onNotify,
}: {
  onClose: () => void;
  onNotify: (msg: string) => void;
}) {
  const [tab, setTab] = useState<'api' | 'prompts' | 'worldbook'>('worldbook');
  const [provider, setProvider] = useState<'openai' | 'vertex'>('vertex');
  const [model, setModel] = useState('gemini-2.5-pro');
  const [thinking, setThinking] = useState(true);
  const [wbCat, setWbCat] = useState<WorldbookCategory | 'all'>('all');
  const [enabledIds, setEnabledIds] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WORLDBOOK_ENTRIES.map(e => [e.id, e.defaultEnabled])),
  );
  const [scoutPrompt, setScoutPrompt] = useState(
    '你正在为末世奇幻马戏团生成前方城邦/村落的侦查简报。请严格依据【所属大区基调】、【周围十倍小地图地形】与【世界书激活词条】，写出地名、民众在破败中挣扎求生的日常细节、观众偏好的演出与商路隐患。',
  );

  const visibleEntries = filterWorldbookEntries(wbCat);
  const activeCount = WORLDBOOK_ENTRIES.filter(e => enabledIds[e.id]).length;

  return (
    <div id="engine-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="engine-modal-title">
      <div className="modal-scroll wide vellum-sheet">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">LLM NARRATIVE CONSOLE & WORLDBOOK · 叙事引擎与世界书总览</span>
            <h2 id="engine-modal-title">LLM 接入与末世世界书配置中心</h2>
          </div>
          <button id="engine-modal-close" type="button" className="icon-btn" aria-label="关闭叙事引擎控制台" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="silk-tab-row" style={{ marginBottom: 14 }} role="tablist">
          <button id="engine-tab-worldbook" type="button" role="tab" aria-selected={tab === 'worldbook'} className={`silk-tab tone-amber ${tab === 'worldbook' ? 'active' : ''}`} onClick={() => setTab('worldbook')}>
            <BookOpen size={13} /><span>末世世界书条目 ({activeCount}/{WORLDBOOK_ENTRIES.length})</span>
          </button>
          <button id="engine-tab-api" type="button" role="tab" aria-selected={tab === 'api'} className={`silk-tab tone-indigo ${tab === 'api' ? 'active' : ''}`} onClick={() => setTab('api')}>
            <KeyRound size={13} /><span>模型网关与思维链</span>
          </button>
          <button id="engine-tab-prompts" type="button" role="tab" aria-selected={tab === 'prompts'} className={`silk-tab ${tab === 'prompts' ? 'active' : ''}`} onClick={() => setTab('prompts')}>
            <FileCode2 size={13} /><span>四大作用域预设</span>
          </button>
        </div>

        {tab === 'worldbook' && (
          <div className="paper-note tone-ivory pinned" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <button
                  id="wb-filter-all"
                  type="button"
                  className={`btn sm ${wbCat === 'all' ? 'primary' : 'ghost'}`}
                  onClick={() => setWbCat('all')}
                >
                  全部 ({WORLDBOOK_ENTRIES.length})
                </button>
                {(Object.keys(WORLDBOOK_CATEGORY_LABELS) as WorldbookCategory[]).map(cat => (
                  <button
                    key={cat}
                    id={`wb-filter-${cat}`}
                    type="button"
                    className={`btn sm ${wbCat === cat ? 'primary' : 'ghost'}`}
                    onClick={() => setWbCat(cat)}
                  >
                    {WORLDBOOK_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
              <button
                id="engine-save-wb-btn"
                type="button"
                className="btn sm primary"
                onClick={() => onNotify(`已保存世界书激活状态（当前启用 ${activeCount} 条设定词条）。`)}
              >
                保存词条状态
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 370, overflowY: 'auto', paddingRight: 4 }}>
              {visibleEntries.map(entry => {
                const enabled = Boolean(enabledIds[entry.id]);
                return (
                  <article key={entry.id} className="poi-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '10px 12px', opacity: enabled ? 1 : 0.62 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <b style={{ fontFamily: 'var(--font-display)', fontSize: 13.5 }}>{entry.title}</b>
                        <span className="wax-pill amber">{WORLDBOOK_CATEGORY_LABELS[entry.category]}</span>
                        <span className="wax-pill">优先级 {entry.priority}</span>
                      </div>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer' }}>
                        <input
                          id={`wb-toggle-${entry.id}`}
                          type="checkbox"
                          checked={enabled}
                          onChange={e => setEnabledIds(prev => ({ ...prev, [entry.id]: e.target.checked }))}
                        />
                        <span>{enabled ? '已注入' : '已停用'}</span>
                      </label>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.65 }}>{entry.content}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {entry.keywords.map(kw => (
                        <span key={kw} className="wax-pill" style={{ fontSize: 10 }}>{kw}</span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'api' && (
          <div className="paper-note tone-ivory pinned" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button id="provider-vertex" type="button" className={`btn sm ${provider === 'vertex' ? 'primary' : ''}`} onClick={() => setProvider('vertex')}>
                <Cpu size={13} />Vertex AI（含思维链阶梯）
              </button>
              <button id="provider-openai" type="button" className={`btn sm ${provider === 'openai' ? 'primary' : ''}`} onClick={() => setProvider('openai')}>
                OpenAI 兼容接口
              </button>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span>默认模型标识</span>
              <input
                id="engine-model-input"
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--umber-strong)', background: '#fffaf0', fontFamily: 'var(--font-data)' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <input id="engine-thinking-toggle" type="checkbox" checked={thinking} onChange={e => setThinking(e.target.checked)} />
              <span>启用思维链推演（`includeThoughts` / `thinkingLevel` 自适应）</span>
            </label>
            <button
              id="engine-save-proto-btn"
              type="button"
              className="btn primary"
              onClick={() => onNotify('前端原型提示：模型配置外观已保存（当前阶段不连接真实后端请求）。')}
            >
              <Sparkles size={13} />保存引擎原型配置
            </button>
          </div>
        )}

        {tab === 'prompts' && (
          <div className="paper-note tone-kraft" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <small style={{ color: 'var(--ink-muted)' }}>作用范围：聚落侦查（`scout`）· 篝火夜谈（`campfire`）· 故事蓝图灾厄推演（`blueprint`）· 隐居终局（`ending`）</small>
            <textarea
              id="engine-prompt-editor"
              rows={6}
              value={scoutPrompt}
              onChange={e => setScoutPrompt(e.target.value)}
              style={{ padding: 10, borderRadius: 6, border: '1px solid var(--umber-strong)', background: '#fffaf0', lineHeight: 1.6 }}
            />
            <button id="engine-save-prompt-btn" type="button" className="btn primary" onClick={() => onNotify('已暂存前端提示词模板预览。')}>
              保存提示词草稿
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
