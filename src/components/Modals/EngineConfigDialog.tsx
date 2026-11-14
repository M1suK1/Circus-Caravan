import { useEffect, useState } from 'react';
import { BookOpen, Cpu, FileCode2, KeyRound, ShieldCheck, Sparkles, WifiOff, X } from 'lucide-react';
import {
  NARRATIVE_SCOPE_LABELS,
  type NarrativeScope,
} from '../../content/promptTemplates.ts';
import {
  filterWorldbookEntries,
  WORLDBOOK_CATEGORY_LABELS,
  WORLDBOOK_ENTRIES,
  type WorldbookCategory,
} from '../../content/worldbook.ts';
import {
  defaultLlmSettings,
  getCachedLlmSecret,
  type LlmSettings,
  loadLlmSettings,
  saveLlmSettings,
} from '../../engine/llmService.ts';

const SCOPES = Object.keys(NARRATIVE_SCOPE_LABELS) as NarrativeScope[];

export function EngineConfigDialog({
  onClose,
  onNotify,
}: {
  onClose: () => void;
  onNotify: (msg: string) => void;
}) {
  const [tab, setTab] = useState<'api' | 'prompts' | 'worldbook'>('worldbook');
  const [wbCat, setWbCat] = useState<WorldbookCategory | 'all'>('all');
  const [settings, setSettings] = useState<LlmSettings>(() => defaultLlmSettings());
  const [secretInput, setSecretInput] = useState<string>(() => getCachedLlmSecret());
  const [activeScope, setActiveScope] = useState<NarrativeScope>('scout');

  useEffect(() => {
    void loadLlmSettings().then(({ settings: loaded }) => {
      setSettings(loaded);
      setSecretInput(getCachedLlmSecret());
    });
  }, []);

  const visibleEntries = filterWorldbookEntries(wbCat);
  const activeCount = WORLDBOOK_ENTRIES.filter(e => settings.enabledWorldbookIds[e.id]).length;

  const commitSettings = async (msg: string) => {
    await saveLlmSettings(settings, secretInput);
    onNotify(msg);
  };

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
            <KeyRound size={13} /><span>模型网关与模式 ({settings.mode === 'llm' ? '实时 LLM' : '离线演剧'})</span>
          </button>
          <button id="engine-tab-prompts" type="button" role="tab" aria-selected={tab === 'prompts'} className={`silk-tab ${tab === 'prompts' ? 'active' : ''}`} onClick={() => setTab('prompts')}>
            <FileCode2 size={13} /><span>六大作用域预设</span>
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
                onClick={() => void commitSettings(`已保存世界书按需注入配置（当前启用 ${activeCount} 条词条）。`)}
              >
                保存词条状态
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 370, overflowY: 'auto', paddingRight: 4 }}>
              {visibleEntries.map(entry => {
                const enabled = Boolean(settings.enabledWorldbookIds[entry.id]);
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
                          onChange={e => setSettings(prev => ({
                            ...prev,
                            enabledWorldbookIds: { ...prev.enabledWorldbookIds, [entry.id]: e.target.checked },
                          }))}
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
          <div className="paper-note tone-ivory pinned" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                id="engine-mode-offline"
                type="button"
                className={`btn sm ${settings.mode === 'offline' ? 'primary' : ''}`}
                onClick={() => setSettings(prev => ({ ...prev, mode: 'offline' }))}
              >
                <WifiOff size={13} />离线本地演剧模式（零门槛兜底）
              </button>
              <button
                id="engine-mode-llm"
                type="button"
                className={`btn sm ${settings.mode === 'llm' ? 'primary' : ''}`}
                onClick={() => setSettings(prev => ({ ...prev, mode: 'llm' }))}
              >
                <Sparkles size={13} />实时叙事接入（Vertex / OpenAI）
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                id="provider-vertex"
                type="button"
                className={`btn sm ${settings.provider === 'vertex' ? 'primary' : ''}`}
                onClick={() => setSettings(prev => ({ ...prev, provider: 'vertex' }))}
              >
                <Cpu size={13} />Vertex AI（含思维链阶梯）
              </button>
              <button
                id="provider-openai"
                type="button"
                className={`btn sm ${settings.provider === 'openai' ? 'primary' : ''}`}
                onClick={() => setSettings(prev => ({ ...prev, provider: 'openai' }))}
              >
                OpenAI 兼容接口
              </button>
            </div>

            <div className="two-col-grid">
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span>默认模型标识</span>
                <input
                  id="engine-model-input"
                  type="text"
                  value={settings.model}
                  onChange={e => setSettings(prev => ({ ...prev, model: e.target.value }))}
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--umber-strong)', background: '#fffaf0', fontFamily: 'var(--font-data)' }}
                />
              </label>

              {settings.provider === 'vertex' ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  <span>Vertex 区域 (Location)</span>
                  <input
                    id="engine-location-input"
                    type="text"
                    value={settings.location}
                    onChange={e => setSettings(prev => ({ ...prev, location: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--umber-strong)', background: '#fffaf0', fontFamily: 'var(--font-data)' }}
                  />
                </label>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  <span>OpenAI 兼容 Base URL</span>
                  <input
                    id="engine-baseurl-input"
                    type="text"
                    value={settings.openaiBaseUrl}
                    onChange={e => setSettings(prev => ({ ...prev, openaiBaseUrl: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--umber-strong)', background: '#fffaf0', fontFamily: 'var(--font-data)' }}
                  />
                </label>
              )}
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />API Key 或服务账号 JSON（仅隔离存放在引擎槽，绝不写入游戏存档与角色卡）</span>
              <input
                id="engine-secret-input"
                type="password"
                value={secretInput}
                onChange={e => setSecretInput(e.target.value)}
                placeholder="未填密钥时将自动无损退回离线模板模式"
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--umber-strong)', background: '#fffaf0', fontFamily: 'var(--font-data)' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <input
                id="engine-thinking-toggle"
                type="checkbox"
                checked={settings.thinking}
                onChange={e => setSettings(prev => ({ ...prev, thinking: e.target.checked }))}
              />
              <span>启用思维链推演（`includeThoughts` / `thinkingLevel` 自适应 + 自动 JSON 修复）</span>
            </label>

            <button
              id="engine-save-proto-btn"
              type="button"
              className="btn primary"
              onClick={() => void commitSettings(
                settings.mode === 'llm'
                  ? '已启用实时叙事引擎配置（网络不可用或缺失密钥时自动无损降级）。'
                  : '已切换为离线本地演剧模式。',
              )}
            >
              <Sparkles size={13} />保存引擎网关配置
            </button>
          </div>
        )}

        {tab === 'prompts' && (
          <div className="paper-note tone-kraft" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {SCOPES.map(scope => (
                <button
                  key={scope}
                  id={`prompt-scope-${scope}`}
                  type="button"
                  className={`btn sm ${activeScope === scope ? 'primary' : 'ghost'}`}
                  onClick={() => setActiveScope(scope)}
                >
                  {NARRATIVE_SCOPE_LABELS[scope]}
                </button>
              ))}
            </div>
            <textarea
              id="engine-prompt-editor"
              rows={6}
              value={settings.prompts[activeScope]}
              onChange={e => setSettings(prev => ({
                ...prev,
                prompts: { ...prev.prompts, [activeScope]: e.target.value },
              }))}
              style={{ padding: 10, borderRadius: 6, border: '1px solid var(--umber-strong)', background: '#fffaf0', lineHeight: 1.65 }}
            />
            <button
              id="engine-save-prompt-btn"
              type="button"
              className="btn primary"
              onClick={() => void commitSettings(`已保存「${NARRATIVE_SCOPE_LABELS[activeScope]}」提示词模板。`)}
            >
              保存作用域提示词
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
