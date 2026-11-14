import { useState } from 'react';
import {
  BookOpen,
  Coins,
  Compass,
  Flame,
  Hammer,
  Package,
  PawPrint,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';
import { BEAST_SPECIES, findBeastSpecies } from '../content/species.ts';
import { dailyUpkeep, usedCageSlots, usedSeats, usedWeight } from '../domain/caravanMath.ts';
import { getElementProfile } from '../domain/creatureTaxonomy.ts';
import { findCreatureAbility, findCreatureNature } from '../domain/naturesAndCapture.ts';
import type { Beast, CircusState } from '../types.ts';
import { CreaturePortrait } from './CreaturePortrait.tsx';

export function SuppliesView({
  state,
  onSelectBeast,
  onOpenBestiary,
  onBuySupply,
  onNotify,
}: {
  state: CircusState;
  onSelectBeast: (beast: Beast) => void;
  onOpenBestiary: () => void;
  onBuySupply: (key: keyof CircusState['supplies'], amount: number, cost: number) => void;
  onNotify: (msg: string, warn?: boolean) => void;
}) {
  const [tab, setTab] = useState<'supplies' | 'menagerie' | 'contracts'>('supplies');
  const upkeep = dailyUpkeep(state);

  const supplyItems: {
    key: keyof CircusState['supplies'];
    name: string;
    unitCost: number;
    batch: number;
    desc: string;
    Icon: typeof Package;
  }[] = [
    { key: 'rations', name: '行军干粮', unitCost: 8, batch: 10, desc: `全团与旅客每日消耗 ${upkeep.rations} 份`, Icon: Package },
    { key: 'fodder', name: '奇兽魔草精料', unitCost: 14, batch: 5, desc: `兽笼生物每日消耗 ${upkeep.fodder} 份`, Icon: PawPrint },
    { key: 'fuel', name: '风灯魔导油', unitCost: 12, batch: 8, desc: '划线路程与夜间高光演出必备燃料', Icon: Flame },
    { key: 'spareParts', name: '铁木修车零件', unitCost: 22, batch: 4, desc: '经过沼泽与废墟后抢修车轮轴枢', Icon: Hammer },
    { key: 'tamingNets', name: '麻醉捕捉网', unitCost: 45, batch: 2, desc: '野外遭遇野生奇幻生物时施行捕捉', Icon: Compass },
    { key: 'props', name: '彩粉与戏法道具', unitCost: 18, batch: 5, desc: '演出时追加投入，放大票房与希望值增幅', Icon: Sparkles },
  ];

  return (
    <div className="view-fill" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div className="silk-tab-row" role="tablist" aria-label="物资模块切换">
          <button id="supplies-tab-stock" type="button" role="tab" aria-selected={tab === 'supplies'} className={`silk-tab tone-amber ${tab === 'supplies' ? 'active' : ''}`} onClick={() => setTab('supplies')}>
            <ShoppingBag size={12} /><span>行军辎重与补给市集</span>
          </button>
          <button id="supplies-tab-beasts" type="button" role="tab" aria-selected={tab === 'menagerie'} className={`silk-tab ${tab === 'menagerie' ? 'active' : ''}`} onClick={() => setTab('menagerie')}>
            <PawPrint size={12} /><span>奇幻兽笼 ({usedCageSlots(state)}/{state.caravan.maxCageSlots} 格)</span>
          </button>
          <button id="supplies-tab-contracts" type="button" role="tab" aria-selected={tab === 'contracts'} className={`silk-tab tone-indigo ${tab === 'contracts' ? 'active' : ''}`} onClick={() => setTab('contracts')}>
            <Truck size={12} /><span>货运载重与乘客席位</span>
          </button>
        </div>

        <button id="supplies-open-bestiary-btn" type="button" className="btn sm primary" onClick={onOpenBestiary}>
          <BookOpen size={12} />奇兽魔物娘图鉴 ({state.encounteredSpeciesIds.length}/{BEAST_SPECIES.length})
        </button>
      </div>

      {tab === 'supplies' && (
        <section className="supplies-grid" aria-label="物资库存与市集采购">
          {supplyItems.map(({ key, name, unitCost, batch, desc, Icon }) => {
            const totalCost = unitCost * batch;
            return (
              <article key={key} className="paper-note tone-ivory" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="card-head" style={{ marginBottom: 2 }}>
                  <h3><Icon size={14} />{name}</h3>
                  <span className="wax-pill amber" style={{ fontFamily: 'var(--font-data)' }}>库存 {state.supplies[key]}</span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{desc}</p>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: 'var(--ink-muted)' }}>单价 {unitCost} 金</small>
                  <button
                    id={`buy-supply-${key}`}
                    type="button"
                    className="btn sm primary"
                    disabled={state.gold < totalCost}
                    onClick={() => onBuySupply(key, batch, totalCost)}
                  >
                    <Coins size={11} />补货 +{batch} ({totalCost} 金)
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'menagerie' && (
        <section className="paper-note tone-kraft pinned" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} aria-label="奇幻生物兽笼培养名录">
          <div className="card-head">
            <h2><PawPrint size={15} />奇幻兽笼与性格特性培养名录</h2>
            <small>占用 {usedCageSlots(state)} / {state.caravan.maxCageSlots} 格兽笼 · 点击查看立绘、属性克制与进阶分支</small>
          </div>
          <div className="cards-grid">
            {state.beasts.map(beast => {
              const species = findBeastSpecies(beast.speciesId);
              const el = species ? getElementProfile(species.element) : undefined;
              const nature = findCreatureNature(beast.natureId);
              const ability = findCreatureAbility(beast.abilityId);
              return (
                <button
                  key={beast.id}
                  id={`open-beast-${beast.id}`}
                  type="button"
                  className="crew-tile paper-note tone-ivory"
                  style={{ flexDirection: 'column', gap: 7 }}
                  onClick={() => onSelectBeast(beast)}
                >
                  <div style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'center' }}>
                    {species && <CreaturePortrait species={species} size={48} />}
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 13.5 }}>{beast.nickname}</strong>
                        {el && (
                          <span className="wax-pill" style={{ background: el.bg, color: el.color, borderColor: el.color }}>
                            {el.label}
                          </span>
                        )}
                      </div>
                      <small style={{ color: 'var(--ink-muted)', display: 'block' }}>
                        {species?.name ?? beast.speciesId} · 性格:{nature.name} · 特性:{ability.name}
                      </small>
                    </div>
                  </div>
                  <div className="stat-grid-2" style={{ width: '100%' }}>
                    <div className="metric-box"><small>观赏度 / 战力</small><b>{beast.appeal} / {beast.combatPower}</b></div>
                    <div className="metric-box"><small>驯服 / 饱食</small><b>{beast.tameness}% / {beast.hunger}%</b></div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'contracts' && (
        <section className="two-col-grid" aria-label="货运与载人契约面板">
          <div className="paper-note tone-ivory">
            <div className="card-head">
              <h3><Truck size={14} />货舱契约 ({usedWeight(state)}/{state.caravan.maxWeight} 载重)</h3>
              <button
                id="freight-preview-btn"
                type="button"
                className="btn sm"
                onClick={() => onNotify('前端原型提示：货运委托会在侦查城市或村庄后按地区物价自动刷新。')}
              >
                查看可接货单
              </button>
            </div>
            <div className="poi-row">
              <div className="poi-row-info">
                <b>示例货单 · 密封晶石药剂箱（易碎）</b>
                <small>占重 24 · 运费 420 金 · 提示：经过沼泽路段会大幅增加破损赔付风险</small>
              </div>
              <span className="wax-pill amber">原型预览</span>
            </div>
          </div>

          <div className="paper-note tone-sage">
            <div className="card-head">
              <h3><Users size={14} />客车厢搭客 ({usedSeats(state)}/{state.caravan.maxSeats} 席位)</h3>
              <button
                id="passenger-preview-btn"
                type="button"
                className="btn sm"
                onClick={() => onNotify('前端原型提示：可将卡库中的角色卡指派为付费搭客，途中触发篝火夜谈事件。')}
              >
                检索待搭旅客
              </button>
            </div>
            <div className="poi-row">
              <div className="poi-row-info">
                <b>示例旅客 · 落难绘师（占 1 席位）</b>
                <small>报酬 280 金 + 解锁邻区河道渡口传闻 · 每日消耗 1 份干粮</small>
              </div>
              <span className="wax-pill forest">原型预览</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
