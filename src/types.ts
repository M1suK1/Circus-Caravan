/**
 * 《残响大篷车 · Circus Caravan》核心类型定义（Stage 1 冻结骨架）。
 *
 * 设计原则：
 *  1. 兼容导入夜糖/通用角色卡（GirlCard），支持一卡双用（马戏团演员 / 地图驻地 NPC）。
 *  2. 9 大奇幻地区支持按需懒加载（MacroRegion.map 在未出境踏入前为 undefined）。
 *  3. 城市与村庄初生只定坐标与占位（SettlementPoi.scouted === false），侦查后再由 LLM 填充详情。
 */

export type AssetId = string;

export interface CropBox {
  zoom: number;
  x: number;
  y: number;
}

export interface PortraitSpec {
  seed?: number;
  silhouette?: string;
  hairColor?: string;
  eyeColor?: string;
  accentColor?: string;
}

export type Expression = 'calm' | 'smile' | 'surprise' | 'sad' | 'angry' | 'shy';

export interface Outfit {
  id: string;
  name: string;
  description: string;
  palette: string[];
  layerKey?: string;
  portrait?: string;
  portraitAsset?: AssetId;
  form?: 'normal' | 'witch';
  custom?: boolean;
  imported?: boolean;
}

export interface GirlVoice {
  tone: string;
  habits: string[];
  samples: string[];
}

export type TraitPolarity = 'positive' | 'neutral' | 'negative';

export interface Trait {
  id: string;
  name: string;
  polarity: TraitPolarity;
  tags: string[];
  description: string;
  gainedAt?: string;
}

export type StatKey = 'magic' | 'insight' | 'agility' | 'empathy';

/** 外部/夜糖角色卡兼容格式，供 cardCodec 与 cardAdapter 双向转换。 */
export interface GirlCard {
  format: 'night-sugar/girl-card' | 'circus-caravan/card';
  version: 1;
  exportedAt: string;
  sourceDay: number;
  packHash?: string;
  girl: {
    name: string;
    codename: string;
    title: string;
    element: string;
    archetype?: string;
    color: string;
    quote?: string;
    goal: string;
    appearance: string;
    personality: string;
    outfitDescription: string;
    level: number;
    stats: Record<StatKey, number>;
    skillIds: string[];
    traitIds: string[];
    traits?: Trait[];
    voice?: GirlVoice;
    portrait?: string;
    portraitSpec?: PortraitSpec;
    wardrobe?: Outfit[];
    outfitId?: string;
    expression?: Expression;
    importedVariants?: Record<string, string>;
    factionTag?: string;
    roleHint?: CircusRole;
  };
}

/* ─────────────────────────── 马戏团领域枚举 ─────────────────────────── */

export type GamePhase = 'camp' | 'traveling' | 'performing' | 'hunting' | 'retired';
export type TimeSlot = 'dawn' | 'noon' | 'dusk' | 'night';

export type RegionId =
  | 'empire_heart'
  | 'arcane_city'
  | 'demon_realm'
  | 'ancient_forest'
  | 'frost_bastion'
  | 'sunken_marsh'
  | 'iron_wastes'
  | 'sand_oasis'
  | 'dawn_coast';

export type FogLevel = 'unseen' | 'rumored' | 'charted';

export type MapZoomMode = 'world' | 'region' | 'follow';
export type AppPage = 'map' | 'caravan' | 'supplies' | 'records';

export type TerrainType =
  | 'outside'
  | 'ocean'
  | 'coast'
  | 'lake'
  | 'river'
  | 'bridge'
  | 'border_gate'
  | 'wasteland'
  | 'road'
  | 'forest'
  | 'swamp'
  | 'mountain'
  | 'ruin'
  | 'warzone'
  | 'city'
  | 'village';

export type Direction = 'north' | 'south' | 'east' | 'west';

export type FactionId =
  | 'human_empire'
  | 'arcane_conclave'
  | 'demon_court'
  | 'iron_guild'
  | 'dawn_order'
  | 'rust_syndicate';

export type WagonKind = 'stage' | 'cage' | 'cargo' | 'passenger' | 'workshop';
export type CircusRole = 'acrobat' | 'tamer' | 'illusionist' | 'clown' | 'bard' | 'scout';
export type ActTag = 'acrobatics' | 'beast_tame' | 'illusion' | 'comedy' | 'music' | 'flame';

export type BeastStage = 1 | 2 | 3;
export type BeastElement = 'starlight' | 'flame' | 'frost' | 'spore' | 'iron' | 'void';
export type BeastCategory = 'beast' | 'monstergirl' | 'demon_army' | 'domesticated' | 'elite';

export type SettlementBuildingKind =
  | 'tavern'
  | 'general_store'
  | 'stage_square'
  | 'workshop_market'
  | 'guild_station'
  | 'auction_market'
  | 'sanctuary_chapel';

export interface SettlementBuilding {
  id: string;
  kind: SettlementBuildingKind;
  name: string;
  subtitle: string;
  description: string;
  actionHint: string;
}

/* ─────────────────────────── 大篷车与补给 ─────────────────────────── */

export interface Supplies {
  rations: number;
  fodder: number;
  fuel: number;
  spareParts: number;
  tamingNets: number;
  props: number;
}

export interface Wagon {
  id: string;
  kind: WagonKind;
  name: string;
  level: number;
  durability: number;
  maxDurability: number;
}

export interface Caravan {
  name: string;
  wagons: Wagon[];
  maxWeight: number;
  maxSeats: number;
  maxCageSlots: number;
  morale: number;
  fame: number;
  plannedPath: { x: number; y: number }[];
}

/* ─────────────────────── 9 大地区与程序化小地图 ─────────────────────── */

export interface RegionNeighbor {
  direction: Direction;
  targetRegionId: RegionId;
}

export interface RegionBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

export interface WorldRiver {
  id: string;
  points: { x: number; y: number }[];
}

export interface WorldLake {
  id: string;
  centerX: number;
  centerY: number;
  radius: number;
}

export interface WorldMapData {
  width: number;   // 128
  height: number;  // 128
  seed: number;
  /** 128*128 地形字节码 Base64 */
  terrainBase64: string;
  /** 128*128 区域归属字节（0..8 对应 REGION_IDS，255 为海洋/未归属）Base64 */
  regionGridBase64: string;
  regionBounds: Record<RegionId, RegionBounds>;
  rivers: WorldRiver[];
  lakes: WorldLake[];
}

export interface SettlementDetails {
  name: string;
  summary: string;
  hope: number;
  ownerFaction: FactionId | 'neutral';
  preferredActs: ActTag[];
  marketTraits: string[];
  rumorLead?: string;
  detailSource: 'llm' | 'fallback';
  npcIds: string[];
}

export interface SettlementPoi {
  id: string;
  regionId: RegionId;
  kind: 'city' | 'village';
  /** 聚落中心坐标（局部区域网格坐标） */
  x: number;
  y: number;
  /** 多格占地清单（城市占多格，村庄占 1–2 格） */
  footprint: { x: number; y: number }[];
  scouted: boolean;
  placeholderName: string;
  details?: SettlementDetails;
  visitedCount: number;
  lastShowDay?: number;
}

export interface RegionGate {
  direction: Direction;
  targetRegionId: RegionId;
  x: number;
  y: number;
}

export interface RegionMap {
  regionId: RegionId;
  scale: 10;
  /** 相对于 128×128 世界地图的放大偏移（minX*10, minY*10） */
  worldOffsetX: number;
  worldOffsetY: number;
  width: number;
  height: number;
  seed: number;
  /** width*height 地形字节码 Base64（0..15 对应 TERRAIN_ORDER） */
  terrainBase64: string;
  /** 探索位掩码 Base64（1 bit/格，仅记曾到达或当前视野已揭露地貌） */
  exploredMaskBase64: string;
  gates: RegionGate[];
  pois: Record<string, SettlementPoi>;
}

export interface RouteEvaluation {
  points: { x: number; y: number }[];
  validPoints: { x: number; y: number }[];
  distanceTiles: number;
  travelDays: number;
  rationsCost: number;
  fuelCost: number;
  durabilityCost: number;
  blocked: boolean;
  blockReason?: string;
  reachedGate?: RegionGate;
  reachedPoiId?: string;
  avgSpeedMultiplier: number;
}

export interface MacroRegion {
  id: RegionId;
  name: string;
  subtitle: string;
  theme: string;
  dominantFaction: FactionId | 'neutral';
  neighbors: RegionNeighbor[];
  dangerTier: 1 | 2 | 3 | 4 | 5;
  /** 仅当前区与已出境踏入的地区生成；未涉足地区保持 undefined */
  map?: RegionMap;
}

export interface TravelProgress {
  regionId: RegionId;
  path: { x: number; y: number }[];
  stepIndex: number;
  daysElapsed: number;
  evadingWar: boolean;
}

export interface FactionState {
  id: FactionId;
  name: string;
  standing: number;
  hasPass: boolean;
  passExpireDay?: number;
  atWarWith: FactionId[];
}

export interface WarFront {
  id: string;
  regionId: RegionId;
  attacker: FactionId;
  defender: FactionId;
  intensity: number;
  remainingDays: number;
}

/* ──────────────────────── 演员与驻地/乘车 NPC ──────────────────────── */

export interface Performer {
  id: string;
  cardHash?: string;
  name: string;
  codename: string;
  title: string;
  role: CircusRole;
  element: string;
  stats: Record<StatKey, number>;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  fatigue: number;
  morale: number;
  bond: number;
  wagePerDay: number;
  color: string;
  quote?: string;
  goal: string;
  appearance: string;
  personality: string;
  outfitDescription: string;
  portrait: string;
  portraitAsset?: AssetId;
  portraitCrop?: CropBox;
  portraitSpec?: PortraitSpec;
  wardrobe: Outfit[];
  outfitId: string;
  expression: Expression;
  importedVariants?: Record<string, string>;
  voice?: GirlVoice;
  traits: Trait[];
  skillIds: string[];
  assignedWagonId?: string;
}

export type NpcOccupation = 'mayor' | 'auctioneer' | 'merchant' | 'warlord' | 'passenger' | 'rival_leader';

export interface WorldNpc {
  id: string;
  cardHash?: string;
  name: string;
  title: string;
  occupation: NpcOccupation;
  faction: FactionId | 'neutral';
  regionId: RegionId;
  poiId?: string;
  ridingCaravan?: boolean;
  color: string;
  quote?: string;
  appearance: string;
  personality: string;
  portrait: string;
  portraitAsset?: AssetId;
  portraitSpec?: PortraitSpec;
  expression: Expression;
  voice?: GirlVoice;
  disposition: number;
  secretHint?: string;
}

export interface RecruitCandidate {
  id: string;
  name: string;
  title: string;
  role: CircusRole;
  hireCost: number;
  wagePerDay: number;
  color: string;
  quote: string;
  personality: string;
  stats: Record<StatKey, number>;
  traits: Trait[];
  cardHash?: string;
  portrait: string;
  portraitAsset?: AssetId;
}

/* ────────────────────────── 奇幻生物与拍卖 ────────────────────────── */

export interface BeastEvolution {
  targetSpeciesId: string;
  branchName: string;
  requireLevel: number;
  requireTameness: number;
  requireMaterial?: string;
  description: string;
}

export interface BeastSpecies {
  id: string;
  name: string;
  category?: BeastCategory;
  stage: BeastStage;
  element: BeastElement;
  cageCost: 1 | 2;
  captureDifficulty: number;
  baseAuctionValue: number;
  baseAppeal: number;
  baseCombatPower: number;
  actTags: ActTag[];
  habitatRegions: RegionId[];
  habitats?: TerrainType[];
  passiveEffect?: string;
  yieldSummary?: string;
  description: string;
  evolutions: BeastEvolution[];
}

export interface BeastTalent {
  id: string;
  name: string;
  effect: string;
  value: number;
}

export interface Beast {
  id: string;
  speciesId: string;
  nickname: string;
  stage: BeastStage;
  level: number;
  exp: number;
  tameness: number;
  hunger: number;
  appeal: number;
  combatPower: number;
  talents: BeastTalent[];
  pairedTamerId?: string;
}

export interface AuctionListing {
  id: string;
  regionId: RegionId;
  poiId: string;
  beastId: string;
  reservePrice: number;
  currentBid: number;
  expiresDay: number;
}

/* ──────────────────────── 巡演、货客运与终局 ──────────────────────── */

export interface ShowSlot {
  slot: 'opener' | 'feature' | 'finale';
  performerIds: string[];
  beastId?: string;
  actTag: ActTag;
  useProps: number;
}

export interface ShowRecord {
  id: string;
  day: number;
  regionId: RegionId;
  poiId: string;
  slots: ShowSlot[];
  ticketRevenue: number;
  tipBonus: number;
  hopeGain: number;
  fatigueCost: number;
  highlightSummary: string;
}

export interface FreightContract {
  id: string;
  title: string;
  fromRegionId: RegionId;
  fromPoiId: string;
  toRegionId: RegionId;
  toPoiId: string;
  issuerFaction: FactionId | 'neutral';
  weight: number;
  rewardGold: number;
  deadlineDay: number;
  fragile?: boolean;
  contraband?: boolean;
  status: 'open' | 'carrying' | 'delivered' | 'failed';
}

export interface PassengerContract {
  id: string;
  npcId?: string;
  name: string;
  originPoiId: string;
  destRegionId: RegionId;
  destPoiId: string;
  seatsNeeded: number;
  fareGold: number;
  deadlineDay?: number;
  storyHook?: string;
  status: 'waiting' | 'aboard' | 'arrived' | 'abandoned';
}

export interface RetirementProgress {
  targetGold: number;
  sanctuaryDiscovered: boolean;
  chosenHaven?: 'quiet_farm' | 'hidden_valley';
  ending?: {
    achievedDay: number;
    tier: 'modest' | 'prosperous' | 'legendary';
    accompanyingPerformers: { id: string; name: string; epilogue: string }[];
    accompanyingBeasts: { id: string; name: string; epilogue: string }[];
    narrative?: string;
  };
}

export interface RumorItem {
  id: string;
  day: number;
  regionId: RegionId;
  text: string;
}

export interface GameLog {
  id: string;
  day: number;
  kind: 'travel' | 'scout' | 'show' | 'beast' | 'crew' | 'freight' | 'faction' | 'system';
  text: string;
}

/* ────────────────────────── 根存档状态与动作 ────────────────────────── */

export interface CircusState {
  version: number;
  day: number;
  timeSlot: TimeSlot;
  phase: GamePhase;
  gold: number;
  supplies: Supplies;
  caravan: Caravan;
  performers: Performer[];
  worldNpcs: WorldNpc[];
  recruitPool: RecruitCandidate[];
  beasts: Beast[];
  /** 沿途或侦查曾经遇到过的奇幻生物/魔物娘图鉴 ID 记录 */
  encounteredSpeciesIds: string[];
  auctionHouse: AuctionListing[];
  world: {
    seed: number;
    spawnRegionId: RegionId;
    currentRegionId: RegionId;
    /** 当前大篷车在区域小地图内的连续坐标（可精确到小数格） */
    pos: { x: number; y: number };
    currentPoiId?: string;
    traveling?: TravelProgress;
    worldMap: WorldMapData;
    regions: Record<RegionId, MacroRegion>;
    factions: Record<FactionId, FactionState>;
    warZones: WarFront[];
    worldDecay: number;
  };
  freightOrders: FreightContract[];
  passengerOrders: PassengerContract[];
  recentShows: ShowRecord[];
  retirement: RetirementProgress;
  rumors: RumorItem[];
  logs: GameLog[];
}

export interface ActionResult {
  state: CircusState;
  ok: boolean;
  message?: string;
}

export type GameAction =
  | { type: 'newGame'; seed?: number; spawnRegionId?: RegionId }
  | { type: 'crossBorder'; targetRegionId: RegionId; direction?: Direction }
  | { type: 'scoutSettlement'; poiId: string; details?: SettlementDetails }
  | { type: 'executeRoute'; points: { x: number; y: number }[]; evadeWar?: boolean }
  | { type: 'upgradeWagon'; wagonId: string }
  | { type: 'repairWagon'; wagonId: string }
  | { type: 'hireCandidate'; candidateId: string }
  | { type: 'importCardAsPerformer'; card: GirlCard; role?: CircusRole }
  | { type: 'placeCardAsNpc'; card: GirlCard; poiId: string; occupation?: NpcOccupation; faction?: FactionId | 'neutral' }
  | { type: 'setPerformerExpression'; performerId: string; expression: Expression }
  | { type: 'setPerformerPortrait'; performerId: string; portrait: string }
  | { type: 'tavernRest'; poiId: string }
  | { type: 'stagePerform'; poiId: string }
  | { type: 'settlementBuySupply'; poiId: string; supplyKey: keyof Supplies; amount: number; cost: number }
  | { type: 'settlementAidOrPass'; poiId: string; mode: 'ration_aid' | 'buy_pass' };
