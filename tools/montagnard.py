"""Le montagnard : modèle, squelette, gestes, rendu en sprites peints.

Lancement : FRAMES=12 python montagnard.py -- <sortie> [action ...]
Variables : SIDE=1 (vue de profil, pour régler les poses), PREVIEW=1 (une
seule image éclairée, en grand, pour juger le modèle), RES=<px>.

Le personnage : un petit homme trapu des montagnes, vieux, doux. Une grande
silhouette lisible d'abord — la cloche du manteau, la capuche à pointe, la
barbe qui coule — et les détails ensuite.

Les volumes principaux sont tournés à partir de profils (comme on monte une
poterie) : on dessine la silhouette en (hauteur, rayon) et on la module selon
l'angle, ce qui donne l'ourlet ondulé, le pli du devant, la pointe de la
capuche. Rien n'est parfaitement lisse : un léger déplacement casse la
géométrie, comme une main.

Deux rendus par image, comme pour un jeu :
  albedo : la couleur peinte, sans lumière — lavis, creux assombris, trait
           d'encre tremblé ;
  normal : la normale en espace caméra, avec le grain de la laine, pour que la
           scène WebGL l'éclaire avec sa propre lumière (le feu, la lune).
Aucun personnage ne mime un exercice : les gestes sont ceux de l'histoire.
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

OUT = sys.argv[sys.argv.index('--') + 1]
ACTIONS = sys.argv[sys.argv.index('--') + 2:] or ['idle']
FRAMES = int(os.environ.get('FRAMES', '12'))
RES = int(os.environ.get('RES', '320'))
PREVIEW = bool(os.environ.get('PREVIEW'))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ------------------------------------------------------------------ matériaux
PALETTE = {
    'coat': (0.56, 0.25, 0.15),     # rouille
    'coat_dark': (0.42, 0.18, 0.12),
    'sleeve': (0.52, 0.23, 0.14),
    'hood': (0.64, 0.46, 0.24),     # ocre
    'hood_rim': (0.52, 0.36, 0.19),
    'scarf': (0.74, 0.55, 0.32),
    'skin': (0.88, 0.67, 0.55),
    'cheek': (0.90, 0.56, 0.46),
    'beard': (0.84, 0.83, 0.80),
    'beard_shadow': (0.70, 0.69, 0.68),
    'eye': (0.09, 0.07, 0.06),
    'glint': (0.98, 0.96, 0.92),
    'mitt': (0.50, 0.38, 0.25),
    'pants': (0.37, 0.28, 0.21),
    'boot': (0.28, 0.19, 0.13),
    'cord': (0.78, 0.66, 0.45),
    'wood': (0.47, 0.31, 0.19),
    'canvas': (0.91, 0.86, 0.75),
    'patch': (0.72, 0.50, 0.31),
    'pot': (0.36, 0.38, 0.40),
}


def material(name, rgb, wool=True):
    """Une couleur posée au lavis : deux bruits pour les variations, des
    touches de pinceau (Voronoï), et les creux assombris (occlusion)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emit = nt.nodes.new('ShaderNodeEmission')
    big = nt.nodes.new('ShaderNodeTexNoise')
    big.inputs['Scale'].default_value = 3.5
    big.inputs['Detail'].default_value = 2.0
    small = nt.nodes.new('ShaderNodeTexNoise')
    small.inputs['Scale'].default_value = 22.0
    small.inputs['Detail'].default_value = 4.0
    strokes = nt.nodes.new('ShaderNodeTexVoronoi')
    strokes.inputs['Scale'].default_value = 14.0
    mix1 = nt.nodes.new('ShaderNodeMath')
    mix1.operation = 'MULTIPLY_ADD'
    mix1.inputs[1].default_value = 0.6
    nt.links.new(big.outputs['Fac'], mix1.inputs[0])
    nt.links.new(small.outputs['Fac'], mix1.inputs[2])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    r, g, b = rgb
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (r * 0.84, g * 0.82, b * 0.84, 1)
    ramp.color_ramp.elements[1].position = 1.05
    ramp.color_ramp.elements[1].color = (min(1, r * 1.12), min(1, g * 1.1), min(1, b * 1.06), 1)
    nt.links.new(mix1.outputs['Value'], ramp.inputs['Fac'])
    # Les touches de pinceau : à peine plus claires, par endroits.
    stroke_mix = nt.nodes.new('ShaderNodeMix')
    stroke_mix.data_type = 'RGBA'
    stroke_mix.blend_type = 'SCREEN'
    stroke_mix.inputs['Factor'].default_value = 0.08 if wool else 0.03
    nt.links.new(ramp.outputs['Color'], stroke_mix.inputs['A'])
    nt.links.new(strokes.outputs['Distance'], stroke_mix.inputs['B'])
    # Les creux : l'occlusion assombrit ce qui est enfoui, comme un peintre
    # qui pose ses ombres de contact avant toute lumière.
    ao = nt.nodes.new('ShaderNodeAmbientOcclusion')
    ao.inputs['Distance'].default_value = 0.08
    ao.samples = 8
    ao_ramp = nt.nodes.new('ShaderNodeMapRange')
    ao_ramp.inputs['To Min'].default_value = 0.72
    nt.links.new(ao.outputs['AO'], ao_ramp.inputs['Value'])
    shade = nt.nodes.new('ShaderNodeMix')
    shade.data_type = 'RGBA'
    shade.blend_type = 'MULTIPLY'
    shade.inputs['Factor'].default_value = 1.0
    nt.links.new(stroke_mix.outputs['Result'], shade.inputs['A'])
    nt.links.new(ao_ramp.outputs['Result'], shade.inputs['B'])
    nt.links.new(shade.outputs['Result'], emit.inputs['Color'])
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    return m


MATS = {k: material(k, v, wool=k not in ('eye', 'glint', 'pot', 'skin', 'cheek')) for k, v in PALETTE.items()}

# La normale en espace caméra, avec le grain de la laine en relief.
NORMAL_MAT = bpy.data.materials.new('normal_pass')
NORMAL_MAT.use_nodes = True
nt = NORMAL_MAT.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
geo = nt.nodes.new('ShaderNodeNewGeometry')
grain = nt.nodes.new('ShaderNodeTexNoise')
grain.inputs['Scale'].default_value = 70.0
grain.inputs['Detail'].default_value = 3.0
bump = nt.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = 0.12
nt.links.new(grain.outputs['Fac'], bump.inputs['Height'])
nt.links.new(geo.outputs['Normal'], bump.inputs['Normal'])
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
nt.links.new(bump.outputs['Normal'], vt.inputs['Vector'])
nt.links.new(vt.outputs['Vector'], mul.inputs[0])
nt.links.new(mul.outputs['Vector'], emit.inputs['Color'])
nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])

# ------------------------------------------------------------------ squelette
bpy.ops.object.armature_add(location=(0, 0, 0))
rig = bpy.context.object
rig.name = 'rig'
arm = rig.data
bpy.ops.object.mode_set(mode='EDIT')
for b in list(arm.edit_bones):
    arm.edit_bones.remove(b)
BONES = {
    'root': ((0, 0, 0), (0, 0, 0.2), None),
    'hips': ((0, 0, 0.5), (0, 0, 0.66), 'root'),
    'spine': ((0, 0, 0.66), (0, 0, 0.9), 'hips'),
    'chest': ((0, 0, 0.9), (0, 0, 1.06), 'spine'),
    'head': ((0, 0, 1.08), (0, 0, 1.42), 'chest'),
    'arm.L': ((0.21, 0, 0.98), (0.27, 0, 0.77), 'chest'),
    'fore.L': ((0.27, 0, 0.77), (0.29, -0.03, 0.58), 'arm.L'),
    'arm.R': ((-0.21, 0, 0.98), (-0.27, 0, 0.77), 'chest'),
    'fore.R': ((-0.27, 0, 0.77), (-0.29, -0.03, 0.58), 'arm.R'),
    'thigh.L': ((0.1, 0, 0.5), (0.11, 0, 0.29), 'hips'),
    'shin.L': ((0.11, 0, 0.29), (0.11, 0.01, 0.08), 'thigh.L'),
    'thigh.R': ((-0.1, 0, 0.5), (-0.11, 0, 0.29), 'hips'),
    'shin.R': ((-0.11, 0, 0.29), (-0.11, 0.01, 0.08), 'thigh.R'),
}
for name, (h, t, parent) in BONES.items():
    b = arm.edit_bones.new(name)
    b.head, b.tail = h, t
    b.roll = 0
    if parent:
        b.parent = arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')


def attach(obj, bone):
    """Rattache un volume à un os, sans déformation : il suit l'os comme un tout."""
    bpy.context.view_layer.update()
    basis = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    b = rig.data.bones[bone]
    obj.matrix_parent_inverse = (rig.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))).inverted()
    obj.matrix_basis = basis


_tex = bpy.data.textures.new('hand', 'CLOUDS')
_tex.noise_scale = 0.12


def finish(obj, mat, bone, level=2, wobble=0.006):
    """Lissage, et un très léger déplacement : rien n'est fait au tour parfait."""
    if wobble:
        d = obj.modifiers.new('hand', 'DISPLACE')
        d.texture = _tex
        d.strength = wobble
        d.mid_level = 0.5
    s = obj.modifiers.new('subsurf', 'SUBSURF')
    s.levels = s.render_levels = level
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.materials.append(MATS[mat])
    attach(obj, bone)
    return obj


def mesh_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    return o


def lathe(name, profile, center=(0, 0, 0), seg=36, mod=None, cap_top=True, cap_bottom=True):
    """Un volume tourné : `profile` = [(z, rayon)], `mod(theta, z, r) -> r` le module."""
    bm = bmesh.new()
    rings = []
    for z, r in profile:
        ring = []
        for i in range(seg):
            th = 2 * math.pi * i / seg
            rr = mod(th, z, r) if mod else r
            ring.append(bm.verts.new((center[0] + rr * math.sin(th), center[1] - rr * math.cos(th), center[2] + z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
    if cap_bottom:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return mesh_obj(name, bm)


def sphere(name, loc, size, rot=(0, 0, 0), seg=24, rings=14, shape=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        if shape:
            x, y, z = shape(x, y, z)
        v.co = Vector((x * size[0], y * size[1], z * size[2]))
    o = mesh_obj(name, bm)
    o.location = loc
    o.rotation_euler = rot
    return o


def tube(name, a, b, r1, r2, seg=16):
    """Un membre : un tube qui s'affine, aux bouts arrondis."""
    a, b = Vector(a), Vector(b)
    d = b - a
    n = 8
    prof = []
    for k in range(n + 1):
        t = k / n
        # bouts arrondis : le rayon s'écrase aux extrémités
        cap = math.sin(math.pi * min(1, t * 4, (1 - t) * 4) / 2) ** 0.5
        prof.append((t * d.length, (r1 + (r2 - r1) * t) * max(0.35, cap)))
    o = lathe(name, prof, seg=seg)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    o.location = a
    return o


def torus(name, loc, R, r, scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=32, minor_segments=10, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    return o


FRONT = math.pi  # dans `lathe`, theta = 0 regarde vers +Y (le dos) ; pi, vers l'objectif


def near(th, at, width):
    d = (th - at + math.pi) % (2 * math.pi) - math.pi
    return math.exp(-(d * d) / (width * width))


# ------------------------------------------------------------------ le corps
# Le manteau : une cloche lourde qui s'évase, l'ourlet ondule, un pli marque
# le devant où les deux pans se croisent.
coat = lathe('coat', [(0.26, 0.29), (0.32, 0.305), (0.42, 0.29), (0.56, 0.262), (0.72, 0.24), (0.86, 0.235), (0.97, 0.215), (1.04, 0.17), (1.08, 0.1)],
             mod=lambda th, z, r: r * (1 + (0.055 * math.sin(7 * th + 0.6) if z < 0.36 else 0) - 0.05 * near(th, FRONT + 0.18, 0.09)),
             cap_bottom=False)
finish(coat, 'coat', 'spine', wobble=0.008)
# Le revers du pan avant, plus sombre, et les pièces cousues.
for i, (loc, sz) in enumerate([((0.16, -0.2, 0.46), (0.085, 0.018, 0.07)), ((-0.18, -0.15, 0.84), (0.06, 0.018, 0.055))]):
    finish(sphere(f'patch{i}', loc, sz), 'patch', 'spine', level=1, wobble=0)
# La ceinture : une corde nouée.
finish(torus('belt', (0, 0, 0.64), 0.252, 0.016, scale=(1, 1, 1)), 'cord', 'spine', level=1, wobble=0)
for i in range(2):
    finish(sphere(f'knot{i}', (0.06 + i * 0.03, -0.25, 0.62 - i * 0.05), (0.022, 0.018, 0.03 + i * 0.02)), 'cord', 'spine', level=1, wobble=0)
# Les épaules, rondes, voûtées.
finish(sphere('shoulders', (0, 0.02, 0.97), (0.25, 0.2, 0.15)), 'coat', 'chest')
# L'écharpe, épaisse, qui déborde.
finish(torus('scarf', (0, -0.01, 1.07), 0.13, 0.065, scale=(1.05, 0.95, 0.75)), 'scarf', 'chest', wobble=0.008)
finish(sphere('scarf_tail', (0.1, -0.15, 0.95), (0.04, 0.025, 0.12), rot=(0.2, 0, 0.25)), 'scarf', 'chest')

# ------------------------------------------------------------------ la tête
HC = Vector((0, -0.02, 1.27))
finish(sphere('head', HC, (0.15, 0.145, 0.155)), 'skin', 'head', wobble=0.003)
# Le nez : rond, rouge de froid. Les joues aussi.
finish(sphere('nose', HC + Vector((0, -0.15, -0.02)), (0.048, 0.046, 0.044)), 'cheek', 'head', wobble=0)
for s in (-1, 1):
    finish(sphere(f'cheek{s}', HC + Vector((0.08 * s, -0.11, -0.01)), (0.04, 0.02, 0.032)), 'cheek', 'head', wobble=0)
    # Les yeux : petits, vifs, un reflet. Les sourcils, broussailleux, les
    # couvrent à moitié : le visage reste un peu caché, comme demandé.
    finish(sphere(f'eye{s}', HC + Vector((0.055 * s, -0.137, 0.03)), (0.018, 0.01, 0.023)), 'eye', 'head', level=1, wobble=0)
    finish(sphere(f'glint{s}', HC + Vector((0.05 * s + 0.007, -0.147, 0.04)), (0.006, 0.004, 0.006)), 'glint', 'head', level=1, wobble=0)
    finish(sphere(f'brow{s}', HC + Vector((0.06 * s, -0.138, 0.064)), (0.046, 0.024, 0.018), rot=(0, 0.18 * s, -0.12 * s)), 'beard', 'head', wobble=0.004)


# La barbe : une grande masse qui part des joues et coule sur l'écharpe, avec
# des mèches. Une moustache par-dessus, qui cache la bouche.
def beard_shape(x, y, z):
    t = max(0.0, -z)              # 0 en haut, 1 en bas
    x *= 1 - 0.45 * t             # elle s'affine vers la pointe
    y = y * (1 - 0.2 * t) - 0.18 * t * t
    x += 0.04 * math.sin(z * 9 + y * 4) * t   # des mèches
    return x, y, z


finish(sphere('beard', HC + Vector((0, -0.09, -0.15)), (0.155, 0.1, 0.22), shape=beard_shape), 'beard', 'head', wobble=0.01)
finish(sphere('beard_under', HC + Vector((0, -0.05, -0.14)), (0.14, 0.08, 0.17)), 'beard_shadow', 'head')
for s in (-1, 1):
    finish(sphere(f'mous{s}', HC + Vector((0.052 * s, -0.155, -0.055)), (0.066, 0.034, 0.03), rot=(0, 0.35 * s, 0)), 'beard', 'head', wobble=0.004)


# La capuche : une coque ouverte sur le visage, dont la pointe retombe en
# arrière. Son bord, roulé, plus sombre, encadre le visage.
def hood_shape(x, y, z):
    if z > 0:
        y += 0.55 * z * z     # la pointe part en arrière, sans se dresser
        z += 0.08 * z * z
    return x, y, z


hood = sphere('hood', HC + Vector((0, 0.02, 0.03)), (0.2, 0.2, 0.205), seg=32, rings=18, shape=hood_shape)
bm = bmesh.new()
bm.from_mesh(hood.data)
# (les coordonnées sont déjà à l'échelle : 0,175 de rayon)
cut = [f for f in bm.faces if f.calc_center_median().y < -0.07 and f.calc_center_median().z < 0.11]
bmesh.ops.delete(bm, geom=cut, context='FACES')
bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.022)
bm.to_mesh(hood.data)
bm.free()
finish(hood, 'hood', 'head', wobble=0.008)
finish(torus('hood_rim', HC + Vector((0, -0.14, 0.01)), 0.145, 0.034, scale=(1.0, 0.55, 1.2), rot=(math.radians(84), 0, 0)), 'hood_rim', 'head', wobble=0.005)

# ------------------------------------------------------------------ bras, jambes
for s, side in ((1, 'L'), (-1, 'R')):
    finish(tube(f'arm.{side}', (0.21 * s, 0, 0.99), (0.27 * s, 0, 0.77), 0.075, 0.066), 'sleeve', f'arm.{side}')
    finish(tube(f'fore.{side}', (0.27 * s, 0, 0.78), (0.29 * s, -0.03, 0.6), 0.068, 0.064), 'sleeve', f'fore.{side}')
    finish(torus(f'cuff.{side}', (0.29 * s, -0.03, 0.61), 0.062, 0.02, rot=(0.1, 0.05 * s, 0)), 'sleeve', f'fore.{side}', wobble=0)
    finish(sphere(f'mitt.{side}', (0.295 * s, -0.035, 0.54), (0.062, 0.055, 0.075)), 'mitt', f'fore.{side}')
    finish(sphere(f'thumb.{side}', (0.27 * s, -0.08, 0.565), (0.025, 0.025, 0.035), rot=(0.4, 0, 0)), 'mitt', f'fore.{side}')
    finish(tube(f'thigh.{side}', (0.1 * s, 0, 0.5), (0.11 * s, 0, 0.29), 0.085, 0.07), 'pants', f'thigh.{side}')
    finish(tube(f'shin.{side}', (0.11 * s, 0, 0.3), (0.11 * s, 0.01, 0.12), 0.068, 0.062), 'pants', f'shin.{side}')
    # Les bottes, larges et usées, et les cordes qui les tiennent.
    finish(sphere(f'boot.{side}', (0.11 * s, -0.04, 0.055), (0.08, 0.125, 0.06), shape=lambda x, y, z: (x, y, max(z, -0.7))), 'boot', f'shin.{side}')
    for k in range(2):
        finish(torus(f'bootcord.{side}{k}', (0.11 * s, 0.0, 0.1 + 0.035 * k), 0.066, 0.008), 'cord', f'shin.{side}', level=1, wobble=0)

# ------------------------------------------------------------------ le sac
for x in (-0.13, 0.13):
    finish(tube(f'post{x}', (x, 0.23, 0.6), (x, 0.24, 1.22), 0.022, 0.02, seg=10), 'wood', 'chest', level=1, wobble=0.003)
for z in (0.74, 1.0):
    finish(tube(f'bar{z}', (-0.15, 0.24, z), (0.15, 0.24, z), 0.018, 0.018, seg=10), 'wood', 'chest', level=1, wobble=0.003)
roll = tube('roll', (-0.22, 0.26, 1.2), (0.22, 0.26, 1.2), 0.085, 0.085, seg=24)
finish(roll, 'canvas', 'chest', wobble=0.006)
for x in (-0.1, 0.1):
    finish(torus(f'strap{x}', (x, 0.26, 1.2), 0.088, 0.01, rot=(0, math.pi / 2, 0)), 'cord', 'chest', level=1, wobble=0)
pot = lathe('pot', [(0, 0.0), (0.0, 0.05), (0.06, 0.055), (0.07, 0.05)], center=(0.2, 0.2, 0.68), seg=20, cap_top=False)
finish(pot, 'pot', 'chest', level=1, wobble=0)

# Le bâton, noueux, dans la main droite.
# Il est planté au sol, pas soudé à la main : la main se pose dessus.
stick = tube('stick', (-0.34, -0.1, 0.0), (-0.33, -0.1, 1.18), 0.02, 0.017, seg=10)
finish(stick, 'wood', 'root', level=1, wobble=0.004)
knob = sphere('knob', (-0.33, -0.1, 1.19), (0.032, 0.03, 0.04))
finish(knob, 'wood', 'root', level=1)

# ------------------------------------------------------------------ caméra, rendu
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 1.8
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
if os.environ.get('SIDE'):
    cam.location = (4.5, 0, 0.72)
    cam.rotation_euler = Euler((math.radians(90), 0, math.radians(90)))
else:
    # À hauteur d'homme, tourné vers la droite de l'écran : il regarde le feu.
    yaw = math.radians(42)
    cam.location = (4.6 * math.sin(yaw), -4.6 * math.cos(yaw), 1.45)
    cam.rotation_euler = Euler((math.radians(82.5), 0, yaw))
scene.camera = cam

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = RES
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'

# Le trait : fin, chaud, et qui tremble un peu, comme tiré à la main.
scene.render.use_freestyle = True
scene.render.line_thickness_mode = 'ABSOLUTE'
scene.render.line_thickness = 1.0 * RES / 320
fs = scene.view_layers[0].freestyle_settings
ls = fs.linesets[0] if fs.linesets else fs.linesets.new('ink')
if ls.linestyle is None:
    ls.linestyle = bpy.data.linestyles.new('ink')
st = ls.linestyle
st.color = (0.2, 0.12, 0.09)
st.alpha = 0.85
st.thickness = 1.2
ls.select_by_visibility = True
ls.select_silhouette = True
ls.select_border = True
ls.select_crease = True
fs.crease_angle = math.radians(120)
wob = st.thickness_modifiers.new('tremble', 'NOISE')
wob.amplitude = 0.8
wob.period = 12
geo_mod = st.geometry_modifiers.new('main', 'PERLIN_NOISE_1D')
geo_mod.amplitude = 0.6
geo_mod.frequency = 6

# ------------------------------------------------------------------ gestes
def pose(rot, root=(0, 0, 0)):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = Euler([math.radians(a) for a in rot.get(pb.name, (0, 0, 0))])
    rig.location = root


def act(name, t):
    """Un geste au temps t (0 → 1, en boucle). +X penche un os vers l'avant
    pour le buste, vers l'arrière pour les jambes et les bras."""
    w = math.sin(t * 2 * math.pi)
    w2 = math.sin(t * 4 * math.pi)
    if name == 'idle':
        return pose({'chest': (2 * w, 0, 0), 'head': (-3 * w, 4 * math.sin(t * 2 * math.pi + 1), 0),
                     'arm.R': (-8, 0, -10), 'fore.R': (-18, 0, 0), 'arm.L': (4 * w, 0, 4)})
    if name == 'walk':
        return pose({'hips': (0, 0, 6 * w), 'spine': (8, 0, -3 * w), 'head': (-6, 0, 3 * w),
                     'thigh.L': (-24 * w, 0, 0), 'shin.L': (max(0, 30 * w2) + 10, 0, 0),
                     'thigh.R': (24 * w, 0, 0), 'shin.R': (max(0, -30 * w2) + 10, 0, 0),
                     'arm.L': (20 * w, 0, 4), 'arm.R': (-20 - 14 * w, 0, -6), 'fore.R': (-30, 0, 0)},
                    root=(0, 0, 0.015 * abs(w2)))
    if name == 'kneel_blow':
        return pose({'spine': (24 + 3 * w, 0, 0), 'chest': (8 + 2 * w, 0, 0), 'head': (10 - 4 * w, 0, 0),
                     'thigh.L': (-80, 0, 0), 'shin.L': (80, 0, 0), 'thigh.R': (10, 0, 0), 'shin.R': (100, 0, 0),
                     'arm.L': (-50, 0, 10), 'fore.L': (-40, 0, 0), 'arm.R': (-45, 0, -10), 'fore.R': (-50, 0, 0)},
                    root=(0, 0, -0.24))
    if name == 'sit':
        return pose({'spine': (12 + 2 * w, 0, 0), 'head': (4 - 2 * w, 0, 0),
                     'thigh.L': (-88, 0, 8), 'shin.L': (55, 0, 0), 'thigh.R': (-88, 0, -8), 'shin.R': (55, 0, 0),
                     'arm.L': (-40, 0, 6), 'fore.L': (-30, 0, 0), 'arm.R': (-40, 0, -6), 'fore.R': (-30, 0, 0)},
                    root=(0, 0, -0.4))
    if name == 'hammer':
        k = 0.5 + 0.5 * math.cos(t * 2 * math.pi)
        return pose({'spine': (20, 0, 0), 'head': (12, 0, 0),
                     'thigh.L': (-80, 0, 0), 'shin.L': (80, 0, 0), 'thigh.R': (10, 0, 0), 'shin.R': (100, 0, 0),
                     'arm.R': (-60 - 70 * k, 0, -8), 'fore.R': (-30 * k, 0, 0), 'arm.L': (-40, 0, 10), 'fore.L': (-40, 0, 0)},
                    root=(0, 0, -0.24))
    raise ValueError(name)


meshes = [o for o in scene.objects if o.type == 'MESH']
original = {o.name: list(o.data.materials) for o in meshes}


def set_pass(kind):
    for o in meshes:
        for i in range(len(o.data.materials)):
            o.data.materials[i] = original[o.name][i] if kind == 'albedo' else NORMAL_MAT
    scene.render.use_freestyle = kind == 'albedo'
    scene.view_settings.view_transform = 'Standard' if kind == 'albedo' else 'Raw'


if PREVIEW:
    act(ACTIONS[0], 0.1)
    set_pass('albedo')
    scene.render.filepath = f"{OUT}/preview_{ACTIONS[0]}.png"
    bpy.ops.render.render(write_still=True)
    sys.exit(0)

for name in ACTIONS:
    hide = name in ('kneel_blow', 'sit', 'hammer')
    stick.hide_render = knob.hide_render = hide
    for f in range(FRAMES):
        act(name, f / FRAMES)
        bpy.context.view_layer.update()
        for kind in ('albedo', 'normal'):
            set_pass(kind)
            scene.render.filepath = f"{OUT}/{name}_{kind}_{f:02d}.png"
            bpy.ops.render.render(write_still=True)
    print('rendu', name)
