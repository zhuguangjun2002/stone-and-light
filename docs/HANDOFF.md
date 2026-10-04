# 交接说明（Handoff）

> 给切换模型 / 新接手者的一份快速状态快照。长期文档看 `README.md`。

## 项目一句话

**石头与光**：纯 Three.js 程序化生成的一座盛期哥特风格大教堂 + 教堂领地（close），
无任何外部模型/图片资源。在线 <https://church.bigcow.net>，本地 `python3 -m http.server 8123` 后开 <http://localhost:8123/>。

## 坐标系与关键尺寸

- y 向上；中厅轴线沿 **z**，西立面在 **+z**，后殿在 **−z**；**+x 南**、−x 北。
- 参数集中在 `src/params.js` 的 `P`，派生量在 `recomputeDerived()`：
  `aisleOut=13.2`、`outerX=14.2`（侧廊外墙外皮）、`naveZ0=6`、`naveZ1=48`、`choirZ1=-27`。
- 领地四至（`src/town.js` 常量）：南 `SX=56`、北 `NX=-52`、西 `WZ=78`、东 `EZ=-58`；墙高 `WALL_H=4.2`。
- 回廊（`CLO`）：`x0=18.5`、`z0=13`、内院 `garth=16`、敞廊进深 `depth=4.2`。
  回廊西缘与南侧扶壁墩（最远 x≈15.9）之间留 ~2.6 m 过道；东缘（x=42.9）与南墙住宅前脸
  （最浅 x≈45.4）之间也宽出 ~2.5 m——东西两侧的过道差不多宽。

## 代码地图

| 文件 | 职责 |
|---|---|
| `src/cathedral.js` | 总装：拉丁十字平面、三段式立面、屋面、耳堂、后殿、管风琴、光柱 |
| `src/town.js` | 领地：围墙+门楼（压顶石/垛口/四角小塔楼）、回廊、教士住宅、墓地、集市、**院内地面分级** |
| `src/main.js` | 入口：渲染/日照/环视/行走/剖面/标注/建造动画/面板；另有 **地下泥土层 + `addFoundations` 地基**（挂在 scene 不挂 root） |
| `src/gothic.js` | 尖拱、束柱、小尖塔、山墙、坡屋面、`wallWithOpenings` 开洞墙 |
| `src/bake.js` / `bakeworker.js` / `grid.js` | 室内顶点色烘焙（Worker 并行 + IndexedDB 缓存 + 射线加速网格） |
| `src/doors.js` / `glass.js` / `vault.js` / `buttress.js` / `facade.js` / `figure.js` / `materials.js` / `presets.js` / `tour.js` / `worksite.js` / `audio.js` | 各自构件/声音/导览/工地 |
| `tools/` | 四个检查器 + 取景页（shot.html）+ 烘焙对照 + 导览录制 |
| `test/smoke.mjs` | 无浏览器冒烟 |

## 领地接入的约定（重要）

- `buildTown()` 的 group 被 `buildCathedral()` 挂进 `root` → 自动进**第一人称碰撞/重建/释放**。
- 领地材质标 `userData.noBake`（`bake.js` 跳过），网格标 `userData.buildSkip`（建造动画跳过）、`userData.town`（穿刺检查器跳过）；树额外标 `noFoundation`（不长地基）。
- 烘焙版本 `BAKE_VER=2`（`src/main.js`）。

## 检查器基线（当前全绿）

```bash
node test/smoke.mjs                 # ~2430 网格，通过
node tools/check-zfight.mjs 0.004 0.2   # 严格共面 0 处
node tools/check-rain.mjs           # 0 处漏雨
node tools/check-poke.mjs           # 0 处穿刺（按 userData.town 跳过领地）
node tools/check-flicker.mjs        # 外观 0.02–0.18%、剖面 ≤0.09%，无成片抖动
```

## 已知待办 / 未定

1. ~~回廊东侧偏紧~~ **已改**：内院 `CLO.garth 18→16`，东缘落到 x=42.9，与南墙住宅
   前脸（最浅 x≈45.4）之间宽出 ~2.5 m，与西侧扶壁墩过道（~2.6 m）差不多对称。
2. ~~前庭石板无纹理~~ **已改**：`src/materials.js` 的 `pavingTexture()` 程序化石板贴图；
   `buildGround` 里石板区按世界坐标铺 UV（一张 6 m 见方）。
3. **媒体过期**：`docs/` 里 5 张截图（west / interior / vault / section / apse）**没有任何
   地方引用**，且都是领地之前拍的；`tour.mp4` 也偏旧，只有 `docs/overview.png` 最新。
   要么重拍并挂进 README 画廊，要么删掉这些孤儿文件。
4. 墙头垛口疏密（当前齿 0.9 m / 间距 2.0 m）、院内土院/草地比例，可视口味调。

## 关于看效果

- 助手**能读图**（`read` 一张 PNG 会作为图片附件送进模型）。所以验证视觉走这个循环：
  改代码 → `node tools/shoot.mjs …` 出 PNG → 直接 `read` 看 → 不满意再改。
  `tools/shoot.mjs` 加载 `tools/shot.html`（`preserveDrawingBuffer:true`），
  用 `window.__shot(px,py,pz,tx,ty,tz)` 与 `window.__sunAt(t)` 定点出图：
  `node tools/shoot.mjs --view=1,2`，或 `--at=0,50,110,0,0,64`（可重复，写到 `/tmp/church-shot/`）。
- 不方便看图时仍可退到**像素采样**：`gl.readPixels` 读中心/网格点的 RGB 数字；
  或 `xdg-open docs/overview.png`。
- 注：`tools/shot.html` 不做室内光照烘焙，室内对比仍以主站（`?view=…`）为准。

## 部署

push 到 `main` → Cloudflare Pages 自动上线（Git 集成，无构建）。`tools/deploy-cf.sh` 是应急直传，一般不用。
