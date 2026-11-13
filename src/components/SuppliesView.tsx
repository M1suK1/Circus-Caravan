import { useState } from 'react';
import {
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
import { findBeastSpecies } from '../content/species.ts';
import { dailyUpkeep, usedCageSlots, usedSeats, usedWeight } from '../domain/caravanMath.ts';
import type { Beast, CircusState } from '../types.ts';

export function SuppliesView({
  state,
  onSelectBeast,
  onBuySupply,
  onNotify,
}: {
  state: CircusState;
  onSelectBeast: (beast: Beast) => void;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="tablist" aria-label="物资模块切换">
        <button id="supplies-tab-stock" type="button" role="tab" aria-selected={tab === 'supplies'} className={`btn ${tab === 'supplies' ? 'primary' : ''}`} onClick={() => setTab('supplies')}>
          <ShoppingBag size={14} />行军辎重与补给市集
        </button>
        <button id="supplies-tab-beasts" type="button" role="tab" aria-selected={tab === 'menagerie'} className={`btn ${tab === 'menagerie' ? 'primary' : ''}`} onClick={() => setTab('menagerie')}>
          <PawPrint size={14} />奇幻兽笼 ({usedCageSlots(state)}/{state.caravan.maxCageSlots} 格)
        </button>
        <button id="supplies-tab-contracts" type="button" role="tab" aria-selected={tab === 'contracts'} className={`btn ${tab === 'contracts' ? 'primary' : ''}`} onClick={() => setTab('contracts')}>
          <Truck size={14} />货运载重与乘客席位
        </button>
      </div>

      {tab === 'supplies' && (
        <section className="cards-grid" aria-label="物资库存与市集采购">
          {supplyItems.map(({ key, name, unitCost, batch, desc, Icon }) => {
            const totalCost = unitCost * batch;
            return (
              <article key={key} className="parchment-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="card-head" style={{ marginBottom: 4 }}>
                  <h3><Icon size={15} />{name}</h3>
                  <span className="wax-pill amber" style={{ fontFamily: 'var(--font-data)' }}>库存 {state.supplies[key]}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-soft)', minHeight: 36 }}>{desc}</p>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: 'var(--ink-muted)' }}>单价 {unitCost} 金</small>
                  <button
                    id={`buy-supply-${key}`}
                    type="button"
                    className="btn sm primary"
                    disabled={state.gold < totalCost}
                    onClick={() => onBuySupply(key, batch, totalCost)}
                  >
                    <Coins size={12} />补货 +{batch} ({totalCost} 金)
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'menagerie' && (
        <section className="parchment-card" aria-label="奇幻生物兽笼培养名录">
          <div className="card-head">
            <h2><PawPrint size={16} />奇幻兽笼与进阶培养名录</h2>
            <small>占用 {usedCageSlots(state)} / {state.caravan.maxCageSlots} 格兽笼 · 点击生物查看多分支进阶与拍卖估值</small>
          </div>
          <div className="cards-grid">
            {state.beasts.map(beast => {
              const species = findBeastSpecies(beast.speciesId);
              return (
                <button
                  key={beast.id}
                  id={`open-beast-${beast.id}`}
                  type="button"
                  className="crew-tile"
                  style={{ flexDirection: 'column', gap: 8 }}
                  onClick={() => onSelectBeast(beast)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <strong style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>{beast.nickname}</strong>
                    <span className="wax-pill crimson">{species?.name ?? beast.speciesId} · {beast.stage} 阶</span>
                  </div>
                  <div className="stat-grid-2" style={{ width: '100%' }}>
                    <div className="metric-box"><small>观赏度 / 战力</small><b>{beast.appeal} / {beast.combatPower}</b></div>
                    <div className="metric-box"><small>驯服 / 饱食</small><b>{beast.tameness}% / {beast.hunger}%</b></div>
                  </div>
                  <small style={{ color: 'var(--amber)' }}>点击进入喂养训练、二阶分支预览与黑市估值</small>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'contracts' && (
        <section className="two-col-grid" aria-label="货运与载人契约面板">
          <div className="parchment-card">
            <div className="card-head">
              <h3><Truck size={15} />货舱契约 ({usedWeight(state)}/{state.caravan.maxWeight} 载重)</h3>
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

          <div className="parchment-card">
            <div className="card-head">
              <h3><Users size={15} />客车厢搭客 ({usedSeats(state)}/{state.caravan.maxSeats} 席位)</h3>
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
