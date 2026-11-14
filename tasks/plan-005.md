# Plan-005 · 大陆全图像素锐化、区域连续无级缩放、夜糖同构左侧全身立绘角色档案与划线零偏移修复方案

> **目标隔离分支**：`superpowers/sharp-zoom-dossier-route`（待人工审核确认后从当前进度切出，不触碰 `main`）  
> **当前阶段**：Superpowers Stage 1（仅输出完整书面工程计划与根因诊断供人工审核，**尚未修改任何业务、渲染或样式代码**）

---

## PLAN
════

### TASK
解决四项核心体验与视觉问题：1) 消除大陆全图与疆域底图的插值模糊，恢复清晰锐利的像素边缘与高分铜版笔触；2) 打通「疆域全览 ↔ 跟随车队」之间的滚轮无级缩放与视野平移；3) 将角色详情弹窗重构为 `night-sugar-office` 同款的「左 38% 全高全身立绘舞台 + 右 62% 多标签角色档案」结构；4) 彻底根治地图划线半格坐标偏移、车队图标视觉偏置与斜向擦角误判红线问题。

---

### ROOT-CAUSE DIAGNOSIS & APPROACH

#### 1. 大陆全图与疆域图清晰像素锐化（Nearest-Neighbor Crisp Pixels + Screen-Space Ink）
- **模糊根因**：
  1. `mapRenderer.ts` 在绘制 `128×128` 世界离屏画布时开启了 `ctx.imageSmoothingEnabled = true`，将 `128×128` 栅格放大约 7–8 倍时触发浏览器双线性插值糊化，导致海岸线像素、水波纹像素与地形颗粒全部发虚；
  2. 此前将山峰与林木矢量线稿直接画在 `128×128` 极低分辨率离屏画布上再放大，线条变成模糊灰块；区域全览在 `viewW > 90` 时同样开启了平滑插值。
- **修复方案**：
  - 在 `drawWorldCanvas` 与 `drawRegionCanvas` 底图贴图阶段**强制全局 `ctx.imageSmoothingEnabled = false`**，并将目标绘制矩形 `px / py / drawW / drawH` 对齐整数物理像素，确保每一格大陆海岸、三重水波纹与地形色阶都呈现刀刻般清晰的像素边缘；
  - 将世界全图上的铜版山峰人字笔触、林冠墨弧与省界刻线改为在最近邻像素底图铺完之后、直接在**主画布高 DPI 屏幕坐标系**下绘制，兼得「清晰像素颗粒底图 + 锐利矢量手绘笔触」。

#### 2. 「疆域全览 ↔ 跟随车队」连续无级缩放与视角平移（Smooth Cursor-Centered Zoom & Pan）
- **改造方案**：
  - 扩展 `computeViewport` 支持连续缩放倍率 `regionZoom`（范围 `1.0×` 疆域全览 ～ `8.5×` 近景车队特写）与相机中心坐标 `cameraCenter: { x, y }`；
  - **鼠标滚轮以光标为中心无级缩放**：
    - 在疆域/跟随视图下滚动滚轮，按 `×1.18` 步进平滑缩放，并保持鼠标所指的地图格点在屏幕位置不动；当在 `大陆全图` 下向上滚轮放大时，自动切入当前疆域并聚焦放大；
    - 点击顶部预设按钮 `2 · 疆域 10×` 平滑复位至 `1.0×` 全域视野，点击 `3 · 跟随车队` 锁定大篷车坐标并放大至 `5.2×` 近景视野；
  - **悬浮缩放控制条与右键/中键拖拽平移**：
    - 在左上视距条旁新增古典铜框 `-` / 倍率读数与滑杆 / `+` / `定位车队` 按钮；
    - 左键拖拽保持「手绘行军路线」直觉不变，支持**鼠标右键拖拽或中键拖拽**自由平移放大后的地图视野（拖移时自动解除车队锁定，点「定位车队」或按 `3` 键一键回正）。

#### 3. 参考 `night-sugar-office` 重构角色详情界面（Left Full-Body Portrait + Right Multi-Tab Dossier）
- 对标 `night-sugar-office/src/components/CharacterDialog.tsx`（`.character-dossier` `38% : 62%` 双栏满高无边距结构），重写 `src/components/Modals/PerformerDialog.tsx` 与配套档案样式：
  - **左栏（38% 宽 · `.dossier-art` 全身立绘舞台）**：
    - 深色角色主题色径向聚光灯底幕（`--girl-color` 混色暗场）+ 内嵌细金画框线 + 同心圆星轨光环（`.portrait-orbit`）；
    - 左上角镌刻 `巡演契约档案 / {codename}`，中央高挑展示全尺寸全身立绘（`<GirlPortrait girl={performer} variant="full" bare />`），右下角斜盖火漆印章（`.dossier-seal` `残响 / 巡演`），底部附角色箴言及「导入/替换全身立绘」快捷入口。
  - **右栏（62% 宽 · `.dossier-content` 右侧角色信息与多分页档案）**：
    - 顶部展示眉题（`随行艺人档案 / {element} · {职业}`）、大号衬线姓名 `<h2>`、`Lv.01`、**`导出卡片` 按钮**（调用 `performerToCard` 导出可复用的 `.json` 角色卡）与右上关闭按钮；
    - 完整四分页标签栏（支持键盘左右方向键无障碍切换）：
      1. **状态概览**：职司/流派双栏身份卡、`体力 HP` / `演出士气` / `旅途疲劳` 三条计量槽、`团长信赖度` 大号数值徽章、特质词条与心愿目标；
      2. **演出技艺**：`魔术 / 洞察 / 敏捷 / 亲和` 四维属性横条、拿手剧目技能卡与日薪/席位明细；
      3. **外貌神情**：带专属图标与注解的 6 种表情差分切换砖块（点击即时联动左侧全身立绘表情）、外貌描述与演出服装描述检视及自定义立绘上传；
      4. **篝火夜谈**：保留并融入营地对话交互窗、快捷话题签与 VN 舞台短幕预览切换。

#### 4. 根治地图划线偏移与无障碍误判红线（Exact `[gx, gx+1)` Alignment & Corner-Graze Fix）
- **三大叠加根因定位**：
  1. **半格取整偏移（核心 Bug）**：底图像素格 `(gx, gy)` 在画布上实际占据 `[gx, gx + 1.0) × [gy, gy + 1.0)`（中心在 `gx + 0.5, gy + 0.5`），但 `routeDraw.ts` 第 133 行与光标检测使用了 `Math.round(sx)` 而非 `Math.floor(sx)`！导致当鼠标画在可通行格子右半侧（如 `x = 10.6`，视觉上仍在第 10 格陆地内）时，`Math.round(10.6) = 11` 被错误判定进隔壁第 11 格的河流或山脉，无端变红截断；
  2. **大篷车棋子视觉偏置与格角初始坐标**：此前 `mapRenderer.ts` 在驻扎聚落附近给大篷车图标人为加了 `wagonOffsetX = +22px` 的视觉右移，且 `state.ts` 初始坐标落在整数左上角 `(poi.x, poi.y)` 而非格心 `(poi.x + 0.5, poi.y + 0.5)`，造成玩家从大篷车图标起笔时，真实采样起点在图标左上方跳跃半格到一格，斜穿旁侧地形；
  3. **单格曼哈顿桥梁/窄路斜向擦角**：区域生成器生成的跨河木桥为四邻接折线单格宽，玩家手绘斜线跨桥时极易在两格交接角点擦到 `0.05–0.25` 格宽的河水像素而被判深水阻断。
- **根治方案**：
  - **统一格心与 `Math.floor` 寻址**：`routeDraw.ts`、`CartographyView.tsx` 光标读数统一改为 `Math.floor(sx)` / `Math.floor(sy)`；`state.ts` 出生点、`travelOps.ts` 跨区落点与 `App.tsx` 自动引线终点统一对齐格心 `(gx + 0.5, gy + 0.5)`；
  - **取消大篷车图标虚假位移**：`drawCaravanIcon` 严格绘制在真实逻辑坐标 `mapToCanvasPx(cx, cy, vp)` 正中心，实现「鼠标点在车上即从车心出墨线，指哪画哪零偏差」（驻扎聚落时改为将聚落黑针标牌微微上提避免文字重叠）；
  - **实时视口同步与斜向过桥擦角容差**：`useRouteSketch` 在指针按下瞬间即时同步当前画布尺寸与 `ViewportTransform`；在 `evaluateRouteStroke` 中加入窄桥/弯道边缘 `0.28` 格擦角吸附容差（仅当采样点紧贴格边且正交邻格为可通行桥梁/道路/陆地时平滑取用可通行邻格；真正画入河心、海面或山体内部依然立即红线截断告警）。

---

### FILES TO CREATE OR MODIFY
- `src/domain/routeDraw.ts` — **modify** — 将地形采样从 `Math.round` 修正为精确的 `Math.floor`，并加入单格桥梁/道路斜向擦角容差，消除可通行区域误报红线。
- `src/rules/state.ts` — **modify** — 初始大篷车驻扎坐标对齐聚落格心 `(x + 0.5, y + 0.5)`。
- `src/rules/travelOps.ts` — **modify** — 跨区入境落点对齐关口格心 `(x + 0.5, y + 0.5)`。
- `src/rules/crewOps.ts` & `src/rules/act.ts` & `src/types.ts` — **modify** — 增加 `setPerformerPortrait` 动作支持在角色档案左侧全身立绘栏直接上传替换角色立绘。
- `src/components/Cartography/mapRenderer.ts` — **modify** — 强制世界全图与疆域底图 `imageSmoothingEnabled = false` 锐利像素渲染、补齐高 DPI 屏幕空间山林笔触；扩展 `computeViewport` 支持连续 `regionZoom` 与相机平移 `camera`；移除大篷车虚假偏移确保划线起点 1:1 对齐。
- `src/components/Cartography/useRouteSketch.ts` — **modify** — 支持左键零偏移划线（按下时实时对齐视口变换）与右键/中键拖拽平移缩放视野。
- `src/components/Cartography/CartographyView.tsx` — **modify** — 接入滚轮以光标为锚点的无级缩放、悬浮缩放倍率加减与回正控件，并将光标地形检测统一为 `Math.floor`。
- `src/components/Modals/PerformerDialog.tsx` — **modify** — 重构为 `night-sugar-office` 同款「左 38% 全身立绘舞台 + 右 62% 四标签角色详情档案（状态概览 / 演出技艺 / 外貌神情 / 篝火夜谈 + 导出卡片）」。
- `src/App.tsx` — **modify** — 管理区域连续缩放倍率与相机跟随/自由平移状态，向 `PerformerDialog` 接入立绘更新与角色卡导出通知，自动引线对齐格心。
- `src/styles/parchment.css` — **modify** — 新增 `.character-dossier`、`.dossier-art`、`.portrait-orbit`、`.dossier-seal`、`.dossier-content`、`.dossier-tabs`、`.dossier-meter`、`.stat-bars` 等左立绘右档案样式及地图无级缩放控制条样式。
- `tests/s5-sharp-zoom-dossier-route.test.ts` — **create** — Stage 3 先行测试：覆盖全图像素锐化禁用平滑插值、区域连续无级缩放视口数学、`night-sugar-office` 左全身立绘右多标签档案结构、以及 `[gx, gx+1)` 格内边缘划线不误触隔壁不可通行格与斜穿单格桥不断红线断言。
- `package.json` — **modify** — 将 `tests/s5-sharp-zoom-dossier-route.test.ts` 纳入 `pnpm test`。

---

### EDGE CASES I WILL HANDLE
- **格子右/下边界 `[gx + 0.51, gx + 0.99]` 误判隔壁河流/山体**：通过 `Math.floor` 严格对应 `[gx, gx + 1)` 渲染像素框，在紧贴河岸的陆地格右半边（如 `x = 10.85`，隔壁 `11` 为河流）划线时 100% 识别为陆地而非河水。
- **真正画入深海/无桥大河/山脉中心仍必须可靠阻断**：擦角容差严格限制在紧贴格角 `< 0.28` 格且紧邻可通行格，不会允许车队横渡无桥宽河或穿山越海。
- **缩放时相机越界空白**：`computeViewport` 在任意缩放倍率（`1.0×` ～ `8.5×`）下自动将 `viewX / viewY` 钳制在 `[0, map.width - viewW]` 与 `[0, map.height - viewH]` 内，拖到边缘绝不脱出地图。
- **立绘图片体积与存储安全**：角色详情页上传自定义全身立绘时经过 `optimizeCardImages / compressImage` 压缩再写入状态，归档时由既有 `slimCircusAssets` 自动分片入 IndexedDB。

---

### EDGE CASES I AM NOT HANDLING (out of scope)
- **手机端双指捏合手势与窄屏竖排档案**：维持桌面端键鼠滚轮无级缩放与横屏双栏角色档案体验。

---

### ASSUMPTIONS
- 左键在区域/缩放地图上拖拽继续保持「直接手绘路线」的核心玩法手感，平移缩放后的视野通过鼠标滚轮定点缩放 + 右键/中键拖拽平移（或点「定位车队」回正）完成，两者互不干扰。

---

### STAGE 3 TEST-FIRST PREVIEW（待确认后先行编写并验证红灯失败）
1. **像素锐化不变量断言**：验证 `mapRenderer.ts` 在绘制世界全图与疆域图底图时不再开启 `imageSmoothingEnabled = true`，确保 `128×128` 像素清晰可见。
2. **疆域连续无级缩放与定点锚定断言**：测试 `computeViewport` 传入不同 `zoomScale`（如 `1.0`、`2.5`、`6.0`）与 `cameraCenter` 时，视口宽高连续单调缩小且精准围绕目标锚点钳制在地图边界内。
3. **角色档案左全身立绘右详情结构断言**：验证 `PerformerDialog.tsx` 采用 `.character-dossier` → 左 `.dossier-art`（含 `variant="full"` 全身立绘、星轨环与印章）+ 右 `.dossier-content`（含 `.dossier-tabs` 多标签切换、四维属性条、表情切换与导出角色卡）。
4. **划线零偏移与斜穿单格桥不误判红线断言**：构造第 `10` 列为可通行陆地、第 `11` 列为不可通行河流的地图，验证沿 `x = 10.85` 纵向划线全程绿/墨线畅通（修复前 `Math.round(10.85)=11` 会误判落水变红）；并验证斜向划过四邻接单格木桥时顺利通行不断红线，而直穿无桥河道依然准确截断。
