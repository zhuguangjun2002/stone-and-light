# tools/generate_monk.py
# -------------------------------------------------------------------
# 用 Blender 无头生成中世纪修士模型（三种途径：旋转放样的长袍/披肩带
# 装饰物件：球头裸色兜帽/颈项披风衣领/胸腰绳带/念珠/皮囊），并导出 monk.glb。
#
# Ubuntu 运行示例：
#   blender --background --python tools/generate_monk.py -- assets/monk.glb
#   （-- 之后跟要保存的 glb 路径；缺省存 assets/monk.glb）
# -------------------------------------------------------------------
import bpy, math, os, sys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), '..', 'assets', 'monk.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb2lin(hexstr):
    h = hexstr.lstrip('#')
    f = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(c ** 2.2 for c in f)


def make_mat(name, hexcolor, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*srgb2lin(hexcolor), 1.0)
    bs.inputs['Roughness'].default_value = rough
    return m


def mesh_from_pydata(name, verts, quads):
    m = bpy.data.meshes.new(name)
    m.from_pydata(verts, [], quads)
    for p in m.polygons:
        p.use_smooth = True
    m.update()
    o = bpy.data.objects.new(name, m)
    bpy.context.collection.objects.link(o)
    return o


def lathe(name, profile, segments, reverse=False, mat=None):
    """把 2D 剖面（多边形 r,y 对，按 z 单调排列）绕竖轴立转成贴片。
    Blender 坐标 Z 向上；reverse=True 表示剖面按 z 递减排列（如兜帽由下往上）。"""
    verts = []
    for (r, z) in profile:
        for i in range(segments):
            a = i / segments * 2 * math.pi
            verts.append((r * math.cos(a), -r * math.sin(a), z))
    quads = []
    rows, cols = len(profile), segments
    for r in range(rows - 1):
        for j in range(cols):
            a = r * cols + j
            b = r * cols + (j + 1) % cols
            c = (r + 1) * cols + j
            d = (r + 1) * cols + (j + 1) % cols
            quads.append((a, c, d, b) if not reverse else (a, b, d, c))
    obj = mesh_from_pydata(name, verts, quads)
    if mat:
        obj.data.materials.append(mat)
    return obj


robe_mat = make_mat('Robe', '#6f5b45', 0.95)
cape_mat = make_mat('RobeDark', '#5d4c39', 0.95)
rope_mat = make_mat('Cincture', '#c9b294', 0.9)
skin_mat = make_mat('Skin', '#c8957a', 0.65)
hair_mat = make_mat('Beard', '#54453a', 0.95)
pouch_mat = make_mat('Leather', '#8a653f', 0.85)

# 1) 长袍（含衣褶扰动）
robe_key_y = [(0.001, 0.0), (0.30, 0.0), (0.285, 0.06), (0.26, 0.18),
              (0.21, 0.55), (0.175, 0.78), (0.20, 1.02),
              (0.185, 1.18), (0.12, 1.30), (0.085, 1.36)]
robe = lathe('Robe', robe_key_y, 20, mat=robe_mat)
for v in robe.data.vertices:
    x, y, z = v.co
    r = math.hypot(x, y)
    if r < 1e-4:
        continue
    wob = math.cos(math.atan2(y, x) * 6) * 0.016 * max(0.0, 1.0 - z / 1.2)
    s = (r + wob) / r
    v.co.x *= s
    v.co.y *= s

# 2) 大披肩（从腰间收到肩）
cape = lathe('Cape', [(0.29, 1.03), (0.155, 1.29)], 16, mat=cape_mat)

# 3) 项圈
collar = lathe('Collar', [(0.16, 1.03), (0.16, 1.29)], 14, mat=cape_mat)

# 4) 小短袍/补衿（罩住披肩上缘）
# 5) 腰带（半圆带形）
belt = lathe('Cincture', [(0.176, 0.727), (0.20, 0.74), (0.176, 0.753)], 20, mat=rope_mat)

# 腰带垂绳三颗念珠:
def sm(name, x, y, z, r, sx, sy, sz, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=10, ring_count=8)
    o = bpy.context.active_object
    o.name = name; o.data.name = name
    o.location = (x, y, z); o.scale = (sx, sy, sz)
    o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = True
    return o

def robeR(y):
    for i in range(1, len(robe_key_y)):
        if y <= robe_key_y[i][1]:
            (r0, y0), (r1, y1) = robe_key_y[i - 1], robe_key_y[i]
            u = (y - y0) / ((y1 - y0) or 1)
            return r0 + u * (r1 - r0)
    return 0.165

for i, dx in enumerate([0.055, 0.10]):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.007, depth=0.45, vertices=6)
    st = bpy.context.active_object
    st.name = 'Strip' + str(i)
    st.location = (-0.04 + dx, 0.21, 0.623)
    st.rotation_euler = (0.115, 0.0, 0.0)
    st.data.materials.append(rope_mat)

for i in range(6):
    zb = 0.55 - i * 0.05
    sm('Bead%d' % i, 0.02 + i * 0.016, robeR(zb) + 0.016, zb,
       0.014, 1, 1, 1, make_mat('Bead%d' % i, '#4a3b2e', 0.8))

# 6) 皮囊
sm('Pouch', 0.185, -0.06, 0.66, 0.055, 1, 0.55, 1.25, pouch_mat)

# 7) 头 + 兜帽（罩住头顶99°）
sm('Head', 0, 0, 1.5, 0.125, 1, 1, 1, skin_mat)
hood_profile = []
for i in range(13):
    a = i / 12 * 0.55 * math.pi          # anglefrom顶99°递减至0
    hood_profile.append((0.14 * math.sin(a), 1.52 + 0.14 * math.cos(a)))
hood_profile.reverse()
hood = lathe('Hood', hood_profile, 16, mat=cape_mat)

# 8) 胡须 + 鼻梁
sm('Beard', 0, 0.095, 1.425, 0.06, 1, 0.75, 1.35, hair_mat)
bpy.ops.mesh.primitive_cone_add(radius1=0.016, radius2=0.0001, depth=0.045, vertices=8)
nose = bpy.context.active_object
nose.name = 'Nose'
nose.location = (0, 0.125, 1.485)
nose.rotation_euler = (-math.pi / 2, 0, 0)
nose.data.materials.append(skin_mat)
for p in nose.data.polygons: p.use_smooth = True

# 9) 双手
sm('HandL', -0.12, 0.16, 0.80, 0.035, 1, 1, 1, skin_mat)
sm('HandR', 0.12, 0.16, 0.80, 0.035, 1, 1, 1, skin_mat)

# 10) 脚
sm('FootL', -0.09, 0.04, 0.05, 0.05, 0.8, 1.6, 0.4, make_mat('Foot', '#3a332a', 0.95))
sm('FootR', 0.09, 0.04, 0.05, 0.05, 0.8, 1.6, 0.4, make_mat('Foot', '#3a332a', 0.95))

# materials

os.makedirs(os.path.dirname(os.path.abspath(OUT)) or '.', exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB')
print('exported', OUT)
