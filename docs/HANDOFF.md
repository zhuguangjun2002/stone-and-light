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
- 服务巷 `LANE`（x 57.5–61.5 / z −40–76）位于酒坊正前；酿酒坊大院八座建筑见 `BREW`。
- 回廊（`CLO`）：`x0=18.5`、`z0=13`、内院 `garth=16`、敞廊进深 `depth=4.2`。
  回廊西缘与南侧扶壁墩（最远 x≈15.9）之间留 ~2.6 m 过道；东缘（x=42.9）与南墙住宅前脸
  （最浅 x≈45.4）之间也宽出 ~2.5 m——东西两侧的过道差不多宽。

## 代码地图

| 文件 | 职责 |
|---|---|
| `src/cathedral.js` | 总装：拉丁十字平面、三段式立面、屋面、耳堂、后殿、管风琴、光柱 |
| `src/town.js` | 领地：回廊（含檐沟/落水管/明沟/暗管/渗井）、教士住宅、墓地、集市（摊棚+货台）、**酿酒坊大院**（`BREW` 八建筑 + 服务巷 + 院子排水 `buildBreweryDrain`）、**院内地面分级**；导出 `drainageInfo()` / `brewInfo()` |
| `src/main.js` | 入口：渲染/日照/环视/行走/剖面/标注/建造动画/面板；另有 **地下泥土层 + `addFoundations` 地基**（挂在 scene 不挂 root）；烘焙完成发 `window.__baked` |
| `src/person.js` | 第三人称替身构造 `buildPerson()`（从 `main.js` 抽出）：长袍/斗篷/兜帽/里料袖、ArmL/ArmR/LegL/LegR 枢轴组、`userData` 存枢轴引用；导出 `poseWalk()` 摆臂（替身/NPC/monk.html 共用） |
| `src/walkers.js` | 领地里的修士 NPC（`createWalkers()`）：7 位沿回廊/服务巷/集市/墓地动线行走；挂在 `scene` 只做视觉；导出 `WALKERS`/`buildRoute`/`pointAt` 供 `tools/check-npc.mjs` 校验 |
| `src/gothic.js` | 尖拱、束柱、小尖塔、山墙、坡屋面、`wallWithOpenings` 开洞墙 |
| `src/bake.js` / `bakeworker.js` / `grid.js` | 室内顶点色烘焙（Worker 并行 + IndexedDB 缓存 + 射线加速网格） |
| `src/doors.js` / `glass.js` / `vault.js` / `buttress.js` / `facade.js` / `figure.js` / `materials.js` / `presets.js` / `tour.js` / `worksite.js` / `audio.js` | 各自构件/声音/导览/工地 |
| `tools/` | 八个检查器（含 `check-brew.mjs` / **`check-gear.mjs`** / `check-shadow.mjs` / `check-npc.mjs`）+ 取景页（shot.html / shoot.mjs）+ **主站取景 shoot-main.mjs**（含 NPC，`--q=` 可透传任意 URL 参数如 `labels=1`）+ 两个水路演示（drainage.html / **brewery.html**）+ **酿造工序演示（brewprocess.html，两线九站）** + **人物自检（monk.html）** + 烘焙对照 + 导览录制（record-tour.mjs）+ 扩建方案图（expansion-plan.py）+ **Chrome 启动参数 `chrome-args.mjs`**（**默认本机 MX230**，`--swiftshader` 退回软渲染）+ Blender 生成脚本（generate_monk.py → assets/monk.glb）|
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
node test/smoke.mjs                 # 3182 网格 / 337 组 / 36 标注（bbox −69..81 / −122..126），通过
node tools/check-zfight.mjs 0.004 0.2   # 严格共面 0 处（默认阈值 0.06 → 525 处）
node tools/check-rain.mjs           # 0 处漏雨 + 回廊排水通路 7/7，exit 0
node tools/check-brew.mjs           # 酿酒坊水路 7/7（屋面 40/40 有沟、40/40 有瓦、落水管 8 根），exit 0
node tools/check-gear.mjs           # 酒坊屋内陈设 381 件 0 件出屋（按 userData.gear 认）
node tools/check-poke.mjs           # 49 机位 0 处穿刺（按 userData.town 跳过领地）
node tools/check-flicker.mjs        # 外观 0.02–0.17%、剖面 ≤0.31%（合计 3515 px），exit 0
                                    # 后端自报一行；--swiftshader → 3488 px 可移植基线
node tools/check-shadow.mjs         # 阴影视锥 0 处越界（P.shadow，太阳走一天 48 档）
node tools/check-npc.mjs            # 修士 NPC 走线 0 处蹭墙 / 0 处脚不沾地（2581 采样点）
```

酒坊改动把「实心盒子」换成了「四片墙 + 真门洞」，回廊那段（只动南北两翼敞廊墙的**洞口**，
墙厚、位置、走道净宽都没变）不受影响，所以 NPC 走线基线仍然成立；flicker 合计
3507 → **3515**（像素级噪声，连跑三次同值；软渲基线 3488 不变），README 与本文件的基线已同步。
共面数（默认 0.06 m 阈值）当前 **525**、严格 0.004 m 阈值 **0 处**；新增的墙、门、地坪、
器具与两座新建筑全部避开共面。

## 状态：已收尾（截至 2026-10-08）

### 本轮：葡萄酒线补齐 + 工序演示页（`docs/brew-plan.md` 第 0–6 步全做完）

- **`BREW` 六座 → 八座**：新增 `press` 压榨房（x 62.4…74 / z -46…-32，h 6.2）与
  `winecellar` 葡萄酒窖（x 62.4…75 / z -62…-48，h 4.8，半地下），**按 z 升序置顶**，
  于是自东向西的顺序读出来是「葡萄 → 酒窖 → 压榨 → 收麦 → 烘麦 → 浸麦 → 煮酒 → 冷却 → 陈酿」。
  两座进 `BREW` 就自动长出檐沟/落水管，`check-brew` 从 6 座跟着变 8 座。
- **两座的 x0 都是 62.4**（让开檐沟 61.62、落水管 61.86、明沟 61.0…61.95、渗井井篦边 62.275），
  之间留 2 m；葡萄园行起点 Z0 从 -60.5 挪到 **-65.5**（-60.5 会穿过葡萄酒窖），
  酒花主圃从大院东头挪到巷西 x 57.6/60.0、z -62…-41（那块地被新建筑占了，
  且要在 `LANE.z0 = -40` 以北才碰不到修士动线 x 59.0/60.3）。
- **明沟 `chZ0` 从 -40 延到 -63、渗井从 (61.475,-46) 挪到 (61.475,-64)**：
  再往东（-64 以后）沟会从渗井头顶穿过，`check-brew` 第 6 项"渗井露天"当场报错。
- **葡萄酒窖不挖门前地坑**：门外只剩 1.4 m 且要横过明沟，改成墙外 `berm` 三级土坡
  （内缘探进墙 0.3 m、两端各缩进 0.6 m），读作"挖进地里的窖"。
- **`src/brewery-gear.js` 新增 `press()` / `winecellar()`**：两台螺旋压榨机 + 发酵槽 +
  葡萄筐堆 + 晾架；5 只立式橡木桶 + 2 只半埋 pithos + 三层酒架 + 油灯。共 381 件、0 出屋。
- **`brewInfo().process` 补葡萄酒三站**（葡萄园 / 压榨房 / 葡萄酒窖）→ 九站。
- **`tools/brewprocess.html`（新，第 5 步）**：工序列表 + 阶段飞行 + 字幕，
  麦粒 / 葡萄两颗沿巷子把各自那条线走一遍，走到哪座就点亮哪座的器具。
  走线点取 `b.x0 - 2.6`（门口点全在服务巷里，不穿墙、不横穿葡萄酒窖）；
  透视墙体默认开（阶段机位的视线要穿西墙）；克隆出来的高亮材质不在 `ghost` 名单里，
  所以开着透视时它是唯一不透明还在发光的东西。
- **两个真 bug（都不在原施工单里，但挡在验收路上）**：
  ① `wallSlab()` 门洞侧片中心写成 `-half - dw/2 + side/2`，多减了一次 `dw/2` ——
  每座房子门两侧各空出 **1.8 m 宽、通高的口子**，北墙还越过山墙伸到屋外 1.8 m。
  既有六座 x0 错开成 62/63/64，墙片落在不同平面上，从没报过 z-fight；新两座 x0 都是 62.4，
  伸出去的两段正好落在同一张 x 平面上 → 严格模式报 2 处 7.7 m²。改成各段自己的中点后归零。
  ② `brewInfo().drain.culvert` 还写着死的 `z0:-46.4, z1:-40`，几何那边却已由 `chZ0`/`soak`
  现算 —— `check-brew`/`check-rain` 读 mesh 包围盒所以照过，**`tools/brewery.html` 读 brewInfo**，
  演示页的水会飞进一根不存在的管子里。抽成 `brewCulvert()`，两边共用一份计算。
- **文档**：`docs/brewery-research.md`"酒花园"订正为 Hopfengarten；新建 `docs/wine-research.md`；
  `docs/brew-plan.md` 进度表标第 0–6 步全完成、坐标账本按建成值订正；README/HANDOFF 同步。

### 上一轮：葡萄园 + 酒花圃（`docs/brew-plan.md` 第 4 步）

- **`src/plantations.js`（新）**：葡萄园（行 x 57.5…72.5 / z -65.5…-76.7，5 行矮桩双铁丝，
  约 90 串、**紫 1096 + 白 288 = 1384 颗果粒**）与酒花圃（主圃杆 x 57.6 与 60.0 /
  z -62…-41 两行 + 沿服务巷西缘 x=56.9 一行，**229 个球果**）。果粒与球果各一个
  `InstancedMesh`——几千个独立 Mesh 会把 `grid.js` 与七个检查器全拖垮。
  依据见 `docs/wine-research.md`（中世纪北方葡萄是**矮桩密植**、
  Champagne 考古 + 圣雷米多联画）与 `docs/brewery-research.md`（酒花永远贴着酒厂）。
- **葡萄**要挂出果子**才是这一步的目的**，所以果粒半径 0.07、颜色提到 `#5e3160`：
  0.05 + 深紫 `#4b2a52` 实拍下来在阴影里只剩几个像素点，远看仍像"没有果子"。
  真实酒葡萄确实是深紫，但可见性优先，品种与年份一概不写（`wine-research.md` 第五节）。
- **地面要补**：葡萄园那块原来是**裸广场**（东扩带的草底只铺到 x=56），先补草地
  `patch(grass, 20, 20, 66, -68, 0.035)`，再压行间畦 0.05；酒花主圃在大院压实土 0.03 上，
  所以畦得再高一点避开共面。
- **挪树**：原来 (66,-50) 那棵在大院里；先后挪到 (57,-74)、最终定在 **(52,-72)**——
  东排住宅（x ≤ 45.1）与葡萄园（x ≥ 56）之间那条 11 m 空带，哪边都不压。
- 旧酒花架（东扩带 x -46..-8）保留在西边给教士住宅添点绿，但藤叶换成菜圃绿，
  不再叫"酒花圃"，免得跟大院那两处真酒花混淆。

### 上一轮：酒坊空壳 + 真门 + 屋内器具（`docs/brew-plan.md` 第 1–3 步）

- **酒坊八座改成可走进去的空壳**：`wallSlab()` 出四片 0.5 m 墙（北墙挖门洞）+ 地坪
  （`BREW_FLOOR_Y = 0.10`）+ 原有屋面；原先是一整块实心 `BoxGeometry(w,h,d)`。
  **改的三个必须同时做的事**：① 门挂 `userData.doorId`（`brewDoor()`），doors.js
  那套直接生效；② 屋内那面换 `brewInner`（带自发光），不然全黑；③ 墙厚 0.5 才够让
  1.4 m 一格的碰撞网格在门洞两侧留实体、中间让开。
- **`src/brewery-gear.js`（新）**：每座按工序摆器具，`userData.gear` 标记，
  `tools/check-gear.mjs`（新，第八个检查器）守"不出屋/不顶穿屋面/不沉到地下"。
- **踩过的三个坑（都写进注释了）**：① `wallSlab()` 无门洞时若返回 Mesh 而不是 Group，
  调用方一句 `position.set` 就把墙的 y=h/2 覆盖成 0，墙掉到地下；② 门宽必须在门组局部
  X 上（墙沿 z 走），放错到局部 Z 就分到墙的**厚度**方向，两扇门一前一后错开；
  ③ 器具与墙面/楼板相距 2–5 cm 时 `check-zfight` 一律判成共面（阈值 6 cm），
  要么探进去、要么挪开，没有第三条路。
- **`BREW[].stage` 一处数据三处用**：主站标注、`brewInfo().buildings[].stage`、
  新增的 `brewInfo().process`（演示页工序线）。名字也只存一份（门组上的 `doorName`）。
- `K` 键只管大教堂五座（加 `churchDoors()` 过滤）；面板十字平面图跳过领地门
  （viewBox 只盖到 x=±27，酒坊门在 x≈62 会落到图外）。
- 八个检查器基线全绿、冒烟 3182 网格、flicker 3507→**3515**（像素级噪声）。
- **收尾补拍两个二进制资产（2026-10-08）**：`docs/overview.png`（README 首图，
  `?view=1` 机位 1600×1000）当时已落后 **15 个改几何的提交**，`docs/tour.mp4` 更是比
  修士 NPC、回廊悬空亮线修复与整条葡萄酒线都早。两者都按当前场景重出：
  导览片 3321 帧 / 138.4 s，**crf 25 = 20.2 MiB（占 25 MiB 上限的 81%）**——
  同一批帧 crf 24 会到 24.0 MiB（96%，太满），两者对原帧 PSNR 只差 0.3 dB。
  重录命令见 README「导览影片」。

### 上一轮：回廊「只有轮廓、没有实体」的悬空亮线

- **真因是几何越界，不是光照**：`cloisterWalk()` 里敞廊拱心写死 `cx = i*4.7`、拱半宽 1.55，
  最外一洞外沿到 ±10.95；而南北短翼的墙长只有 `garth + depth = 20.2`（半宽 10.1），
  **洞口探出墙端 0.85 m**。`ExtrudeGeometry` 对越界洞口的三角化会在越界处拉出一条细长片，
  渲出来就是回廊里那根悬空的亮弧——"结构只有轮廓、没有实体"。长翼墙长 24.34 所以没事，
  只有南北两翼中招。定位手法：逐个隐藏网格 → 隐藏该敞廊墙时亮线消失 → 平涂 ID 上色
  确认同属一块 `ExtrudeGeometry`（见下 `tools/shot.html` 的 `__dbg`）。
- **修法**：新增 `bayCenters(len, a)`，按墙长收拱距，保证最外洞口外沿仍留在墙内、端头留得住
  墙垛。南北短翼 5 拱收到 4.025 m 间距（端头留 0.5 m），东西长翼仍是原来的 4.7 m（节奏不变）。
  外实墙小窗复用这组拱心保持上下对位；壁柱落到拱间墙垛上，并连 0.2 m 柱身一起夹在墙端以内
  （原先最外两根柱心在 ±11.75，短翼上连柱身都已出墙）。四角与内院实拍无穿模、无游离几何。
- **走廊顶纯黑一并修掉**：走廊是屋面下的半室内空间，朝下的屋面底面在阴影里只吃到天穹底色，
  实测 RGB 1,2,2。加了回廊专用材质 `cloWall` / `cloWallDark` / `cloSlate` / `cloPath`
  （`townMaterials()` 里定义，仅回廊用），带一点自发光当作来自内院/天光的漫射补光，
  把墙身和顶重新抬出体量。**不用全局 AmbientLight**：教堂内部靠烘焙顶点色吃饭，
  全局环境光会把黑成一片的中厅洗白。
- **诊断钩子留档**：`tools/shot.html` 加 `window.__dbg = { THREE, scene, r, hemi, sun }`，
  可在 `page.evaluate` 里临时改光/换材质/单显某块网格；`tools/shoot-main.mjs` 加
  `--bake=1`（默认 0 秒开，开了就等 `window.__baked` 再拍），用于主站烘焙对照。

### 更早一轮：领地修士 NPC（walkers）

- **`src/walkers.js`**：7 位修士 NPC 沿各自动线行走——回廊南北走廊各一位来回踱步、
  一位绕内院水井转经；服务巷两位沿酒坊巡查（开放路来回）；西前庭集市一位；北侧墓地一位。
  速度 0.75–1.2 m/s、会衣配色各异。每位就是一份 `buildPerson(pal)` 的替身。
- **挂 `scene` 不挂 `root`**（与第三人称替身一致）：不进碰撞网格、不进烘焙、七个检查器
  都看不见。NPC 是动的，丢进静态射线加速网格会留残影。
- **`poseWalk()`** 从 `monk.html` 提进 `src/person.js` 导出，替身 / NPC / 自检页共用；
  第三人称行走（V）时替身现在也摆臂。
- **`tools/check-npc.mjs`（新）**：同一份路由 + 同一张碰撞网格，沿每条路线走一圈，
  逐点查身体圆柱（10 方位）不蹭构件、脚底正好落地坪。基线 **7 位 / 约 2600 点 / 0 处**。
  排查中修掉三处：回廊走道**四角不贯通**（角上拱墙横到走道里）→ 走廊改开放路；
  集市原内圈撞摊棚柱、市场十字高台 7 m 会悬空 → 移到前庭西侧空场。
- **`tools/shoot-main.mjs`（新）**：拍主站本身（`?bake=0` 秒开），拍得到取景页没有的 NPC；
  用新的 `window.__lookAt` 钩子定点；`--q=` 透传任意 URL 参数（拍 `labels=1` 这类
  "要切开关才看得见"的画面不必改脚本）。
- 导览录制（`record-tour.mjs` → `__tourStep`）里也调 `walkers.update(dt)`：片子里 NPC 会走。

### 上一轮：修士模型 + 走路动画 v3

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
- **酿酒坊**（`BREW` 八建筑，z 东→西）：葡萄酒窖 → 压榨房 → 粮仓 → 烘干窑 → 麦芽楼 → 煮酒房 → 冷却·发酵 → 酒窖酒肆；
  服务巷 `LANE`、院坝水井、酒桶、酒花架/菜园药圃、墓园扩展、东排住宅外移（`EAST_HOUSE_X`）。
  **八座已从实心盒子改成可走进去的空壳**（2026-10-08；头六座当轮改，后两座随葡萄酒线补）：四片 0.5 m 墙（`wallSlab()`，
  北墙挖门洞）＋地坪 ＋原有屋面，门扇由 `brewDoor()` 挂 `userData.doorId`，
  `src/doors.js` 那套开关/缓动/挡人/随天气关门直接生效（`doorTown` 标记让 `K` 键与
  面板平面图跳过它们）。屋内器具在 `src/brewery-gear.js`，打 `userData.gear`，
  由 `tools/check-gear.mjs` 守住"不出屋/不顶穿屋面/不沉到地下"（当前 381 件、0 处越界）。
  工序数据 `BREW[].stage` → 主站标注、`brewInfo().process` → 演示页，与器具同源。
  **葡萄酒那条线已按 `docs/brew-plan.md` 施工单完工**（第 0–6 步），葡萄一侧原型见 `docs/wine-research.md`；
  2026-10-08 已订正一处文档误读：768 年 Weihenstephan 的"酒花园"是 **Hopfengarten（酒花）**，
  不是葡萄园——这条误读正是"葡萄树上没有葡萄"这个错觉的源头。
- **院子排水**（`buildBreweryDrain`，`userData.brew`）：檐沟（贴巷一面）→ 集水管（找齐到 `pipeX=61.86`）→
  落水管（每座一根，z0+0.15）→ 服务巷东缘明沟（x 61.0–61.95，通长 z **−63**..76，面 0.19 m）→
  东端出口暗管（y −0.44..−0.04，`brewCulvert()` 按 `chZ0`/`soak` 现算）→ 渗井（61.475, **−64**，井篦露地）。
  几何由 `brewInfo().drain` 回传。
- **两个新工具**：`tools/check-brew.mjs`（正向连通 7 项，含檐口射线双查）、`tools/brewery.html`
  （演示页：八座水路动画 + 名字标注 + 阶段机位 + 「一滴水走完全程」）；
  后来又加了 `tools/brewprocess.html`（两线九站的**工序**演示）与第八个检查器 `tools/check-gear.mjs`。
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
  `check-flicker` 开头自报一行"渲染后端"。基线：MX230 **3515 px**（连跑三次同一串数字）、
  软渲 3488 px，两者均 exit 0；`check-poke` 在 GPU 下仍 0 穿刺。

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
