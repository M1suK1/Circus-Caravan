import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCardJson } from '../src/engine/cardCodec.ts';
import { cardToPerformer, cardToWorldNpc, performerToCard } from '../src/domain/cardAdapter.ts';
import type { GirlCard } from '../src/types.ts';

function sampleNightSugarCard(): GirlCard {
  return {
    format: 'night-sugar/girl-card',
    version: 1,
    exportedAt: '2026-11-10T00:00:00.000Z',
    sourceDay: 14,
    girl: {
      name: '柯萝斯',
      codename: '长耳哨兵',
      title: '偷懒的侦察手',
      element: '星光系',
      color: '#f49abd',
      quote: '只要长椅还能晒到太阳，去哪巡演都行。',
      goal: '找一张不被战火打扰的长椅。',
      appearance: '长兽耳、灰风衣',
      personality: '表面散漫，关键时刻极敏锐。',
      outfitDescription: '旅行灰风衣配铃铛挂饰',
      level: 4,
      stats: { magic: 62, insight: 92, agility: 88, empathy: 68 },
      skillIds: ['glimmer-spear', 'peach-ward', 'starlight-fall'],
      traitIds: ['sharp-ear'],
      traits: [{ id: 'sharp-ear', name: '听风辨位', polarity: 'positive', tags: ['侦察'], description: '能隔着迷雾听见车辙。' }],
      voice: { tone: '懒洋洋带半拍停顿', habits: ['总把外套披在肩上'], samples: ['别催啦，前面路口在打仗呢。'] },
      portrait: 'data:image/png;base64,AAAA',
      wardrobe: [
        { id: 'stage-1', name: '星光戏服', description: '夜场缀满碎亮片', palette: ['#f49abd'], portrait: 'data:image/png;base64,BBBB' },
      ],
      outfitId: 'stage-1',
      expression: 'smile',
      importedVariants: { 'stage-1:angry': 'data:image/png;base64,CCCC' },
      factionTag: 'government',
    },
  };
}

test('s1 角色卡编解码器兼容 night-sugar/girl-card 与 circus-caravan/card', () => {
  const raw = JSON.stringify(sampleNightSugarCard());
  const parsed = parseCardJson(raw);
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.message);
  if (!parsed.ok) return;
  assert.equal(parsed.card.girl.name, '柯萝斯');
  assert.equal(parsed.card.girl.voice?.tone, '懒洋洋带半拍停顿');
  assert.equal(parsed.card.girl.wardrobe?.length, 1);
  assert.equal(parsed.card.girl.importedVariants?.['stage-1:angry'], 'data:image/png;base64,CCCC');
});

test('s1 一卡双用：同一张角色卡既能转为马戏演员 Performer，也能转为城镇 NPC', () => {
  const card = sampleNightSugarCard();

  const performer = cardToPerformer(card, { day: 3 });
  assert.equal(performer.name, '柯萝斯');
  assert.equal(performer.role, 'scout', '洞察 92 敏捷 88 默认适配为侦察斥候');
  assert.equal(performer.portrait, 'data:image/png;base64,AAAA');
  assert.equal(performer.wardrobe[0]?.portrait, 'data:image/png;base64,BBBB');
  assert.equal(performer.importedVariants?.['stage-1:angry'], 'data:image/png;base64,CCCC');
  assert.equal(performer.voice?.samples[0], '别催啦，前面路口在打仗呢。');
  assert.ok(performer.cardHash, '应记录卡库 hash 以便溯源');

  const npc = cardToWorldNpc(card, { regionId: 'empire_heart', poiId: 'poi-1', occupation: 'mayor', faction: 'human_empire' });
  assert.equal(npc.name, '柯萝斯');
  assert.equal(npc.occupation, 'mayor');
  assert.equal(npc.regionId, 'empire_heart');
  assert.equal(npc.poiId, 'poi-1');
  assert.equal(npc.portrait, 'data:image/png;base64,AAAA');
});

test('s1 团内演员可无损反向打包为角色卡 GirlCard', () => {
  const card = sampleNightSugarCard();
  const performer = cardToPerformer(card, { day: 5, role: 'acrobat' });
  const exported = performerToCard(performer, { day: 12 });
  assert.equal(exported.format, 'circus-caravan/card');
  assert.equal(exported.girl.name, '柯萝斯');
  assert.equal(exported.girl.roleHint, 'acrobat');
  assert.equal(exported.girl.portrait, 'data:image/png;base64,AAAA');
  assert.equal(exported.girl.wardrobe?.length, 1);
  const reParsed = parseCardJson(JSON.stringify(exported));
  assert.equal(reParsed.ok, true);
});
