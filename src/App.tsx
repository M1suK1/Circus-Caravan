import { useMemo, useState } from 'react';
import { Compass, RefreshCw, Save, Sparkles, Upload, Users, Wrench } from 'lucide-react';
import { GirlPortrait } from './components/GirlPortrait.tsx';
import { REGION_IDS } from './content/regions.ts';
import { usedCageSlots, usedSeats, usedWeight, wagonRepairCost, wagonUpgradeCost } from './domain/caravanMath.ts';
import { CIRCUS_ROLE_LABELS } from './domain/cardAdapter.ts';
import { optimizeCardImages, parseCardJson } from './engine/cardCodec.ts';
import { hydrateCircusAssets, slimCircusAssets } from './engine/portraitAssets.ts';
import { kvGet, kvSet } from './engine/store.ts';
import { act } from './rules/act.ts';
import { loadState, SAVE_CURRENT_KEY, serializeState } from './rules/persistence.ts';
import { createInitialState } from './rules/state.ts';
import type { CircusState, GameAction, GirlCard, TerrainType } from './types.ts';

const TERRAIN_GLYPH: Record<TerrainType, string> = {
  boundary: '▪',
  border_gate: '门',
  road: '·',
  wasteland: '',
  forest: '木',
  swamp: '沼',
  mountain: '山',
  water: '水',
  ruin: '墟',
  warzone: '战',
  city: '城',
  village: '村',
};

export function App() {
  const [state, setState] = useState<CircusState>(() => createInitialState());
  const [notice, setNotice] = useState<string>('Stage 1 验证壳就绪：可测试随机出生、程序化地图、侦查占位与跨区懒加载。');
  const [stagedCard, setStagedCard] = useState<GirlCard | null>(null);

  const dispatch = (action: GameAction) => {
    const res = act(state, action);
    setState(res.state);
    if (res.message) setNotice(res.message);
  };

  const region = state.world.regions[state.world.currentRegionId];
  const map = region.map;
  const currentPoi = state.world.currentPoiId && map ? map.pois[state.world.currentPoiId] : undefined;
  const loadedCount = useMemo(
    () => REGION_IDS.filter(id => Boolean(state.world.regions[id].map)).length,
    [state.world.regions],
  );
  const currentTile = map ? map.tiles[state.world.pos.y * map.width + state.world.pos.x] : undefined;
  const activeGate = currentTile?.terrain === 'border_gate' && map
    ? map.gates.find(g => g.x === currentTile.x && g.y === currentTile.y)
    : undefined;

  const saveGame = async () => {
    const slimmed = await slimCircusAssets(state);
    await kvSet(SAVE_CURRENT_KEY, serializeState(slimmed));
    setNotice('已分片保存当前进度至本地/IndexedDB（circus-caravan 独立空间）。');
  };

  const loadGame = async () => {
    const raw = await kvGet<string>(SAVE_CURRENT_KEY);
    if (!raw) { setNotice('还没有本地存档。'); return; }
    const hydrated = await hydrateCircusAssets(loadState(raw));
    setState(hydrated);
    setNotice('已读取最近一次分片存档。');
  };

  const handleCardFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCardJson(text);
    if (!parsed.ok) { setNotice(parsed.message); return; }
    const slim = await optimizeCardImages(parsed.card);
    setStagedCard(slim);
    setNotice(`已读取角色卡「${slim.girl.name}」，可选择入团或派往聚落。`);
  };

  return (
    <main className="cc-shell">
      <header className="cc-topbar">
        <div className="cc-brand">
          <h1>{state.caravan.name}</h1>
          <small>第 {state.day} 日 · 当前区域：{region.name}（已加载 {loadedCount}/9 区）</small>
        </div>
        <div className="cc-metrics">
          <span>金币<b>{state.gold.toLocaleString()} / {state.retirement.targetGold.toLocaleString()}</b></span>
          <span>口粮<b>{state.supplies.rations}</b></span>
          <span>兽料<b>{state.supplies.fodder}</b></span>
          <span>灯油<b>{state.supplies.fuel}</b></span>
          <span>载重<b>{usedWeight(state)}/{state.caravan.maxWeight}</b></span>
          <span>席位<b>{usedSeats(state)}/{state.caravan.maxSeats}</b></span>
          <span>兽笼<b>{usedCageSlots(state)}/{state.caravan.maxCageSlots}</b></span>
        </div>
        <div className="cc-actions">
          <button type="button" className="cc-btn" onClick={() => dispatch({ type: 'newGame', seed: Math.floor(Math.random() * 999_999) + 1 })}>
            <RefreshCw size={13} />随机出生重开
          </button>
          <button type="button" className="cc-btn" onClick={() => void saveGame()}><Save size={13} />保存</button>
          <button type="button" className="cc-btn" onClick={() => void loadGame()}>读档</button>
        </div>
      </header>

      <div className="cc-notice">{notice}</div>

      <section className="cc-grid">
        <div className="cc-panel">
          <div className="cc-panel-head">
            <h2><Compass size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{region.name} · {region.subtitle}</h2>
            <small>{region.theme}</small>
          </div>

          {map && (
            <div className="cc-map-grid" role="grid" aria-label="区域程序化小地图">
              {map.tiles.map(tile => {
                const here = state.world.pos.x === tile.x && state.world.pos.y === tile.y;
                const fogCls = tile.fog === 'unseen' ? 'fog-unseen' : '';
                const label = here ? '车' : (tile.fog === 'unseen' ? '' : TERRAIN_GLYPH[tile.terrain]);
                return (
                  <button
                    key={`${tile.x}-${tile.y}`}
                    type="button"
                    className={`cc-tile t-${tile.terrain} ${fogCls} ${here ? 'is-here' : ''}`}
                    title={`(${tile.x},${tile.y}) ${tile.terrain}${tile.gateToRegionId ? ` → ${state.world.regions[tile.gateToRegionId].name}` : ''}`}
                    onClick={() => dispatch({ type: 'moveInRegion', x: tile.x, y: tile.y })}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {activeGate && (
            <div className="cc-poi-box">
              <strong>抵达边界出境口：</strong>通往 <b>{state.world.regions[activeGate.targetRegionId].name}</b>
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="cc-btn primary"
                  onClick={() => dispatch({ type: 'crossBorder', direction: activeGate.direction })}
                >
                  出境并懒加载「{state.world.regions[activeGate.targetRegionId].name}」小地图
                </button>
              </div>
            </div>
          )}

          <div className="cc-poi-box">
            {currentPoi ? (
              currentPoi.scouted && currentPoi.details ? (
                <>
                  <strong>{currentPoi.details.name}</strong>（{currentPoi.kind === 'city' ? '城市' : '村庄'} · 希望值 {currentPoi.details.hope}）
                  <div>{currentPoi.details.summary}</div>
                  <small style={{ color: '#a69ba8' }}>市场特征：{currentPoi.details.marketTraits.join('、')}</small>
                </>
              ) : (
                <>
                  <strong>{currentPoi.placeholderName}</strong>（尚未侦查，仅知位置）
                  <div style={{ marginTop: 6 }}>
                    <button type="button" className="cc-btn primary" onClick={() => dispatch({ type: 'scoutSettlement', poiId: currentPoi.id })}>
                      <Sparkles size={13} />侦查此地并生成详情
                    </button>
                  </div>
                </>
              )
            ) : (
              <span>当前位于荒野/道路 ({state.world.pos.x}, {state.world.pos.y})。点击地图上的「城 / 村 / 门」移动并测试侦查或出境懒加载。</span>
            )}
          </div>
        </div>

        <div className="cc-panel">
          <div className="cc-panel-head">
            <h2><Wrench size={14} style={{ verticalAlign: -2, marginRight: 6 }} />大篷车车厢与成员</h2>
            <small>Stage 1 骨架校验面板</small>
          </div>
          <div className="cc-list">
            {state.caravan.wagons.map(wagon => (
              <div key={wagon.id} className="cc-row">
                <div>
                  <b>{wagon.name}</b> <small style={{ color: '#a69ba8' }}>Lv.{wagon.level} · 耐久 {wagon.durability}/{wagon.maxDurability}</small>
                </div>
                <div className="cc-actions">
                  <button type="button" className="cc-btn" disabled={wagon.durability >= wagon.maxDurability} onClick={() => dispatch({ type: 'repairWagon', wagonId: wagon.id })}>
                    修({wagonRepairCost(wagon)})
                  </button>
                  <button type="button" className="cc-btn" disabled={wagon.level >= 5} onClick={() => dispatch({ type: 'upgradeWagon', wagonId: wagon.id })}>
                    升({wagonUpgradeCost(wagon)})
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cc-panel-head" style={{ marginTop: 6 }}>
            <h2><Users size={14} style={{ verticalAlign: -2, marginRight: 6 }} />演员与角色卡双栖测试</h2>
            <small>团员 {state.performers.length} · 世界 NPC {state.worldNpcs.length}</small>
          </div>
          <div className="cc-list">
            {state.performers.map(perf => (
              <div key={perf.id} className="cc-crew-card">
                <div className="cc-crew-face"><GirlPortrait girl={perf} variant="avatar" /></div>
                <div className="cc-crew-info">
                  <b>{perf.name} · {CIRCUS_ROLE_LABELS[perf.role]}</b>
                  <small>Lv.{perf.level} · 日薪 {perf.wagePerDay} · {perf.title}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="cc-poi-box">
            <label className="cc-btn" style={{ marginBottom: 8 }}>
              <Upload size={13} />导入夜糖 / 通用角色卡 (.json)
              <input type="file" accept=".json" hidden onChange={e => void handleCardFile(e.target.files?.[0])} />
            </label>
            {stagedCard && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>已装载：<b>{stagedCard.girl.name}</b>（{stagedCard.girl.title}）</span>
                <div className="cc-actions">
                  <button type="button" className="cc-btn primary" onClick={() => dispatch({ type: 'importCardAsPerformer', card: stagedCard })}>
                    作为演员登车
                  </button>
                  <button type="button" className="cc-btn" disabled={!currentPoi?.scouted} onClick={() => currentPoi && dispatch({ type: 'placeCardAsNpc', card: stagedCard, poiId: currentPoi.id })}>
                    驻守当前聚落 NPC
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
