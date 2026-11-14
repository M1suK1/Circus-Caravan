import { useEffect, useState } from 'react';
import { Compass, MapPin, PawPrint, Sparkles, X } from 'lucide-react';
import { REGION_CATALOG } from '../../content/regions.ts';
import { findBeastSpecies } from '../../content/species.ts';
import { LANDMARK_META } from '../../domain/landmarks.ts';
import { callNarrativeLlm } from '../../engine/llmService.ts';
import type { CircusState, FieldLandmark } from '../../types.ts';

export function LandmarkDialog({
  state,
  landmark,
  onResolve,
  onAttemptCapture,
  onClose,
}: {
  state: CircusState;
  landmark: FieldLandmark;
  onResolve: (landmarkId: string, choice: 'primary' | 'secondary') => void;
  onAttemptCapture: (speciesId: string, useBait: boolean) => void;
  onClose: () => void;
}) {
  const meta = LANDMARK_META[landmark.kind];
  const region = REGION_CATALOG[landmark.regionId];
  const dist = Math.hypot(state.world.pos.x - (landmark.x + 0.5), state.world.pos.y - (landmark.y + 0.5));
  const isNear = dist <= 3.0;
  const linkedSpecies = landmark.linkedSpeciesId ? findBeastSpecies(landmark.linkedSpeciesId) : undefined;
  const [narrative, setNarrative] = useState<string>(landmark.summary);
  const [sourceTag, setSourceTag] = useState<'llm' | 'fallback'>('fallback');

  useEffect(() => {
    let active = true;
    void callNarrativeLlm<{ text: string }>({
      scope: 'encounter',
      regionId: landmark.regionId,
      keywords: [region.name, meta.label, landmark.name],
      parseJson: false,
      userPrompt: `车队在「${region.name}」的野外兴趣点「${landmark.name}」（类型：${meta.label}，地形：${landmark.terrain}）停驻。随行成员：${state.performers.map(p => p.name).join('、')}。请写一段 80 字左右的废土现场描写。`,
      fallback: () => ({
        text: `${meta.subtitle}。风灯照亮了「${landmark.name}」斑驳的轮廓，随行成员正警惕地环视四周动静。`,
      }),
    }).then(res => {
      if (!active) return;
      const text = typeof res.data === 'string' ? res.data : res.data.text;
      if (text?.trim()) {
        setNarrative(text.trim());
        setSourceTag(res.source);
      }
    });
    return () => { active = false; };
  }, [landmark.id, landmark.name, landmark.terrain, landmark.regionId, meta.label, meta.subtitle, region.name, state.performers]);

  return (
    <div id="landmark-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="landmark-modal-title">
      <div id="landmark-modal" className="modal-scroll vellum-sheet">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">FIELD LANDMARK · 野外兴趣点探索</span>
            <h2 id="landmark-modal-title">{landmark.name}</h2>
          </div>
          <button id="landmark-modal-close" type="button" className="icon-btn" aria-label="关闭兴趣点弹窗" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <span className="wax-pill"><Compass size={11} />{region.name} · {meta.label}</span>
          <span className="wax-pill"><MapPin size={11} />({landmark.x}, {landmark.y})</span>
          <span className={`wax-pill ${isNear ? 'forest' : 'crimson'}`}>
            {isNear ? '已在探索射程内' : `距此地 ${Math.round(dist)} 里（需驶近至 3 里内）`}
          </span>
          <span className="wax-pill amber">{sourceTag === 'llm' ? 'LLM 实时演绎' : '本地见闻'}</span>
        </div>

        <section className="paper-note tone-ivory pinned" style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12.5, lineHeight: 1.75, color: 'var(--ink)' }}>{narrative}</p>
        </section>

        {linkedSpecies && (
          <section className="paper-note tone-sage" style={{ marginBottom: 12 }}>
            <div className="card-head" style={{ marginBottom: 4 }}>
              <h3><PawPrint size={14} />巢穴常驻物种踪迹：{linkedSpecies.name}</h3>
              <span className="wax-pill">{linkedSpecies.element}系</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>{linkedSpecies.description}</p>
            <button
              id="landmark-quick-capture-btn"
              type="button"
              className="btn sm primary"
              disabled={!isNear || state.supplies.tamingNets < 1}
              onClick={() => onAttemptCapture(linkedSpecies.id, state.supplies.props > 0)}
            >
              <Sparkles size={12} />在此地投网捕捉「{linkedSpecies.name}」
            </button>
          </section>
        )}

        {landmark.resolved ? (
          <div className="paper-note tone-kraft">
            <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>该处兴趣点已勘探完毕，残响风灯只在地图上留下一枚已探印记。</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              id="landmark-choice-primary"
              type="button"
              className="btn primary"
              disabled={!isNear}
              onClick={() => onResolve(landmark.id, 'primary')}
            >
              {meta.primaryLabel}（消耗 1 时段）
            </button>
            <button
              id="landmark-choice-secondary"
              type="button"
              className="btn"
              disabled={!isNear}
              onClick={() => onResolve(landmark.id, 'secondary')}
            >
              {meta.secondaryLabel}（消耗 1 时段）
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
