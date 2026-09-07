# 石头与光 · 程序化哥特大教堂

**在线体验：https://zhuguangjun2002.github.io/stone-and-light/**

用 Three.js 程序化生成的一座盛期哥特风格大教堂，可以在浏览器里自由漫游。
没有任何外部模型资源——每一块"石头"都是按真实大教堂的结构逻辑用代码砌出来的。

> **EN** — *Stone & Light* is a fully procedural High Gothic cathedral in vanilla Three.js:
> pointed arches, quadripartite rib vaults, flying buttresses, procedural stained glass,
> a construction-sequence animation with medieval site equipment, a cinematic guided tour,
> day/night lighting, synthesized bells, and parametric presets of Notre-Dame, Chartres,
> Amiens & Cologne. No external 3D assets — every stone is code.
> **Live demo:** https://zhuguangjun2002.github.io/stone-and-light/

![全景](docs/overview.png)

## 运行

```bash
cd church
python3 -m http.server 8123
# 打开 http://localhost:8123/
```

（任何静态文件服务器都可以；ES Module 不能直接用 file:// 打开。）

## 操作

| 按键 | 功能 |
|---|---|
| 拖动 / 滚轮 / 右键拖 | 环视 / 远近 / 平移 |
| `1`–`6` | 视角书签：全景 / 西立面 / 中厅 / 拱顶 / 飞扶壁 / 后殿 |
| `T` | 电影导览：十个镜头约两分半的自动巡游，字幕解说，含剖面镜头与建造蒙太奇，黄昏收尾（`→` 跳下一镜头，`Esc` 退出） |
| `B` | 建造过程动画：按真实施工顺序自东向西、自下而上生长，时间轴可播放 / 拖动；脚手架与大车轮吊车跟随施工前沿，完工鸣钟 |
| `F` | 第一人称行走：点击画面锁定鼠标，WASD 移动，Shift 加速，再按 `F` 返回环视 |
| `P` | 设计与光面板：名堂预设（巴黎圣母院 / 沙特尔 / 亚眠 / 科隆，选中弹出年代、数据与故事的解说卡片）；时刻滑块（太阳自东向西，晨昏光色）；开间数 / 起拱高 / 尖拱曲率 / 塔高，改动即重建整座教堂 |
| `G` / `M` | 敲一记钟 / 静音（钟声为 Web Audio 非谐泛音合成；室外有风与鸟，入堂自动安静） |
| `C` | 剖面切换：完整 → 横剖 → 纵剖 |
| `L` | 结构标注：固定屏幕尺寸，随相机在室内 / 室外自动切换两组，屏幕上压盖的标签近处优先、自动避让 |
| `H` | 收起帮助 |

URL 参数：`?view=3&section=1&labels=1&build=0.42&time=0.95&panel=1&tour=1&preset=cologne`

## 代码即结构：模块与建筑构件的对应

| 模块 | 建筑构件 | 结构原理 |
|---|---|---|
| `src/gothic.js` | 尖拱、束柱、山墙、小尖塔 | 尖拱可在同一高度适配任意跨度，是整套体系的几何自由度来源 |
| `src/vault.js` | 四分肋拱顶 | 蹼面取两个尖筒拱的相贯面 `y = max(纵拱, 横拱)`；不同跨度靠 `kForApex()` 调曲率拱到同一顶高 |
| `src/buttress.js` | 飞扶壁 = 扶壁墩 + 飞券 + 小尖塔 | 把拱顶的水平推力接力到侧廊之外，高墙才能开窗 |
| `src/glass.js` | 柳叶窗与玫瑰窗的彩色玻璃 | Canvas 程序化铅条镶嵌；用不发光材质模拟"窗自体发光"的哥特室内观感 |
| `src/facade.js` | 西立面：双塔、三门廊、玫瑰窗、国王廊 | 平面（中厅+双侧廊）直接投影为立面上的三座门 |
| `src/cathedral.js` | 总装：拉丁十字平面、三段式立面、屋面 | 逐开间（bay）装配——中世纪工地也是这样一跨一跨盖的 |
| `src/params.js` | 全部尺寸 | 基础参数 + `recomputeDerived()`；设计面板改的就是这里 |
| `src/presets.js` | 名堂预设 | 用参数近似圣母院（平顶塔）、沙特尔（不对称塔）、亚眠（最高拱顶）、科隆（巨塔）——同一套结构语言，各城各唱各的调 |
| `src/tour.js` | 电影导览脚本 | 十个镜头的推轨路径与字幕，含剖面镜头、建造蒙太奇、黄昏尾声 |
| `src/worksite.js` | 工地装备 | 脚手架（LineSegments 格架）、大车轮踏轮吊车、石料堆，跟随建造前沿移动 |
| `src/audio.js` | 声音 | 钟声按真实钟的非谐泛音列（hum/prime/tierce…）合成；风、鸟、入堂圣咏垫，全部 Web Audio 无音频文件 |
| `src/main.js` | 光照日夜、漫游 / 行走、剖面、标注、建造动画、设计面板 | 建造次序 = 区域（歌坛→耳堂→中厅逐开间→西立面→尖塔）+ 区域内自下而上；剖面用材质级裁剪；标注按室内 / 外分组并做屏幕空间去重 |

## 导览影片

[docs/tour.mp4](docs/tour.mp4) 是导览的成片（1280×720 / 24fps / 约 2 分 18 秒）。
重新渲染：页面以 `?record=1` 打开时进入确定性逐帧模式（`window.__tourStep(dt)`），
`tools/record-tour.mjs` 用 puppeteer 抓帧后由 ffmpeg 合成：

```bash
python3 -m http.server 8123 &
mkdir -p rec/frames && cd rec && npm i puppeteer-core
node ../tools/record-tour.mjs
ffmpeg -framerate 24 -i frames/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 21 tour.mp4
```

## 测试

```bash
node test/smoke.mjs   # 无浏览器构建整个场景图，校验网格数与总高
```
