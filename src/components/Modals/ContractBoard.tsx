import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Gavel, Package, Truck, Users } from 'lucide-react';
import { REGION_CATALOG } from '../../content/regions.ts';
import { findBeastSpecies } from '../../content/species.ts';
import { computeAuctionQuote } from '../../domain/auction.ts';
import { usedSeats, usedWeight } from '../../domain/caravanMath.ts';
import {
  describeDestinationPoi,
  generateFreightOffers,
  generatePassengerOffers,
  isAtContractDestination,
} from '../../domain/contracts.ts';
import type { CircusState, GameAction, SettlementPoi } from '../../types.ts';

export function ContractBoard({
  mode,
  state,
  poi,
  isHere,
  onAction,
}: {
  mode: 'guild' | 'auction';
  state: CircusState;
  poi: SettlementPoi;
  isHere: boolean;
  onAction: (action: GameAction) => void;
}) {
  const [guildTab, setGuildTab] = useState<'freight' | 'passenger' | 'active'>('freight');

  if (mode === 'auction') {
    const regionName = REGION_CATALOG[poi.regionId].name;
    return (
      <div id="auction-market-panel" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div className="contract-warn-banner">
          <AlertTriangle size={13} />
          <span>
            {regionName}拍卖行每日按稀有度与稀缺性浮动 ±15% 报价。售出具有知性的魔物娘虽可快速积累隐居金币，但会重创黎明圣教声望与全团士气。
          </span>
        </div>

        {state.beasts.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--ink-muted)', padding: '12px 0' }}>
            奇幻兽笼当前空空如也。先去荒野捕捉奇兽或魔物娘再来挂牌估价。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 230, overflowY: 'auto' }}>
            {state.beasts.map(beast => {
              const sp = findBeastSpecies(beast.speciesId);
              const quote = computeAuctionQuote(beast, poi.regionId, state.day, state.world.seed);
              return (
                <article key={beast.id} className="poi-row">
                  <div className="poi-row-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <b>{beast.nickname}</b>
                      <span className="wax-pill">{sp?.name ?? beast.speciesId}</span>
                      <span className="wax-pill amber">Lv.{beast.level} · 驯服 {beast.tameness}%</span>
                      {quote.isSentientGirl && <span className="wax-pill crimson">有知性魔物娘</span>}
                    </div>
                    <small>
                      今日成交估价 <b>{quote.price.toLocaleString('zh-CN')} 金</b>
                      （行情 {quote.dailySwingPct >= 0 ? `+${quote.dailySwingPct}%` : `${quote.dailySwingPct}%`}
                      {quote.scarcityBonus > 1 ? ' · 异域稀缺溢价 +24%' : ''}）
                    </small>
                  </div>
                  <button
                    id={`auction-sell-${beast.id}`}
                    type="button"
                    className={`btn sm ${quote.isSentientGirl ? 'danger' : 'primary'}`}
                    disabled={!isHere}
                    onClick={() => onAction({ type: 'sellBeast', beastId: beast.id, poiId: poi.id })}
                  >
                    <Gavel size={12} />{quote.price} 金成交
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const freightOffers = generateFreightOffers(state, poi);
  const passengerOffers = generatePassengerOffers(state, poi);
  const carryingFreight = state.freightOrders.filter(o => o.status === 'carrying');
  const aboardPassengers = state.passengerOrders.filter(o => o.status === 'aboard');
  const curWeight = usedWeight(state);
  const curSeats = usedSeats(state);

  return (
    <div id="guild-contract-board" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div className="contract-cap-meter">
        <span><Package size={12} />载重 <b>{curWeight}/{state.caravan.maxWeight}</b> 担</span>
        <span><Users size={12} />客席 <b>{curSeats}/{state.caravan.maxSeats}</b> 席</span>
        <span><Truck size={12} />在途 <b>{carryingFreight.length + aboardPassengers.length}</b> 项</span>
      </div>

      <div className="contract-tabs" role="tablist">
        <button
          id="guild-tab-freight"
          type="button"
          role="tab"
          aria-selected={guildTab === 'freight'}
          className={`btn sm ${guildTab === 'freight' ? 'primary' : 'ghost'}`}
          onClick={() => setGuildTab('freight')}
        >
          货运挂单 ({freightOffers.length})
        </button>
        <button
          id="guild-tab-passenger"
          type="button"
          role="tab"
          aria-selected={guildTab === 'passenger'}
          className={`btn sm ${guildTab === 'passenger' ? 'primary' : 'ghost'}`}
          onClick={() => setGuildTab('passenger')}
        >
          搭车旅客 ({passengerOffers.length})
        </button>
        <button
          id="guild-tab-active"
          type="button"
          role="tab"
          aria-selected={guildTab === 'active'}
          className={`btn sm ${guildTab === 'active' ? 'primary' : 'ghost'}`}
          onClick={() => setGuildTab('active')}
        >
          在途交割 ({carryingFreight.length + aboardPassengers.length})
        </button>
      </div>

      {guildTab === 'freight' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 205, overflowY: 'auto' }}>
          {freightOffers.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>今日货运挂单已全部承接完毕，明日拂晓会贴出新单。</p>
          ) : freightOffers.map(offer => {
            const overweight = curWeight + offer.weight > state.caravan.maxWeight;
            return (
              <article key={offer.id} className="poi-row">
                <div className="poi-row-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <b>{offer.title}</b>
                    <span className="wax-pill">{offer.weight} 担</span>
                    {offer.fragile && <span className="wax-pill amber">易碎</span>}
                    {offer.contraband && <span className="wax-pill crimson">违禁</span>}
                  </div>
                  <small>
                    送往 {describeDestinationPoi(state, offer.toRegionId, offer.toPoiId)} · 第 {offer.deadlineDay} 日前
                  </small>
                </div>
                <button
                  id={`accept-freight-${offer.id}`}
                  type="button"
                  className="btn sm primary"
                  disabled={!isHere || overweight}
                  title={overweight ? `超载 ${curWeight + offer.weight - state.caravan.maxWeight} 担` : '装车承运'}
                  onClick={() => onAction({ type: 'acceptFreightOrder', orderId: offer.id })}
                >
                  {overweight ? '超载' : `接单 +${offer.rewardGold} 金`}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {guildTab === 'passenger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 205, overflowY: 'auto' }}>
          {passengerOffers.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>驿站今日暂无待乘旅客。</p>
          ) : passengerOffers.map(pax => {
            const full = curSeats + pax.seatsNeeded > state.caravan.maxSeats;
            return (
              <article key={pax.id} className="poi-row">
                <div className="poi-row-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <b>{pax.name}</b>
                    <span className="wax-pill">{pax.seatsNeeded} 席</span>
                  </div>
                  <small>
                    前往 {describeDestinationPoi(state, pax.destRegionId, pax.destPoiId)} · 第 {pax.deadlineDay ?? state.day + 5} 日前
                  </small>
                  {pax.storyHook && <small style={{ color: 'var(--ink-muted)' }}>{pax.storyHook}</small>}
                </div>
                <button
                  id={`accept-passenger-${pax.id}`}
                  type="button"
                  className="btn sm primary"
                  disabled={!isHere || full}
                  onClick={() => onAction({ type: 'acceptPassengerOrder', orderId: pax.id })}
                >
                  {full ? '满座' : `搭载 +${pax.fareGold} 金`}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {guildTab === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 205, overflowY: 'auto' }}>
          {carryingFreight.length === 0 && aboardPassengers.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>当前车队尚未承运任何在途货客。</p>
          ) : (
            <>
              {carryingFreight.map(order => {
                const canDeliver = isHere && isAtContractDestination(state, order.toRegionId, order.toPoiId);
                return (
                  <article key={order.id} className="poi-row">
                    <div className="poi-row-info">
                      <b>[货运] {order.title}</b>
                      <small>目的地：{describeDestinationPoi(state, order.toRegionId, order.toPoiId)} · 截止第 {order.deadlineDay} 日</small>
                    </div>
                    <button
                      id={`deliver-freight-${order.id}`}
                      type="button"
                      className={`btn sm ${canDeliver ? 'primary' : ''}`}
                      disabled={!canDeliver}
                      onClick={() => onAction({ type: 'deliverContract', contractKind: 'freight', orderId: order.id })}
                    >
                      <CheckCircle2 size={12} />{canDeliver ? `交割 +${order.rewardGold} 金` : '未抵终点'}
                    </button>
                  </article>
                );
              })}
              {aboardPassengers.map(pax => {
                const canDeliver = isHere && isAtContractDestination(state, pax.destRegionId, pax.destPoiId);
                return (
                  <article key={pax.id} className="poi-row">
                    <div className="poi-row-info">
                      <b>[旅客] {pax.name}</b>
                      <small>目的地：{describeDestinationPoi(state, pax.destRegionId, pax.destPoiId)} · 截止第 {pax.deadlineDay ?? '-'} 日</small>
                    </div>
                    <button
                      id={`deliver-passenger-${pax.id}`}
                      type="button"
                      className={`btn sm ${canDeliver ? 'primary' : ''}`}
                      disabled={!canDeliver}
                      onClick={() => onAction({ type: 'deliverContract', contractKind: 'passenger', orderId: pax.id })}
                    >
                      <CheckCircle2 size={12} />{canDeliver ? `送达 +${pax.fareGold} 金` : '在途中'}
                    </button>
                  </article>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
