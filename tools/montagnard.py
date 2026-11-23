"""Le montagnard, version de travail : modèle stylisé, squelette, gestes, rendu en sprites.

Lancement : python montagnard.py -- <dossier de sortie> [action ...]

But : valider la chaîne complète avant d'investir dans le vrai modèle.
 - un petit homme trapu en capuche, fait de volumes simples lissés ;
 - un squelette, chaque volume rigidement attaché à son os (les volumes se
   chevauchent aux articulations, ce qui cache les jointures) ;
 - des gestes calculés image par image (pas d'images clés à gérer) ;
 - deux rendus par image, comme pour un jeu :
     albedo  : la couleur à plat, sans lumière, avec un trait d'encre ;
     normal  : la normale en espace caméra, pour que la scène WebGL éclaire
               le personnage avec SA lumière (le feu, la lune).
Aucun personnage ne mime un exercice : les gestes sont ceux de l'histoire.
"""
import math
import sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

OUT = sys.argv[sys.argv.index('--') + 1]
ACTIONS = sys.argv[sys.argv.index('--') + 2:] or ['idle', 'walk', 'kneel_blow', 'sit']
FRAMES = int(__import__("os").environ.get("FRAMES", "12"))
RES = (320, 320)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- matériaux
PALETTE = {
    'coat': (0.55, 0.24, 0.14),      # rouille
    'sleeve': (0.50, 0.22, 0.13),
    'hood': (0.62, 0.44, 0.22),      # ocre
    'scarf': (0.72, 0.52, 0.30),
    'skin': (0.86, 0.64, 0.52),
    'nose': (0.88, 0.52, 0.42),
    'beard': (0.80, 0.79, 0.76),
    'eye': (0.10, 0.08, 0.07),
    'mitt': (0.48, 0.36, 0.24),
    'pants': (0.36, 0.27, 0.20),
    'boot': (0.27, 0.18, 0.12),
    'wood': (0.45, 0.30, 0.18),
    'canvas': (0.90, 0.85, 0.74),
    'patch': (0.70, 0.48, 0.30),
}


def material(name, rgb):
    """Une couleur, avec une variation douce façon lavis (bruit à grande échelle)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emit = nt.nodes.new('ShaderNodeEmission')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 6.0
    noise.inputs['Detail'].default_value = 3.0
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    r, g, b = rgb
    ramp.color_ramp.elements[0].color = (r * 0.88, g * 0.86, b * 0.86, 1)
    ramp.color_ramp.elements[1].color = (min(1, r * 1.08), min(1, g * 1.08), min(1, b * 1.06), 1)
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], emit.inputs['Color'])
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    return m


MATS = {k: material(k, v) for k, v in PALETTE.items()}

# La normale en espace caméra, encodée en couleur : la même convention que les
# cartes de normales de la scène (x à droite, y en haut, z vers l'objectif).
NORMAL_MAT = bpy.data.materials.new('normal_pass')
NORMAL_MAT.use_nodes = True
nt = NORMAL_MAT.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
geo = nt.nodes.new('ShaderNodeNewGeometry')
vt = nt.nodes.new('ShaderNodeVectorTransform')
vt.vector_type = 'NORMAL'
vt.convert_from = 'WORLD'
vt.convert_to = 'CAMERA'
mul = nt.nodes.new('ShaderNodeVectorMath')
mul.operation = 'MULTIPLY_ADD'
mul.inputs[1].default_value = (0.5, 0.5, -0.5)  # la caméra regarde vers -Z
mul.inputs[2].default_value = (0.5, 0.5, 0.5)
emit = nt.nodes.new('ShaderNodeEmission')
out = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(geo.outputs['Normal'], vt.inputs['Vector'])
nt.links.new(vt.outputs['Vector'], mul.inputs[0])
nt.links.new(mul.outputs['Vector'], emit.inputs['Color'])
nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])

# ---------------------------------------------------------------- squelette
bpy.ops.object.armature_add(location=(0, 0, 0))
rig = bpy.context.object
rig.name = 'rig'
arm = rig.data
bpy.ops.object.mode_set(mode='EDIT')
for b in list(arm.edit_bones):
    arm.edit_bones.remove(b)

BONES = {
    # nom: (tête, queue, parent)
    'root': ((0, 0, 0), (0, 0, 0.2), None),
    'hips': ((0, 0, 0.52), (0, 0, 0.68), 'root'),
    'spine': ((0, 0, 0.68), (0, 0, 0.92), 'hips'),
    'chest': ((0, 0, 0.92), (0, 0, 1.08), 'spine'),
    'head': ((0, 0, 1.1), (0, 0, 1.4), 'chest'),
    'arm.L': ((0.2, 0, 1.0), (0.26, 0, 0.78), 'chest'),
    'fore.L': ((0.26, 0, 0.78), (0.28, -0.02, 0.58), 'arm.L'),
    'arm.R': ((-0.2, 0, 1.0), (-0.26, 0, 0.78), 'chest'),
    'fore.R': ((-0.26, 0, 0.78), (-0.28, -0.02, 0.58), 'arm.R'),
    'thigh.L': ((0.1, 0, 0.52), (0.11, 0, 0.3), 'hips'),
    'shin.L': ((0.11, 0, 0.3), (0.11, 0.01, 0.08), 'thigh.L'),
    'thigh.R': ((-0.1, 0, 0.52), (-0.11, 0, 0.3), 'hips'),
    'shin.R': ((-0.11, 0, 0.3), (-0.11, 0.01, 0.08), 'thigh.R'),
}
for name, (h, t, parent) in BONES.items():
    b = arm.edit_bones.new(name)
    b.head, b.tail = h, t
    b.roll = 0
    if parent:
        b.parent = arm.edit_bones[parent]
        b.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')


# ---------------------------------------------------------------- volumes
def attach(obj, bone):
    """Rattache un volume à un os, sans déformation : il suit l'os comme un tout."""
    bpy.context.view_layer.update()
    basis = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    # Un enfant d'os est rattaché au bout de l'os : on annule ce décalage au
    # repos, pour que le volume reste exactement où il a été posé.
    b = rig.data.bones[bone]
    obj.matrix_parent_inverse = (rig.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))).inverted()
    obj.matrix_basis = basis


def smooth(obj, level=2):
    mod = obj.modifiers.new('subsurf', 'SUBSURF')
    mod.levels = mod.render_levels = level
    for p in obj.data.polygons:
        p.use_smooth = True


def blob(name, loc, size, mat, bone, rot=(0, 0, 0), level=2):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    o.rotation_euler = rot
    o.data.materials.append(MATS[mat])
    smooth(o, level)
    attach(o, bone)
    return o


def limb(name, a, b, r, mat, bone, r2=None):
    """Un segment arrondi entre deux points : un cylindre aux bouts sphériques."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    if r2 is not None:
        # le bas plus étroit que le haut : un membre qui s'affine
        bm = bmesh.new()
        bm.from_mesh(o.data)
        for v in bm.verts:
            if v.co.z < 0:
                v.co.x *= r2 / r
                v.co.y *= r2 / r
        bm.to_mesh(o.data)
        bm.free()
    o.data.materials.append(MATS[mat])
    smooth(o, 1)
    attach(o, bone)
    for end, rr in ((a, r), (b, r2 or r)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=rr, location=end)
        s = bpy.context.object
        s.data.materials.append(MATS[mat])
        smooth(s, 1)
        attach(s, bone)
    return o


# Le manteau : une cloche qui s'évase, du torse jusqu'aux genoux.
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.27, radius2=0.17, depth=0.62, location=(0, 0.01, 0.66))
coat = bpy.context.object
coat.data.materials.append(MATS['coat'])
smooth(coat, 2)
attach(coat, 'spine')
blob('torso', (0, 0.01, 0.98), (0.23, 0.19, 0.17), 'coat', 'chest')
blob('patch', (0.12, -0.17, 0.62), (0.06, 0.02, 0.05), 'patch', 'spine', level=1)
blob('patch2', (-0.15, -0.12, 0.82), (0.05, 0.02, 0.04), 'patch', 'spine', level=1)
# L'écharpe, en anneau sous la barbe.
bpy.ops.mesh.primitive_torus_add(major_radius=0.13, minor_radius=0.055, location=(0, -0.01, 1.08))
scarf = bpy.context.object
scarf.scale = (1, 0.9, 0.8)
scarf.data.materials.append(MATS['scarf'])
smooth(scarf, 1)
attach(scarf, 'chest')

# La tête et le visage.
blob('head', (0, -0.02, 1.24), (0.125, 0.12, 0.13), 'skin', 'head')
blob('nose', (0, -0.145, 1.225), (0.038, 0.036, 0.034), 'nose', 'head')
for x in (-0.048, 0.048):
    blob('eye', (x, -0.125, 1.272), (0.016, 0.01, 0.019), 'eye', 'head', level=1)
    blob('brow', (x * 1.05, -0.128, 1.302), (0.03, 0.012, 0.01), 'beard', 'head', level=1)
# La barbe : une goutte qui descend sur l'écharpe.
beard = blob('beard', (0, -0.1, 1.12), (0.12, 0.08, 0.15), 'beard', 'head')
bm = bmesh.new()
bm.from_mesh(beard.data)
for v in bm.verts:
    if v.co.z < 0:
        v.co.x *= 1 + v.co.z * 0.5  # pointe vers le bas
        v.co.y *= 1 + v.co.z * 0.3
bm.to_mesh(beard.data)
bm.free()
blob('moustache', (0, -0.14, 1.19), (0.075, 0.03, 0.028), 'beard', 'head')

# La capuche : une coque ouverte sur le visage.
bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=16, radius=0.17, location=(0, 0.01, 1.28))
hood = bpy.context.object
hood.scale = (1, 1.05, 1.08)
bm = bmesh.new()
bm.from_mesh(hood.data)
cut = [f for f in bm.faces if f.calc_center_median().y < -0.06 and f.calc_center_median().z < 0.06]
bmesh.ops.delete(bm, geom=cut, context='FACES')
bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.02)
bm.to_mesh(hood.data)
bm.free()
hood.data.materials.append(MATS['hood'])
smooth(hood, 2)
attach(hood, 'head')
blob('hood_tip', (0, 0.12, 1.36), (0.06, 0.08, 0.06), 'hood', 'head')

# Les bras, en manches de laine, et les moufles.
for s, side in ((1, 'L'), (-1, 'R')):
    limb(f'arm.{side}', (0.2 * s, 0, 1.0), (0.26 * s, 0, 0.78), 0.062, 'sleeve', f'arm.{side}', 0.055)
    limb(f'fore.{side}', (0.26 * s, 0, 0.78), (0.28 * s, -0.02, 0.6), 0.055, 'sleeve', f'fore.{side}', 0.05)
    blob(f'mitt.{side}', (0.28 * s, -0.025, 0.55), (0.055, 0.05, 0.065), 'mitt', f'fore.{side}')
    limb(f'thigh.{side}', (0.1 * s, 0, 0.5), (0.11 * s, 0, 0.3), 0.075, 'pants', f'thigh.{side}', 0.065)
    limb(f'shin.{side}', (0.11 * s, 0, 0.3), (0.11 * s, 0.01, 0.1), 0.062, 'pants', f'shin.{side}', 0.058)
    blob(f'boot.{side}', (0.11 * s, -0.035, 0.05), (0.075, 0.115, 0.055), 'boot', f'shin.{side}')

# Le sac : un cadre de bois et la toile roulée dessus.
for x in (-0.13, 0.13):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0.22, 0.9))
    post = bpy.context.object
    post.scale = (0.025, 0.025, 0.5)
    post.data.materials.append(MATS['wood'])
    attach(post, 'chest')
for z in (0.72, 1.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.22, z))
    bar = bpy.context.object
    bar.scale = (0.3, 0.022, 0.022)
    bar.data.materials.append(MATS['wood'])
    attach(bar, 'chest')
bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.08, depth=0.42, location=(0, 0.24, 1.18), rotation=(0, math.pi / 2, 0))
roll = bpy.context.object
roll.data.materials.append(MATS['canvas'])
smooth(roll, 1)
attach(roll, 'chest')

# Le bâton, dans la main droite.
bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.018, depth=1.25, location=(-0.29, -0.06, 0.6))
stick = bpy.context.object
stick.data.materials.append(MATS['wood'])
attach(stick, 'fore.R')
stick.name = 'stick'

# ---------------------------------------------------------------- caméra, rendu
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 1.75
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
# À hauteur d'homme, de trois quarts : le même angle que la caméra de la scène.
import os
if os.environ.get('SIDE'):
    cam.location = (4.5, 0, 0.7)
    cam.rotation_euler = Euler((math.radians(90), 0, math.radians(90)))
else:
    cam.location = (2.2, -4.2, 0.85)
    cam.rotation_euler = Euler((math.radians(88), 0, math.radians(27.5)))
scene.camera = cam

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 12
scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = RES
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.render.use_freestyle = True
scene.render.line_thickness_mode = 'ABSOLUTE'
scene.render.line_thickness = 1.3
ls = scene.view_layers[0].freestyle_settings.linesets[0] if scene.view_layers[0].freestyle_settings.linesets else scene.view_layers[0].freestyle_settings.linesets.new('ink')
if ls.linestyle is None:
    ls.linestyle = bpy.data.linestyles.new('ink')
ls.linestyle.color = (0.16, 0.11, 0.09)
ls.select_by_visibility = True
ls.select_silhouette = True
ls.select_border = True
ls.select_crease = False


# ---------------------------------------------------------------- gestes
def pose(rot, root=(0, 0, 0), root_rot=(0, 0, 0)):
    """Applique des angles (en degrés) aux os ; tout le reste revient au repos."""
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = Euler([math.radians(a) for a in rot.get(pb.name, (0, 0, 0))])
        pb.location = (0, 0, 0)
    rig.location = root
    rig.rotation_euler = Euler([math.radians(a) for a in root_rot])


def act(name, t):
    """Un geste au temps t (0 → 1, en boucle). L'axe X d'un os penche vers l'avant."""
    w = math.sin(t * 2 * math.pi)
    w2 = math.sin(t * 4 * math.pi)
    if name == 'idle':
        # Il respire, la tête suit, le bâton à la main.
        return pose({'chest': (2 * w, 0, 0), 'head': (-3 * w, 3 * math.sin(t * 2 * math.pi + 1), 0),
                     'arm.R': (-12, 0, -6), 'fore.R': (-30, 0, 0), 'arm.L': (4 * w, 0, 4)})
    if name == 'walk':
        # Il marche, petit pas lourd de vieil homme, un peu voûté.
        return pose({'hips': (0, 0, 6 * w), 'spine': (8, 0, -3 * w), 'head': (-6, 0, 3 * w),
                     'thigh.L': (-24 * w, 0, 0), 'shin.L': (max(0, 30 * w2) + 10, 0, 0),
                     'thigh.R': (24 * w, 0, 0), 'shin.R': (max(0, -30 * w2) + 10, 0, 0),
                     'arm.L': (20 * w, 0, 4), 'arm.R': (-20 - 14 * w, 0, -6), 'fore.R': (-30, 0, 0)},
                    root=(0, 0, 0.015 * abs(w2)))
    if name == 'kneel_blow':
        # Un genou au sol, penché vers le feu, il souffle doucement.
        return pose({'spine': (24 + 3 * w, 0, 0), 'chest': (8 + 2 * w, 0, 0), 'head': (10 - 4 * w, 0, 0),
                     'thigh.L': (-80, 0, 0), 'shin.L': (80, 0, 0),
                     'thigh.R': (10, 0, 0), 'shin.R': (100, 0, 0),
                     'arm.L': (-50, 0, 10), 'fore.L': (-40, 0, 0),
                     'arm.R': (-45, 0, -10), 'fore.R': (-50, 0, 0)},
                    root=(0, 0, -0.24))
    if name == 'sit':
        # Assis au sol, jambes devant, les mains sur les genoux. Il se repose.
        return pose({'spine': (12 + 2 * w, 0, 0), 'head': (4 - 2 * w, 0, 0),
                     'thigh.L': (-88, 0, 8), 'shin.L': (55, 0, 0),
                     'thigh.R': (-88, 0, -8), 'shin.R': (55, 0, 0),
                     'arm.L': (-40, 0, 6), 'fore.L': (-30, 0, 0),
                     'arm.R': (-40, 0, -6), 'fore.R': (-30, 0, 0)},
                    root=(0, 0, -0.4))
    if name == 'hammer':
        # Un genou au sol, il plante un piquet : le bras monte et retombe.
        k = 0.5 + 0.5 * math.cos(t * 2 * math.pi)
        return pose({'spine': (20, 0, 0), 'head': (12, 0, 0),
                     'thigh.L': (-80, 0, 0), 'shin.L': (80, 0, 0), 'thigh.R': (10, 0, 0), 'shin.R': (100, 0, 0),
                     'arm.R': (-60 - 70 * k, 0, -8), 'fore.R': (-30 * k, 0, 0),
                     'arm.L': (-40, 0, 10), 'fore.L': (-40, 0, 0)},
                    root=(0, 0, -0.24))
    raise ValueError(name)


# ---------------------------------------------------------------- deux passes par image
meshes = [o for o in scene.objects if o.type == 'MESH']
original = {o.name: list(o.data.materials) for o in meshes}


def set_pass(kind):
    for o in meshes:
        mats = original[o.name] if kind == 'albedo' else [NORMAL_MAT] * len(original[o.name])
        for i, m in enumerate(mats):
            o.data.materials[i] = m
    scene.render.use_freestyle = kind == 'albedo'
    # Une normale est une donnée : aucune courbe de couleur ne doit la toucher.
    scene.view_settings.view_transform = 'Standard' if kind == 'albedo' else 'Raw'


for name in ACTIONS:
    stick.hide_render = name in ('kneel_blow', 'sit', 'hammer')
    for f in range(FRAMES):
        act(name, f / FRAMES)
        bpy.context.view_layer.update()
        for kind in ('albedo', 'normal'):
            set_pass(kind)
            scene.render.filepath = f"{OUT}/{name}_{kind}_{f:02d}.png"
            bpy.ops.render.render(write_still=True)
    print('rendu', name)
