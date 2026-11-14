import { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  Building2,
  Coins,
  Compass,
  Gavel,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Theater,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { REGION_CATALOG } from '../../content/regions.ts';
import { fallbackSettlementDetails, surroundingTerrainsOf } from '../../domain/regionGen.ts';
import {
  buildSettlementBuildings,
  computeShowPayout,
  computeTavernRestCost,
} from '../../domain/settlements.ts';
import type {
  CircusState,
  GameAction,
  SettlementBuilding,
  SettlementBuildingKind,
  SettlementDetails,
  SettlementPoi,
  Supplies,
} from '../../types.ts';
import { ContractBoard } from './ContractBoard.tsx';

const ACT_LABELS: Record<string, string> = {
  acrobatics: '高空杂技',
  beast_tame: '奇兽驯演',
  illusion: '光影幻术',
  comedy: '荒诞喜剧',
  music: '篝火吟游',
  flame: '烈焰戏法',
};

const BUILDING_ICONS: Record<SettlementBuildingKind, typeof Building2> = {
  tavern: BedDouble,
  general_store: ShoppingBag,
  stage_square: Theater,
  workshop_market: Package,
  guild_station: Truck,
  auction_market: Gavel,
  sanctuary_chapel: ShieldCheck,
};

const STORE_BATCHES: { key: keyof Supplies; name: string; amount: number; cost: number }[] = [
  { key: 'rations', name: '行军干粮', amount: 8, cost: 64 },
  { key: 'fodder', name: '奇兽魔草精料', amount: 5, cost: 70 },
  { key: 'fuel', name: '风灯魔导油', amount: 6, cost: 72 },
  { key: 'spareParts', name: '铁木修车零件', amount: 3, cost: 66 },
  { key: 'tamingNets', name: '麻醉捕获网', amount: 2, cost: 90 },
  { key: 'props', name: '戏法彩粉道具', amount: 4, cost: 72 },
];

export function ScoutDialog({
  state,
  poi,
  onClose,
  onCommitScout,
  onAction,
}: {
  state: CircusState;
  poi: SettlementPoi;
  onClose: () => void;
  onCommitScout: (poiId: string, details: SettlementDetails) => void;
  onAction: (action: GameAction) => void;
  onNotify?: (msg: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [streamPreview, setStreamPreview] = useState('');
  const region = state.world.regions[poi.regionId];
  const map = region.map;
  const surroundings = map ? surroundingTerrainsOf(map, poi.x, poi.y) : [];
  const npcsHere = state.worldNpcs.filter(n => n.poiId === poi.id);
  const isHere = state.world.currentPoiId === poi.id || Math.hypot(state.world.pos.x - (poi.x + 0.5), state.world.pos.y - (poi.y + 0.5)) <= 2.4;

  const buildings = useMemo(
    () => buildSettlementBuildings(poi, REGION_CATALOG[poi.regionId]),
    [poi],
  );
  const [activeBuildingId, setActiveBuildingId] = useState<string>(() => buildings[0]?.id ?? '');
  const activeBuilding: SettlementBuilding | undefined =
    buildings.find(b => b.id === activeBuildingId) ?? buildings[0];

  useEffect(() => {
    setActiveBuildingId(buildings[0]?.id ?? '');
  }, [poi.id]);

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
    }, 26);
    return () => window.clearInterval(timer);
  }, [generating, poi, surroundings, state.world.seed, state.day, onCommitScout]);

  const restCost = computeTavernRestCost(state, poi.kind === 'city');
  const showPreview = computeShowPayout(state, poi, region.dangerTier);

  return (
    <div id="scout-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="scout-modal-title">
      <div className="modal-scroll wide vellum-sheet">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">
              {poi.kind === 'city' ? 'WALLED CITY STATION · 城郭驻地与建筑群' : 'OUTLAND VILLAGE · 荒野村寨驻地'}
            </span>
            <h2 id="scout-modal-title">
              {poi.scouted && poi.details ? poi.details.name : poi.placeholderName}
            </h2>
          </div>
          <button id="scout-modal-close" type="button" className="icon-btn" aria-label="关闭驻地窗口" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
          <span className="wax-pill"><Compass size={12} />{region.name}</span>
          <span className="wax-pill"><MapPin size={12} />坐标 ({poi.x}, {poi.y})</span>
          <span className="wax-pill amber"><Building2 size={12} />{poi.kind === 'city' ? `城郭 ${poi.footprint.length} 格` : '村寨'}</span>
          <span className={`wax-pill ${isHere ? 'forest' : 'crimson'}`}>
            {isHere ? '车队已进驻此地 · 可访问建筑' : '远距侦查档案（抵达后可进建筑）'}
          </span>
        </div>

        {!poi.scouted ? (
          <div className="paper-note tone-ivory pinned" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
              目前仅标定了这座{poi.kind === 'city' ? '多格城郭' : '村寨'}的地理坐标。派遣斥候侦查后，将结合<strong>「{region.name}」</strong>风貌与周边地形生成聚落名讳、商情并开放城村内所有可访问建筑。
            </p>
            {generating ? (
              <pre style={{
                margin: 0, padding: 12, borderRadius: 6, background: '#2a1f18', color: '#f6ebd5',
                fontFamily: 'var(--font-body)', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.7,
              }}>
                {streamPreview || '斥候正在翻越界碑，勘测街道建筑与居民风貌……'}
              </pre>
            ) : (
              <button
                id="trigger-llm-scout-btn"
                type="button"
                className="btn primary full"
                onClick={() => setGenerating(true)}
              >
                <Sparkles size={14} />侦查此聚落并解锁建筑访问
              </button>
            )}
          </div>
        ) : poi.details && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="paper-note tone-ivory pinned">
              <p style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--ink)' }}>{poi.details.summary}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                <span className="wax-pill forest">希望值 {poi.details.hope}/100</span>
                {poi.details.preferredActs.map(act => (
                  <span key={act} className="wax-pill amber">偏好：{ACT_LABELS[act] ?? act}</span>
                ))}
                {poi.details.marketTraits.map(t => (
                  <span key={t} className="wax-pill">{t}</span>
                ))}
              </div>
            </div>

            <div className="two-col-grid">
              {/* 左侧：城/村可访问建筑群列表 */}
              <div className="paper-note tone-kraft" aria-label="聚落可访问建筑列表">
                <div className="card-head">
                  <h3><Building2 size={14} />聚落建筑（点击访问）</h3>
                  <small>{buildings.length} 处</small>
                </div>
                <div className="settlement-building-grid">
                  {buildings.map(b => {
                    const Icon = BUILDING_ICONS[b.kind] ?? Building2;
                    const active = activeBuilding?.id === b.id;
                    return (
                      <button
                        key={b.id}
                        id={`visit-building-${b.kind}`}
                        type="button"
                        className={`building-tile ${active ? 'active' : ''}`}
                        onClick={() => setActiveBuildingId(b.id)}
                      >
                        <div className="building-tile-head">
                          <Icon size={14} />
                          <b>{b.name}</b>
                        </div>
                        <small>{b.subtitle}</small>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 右侧：当前访问建筑的交互面板 */}
              {activeBuilding && (
                <div className="paper-note tone-sage" aria-label="当前建筑交互服务">
                  <div className="card-head">
                    <h3>{activeBuilding.name}</h3>
                    <span className="wax-pill">{activeBuilding.subtitle}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>{activeBuilding.description}</p>

                  {activeBuilding.kind === 'tavern' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {poi.details.rumorLead && (
                        <div className="poi-row">
                          <small style={{ color: 'var(--crimson)', fontSize: 11.5 }}>酒馆风闻：{poi.details.rumorLead}</small>
                        </div>
                      )}
                      <div className="poi-row">
                        <div className="poi-row-info">
                          <b>热汤投宿 · 全团休整</b>
                          <small>恢复全员满 HP、疲劳 −35、士气 +8（随团员人数计费）</small>
                        </div>
                        <button
                          id="building-tavern-rest-btn"
                          type="button"
                          className="btn sm primary"
                          disabled={!isHere || state.gold < restCost}
                          onClick={() => onAction({ type: 'tavernRest', poiId: poi.id })}
                        >
                          <Coins size={11} />投宿 ({restCost} 金)
                        </button>
                      </div>
                      <div className="poi-row">
                        <div className="poi-row-info">
                          <b><Users size={11} /> 驻地角色卡 NPC ({npcsHere.length})</b>
                          <small>{npcsHere.length ? npcsHere.map(n => `${n.name}(${n.title})`).join('、') : '暂未安排驻地角色卡 NPC'}</small>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeBuilding.kind === 'stage_square' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      <div className="stat-grid-2">
                        <div className="metric-box"><small>预估票房 + 打赏</small><b>{showPreview.revenue + showPreview.tipBonus} 金</b></div>
                        <div className="metric-box"><small>预计提升希望 / 契合度</small><b>+{showPreview.hopeGain} / {showPreview.matchScore}项</b></div>
                      </div>
                      <button
                        id="building-stage-perform-btn"
                        type="button"
                        className="btn primary full"
                        disabled={!isHere}
                        onClick={() => onAction({ type: 'stagePerform', poiId: poi.id })}
                      >
                        <Theater size={14} />{isHere ? '立即搭棚开演并结算票房' : '需车队进驻后方可开演'}
                      </button>
                    </div>
                  )}

                  {(activeBuilding.kind === 'general_store' || activeBuilding.kind === 'workshop_market') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                      {(activeBuilding.kind === 'general_store' ? STORE_BATCHES.slice(0, 4) : STORE_BATCHES).map(item => (
                        <div key={item.key} className="poi-row">
                          <div className="poi-row-info">
                            <b>{item.name} (+{item.amount})</b>
                            <small>当前库存 {state.supplies[item.key]}</small>
                          </div>
                          <button
                            id={`building-buy-${item.key}`}
                            type="button"
                            className="btn sm primary"
                            disabled={!isHere || state.gold < item.cost}
                            onClick={() => onAction({
                              type: 'settlementBuySupply',
                              poiId: poi.id,
                              supplyKey: item.key,
                              amount: item.amount,
                              cost: item.cost,
                            })}
                          >
                            {item.cost} 金采购
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeBuilding.kind === 'guild_station' && (
                    <ContractBoard mode="guild" state={state} poi={poi} isHere={isHere} onAction={onAction} />
                  )}

                  {activeBuilding.kind === 'auction_market' && (
                    <ContractBoard mode="auction" state={state} poi={poi} isHere={isHere} onAction={onAction} />
                  )}

                  {activeBuilding.kind === 'sanctuary_chapel' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        id="building-sanctuary-aid-btn"
                        type="button"
                        className="btn sm primary"
                        disabled={!isHere}
                        onClick={() => onAction({
                          type: 'settlementAidOrPass',
                          poiId: poi.id,
                          mode: activeBuilding.name.includes('晨曦') ? 'ration_aid' : 'buy_pass',
                        })}
                      >
                        {activeBuilding.name.includes('晨曦') ? '领取黎明圣教救济口粮 (+6粮/+3料)' : '办理地区势力通行凭证 (240 金)'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
