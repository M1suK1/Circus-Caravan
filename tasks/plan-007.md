# Plan-007 · docs 世界书体系与奇幻生物遭遇概率、右键地形生态勘测、城村驻地建筑访问实施方案

> **目标隔离分支**：`superpowers/worldbook-encounters-buildings`（待人工审核确认后从当前进度切出，不触碰 `main`）  
> **当前阶段**：Superpowers Stage 1（仅输出完整书面计划至 `tasks/plan-007.md` 供人工审核，**尚未修改任何业务、数据或界面代码**）

---

## PLAN
════

### TASK
结合 `docs/` 五份世界观与图鉴设定文档，完成三大核心玩法与世界观落地：1) 构建完整末世《残响大篷车》世界书并扩充全部图鉴生物/魔物娘条目，按大区与微观地形分配科学的野外遭遇概率；2) 实现右键点击地图任意格弹出该地形生态详情与「曾经遇到的奇幻生物」图鉴档案（同时保留右键拖拽平移兼容）；3) 实现大篷车进入城市/村庄时打开驻地信息面板，并可点击访问城村内的特色建筑（旅店酒馆、补给工坊、剧场广场、商会货站、拍卖行/庇护所等）执行真实交互。

---

### APPROACH

#### 1. 解析 `docs/` 构建完整世界书与全量生物图鉴及概率系统
- **结构化世界书知识库（`src/content/worldbook.ts`）**：
  - 完整提炼 `docs/` 五份设定文档，按 6 大作用域编纂世界书词条（`WorldbookEntry[]`，含 `id`、`category`、`title`、`keywords`、`regionIds`、`priority`、`content`、`defaultEnabled`）：
    1. **三大人类帝国**（神圣圣徽帝国、穹顶魔导帝国、赫利俄斯铜沙帝国及各自对魔物娘的契约/实验/商品法理）；
    2. **三种主要宗教**（晨曦救赎教、灰烬铸炉教、星渊万灵教及演出口味禁忌）；
    3. **核心势力与奴隶冲突**（铁轨商会、灰烬军团、锈蚀黑市、黎明圣教、魔王军「苍灰解放阵线」）；
    4. **末世灾厄与隐秘博弈机制（纯机制与蓝图生成参考，不固化具体灾厄与剧情）**：严格遵循「复用故事蓝图模式、不写死 9 区固定灾厄名/固定天使恶魔 NPC 剧本」原则，世界书仅收录其**运作机制纲要**（灾厄等级与进度动态演化、潜伏天使与伪装恶魔的凡人伪装身份结构、马戏演出/搭车破绽线索与双向破局抉择），具体剧情线留待后续故事蓝图系统动态生成；
    5. **魔王军 6 大专有魔物娘与被驯化 7 大聚落亚人体系**；
    6. **末世行军与隐居净土纲要**（`sanctuary` 终极航路）。
  - 升级 `EngineConfigDialog.tsx` 的「末世世界书条目」标签页：从单个文本框升级为可按分类筛选、关键词预览、开关启用及编辑追加的世界书浏览器。
- **全量图鉴数据扩充（`src/content/species.ts` + `src/content/speciesRoster.ts`）**：
  - 保持现有 `BEAST_SPECIES` 核心 starter ID（`ember_fox_pup` 等）与测试完全兼容；
  - 从 `docs/` 完整录入 **27 种常规奇幻生物 + 27 种野生奇幻魔物娘 + 6 种魔王军专有魔物娘 + 7 种被驯化聚落魔物娘 + 9 种区域精英传奇生物**（通过 `category: 'beast' | 'monstergirl' | 'demon_army' | 'domesticated' | 'elite'`、`habitats: TerrainType[]`、`passiveEffect`、`yieldSummary` 区分）。
- **地形与区域遭遇概率引擎（`src/domain/encounters.ts`，严格 `≤ 450` 行）**：
  - 实现 `getTerrainBaseEncounterChance(terrain)`：不同地形基础遇敌/遭遇概率（如 `road` 12%、`wasteland` 22%、`coast`/`mountain` 26%、`forest`/`swamp`/`ruin` 32%、`warzone` 38%、`city`/`village` 18%）；
  - 实现 `computeTerrainEncounterTable(regionId, terrain, timeSlot)`：自动匹配 `regionId` 与当前 `terrain` 栖息地（`river`/`lake`/`coast` 兼容水系 `water` 生态，`bridge` 兼容 `road` 与 `water` 生态），按稀有度层级分配归一化概率分布（常规奇兽高权重 → 野生魔物娘中权重 → 魔王军特化中低权重 → 区域 5 星精英极稀有约 3%–6%），总和精确归一化为 `100%`；
  - 在 `CircusState` 中新增 `encounteredSpeciesIds: string[]` 长期图鉴记录（开局收录初始驯养生物与起点周边常见目击 1–2 种，此后每次执行路线行军 `applyExecuteRoute` 时按沿途所经地形与概率确定性掷骰触发遭遇，把新遇见的奇幻生物写入 `encounteredSpeciesIds` 并在行旅日志播报）。

#### 2. 右键点击地图显示地形详情与「曾经遇到的奇幻生物」（与右键平移无缝共存）
- **交互识别（`CartographyView.tsx` & `useRouteSketch.ts`）**：
  - 右键按下并拖拽位移 `≥ 6px`：保持「平移地图视野」手感不变；
  - 右键轻点（位移 `< 6px` 且屏蔽浏览器默认菜单 `onContextMenu`）：计算点击坐标 `(gx, gy)`，弹出精致古典羊皮纸**「地形生态勘测卡（`#map-terrain-inspect-note`）」**：
    - **迷雾未探明区域**：提示该处尚在云雾遮蔽中，仅显示所属大区基调与局部风险等级，引导车队靠近开雾；
    - **已探明地形**：展示地形名称、精确坐标 `(gx, gy)`、行军速度倍率（`×1.4` 等）、灯油与车轮磨损系数、是否可通行、综合生物遭遇率（如 `32%`），以及**「曾经在此生态遇到过的奇幻生物」**列表（从 `state.encounteredSpeciesIds` 筛选适配该大区与地形的生物，显示名字、元素、稀有度、生态遭遇概率占比与简要习性；同时提示该地形尚有多少种未曾谋面的潜在栖息生灵）。
  - 世界全图模式下右键轻点，同样显示该经纬区块的大陆地貌、所属大区灾厄简介及该大区已遭遇的生物名录。

#### 3. 进入城市和村庄时打开驻地信息并访问相关建筑（`src/domain/settlements.ts` + `SettlementDialog`）
- **城/村建筑配置生成器（`src/domain/settlements.ts`）**：
  - 依据聚落类型（`city` 多格城郭 vs `village` 荒野村寨）、所属大区（`regionId`）与控制势力（`ownerFaction`）确定性生成建筑清单（`SettlementBuilding[]`）：
    - **村寨建筑（3–4 座）**：`风灯旅店与酒馆`（打听风闻线索、花少许金币休整回血降疲劳、签约流民）、`杂货与修车摊`（购买行军补给与快捷修缮车厢）、`村心篝火空地`（根据当地偏好节目直接搭棚演出赚金币、提振希望值）；
    - **城郭建筑（5–6 座）**：`大剧场广场`（盛大巡演结算票房与名望）、`行会旅店`（深度休整与线索打探）、`蒸汽工坊与行商行`（全额补给采购与车厢修缮/扩建）、`商会货站`（接取或交付货运/搭客委托）、`铁轨或黑市拍卖行`（查看待赎买被驯化魔物娘或高价拍卖奇兽，关联黎明圣教/魔王军好感道德抉择）、`庇护礼拜堂 / 城防驿站`（获取势力通行证或救济干粮）。
- **触发时机与规则动作闭环（`App.tsx` + `rules/settlementOps.ts` + `ScoutDialog.tsx`）**：
  - **进城/入村自动弹出驻地信息**：当大篷车沿路线行驶动画结束并抵达城郭或村寨（`res.state.world.currentPoiId` 落入 `city`/`village`）时，自动打开驻地信息弹窗；玩家平时在右侧「斥候手札」或地图据点便签点击「进入驻地」也可随时重新打开；
  - 若该聚落尚未侦查（`!poi.scouted`），弹窗顶部提供一键「斥候勘测聚落详情」解锁全部建筑；已侦查的聚落直接展示驻地全貌、势力归属、希望值与建筑卡片网格，点击任意建筑即可在右侧/子面板切换访问并执行真实操作（休息回血、买补给、修车、开演赚钱、赎买/查看流民或打听灾厄线索）。

---

### FILES TO CREATE OR MODIFY
- `src/content/worldbook.ts` — **create** — 基于 `docs/` 五份文档整理的全量末世世界书条目库与检索辅助函数。
- `src/content/speciesRoster.ts` — **create** — 整合 `docs/` 的 27 常规奇兽、27 野生魔物娘、6 魔王军魔物娘、7 驯化亚人、9 区域精英全量生态档案。
- `src/content/species.ts` — **modify** — 并入 `speciesRoster.ts`，导出全量 `BEAST_SPECIES` 并保持 starter ID 兼容。
- `src/types.ts` — **modify** — 扩展 `BeastCategory`、`BeastSpecies` 生态字段、`EncounterRecord`、`SettlementBuilding` 与 `CircusState.encounteredSpeciesIds` 及驻地建筑交互动作类型。
- `src/domain/encounters.ts` — **create** — 区域/地形奇幻生物遭遇概率分配表、概率归一化与沿途遭遇掷骰函数。
- `src/domain/settlements.ts` — **create** — 城市/村庄建筑群生成、演出票房演算与建筑服务定价纯函数。
- `src/rules/settlementOps.ts` — **create** — 驻地旅店休整、广场巡演、庇护所领粮/买通行证等纯状态变更动作。
- `src/rules/travelOps.ts` — **modify** — `applyExecuteRoute` 行军结束时按经过地形概率触发奇幻生物遭遇并记录到 `encounteredSpeciesIds`。
- `src/rules/state.ts` & `src/rules/persistence.ts` & `src/rules/act.ts` — **modify** — 初始化与持久化 `encounteredSpeciesIds`，注册驻地建筑相关 `GameAction`。
- `src/components/Modals/EngineConfigDialog.tsx` — **modify** — 接入 `WORLDBOOK_ENTRIES` 可视化浏览、分类筛选与词条开关。
- `src/components/Modals/ScoutDialog.tsx` — **modify** — 升级为完整的「驻地信息与建筑访问中心」，支持切换访问城/村内部各建筑并执行休整、补给、演出、查线索与救赎/招募。
- `src/components/Cartography/CartographyView.tsx` — **modify** — 区分右键拖拽平移与右键轻点（`< 6px`），弹出地形信息与「曾经遇到的奇幻生物」勘测卡。
- `src/components/Shell.tsx` & `src/App.tsx` & `src/styles/parchment.css` — **modify** — 行军抵达城/村自动弹出驻地信息窗，更新右侧栏驻地快捷入口与地形勘测浮卡/建筑网格样式。
- `tests/s7-worldbook-encounters-buildings.test.ts` — **create** — Stage 3 先行测试：校验 `docs` 世界书完整性、各区域/地形遭遇概率归一化与加权分布、右键地形勘测遭遇生物过滤、以及进城/入村建筑列表与旅店休整/广场开演动作闭环。
- `package.json` — **modify** — 将 `tests/s7-worldbook-encounters-buildings.test.ts` 加入 `pnpm test`。

---

### EDGE CASES I WILL HANDLE
- **旧存档读档缺少 `encounteredSpeciesIds`**：在 `persistence.ts` 中为旧存档默认补齐初始已驯养生物 ID，不崩溃。
- **右键拖拽平移 vs 右键点击查地形冲突**：严格通过 `pointerdown` 到 `pointerup` 位移 `< 6px` 判定右键点击，拖动 `>= 6px` 依然顺滑平移视野而不弹勘测卡。
- **多方势力与建筑差异化**：不同城市/村庄依据 `kind`（`city` vs `village`）与 `dominantFaction` 生成贴合设定的建筑名称与功能（如黎明圣教庇护所 vs 商会车站拍卖行）。
- **`tools/check-imports.mjs` 体积限制**：新增领域与规则模块按职责拆分为 `encounters.ts`、`settlements.ts`、`settlementOps.ts`，确保所有 `src/domain/*.ts` 与 `src/rules/*.ts` 严格 `≤ 450` 行、无环、无 BOM。

---

### EDGE CASES I AM NOT HANDLING (out of scope)
- **复杂回合制战斗小游戏画面**：野外遭遇当前先记录图鉴目击/触发日志并展示概率与生态，完整回合制捕猎战斗弹窗留待下一专题推进。

---

### ASSUMPTIONS
- 进入城和村时打开驻地信息面板：若玩家刚沿着路线走入城市或村庄边界（`currentPoiId` 命中），动画抵达后自动打开该驻地的访问弹窗；未侦查的聚落可在弹窗内一键侦查后立刻访问全部建筑。
