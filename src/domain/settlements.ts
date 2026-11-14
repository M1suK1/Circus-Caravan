/**
 * 城郭与村寨驻地建筑群生成、旅店食宿定价与舞台巡演票房演算（纯函数）。
 */
import type { RegionProfile } from '../content/regions.ts';
import type { CircusState, FactionId, SettlementBuilding, SettlementPoi } from '../types.ts';

export function buildSettlementBuildings(
  poi: SettlementPoi,
  region: Pick<RegionProfile, 'id' | 'name' | 'dominantFaction' | 'dangerTier'>,
): SettlementBuilding[] {
  const faction: FactionId | 'neutral' = poi.details?.ownerFaction ?? region.dominantFaction;
  const isCity = poi.kind === 'city';

  if (!isCity) {
    return [
      {
        id: `${poi.id}-b-tavern`,
        kind: 'tavern',
        name: '风灯小酒馆',
        subtitle: '热汤宿夜 · 打听流民与风闻',
        description: '煤油灯微弱晃动的小木屋，流民、采药人与拾荒者聚集于此交换商路传闻。',
        actionHint: '休整恢复全团体力并降低疲劳',
      },
      {
        id: `${poi.id}-b-store`,
        kind: 'general_store',
        name: '杂货与修铁摊',
        subtitle: '基础口粮 · 兽料与车轴应急',
        description: '堆着腌肉、干草和锈铁轮箍的乡村铺子，可趁停靠补充行军物资。',
        actionHint: '采购干粮、兽料、灯油与零件',
      },
      {
        id: `${poi.id}-b-stage`,
        kind: 'stage_square',
        name: '村心篝火空地',
        subtitle: '乡间夜演 · 点亮希望微光',
        description: '避难村民围坐土坡空地，正盼着一场能让人忘却战乱与饥荒的温暖马戏。',
        actionHint: '就地搭棚献艺赚取金币与希望值',
      },
      ...(faction === 'dawn_order' || region.dangerTier <= 2
        ? [{
            id: `${poi.id}-b-chapel`,
            kind: 'sanctuary_chapel' as const,
            name: '晨曦微光施粥棚',
            subtitle: '废奴救济点 · 干粮接济',
            description: '黎明圣教修女搭建的临时木棚，常暗中收留逃亡魔物娘并救济良善旅团。',
            actionHint: '领取救济口粮或打探安全暗道',
          }]
        : []),
    ];
  }

  const marketLabel = faction === 'rust_syndicate' || region.id === 'demon_realm'
    ? '暗巷黑市拍卖所'
    : '铁轨商会拍卖行';
  const chapelOrWatch: SettlementBuilding = faction === 'dawn_order'
    ? {
        id: `${poi.id}-b-chapel`,
        kind: 'sanctuary_chapel',
        name: '晨曦救赎庇护礼拜堂',
        subtitle: '废奴同盟 · 领粮与庇护',
        description: '救赎教派的石砌礼拜堂，善待魔物娘的马戏团可在此获免费干粮补给。',
        actionHint: '领取圣教救济口粮与庇护情报',
      }
    : {
        id: `${poi.id}-b-chapel`,
        kind: 'sanctuary_chapel',
        name: '城防税卡与通行驿',
        subtitle: '通关文牒 · 契约查验',
        description: '悬着双头铁徽的关卡政务厅，缴纳规费可办理所属势力的合法通行凭证。',
        actionHint: '购置势力通行证免除关卡盘查',
      };

  return [
    {
      id: `${poi.id}-b-stage`,
      kind: 'stage_square',
      name: '城邦圆弧大剧场',
      subtitle: '盛大巡演 · 高额票房与打赏',
      description: '残破却仍保留石阶看台的城邦中心广场，适合搬出压轴奇兽与华丽幻术献演。',
      actionHint: '举办巡回演出赚取高额票房',
    },
    {
      id: `${poi.id}-b-tavern`,
      kind: 'tavern',
      name: '行会旅店与酒肆',
      subtitle: '舒缓休整 · 商路与灾厄见闻',
      description: '砖石砌成的三层老旅店，可让全团洗去泥尘恢复体力，打听城邦暗流。',
      actionHint: '投宿休整恢复体力并消减疲劳',
    },
    {
      id: `${poi.id}-b-workshop`,
      kind: 'workshop_market',
      name: '蒸汽工坊与行商市集',
      subtitle: '全品类辎重 · 捕获网与道具',
      description: '齿轮作响的大型城邦补给库，铁木零件、魔导灯油与麻醉捕获网备货齐全。',
      actionHint: '大宗采买全类行军物资与耗材',
    },
    {
      id: `${poi.id}-b-guild`,
      kind: 'guild_station',
      name: '商会货站与驿站',
      subtitle: '跨区货运 · 付费搭客委托',
      description: '往来商队登记货物与搭车旅人的枢纽站台，串联起废土间的微弱商路。',
      actionHint: '查看驻地货客运行情与邻区风闻',
    },
    {
      id: `${poi.id}-b-auction`,
      kind: 'auction_market',
      name: marketLabel,
      subtitle: '奇兽估价 · 奴隶项圈抉择',
      description: '镀金契约与黑市价签交错的交易大厅，决定着兽笼伙伴的命运与圣教好感。',
      actionHint: '查阅市场奇兽估价与道德影响',
    },
    chapelOrWatch,
  ];
}

export function computeTavernRestCost(state: Pick<CircusState, 'performers'>, isCity: boolean): number {
  return Math.max(30, state.performers.length * (isCity ? 26 : 18));
}

export function computeShowPayout(
  state: Pick<CircusState, 'performers' | 'beasts' | 'caravan' | 'supplies'>,
  poi: SettlementPoi,
  dangerTier: number,
): { revenue: number; tipBonus: number; hopeGain: number; fameGain: number; matchScore: number } {
  const stageLevel = state.caravan.wagons.find(w => w.kind === 'stage')?.level ?? 1;
  const preferred = poi.details?.preferredActs ?? ['acrobatics', 'comedy'];
  const roleToAct: Record<string, string> = {
    acrobat: 'acrobatics',
    tamer: 'beast_tame',
    illusionist: 'illusion',
    clown: 'comedy',
    bard: 'music',
    scout: 'acrobatics',
  };
  let matchCount = 0;
  for (const perf of state.performers) {
    if (preferred.includes(roleToAct[perf.role] as never)) matchCount += 1;
  }
  const beastAppeal = state.beasts.reduce((sum, b) => sum + b.appeal, 0);
  const baseScale = poi.kind === 'city' ? 240 : 145;
  const propBoost = state.supplies.props > 0 ? 1.18 : 1;
  const revenue = Math.round(
    (baseScale + state.performers.length * 48 + stageLevel * 55 + beastAppeal * 1.4) *
      (1 + matchCount * 0.14) *
      propBoost,
  );
  const tipBonus = Math.round(revenue * (0.12 + dangerTier * 0.03));
  const hopeGain = Math.min(18, 6 + matchCount * 3 + Math.floor(beastAppeal / 35));
  const fameGain = poi.kind === 'city' ? 6 : 3;
  return { revenue, tipBonus, hopeGain, fameGain, matchScore: matchCount };
}
