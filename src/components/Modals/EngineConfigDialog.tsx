import { useState } from 'react';
import { BookOpen, Cpu, FileCode2, KeyRound, Sparkles, X } from 'lucide-react';

export function EngineConfigDialog({
  onClose,
  onNotify,
}: {
  onClose: () => void;
  onNotify: (msg: string) => void;
}) {
  const [tab, setTab] = useState<'api' | 'prompts' | 'worldbook'>('api');
  const [provider, setProvider] = useState<'openai' | 'vertex'>('vertex');
  const [model, setModel] = useState('gemini-2.5-pro');
  const [thinking, setThinking] = useState(true);
  const [scoutPrompt, setScoutPrompt] = useState(
    '你正在为末世奇幻马戏团生成前方城邦/村落的侦查简报。请严格依据【所属大区基调】、【周围十倍小地图地形】与【世界荒芜度】，写出地名、民众在破败中挣扎求生的日常细节、观众偏好的演出与商路隐患。',
  );
  const [canonEntry, setCanonEntry] = useState(
    '【世界总纲】旧神纪元崩裂后的第 70 年，大陆被灰雾与各路军阀割裂。唯有巡游的大篷车仍挂着暖黄风灯，在绝望深村里搭起篷布舞台，并用微薄的演出收入支撑团员活到攒够隐居山谷路费的那一天。',
  );

  return (
    <div id="engine-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="engine-modal-title">
      <div className="modal-scroll wide vellum-sheet">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">LLM NARRATIVE CONSOLE PROTOTYPE · 叙事引擎控制台（前端原型）</span>
            <h2 id="engine-modal-title">LLM 接入与世界书配置中心</h2>
          </div>
          <button id="engine-modal-close" type="button" className="icon-btn" aria-label="关闭叙事引擎控制台" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="silk-tab-row" style={{ marginBottom: 16 }} role="tablist">
          <button id="engine-tab-api" type="button" role="tab" aria-selected={tab === 'api'} className={`silk-tab tone-indigo ${tab === 'api' ? 'active' : ''}`} onClick={() => setTab('api')}>
            <KeyRound size={13} /><span>模型网关与思维链</span>
          </button>
          <button id="engine-tab-prompts" type="button" role="tab" aria-selected={tab === 'prompts'} className={`silk-tab ${tab === 'prompts' ? 'active' : ''}`} onClick={() => setTab('prompts')}>
            <FileCode2 size={13} /><span>四大作用域预设</span>
          </button>
          <button id="engine-tab-worldbook" type="button" role="tab" aria-selected={tab === 'worldbook'} className={`silk-tab tone-amber ${tab === 'worldbook' ? 'active' : ''}`} onClick={() => setTab('worldbook')}>
            <BookOpen size={13} /><span>末世世界书条目</span>
          </button>
        </div>

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
            <small style={{ color: 'var(--ink-muted)' }}>作用范围：聚落侦查（`scout`）· 篝火夜谈（`campfire`）· 演出战报（`show`）· 隐居终局（`ending`）</small>
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

        {tab === 'worldbook' && (
          <div className="paper-note tone-sage" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <small style={{ color: 'var(--ink-muted)' }}>常驻世界书词条会在每次侦查聚落与篝火夜谈时自动注入上下文</small>
            <textarea
              id="engine-worldbook-editor"
              rows={6}
              value={canonEntry}
              onChange={e => setCanonEntry(e.target.value)}
              style={{ padding: 10, borderRadius: 6, border: '1px solid var(--umber-strong)', background: '#fffaf0', lineHeight: 1.6 }}
            />
            <button id="engine-save-wb-btn" type="button" className="btn primary" onClick={() => onNotify('已更新世界书常驻设定草稿。')}>
              保存世界书设定
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
