import { useEffect, useState } from 'react';
import { FolderOpen, Sparkles, Trash2, Upload, UserPlus, Users, X } from 'lucide-react';
import { CIRCUS_ROLE_LABELS, hasCardInUse } from '../../domain/cardAdapter.ts';
import { optimizeCardImages, parseCardJson } from '../../engine/cardCodec.ts';
import {
  cardboxAdd,
  cardboxCards,
  cardboxRemove,
  type CardBoxEntry,
  formatByteSize,
  loadCardBox,
  readCardRaw,
} from '../../engine/cardbox.ts';
import { listLocalFiles, readLocalFile } from '../../engine/localfiles.ts';
import type { CircusRole, CircusState, GirlCard } from '../../types.ts';
import { GirlPortrait } from '../GirlPortrait.tsx';

export function CardboxDialog({
  state,
  onImportAsPerformer,
  onPlaceAsNpc,
  onInjectGuests,
  onNotify,
  onClose,
}: {
  state: CircusState;
  onImportAsPerformer: (card: GirlCard, role?: CircusRole) => void;
  onPlaceAsNpc: (card: GirlCard, poiId: string) => void;
  onInjectGuests: (cards: GirlCard[]) => void;
  onNotify: (msg: string, warn?: boolean) => void;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<CardBoxEntry[]>([]);
  const [selectedCard, setSelectedCard] = useState<GirlCard | null>(null);
  const [selectedHash, setSelectedHash] = useState<string>('');
  const [search, setSearch] = useState('');
  const [localFilesCount, setLocalFilesCount] = useState<number | null>(null);

  const refresh = async () => {
    const rows = await loadCardBox();
    setEntries(rows);
  };

  useEffect(() => {
    void refresh();
    void listLocalFiles('card').then(list => {
      if (list) setLocalFilesCount(list.length);
    });
  }, []);

  const handleSelectEntry = async (entry: CardBoxEntry) => {
    setSelectedHash(entry.hash);
    const raw = await readCardRaw(entry.hash);
    if (!raw) {
      onNotify('读取卡面原始数据失败。', true);
      return;
    }
    const parsed = parseCardJson(raw);
    if (parsed.ok) setSelectedCard(parsed.card);
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const inputs: { name: string; text: string }[] = [];
    for (const file of Array.from(files)) {
      const rawText = await file.text();
      const parsed = parseCardJson(rawText);
      if (parsed.ok) {
        const slim = await optimizeCardImages(parsed.card);
        inputs.push({ name: file.name, text: JSON.stringify(slim) });
      } else {
        inputs.push({ name: file.name, text: rawText });
      }
    }
    const res = await cardboxAdd(inputs, entries);
    setEntries(res.entries);
    onNotify(
      `导入完成：新增 ${res.added.length} 张${res.duplicates.length ? `，重复跳过 ${res.duplicates.length} 张` : ''}${res.failed.length ? `，失败 ${res.failed.length} 张` : ''}。`,
      res.added.length === 0 && res.failed.length > 0,
    );
  };

  const handleScanLocalDir = async () => {
    const files = await listLocalFiles('card');
    if (!files?.length) {
      onNotify('本地 data/cards/ 目录暂无角色卡文件。', true);
      return;
    }
    const inputs: { name: string; text: string }[] = [];
    for (const f of files) {
      const text = await readLocalFile('card', f.name);
      if (text) inputs.push({ name: f.name, text });
    }
    const res = await cardboxAdd(inputs, entries);
    setEntries(res.entries);
    onNotify(`已从 data/cards/ 扫描导入 ${res.added.length} 张角色卡。`);
  };

  const handleInjectAllGuests = async () => {
    if (!entries.length) {
      onNotify('卡匣为空，请先导入角色卡。', true);
      return;
    }
    const cards = await cardboxCards(entries.map(e => e.hash));
    onInjectGuests(cards);
  };

  const currentMap = state.world.regions[state.world.currentRegionId].map;
  const targetPoi = state.world.currentPoiId
    ?? (currentMap ? Object.values(currentMap.pois).find(p => p.scouted)?.id : undefined);

  const filtered = entries.filter(e => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || e.element.toLowerCase().includes(q);
  });

  return (
    <div id="cardbox-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cardbox-modal-title">
      <div id="cardbox-modal" className="modal-scroll wide vellum-sheet">
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">GIRL CARD ARCHIVE · 跨存档巡游契约卡匣 ({entries.length}/60)</span>
            <h2 id="cardbox-modal-title">角色卡匣管理与全生态复用中心</h2>
          </div>
          <button id="cardbox-modal-close" type="button" className="icon-btn" aria-label="关闭卡匣" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <label htmlFor="cardbox-upload-input" className="btn sm primary">
            <Upload size={12} />批量导入角色卡 (.json)
            <input
              id="cardbox-upload-input"
              type="file"
              accept=".json"
              multiple
              hidden
              onChange={e => void handleUploadFiles(e.target.files)}
            />
          </label>
          {localFilesCount !== null && (
            <button id="cardbox-scan-local-btn" type="button" className="btn sm" onClick={() => void handleScanLocalDir()}>
              <FolderOpen size={12} />扫描 data/cards ({localFilesCount})
            </button>
          )}
          <button id="cardbox-inject-guests-btn" type="button" className="btn sm" onClick={() => void handleInjectAllGuests()}>
            <Sparkles size={12} />一键客串散落沿途城镇
          </button>
          <input
            id="cardbox-search-input"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="按姓名 / 称号 / 属性筛选…"
            style={{ marginLeft: 'auto', padding: '4px 9px', borderRadius: 4, border: '1px solid var(--umber-strong)', background: '#fffaf0', fontSize: 11.5 }}
          />
        </div>

        <div className="two-col-grid">
          <div className="paper-note tone-ivory" style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                卡匣里还没有角色卡。可导入来自 `night-sugar` 或本游戏导出的 `.json` 卡面，同一张卡可兼任演员、驻地 NPC 或旅途过客。
              </p>
            ) : filtered.map(entry => {
              const inUse = hasCardInUse(state, entry.hash);
              return (
                <button
                  key={entry.hash}
                  id={`cardbox-entry-${entry.hash}`}
                  type="button"
                  className={`poi-row ${selectedHash === entry.hash ? 'active-row' : ''}`}
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => void handleSelectEntry(entry)}
                >
                  <div className="poi-row-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <b>{entry.name}</b>
                      <span className="wax-pill amber">Lv.{entry.level}</span>
                      {inUse && <span className="wax-pill forest">已在本局登场</span>}
                    </div>
                    <small>{entry.title} · {entry.element} · {formatByteSize(entry.bytes)}</small>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="paper-note tone-kraft">
            {selectedCard ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 6, overflow: 'hidden' }}>
                    <GirlPortrait
                      girl={{ ...selectedCard.girl, id: selectedHash, portrait: selectedCard.girl.portrait ?? '' }}
                      variant="avatar"
                    />
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>{selectedCard.girl.name} · {selectedCard.girl.codename}</h3>
                    <small style={{ color: 'var(--ink-soft)' }}>{selectedCard.girl.title} · {selectedCard.girl.element}</small>
                    <p style={{ fontSize: 11.5, margin: '4px 0 0', color: 'var(--ink-soft)' }}>
                      {selectedCard.girl.personality}
                    </p>
                  </div>
                </div>

                <div className="stat-grid-2">
                  <div className="metric-box"><small>奇幻戏法</small><b>{selectedCard.girl.stats.magic}</b></div>
                  <div className="metric-box"><small>洞察测绘</small><b>{selectedCard.girl.stats.insight}</b></div>
                  <div className="metric-box"><small>身法杂技</small><b>{selectedCard.girl.stats.agility}</b></div>
                  <div className="metric-box"><small>舞台共情</small><b>{selectedCard.girl.stats.empathy}</b></div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button
                    id="cardbox-recruit-performer-btn"
                    type="button"
                    className="btn sm primary"
                    onClick={() => onImportAsPerformer(selectedCard, selectedCard.girl.roleHint)}
                  >
                    <UserPlus size={12} />编入马戏团演员（{CIRCUS_ROLE_LABELS[selectedCard.girl.roleHint ?? 'illusionist']}）
                  </button>
                  <button
                    id="cardbox-place-npc-btn"
                    type="button"
                    className="btn sm"
                    disabled={!targetPoi}
                    onClick={() => targetPoi && onPlaceAsNpc(selectedCard, targetPoi)}
                  >
                    <Users size={12} />派驻当前已侦查城镇
                  </button>
                  <button
                    id="cardbox-remove-btn"
                    type="button"
                    className="btn sm danger"
                    onClick={async () => {
                      const kept = await cardboxRemove([selectedHash], entries);
                      setEntries(kept);
                      setSelectedCard(null);
                      setSelectedHash('');
                      onNotify('已将该角色卡移出卡匣。');
                    }}
                  >
                    <Trash2 size={12} />移出卡匣
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                点击左侧任意角色卡预览档案，并决定她在本局以「随行演员」还是「城镇驻地 NPC」身份参与巡游；在随行演员档案中可随时把养成后的角色回存回此卡匣。
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
