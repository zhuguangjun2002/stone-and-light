# 交接说明（Handoff）

> 给切换模型 / 新接手者的一份快速状态快照。长期文档看 `README.md`。

## 项目一句话

**石头与光**：纯 Three.js 程序化生成的一座盛期哥特风格大教堂 + 教堂领地（close），
无任何外部模型/图片资源。在线 <https://church.bigcow.net>，本地 `python3 -m http.server 8123` 后开 <http://localhost:8123/>。

## 坐标系与关键尺寸

- y 向上；中厅轴线沿 **z**，西立面在 **+z**，后殿在 **−z**；**+x 南**、−x 北。
- 参数集中在 `src/params.js` 的 `P`，派生量在 `recomputeDerived()`：
  `aisleOut=13.2`、`outerX=14.2`（侧廊外墙外皮）、`naveZ0=6`、`naveZ1=48`、`choirZ1=-27`。
- 领地四至（`src/town.js` 常量）：南 `SX2=76`、北 `NX2=-64`、西 `WZ=78`、东 `EZ2=-78`
  （`SX=56`/`NX=-52`/`EZ=-58` 为旧四至）；**院墙与门楼/角塔已于 2026-10 整体移除**，四至仅作院落坐标。
- 服务巷 `LANE`（x 57.5–61.5 / z −40–76）位于酒坊正前；酿酒坊大院六座建筑见 `BREW`。
- 回廊（`CLO`）：`x0=18.5`、`z0=13`、内院 `garth=16`、敞廊进深 `depth=4.2`。
  回廊西缘与南侧扶壁墩（最远 x≈15.9）之间留 ~2.6 m 过道；东缘（x=42.9）与南墙住宅前脸
  （最浅 x≈45.4）之间也宽出 ~2.5 m——东西两侧的过道差不多宽。

## 代码地图

| 文件 | 职责 |
|---|---|
| `src/cathedral.js` | 总装：拉丁十字平面、三段式立面、屋面、耳堂、后殿、管风琴、光柱 |
| `src/town.js` | 领地：回廊（含檐沟/落水管/明沟/暗管/渗井）、教士住宅、墓地、集市（摊棚+货台）、**酿酒坊大院**（`BREW` 六建筑 + 服务巷 + 院子排水 `buildBreweryDrain`）、**院内地面分级**；导出 `drainageInfo()` / `brewInfo()` |
| `src/main.js` | 入口：渲染/日照/环视/行走/剖面/标注/建造动画/面板；另有 **地下泥土层 + `addFoundations` 地基**（挂在 scene 不挂 root）；烘焙完成发 `window.__baked` |
| `src/person.js` | 第三人称替身构造 `buildPerson()`（从 `main.js` 抽出）：长袍/斗篷/兜帽/里料袖、ArmL/ArmR/LegL/LegR 枢轴组、`userData` 存枢轴引用 |
| `src/gothic.js` | 尖拱、束柱、小尖塔、山墙、坡屋面、`wallWithOpenings` 开洞墙 |
| `src/bake.js` / `bakeworker.js` / `grid.js` | 室内顶点色烘焙（Worker 并行 + IndexedDB 缓存 + 射线加速网格） |
| `src/doors.js` / `glass.js` / `vault.js` / `buttress.js` / `facade.js` / `figure.js` / `materials.js` / `presets.js` / `tour.js` / `worksite.js` / `audio.js` | 各自构件/声音/导览/工地 |
| `tools/` | 六个检查器（含 `check-brew.mjs` / `check-shadow.mjs`）+ 取景页（shot.html / shoot.mjs）+ 两个水路演示（drainage.html / **brewery.html**）+ **人物自检（monk.html）** + 烘焙对照 + 导览录制（record-tour.mjs）+ 扩建方案图（expansion-plan.py）+ **Chrome 启动参数 `chrome-args.mjs`**（**默认本机 MX230**，`--swiftshader` 退回软渲染）+ Blender 生成脚本（generate_monk.py → assets/monk.glb）|
| `test/smoke.mjs` | 无浏览器冒烟 |

## 领地接入的约定（重要）

- `buildTown()` 的 group 被 `buildCathedral()` 挂进 `root` → 自动进**第一人称碰撞/重建/释放**。
- 领地材质标 `userData.noBake`（`bake.js` 跳过），网格标 `userData.buildSkip`（建造动画跳过）、`userData.town`（穿刺检查器跳过）；树额外标 `noFoundation`（不长地基）。
- 回廊排水构件标 `userData.drain`（`gutter`/`pipe`/`basin`/`channel`/`culvert`/`soak`）——`check-rain.mjs` 的正向校验靠它。
- 酿酒坊大院的排水构件**另标** `userData.brew`（`roof`/`gutter`/`spout`/`channel`/`culvert`/`soak`）
  ——`check-brew.mjs` 与 `tools/brewery.html` 靠它；两套标签互不干扰，校验也互不干扰。
- 烘焙版本 `BAKE_VER=2`（`src/main.js`）。

## 检查器基线（当前全绿）

```bash
node test/smoke.mjs                 # 2437 网格（bbox −69..81 / −122..126），通过
node tools/check-zfight.mjs 0.004 0.2   # 严格共面 0 处
node tools/check-rain.mjs           # 0 处漏雨 + 回廊排水通路 7/7，exit 0
node tools/check-brew.mjs           # 酿酒坊水路 7/7（屋面 30/30 + 30/30），exit 0
node tools/check-poke.mjs           # 49 机位 0 处穿刺（按 userData.town 跳过领地）
node tools/check-flicker.mjs        # 外观 0.02–0.17%、剖面 ≤0.31%（合计 3507 px），exit 0
                                    # 后端自报一行；--swiftshader → 3481 px 可移植基线
node tools/check-shadow.mjs         # 阴影视锥 0 处越界（P.shadow，太阳走一天 48 档）
```

## 状态：已收尾（截至 2026-10-07）

### 本轮：修士模型 + 走路动画 v3

- **第三人称 walk 模式**：`src/main.js` 按 F 进入第一人称后再按 **V** 切换第三人称，
  相机挂在 ≈1.7 m 替身后面跟随移动。替身由 `src/person.js` 的 `buildPerson()` 构建，
  `g.userData` 上有 `armL/armR/legL/legR` 四个枢轴组；替身挂在 `scene`
  而非 `root`：不进碰撞网格、不进烘焙、不进 check-zfight/rain/poke/flicker.
- **围墙已撤**：`ea4a711` 把外圈新墙、旧庭墙、西门门楼、8 角塔全部删除；
  `SX2/NX2/EZ2` 常量保留仅作院落坐标基准。
- **人物自检页 `tools/monk.html`**：修士站在铺石板院子中，正/侧/背/全身/四分之三机位、
  环绕旋转、绿色 1.7 m 标尺杆、「换成 Blender 版」两个版本 (procedural / GLB) 即时对比。
- **走路动画 v3**：Blender 脚本里 pivot empties (名为 `ArmL/ArmR/LegL/LegR`)
  注入 5 keyframe rotation_euler.x 曲线 → GLB 内自带 4 条 clips（名 `walk_*`）；
  `monk.html` 在按钮开后用 `THREE.AnimationMixer.update(dt)` 驱动 GLB 版、程序化版
  用 JS 正弦驱动，两边节奏 1.2 s/圈 一致；「换成 Blender 版」toggle 共享同一组枢轴名。
- `tools/monk.html` 的「播放走路动画 / 暂停走路动画」按钮：暂停时 stopAllAction+
  所有节点 `rotation.x` 归零 → 静置姿势；再播放时 mixer 重回放。
- **monk.html 光线调整**：光源从后方改到前上方 (-4, 9, -8)，半球光强度提到 1.15。
- 文档参照：`docs/brewery-research.md`（修道院历史/ATP 三标准）、README 的
  「人物自检页」小节。
- headless 验证过一轮：0.8 s 时 ArmL+LegR 的 rot.x ≈ ±0.546 rad（amp 0.55），pause 归零。

### 上一轮：酿酒坊大院（已在 `main`）

- **扩地**：南 +20（`SX 56→76`）、东 +20（`EZ −58→−78`）、北 +12（`NX −52→−64`），西不动；
  原围墙降级为院内庭墙、立起双圈围墙（压顶高度错开 0.02–0.1 m 避共面，8 座角塔）——
  这套院墙已于 2026-10 整体移除；新四至常量 `SX2/NX2/EZ2` 保留作院落坐标。
  方案图 `tools/expansion-plan.py` → `docs/expansion-plan.png`（东排住宅 −17 → **−18.5**，树 `[48,30]` → `[66,-50]`）。
- **酿酒坊**（`BREW` 六建筑，z 东→西）：粮仓 → 烘干窑 → 麦芽楼 → 煮酒房 → 冷却·发酵 → 酒窖酒肆；
  服务巷 `LANE`、院坝水井、酒桶、酒花架/菜园药圃、墓园扩展、东排住宅外移（`EAST_HOUSE_X`）。
- **院子排水**（`buildBreweryDrain`，`userData.brew`）：檐沟（贴巷一面）→ 集水管（找齐到 `pipeX=61.86`）→
  落水管（每座一根，z0+0.15）→ 服务巷东缘明沟（x 61.0–61.95，通长 z −40..76，面 0.19 m）→
  东端出口暗管（y −0.44..−0.04）→ 渗井（61.475, −46，井篦露地）。几何由 `brewInfo().drain` 回传。
- **两个新工具**：`tools/check-brew.mjs`（正向连通 7 项，含檐口射线双查）、`tools/brewery.html`
  （演示页：六座水路动画 + 名字标注 + 阶段机位 + 「一滴水走完全程」）。
- 广场面片统一 `PlaneGeometry(148, 210)` @ `(6, 0, 10)`，十处文件同步（main/bakeworker/七个 tools 页/两个检查器）。
- **阴影相机**（原「待决」，已定）：`P.shadow`（`src/params.js`）= x ±150 / y ±140 /
  深 20–350 / 贴图 4096 → 7.3 cm/px（比原来 2048 配 ±110 的 10.7 cm/px 更细）。
  量测：扩建后视空间需求已到 ±150，旧的 ±110 全天有 **133 处投影越界**（出视锥的墙体
  整块丢影子、地面留一道硬边界）。新增 `tools/check-shadow.mjs` 静态守住这条基线
  （太阳走一天 48 档，0 处越界）；太阳轨迹同步提到 `params.js` 的 `sunPos(t)`，
  `main.js` 与校验器共用同一份。
- **取景页的影子原本是另一套**（这一步差点漏掉）：`shot.html` / `flicker.html` /
  `bakeshot.html` 各自抄了一份**旧的**阴影相机（±110 / 2048），早就和 `main.js` 漂了——
  所以第一轮"阴影视觉复核"和 flicker 基线其实**都没吃到新配置**。三页已全部接到
  `P.shadow`，`shot.html` 的 `__sunAt` 也改用 `sunPos()`；`rain.html`/`drainage.html`
  是刻意收紧的近景机位，不改。接上后在 `t=0.30` / `t=0.65` 两档重拍，无硬边界。
- **渲染后端统一**（`tools/chrome-args.mjs`）：取景/检查四工具的 Chrome 启动参数收成
  一份，**默认走本机 MX230**（ANGLE→Vulkan；`check-flicker` 全扫 24.6 s → 5.3 s，4.6×），
  `--swiftshader` / `CHROME_SW=1` 退回软渲染以复现跨机器基线；没显卡时 Chrome 自动回落，
  链路不会断。**Intel 核显别选**：强制走它 56 ms/帧，比软渲 45 ms/帧还慢。
  `check-flicker` 开头自报一行"渲染后端"。基线：MX230 **3507 px**（连跑三次同一串数字）、
  软渲 3481 px，两者均 exit 0；`check-poke` 在 GPU 下仍 0 穿刺。

### 上一轮（都已在 `main`）

最近一轮把能想到的都收尾了：

- 前庭石板程序化贴图（`pavingTexture()`，世界坐标 UV）；回廊东西过道对称（`CLO.garth=16`）
- 回廊整套排水：内檐沟 → 四角落水管 → 环院石砌明沟 → 暗管 → 渗井（终点，水渗入地下）。
  构件带 `userData.drain` 标签，坐标由 `drainageInfo()` 导出
- `tools/drainage.html` 排水演示页：动画水滴 + 「一滴水走完全程」追踪（小号青色彗星、镜头跟随）
- `check-rain.mjs` 扫完漏点后做 **7 项排水通路正向校验**（屋面→檐沟→落水管→明沟→暗管→渗井）
- 集市摊棚：货台改成真桌子、布篷改前倾且柱头顶篷。
- 后殿东侧土院铺满整个东端；`docs/` 里无人引用的孤儿图已删
- 导览影片 `docs/tour.mp4` 重录（领地入镜，138 s）

还想继续的话：院内土院/草地比例的进一步口味调；或参考 `tools/drainage.html`
给排水加更多真实细节（如明沟→沉淀井、雨水回用）。

## 关于看效果

- 助手**能读图**（`read` 一张 PNG 会作为图片附件送进模型）。所以验证视觉走这个循环：
  改代码 → `node tools/shoot.mjs …` 出 PNG → 直接 `read` 看 → 不满意再改。
  `tools/shoot.mjs` 加载 `tools/shot.html`（`preserveDrawingBuffer:true`），
  用 `window.__shot(px,py,pz,tx,ty,tz)` 与 `window.__sunAt(t)` 定点出图：
  `node tools/shoot.mjs --view=1,2`，或 `--at=0,50,110,0,0,64`（可重复，写到 `/tmp/church-shot/`）。
- 不方便看图时仍可退到**像素采样**：`gl.readPixels` 读中心/网格点的 RGB 数字；
  或 `xdg-open docs/overview.png`。
- 注：`tools/shot.html` 不做室内光照烘焙，室内对比仍以主站（`?view=…`）为准。
- 录导览片：`tools/record-tour.mjs` **默认走 GPU**（`headless=new` + `--use-angle=vulkan`），
  本机 NVIDIA MX230 约 15 fps、整片 4 分钟；SwiftShader 软件渲染只有 ~1 fps（加 `--swiftshader` 回退）。
  抓帧前会等 `window.__baked`（室内烘焙完成），否则片中明暗会变。详细见 README「导览影片」。
  注意：被工具超时杀掉时，headless Chrome 会残留空转占 CPU，要按临时 profile 清掉。

## 部署

push 到 `main` → Cloudflare Pages 自动上线（Git 集成，无构建）。

**单文件上限 25 MiB**：超过会让**整个部署失败**（连带别的小文件也不更新）。
`docs/tour.mp4` 用 crf 24 编码（约 23 MB）刚好进线；改码率前先 `du -h` 看一眼。

`tools/deploy-cf.sh` 是应急直传，一般不用（会绕过 git 历史）。
