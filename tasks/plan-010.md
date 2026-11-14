# Plan-010 · 一日循环与生存压力、货运客运委托、拍卖行、隐居结局闭环方案

> **目标隔离分支**：`superpowers/day-cycle-contracts-retirement`（待人工审核确认后从 `main@8484d8b` 切出，不触碰 `main`）
> **当前阶段**：Superpowers Stage 1（仅输出书面计划至 `tasks/plan-010.md` 供人工审核，**尚未修改任何业务、渲染或样式代码**）

---

## PLAN
════

### TASK
把当前「地图原型 + 图鉴 + 驻地小循环」升级为**真正能玩通一局**的完整生存循环：1) 建立 `拂晓 → 正午 → 暮色 → 夜演` 四时段推进与**日结结算**内核，让 `day` / `timeSlot` 真正流动；2) 让口粮、兽料、工资、载具磨损、士气、世界衰败成为**每日扣账的生存压力**，断粮欠薪会产生可感知惩罚；3) 提供一本装帧完整的**《日结账册》结算面板**，逐项展示收支与警示；4) 把驻地里两个当前只会弹提示的空壳建筑——`guild_station`（货站）与 `auction_market`（拍卖行）——做实为**货运/客运委托板**与**奇兽拍卖行**；5) 打通 `retirement.ending` 字段，实现**赚够钱后带成员隐居**的结局卷轴。

---

### ROOT-CAUSE DIAGNOSIS & APPROACH

#### 1. 时间内核缺失：`day` 恒为 1、`timeSlot` 恒为 `dawn`
- **根因定位**：`src/rules/state.ts` 初始化 `day: 1, timeSlot: 'dawn'` 后，全仓无任何 action 会推进它们；`Shell.tsx:214` 的 `slotLabel` 与 `encounters.ts` 的 `nightBonus` 都读取 `state.timeSlot`，因此野外夜行加成、每日风闻刷新、期限委托这些设计全部处于死代码状态；`caravanMath.dailyUpkeep()` 已被写出却无人调用。
- **实施方案**：
  - 新建 `src/domain/calendar.ts`：`TIME_SLOT_ORDER`、`TIME_SLOT_LABELS`、`nextTimeSlot(slot)`、`isDayRollover(slot)`、`describeClock(day, slot)`。
  - 新建 `src/rules/timeOps.ts`：新增动作 `advanceTimeSlot`（推进一时段，`night → dawn` 时自动跨日）与 `endDay`（直接跳到次日拂晓）。
  - 日结 `applyEndDay(state)` 依次结算：`dailyUpkeep` 扣除口粮/兽料/工资 → 载具耐久 `-= 2 + 载重系数` → 全员疲劳 `-20`、士气自然回归 → `worldDecay += 1`、势力摩擦推进 → 刷新 1–2 条 `rumors` → 委托期限校验 → 产出 `DayLedger` 写入 `state.lastLedger`。

#### 2. 生存压力未落账：断粮、欠薪、车毁都没有后果
- **根因定位**：`Supplies` 的六项物资只在采购时增加、在旅店/演出时零散扣减，`dailyUpkeep()` 返回的 `rations/fodder/wages` 从未被消费，导致「衰败中挣扎生存」的压迫感完全不成立。
- **实施方案**：
  - **断粮**（`rations < 需求`）：按缺口比例施罚——全员 `hp -8`、`morale -10`、`caravan.morale -12`，并在账册标红「饥饿」。
  - **断料**（`fodder < 需求`）：驯兽 `loyalty` 下降，随机一只野兽 `hp -10`，越笼风险提示。
  - **欠薪**（`gold < wages`）：`morale -15`、`fame -3`，并以 20% 概率触发一名招募候选退出招募池（不直接删主力成员，避免挫败过大）。
  - **车毁**（`durability <= 0`）：该车厢不再提供载重/座位/笼位，`computeCaravanCapacity` 与 `usedWeight/usedSeats` 自动生效，需在驻地修车。

#### 3. `guild_station` 与 `auction_market` 是只会弹提示的空壳
- **根因定位**：`ScoutDialog.tsx:311` 的货站按钮只调用 `onNotify` 弹一句文案；`ScoutDialog.tsx:318` 的拍卖行只渲染 `baseAuctionValue` 静态底价。而 `FreightContract` / `PassengerContract` / `AuctionListing` 三套类型与 `usedWeight()` / `usedSeats()` 校验函数**早已写好但无人使用**。
- **实施方案**：
  - 新建 `src/domain/contracts.ts`：`generateFreightOffers()`（2–3 条，报酬 = 距离 × 危险度 × 重量，`deadlineDay = day + 3~6`，含 `fragile` / `contraband` 标记）、`generatePassengerOffers()`（1–2 名乘客，带 `storyHook`）、`acceptFreightOrder()` / `acceptPassengerOrder()`（校验 `usedWeight` / `usedSeats`）、`deliverContractsAt()`（抵达目的地聚落交付结算）、`expireContracts()`（日结时逾期判负：`status='failed'`、`fame -8`、违约金）。
  - 新建 `src/domain/auction.ts`：`computeAuctionQuote()`（按物种稀有度、等级、驯服度、本区稀缺度定价，`±15%` 日内浮动）、`generateAuctionLots()`、`sellBeastToAuction()`。
  - `ScoutDialog` 的 `guild_station` 面板改为**委托告示板**（货运/客运双页签、载重与座位余量表、接单/交付按钮），`auction_market` 面板改为**拍卖行**（可卖奇兽列表 + 报价 + 当日挂单）。违禁品跨区有 25% 被边境卫队查获（没收 + 罚款）；出售魔物娘会降低 `dawn_order` 声望。

#### 4. 隐居结局只有数据结构，没有达成入口
- **根因定位**：`canRetire()` 已实现、`RetirementProgress.ending` 已定义、`RecordsView` 已显示进度条，但 `GameAction` 里没有 `retire`，`phase` 永远不会变成 `'retired'`，玩家攒够钱无处可去。
- **实施方案**：
  - 新建 `src/rules/endingOps.ts`：`computeRetireTier()`（`gold >= target` → `modest`；`>= 1.5×` → `prosperous`；`>= 2.5×` 且 `fame >= 80` → `legendary`）、`applyRetire()`（选隐居地 → 依 `bond` / `role` / `traits` 生成每位同伴的 `epilogue`、每只驯兽的 `epilogue` 与总 `narrative` → `phase = 'retired'`）。
  - 新建 `src/components/Modals/RetirementDialog.tsx`：双选「静谧农庄」/「隐世山谷」，展示预计层级、同行名单与收摊条件核对表；确认后切换为**结局卷轴**（`#ending-scroll`，打字机逐段显影，可滚动回顾）。
  - `phase === 'retired'` 时 `App.tsx` 以结局卷轴取代主界面，仅保留「开始新的巡游」。

#### 5. 结算与时间缺少可见呈现
- **实施方案**：
  - `Shell.tsx` 顶栏显示 `第 {day} 日 · {拂晓|正午|暮色|夜演}` 与日月进度弧；底栏新增 `#end-day-btn`「结束今日」（`Sunset` 图标，行军动画中禁用）。
  - 新建 `src/components/Modals/DayLedgerDialog.tsx`：羊皮账册版式，含「金币 期初 → 收入 → 支出 → 期末」流水、六项物资消耗表、士气/疲劳/耐久变化条、新增风闻、红字警示；数字 count-up 与行 stagger 淡入。
  - 夜间时段在 canvas 上叠加一层低成本的暖灯笼光与更深雾色，强化时段感知（仅调色，不加滤镜）。

---

### FILES TO CREATE OR MODIFY
- `src/domain/calendar.ts` — **create** — 时段序列、标签、跨日判定与时钟文案。
- `src/rules/timeOps.ts` — **create** — `advanceTimeSlot` / `endDay` / 日结结算与生存惩罚。
- `src/domain/contracts.ts` — **create** — 货运/客运委托生成、接单、交付、逾期与违禁品查获。
- `src/domain/auction.ts` — **create** — 拍卖报价、当日挂单、卖出结算。
- `src/rules/endingOps.ts` — **create** — 隐层级判定与结局 epilogue 生成。
- `src/components/Modals/DayLedgerDialog.tsx` — **create** — 日结账册面板。
- `src/components/Modals/RetirementDialog.tsx` — **create** — 隐居选择与结局卷轴。
- `src/components/Modals/ContractBoard.tsx` — **create** — 货站委托告示板（货运/客运双页签）与拍卖行面板。
- `src/types.ts` — **modify** — 新增 `DayLedger`、`DayLedgerLine`，`CircusState` 增 `lastLedger?`，`GameAction` 增 `advanceTimeSlot` / `endDay` / `retire` / `acceptFreightOrder` / `acceptPassengerOrder` / `deliverContract` / `sellBeast`。
- `src/rules/act.ts` & `src/rules/state.ts` & `src/rules/persistence.ts` — **modify** — 挂载新动作；`lastLedger ??= undefined` 兼容老存档。
- `src/components/Modals/ScoutDialog.tsx` — **modify** — 把 `guild_station` / `auction_market` 两个提示壳替换为委托板与拍卖行。
- `src/components/Shell.tsx` — **modify** — 时间 HUD、`#end-day-btn`、隐居入口 `#retire-entry-btn`。
- `src/components/Cartography/mapRenderer.ts` — **modify** — 夜间时段暖光与深雾叠加层。
- `src/App.tsx` — **modify** — 新增 `ledger` / `retirement` 两个 modal 状态机与 `phase === 'retired'` 分支。
- `src/styles/parchment.css` — **modify** — 账册、委托板、拍卖行、结局卷轴四套版式与微动效。
- `tests/s10-day-loop-contracts-ending.test.ts` — **create** — Stage 3 先行测试。
- `package.json` — **modify** — 将 s10 测试加入 `pnpm test`。

---

### EDGE CASES I WILL HANDLE
- **跨日与行军冲突**：`traveling` 状态下禁止 `endDay`，行军动画结束后才可收摊，避免读到半途坐标。
- **一夜连扣两次**：`advanceTimeSlot` 在 `night → dawn` 时只结算一次日结，`endDay` 内部复用同一函数，重复点击用 `day` 比对幂等。
- **老存档兼容**：缺 `lastLedger` / 委托数组为空 / `retirement.ending` 缺失时一律走默认值，不弹错。
- **载重与座位超卖**：接单前用 `usedWeight()` / `usedSeats()` 实时校验，超限禁用按钮并给出差额提示。
- **车毁后委托无法完成**：逾期判定放在车毁判定之后，避免同一天既扣违约金又误吞已送达订单。
- **结局后存档只读**：`phase === 'retired'` 时屏蔽行军、接单、结算入口，仅可回顾卷轴或新开一局。

---

### EDGE CASES I AM NOT HANDLING (out of scope)
- **真实日历（月份/季节/节日事件）**：本阶段只有「第 N 日」，季节与节庆留待后续。
- **拍卖行竞价对局与 NPC 抬价**：只做一口价挂单买断，不做多轮叫价。
- **崩团（全员覆灭）结局分支**：破产只做红字危机警示，不强制结束游戏。

---

### ASSUMPTIONS
- 一「日」固定 4 个时段，日结按整日一次性扣账，不做逐时段计费，以保证数值可读、节奏不碎。
- 隐居门槛沿用 `retirement.targetGold` 与 `canRetire()` 现有判定，只在层级与文案上做分层扩展。
- 全部结算与委托逻辑为纯前端确定性演算（`hashInt` / `createRng` 播种），不引入任何后端或网络调用。
