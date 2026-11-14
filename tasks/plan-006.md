# Plan-006 · 分段续画路线、主干道自动寻路、水体柔和岸线、云朵迷雾边缘与马车平滑移动动画方案

> **目标隔离分支**：`superpowers/multi-stroke-auto-route-anim`（待人工审核确认后从当前进度切出，不触碰 `main`）  
> **当前阶段**：Superpowers Stage 1（仅输出书面计划至 `tasks/plan-006.md` 供人工审核，**尚未修改任何业务、渲染或测试代码**）

---

## PLAN
════

### TASK
实现五项地图交互与视觉质感升级：1) 支持分多次连续绘制路线，仅点击「擦除墨线」时重置；2) 新增沿主干道（道路/桥梁）优先的自动寻路至已发现村庄/城郭/关口；3) 取消水体周围深色像素块边缘，改为柔和浅滩渐变；4) 将迷雾边界的圆圈标记重绘为蓬松连绵的云朵形状；5) 增加马车沿路线行驶的平滑动画与实时视野跟随。

---

### APPROACH

#### 1. 分段连续画线，仅点击「擦除墨线」才重置（Multi-Stroke Route Drafting）
- **改造点（`useRouteSketch.ts` / `CartographyView.tsx` / `App.tsx`）**：
  - 在 `useRouteSketch` 中同步监听 `routeDraft`：只有当外部显式将 `routeDraft` 设为 `null`（即点击「擦除墨线」、完成启程、跨区出境或重开新局）时，才清空 `strokeRef.current`；
  - 每次左键 `onPointerDown` 起笔时：
    - 若当前已有有效路线（`routeDraft && routeDraft.validPoints.length >= 2`），不重置旧线，而是以当前有效末端 `routeDraft.validPoints[last]`（若上一笔末端被红线阻断，则自动舍弃阻断红尾、从最后一个有效点续接）作为起点，继续追加新拖出的路径折线；
    - 如此玩家可先画一段，松开鼠标用滚轮缩放或右键拖动平移地图，再按住左键继续向下一段绘制，直到满意后点击「沿线启程」或按 `Enter`；
    - 若左键点击位移 `< 6px` 且点中聚落菱形图标（弹出斥候便签），自动恢复 `onPointerDown` 前的已有草稿，绝不因为查看村庄信息而误清空已画路线；
    - `Escape` 键在地图态下不再直接清空路线（仅用于关闭弹窗/浮窗），严格遵守「只有点击擦除才重置」的交互约定。

#### 2. 沿主干道自动寻路至已发现村庄/城郭（Road-Preferring A* Pathfinding）
- **新增领域算法模块 `src/domain/pathfinding.ts`**（遵守 `check-imports.mjs` 单文件 `≤ 450` 行且不反向依赖 `rules/`）：
  - 实现 8 邻接加权 A* 寻路函数 `findAutoRoute(map, startPos, targetPos, evadeWar)`：
    - 严格禁止斜向穿切不可通行角点（仅当两侧正交邻格皆可通行时才允许斜向跨步）；
    - 通行代价矩阵显著偏向主干道与桥梁：`road` / `bridge` 代价系数 `0.42`，`city` / `village` / `border_gate` 代价 `0.55`，`wasteland` `1.25`，`coast` `1.4`，`forest` `1.9`，`swamp` `3.4`，`warzone` `evadeWar ? 8.5 : 2.3`；
    - 使寻路轨迹主动吸附并沿着程序化生成的石砌干道与跨河木桥绕行，直达已发现的村庄、城郭或关口，并对共线中间点做轻量化简保留拐点。
- **入口接入（`App.tsx` / `CartographyView.tsx` / `Shell.tsx`）**：
  - 将 `handleAssistSketchTo` 替换为调用 `findAutoRoute` 后再经 `evaluateRouteStroke` 校验消耗与路况；
  - 将右侧斥候手札与地图据点便签中的「引线 / 引线前往」升级为「自动寻路」，在弹窗或右侧列表中点击已发现村庄即可一键沿主干道生成完整行军路线。

#### 3. 去除水体周围深色像素块边缘（Soft Bathymetry Water Shading）
- **根因清除（`src/components/Cartography/copperplatePainter.ts`）**：
  - 删除 `applyWaterEngraving` 中导致像素放大后呈现深色粗糙像素块的硬编码 `if (d === 1) return [54, 38, 25]` 以及 `d === 3 / 6 / 9` 的硬色块描边；
  - 改为**连续水深浅滩渐变算法**：紧贴陆地的浅水区（`d = 1..2`）呈略亮柔和的青灰浅滩色（与陆岸自然过渡），向外海与湖心（`d = 3..14`）平滑过渡为沉稳的灰青水色，并配合极微弱的水平水波明暗提亮（幅度 `±6` 字节内），彻底消除水体边缘深色像素块。

#### 4. 迷雾边缘改用蓬松云朵形状（Cloud-Bank Fog Frontier）
- **云朵渲染改造（`src/components/Cartography/mapRenderer.ts` & `copperplatePainter.ts`）**：
  - 废弃原先在迷雾交界处逐点绘制独立圆圈 `ctx.arc(..., 0, Math.PI * 2)` 的做法；
  - 在 `paintRegionScreenInk` 中实现 `drawCloudBank(ctx, cx, cy, size, seed)`：
    - 沿「已探索 ↔ 未探索」迷雾交界线按较大步长确定性稀疏采样云簇锚点（避开已探明区域内部）；
    - 每朵云由 4–5 个错落起伏的多重贝塞尔/圆弧云峰拼接成**单一封闭外轮廓路径**，内部填涂顺滑的暖象牙羊皮云霞垂直渐变（顶部受光 `#fbf3e0` → 云底柔和暖灰 `#dcc8a4`），仅在云顶拱弧外缘轻描一笔半透明浅褐轮廓线，彻底摆脱圆圈点阵感，呈现古地图四周云海环绕的视觉效果。

#### 5. 马车移动平滑动画（Smooth Polyline Caravan Travel Animation）
- **纯逻辑与表现层解耦**：
  - 保持 `rules/travelOps.ts` 中 `applyExecuteRoute` 的纯函数同步确定性（保证所有规则层单元测试与存档逻辑零破坏）；
  - 在 `src/domain/routeDraw.ts` 新增纯辅助函数 `samplePolylineAtDistance(points, dist)` 与 `polylineLength(points)` 用于按弧长平滑插值折线坐标及裁剪剩余待行线段；
  - 在 `App.tsx` 新增行军动画状态 `travelAnim: { points, remainingDraft, startMs, durationMs, evadeWar } | null`：
    - 点击「沿线启程」或按 `Enter` 后，通过 `requestAnimationFrame` 按总里程计算舒适行军时长（约 `650ms ~ 2600ms`，匀速微缓动），逐帧插值计算当前马车位置 `animatedPos`；
    - 动画期间禁止重复启程或画新线；`CartographyView` 与 `mapRenderer` 使用 `displayPos = animatedPos ?? state.world.pos` 渲染马车图标、风灯视野光圈，跟随镜头同步平滑滑行，并且随着马车推进，已走过的路线墨线逐渐收起；
    - 动画结束瞬间派发 `dispatch({ type: 'executeRoute', points, evadeWar })` 落盘消耗天数、补给与迷雾掩码并清除动画态。

---

### FILES TO CREATE OR MODIFY
- `src/domain/pathfinding.ts` — **create** — 8 邻接禁切角、主干道/桥梁优先的 A* 自动寻路算法。
- `src/domain/routeDraw.ts` — **modify** — 导出弧长采样与剩余路径裁剪纯函数（`polylineLength`、`samplePolylineAtDistance`、`slicePolylineFromDistance`）。
- `src/components/Cartography/copperplatePainter.ts` — **modify** — 移除水体 `d === 1` 深色像素块与硬环，改为浅滩到深水柔和渐变，并移除遗留圆圈迷雾绘制。
- `src/components/Cartography/mapRenderer.ts` — **modify** — 将迷雾边界圆圈改为多峰平滑云朵集群 `drawCloudBank`；支持传入动画瞬时位置与已行驶进度裁剪剩余路径线。
- `src/components/Cartography/useRouteSketch.ts` — **modify** — 支持分多次续画路线（仅外部置空时清空），保存轻点前草稿防止点选村庄误清路线。
- `src/components/Cartography/CartographyView.tsx` — **modify** — 适配分次划线、点击据点不丢弃已有路线、平滑行军动画帧渲染及 `Escape` 不误清草稿。
- `src/components/Shell.tsx` — **modify** — 更新自动寻路按钮文案/提示（「寻路」）及底部操作说明。
- `src/App.tsx` — **modify** — 接入 `findAutoRoute` 自动沿主干道寻路，接入 `requestAnimationFrame` 马车平滑行军动画调度。
- `tests/s6-route-cloud-water-anim.test.ts` — **create** — Stage 3 先行测试：覆盖分段续画、主干道优先 A* 寻路绕障、水体无深色像素块、迷雾云朵绘制（无单圆圈循环）及弧长插值平滑动画数学。
- `package.json` — **modify** — 将 `tests/s6-route-cloud-water-anim.test.ts` 纳入 `pnpm test`。

---

### EDGE CASES I WILL HANDLE
- **前一段画到河边红线截断后，玩家续画第二段**：自动丢弃前一段失效红尾，仅保留有效点序列末尾作为新一段起点，玩家可直接顺着河岸继续画到桥上。
- **目标村庄被河流或山脊隔开**：`findAutoRoute` 自动沿道路/桥梁绕行；若地图存在极端地形完全不可达，返回友好提示而不画穿河红线。
- **动画行驶途中玩家切换视图或触发重开**：组件卸载、点击随机重开或切换页签时安全取消 `cancelAnimationFrame` 防止内存泄漏或错位提交。
- **旧测试兼容性**：`applyExecuteRoute` 保持同步纯函数接口，现有 40 项测试与 `s4` 铜版画测试全量兼容；`src/domain/*.ts` 严格控制在 `≤ 450` 行。

---

### EDGE CASES I AM NOT HANDLING (out of scope)
- **跨海航船或自行架桥改造地形**：仍遵循陆路/现有桥梁通行规则。

---

### ASSUMPTIONS
- 「自动寻路至已发现的村庄（沿着主干道）」在所有已发现聚落（村庄及城郭/已知关口）的「自动寻路」按钮点击后触发，并同样会生成可分段续画或一键启程的墨线草稿，方便玩家预览消耗后再启程。
