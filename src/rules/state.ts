import { createInitialFactions } from '../content/factions.ts';
import { REGION_CATALOG, createInitialMacroRegions } from '../content/regions.ts';
import { computeCaravanCapacity } from '../domain/caravanMath.ts';
import { seedStarterEncounters } from '../domain/encounters.ts';
import {
  fallbackSettlementDetails,
  generateRegionMap,
  surroundingTerrainsOf,
} from '../domain/regionGen.ts';
import { CARAVAN_VISION_RADIUS, revealCircleInMask } from '../domain/routeDraw.ts';
import { computeWorldNeighbors, generateWorldMap, pickRandomSpawnRegion } from '../domain/worldGen.ts';
import type { CircusState, Performer, RecruitCandidate, RegionId, Wagon } from '../types.ts';

function initialWagons(): Wagon[] {
  return [
    { id: 'w-stage', kind: 'stage', name: '篷布舞台车', level: 1, durability: 100, maxDurability: 100 },
    { id: 'w-cage', kind: 'cage', name: '奇幻兽笼车', level: 1, durability: 100, maxDurability: 100 },
    { id: 'w-cargo', kind: 'cargo', name: '重型货厢车', level: 1, durability: 100, maxDurability: 100 },
    { id: 'w-passenger', kind: 'passenger', name: '风灯客车厢', level: 1, durability: 100, maxDurability: 100 },
    { id: 'w-workshop', kind: 'workshop', name: '工坊医疗车', level: 1, durability: 100, maxDurability: 100 },
  ];
}

function starterPerformers(): Performer[] {
  return [
    {
      id: 'perf-starter-lyra',
      name: '莱拉',
      codename: '风灯舞者',
      title: '火圈杂技手',
      role: 'acrobat',
      element: '赤焰系',
      stats: { magic: 60, insight: 64, agility: 84, empathy: 74 },
      level: 1,
      exp: 0,
      hp: 120,
      maxHp: 120,
      fatigue: 0,
      morale: 80,
      bond: 50,
      wagePerDay: 25,
      color: '#b87324',
      quote: '就算外面在下灰雨，帐篷里的火圈也要转得像太阳。',
      goal: '存够钱，和大家一起去没有炮火的山谷建真正的剧场。',
      appearance: '琥珀短发，袖口缝着旧红缎带',
      personality: '爽朗坚韧，擅长在破屋子里鼓舞士气。',
      outfitDescription: '轻便防火演出马甲配长靴',
      portrait: '',
      wardrobe: [],
      outfitId: 'custom',
      expression: 'smile',
      traits: [{ id: 't-hope', name: '暖灯笑颜', polarity: 'positive', tags: ['演出'], description: '开场热场时更容易点燃观众欢呼。' }],
      skillIds: ['flame-hoop'],
    },
    {
      id: 'perf-starter-moss',
      name: '莫斯',
      codename: '哨语者',
      title: '旧林驯兽徒',
      role: 'tamer',
      element: '自然系',
      stats: { magic: 55, insight: 76, agility: 66, empathy: 86 },
      level: 1,
      exp: 0,
      hp: 125,
      maxHp: 125,
      fatigue: 0,
      morale: 76,
      bond: 45,
      wagePerDay: 25,
      color: '#3b684b',
      quote: '荒原上的小家伙们不是怪物，只是和我们一样被吓坏了。',
      goal: '照料每一头进笼的奇幻生物，绝不轻易把同伴当牲口贱卖。',
      appearance: '戴着草编护腕与骨哨',
      personality: '温和细心，但有人虐待动物时会立刻翻脸。',
      outfitDescription: '沾满草籽的亚麻驯兽披肩',
      portrait: '',
      wardrobe: [],
      outfitId: 'custom',
      expression: 'calm',
      traits: [{ id: 't-tamer', name: '兽语亲和', polarity: 'positive', tags: ['驯兽'], description: '喂养与捕捉时额外提升生物驯服度。' }],
      skillIds: ['soothe-whistle'],
    },
  ];
}

function starterRecruits(): RecruitCandidate[] {
  return [
    {
      id: 'rec-jester-1',
      name: '皮普',
      title: '落魄红鼻丑角',
      role: 'clown',
      hireCost: 260,
      wagePerDay: 22,
      color: '#a63429',
      quote: '越是快塌了的镇子，越需要有人故意摔进泥坑里逗大伙儿笑。',
      personality: '用荒诞玩笑掩盖悲观的老练艺人',
      stats: { magic: 52, insight: 68, agility: 74, empathy: 82 },
      traits: [],
      portrait: '',
    },
    {
      id: 'rec-scout-1',
      name: '薇拉',
      title: '废土引路人',
      role: 'scout',
      hireCost: 340,
      wagePerDay: 28,
      color: '#345e7d',
      quote: '只要多留一只眼睛看边界的烟柱，整团就能少踩三处交火地雷。',
      personality: '寡言严谨的地图测绘手',
      stats: { magic: 50, insight: 88, agility: 84, empathy: 60 },
      traits: [],
      portrait: '',
    },
  ];
}

export function createInitialState(options: { seed?: number; spawnRegionId?: RegionId } = {}): CircusState {
  const seed = options.seed ?? Math.floor(Date.now() % 1_000_000) + 1;
  const worldMap = generateWorldMap(seed);
  const spawnRegionId = pickRandomSpawnRegion(seed, options.spawnRegionId);
  const regions = createInitialMacroRegions();
  const worldNeighbors = computeWorldNeighbors(worldMap);
  for (const rId of Object.keys(regions) as RegionId[]) {
    regions[rId].neighbors = worldNeighbors[rId].map(n => ({ ...n }));
  }

  // 严格懒加载：开局仅生成当前出生大区 10× 小地图，其余 8 区 map 为 undefined
  const startMap = generateRegionMap(worldMap, spawnRegionId, seed);
  const pois = Object.values(startMap.pois);
  const startPoi = pois.find(p => p.kind === 'village') ?? pois[0]!;
  startPoi.scouted = true;
  startPoi.details = fallbackSettlementDetails(
    startPoi,
    REGION_CATALOG[spawnRegionId],
    surroundingTerrainsOf(startMap, startPoi.x, startPoi.y),
    seed,
  );
  revealCircleInMask(startMap, startPoi.x, startPoi.y, CARAVAN_VISION_RADIUS);
  regions[spawnRegionId].map = startMap;

  const wagons = initialWagons();
  const capacity = computeCaravanCapacity(wagons);

  return {
    version: 2,
    day: 1,
    timeSlot: 'dawn',
    phase: 'camp',
    gold: 1600,
    supplies: {
      rations: 36,
      fodder: 12,
      fuel: 28,
      spareParts: 8,
      tamingNets: 4,
      props: 8,
    },
    caravan: {
      name: '微光风灯马戏团',
      wagons,
      ...capacity,
      morale: 78,
      fame: 12,
      plannedPath: [],
    },
    performers: starterPerformers(),
    worldNpcs: [],
    recruitPool: starterRecruits(),
    beasts: [
      {
        id: 'beast-starter-fox',
        speciesId: 'ember_fox_pup',
        nickname: '小火星',
        stage: 1,
        level: 2,
        exp: 40,
        tameness: 62,
        hunger: 85,
        appeal: 42,
        combatPower: 20,
        natureId: 'jolly',
        abilityId: 'cute_charm',
        caughtRegionId: spawnRegionId,
        talents: [{ id: 'tal-hoop', name: '钻火圈老手', effect: '杂技火演票房 +15%', value: 15 }],
        pairedTamerId: 'perf-starter-moss',
      },
    ],
    encounteredSpeciesIds: seedStarterEncounters(spawnRegionId),
    auctionHouse: [],
    world: {
      seed,
      spawnRegionId,
      currentRegionId: spawnRegionId,
      pos: { x: startPoi.x + 0.5, y: startPoi.y + 0.5 },
      currentPoiId: startPoi.id,
      travelCarry: { days: 0, fuel: 0, rations: 0, wear: 0, rationsPaidToday: 0 },
      worldMap,
      regions,
      factions: createInitialFactions(),
      warZones: [],
      worldDecay: 32,
    },
    freightOrders: [],
    passengerOrders: [],
    recentShows: [],
    retirement: {
      targetGold: 30_000,
      sanctuaryDiscovered: false,
    },
    rumors: [
      {
        id: 'rumor-init-1',
        day: 1,
        regionId: spawnRegionId,
        text: `在${REGION_CATALOG[spawnRegionId].name}点亮了风灯：在羊皮纸上直接划线规划路程，避开沼泽与断桥，找一座城市开张或跨界进入相邻地区。`,
      },
    ],
    logs: [
      {
        id: 'log-init',
        day: 1,
        kind: 'system',
        text: `「微光风灯马戏团」自${REGION_CATALOG[spawnRegionId].name}（${startPoi.details.name}）启程。`,
      },
    ],
  };
}
