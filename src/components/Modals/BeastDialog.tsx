import { Coins, GitBranch, Heart, PawPrint, Sparkles, Swords, X } from 'lucide-react';
import { findBeastSpecies } from '../../content/species.ts';
import type { Beast } from '../../types.ts';

export function BeastDialog({
  beast,
  onClose,
  onNotify,
}: {
  beast: Beast;
  onClose: () => void;
  onNotify: (msg: string) => void;
}) {
  const species = findBeastSpecies(beast.speciesId);

  return (
    <div id="beast-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="beast-modal-title">
      <div className="modal-scroll vellum-sheet">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">MENAGERIE & EVOLUTION · 奇幻生物培养与进阶树</span>
            <h2 id="beast-modal-title">{beast.nickname}（{species?.name ?? beast.speciesId}）</h2>
          </div>
          <button id="beast-modal-close" type="button" className="icon-btn" aria-label="关闭兽笼详情" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="paper-note tone-ivory pinned" style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 10 }}>{species?.description}</p>
          <div className="stat-grid-2">
            <div className="metric-box"><small>观赏演出度</small><b>{beast.appeal}</b></div>
            <div className="metric-box"><small>护航战斗力</small><b>{beast.combatPower}</b></div>
            <div className="metric-box"><small>驯服亲和</small><b>{beast.tameness}%</b></div>
            <div className="metric-box"><small>黑市参考拍价</small><b>{species?.baseAuctionValue ?? 600} 金</b></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button id="beast-feed-btn" type="button" className="btn sm" onClick={() => onNotify(`前端原型：投喂魔草精料后，${beast.nickname}的饱食度与驯服度将提升。`)}>
              <Heart size={13} />喂食精料
            </button>
            <button id="beast-train-btn" type="button" className="btn sm" onClick={() => onNotify(`前端原型：安排驯兽师训练后，${beast.nickname}获得成长经验并有机会觉醒演出天赋。`)}>
              <Swords size={13} />排练驯养
            </button>
            <button id="beast-auction-btn" type="button" className="btn sm primary" onClick={() => onNotify(`前端原型：可将其送入铁轨商会或锈蚀黑市拍卖行（底价 ${species?.baseAuctionValue ?? 600} 金）。`)}>
              <Coins size={13} />送往拍卖行估价
            </button>
          </div>
        </div>

        <div className="paper-note tone-kraft">
          <div className="card-head">
            <h3><GitBranch size={15} />多分支进阶进化路线</h3>
            <small>满足等级、驯服度与催化物即可分支蜕变</small>
          </div>
          {species?.evolutions.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {species.evolutions.map(evo => (
                <div key={evo.targetSpeciesId} className="poi-row">
                  <div className="poi-row-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <PawPrint size={13} style={{ color: 'var(--crimson)' }} />
                      <b>{evo.branchName}</b>
                    </div>
                    <small>{evo.description}</small>
                    <small style={{ color: 'var(--amber)' }}>
                      条件：Lv.{evo.requireLevel} · 驯服 {evo.requireTameness}% {evo.requireMaterial ? `· 催化物「${evo.requireMaterial}」` : ''}
                    </small>
                  </div>
                  <button
                    id={`beast-evolve-${evo.targetSpeciesId}`}
                    type="button"
                    className="btn sm"
                    onClick={() => onNotify(`已预览进阶路线「${evo.branchName}」——Stage 3 捕获与炼化接入后即可正式突破！`)}
                  >
                    <Sparkles size={12} />预演进阶
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>该奇幻生物已处于高阶终极形态，或暂无更进一步分支。</p>
          )}
        </div>
      </div>
    </div>
  );
}
