# 修道院葡萄酒调研（葡萄园 / 压榨房 / 葡萄酒窖的参照）

> 2026-10-08，规划 `src/town.js` 的葡萄酒那条线之前的背景调研。
> 啤酒那半在 `docs/brewery-research.md`，两条线的施工单在 `docs/brew-plan.md`。
>
> **读法**：场景里的名字、院子与管线对不上真实原型时，以本页为依据。
> 每条都标了出处；查不到的我明确写"查不到"，不替它编。

---

## 一、我们这座院落在教会体系里为什么也能有葡萄

`brewery-research.md` 里说过：我们场景是**主教座堂的领地**（cathedral close），
不是有 abbot 领衔的 abbey。葡萄酒这条线要挂进来，得先回答"一个座堂领地为什么自己种葡萄"。

答案是**中世纪葡萄酒首先是必需品，不是奢侈品**，而且修院是它最大的生产组织者：

| 事实 | 出处 |
|---|---|
| 《本笃会规》第 40 章允许"适量饮酒，不可过量"，定量约一人一 **émine/hemina ≈ 0.25–0.27 L/天**（午餐两杯、晚餐一杯） | Maizières 修道院酒庄史（domaine 自己的 PDF，属二手）；cisterscapes.eu 的《Culinary Heritage of the Cistercians in Central Europe》；Historic Environment Scotland 的修士食谱 —— 三处互相印证 |
| 中世纪欧洲人均日耗葡萄酒估计 **1–2 L**（这一条只有二手来源，当量级看，不当硬数据） | Maizières 酒庄史 PDF |
| 中世纪大部分葡萄种植**掌握在修会手里**：靠什一税、捐赠与赎罪券换取大片土地 | 圣拉撒路会（Order of St Lazarus）葡萄酒经济研究，Lazarus Academy 论文集 |
| 西多会（Cistercian，1098 年创立于 Citeaux）每一座院都要自给：**一块围墙葡萄园 + 一套生产设施 + 修士与职工修士的住处 + 一座小教堂** | Maizières 酒庄史 PDF，原文把这条列为西多会酒庄的标准配置 |
| **雇员修士（conversi / 职工修士）才是下地干活的人**，很多出身于葡萄农家庭，把技术带进修院；Clos de Vougeot 大酒窖的阁楼就是他们的宿舍 | Clos de Vougeot 官网 900 年史；Laurière（La Perrière, Fixin）资料 |

**所以尺度感**：一座中型修院自己喝 + 待客 + 卖余酒，需要的是几十公顷的葡萄园和一间
能装几千桶的窖。我们场景只有 20×14 m 一块地（520 m² 里分到的），做的是
**象征性的自用葡萄园**——这个比例关系要在文案里说清楚，别让人以为我们复原了
Clos de Vougeot 的规模。

**和啤酒的关系**：同一个修院里两条线并存，各有分工。有文献记载不种葡萄的北方地区
（英格兰）圣拉撒路会种大麦麦芽酿麦芽酒，St Giles 有七口大桶、一口糖化桶、一口麦芽酒桶；
同时葡萄酒留给弥撒与待客。我们的场景照这个分工：**酒花/麦芽管日常饮食，
葡萄管礼仪与售卖**。

## 二、最硬的原型：Clos de Vougeot（西多会 Citeaux 修道院，勃艮第）

这是唯一一套中世纪葡萄园的生产设施**原物保存到今天**的实例，也是我们布局的模板。

### 时间线（能定日期的都用了树轮考古）

| 年份 | 事件 | 出处 |
|---|---|---|
| 1109–1115 | 购得/受赠 Vougeot 一带葡萄地 | Clos de Vougeot 官网；法国遗产档案（AD 21, 11 H 1146） |
| **1212** | 文书里第一次出现"**clos**"（围墙葡萄园）这个词 | Benoît Chauvin（CNRS/西多会经济史），Persée, *BEC* 2009 |
| **约 1164–1170**（树轮 **1160–1190**） | 建**大酒窖 cellier** | Chauvin 2009；Chauvin & Perrault 树轮研究 2007 |
| 1164 | 教宗 Alexander III 的诏书里首次出现 Clos de Vougeot 之名 | 二手资料，谨慎使用 |
| 约 1165–1168 | 与 Saint-Vivant de Vergy 修院划定地界，为围墙的前身 | Chauvin 2009 |
| **1477** | 建**压榨房 cuverie**（四翼围院，每翼 30×10 m） | 树轮研究 2007 |
| **1478 / 1489** | 四台压榨机中的两台上架（另两台是 18 世纪的） | 同上 |
| 1551 | 第 48 任院长 Jean Loisier 在葡萄园里加了一座文艺复兴城堡 | 官网 |

### 大酒窖 cellier —— 我们"葡萄酒窖"的原型

- **半地下**（*à demi-enterré*）。八根方形石柱（部分为整石）立在 3.70 m 高处，
  承一根极粗的橡木梁架；**梁架之上压着 65 cm 厚的碎石隔热层**（*remblai*）。
  出处：法国勃艮第文化遗产普查（Patrimoine）cellier/cuverie 记述。
- 容量约 **2000 只勃艮第桶 × 228 L ≈ 45.6 万升**（"2000 pièces bourguignonnes"）。
- 阁楼（grenier，石板顶）当**雇工修士的宿舍**——葡萄园离院区几十公里时，
  他们就住在园子里。
- 这就是"恒温"的做法：**不是靠厚墙，是靠埋进地里 + 屋顶压碎石**。
  我们的窖 h=4.8，读这件事的是**墙外那三级土坡**（`spec.berm`）——门前的地坑最后
  没挖（门外只剩 1.4 m，还要横过大院明沟，坑会把沟切开），改成朝葡萄园那一侧堆土，
  见 `docs/brew-plan.md` 葡萄酒窖那一行。屋顶那层碎石没做，屋面就是普通陶瓦。

### 压榨房 cuverie —— 我们"压榨房"的原型

**压榨机是"杠杆式压榨机"（pressoir à levier），不是小型的立式螺旋压榨机。**
这是最容易被做错的一件事：

- 一根 **6 根橡木拼成的杠杆**，Clos de Vougeot 最大那根约 **9.5 m**；
  Moissac 2018 年挖到一台 13 世纪末的同类机器，杠杆约 **7 m**。
- 杠杆靠**中央的一根铁螺杆 + 螺母**升降，螺母用**绞盘（cabas(t)an）**转动，
  原文写明要"**好几个人拉**"（*à bras d'hommes*）。
- 两侧的夹柱 **taissons** 不是插在地上的，是**V 字形埋进地里好几米深**
  （多处用石砌包裹加固）——这是这类机器最吃土的地方。
- 压的时候杠杆落在**一堆叠成金字塔形的木板（madriers）**上，
  板下才是装满葡萄的**压榨床（matis / maie）**；
  Clos de Vougeot 最大那台的压榨床 **>16 m²**，一台压 **4 吨**葡萄。
  （对照：香槟某庄园的压榨床不到 9 m²。）
- 葡萄汁**从压榨房地面的石槽流走**：勃艮第 Saint-Père 的 Vaufron 农庄那台压榨机
  装在一间**压榨室叠在拱顶大酒窖之上**的结构里，地面有三条石砌明槽汇向中央集液坑，
  汁液**直接落进下面酒窖的桶里**（Patrimoine 普查档案）。
- 另有一型较小的**中央螺杆式**（pressoir à vis centrale + 压榨轮/卷扬轮，
  又叫"鹦鹉轮"），占地 3.75 m 见方、压榨床 >8 m²，是小庄园与果酒作坊用的；
  还有一种更原始的"杆式/绞盘小压榨机"（pressoir à perche），是**家用**尺寸。
  我们做**大杠杆那一型**，因为它才是修院级的辨识物。

> ⚠️ 与我们布局的一处不一致，如实记下：原型是**压榨室在酒窖之上**（垂直叠置，
> 汁液顺石槽落下）。我们把压榨房与葡萄酒窖**前后相邻**放在服务巷东侧——院子进深
> 只有 20 m，装不下上下叠置，两座屋还得各留进深给器具。
> 原打算把"上下"改写成"一横一竖"：靠窖那一侧地面做三条石明槽汇到集液坑、
> 坑下开一道竖井通到葡萄酒窖北端的集汁桶。**这一条最后没做**：两座屋之间没有任何
> 过汁的构件，汁就地接在压榨台基那圈槽帮里，发酵槽也留在压榨房内。
> 这里记的是没做完的那一步。

### 葡萄园本身

- Clos de Vougeot 靠围墙圈成一片 50.95 公顷的园子；Citeaux 在 Côte 一带一共
  约二十座酒窖，单 Clos 一块连片 51 公顷（Chauvin 2009）。
- 西多会（以及所有修院）的葡萄园都由**同一个庄园经理（cellérier）**就地管理，
  从一个窖/农庄统一调度（Maizières PDF）。
- 1377 年 Citeaux 还为自家葡萄酒进入博讷城取得免税——**修院酒是能走的商品**。

## 三、葡萄到底怎么种（这一段最容易做错）

我们场景里没有葡萄树，用户看到的是一堆"杆子拉铁丝、上面没有果子"。
要补的果子之外，**架式**也值得定一下，因为我们这个纬度在中世纪属于北方。

已查到的：

- **Champagne**：考古（兰斯/特鲁瓦一带的预防性发掘）与**圣雷米修道院 11 世纪的多联画**
  （polyptyque）都显示当时的葡萄园是**"vigne en foule"**——**密植、不成行**，
  配 **provignage**（压条/放条繁殖）；
  Torvilliers "Les Plans de la Cure" 的发掘还见到了**complant**：葡萄与果树
  **混种在同一坑里**。
  出处：Crescentis（国际葡萄与葡萄酒史杂志）2024 年考古综述。
- **支撑方式**：这些中世纪的架普遍是**矮桩**——香槟传统做法是 1–1.15 m 长的木桩
  （bâton/échalas，栗木或橡木心材），用**漂白黑麦秸（glus）**把藤绑在桩上；
  18 世纪文献说每公顷可能要用到五万根桩，是 vineyard 里的大项开支。
  出处：Maisons de Champagne 的史料页；同一页也说明这套做法"可追溯到中世纪早期，
  19 世纪的记述（Maupin 1799、Guyot 1868、Moreau-Bérillon 1922）与之一致"。
- **更北的与更早的**：伊特鲁里亚传统把葡萄**绑到树上**（arborée），
  希腊—罗马那边是**杯形（gobelet）**；多瑙河、莱茵、罗讷沿线则是杯形 +
  Kammerbau（极矮的架）。中世纪末到近代的画里（Bellini 1480、Mantegna 1455、
  Veronese 1560）仍是"绑在树上或缠在杆上"（2024 年综述）。
  出处：*Viticultural landscape: history of a challenging coexistence between grapevines
  and humans*（综述）。

结论与取舍：

1. **"葡萄长在树上"在历史上是真的**（arborée / complant），所以用户看到的"树状藤架"
   本身不算错，错的是**一根果子都没有**。
2. 我们不做 arborée（树缠藤），因为 20×14 m 的小园子要的是**读得出"一行一行"**；
   做成**矮桩双铁丝**（铁丝 0.9 / 1.7 m，藤冠不过腰到胸），
   既接近"矮桩 + 绑扎"的北方做法，又让玩家一眼看出这是葡萄园而不是酒花架。
3. **一定要挂出葡萄串**——用 InstancedMesh，见 `docs/brew-plan.md` 第 4 步。

## 四、我们场景里的葡萄酒窖该长什么样

综合上面三条，落到 `docs/brew-plan.md` 的尺寸上：

| 依据 | 落到场景里 |
|---|---|
| 半地下 + 屋顶压碎石保恒温 | h = 4.8（**八座里最矮的一座**）+ **墙外三级土坡 `berm`**；门前不挖地坑（会切断大院明沟），屋顶碎石没做 |
| 容量按"自用 + 待客"缩比 | 不用 Clos de Vougeot 的两千桶量级；沿东墙一排 5 只立桶 + 酒架三层横躺小桶 9 只 + 2 只半埋陶瓮 |
| 陶瓮（pithos）是北方/东方的传统容器 | 挖地半埋，靠巷那侧的南北两端各一只 |
| 压榨室与酒窖有汁液通道 | **没做**（原计划的石明槽 + 集液坑 + 竖井已放弃）；汁就地接在压榨台基那圈槽帮里，见上文的不一致说明 |
| 雇工修士住园子里 | 葡萄园南缘一栋小屋（工具房/守园屋）——**本轮没做**，留作后续扩展 |
| 葡萄与酒能卖 | 酒肆在啤酒线的末端那间（长桌、长凳、账台、灌装台都在 `GEAR.cellar` 里）；**巷口的酒肆招牌已挂**（`cellarSign()`，挑出式，见下） |

**招牌的做法与为什么挑出去**：挂在酒窖·酒肆北墙外皮、门楣正上方，一根挑臂伸出门洞上方，
匾**垂在挑臂外端、板面与墙垂直**（法线朝 ±z），两面都做了浮雕（一只横躺的小酒桶 +
两道箍，朝北那面多一个铅龙头）。坐标全部从 `BREW` 里 cellar 这条 spec 现算。
关键不是好不好看，是**服务巷南北走向**：人沿 z 走，牌面若平行于墙（法线朝 −x），
前后 20 m 都只看得见一条竖线——第一版就是这么写的，站在巷子里实测确实读不出是个招牌。
中世纪酒馆的挑出招牌正是为了这个：过路人顺路就看清，不必停在门口。

**在故事里它也有自己的幕**：`brewStory()` 的「巷口挂出招牌」那一幕
（`tools/story.html` 第八幕）就站在巷子里抬眼看这块匾——机位从
`LANE` 与 cellar 的 spec 现算，不另抄坐标。

## 五、还没查清的（留给下一轮，不要在文案里当结论用）

- 我们这个纬度具体该种什么葡萄品种（黑皮诺？雷司令？莫岱尔？）——
  树轮与考古能证明"种了葡萄"，不能证明"种的是哪个品种"。
  演示页与标注里不要写品种。
- **雇工修士的作息与葡萄园劳作节律**（何时修剪、何时绑扎、何时采收）
  零星有账目数据（Courville 1381–1410 的账簿里有整地 terrage 的工量记录），
  够做参考，不够做动画时间轴。这一版先不做季节联动。
- 压榨机"每天压几次"这类产量数据没有可靠来源。

## 引用

- Benoît Chauvin, *Le clos et le château de Vougeot, cellier de l'abbaye de Cîteaux*,
  Bulletin de la Commission historique, Persée 2009 —
  https://www.persee.fr/doc/bec_0373_6237_2009_num_167_2_463980_t14_0577_0000_2
- B. Chauvin & C. Perrault 等，树轮研究《Le cellier et la cuverie du Clos de Vougeot (XIIe–XVIIIe s.)》2007
  （cellier 1160–1190、cuverie 1477、压榨机 1478/1489）
- Clos de Vougeot 官方 900 年史 — https://www.closdevougeot.fr/en/history
- Clos de Vougeot 官方资料页（cuverie 四台压榨机、cellier、雇工修士阁楼宿舍）— https://www.closdevougeot.fr/f/
- Wikipedia, *Clos de Vougeot* — https://en.wikipedia.org/wiki/Clos_de_Vougeot
- Bernard Lauvergeon, *Les grands pressoirs bourguignons pré-industriels : essai de
  chrono-typologie*, In Situ 5, 2004（压榨机三种大类型、taissons 埋深、压榨床面积、
  Chenôve 1449 年为已知最早年代）
- *Un pressoir … fin du XIIIe s., centre de Moissac*, Cresentis 2020 —
  https://preo.ube.fr/crescentis/?id=1079&lang=en
- Vaufron 农庄压榨机档案（压榨室叠在拱顶酒窖之上、石明槽汇入窖中桶）—
  https://gertrude-d.bourgognefranchecomte.fr/dossier/IM89002103
- *Traces archéologiques de culture de la vigne en Champagne*, Crescentis 2024 —
  https://preo.ube.fr/crescentis/index.php?id=1605&lang=en
- Maisons de Champagne, *Vines, Wines and Vine Growers*（中世纪矮桩 + 黑麦秸绑扎、
  圣雷米多联画）— https://maisons-champagne.com/en/encyclopedias/...
- *Viticultural landscape: history of a challenging coexistence between grapevines
  and humans*（树缠藤 / 杯形 / 极矮架的分区综述，2024）
- *Culinary Heritage of the Cistercians in Central Europe*, cisterscapes.eu（hemina 定量）—
  https://cisterscapes.eu/wp-content/uploads/2025/10/Buch-Kulinarisches-Erbe-ENGLISCH.pdf
- Abbey of Maizières 酒庄史 PDF（西多会葡萄园的标准配置；配额；租佃契约里的
  "两万个宜于栽葡萄的坑"尺寸）— https://domaineabbayedemaizieres.com/images/pdf/histoire-domaine-viticole-abbaye-de-maizieres-en.pdf
- *Wine, Women & Song: Viticulture economy of the Order of St Lazarus*, Lazarus Academy 论文集
  （北方修院酿麦芽酒 St Giles 的桶；修会掌握葡萄种植）
- Historic Environment Scotland, *A Medieval Monk's Menu*（一人一磅面包 + 一夸脱葡萄酒）—
  https://blog.historicenvironment.scot/2019/05/monks-menu/
- Eberbach Abbey, Wikipedia（300 公顷葡萄园、中世纪欧洲最大；葡萄酒占修院收入约四分之三；
  雇工修士餐厅里的 12 台酒压榨机）— https://en.wikipedia.org/wiki/Eberbach_Abbey