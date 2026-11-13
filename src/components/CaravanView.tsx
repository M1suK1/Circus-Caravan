import { useState } from 'react';
import {
  ArrowUpCircle,
  Caravan as CaravanIcon,
  MessageSquare,
  Plus,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import { usedCageSlots, usedSeats, usedWeight, wagonRepairCost, wagonUpgradeCost } from '../domain/caravanMath.ts';
import { CIRCUS_ROLE_LABELS } from '../domain/cardAdapter.ts';
import { optimizeCardImages, parseCardJson } from '../engine/cardCodec.ts';
import type { CircusRole, CircusState, GirlCard, Performer, SettlementPoi } from '../types.ts';
import { GirlPortrait } from './GirlPortrait.tsx';

export function CaravanView({
  state,
  onUpgradeWagon,
  onRepairWagon,
  onHireCandidate,
  onSelectPerformer,
  onImportCardAsPerformer,
  onPlaceCardAsNpc,
  onNotify,
}: {
  state: CircusState;
  onUpgradeWagon: (wagonId: string) => void;
  onRepairWagon: (wagonId: string) => void;
  onHireCandidate: (candidateId: string) => void;
  onSelectPerformer: (performer: Performer) => void;
  onImportCardAsPerformer: (card: GirlCard, role?: CircusRole) => void;
  onPlaceCardAsNpc: (card: GirlCard, poiId: string) => void;
  onNotify: (msg: string, warn?: boolean) => void;
}) {
  const [stagedCard, setStagedCard] = useState<GirlCard | null>(null);
  const [pickedRole, setPickedRole] = useState<CircusRole>('illusionist');

  const regionMap = state.world.regions[state.world.currentRegionId].map;
  const scoutedPois: SettlementPoi[] = regionMap
    ? Object.values(regionMap.pois).filter(p => p.scouted && p.details)
    : [];
  const [npcTargetPoi, setNpcTargetPoi] = useState<string>('');
  const activePoiId = npcTargetPoi || state.world.currentPoiId || scoutedPois[0]?.id || '';

  const handleCardFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCardJson(text);
    if (!parsed.ok) {
      onNotify(parsed.message, true);
      return;
    }
    const slim = await optimizeCardImages(parsed.card);
    setStagedCard(slim);
    onNotify(`已载入角色卡「${slim.girl.name}」，可选择登车演出或留驻城镇。`);
  };

  return (
    <div className="two-col-grid">
      <section className="paper-note tone-ivory pinned" aria-label="五节大篷车车厢配置">
        <div className="card-head">
          <h2><CaravanIcon size={16} />大篷车车厢编成</h2>
          <small>载重 {usedWeight(state)}/{state.caravan.maxWeight} · 席位 {usedSeats(state)}/{state.caravan.maxSeats} · 兽笼 {usedCageSlots(state)}/{state.caravan.maxCageSlots}</small>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {state.caravan.wagons.map(wagon => (
            <article key={wagon.id} className="poi-row" style={{ padding: '11px 12px' }}>
              <div className="poi-row-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b>{wagon.name}</b>
                  <span className="wax-pill amber">Lv.{wagon.level}</span>
                  <span className={`wax-pill ${wagon.durability < 50 ? 'crimson' : 'forest'}`}>
                    耐久 {wagon.durability}/{wagon.maxDurability}
                  </span>
                </div>
                <small>
                  {wagon.kind === 'stage' && '决定夜间演出的声光舞台规模与门票上限'}
                  {wagon.kind === 'cage' && '容纳野外捕获的奇幻生物（二阶巨兽占 2 格）'}
                  {wagon.kind === 'cargo' && '提供货运契约载重与行军补给储藏空间'}
                  {wagon.kind === 'passenger' && '决定演职员与付费搭车旅客的总席位上限'}
                  {wagon.kind === 'workshop' && '用于修补车轮耐久、制作捕兽网与演出道具'}
                </small>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  id={`wagon-repair-${wagon.id}`}
                  type="button"
                  className="btn sm"
                  disabled={wagon.durability >= wagon.maxDurability}
                  onClick={() => onRepairWagon(wagon.id)}
                >
                  <Wrench size={12} />修缮 ({wagonRepairCost(wagon)})
                </button>
                <button
                  id={`wagon-upgrade-${wagon.id}`}
                  type="button"
                  className="btn sm primary"
                  disabled={wagon.level >= 5}
                  onClick={() => onUpgradeWagon(wagon.id)}
                >
                  <ArrowUpCircle size={12} />扩建 ({wagonUpgradeCost(wagon)})
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="card-head" style={{ marginTop: 18 }}>
          <h3><UserPlus size={15} />酒馆流民与流浪艺人招募</h3>
          <small>待签约 {state.recruitPool.length} 名</small>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.recruitPool.length ? state.recruitPool.map(cand => (
            <article key={cand.id} className="poi-row">
              <div className="poi-row-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <b>{cand.name}</b>
                  <span className="wax-pill">{CIRCUS_ROLE_LABELS[cand.role]}</span>
                  <span className="wax-pill">日薪 {cand.wagePerDay}</span>
                </div>
                <small>{cand.title} · 「{cand.quote}」</small>
              </div>
              <button
                id={`hire-candidate-${cand.id}`}
                type="button"
                className="btn sm primary"
                onClick={() => onHireCandidate(cand.id)}
              >
                <Plus size={12} />签约 ({cand.hireCost} 金)
              </button>
            </article>
          )) : (
            <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>当前城镇酒馆暂未打听到新的流浪艺人。</p>
          )}
        </div>
      </section>

      <section className="paper-note tone-kraft" aria-label="马戏团演员阵容与角色卡双栖台">
        <div className="card-head">
          <h2><Users size={16} />剧团花名册</h2>
          <small>点击成员开启「档案 · 篝火夜谈 (LLM)」</small>
        </div>
        <div className="cards-grid">
          {state.performers.map(perf => (
            <button
              key={perf.id}
              id={`open-performer-${perf.id}`}
              type="button"
              className="crew-tile paper-note tone-ivory"
              onClick={() => onSelectPerformer(perf)}
            >
              <div className="crew-avatar">
                <GirlPortrait girl={perf} variant="avatar" />
              </div>
              <div className="crew-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <h4>{perf.name}</h4>
                  <span className="wax-pill amber">Lv.{perf.level}</span>
                </div>
                <small>{CIRCUS_ROLE_LABELS[perf.role]} · {perf.title}</small>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 11, color: 'var(--ink-soft)' }}>
                  <span>士气 {perf.morale}</span>
                  <span>信赖 {perf.bond}</span>
                  <span>日薪 {perf.wagePerDay}</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--crimson)', marginTop: 2 }}>
                  <MessageSquare size={11} />进入夜谈 / 换装舞台
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="card-head" style={{ marginTop: 18 }}>
          <h3><Sparkles size={15} />角色卡双栖指派台（演员 / 驻地 NPC）</h3>
          <small>兼容夜糖与大篷车格式 (.json)</small>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label htmlFor="caravan-card-upload" className="btn" style={{ width: 'fit-content' }}>
            <Upload size={14} />从本地读取角色卡文件
            <input
              id="caravan-card-upload"
              type="file"
              accept=".json"
              hidden
              onChange={e => void handleCardFile(e.target.files?.[0])}
            />
          </label>

          {stagedCard ? (
            <div className="poi-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontFamily: 'var(--font-display)', fontSize: 14 }}>{stagedCard.girl.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-muted)' }}>{stagedCard.girl.title} · {stagedCard.girl.element}</span>
                </div>
                <span className="wax-pill forest">卡面已验证</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <label htmlFor="card-role-select" style={{ fontSize: 12 }}>剧团职业：</label>
                <select
                  id="card-role-select"
                  value={pickedRole}
                  onChange={e => setPickedRole(e.target.value as CircusRole)}
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--umber-strong)', background: 'var(--vellum-bright)' }}
                >
                  {(Object.keys(CIRCUS_ROLE_LABELS) as CircusRole[]).map(r => (
                    <option key={r} value={r}>{CIRCUS_ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button
                  id="card-assign-performer"
                  type="button"
                  className="btn sm primary"
                  onClick={() => onImportCardAsPerformer(stagedCard, pickedRole)}
                >
                  编入马戏团演员
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', borderTop: '1px solid var(--umber-line)', paddingTop: 8 }}>
                <label htmlFor="card-npc-poi-select" style={{ fontSize: 12 }}>或驻扎城镇：</label>
                <select
                  id="card-npc-poi-select"
                  value={activePoiId}
                  onChange={e => setNpcTargetPoi(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--umber-strong)', background: 'var(--vellum-bright)' }}
                >
                  {scoutedPois.map(p => (
                    <option key={p.id} value={p.id}>{p.details?.name ?? p.placeholderName}</option>
                  ))}
                </select>
                <button
                  id="card-assign-npc"
                  type="button"
                  className="btn sm"
                  disabled={!activePoiId}
                  onClick={() => activePoiId && onPlaceCardAsNpc(stagedCard, activePoiId)}
                >
                  投放为世界 NPC
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              导入角色卡后，既能将其编为杂技/驯兽/幻术/斥候等演员上台演出，也能派往已侦查的城市或村庄担任镇长、商人或搭车旅客。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
