import { useMemo, useState } from 'react';
import { BookOpen, Compass, PawPrint, Shield, Sparkles, Swords, X } from 'lucide-react';
import { REGION_CATALOG } from '../../content/regions.ts';
import { BEAST_SPECIES } from '../../content/species.ts';
import {
  CATEGORY_LABELS,
  ELEMENT_IDS,
  ELEMENT_TAXONOMY,
  getElementProfile,
} from '../../domain/creatureTaxonomy.ts';
import type { BeastCategory, BeastElement, BeastSpecies, CircusState } from '../../types.ts';
import { CreaturePortrait } from '../CreaturePortrait.tsx';

export function BestiaryDialog({
  state,
  onClose,
  onAttemptCapture,
}: {
  state: CircusState;
  onClose: () => void;
  onAttemptCapture: (speciesId: string, useBait: boolean) => void;
}) {
  const [elFilter, setElFilter] = useState<BeastElement | 'all'>('all');
  const [catFilter, setCatFilter] = useState<BeastCategory | 'all'>('all');
  const [onlySeen, setOnlySeen] = useState(false);
  const [useBait, setUseBait] = useState(false);

  const encounteredSet = useMemo(() => {
    const s = new Set(state.encounteredSpeciesIds);
    for (const b of state.beasts) s.add(b.speciesId);
    return s;
  }, [state.encounteredSpeciesIds, state.beasts]);

  const filtered = useMemo(
    () =>
      BEAST_SPECIES.filter(sp => {
        if (elFilter !== 'all' && sp.element !== elFilter) return false;
        if (catFilter !== 'all' && sp.category !== catFilter) return false;
        if (onlySeen && !encounteredSet.has(sp.id)) return false;
        return true;
      }),
    [elFilter, catFilter, onlySeen, encounteredSet],
  );

  const [selectedId, setSelectedId] = useState<string>(() => filtered[0]?.id ?? BEAST_SPECIES[0]!.id);
  const selected: BeastSpecies = filtered.find(s => s.id === selectedId) ?? filtered[0] ?? BEAST_SPECIES[0]!;
  const isSeen = encounteredSet.has(selected.id);
  const elInfo = getElementProfile(selected.element);
  const canCaptureHere = isSeen && selected.habitatRegions.includes(state.world.currentRegionId);
  const discoveredCount = BEAST_SPECIES.filter(s => encounteredSet.has(s.id)).length;
  const pct = Math.round((discoveredCount / Math.max(1, BEAST_SPECIES.length)) * 100);

  return (
    <div id="bestiary-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="bestiary-modal-title">
      <div className="modal-scroll wide vellum-sheet">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">CIRCUS BESTIARY & TAXONOMY · 九大地区奇兽与魔物娘图鉴</span>
            <h2 id="bestiary-modal-title">残响生态图鉴 ({discoveredCount} / {BEAST_SPECIES.length} 已遭遇 · {pct}%)</h2>
          </div>
          <button id="bestiary-modal-close" type="button" className="icon-btn" aria-label="关闭生态图鉴" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* 宝可梦式六大属性筛选 + 生态纲目筛选 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            <button id="bestiary-el-all" type="button" className={`btn sm ${elFilter === 'all' ? 'primary' : 'ghost'}`} onClick={() => setElFilter('all')}>
              全部属性
            </button>
            {ELEMENT_IDS.map(eid => {
              const ep = ELEMENT_TAXONOMY[eid];
              return (
                <button
                  key={eid}
                  id={`bestiary-el-${eid}`}
                  type="button"
                  className={`btn sm ${elFilter === eid ? 'primary' : 'ghost'}`}
                  onClick={() => setElFilter(eid)}
                >
                  {ep.label}
                </button>
              );
            })}
            <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer' }}>
              <input id="bestiary-only-seen" type="checkbox" checked={onlySeen} onChange={e => setOnlySeen(e.target.checked)} />
              <span>仅看已遭遇</span>
            </label>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <button id="bestiary-cat-all" type="button" className={`btn sm ${catFilter === 'all' ? 'amber' : 'ghost'}`} onClick={() => setCatFilter('all')}>
              全部分类
            </button>
            {(Object.keys(CATEGORY_LABELS) as BeastCategory[]).map(cat => (
              <button
                key={cat}
                id={`bestiary-cat-${cat}`}
                type="button"
                className={`btn sm ${catFilter === cat ? 'amber' : 'ghost'}`}
                onClick={() => setCatFilter(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="two-col-grid">
          {/* 左栏：图鉴网格列表 */}
          <div className="paper-note tone-kraft" style={{ maxHeight: 410, overflowY: 'auto' }}>
            <div className="bestiary-grid">
              {filtered.map(sp => {
                const seen = encounteredSet.has(sp.id);
                const ep = getElementProfile(sp.element);
                return (
                  <button
                    key={sp.id}
                    id={`bestiary-item-${sp.id}`}
                    type="button"
                    className={`bestiary-tile ${selected.id === sp.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(sp.id)}
                  >
                    <CreaturePortrait species={sp} size={46} silhouetteOnly={!seen} />
                    <div className="bestiary-tile-info">
                      <b>{seen ? sp.name : '？？？'}</b>
                      <small style={{ color: ep.color }}>{ep.label} · {sp.category ? CATEGORY_LABELS[sp.category] : '奇兽'}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右栏：选中生物详尽档案 + 宝可梦式属性克制 + 随机捕捉入口 */}
          <div className="paper-note tone-ivory pinned" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <CreaturePortrait species={selected} size={86} silhouetteOnly={!isSeen} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <strong style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>
                    {isSeen ? selected.name : '未探明奇幻生灵'}
                  </strong>
                  <span className="wax-pill" style={{ background: elInfo.bg, color: elInfo.color, borderColor: elInfo.color }}>
                    {elInfo.label}
                  </span>
                  <span className="wax-pill">{selected.category ? CATEGORY_LABELS[selected.category] : '奇兽'}</span>
                </div>
                <small style={{ color: 'var(--ink-muted)' }}>
                  笼位 {selected.cageCost} 格 · 捕获难度 {selected.captureDifficulty} · 拍价参考 {selected.baseAuctionValue} 金
                </small>
                <small style={{ color: 'var(--ink-soft)' }}>
                  <Compass size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  分布：{selected.habitatRegions.map(r => REGION_CATALOG[r].name).join(' / ')}
                </small>
              </div>
            </div>

            {/* 宝可梦式属性相克关系 */}
            <div className="poi-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                <span style={{ color: 'var(--forest)' }}>
                  <Swords size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  克制 (2×)：{elInfo.strongAgainst.map(e => ELEMENT_TAXONOMY[e].label).join('、')}
                </span>
                <span style={{ color: 'var(--crimson)' }}>
                  <Shield size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  弱点 (0.5×)：{elInfo.weakTo.map(e => ELEMENT_TAXONOMY[e].label).join('、')}
                </span>
              </div>
              <small style={{ color: 'var(--ink-muted)' }}>{elInfo.ecologyNote}</small>
            </div>

            {isSeen ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.65 }}>
                  <BookOpen size={12} style={{ verticalAlign: 'middle', marginRight: 5, color: 'var(--crimson)' }} />
                  {selected.description}
                </p>
                <div className="stat-grid-2">
                  <div className="metric-box"><small>基础观赏 / 战力</small><b>{selected.baseAppeal} / {selected.baseCombatPower}</b></div>
                  <div className="metric-box"><small>常驻增益 / 产出</small><b>{selected.yieldSummary ?? '随队增益型'}</b></div>
                </div>
                {selected.passiveEffect && (
                  <small style={{ color: 'var(--amber)', fontWeight: 600 }}>被动特技：{selected.passiveEffect}</small>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4, borderTop: '1px dashed var(--umber-line)', paddingTop: 8 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer' }}>
                    <input type="checkbox" checked={useBait} onChange={e => setUseBait(e.target.checked)} />
                    <span>投彩粉诱饵 (+32% 捕获率，消耗 1 道具)</span>
                  </label>
                  <button
                    id="bestiary-capture-btn"
                    type="button"
                    className="btn sm primary"
                    disabled={!canCaptureHere || state.supplies.tamingNets < 1}
                    onClick={() => onAttemptCapture(selected.id, useBait)}
                  >
                    <PawPrint size={12} />{canCaptureHere ? `投网捕捉 (余 ${state.supplies.tamingNets})` : '需前往其栖息大区捕捉'}
                  </button>
                </div>
              </>
            ) : (
              <div className="poi-row">
                <small style={{ color: 'var(--ink-muted)' }}>
                  <Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  尚未在野外遭遇过此生灵。请前往 {selected.habitatRegions.map(r => REGION_CATALOG[r].name).join('或')} 的「{(selected.habitats ?? ['荒野']).join(' / ')}」地形探索解锁完整图鉴！
                </small>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
