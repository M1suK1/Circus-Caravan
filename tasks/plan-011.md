# Plan-011 · 地图兴趣点与区域声望、角色卡全生态复用、LLM 叙事职责规划方案

> **前置衔接**：本方案承接 [plan-010.md](./plan-010.md)（日结生存循环、货运客运、拍卖行与隐居结局），对应待切出的阶段分支 `superpowers/landmarks-reputation-cardbox-llm`（或按审核意见分批实施，**当前未修改任何业务、渲染或样式代码**）。
> **当前阶段**：Superpowers Stage 1（仅输出书面规划至 `tasks/plan-011.md` 供人工审核）。

---

## PLAN
════

### TASK
针对下一阶段的三大系统扩建给出可执行技术规划：
1. **增加地图兴趣点与区域声望**：把 10× 区域小地图上目前仅有的 `city`/`village` 与 `border_gate` 扩展为包含 6 类野外可交互地标的立体探索网，并建立九大地区各自独立的「区域声望（`RegionReputation`）」系统，使其与演出、委托、执法盘查、黑市及净土线索形成双向反馈。
2. **角色卡复用方案**：打通现已存在但尚未串联的 `cardCodec.ts` + `cardbox.ts` + `cardAdapter.ts` + `portrait.ts` + `localfiles.ts`，构建「本地卡匣持久化 → 多身份双栖复用 → 局内成长回存导出 → 跨存档继承」的完整闭环，让同一张 `GirlCard` 能在演员、驻地 NPC、护送旅客、遇险路人、竞演头牌之间自由流转。
3. **规划 LLM 需要负责的功能**：确立「本地规则引擎管数值/真值，LLM 管世界风貌、角色演绎、动态遭遇、故事蓝图与终局群像」的职责边界，把当前 `ScoutDialog.tsx` 与 `PerformerDialog.tsx` 里的假定时器/固定台词升级为可配置、带结构化 JSON 校验与离线模板降级的统一叙事层。

---

### ARCHITECTURE & DESIGN

#### 一、地图兴趣点（Field Landmarks）与区域声望（Region Reputation）

##### 1.1 六类野外兴趣点（`FieldLandmark`）
- **现状诊断**：`src/domain/regionGen.ts` 已按区域生态生成 `ruin` / `forest` / `swamp` / `warzone` / `coast` / `road` / `bridge` 等丰富地形，但目前仅有 `pois: Record<string, SettlementPoi>`（城/村）与 `gates: RegionGate[]` 可点击交互，大量野外地带除了遇敌遭遇外缺乏主动探索目标。
- **数据结构**（扩展 `src/types.ts` 与 `RegionMap`）：
  - 新增 `LandmarkKind = 'ancient_ruin' | 'wild_lair' | 'refugee_camp' | 'smuggler_cove' | 'watchtower_post' | 'shrine_hearth'`。
  - 新增 `FieldLandmark`：`{ id, regionId, kind, x, y, terrain, name, discovered, resolved, cooldownUntilDay?, rewardTag?, linkedSpeciesId? }`，挂载至 `RegionMap.landmarks: Record<string, FieldLandmark>`（老存档兼容 `landmarks ??= {}`）。
- **程序化分布规则**（`src/domain/landmarks.ts` + `regionGen.ts` 接入）：
  - 每张 10× 区域小地图依据世界种子生成 `4–7` 个野外兴趣点，彼此间距 `>= 14` 格，且与聚落/关口保持 `>= 8` 格距离，严格锚定在匹配的地形格上：
    1. **`ancient_ruin`（旧纪元遗迹）**：生成于 `ruin` 格；搜刮可得 `spareParts`/`props`/稀有材料，有概率发现「净土航路坐标碎片」或触发隐藏天使线索。
    2. **`wild_lair`（奇兽灵泉巢穴）**：生成于 `forest` / `swamp` / `mountain` 边缘；直接展示当地 1 种高概率稀有物种或区域精英踪迹，可直接消耗捕兽网与诱饵定向蹲守捕捉。
    3. **`refugee_camp`（荒野流民/逃奴营地）**：生成于 `wasteland` / `road` 旁；可选择「施舍口粮」「免费义演」换取大量本区声望与希望值，或从营地招募新艺人/接取护送委托。
    4. **`smuggler_cove`（隐秘渡口与暗桩）**：生成于 `coast` / `river` / `swamp` 岸边；在缺乏势力通行证或区域声望过低时，提供高风险高回报的绕卡补给、廉价捕兽网与黑市货运。
    5. **`watchtower_post`（边境哨站与税卡）**：生成于 `road` / `bridge` 交通咽喉；高声望或持证车队可免费打听战区/灾厄预警，低声望或走私违禁品时触发关税盘查或通行证补办。
    6. **`shrine_hearth`（星渊石碑/微光祭坛）**：生成于 `forest` 深处、`sand_oasis` 绿洲或远山麓；可恢复全团士气与疲劳，并作为「潜伏天使 vs 伪装恶魔」故事蓝图的核心仪式/线索触发点。
- **地图渲染与路线联动**：
  - **迷雾保密**：兴趣点仅在进入 `CARAVAN_VISION_RADIUS`（12 格）或已揭露格后才在地图与侧栏出现，未探索前保持未知感。
  - **铜版图章绘制**（`mapIcons.ts`）：用紧凑八角铜印/盾徽区别于城村的双墨菱形；已解决（`resolved`）的地点自动盖上淡墨完成印记。
  - **交互与寻路**：`routeDraw.ts` 的 `RouteEvaluation` 增加 `reachedLandmarkId`；`findAutoRoute` 支持一键规划前往已发现的兴趣点；抵达后点击图标或自动弹出轻量 `LandmarkDialog` 完成决策（联动消耗 1 个时段或对应物资）。

##### 1.2 独立区域声望体系（`RegionReputation`）
- **现状诊断**：`FactionState.standing` 仅记录 6 大宏观阵营好感，缺乏「大篷车在当地九大地区的民间口碑与风评」。现实中同一势力辐射多个地区（如 `iron_guild` 同时主导 `frost_bastion` 与 `iron_wastes`），需要区域维度的局部声望来体现「你在极北救过矿工，但在锈铁仍是生面孔」。
- **数据结构**（扩展 `MacroRegion`）：
  - `reputation: number`（范围 `-100 ~ +100`，开局按地区危险度与主控阵营初值设定在 `-10 ~ +15`）；
  - `reputationHistory: { day: number; delta: number; reason: string }[]`（保留最近 10 条变动摘要供玩家查账）。
- **声望阶梯与实机机制**（`src/domain/reputation.ts`）：
  - **五档口碑标签**：
    - `[-100, -30]` **仇视驱逐**：当地城村物资溢价 `+30%`、旅店可能拒客、经过哨站强制缴纳高额罚金或扣押无证魔物娘；
    - `[-29, -1]` **冷眼戒备**：关税提高 `+15%`，无法在当地招募或领取施粥救济；
    - `[0, 24]` **过客微名**：标准行情；
    - `[25, 59]` **暖灯口碑**：当地舞台演出票房与打赏 `+20%`、旅店休整 `-15%`、流民营地提供情报与免费干粮；
    - `[60, 100]` **传唱传奇**：免通行证过当地边卡、酒馆/货站解锁高酬金稀有委托、提高区域精英或天使主动现身协助的概率。
  - **升降触发点与跨域传导**：
    - 聚落演出满足当地 `preferredActs`（`+5~+10`）、流民营地义演/施粥（`+8`）、准时交付当地货运/旅客（`+6`）、协助潜伏天使平息灾厄（`+25`）；
    - 违约逾期（`-8`）、违禁品被哨站查获（`-15`）、在黎明圣教辐射区向黑市高价贩卖魔物娘（`-18`）。
    - 区域声望每次变动时，以 `30%` 权重同步传导至当地 `dominantFaction` 的全局好感（单向/双向微弱耦合，避免一地翻车导致全大陆直接死档）。
- **UI 呈现**：
  - 世界地图与区域切换栏中以铜色小盾徽标示各区声望等级；
  - `Shell.tsx` 左侧/顶部区域面板展示当前大区声望条与当前生效的口碑加成；
  - `RecordsView.tsx` 新增「九大地区风评纵览」九宫格，一屏看清何处适合刷演赚钱、何处已被盯上。

---

#### 二、角色卡复用方案（`GirlCard` 全生命周期生态复用）

- **现状盘点**：仓库内已有 `cardCodec.ts`（支持 `night-sugar/girl-card` v1 与 `circus-caravan/card` v1）、`cardbox.ts`（`circus-caravan:cardbox:*` 60 张分片卡库）、`cardAdapter.ts`（`cardToPerformer` / `cardToWorldNpc` / `performerToCard`）、`portrait.ts`（统一立绘与 `importedVariants` 解析），以及 `localfiles.ts`（本地 `/api/files?kind=card` 读写 `data/cards/`）。但目前 `Shell.tsx:147` 的 `#open-cardbox` 仅跳转到 `CaravanView` 弹一条通知，`cardbox.ts` 尚未挂载任何 UI。
- **复用核心原则**：**一张卡 = 一个可移植的灵魂资产**，通过 `cardHash` 唯一标识，在「永久卡匣（跨局仓库）」「随行演员」「驻地 NPC」「搭车旅客 / 野外偶遇」「竞演对手 / 魔物娘拓展」五种角色容器之间无损流转。

##### 2.1 五大复用通路设计
1. **通路 A：独立《巡游契约卡匣》（`CardboxDialog.tsx`）**
   - 点击左侧 `#open-cardbox` 丝绸书签弹出完整卡匣模态框（不再只是跳转页面）。
   - 数据来源三合一：① IndexedDB/`/api/kv` 已存卡匣（`loadCardBox`）；② 本地开发服务器 `data/cards/*.json` 目录一键批量导入（`listLocalFiles('card')`）；③ 玩家拖拽上传本地 `.json`（`parseCardJson` + `optimizeCardImages`）。
   - 支持按属性/职业/派系/来源过滤、查看立绘缩略图与四维雷达、删除卡、以及一键选定复用身份（「招募登车」「派驻城村」「投放为旅客」「注入本局世界客串池」）。
2. **通路 B：剧团演员双向回存与跨局传承（`performerToCard` 增强）**
   - 局内成员（包括初始成员莱拉、莫斯或招募的艺人）在升级、提升 `bond`、更换立绘或收集到新服装后，可在 `PerformerDialog` 一键**「保存到卡匣」**或导出 `.circus-card.json`（保留 `level`、`stats`、`traits`、`wardrobe`、`importedVariants`、`portrait`）。
   - 新开局从卡匣导入老角色时提供两种模式：**「初遇重启（重置为 Lv.1 轻装入团，平衡开局）」**与**「宿命重逢（保留历史称号与羁绊回忆标签，付费签约）」**。
3. **通路 C：本局世界「卡库自动客串注入」**
   - 开局或首次展开新大区时，提供可选开关「从卡匣自动填充世界居民」：按世界种子抽取最多 6 张未登车的卡，自动分配到未侦查的 9 大区域聚落中，作为真实的酒馆老板、商会长老或旅途向导（`cardToWorldNpc`），附带卡面原本的 `quote`、`voice` 口癖与立绘。
   - 玩家在各地城村访问时，不仅能看到熟悉角色开店或发布委托，在好感 `disposition >= 75` 时还可通过对话**邀约其转正登车**（无缝从 `worldNpcs` 迁移为 `performers`）。
4. **通路 D：搭车旅客与野外偶遇复用**
   - 卡匣中的闲置角色可被 `contracts.ts` 自动抽选为长途客运订单的具名旅客（写入 `PassengerContract.npcId` + `storyHook`），沿途能在篝火与马车事件里使用其自带 `GirlVoice` 说话，并在送达终点后成为该城的常驻好友 NPC。
   - 在野外探索 `refugee_camp` 或 `ancient_ruin` 时，若卡匣有未登场角色，可优先将其包装为「被困商旅/寻宝学者」触发救援与临时同行剧情。
5. **通路 E：立绘与资产轻量化防爆策略**
   - **去重与冲突提示**：按 `cardHash` 检查同一角色是否已在团内或已派驻世界，防止意外出现两个完全一样的分身（仍保留「异时空双生」手动确认覆盖选项）。
   - **主存档瘦身**：`Performer` 与 `WorldNpc` 入档时复用 `cardHash` 索引与 `portraitAsset` 引用，避免每次状态变更 `localStorage` 序列化时把多张 200KB base64 立绘反复写入历史快照；超大图在进入卡匣时统一走 `safeOptimizedImageDataUrl` 降采样压缩。

---

#### 三、规划 LLM 需要负责的功能（叙事引擎职责边界与降级架构）

- **现状诊断**：`src/engine/vertex.ts` 已具备完整 Vertex AI（Service Account JWT + Express Key + 思维链 `thinking`）调用底座；`EngineConfigDialog.tsx` 已有 `worldbook` / `api` / `prompts` 三大页签；`VnReader.tsx` 已具备视觉小说节拍播放器。但业务层的 `ScoutDialog.tsx`（第 100–114 行）和 `PerformerDialog.tsx`（第 98–104 行）目前仍使用假 `setInterval` 与模板拼接字符串，尚未接通真实 LLM 管道，且缺少跨局/跨场景的统一职责边界设计。
- **核心架构原则**：
  1. **真值隔离原则**：所有硬数值（金币、口粮、捕获概率、耐久、声望加减、坐标移动）**100% 由本地确定性规则计算与校验**。LLM 绝不直接生成任意数值修改 `CircusState`，只输出受 Schema 约束的结构化 JSON 提案（`LlmActionProposal`）与叙事文本。
  2. **双模式零门槛**：支持**「纯本地演剧模式（Offline Fallback）」**与**「实时叙事模式（LLM Connected）」**无缝切换。任何 LLM 超时、断网或 JSON 畸形（可辅以仓库现有的 `src/engine/jsonRepair.ts` 修复）都自动静默降级至高质量本地规则模板，保证游戏永不卡死。
  3. **按需世界书注入**：新增上下文组装器，仅提取与当前大区、地形、声望及关键词匹配的 `WORLDBOOK_ENTRIES`（按 `priority` 截断在预算 Token 内），避免全量塞入提示词浪费上下文。

##### 3.1 规划 LLM 负责的六大核心功能

| 优先级 | 功能域 | 作用域 (`scope`) | 输入上下文 | LLM 预期产出 (结构化 JSON + 文本) | 本地兜底与约束 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P0** | **聚落初探侦查简报** | `scout` | 大区档案、周边 10× 地形分布、当地区域声望、本区灾厄等级、匹配的世界书词条 | 贴合地貌的聚落名、废土民生现状摘要、观众偏好演出、2–3 条集市物价/货源特征、1 条邻区或潜伏者传闻钩子 | `ScoutDialog` 流式渲染；JSON 失败时回退 `fallbackSettlementDetails` |
| **P0** | **篝火夜谈与 VN 剧场演绎** | `campfire` | 角色卡 `personality`/`goal`/`voice`、当前 `bond`/`morale`/`fatigue`、最近 3 条旅行日志与刚到访聚落 | 支持「自由对话」和「4–8 拍 `VnBeat[]` 短剧」（自动切 `expression`、内心独白 `thought`、2–3 个玩家抉择分支） | 驱动现有 `VnReader.tsx`；抉择后仅允许在 `bond ±3 / morale ±4` 安全盒内微调 |
| **P1** | **野外兴趣点/路途动态奇遇** | `encounter` | 兴趣点类型、地形、在场演员职业特长、随行奇兽特性、当前时间段 | 1 幕废土短遭遇场景 + 2–3 个带职业检定倾向的应对选项 + 各自生动的叙事结果 | 奖惩档位（如小损/中获）由本地事先给定预算池，LLM 只填剧情与挑选档位标签 |
| **P1** | **末世灾厄与「潜伏天使/伪装恶魔」故事蓝图** | `blueprint` | 区域背景、世界衰败度 `worldDecay`、世界书 `wb-blueprint-calamity-mechanism` 规则 | **动态生成不固化的局部蓝图**：1 个灾厄阶段表、1 名伪装成凡人职业的天使、1 名伪装成权贵/商人的恶魔、3 条隐晦破绽线索 | 线索随演出/载客/斥候直觉触发；只负责生成线索文本与终局对决台词，破局奖励/诱惑金币由规则锁定 |
| **P2** | **残响电台与蝴蝶效应风闻** | `rumor` | 玩家昨日关键行为（高声望义演、贩卖魔物娘、战区闯关等）与日结账册摘要 | 1–2 条带地方市井口吻的「残响电台短讯」或酒馆八卦 | 在日结后异步静默生成，失败则沿用 `rumors` 本地句库 |
| **P2** | **世外隐居终局群像尾声** | `ending` | 全程去过的地区、各区声望、每个团员最终等级与羁绊、留存奇兽性格与特性、是否接受过恶魔交易 | 为**每位同伴**与**每只奇兽**定制贴合本局记忆的个人结局 epilogue + 马戏团传世总评 | 写入 `RetirementProgress.ending`，逐段在结局卷轴呈现；无网时回退 `endingOps` 模板 |

##### 3.2 统一 LLM 底座与安全规范（`src/engine/llmService.ts` + `EngineConfigDialog.tsx`）
- **统一网关适配**：抽象 `callNarrativeLlm({ scope, systemPrompt, userPrompt, schemaHint, streamHandler })`，底层按 `EngineConfigDialog` 选择路由至 `src/engine/vertex.ts` 或标准 OpenAI `chat/completions` 兼容端点；接入 `src/engine/jsonRepair.ts` 对模型输出的半残 JSON 进行自动修复。
- **凭证与安全隔离**：API Key / Service Account JSON **仅保存在内存或显式标注风险的本地独立键值中**（`circus-caravan:llm:secret`），**绝不写入可导出的游戏存档 `CircusState` 或角色卡 JSON 中**；无可用凭证时顶部引擎徽章显示「离线模板模式」，所有功能无缝使用本地规则生成。
- **四大作用域独立配置**：升级 `EngineConfigDialog.tsx` 的 `prompts` 页签，把原本单文本框拆分为 `scout` / `campfire` / `blueprint` / `ending`（外加 `encounter` 与 `rumor`）的独立模板编辑、Token 上限预览及「单次测试生成」按钮，方便创作者调试文风。

---

### FILES TO CREATE OR MODIFY (PROPOSED IMPLEMENTATION BLUEPRINT)
- `src/types.ts` — **modify** — 补充 `LandmarkKind`、`FieldLandmark`、`RegionMap.landmarks`、`MacroRegion.reputation` / `reputationHistory`、`RegionCalamityBlueprint`、`LlmNarrativeConfig`、`RouteEvaluation.reachedLandmarkId` 及对应 `GameAction`。
- `src/domain/landmarks.ts` — **create** — 6 类野外兴趣点的生成规则、地形匹配约束与探索结算逻辑。
- `src/domain/reputation.ts` — **create** — 9 大地区声望档位计算、票房/旅店/关税修正系数与声望变动传导。
- `src/domain/regionGen.ts` & `src/domain/routeDraw.ts` & `src/domain/pathfinding.ts` — **modify** — 小地图生成时铺设兴趣点，支持路线停靠检测与自动寻路直达已发现兴趣点。
- `src/components/Cartography/mapIcons.ts` & `CartographyView.tsx` — **modify** — 绘制 6 类兴趣点铜版图章与迷雾遮罩，增加左侧卡片与地图交互入口。
- `src/components/Modals/LandmarkDialog.tsx` — **create** — 野外兴趣点探索与决策面板。
- `src/components/RecordsView.tsx` & `src/components/Shell.tsx` — **modify** — 展示当前大区声望徽章、九大地区声望矩阵，以及将 `#open-cardbox` 接入真实卡匣弹窗。
- `src/components/Modals/CardboxDialog.tsx` — **create** — 独立《巡游契约卡匣》管理界面（连接 `cardbox.ts` + `localfiles.ts` + 角色卡多身份复用指派）。
- `src/domain/cardAdapter.ts` & `src/rules/crewOps.ts` & `src/components/Modals/PerformerDialog.tsx` — **modify** — 支持将养成后的演员回存至卡匣、卡库客串 NPC 自动注入开关、从驻地好友邀约登车及防重复校验。
- `src/engine/llmService.ts` & `src/content/promptTemplates.ts` — **create** — 统一 LLM 调用层（复接 `vertex.ts` + OpenAI 兼容 + `jsonRepair.ts`）、按需世界书匹配注入、四大+二扩展作用域 Prompt 构造与离线降级。
- `src/components/Modals/EngineConfigDialog.tsx` & `ScoutDialog.tsx` & `PerformerDialog.tsx` — **modify** — 接入真实可选流式叙事、离线/在线模式切换、结构化侦查简报与 `VnReader` 动态剧情生成。
- `src/rules/persistence.ts` & `src/rules/state.ts` & `src/rules/act.ts` — **modify** — 老存档字段自动补全、新动作分发、确保持久化体量安全与凭证零泄露。
- `tests/s11-landmarks-reputation-cardbox-llm.test.ts` — **create** — 阶段先行测试（兴趣点分布与地形契合、声望档位经济影响、卡匣增删/回存/去重、LLM 上下文世界书裁剪与离线降级兜底）。

---

### EDGE CASES I WILL HANDLE
- **兴趣点不堵路、不落入海洋/不可达孤岛**：`landmarks.ts` 生成后利用路网连通性检查，确保每个兴趣点周围至少有 2 个可通行邻格且能从区域主城 BFS 到达。
- **跨区声望极低不至于卡死整局**：声望最低仅封锁正规聚落优惠与增加哨站盘查罚金，永远保留 `smuggler_cove` 黑市渡口与邻区避风口，以及通过义演、救济流民或运送紧急物资洗白翻盘的路径。
- **大尺寸角色卡立绘防爆存储**：上传或回存卡匣前统一压缩立绘，`CircusState` 存档只保存轻量索引或压缩图，避免超限导致自动存档失败。
- **LLM 幻觉数值与密钥泄露防护**：LLM 输出的 JSON 若出现越界数值（如一次 +99999 金币）会被 `llmService.ts` 的白名单夹逼或拒绝；导出存档与角色卡时强制剥离任何引擎配置与密钥字段。

---

### EDGE CASES I AM NOT HANDLING (out of scope)
- **实时多模态语音 TTS 与 AI 实时生图**：本阶段立绘仍采用本地导入图片、`GirlPortrait` 与 `CreaturePortrait` 程序化矢量渲染，暂不接入生图/TTS 计费接口。
- **跨玩家云端角色卡市场**：角色卡复用聚焦本地卡匣、`data/cards/` 目录与单机 `.json` 导入导出，不搭建在线服务器。

---

### ASSUMPTIONS
- 与 [plan-010.md](./plan-010.md) 可以按顺序先落 `plan-010`（一日循环 + 委托 + 拍卖 + 隐居闭环）再落 `plan-011`，也可以在审核确认后拆分为「11A：兴趣点 + 区域声望」「11B：角色卡匣复用」「11C：LLM 叙事底座接入」三个小 PR 依次推进以控制单次变更风险。
- 本地离线演示优先：即便玩家不配置任何 API Key，所有新加入的兴趣点、声望系统、角色卡复用和故事蓝图仍可通过本地确定性生成器完整游玩。
