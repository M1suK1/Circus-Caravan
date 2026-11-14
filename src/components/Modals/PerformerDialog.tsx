import { useMemo, useState } from 'react';
import {
  Angry,
  BatteryMedium,
  Clapperboard,
  Compass,
  Download,
  Feather,
  Flame,
  Frown,
  Heart,
  ImagePlus,
  Meh,
  MessageCircle,
  Send,
  Smile,
  Sparkles,
  Star,
  User,
  X,
} from 'lucide-react';
import { CIRCUS_ROLE_LABELS, performerToCard } from '../../domain/cardAdapter.ts';
import { cardboxAdd, loadCardBox } from '../../engine/cardbox.ts';
import { EXPRESSIONS, EXPRESSION_META } from '../../engine/expressions.ts';
import { safeOptimizedImageDataUrl } from '../../engine/image.ts';
import { callNarrativeLlm } from '../../engine/llmService.ts';
import { VnReader } from '../../engine/vn/VnReader.tsx';
import type { VnBeat } from '../../engine/vn/types.ts';
import type { Expression, Performer, RegionId, StatKey } from '../../types.ts';
import { GirlPortrait } from '../GirlPortrait.tsx';

type DossierTabId = 'overview' | 'ability' | 'appearance' | 'campfire';

const DOSSIER_TABS: { id: DossierTabId; label: string }[] = [
  { id: 'overview', label: '状态概览' },
  { id: 'ability', label: '演出技艺' },
  { id: 'appearance', label: '外貌神情' },
  { id: 'campfire', label: '篝火夜谈' },
];

const STAT_LABELS: Record<StatKey, string> = {
  magic: '奇幻戏法',
  insight: '洞察测绘',
  agility: '身法杂技',
  empathy: '舞台共情',
};

const EXPRESSION_ICONS = {
  calm: Meh,
  smile: Smile,
  surprise: Sparkles,
  sad: Frown,
  angry: Angry,
  shy: Heart,
} as const;

const ROLE_SPECIALTY_DESC: Record<Performer['role'], string> = {
  acrobat: '高空火圈与软索翻跃主力，大幅抬升城镇夜演开场惊艳度。',
  tamer: '通晓奇幻生物习性，喂养驯服与奇兽压轴演出时提供额外亲和加成。',
  illusionist: '擅长魔导晶石光影幻象，在魔法都市与废墟聚落极受追捧。',
  clown: '以荒诞滑稽抚平战乱阴霾，显著放大演出后的聚落希望值恢复。',
  bard: '传唱旧纪元歌谣与商路轶闻，更容易在酒馆套出邻区秘闻线索。',
  scout: '熟悉荒原暗哨与断桥地形，降低战区潜行盘查与迷雾侦查风险。',
};

function bondStageLabel(bond: number): string {
  if (bond >= 80) return '生死相托';
  if (bond >= 55) return '篝火知己';
  if (bond >= 30) return '默契同路';
  return '初登篷车';
}

export function PerformerDialog({
  performer,
  day,
  regionId = 'empire_heart',
  regionName,
  onClose,
  onChangeExpression,
  onChangePortrait,
  onNotify,
}: {
  performer: Performer;
  day: number;
  regionId?: RegionId;
  regionName: string;
  onClose: () => void;
  onChangeExpression: (performerId: string, exp: Expression) => void;
  onChangePortrait: (performerId: string, portraitDataUrl: string) => void;
  onNotify: (msg: string, warn?: boolean) => void;
}) {
  const [tab, setTab] = useState<DossierTabId>('overview');
  const [campfireMode, setCampfireMode] = useState<'chat' | 'vn'>('chat');
  const [draft, setDraft] = useState('');
  const [busyReply, setBusyReply] = useState(false);
  const [messages, setMessages] = useState<{ role: 'player' | 'npc'; text: string }[]>([
    {
      role: 'npc',
      text: performer.quote ?? `外面的风沙又大起来了，不过只要风灯还在，${regionName}的观众就不会白等一场戏。`,
    },
  ]);

  const sendLine = (text: string) => {
    const clean = text.trim();
    if (!clean || busyReply) return;
    setMessages(prev => [...prev, { role: 'player', text: clean }]);
    setDraft('');
    setBusyReply(true);
    const fallbackReply = `（她拨了拨衣领上的铜扣，神情转向${EXPRESSION_META[performer.expression].label}）“${clean}……放心吧，${performer.goal}”`;
    void callNarrativeLlm<string>({
      scope: 'campfire',
      regionId,
      keywords: [performer.name, regionName, performer.role],
      parseJson: false,
      userPrompt: `角色：${performer.name}（${performer.title}，性格：${performer.personality}，目标：${performer.goal}，当前地区：${regionName}，第${day}日，羁绊：${performer.bond}）。团长对她说：「${clean}」。请直接以她的第一人称回一句 40-90 字的夜谈台词（可带括号动作）。`,
      fallback: () => fallbackReply,
    }).then(res => {
      const replyText = typeof res.data === 'string' && res.data.trim() ? res.data.trim() : fallbackReply;
      setMessages(prev => [...prev, { role: 'npc', text: replyText }]);
      setBusyReply(false);
    });
  };

  const handleSaveToCardbox = async () => {
    const card = performerToCard(performer, { day });
    const existing = await loadCardBox();
    const res = await cardboxAdd([{ name: `${performer.name}.circus-card.json`, text: JSON.stringify(card) }], existing);
    if (res.added.length > 0) {
      onNotify(`已将养成后的「${performer.name}」回存至巡游契约卡匣，可供其他存档继续复用！`);
    } else if (res.duplicates.length > 0) {
      onNotify(`卡匣中已存在「${performer.name}」完全相同的当前快照。`);
    } else {
      onNotify(res.failed[0]?.message ?? '回存卡匣失败。', true);
    }
  };

  const handleExportCard = () => {
    const card = performerToCard(performer, { day });
    const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${performer.name}.circus-card.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`已导出「${performer.name}」的角色卡 JSON 文件。`);
  };

  const handlePortraitUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onNotify('请选择 PNG / WebP / JPEG 格式的立绘图片。', true);
      return;
    }
    const dataUrl = await safeOptimizedImageDataUrl(file);
    if (!dataUrl.startsWith('data:image/')) {
      onNotify('立绘读取失败，请换一张图片重试。', true);
      return;
    }
    onChangePortrait(performer.id, dataUrl);
  };

  const vnBeats: VnBeat[] = useMemo(() => [
    { kind: 'bg', backdrop: { id: 'camp_fire' } },
    { kind: 'scene', title: `${regionName} · 篝火夜谈` },
    { kind: 'say', speakerId: 'narrator', name: '旁白', text: `暮色落进大篷车营地，铜灯盏在风里轻晃。${performer.name}坐在篷布舞台阶梯边擦拭道具。`, segment: 0 },
    { kind: 'say', speakerId: performer.id, name: performer.name, text: messages[messages.length - 1]?.text ?? '今晚的观众肯定会记住那道火焰弧线。', expression: performer.expression, segment: 0 },
    { kind: 'end' },
  ], [performer, regionName, messages]);

  const hpPct = Math.max(0, Math.min(100, Math.round((performer.hp / Math.max(1, performer.maxHp)) * 100)));

  return (
    <div id="performer-modal-backdrop" className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="performer-modal-title">
      <div className="character-dossier-modal">
        <div className="character-dossier" style={{ '--girl-color': performer.color } as React.CSSProperties}>
          {/* 左栏 38%：night-sugar-office 同构全高全身立绘舞台 */}
          <div className="dossier-art">
            <span className="dossier-art-code">
              巡演契约档案<br />
              <b>{performer.codename}</b>
            </span>
            <div className="portrait-orbit" aria-hidden="true" />
            <div className="dossier-full-figure">
              <GirlPortrait girl={performer} variant="full" bare />
            </div>
            <span className="dossier-seal" aria-hidden="true">
              <Star size={17} />
              <span>残响<br />巡演</span>
            </span>
            <label htmlFor="dossier-portrait-upload" className="dossier-art-upload" title="导入本地 PNG/WebP 替换全身立绘">
              <ImagePlus size={12} />替换立绘
              <input
                id="dossier-portrait-upload"
                type="file"
                accept="image/*"
                hidden
                onChange={e => void handlePortraitUpload(e.target.files?.[0])}
              />
            </label>
            <span className="dossier-art-bottom">每一盏风灯下，都有不肯熄灭的掌声。</span>
          </div>

          {/* 右栏 62%：结构化角色详情与多标签档案 */}
          <div className="dossier-content">
            <div className="dossier-top-row">
              <span className="modal-eyebrow">随行艺人档案 / {performer.element} · {CIRCUS_ROLE_LABELS[performer.role]}</span>
              <button
                id="performer-modal-close"
                type="button"
                className="dossier-close-btn"
                aria-label="关闭成员档案"
                onClick={onClose}
              >
                <X size={16} />
              </button>
            </div>

            <div className="dossier-name">
              <h2 id="performer-modal-title">{performer.name}</h2>
              <span>Lv.{performer.level.toString().padStart(2, '0')}</span>
              <button
                id="performer-save-cardbox-btn"
                type="button"
                className="dossier-export"
                title="将当前养成后的角色快照保存到独立卡匣，供未来存档跨局复用"
                onClick={() => void handleSaveToCardbox()}
              >
                <Sparkles size={13} />回存卡匣
              </button>
              <button
                id="performer-export-card"
                type="button"
                className="dossier-export"
                title="把这位马戏团成员导出为可复用的角色卡 JSON"
                onClick={handleExportCard}
              >
                <Download size={13} />导出卡片
              </button>
            </div>

            <div className="dossier-codename">
              <span>{performer.codename}</span>
              <span className="dossier-pill">{performer.title}</span>
              <span className="dossier-wage">日薪 {performer.wagePerDay} 金</span>
            </div>

            <div className="dossier-affiliations">
              <span>微光风灯马戏团</span>
              <span aria-hidden="true">/</span>
              <span><Feather size={11} />当前随车驻扎 · {regionName}</span>
            </div>

            <div className="dossier-tabs" role="tablist" aria-label="演员档案分页">
              {DOSSIER_TABS.map((t, index) => (
                <button
                  key={t.id}
                  id={`dossier-tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  aria-controls="dossier-tab-content"
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={e => {
                    let next = index;
                    if (e.key === 'ArrowRight') next = (index + 1) % DOSSIER_TABS.length;
                    else if (e.key === 'ArrowLeft') next = (index + DOSSIER_TABS.length - 1) % DOSSIER_TABS.length;
                    else if (e.key === 'Home') next = 0;
                    else if (e.key === 'End') next = DOSSIER_TABS.length - 1;
                    else return;
                    e.preventDefault();
                    setTab(DOSSIER_TABS[next]!.id);
                    document.getElementById(`dossier-tab-${DOSSIER_TABS[next]!.id}`)?.focus();
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div id="dossier-tab-content" className="dossier-tab-body" role="tabpanel" aria-labelledby={`dossier-tab-${tab}`}>
              {tab === 'overview' && (
                <>
                  <div className="dossier-identity">
                    <span>
                      <small>剧团职司</small>
                      <b>{CIRCUS_ROLE_LABELS[performer.role]}</b>
                    </span>
                    <span>
                      <small>元素流派</small>
                      <b>{performer.element}</b>
                    </span>
                  </div>

                  <div className="dossier-meter hp">
                    <div>
                      <Heart size={13} />
                      <span>体力状态</span>
                      <b>{performer.hp}<small> / {performer.maxHp}</small></b>
                    </div>
                    <i><b style={{ width: `${hpPct}%` }} /></i>
                  </div>

                  <div className="dossier-meter spirit">
                    <div>
                      <Sparkles size={13} />
                      <span>演出士气</span>
                      <b>{performer.morale}<small> / 100</small></b>
                    </div>
                    <i><b style={{ width: `${performer.morale}%` }} /></i>
                  </div>

                  <div className="dossier-meter fatigue">
                    <div>
                      <BatteryMedium size={13} />
                      <span>旅途疲劳</span>
                      <b>{performer.fatigue}<small> / 100</small></b>
                    </div>
                    <i><b style={{ width: `${performer.fatigue}%` }} /></i>
                  </div>

                  <div className="bond-emblem">
                    <Flame size={22} />
                    <div>
                      <small>团长信赖度 · {bondStageLabel(performer.bond)}</small>
                      <strong>{performer.bond}<span>/ 100</span></strong>
                    </div>
                  </div>

                  {performer.traits.length > 0 && (
                    <div className="dossier-trait-row">
                      {performer.traits.map(tr => (
                        <span key={tr.id} className="dossier-trait-chip" title={tr.description}>
                          <b>{tr.name}</b> · {tr.description}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="dossier-description">
                    {performer.personality}
                    <br />
                    <span className="dossier-goal-line">终局心愿：{performer.goal}</span>
                  </p>

                  <div className="dossier-location-note">
                    <Compass size={13} />
                    <span>随行风灯客车厢 · 当前随队巡游于「{regionName}」</span>
                  </div>
                </>
              )}

              {tab === 'ability' && (
                <>
                  <div className="dossier-sec-head">
                    <h3>舞台四维能力</h3>
                    <small>影响巡演票房、斥候探路与奇兽亲和</small>
                  </div>
                  <div className="stat-bars">
                    {(Object.keys(STAT_LABELS) as StatKey[]).map(key => {
                      const val = performer.stats[key];
                      const pct = Math.max(0, Math.min(100, val));
                      return (
                        <div key={key}>
                          <span>{STAT_LABELS[key]}</span>
                          <i><b style={{ width: `${pct}%` }} /></i>
                          <strong>{val}</strong>
                        </div>
                      );
                    })}
                  </div>

                  <div className="dossier-sec-head" style={{ marginTop: 18 }}>
                    <h3>职司专精与拿手剧目</h3>
                    <small>{CIRCUS_ROLE_LABELS[performer.role]}</small>
                  </div>
                  <article className="dossier-skill-card">
                    <div>
                      <small>剧团常驻职责</small>
                      <h4>{performer.title}</h4>
                      <p>{ROLE_SPECIALTY_DESC[performer.role]}</p>
                    </div>
                  </article>

                  {performer.skillIds.length > 0 && (
                    <div className="dossier-trait-row" style={{ marginTop: 10 }}>
                      {performer.skillIds.map(sid => (
                        <span key={sid} className="dossier-trait-chip">保留剧目代号：<b>{sid}</b></span>
                      ))}
                    </div>
                  )}
                </>
              )}

              {tab === 'appearance' && (
                <>
                  <div className="dossier-sec-head">
                    <h3>神情差分切换</h3>
                    <small>点击立即同步左侧全身立绘神态</small>
                  </div>
                  <div className="dossier-expression-grid">
                    {EXPRESSIONS.map(exp => {
                      const Icon = EXPRESSION_ICONS[exp];
                      const meta = EXPRESSION_META[exp];
                      const picked = performer.expression === exp;
                      return (
                        <button
                          key={exp}
                          id={`perf-exp-${exp}`}
                          type="button"
                          aria-pressed={picked}
                          className={`dossier-exp-tile ${picked ? 'picked' : ''}`}
                          onClick={() => onChangeExpression(performer.id, exp)}
                        >
                          <Icon size={14} />
                          <div>
                            <b>{meta.label}</b>
                            <small>{meta.note}</small>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="dossier-sec-head" style={{ marginTop: 16 }}>
                    <h3>人物外貌与巡演戏服</h3>
                    <label htmlFor="dossier-portrait-upload-inline" className="dossier-inline-upload">
                      <ImagePlus size={12} />上传全身立绘图片
                      <input
                        id="dossier-portrait-upload-inline"
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={e => void handlePortraitUpload(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                  <div className="dossier-desc-cards">
                    <div>
                      <small>灯下外貌特征</small>
                      <p>{performer.appearance || '尚未记录详细外貌特征。'}</p>
                    </div>
                    <div>
                      <small>当前穿着戏服</small>
                      <p>{performer.outfitDescription || '轻便巡演常服。'}</p>
                    </div>
                  </div>
                </>
              )}

              {tab === 'campfire' && (
                <>
                  <div className="dossier-sec-head">
                    <h3>营地篝火夜谈</h3>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        id="perf-tab-dialogue"
                        type="button"
                        className={`dossier-submode-btn ${campfireMode === 'chat' ? 'active' : ''}`}
                        onClick={() => setCampfireMode('chat')}
                      >
                        <MessageCircle size={12} />对话窗
                      </button>
                      <button
                        id="perf-tab-vn"
                        type="button"
                        className={`dossier-submode-btn ${campfireMode === 'vn' ? 'active' : ''}`}
                        onClick={() => setCampfireMode('vn')}
                      >
                        <Clapperboard size={12} />VN 舞台短幕
                      </button>
                    </div>
                  </div>

                  {campfireMode === 'chat' ? (
                    <div className="dossier-chat-box">
                      <div className="dossier-chat-log">
                        {messages.map((m, i) => (
                          <div key={i} className={`dossier-chat-msg ${m.role}`}>
                            <span className="dossier-chat-speaker">
                              {m.role === 'player' ? <><User size={10} />团长</> : <><Sparkles size={10} />{performer.name}</>}
                            </span>
                            <p>{m.text}</p>
                          </div>
                        ))}
                      </div>
                      <div className="dossier-chat-prompts">
                        {['今晚的路线稳妥吗？', '大家士气怎么样？', '再跟我说说隐居山谷的事'].map((q, idx) => (
                          <button key={idx} id={`perf-quick-${idx}`} type="button" onClick={() => sendLine(q)}>
                            {q}
                          </button>
                        ))}
                      </div>
                      <form
                        className="dossier-chat-form"
                        onSubmit={e => { e.preventDefault(); sendLine(draft); }}
                      >
                        <input
                          id="perf-chat-input"
                          type="text"
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          placeholder={`对${performer.name}说点什么…`}
                        />
                        <button id="perf-chat-send" type="submit">
                          <Send size={13} />发送
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div style={{ minHeight: 280, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(224, 188, 122, 0.3)' }}>
                      <VnReader
                        beats={vnBeats}
                        cast={[{ id: performer.id, name: performer.name, girl: performer }]}
                        title={`${performer.name} · 营地短幕`}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
