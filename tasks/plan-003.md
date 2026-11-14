# Plan-003 · 焦边卷角古羊皮纸界面、一屏免滚布局、聚落与大篷车专属图标、拟真大陆与自然疆域生成方案

> **目标隔离分支**：`superpowers/antique-atlas-v3`（待人工审核确认后从当前进度切出，不触碰 `main`）  
> **当前阶段**：Superpowers Stage 1（仅输出书面工程计划供人工审核，**尚未修改任何业务、样式或测试代码**）

---

## PLAN
════

### TASK
将主界面升级为参考图同款「重度焦褐染色、深撕裂毛边、右上折角卷曲」的古旧羊皮纸质感，压缩并锁定桌面端全局 `100vh` 一屏免滚动条显示，绘制大篷车专属纹章图标彻底替换残留的夜糖猫耳图标并为地图可视范围内的城市与村寨补齐精细舆图图标，同时重构 `128×128` 世界地图生成器，告别「中心大圆带小圆 + 九宫格切块」，改为板块山脉半岛海湾地貌与沿山河自然分界的有机疆域划分。

---

### APPROACH

#### 1. 参考图级古旧焦边卷角羊皮纸质感（Antique Scorched & Dog-Ear Vellum）
- **深色古木案几衬底**：将外围桌面底色调整为深胡桃炭木色（`#1c140f` → `#120c09`），让浅赭黄与焦褐边的羊皮纸主体形成参考图同款的强烈明暗器物对比。
- **离屏程序化斑驳羊皮纹理（零实时滤镜开销）**：新增 `src/styles/vellumTexture.ts`，在应用启动时通过离屏 `<canvas>` 一次性合成可缓存的水渍云斑、茶褐陈年晕染、纤维噪点与霉斑（foxing spots）纹理 Data URL，注入根变量 `--vellum-mottle-tex`；全程不使用实时大面积 `<feDisplacementMap>`，保证地图划线满帧与文字 `<canvas>` 100% 锐利。
- **深齿不规则手撕轮廓 + 四周焦褐碳化内晕**：重写 `.vellum-sheet::before`：
  - 使用非对称、深浅交错（6px–16px 级缺口与纤维啃蚀感）的高点数不规则撕裂多边形 `clip-path`，并在右上角斜切出折角缺口（`calc(100% - 58px) 0` → `100% 52px`）；
  - 叠加多层径向与边缘烟熏渐变（`#2d1809` 焦黑褐 → `#633a18` 浓茶褐 → `#a6743d` 烤赭色 → `#ead6b3` 羊皮纸心），复刻参考图边缘浓重不均的火烤/氧化包浆感。
- **右上角立体卷曲折页（Dog-Ear Flap）**：在 `#main-stage-sheet`（及弹窗卷轴）右上角渲染 `.vellum-dogear` 装饰层（内联 SVG 折角片），刻画翻折过来的暖金赭色羊皮背面渐变、撕裂折边高光以及投射在纸面上的柔和三角暗影，并给顶栏/页头右侧预留 `58px` 安全内边距防止按钮被卷角遮挡。

#### 2. 桌面端 `100vh` 一屏免滚动条紧凑布局（Viewport-Locked Zero-Scroll Layout）
- **锁死视口高度网格**：`html, body, #root` 设为 `height: 100vh; overflow: hidden;`；`.app-shell` 采用精确三行网格 `grid-template-rows: var(--topbar-h) minmax(0, 1fr) var(--helm-h)`（`--rail-w: 98px`、`--topbar-h: 50px`、`--helm-h: 42px`），将原本 `position: fixed` 悬浮遮挡底部的 `HelmBar` 纳入第三行网格轨道。
- **压缩页头与外框留白**：`.app-main` 内边距收紧为 `8px 16px`；`.vellum-sheet` 设为 `flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; padding: 12px 20px;`；`PageHeading` 改为单行紧凑书眉（约 `36px` 高，标题与简述同行排布）。
- **四大功能页自适应填充（`flex: 1; min-height: 0`）**：
  - **地图页（`CartographyView`）**：移除 `.atlas-viewport` 写死的 `min-height: 490px` 与固定 `aspect-ratio`，改为 `flex: 1; min-height: 0;` 撑满剩余高度，配合 `ResizeObserver` 动态同步 `<canvas>` 物理像素尺寸；右侧便利贴栏紧凑排版，`.poi-list` 在极端多据点时仅框内局部滚动，绝不撑出整页滚动条。
  - **马车页（`CaravanView`）**：双栏等高 `min-height: 0`，压缩五节车厢行高、酒馆招募条与花名册卡片尺寸，一屏完整容纳车厢编成、招募、演员阵容与角色卡双栖指派台。
  - **物资页（`SuppliesView`）**：紧凑丝绸子标签 + `3 × 2` 便利贴补给矩阵 / 兽笼卡片 / 货客运面板，一屏完整呈现。
  - **记录页（`RecordsView`）**：顶部隐居进度横幅压缩为紧凑仪表条，下方编年日志与六大势力面板左右分栏填充剩余高度。

#### 3. 大篷车专属纹章（取代夜糖图标）与可视范围城/村/车舆图图标
- **彻底替换夜糖残留图标**：
  - 重绘 `public/favicon.svg`：废除原 `night-sugar-office` 的黑底粉猫耳图标（`#f4a9c8`），换为原创「残响大篷车」纹章 SVG（拱顶条纹马戏篷车、木辐车轮、车顶三角彩旗与檐角暖黄风灯，深绛红鎏金底章）；
  - 新增 `src/components/CaravanCrestIcon.tsx` 供左侧书脊 `#brand-home` 火漆徽章与顶栏品牌标识复用；将 `CaravanView.tsx` 界面文案中的「兼容夜糖与大篷车格式」更新为「兼容通用角色卡与大篷车格式 (.json)」（底层 `cardCodec.ts` 继续静默兼容旧卡导入）。
- **地图可视范围内城郭、村寨、关口与大篷车矢量手绘图标**：
  - 新增 `src/components/Cartography/mapIcons.ts`，用 Canvas 2D 矢量路径绘制高辨识度羊皮纸手绘墨线图标：
    1. **多格城市图标（`drawCityIcon`）**：羊皮底章衬托的双箭楼城垣 + 中央尖顶主堡与旗帜（已侦查点亮绛红金顶；未侦查显示古褐墨线剪影）；
    2. **村寨图标（`drawVillageIcon`）**：人字木屋聚落 + 烟囱与风灯招牌图标；
    3. **边境关口图标（`drawGateIcon`）**：石拱城门界碑图标；
    4. **大篷车图标（`drawCaravanIcon`）**：带拱形条纹篷顶、双木轮、风灯光晕与车顶彩旗的大篷车专属棋子图标，取代原先简单的红点 `ctx.arc`。
  - 在 `mapRenderer.ts` 中严格结合 **当前视口裁剪（`ViewportTransform` 显示范围内）+ 迷雾探索/实时风灯视野判定**：
    - `region` 与 `follow` 模式下，仅对处于当前视口显示范围内且已被探明（或处于实时风灯半径内）的村寨、城市、关口绘制对应图标与描边名牌，图标尺寸随缩放层级自适应；
    - `world` 世界地图模式下，用大篷车专属图标标示当前车队世界坐标，并对已加载区域内已探明的城市/村寨绘制微缩据点标记；
    - 在地图底部 `.hud-legend` 图例栏同步补齐城郭、村寨与大篷车的微缩 SVG 图标图例。

#### 4. 拟真大陆地貌生成与非九宫格自然地理疆域划分
- **模块拆分守住架构红线**：将大陆构造与水系/疆域算法拆分为 `src/domain/worldTectonics.ts` 与 `src/domain/worldGen.ts`，确保 `src/domain/` 下每个文件严格 `< 450` 行且无循环依赖。
- **板块骨架 + 海湾内海切割 + 岛弧（告别中心大圆带小圆）**：
  - 引入双层域扭曲（Domain Warping）打破规则几何边缘；
  - 用多段折线大陆克拉通板块脊（主陆脊、东北火山裂谷半岛、西南干旱地堑角、东南破碎港湾岬角）叠加 2–3 处负向内海/深水海湾侵蚀场与沿构造海沟分布的弯曲岛弧群，生成拥有曲折海岸线、半岛、地峡、内湾、海峡与不规则群岛的真实感大陆，同时保留最外圈海洋边界与充沛的中心连续陆地。
- **山脉造山带与顺坡蜿蜒水系**：
  - 沿板块挤压带生成山脊多形分形（Ridged Multifractal）连绵山脉，而非圆心高地；
  - 湖泊采用噪声扭曲盆地轮廓（非正圆），4–6 条大河从高山源头顺高度场最速下降梯度蜿蜒流向海湾或内湖（遇局部洼地自动切穿溢流，保持四邻接不断流）。
- **生态适配种子 + 地形阻抗测地线扩张划分 9 大区（告别九宫格）**：
  - 废除原先 3×3 均匀网格 `REGION_ANCHORS`；改为根据真实生成的纬度、海拔、距海距离、湿度与半岛隔离度为 9 大地区挑选契合设定的地理核心点（如极北高纬山岬归「极北霜壁」、偏远火山半岛归「魔王城领」、东南港湾岬角归「曙光裂岸」、低洼河口盆地归「沉没泽国」、内陆河谷平原归「人类帝国」等），种子点呈自然非共线散落；
  - 采用 **多源加权 Dijkstra 测地线前沿扩张** 划分归属：平原低阻抗（`1.0`），山脊高阻抗（`4.5`），大河/湖泊高阻抗（`3.8`），窄海峡极高阻抗（`7.5`，允许近岸岛屿归属邻近沿海省但阻断跨海湾乱飞），辅以面积均衡阻尼，使国界线自然贴合山脉分水岭、大河与海湾，9 个地区形状、长宽比与面积错落有致；
  - 新增 `computeWorldNeighbors(world)` 从真实 `regionGrid` 提取接壤关系与方位，在 `createInitialState` 与 `generateRegionMap` 中按真实接壤边界安放配对 `border_gate`，并在 `applyCrossBorder` 中优先按 `g.targetRegionId === fromRegionId` 精确落位对侧关口。

---

### FILES TO CREATE OR MODIFY
- `public/favicon.svg` — **modify** — 用原创残响大篷车纹章 SVG 替换原夜糖粉猫耳图标。
- `src/components/CaravanCrestIcon.tsx` — **create** — 大篷车矢量纹章与微缩图例 SVG React 组件（供侧边栏火漆印、顶栏与图例复用）。
- `src/styles/vellumTexture.ts` — **create** — 离屏 Canvas 一次性生成古旧羊皮纸云斑、茶渍、霉点纹理 Data URL 并挂载至 CSS 变量。
- `src/main.tsx` — **modify** — 启动时调用古羊皮纸纹理初始化，保证首帧即呈现斑驳质感。
- `src/styles/parchment.css` — **modify** — 升级深木桌面底色、重度焦褐毛边 `.vellum-sheet`、右上卷曲折角 `.vellum-dogear`，并将全局壳层与四大视图改为 `100vh` 免滚动紧凑布局。
- `src/components/Shell.tsx` — **modify** — 侧边栏与顶栏接入 `CaravanCrestIcon`，精简 `Topbar`、`PageHeading` 与 `HelmBar` 高度以适配一屏布局，给页头右侧留出卷角避让间距。
- `src/App.tsx` — **modify** — 在 `#main-stage-sheet` 中挂载右上立体卷曲折角装饰节点，调整主舞台弹性容器结构。
- `src/components/Cartography/mapIcons.ts` — **create** — 封装 Canvas 2D 城市、村寨、关口与大篷车手绘舆图图标绘制函数及视口可见性裁剪工具。
- `src/components/Cartography/mapRenderer.ts` — **modify** — 在世界/区域/跟随三级视图中为可视且探明范围内的城市、村寨、关口绘制专属图标，并用大篷车图标替换红圆点。
- `src/components/Cartography/CartographyView.tsx` — **modify** — 接入 `ResizeObserver` 动态自适应画布高度，更新底部图例图标与紧凑侧栏尺寸。
- `src/components/CaravanView.tsx` — **modify** — 适配紧凑一屏双栏高度，移除界面上的「夜糖」字样。
- `src/components/SuppliesView.tsx` — **modify** — 适配紧凑一屏 `3×2` 补给便利贴与兽笼布局。
- `src/components/RecordsView.tsx` — **modify** — 适配紧凑一屏终局进度条与双栏日志/势力布局。
- `src/domain/worldTectonics.ts` — **create** — 板块骨架、海湾侵蚀、岛弧、造山带高度场、顺坡水系与非九宫格测地线分省核心算法。
- `src/domain/worldGen.ts` — **modify** — 调用 `worldTectonics.ts` 输出 `128×128` 拟真 `WorldMapData`，导出真实接壤邻区计算函数 `computeWorldNeighbors`。
- `src/domain/regionGen.ts` — **modify** — 使用真实世界接壤邻区生成 `border_gate`，确保非九宫格疆域下每个相邻省界关口落在真实交界线上。
- `src/rules/state.ts` — **modify** — 初始化时将 `world.regions[id].neighbors` 同步为当前种子大陆的真实接壤邻区。
- `src/rules/travelOps.ts` — **modify** — `applyCrossBorder` 优先匹配 `targetRegionId === originRegionId` 的对向关口落点，保证不规则疆域双向跨区严丝合缝。
- `tests/s3-antique-ui-and-world.test.ts` — **create** — Stage 3 先行测试：校验夜糖图标清除、大篷车/城/村图标渲染、焦边卷角与 `100vh` 免滚样式约束、非圆形复杂海岸线指标及非九宫格自然分省不变量。
- `package.json` — **modify** — 将新增测试文件加入 `pnpm test` 执行列表。

---

### EDGE CASES I WILL HANDLE
- **右上卷曲折角遮挡交互按钮**：`.vellum-dogear` 设为 `pointer-events: none`，且 `.page-heading` 与 `.modal-head` 右侧预留安全内边距，杜绝关闭按钮或「读回最近手稿」按钮被折角压住。
- **不同桌面分辨率（如 `1366×768` / 1080p 125% 缩放视口高约 `720px`）下的溢出防护**：所有页面主干均采用 `flex: 1; min-height: 0`；常规状态下零滚动条，当玩家后期招募十余名演员或累积数十条日志时，仅卡片内部列表优雅滚动，绝不破坏整张羊皮纸外框的一屏完整性。
- **迷雾与视口双重裁剪**：未探索且不在马车风灯半径内的城市/村寨绝不提前泄露图标；在 `follow` 局部放大模式下，滚出当前视口外的据点自动跳过绘制，避免边缘半截文字污染与多余开销。
- **非九宫格随机大陆下的孤岛省与跨区死胡同**：测地线扩张保证全部 9 大区在主陆（及近岸浅滩）上各自拥有 `>= 180` 格有效面积且全图连通（任意两区可通过陆路关口互达），不会生成无法进出的死区。
- **`tools/check-imports.mjs` 行数与依赖门禁**：拆分 `worldTectonics.ts` 后确保 `src/domain/` 与 `src/rules/` 所有单文件严格 `≤ 450` 行（`act.ts ≤ 300` 行）、无循环依赖、无 UTF-8 BOM。

---

### EDGE CASES I AM NOT HANDLING (out of scope)
- **手机竖屏与超窄屏（`< 960px`）折叠布局**：遵照既有明确指示「不用考虑适配手机窄屏」，专注打磨桌面端横屏器物质感与一屏体验。
- **真实后端数据库或在线多人同步**：维持纯前端本地存储架构。

---

### ASSUMPTIONS
- 「显示范围内的村子和城加图标」指当前地图视口可见范围内、且已被玩家探索揭开迷雾（或处于大篷车实时风灯视野内）的城市与村寨显示图标；未探索迷雾下仍保持未知以维护探索乐趣。
- 旧版角色卡 JSON（`format: "night-sugar/girl-card"`）在代码底层解析器中继续保持静默兼容读取，仅在全部可见视觉图标与界面文案上去除夜糖痕迹并换为大篷车专属设计。

---

### STAGE 3 TEST-FIRST PREVIEW（待确认后先行编写并验证失败）
1. **图标替换与城/村/大篷车舆图图标断言**：验证 `public/favicon.svg` 不再含 `#f4a9c8` 夜糖猫耳路径且具备大篷车车轮/篷顶结构；验证 `mapIcons.ts` 与 `mapRenderer.ts` 对视口内已探明 `city`、`village`、`caravan` 分别执行图标绘制，对未探明迷雾据点不泄露图标。
2. **古旧卷角羊皮纸与 `100vh` 一屏免滚样式断言**：验证 `.vellum-sheet` 具备焦褐内晕与右上折角 `.vellum-dogear`，且 `.app-shell` 锁定 `height: 100vh; overflow: hidden`，`.atlas-viewport` 移除固定 `min-height: 490px` 改为弹性填充。
3. **拟真大陆地貌（非大圆套小圆）断言**：对多组随机种子检验海岸线周长/面积复杂度指数（异形度显著高于圆盘）、存在深入内陆的海湾/半岛凹凸特征、河流顺海拔单调下行入海/入湖。
4. **非九宫格自然分省与连通性断言**：检验 9 大区质心不落入规则 3×3 网格行/列对齐、各省面积具备自然差异且均 `>= 180` 格、9 大区真实接壤图全连通且双向跨区 `crossBorder` 精确落位对侧关口。
