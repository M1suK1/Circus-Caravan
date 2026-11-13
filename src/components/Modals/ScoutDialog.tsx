import { useEffect, useState } from 'react';
import { Building2, Compass, MapPin, Sparkles, Theater, Users, X } from 'lucide-react';
import { REGION_CATALOG } from '../../content/regions.ts';
import { fallbackSettlementDetails, surroundingTerrainsOf } from '../../domain/regionGen.ts';
import type { CircusState, SettlementDetails, SettlementPoi } from '../../types.ts';

const ACT_LABELS: Record<string, string> = {
  acrobatics: '高空杂技',
  beast_tame: '奇兽驯演',
  illusion: '光影幻术',
  comedy: '荒诞喜剧',
  music: '篝火吟游',
  flame: '烈焰戏法',
};

export function ScoutDialog({
  state,
  poi,
  onClose,
  onCommitScout,
  onNotify,
}: {
  state: CircusState;
  poi: SettlementPoi;
  onClose: () => void;
  onCommitScout: (poiId: string, details: SettlementDetails) => void;
  onNotify: (msg: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [streamPreview, setStreamPreview] = useState('');
  const region = state.world.regions[poi.regionId];
  const map = region.map;
  const surroundings = map ? surroundingTerrainsOf(map, poi.x, poi.y) : [];
  const npcsHere = state.worldNpcs.filter(n => n.poiId === poi.id);

  useEffect(() => {
    if (!generating) return;
    const draft = fallbackSettlementDetails(poi, REGION_CATALOG[poi.regionId], surroundings, state.world.seed + state.day);
    const fullText = `【叙事引擎 · 聚落勘察简报】\n地名：${draft.name}\n风貌：${draft.summary}\n商情：${draft.marketTraits.join(' / ')}`;
    let idx = 0;
    const timer = window.setInterval(() => {
      idx += 6;
      setStreamPreview(fullText.slice(0, idx));
      if (idx >= fullText.length) {
        window.clearInterval(timer);
        setGenerating(false);
        onCommitScout(poi.id, { ...draft, detailSource: 'llm' });
      }
    }, 28);
    return () => window.clearInterval(timer);
  }, [generating, poi, surroundings, state.world.seed, state.day, onCommitScout]);

  return (
    <div id="scout-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="scout-modal-title">
      <div className="modal-scroll">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">LLM SETTLEMENT SCOUTING · 聚落侦查卷宗</span>
            <h2 id="scout-modal-title">
              {poi.scouted && poi.details ? poi.details.name : poi.placeholderName}
            </h2>
          </div>
          <button id="scout-modal-close" type="button" className="icon-btn" aria-label="关闭窗口" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <span className="wax-pill"><Compass size={12} />所在大区：{region.name}</span>
          <span className="wax-pill"><MapPin size={12} />中心坐标：({poi.x}, {poi.y})</span>
          <span className="wax-pill amber"><Building2 size={12} />占地规模：{poi.footprint.length} 格 ({poi.kind === 'city' ? '城郭' : '村寨'})</span>
        </div>

        {!poi.scouted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="parchment-card">
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
                在程序化生成的区域舆图上，这座{poi.kind === 'city' ? '多格城郭' : '村寨'}目前仅标明了地理锚点。点击下方按钮将传入<strong>「{region.name}」世界观与周边地貌样本</strong>，由叙事引擎现场生成聚落名讳、末世氛围、观众偏好与暗藏线索。
              </p>
              {generating ? (
                <pre style={{
                  margin: 0, padding: 12, borderRadius: 6, background: '#2a1f18', color: '#f6ebd5',
                  fontFamily: 'var(--font-body)', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.7,
                }}>
                  {streamPreview || '斥候正在翻越界碑，向叙事引擎传回烟尘与风向……'}
                </pre>
              ) : (
                <button
                  id="trigger-llm-scout-btn"
                  type="button"
                  className="btn primary full"
                  onClick={() => setGenerating(true)}
                >
                  <Sparkles size={14} />召唤斥候并生成聚落详志（前端叙事模拟）
                </button>
              )}
            </div>
          </div>
        ) : poi.details && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="parchment-card">
              <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--ink)' }}>{poi.details.summary}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <span className="wax-pill forest">民众希望度：{poi.details.hope}/100</span>
                {poi.details.preferredActs.map(act => (
                  <span key={act} className="wax-pill amber">偏好节目：{ACT_LABELS[act] ?? act}</span>
                ))}
                {poi.details.marketTraits.map(t => (
                  <span key={t} className="wax-pill">{t}</span>
                ))}
              </div>
              {poi.details.rumorLead && (
                <p style={{ marginTop: 10, fontSize: 12, color: 'var(--crimson)' }}>
                  酒馆风闻：{poi.details.rumorLead}
                </p>
              )}
            </div>

            <div className="parchment-card">
              <div className="card-head">
                <h3><Users size={15} />驻地角色卡 NPC ({npcsHere.length})</h3>
                <small>可在「马车」页将卡库角色指派到此</small>
              </div>
              {npcsHere.length ? npcsHere.map(npc => (
                <div key={npc.id} className="poi-row">
                  <div className="poi-row-info">
                    <b>{npc.name} · {npc.title}</b>
                    <small>{npc.personality}</small>
                  </div>
                  <span className="wax-pill">好感 {npc.disposition}</span>
                </div>
              )) : (
                <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>目前暂无指派进驻此城的角色卡 NPC。</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                id="poi-stage-show-preview"
                type="button"
                className="btn primary"
                onClick={() => onNotify(`前端原型提示：已在「${poi.details?.name}」搭起篷布舞台，后续阶段将在此直接编排开演！`)}
              >
                <Theater size={14} />在此搭棚开演（原型入口）
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
