# Plan-008 · 地形卡左下角定位修复、无限次续画修复、全量生物图鉴与缺省立绘、宝可梦式属性/性格/特性与随机捕捉方案

> **目标隔离分支**：`superpowers/bestiary-taxonomy-capture`（待人工审核确认后从当前进度切出，不触碰 `main`）  
> **当前阶段**：Superpowers Stage 1（仅输出完整书面计划至 `tasks/plan-008.md` 供人工审核，**尚未修改任何业务、渲染或测试代码**）

---

## PLAN
════

### TASK
解决两项体验故障并落地三大图鉴与捕捉养成机制：1) 将右键地图地形详情卡迁移至屏幕左下角并限定最大高度内滚动，防止超出屏幕显示不全；2) 彻底根治分次续画到第 3 笔重置的 Bug，实现任意次数分段续画；3) 构建完整的「奇兽与魔物娘图鉴」界面并给全量 84 种生物配齐程序化缺省立绘与详尽描述；4) 参考宝可梦属性系统构建六大元素属性归类与克制/亲和关系；5) 参考宝可梦性格与特性系统，为每只捕获/初始个体赋予随机性格与特性，并接入真实随机捕猎检定。

---

### ROOT-CAUSE FIXES & APPROACH

#### 1. 地形详情卡改为左下角固定定位（防溢出截断）
- **问题根因**：原 `.octo-poi-popover` 仅设置 `bottom: 58px` 且未限制 `max-height`，内容较多时向上/向下撑出视口且位置偏中左与底部读数条拥挤。
- **修复方案**：
  - 为 `#map-terrain-inspect-note`（及 `#map-poi-quick-note`）在左下角设置专属锚定容器 `.octo-bottom-left-card`：`position: fixed; left: 18px; bottom: calc(var(--helm-h) + 18px); width: 328px; max-height: min(370px, calc(100vh - 130px)); overflow-y: auto; z-index: 26;`；
  - 底部坐标读数条 `.octo-bottom-hud` 在卡片展开时留出左侧避让间距，保证卡片 100% 完整呈现在屏幕左下角、绝不溢出裁切。

#### 2. 彻底根治「分次续画第 3 笔重置」Bug（增量拼接架构）
- **根因诊断**：
  - 原 `useRouteSketch.ts` 每次新落笔时把 `routeDraft.validPoints`（已经按 `0.33` 格间隔重采样过的上百个密集点）整条重新塞回 `evaluateRouteStroke` 重新采样；经过两三笔累计后，浮点线性插值 `a.x + (b.x - a.x) * t` 在贴近河岸或格边处产生 `1e-15` 级浮点偏移，导致重测旧段时 `Math.floor` 跨入隔壁不可通行格，引发整条已画路线被突然截断重置！
- **根治方案（不可变前置段 + 增量评估）**：
  - 在 `routeDraw.ts` 新增纯函数 `mergeRouteEvaluations(base, extension)`：
    - `base`（之前已经验证通过的路线 `routeDraft`）的 `validPoints` 与里程/消耗在后续落笔时**完全冻结不可变，绝不再回炉重算**；
    - 新一笔落笔时，只针对从 `base.validPoints[last]` 到新笔迹点列 `[tail, ...newStroke]` 调用 `evaluateRouteStroke`，再将两段有效点列、里程、天数、口粮、灯油与磨损安全合并；
    - 由此彻底消除多笔叠加后的浮点漂移重置与 `O(N)` 重复采样卡顿，支持连续分 3 笔、10 笔乃至绕完整张地图画线。

#### 3. 奇兽与魔物娘全量图鉴 + 程序化缺省立绘（`CreaturePortrait.tsx` + `BestiaryDialog.tsx`）
- **全量程序化缺省立绘（`src/components/CreaturePortrait.tsx`）**：
  - 为所有 84 种图鉴条目提供专属矢量图鉴插画组件：
    - 依据生物 `category`（`beast` / `monstergirl` / `demon_army` / `domesticated` / `elite`）与 `id` 关键词（狐、狼、猫、兔、蛇、蛛、龙、鹿、鸟/枭/狮鹫、水母/鲸/鱼、熊/狮、甲虫/发条/鼠、史莱姆/魅魔/天使等）组合渲染高辨识度古典羊皮铜版风剪影徽章（猫耳/狐尾/龙角羽翼/鹿角花冠/蛇尾/圣甲虫鞘翅等形态差异）+ 元素属性光环底纹；
    - 同步嵌入 `SuppliesView` 兽笼卡片、`BeastDialog` 培养弹窗、右键地形勘测生物列表与图鉴界面，彻底消除无立绘空白感。
- **完整图鉴模态框（`src/components/Modals/BestiaryDialog.tsx`）**：
  - 从右侧栏/物资兽笼页与左侧选单（「奇兽图鉴」）直达；
  - 顶部展示图鉴收集进度条（已遭遇 / 84 种）与六大宝可梦式属性过滤标签 + 分类过滤 + 仅看已遭遇开关；
  - 未遭遇物种显示神秘墨影轮廓与栖息地区线索；已遭遇物种完整展示程序化立绘、元素属性归类、栖息地形、基础拍价、日常食谱/产出、被动增益及详细图鉴描述。

#### 4. 参考宝可梦属性系统进行生物归类（`src/domain/creatureTaxonomy.ts`）
- 建立六大宝可梦式属性体系（`starlight` 星潮系、`flame` 炽焰系、`frost` 冰霜系、`spore` 草孢系、`iron` 钢机系、`void` 幽冥系）：
  - 定义清晰的属性中文名、专属色标、生态定位、**属性克制与抵抗矩阵**（`2.0×` 效果拔群 / `0.5×` 收效甚微 / `1.0×` 普通）及**舞台演出协同倾向**；
  - 在图鉴、右键勘测与培养窗口直接展示每个物种的属性徽章及克制/弱点速查。

#### 5. 参考宝可梦性格与特性系统 + 野外随机捕捉（`src/domain/naturesAndCapture.ts`）
- **12 种宝可梦式性格（`CreatureNature`）**：如 `温顺`（极易驯服）、`固执`（战力 +15% 但较难捕捉）、`胆小`（易逃窜但省料）、`爽朗`（魅力 +10%）、`勇敢`、`内敛`、`认真`、`淘气`、`悠闲`、`急躁`、`怕寂寞`、`温和`——直接修正个体观赏度/战力与捕捉成功率系数；
- **12 种宝可梦式个体特性（`CreatureAbility`）**：如 `乐天`（捕获率 +18%）、`逃跑`（未控前捕获率 -18%）、`威吓`（战力 +12% 但警惕度高）、`魅惑之躯`（魅力 +15%）、`拾荒`、`适应力`、`静电`、`火焰之躯`、`结实`、`芳香幕`、`不屈之心`、`锐利目光`；
- **随机捕捉检定动作（`attemptWildCapture`）**：
  - 支持玩家在右键勘测已遭遇野生生物时（消耗 `1` 张 `tamingNets` 捕获网，或额外投入 `1` 份 `props` 彩粉诱饵提升捕获率）发起真实随机捕捉；
  - 结合「物种捕获难度 + 性格倍率 + 特性倍率 + 队内驯兽师/控制技能加成 + 诱饵加成」计算精确捕获概率并做三段摇晃式随机判定；捕获成功即刻随机 roll 出该个体的**性格 + 特性 + 轻微个体属性浮动**装入马车兽笼！

---

### FILES TO CREATE OR MODIFY
- `src/types.ts` — **modify** — 为 `Beast` 补充 `natureId`、`abilityId`、`caughtRegionId` 字段，新增 `attemptWildCapture` 动作类型。
- `src/domain/creatureTaxonomy.ts` — **create** — 六大宝可梦式属性归类表、克制/抵抗倍率矩阵与生态分类标签。
- `src/domain/naturesAndCapture.ts` — **create** — 12 种性格、12 种特性、捕捉概率演算与随机捕获掷骰函数（纯函数，支持传入确定性/随机种子）。
- `src/domain/routeDraw.ts` — **modify** — 新增 `mergeRouteEvaluations` 实现不可变前段 + 增量后段拼接，彻底根除第 3 笔重置。
- `src/rules/crewOps.ts` & `src/rules/act.ts` & `src/rules/state.ts` & `src/rules/persistence.ts` — **modify** — 实现 `applyAttemptWildCapture`（检查兽笼空位、扣除捕获网、随机判定并生成带性格与特性的个体），为起手生物/旧存档补齐默认性格与特性。
- `src/components/CreaturePortrait.tsx` — **create** — 84 种奇兽与魔物娘的程序化矢量缺省立绘渲染组件。
- `src/components/Modals/BestiaryDialog.tsx` — **create** — 支持属性归类、分类筛选、进度统计与详细图鉴描述的图鉴总览弹窗。
- `src/components/Modals/BeastDialog.tsx` — **modify** — 接入程序化立绘、宝可梦式属性克制徽章、个体性格（正负修正）与特性详情展示。
- `src/components/Cartography/useRouteSketch.ts` — **modify** — 接入 `mergeRouteEvaluations` 冻结旧段增量续画，确保任意次落笔永不重置。
- `src/components/Cartography/CartographyView.tsx` — **modify** — 将地形勘测卡移至左下角固定防溢出容器，展示属性标签并支持对曾经遇到的奇幻生物一键发起随机捕捉。
- `src/components/SuppliesView.tsx` & `src/components/Shell.tsx` & `src/App.tsx` — **modify** — 兽笼卡片渲染立绘与性格特性徽章，新增「奇兽图鉴」入口按钮，挂载 `BestiaryDialog`。
- `src/styles/parchment.css` — **modify** — 左下角地形卡片防溢出样式与图鉴网格/属性克制胶囊样式。
- `tests/s8-bestiary-taxonomy-capture.test.ts` — **create** — Stage 3 先行测试：覆盖左下角防溢出定位、连续 4 次以上分次续画绝不重置、84 种图鉴立绘与描述完备性、宝可梦属性克制矩阵、性格/特性随机分布及捕猎概率随机检定。
- `package.json` — **modify** — 将 `tests/s8-bestiary-taxonomy-capture.test.ts` 纳入 `pnpm test`。

---

### EDGE CASES I WILL HANDLE
- **连续分 4+ 笔续画包含途中红线阻断、缩放和平移**：无论中途是否缩放平移或某笔擦到河岸，已画有效前段始终冻结保留，第 3、4、5 笔永远从有效末端平稳延长。
- **左下角地形详情卡在小高度窗口（如 `720px`）下显示**：限定 `max-height` 并开启内部平滑滚动，绝不顶出窗口顶部或被底部黑条遮盖。
- **兽笼满格或捕获网不足时尝试捕捉**：规则层先行拦截并给出明确内部 toast 提示，不扣捕获网。
- **`check-imports.mjs` 模块限行与依赖隔离**：`creatureTaxonomy.ts` 与 `naturesAndCapture.ts` 独立置于 `src/domain/`，单文件严格 `≤ 450` 行、无环。

---

### EDGE CASES I AM NOT HANDLING (out of scope)
- **手动手绘 84 张外部高清 PNG 静态立绘文件**：当前采用程序化矢量分层 SVG 缺省立绘全覆盖 84 种图鉴，同时保留未来替换为外部 PNG/WebP 图片资产的兼容结构。

---

### ASSUMPTIONS
- 右键点击地图显示地形详情与曾经遇到的奇幻生物时，玩家可以直接对曾在该地形遇到的物种消耗捕获网尝试随机捕捉（方便即时验证性格、特性与捕获随机性），后续仍可扩展独立野外遭遇遭遇战流程。
