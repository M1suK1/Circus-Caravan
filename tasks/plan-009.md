# Plan-009 · 地形卡左下角修复、撤回上一段墨线、图鉴当前区域筛选、疆域边界山脉与水体集中生成方案

> **目标隔离分支**：`superpowers/border-mountains-and-polish`（待人工审核确认后从当前进度切出，不触碰 `main`）  
> **当前阶段**：Superpowers Stage 1（仅输出书面计划至 `tasks/plan-009.md` 供人工审核，**尚未修改任何业务、渲染或样式代码**）

---

## PLAN
════

### TASK
解决实机视觉走查发现的五项问题：1) 修复 `.paper-note` 层叠覆盖导致地形详情卡显示在左上角并被顶部裁切的 CSS 定位 Bug，使其真正稳稳显示在左下角且完整可见；2) 增加「擦除/撤回上一段墨线」功能，支持分次画线错画时单步回退；3) 在奇兽与魔物娘图鉴中新增「当前区域会出现」筛选开关；4) 重构世界与区域山脉生成逻辑，清除大陆中央成片不可通行高山堵路的问题，将山脉集中沿 9 大疆域边界线生成并留出通行山口；5) 消除除「沉没泽国」外其他地区散落零碎水体块的现象，改为集中成完整湖泊或连续河流，并大幅降低「焚沙裂谷」的水体生成概率。

---

### ROOT-CAUSE DIAGNOSIS & APPROACH

#### 1. 修复地形详情卡未显示在左下角且被顶栏裁切的 CSS 层叠 Bug
- **实机截图根因定位**：
  - 在 `parchment.css` 中，`.octo-bottom-left-card`（第 207 行）定义在 `.paper-note`（第 967 行）之前，两者同为单类选择器（优先级 `(0, 1, 0)`），导致后声明的 `.paper-note { position: relative }` 彻底覆盖了 `.octo-bottom-left-card { position: fixed }`；
  - 节点退化为在 `.octo-map-hud` 顶部按 `position: relative; bottom: 54px` 向上偏移 `-54px`，从而被压在左上角「选单」底下并超出屏幕顶部裁切！
- **根治方案**：
  - 将 `.octo-map-hud > .octo-bottom-left-card` 移至 `.paper-note` 规则之后并显式锁定 `position: fixed; left: 16px; bottom: calc(var(--helm-h) + 48px); width: 336px; max-height: min(350px, calc(100vh - var(--helm-h) - 86px)); overflow-y: auto; z-index: 28;`；
  - 使其真正悬浮在左下方坐标条上方与左侧「选单」下方之间，即使在低分辨率桌面窗口也 100% 完整可见、互不遮挡。

#### 2. 增加「擦除/撤回上一段墨线」功能（`App.tsx` + `Shell.tsx` + `useRouteSketch.ts`）
- **交互与历史栈设计**：
  - 在 `App.tsx` 维护 `routeHistory: RouteEvaluation[]`（每次手工完成新的一笔续画或触发「沿主道寻路」时，将画前的 `routeDraft` 压入历史栈；点击「擦除墨线」或完成行军时清空栈）；
  - 在底部操作栏 `HelmBar`（`Shell.tsx`）的「擦除墨线」旁新增 **`撤回上段`（`#route-undo-btn`）** 按钮，同时支持在地图上按 `Ctrl+Z` / `Backspace` 快捷键撤回最近一段墨线，恢复到上一笔末端的完整状态（若只有最后一段则清空草稿）。

#### 3. 图鉴支持筛选当前区域会出现的生物（`BestiaryDialog.tsx`）
- 在 `BestiaryDialog.tsx` 的筛选条中新增 **`仅看当前大区（${regionName}）`** 勾选/胶囊开关（`#bestiary-only-region`）以及可选大区下拉筛选器，基于 `species.habitatRegions.includes(state.world.currentRegionId)` 精准过滤出本地区可遭遇的全部奇兽、野生魔物娘、魔王军成员、驯化亚人与区域精英。

#### 4. 优化世界与区域山脉生成逻辑：消除中部堵路大山，山脉沿疆域边界分布（`worldTectonics.ts` + `worldProvinces.ts` + `worldGen.ts` + `regionGen.ts`）
- **实机根因定位**：
  - `worldTectonics.ts` 先前在大陆中心放置了两条穿过 `(64, 64)` 的造山带 `orogenyA / orogenyB` 且基础板块高度叠加过厚，导致中心区域（如人类帝国、魔法都市、锈铁荒原）大片地形 `h >= 0.91` 变成不可通行的连片高山；
  - `regionGen.ts` 又按地区 `terrainWeights` 在内部随机撒山，加剧了区域中部路网被山体阻断的问题。
- **自然地理重构方案**：
  - **1) 舒缓大陆内陆**：将 `buildTectonicContinent` 内陆高程控制在 `0.36 ~ 0.84` 之间（仅保留温和丘陵起伏，移除横穿大陆腹地的 `orogenyA/B` 高山墙），保证各区内部腹地开阔通畅；
  - **2) 沿疆域边界造山（`carveBorderMountains`）**：在 `partitionRegionsGeodesic` 划分出 9 大自然疆域之后，计算陆地格到「相邻省界」的曼哈顿距离 `borderDist`：
    - 在 `borderDist <= 2`（以及少量延伸支脉 `borderDist === 3`）的省界分水岭带上，叠加连绵分形山脊噪声生成自然界山脉，而在内部核心区（`borderDist >= 4`）严禁生成大块高山；
    - 保留河流切割山口（不覆盖 `isRiver` / `isLake`）及每条省界约 `30%` 的低矮山口通道，确保跨区边境关口与主干道自然穿行山口、连通顺畅；
  - **3) 区域 10× 小地图同步护航**：`regionGen.ts` 严格继承世界图边界山脉分布，移除区域内部随机撒出孤立堵路山体的逻辑，并确保 `border_gate` 与 `road` 周围连通无死锁。

#### 5. 集中水体为完整湖泊/连续河流，并降低「焚沙裂谷」水体概率（`regionGen.ts` + `worldTectonics.ts` + `content/regions.ts`）
- **零碎水体根因**：原 `regionGen.ts` 通过 `sampleEcoTerrain(profile.terrainWeights, n)` 按噪声带宽采样生成 `lake`，导致除沉没泽国外各大区也出现大量散碎小水洼。
- **水系集中方案**：
  - **禁止噪声散撒零碎水体**：除 `sunken_marsh`（沉没泽国）保留沼泽湿地水洼外，其余 8 个地区在 `sampleEcoTerrain` 中完全剔除 `lake` 随机散点，陆地底图仅保留可通行生态；
  - **集中成湖或河**：各区水体严格来源于世界地图连续河流廊道、世界地图大湖泊（10× 平滑扩圈），以及必要时由 `carveConcentratedLakes` 在远离主城道路的盆地生成 `0–1` 座边缘平滑、面积集中的独立大湖；
  - **`sand_oasis`（焚沙裂谷）极端控水**：在 `worldTectonics.ts` 生成世界湖泊与河流时避让/降权西南干旱沙域（`sand_oasis` 极低水体触发率），且在 `regionGen.ts` 中将 `sand_oasis` 仅保留极低概率（如 `25%` 概率生成 1 处小绿洲泉眼）并剔除杂散水域，契合赤沙干旱设定。

---

### FILES TO CREATE OR MODIFY
- `src/styles/parchment.css` — **modify** — 将 `.octo-map-hud > .octo-bottom-left-card` 移至 `.paper-note` 之后并固定左下角布局，彻底解决左上角裁切 Bug。
- `src/App.tsx` & `src/components/Shell.tsx` & `src/components/Cartography/CartographyView.tsx` — **modify** — 新增 `routeHistory` 栈、`onUndoRoute` 动作、`#route-undo-btn`「撤回上段」按钮与 `Ctrl+Z` / `Backspace` 快捷键；区分 `useRouteSketch`「仅拖动中更新」与「抬笔提交段入栈」。
- `src/components/Modals/BestiaryDialog.tsx` — **modify** — 新增「仅看当前大区」筛选控制与大区选择器。
- `src/domain/worldTectonics.ts` & `src/domain/worldProvinces.ts` & `src/domain/worldGen.ts` & `src/domain/regionGen.ts` & `src/content/regions.ts` — **modify** — 取消大陆中心 `orogenyA/B` 造山带，新增 `applyBorderMountains` 将山脉集中生成在 9 大疆域边界分水岭（保留山口与河谷）；集中除沉没泽国外各区水体为完整湖泊/连续河流并大幅降低焚沙裂谷水体生成概率。
- `tests/s9-border-mountains-undo-polish.test.ts` — **create** — Stage 3 先行测试：校验 `.octo-bottom-left-card` 优先级高于 `.paper-note` 且固定左下角、路线撤回上段历史栈与按钮、`BestiaryDialog` 当前大区筛选、世界地图山脉主要分布在疆域边界而非大陆腹地，以及非沉没泽国水体集中不成散点且焚沙裂谷低水体占比。
- `package.json` — **modify** — 将 `tests/s9-border-mountains-undo-polish.test.ts` 加入 `pnpm test`。

---

### EDGE CASES I WILL HANDLE
- **拖动中的实时预览不污染历史栈**：只在 `onPointerUp`（完整画出新的一段墨线）或自动寻路时将画前草稿压入历史栈，避免每帧 `pointermove` 产生上百条无效历史记录。
- **跨区边境关口不被边界山脉堵死**：`applyBorderMountains` 在省界线上用低频通道掩码留出山口，`regionGen.ts` 选定 `border_gate` 时避开山脊并在跨河/近山时顺势开辟通行走廊。
- **老浏览器/不同高度桌面窗口左下角不遮挡坐标读数**：`.octo-bottom-left-card` 锚定在 `bottom: calc(var(--helm-h) + 48px)`，恰好位于底部坐标条上方。

---

### EDGE CASES I AM NOT HANDLING (out of scope)
- **无限次历史重做（Redo）栈**：仅提供「撤回上段」与「擦除墨线」，满足分次画线微调需求。

---

### ASSUMPTIONS
- 「让山尽量生成在疆域边界处」允许在省界分水岭保留约 `25%~35%` 的低矮山口通道，以保证大篷车可以通过边境关口与主干道顺利往来邻区。
