#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""领地扩建方案俯视图：现状（实线）vs 拟扩（虚线）→ docs/expansion-plan.png
坐标与 src/town.js 一致：+x 南、+z 西；俯视图北在上、西在左。单位：米。"""
import os
from PIL import Image, ImageDraw, ImageFont

FR = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
FB = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
if not os.path.exists(FB):
    FB = FR

def F(sz, bold=False):
    return ImageFont.truetype(FB if bold else FR, sz, index=2)

S = 6.6
M0, M1 = 150, 150
W, H = 2040, 1400
def X(z): return M0 + (88 - z) * S
def Y(x): return M1 + (x + 70) * S

# ---- 现状四至（src/town.js） ----
NX, SX, EZ, WZ = -52, 56, -58, 78
# ---- 拟扩四至 ----
NX2, SX2, EZ2 = -64, 76, -78

# 配色
C_FIELD   = "#9fae7e"
C_CLOSE   = "#e6dec9"
C_SOUTH   = "#f5e2b8"   # 酿酒坊大院
C_EAST    = "#d3e2c2"   # 绕殿环廊 + 园圃
C_NORTH   = "#dedcd4"   # 墓园扩展（可选）
C_STONE   = "#9a958b"
C_STROKE  = "#4f4b44"
C_TOWER   = "#86817a"
C_CLO     = "#b9b3a4"
C_GARTH   = "#93ab74"
C_HOUSE   = "#cfa87c"
C_HOUSEO  = "#8f6f4a"
C_GRAVE   = "#b9c8a4"
C_PAVE    = "#bfbcb4"
C_EARTH   = "#cbba96"
C_WALL    = "#3f382f"
C_NEW     = "#b0392e"
C_GHOST   = "#9a9a9a"
C_BREW    = "#e8963f"
C_BREWO   = "#7c4a12"
C_TEXT    = "#26221c"
C_HALO    = "#ffffff"

img = Image.new("RGB", (W, H), C_FIELD)
dr = ImageDraw.Draw(img)

def zone(x0, x1, zw, ze, fill=None, outline=None, width=1):
    """x0<x1；zw/ze 为两条东西边（可互换）——屏幕西在左，X 随 z 增大而减小"""
    zw, ze = max(zw, ze), min(zw, ze)
    box = [X(zw), Y(x0), X(ze), Y(x1)]
    if fill:
        dr.rectangle(box, fill=fill)
    if outline:
        dr.rectangle(box, outline=outline, width=width)

def line(p1, p2, fill, width=1):
    dr.line([p1[0], p1[1], p2[0], p2[1]], fill=fill, width=width)

def dashed(p1, p2, fill, width=3, dash=12, gap=8):
    x1, y1 = p1; x2, y2 = p2
    d = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    if d == 0:
        return
    ux, uy = (x2 - x1) / d, (y2 - y1) / d
    t = 0.0
    while t < d:
        t2 = min(t + dash, d)
        line((x1 + ux * t, y1 + uy * t), (x1 + ux * t2, y1 + uy * t2), fill, width)
        t = t2 + gap

def segs(a, b, gaps):
    """[a,b] 上挖掉 gaps（世界坐标区间），返回保留段。"""
    gaps = sorted((max(a, g0), min(b, g1)) for g0, g1 in gaps if g1 > a and g0 < b)
    out, cur = [], a
    for g0, g1 in gaps:
        if g0 > cur:
            out.append((cur, g0))
        cur = max(cur, g1)
    if cur < b:
        out.append((cur, b))
    return out

def wallH(z, x0, x1, gaps, color, w=5, dashedline=False):
    """沿 x 方向的墙：固定 z，屏幕坐标 = (X(z), Y(a))"""
    for a, b in segs(x0, x1, gaps):
        p1, p2 = (X(z), Y(a)), (X(z), Y(b))
        (dashed if dashedline else line)(p1, p2, color, w)

def wallV(x, z0, z1, gaps, color, w=5, dashedline=False):
    """沿 z 方向的墙：固定 x，屏幕坐标 = (X(a), Y(x))"""
    for a, b in segs(z0, z1, gaps):
        p1, p2 = (X(a), Y(x)), (X(b), Y(x))
        (dashed if dashedline else line)(p1, p2, color, w)

def text(p, s, font, fill=C_TEXT, anchor="la", halo=2):
    if halo:
        for dx in (-halo, 0, halo):
            for dy in (-halo, 0, halo):
                if dx or dy:
                    dr.text((p[0] + dx, p[1] + dy), s, font=font, fill=C_HALO, anchor=anchor)
    dr.text(p, s, font=font, fill=fill, anchor=anchor)

def dot(x, z, r, fill, outline=None):
    cx, cy = X(z), Y(x)
    dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=outline)

def arrow(p1, p2, color, w=3, head=10):
    line(p1, p2, color, w)
    import math
    ang = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
    for s in (2.6, -2.6):
        a = ang + s
        line(p2, (p2[0] + head * math.cos(a), p2[1] + head * math.sin(a)), color, w)

def vtext(cx, cy, s, font, fill):
    """竖排（自下而上）文字，用于纵向尺寸标注。"""
    bb = font.getbbox(s)
    tw, th = bb[2] - bb[0] + 24, bb[3] - bb[1] + 24
    tmp = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    ImageDraw.Draw(tmp).text((12, 12), s, font=font, fill=fill, anchor="lm")
    rot = tmp.rotate(90, expand=True)
    img.paste(rot, (int(cx - rot.width / 2), int(cy - rot.height / 2)), rot)

# ============================================================
# 1) 地面分区
# ============================================================
zone(NX2, SX2, WZ, EZ2, fill=C_CLOSE)          # 新领地基底
zone(NX2, SX2, EZ, EZ2, fill=C_EAST)           # 东扩带（含北角）
zone(NX2, NX, WZ, EZ, fill=C_NORTH)            # 北扩带（可选）
zone(SX, SX2, WZ, EZ, fill=C_SOUTH)            # 南扩带
zone(NX, SX, WZ, EZ, fill=C_CLOSE)             # 现状领地

# 现状领地内部地面
zone(-34, 34, -41, -58, fill="#cfc9bb")                    # 绕殿巡游道（东排住宅外移后腾出）
zone(-46, -34, -41, -58, fill="#c9dfb4")                   # 殿东草地
zone(34, 46, -41, -58, fill="#c9dfb4")
zone(-46, -8, EZ, -69, fill="#c9dfb4")                     # 酒花圃（新东带）
zone(-4, 44, EZ, -69, fill="#c2d9a6")                      # 教士菜园（新东带）
zone(NX2, NX, 78, 46, fill="#c9dfb4")                      # 草药圃（新北带西段）
zone(NX2, NX, 46, -44, fill=C_GRAVE)                       # 墓园扩展
zone(-46, -26, 46, -44, fill=C_GRAVE)                      # 墓地（现状）
zone(43, 52, 75, -50, fill=C_EARTH)                        # 南侧土路
zone(-45, -30, 75, 53, fill="#b6c79a")                     # 西北角草地
zone(-29, 29, 77, 53, fill=C_PAVE)                         # 西前庭集市
zone(-25, -15, 46, 8, fill="#b6c79a")
zone(-25, -15, -8, -46, fill="#b6c79a")

# ============================================================
# 2) 酿酒坊大院（拟建 · 南扩带）
# ============================================================
zone(57.5, 61.5, 76, -40, fill="#d8cfba")                  # 服务巷
brew = [
    ("粮仓",    62, 74, -30, -12),
    ("烘干窑",  64, 74,  -6,   6),
    ("麦芽楼",  63, 74,   8,  24),
    ("煮酒房",  63, 74,  28,  44),
    ("冷却·发酵", 63, 74, 50, 60),
    ("酒窖·酒肆", 62, 75, 62, 76),
]
for name, x0, x1, zw, ze in brew:
    zone(x0, x1, zw, ze, fill=C_BREW, outline=C_BREWO, width=2)
for name, x0, x1, zw, ze in brew:
    cx = (X(zw) + X(ze)) / 2
    cy = (Y(x0) + Y(x1)) / 2
    lines = name.split("\n") if "\n" in name else [name]
    f = F(17, True)
    for i, ln in enumerate(lines):
        text((cx, cy - (len(lines) - 1) * 11 + i * 22), ln, f, fill="#4a2a08", anchor="mm")
# 院坝水井
dot(68.5, 47, 9, "#7fa8c9", "#41627d")
text((X(47), Y(68.5) - 22), "井", F(14), anchor="mm")
# 烘干窑烟囱
dot(73, -8, 6, "#4a3a28")
text((X(-8), Y(73) - 18), "烟囱", F(13), anchor="mm")

# ============================================================
# 3) 现状建筑
# ============================================================
# 教堂（中厅 + 耳堂 + 后殿 + 双塔）
zone(-8.4, 8.4, 50, 48, fill=C_STONE, outline=C_STROKE, width=2)
zone(-2.2, 2.2, 54, 50, fill=C_STONE, outline=C_STROKE, width=2)
zone(-14.2, 14.2, 48, -27, fill=C_STONE, outline=C_STROKE, width=2)
zone(-24, 24, 7.4, -7.4, fill=C_STONE, outline=C_STROKE, width=2)
cx0, cy0, r = X(-27), Y(0), 13.7 * S
dr.pieslice([cx0 - r, cy0 - r, cx0 + r, cy0 + r], -90, 90,
            fill=C_STONE, outline=C_STROKE, width=2)
zone(-14.8, -6.8, 55.5, 47.5, fill=C_TOWER, outline=C_STROKE, width=2)
zone(6.8, 14.8, 55.5, 47.5, fill=C_TOWER, outline=C_STROKE, width=2)

# 回廊
zone(18.5, 42.9, 37.4, 13, fill=C_CLO, outline="#7d766a", width=2)
zone(22.7, 38.7, 33.2, 17.2, fill=C_GARTH)
dot(25.2, 30.7, 7, "#7fa8c9", "#41627d")

def dashed_rect(x0, x1, zw, ze, color, w=3, dash=11, gap=7):
    zw, ze = max(zw, ze), min(zw, ze)
    dashed((X(zw), Y(x0)), (X(ze), Y(x0)), color, w, dash, gap)
    dashed((X(zw), Y(x1)), (X(ze), Y(x1)), color, w, dash, gap)
    dashed((X(zw), Y(x0)), (X(zw), Y(x1)), color, w, dash, gap)
    dashed((X(ze), Y(x0)), (X(ze), Y(x1)), color, w, dash, gap)

# 教士住宅：南排现状（实心）；东排现状原位改虚线（拟外移）
for z in [70, 60.4, 50.8, 41.2, 31.6, 22, 12.4]:
    zone(46, 55.6, z + 4.3, z - 4.3, fill=C_HOUSE, outline=C_HOUSEO, width=2)
for xc in [-40, -28.5, -17, -5.5, 6, 17.5, 29, 40.5]:
    dashed_rect(xc - 4.6, xc + 4.6, -49.2, -57.6, C_GHOST)

# 东排住宅外移后的新址（贴新东墙）——在 x≈0 留出殡门通道
# -17 改 -18.5：房宽 9.2 m，-17 与 -8 只隔 9 m，两栋会咬在一起
for xc in [-40, -28.5, -18.5, -8, 8, 17.5, 29, 40.5]:
    zone(xc - 4.6, xc + 4.6, -68.8, -77.6, fill=C_HOUSE, outline=C_HOUSEO, width=2)
    dashed_rect(xc - 4.6, xc + 4.6, -68.8, -77.6, C_NEW)

# 西正门门楼
zone(-5.25, 5.25, 80.6, 75.4, fill="#7a746a", outline=C_STROKE, width=2)

# 树
for tx, tz in [(20, 44), (38, 8), (66, -50), (-24, -12), (-38, 18), (-20, 46),
               (44, 60), (-44, 64), (8, 74), (-10, 74), (50, -8), (-30, -50), (30, -50)]:
    dot(tx, tz, 11, "#6d7f52", "#55663f")

# 排水渗井（现状 drainageInfo）
dot(44.3, 32.7, 7, "#5a5348", "#2f2a22")

# ============================================================
# 4) 绕殿巡游道弧线 + 园圃行列
# ============================================================
ar, acx, acy = 15 * S, X(-27), Y(0)
dr.arc([acx - ar, acy - ar, acx + ar, acy + ar], -70, 70,
       fill="#a8906a", width=6)
for zz in [-62, -66]:
    line((X(zz), Y(-44)), (X(zz), Y(-8)), "#a8bf90", 2)
    line((X(zz), Y(-2)), (X(zz), Y(42)), "#9fb887", 2)

# ============================================================
# 5) 围墙
# ============================================================
# 现状围墙（实线）：西墙保留
wallH(WZ, NX, SX, [(-5.6, 5.6)], C_WALL, 6)
# 旧墙降为庭墙（虚线）：南 / 东 / 北，留出通行缺口
wallV(SX, EZ, WZ, [(-39, -31), (18.5, 21.5), (24, 28), (66, 70)], C_GHOST, 4, True)
wallH(EZ, NX, SX, [(-2.2, 2.2), (-42, -38), (20, 24)], C_GHOST, 4, True)
wallV(NX, EZ, WZ, [(-21.5, -18.5), (2, 6)], C_GHOST, 4, True)

# 拟新建围墙（红虚线）
wallV(SX2, EZ2, WZ, [(-39, -31)], C_NEW, 6, True)
wallH(EZ2, NX2, SX2, [(-2.2, 2.2)], C_NEW, 6, True)
wallV(NX2, EZ2, WZ, [(-21.5, -18.5)], C_NEW, 6, True)
for tx, tz in [(SX2, WZ), (SX2, EZ2), (NX2, WZ), (NX2, EZ2)]:
    zone(tx - 0.8, tx + 0.8, tz + 0.8, tz - 0.8, fill=C_NEW)
for tx, tz in [(SX, WZ), (SX, EZ), (NX, WZ), (NX, EZ)]:
    zone(tx - 0.8, tx + 0.8, tz + 0.8, tz - 0.8, fill=C_WALL)

# 门位小标记（新墙缺口端头）
for z0, z1, xw in [(-39, -31, SX2), (-21.5, -18.5, NX2)]:
    for zt in (z0, z1):
        dot(xw, zt, 4, C_NEW)
for zt in (-2.2, 2.2):
    dot(zt, EZ2, 4, C_NEW)

# ============================================================
# 6) 文字标注
# ============================================================
text((X(10), Y(0)), "教堂", F(30, True), anchor="mm")
text((X(25.2), Y(30.7)), "回廊", F(21, True), fill="#20301a", anchor="mm")
text((X(1), Y(-36)), "墓地", F(21), fill="#2c3a22", anchor="mm")
text((X(65), Y(0)), "西前庭集市", F(19), anchor="mm")
text((X(16), Y(50.6)), "教士住宅", F(15), anchor="mm")
text((X(-53), Y(34)), "教士住宅（东排）", F(15), anchor="mm")
text((X(37), Y(44.3)), "渗井", F(14), anchor="mm")
text((X(83), Y(0)), "西正门·门楼", F(15), anchor="mm")
text((X(-82), Y(0)), "殡门", F(15, True), fill=C_NEW, anchor="mm")
text((X(20), Y(61)), "便门", F(13), anchor="mm")
text((X(-20), Y(-56)), "便门", F(13), anchor="mm")
text((X(-35), Y(73)), "粮车门", F(15, True), fill=C_NEW, anchor="mm")
text((X(26), Y(59.5)), "庭门", F(13), fill="#7a746a", anchor="mm")

# 分区标题
text((X(-44), Y(66.5)), "酿酒坊大院", F(18, True), fill="#8a4b12", anchor="mm")
text((731, 168), "北扩 +12 m（可选）：墓园扩展 · 草药圃", F(16, True),
     fill=C_NEW, anchor="mm")
text((X(25), Y(-58)), "墓园扩展", F(15), fill="#4a4a42", anchor="mm")
text((X(62), Y(-58)), "草药圃", F(15), fill="#3d5230", anchor="mm")
text((X(-49), Y(0)), "绕殿巡游道", F(18), fill="#5b4a33", anchor="mm")
text((X(-63), Y(-26)), "酒花圃", F(17), fill="#3d5230", anchor="mm")
text((X(-63.5), Y(20)), "教士菜园", F(17), fill="#3d5230", anchor="mm")
text((X(-73), Y(-57)), "教士住宅（移至新墙）", F(14), fill="#6b6b6b", anchor="mm")
line((X(-73), Y(-54)), (X(-73), Y(-44)), C_GHOST, 3)
# 外移箭头
arrow((X(-57.6), Y(34)), (X(-70), Y(34)), C_GHOST, 3)
text((X(-66), Y(40)), "外移", F(14), fill="#6b6b6b", anchor="mm")
# 可选主教宫（旧墙内西北角，不依赖北扩）
zone(-52, -35, 74, 48, outline="#5b6a92", width=3)
text((X(61), Y(-44.5)), "可选：主教宫", F(14), fill="#3c4a72", anchor="mm")
text((X(61), Y(-41.5)), "（代替城堡）", F(14), fill="#3c4a72", anchor="mm")

# ============================================================
# 7) 尺寸标注
# ============================================================
# 南扩：方向为北—南，箭头放在空置的东南带内
arrow((X(-57), Y(56)), (X(-57), Y(76)), C_NEW, 3)
arrow((X(-57), Y(76)), (X(-57), Y(56)), C_NEW, 3)
text((1140, 1150), "南扩 +20 m（南墙 56 → 76）", F(17, True),
     fill=C_NEW, anchor="mm")
# 总宽（西—东）
arrow((X(-78), 1240), (X(78), 1240), C_TEXT, 2)
arrow((X(78), 1240), (X(-78), 1240), C_TEXT, 2)
text(((X(-78) + X(78)) / 2, 1218), "西—东：136 m → 156 m", F(17), anchor="mm")
# 北扩
arrow((731, Y(-64)), (731, Y(-52)), C_NEW, 3)
text((745, (Y(-64) + Y(-52)) / 2), "+12", F(16, True), fill=C_NEW, anchor="lm")
# 东扩
arrow((X(-78), 315), (X(-58), 315), C_NEW, 3)
arrow((X(-58), 315), (X(-78), 315), C_NEW, 3)
text(((X(-78) + X(-58)) / 2, 292), "+20", F(16, True), fill=C_NEW, anchor="mm")
# 北—南总尺寸（竖排）
vtext(64, (Y(-64) + Y(76)) / 2, "北—南：108 m → 140 m", F(16), C_TEXT)
text((112, Y(76) + 14), "西面不动", F(15), fill="#5a5a52", anchor="mm")

# 指北针
line((75, 135), (75, 66), C_TEXT, 3)
dr.polygon([(75, 52), (67, 72), (83, 72)], fill=C_TEXT)
text((75, 146), "北", F(17, True), anchor="mm")

# 比例尺
line((150, 1330), (150 + 20 * S, 1330), C_TEXT, 3)
for i in range(3):
    xx = 150 + i * 10 * S
    line((xx, 1323), (xx, 1337), C_TEXT, 2)
text((150, 1346), "0", F(14), anchor="ma")
text((150 + 20 * S, 1346), "20 m", F(14), anchor="ma")

# 标题
text((150, 34), "石头与光 · 教堂领地扩建方案", F(36, True), anchor="la", halo=0)
text((150, 88), "俯视平面 · 现状（实线/深色）vs 拟扩（红虚线/彩色分区）· 单位：米",
     F(19), fill="#4a463f", anchor="la", halo=0)
text((150, 116), "领地 108×136 m（14,688 m²）→ 140×156 m（21,840 m²，+49%）",
     F(19, True), fill=C_NEW, anchor="la", halo=0)

# ============================================================
# 8) 右侧图例与说明
# ============================================================
PX0, PY0, PX1, PY1 = 1348, 150, 2016, 1376
dr.rectangle([PX0, PY0, PX1, PY1], fill="#fdfcf7", outline="#8a8478", width=2)
px = PX0 + 26
y = PY0 + 24
def L(s, f, fill=C_TEXT, dy=27):
    global y
    text((px, y), s, f, fill=fill, anchor="la", halo=0)
    y += dy

L("图例", F(24, True), dy=36)
for mark, s in [("solid", "现状围墙（高 4.2 m）"),
                ("new",   "拟新建围墙"),
                ("ghost", "旧墙降为庭墙 / 住宅外移"),
                ("brew",  "酿酒坊建筑（拟建）"),
                ("stone", "教堂 · 回廊 · 住宅（现状）"),
                ("green", "巡游道与园圃 · 墓园")]:
    yy = y + 10
    if mark == "solid":
        line((px, yy), (px + 54, yy), C_WALL, 6)
    elif mark == "new":
        dashed((px, yy), (px + 54, yy), C_NEW, 6, 12, 7)
    elif mark == "ghost":
        dashed((px, yy), (px + 54, yy), C_GHOST, 4, 10, 6)
    elif mark == "brew":
        dr.rectangle([px, yy - 9, px + 54, yy + 9], fill=C_BREW, outline=C_BREWO, width=2)
    elif mark == "stone":
        dr.rectangle([px, yy - 9, px + 54, yy + 9], fill=C_STONE, outline=C_STROKE, width=2)
    else:
        dr.rectangle([px, yy - 9, px + 54, yy + 9], fill=C_EAST, outline="#8fa87a", width=2)
    text((px + 68, yy), s, F(17), anchor="lm", halo=0)
    y += 32
y += 14
L("方案要点", F(24, True), dy=36)
for s in [
    "1  南扩 20 m（南墙 56→76）：新建酿酒坊大院——粮",
    "     仓、烘干窑、麦芽楼、煮酒房、冷却发酵间、酒窖酒",
    "    肆；旧南墙降为庭墙，新墙开粮车门（z≈-35）。",
    "2  东扩 20 m（东墙 -58→-78）：教士住宅东排外移贴",
    "     新墙，腾出绕殿巡游道与酒花圃 / 菜园；后殿不再",
    "     紧贴住宅，留出绕殿环行的余地。",
    "3  北扩 12 m（可选，北墙 -52→-64）：墓园扩展与草",
    "     药圃，给教士日常用药与病坊留地。",
    "4  西面不动：正门、门楼、集市与前庭维持原状。",
    "5  面积 14,688 → 21,840 m²（+49%），新增过半是园",
    "     囿墓地，建筑只占南带一小半。",
]:
    L(s, F(17), fill="#3a3630", dy=26)
y += 14
L("要不要城堡？", F(24, True), dy=36)
for s in [
    "不必。城堡属军事领主，修道院 / 教堂领地史上没有；",
    "强修一座会抢主教堂的主角，也与本项目气质不合。",
    "建议：防御感由现有门楼、四角塔与 4.2 m 围墙承担；",
    "若要制高点，可在西北角加一座「主教宫 + 方塔」",
    "（图上蓝框，可选），威仪够用又不喧宾夺主。",
]:
    L(s, F(17), fill="#3a3630", dy=26)
y += 14
L("实现提示（获批后改）", F(24, True), dy=36)
for s in [
    "town.js：四至常量 SX/NX/WZ/EZ、旧墙降庭墙、新增",
    "酒坊与园圃（挂 root，标 userData.town / buildSkip）；",
    "main.js：广场面片 110×190 需加宽；outerGrass 外移；",
    "重跑 z-fight / rain / poke / flicker 四检查器 + smoke。",
]:
    L(s, F(17), fill="#3a3630", dy=26)

out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "docs", "expansion-plan.png")
os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out)
print("saved", out, img.size)
