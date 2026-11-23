"""Firmin : modèle, squelette, gestes, rendu en sprites peints.

Lancement : FRAMES=12 python montagnard2.py -- <sortie> [action ...]
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
    # La charte : bruyère et ambre, le personnage en rouille et feutre.
    'coat': (0.36, 0.27, 0.30),      # feutre bruyère
    'coat_dark': (0.28, 0.2, 0.23),
    'sleeve': (0.33, 0.25, 0.28),
    'hood': (0.60, 0.27, 0.16),      # rouille
    'hood_rim': (0.48, 0.21, 0.13),
    'scarf': (0.83, 0.75, 0.61),     # avoine
    'skin': (0.87, 0.67, 0.56),
    'cheek': (0.89, 0.56, 0.46),
    'beard': (0.79, 0.78, 0.77),
    'eye': (0.09, 0.07, 0.06),
    'glint': (0.98, 0.96, 0.92),
    'leather': (0.46, 0.30, 0.19),
    'mitt': (0.44, 0.31, 0.21),
    'pants': (0.28, 0.25, 0.28),
    'boot': (0.30, 0.20, 0.14),
    'cord': (0.78, 0.66, 0.45),
    'wood': (0.47, 0.31, 0.19),
    'flute': (0.74, 0.57, 0.36),
    'canvas': (0.90, 0.85, 0.75),
    'copper': (0.80, 0.46, 0.26),
    'log': (0.42, 0.29, 0.20),
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


MATS = {k: material(k, v, wool=k not in ('eye', 'glint', 'copper', 'skin', 'cheek', 'flute')) for k, v in PALETTE.items()}

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
    'hips': ((0, 0, 0.56), (0, 0, 0.72), 'root'),
    'spine': ((0, 0, 0.72), (0, 0, 0.96), 'hips'),
    'chest': ((0, 0, 0.96), (0, 0, 1.12), 'spine'),
    'head': ((0, 0, 1.14), (0, 0, 1.46), 'chest'),
    'arm.L': ((0.22, 0, 1.05), (0.28, 0, 0.84), 'chest'),
    'fore.L': ((0.28, 0, 0.84), (0.30, -0.03, 0.64), 'arm.L'),
    'arm.R': ((-0.22, 0, 1.05), (-0.28, 0, 0.84), 'chest'),
    'fore.R': ((-0.28, 0, 0.84), (-0.30, -0.03, 0.64), 'arm.R'),
    'thigh.L': ((0.1, 0, 0.56), (0.11, 0, 0.32), 'hips'),
    'shin.L': ((0.11, 0, 0.32), (0.11, 0.01, 0.08), 'thigh.L'),
    'thigh.R': ((-0.1, 0, 0.56), (-0.11, 0, 0.32), 'hips'),
    'shin.R': ((-0.11, 0, 0.32), (-0.11, 0.01, 0.08), 'thigh.R'),
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
# Le long manteau de feutre : une cloche lourde, l'ourlet ondule, un pli
# marque le devant où les pans se croisent.
coat = lathe('coat', [(0.2, 0.29), (0.26, 0.302), (0.38, 0.29), (0.54, 0.265), (0.72, 0.245), (0.88, 0.238), (0.99, 0.222), (1.07, 0.18), (1.12, 0.1)],
             mod=lambda th, z, r: r * (1 + (0.05 * math.sin(7 * th + 0.6) if z < 0.32 else 0) - 0.045 * near(th, FRONT + 0.18, 0.09)),
             cap_bottom=False)
finish(coat, 'coat', 'spine', wobble=0.008)
# Le cuir : la ceinture, une sangle en travers, deux sacoches.
finish(torus('belt', (0, 0, 0.72), 0.25, 0.02, scale=(1, 1, 0.8)), 'leather', 'spine', level=1, wobble=0)
finish(sphere('buckle', (0.0, -0.255, 0.72), (0.035, 0.012, 0.028)), 'copper', 'spine', level=1, wobble=0)
finish(tube('strap', (0.2, -0.17, 1.02), (-0.2, -0.2, 0.74), 0.016, 0.016, seg=8), 'leather', 'spine', level=1, wobble=0)
for s in (-1, 1):
    finish(sphere(f'pouch{s}', (0.2 * s, -0.17, 0.63), (0.07, 0.045, 0.06), shape=lambda x, y, z: (x, y, max(z, -0.8))), 'leather', 'spine', level=1)
# Les épaules, rondes, un peu voûtées.
finish(sphere('shoulders', (0, 0.02, 1.03), (0.25, 0.2, 0.15)), 'coat', 'chest')

# La capuche retombe sur les épaules en petite cape, ronde, jamais pointue.
cape = lathe('cape', [(0.88, 0.3), (0.94, 0.305), (1.02, 0.27), (1.1, 0.2), (1.15, 0.15)],
             mod=lambda th, z, r: r * (1 + (0.04 * math.sin(6 * th) if z < 0.92 else 0)), cap_bottom=False, cap_top=False)
finish(cape, 'hood', 'chest', wobble=0.008)

# ------------------------------------------------------------------ la tête
HC = Vector((0, -0.02, 1.31))
finish(sphere('head', HC, (0.13, 0.125, 0.135)), 'skin', 'head', wobble=0.003)
# Le nez, discret, juste au-dessus de l'écharpe ; les yeux, petits et vifs,
# dans l'ombre de la capuche.
finish(sphere('nose', HC + Vector((0, -0.13, -0.01)), (0.03, 0.03, 0.028)), 'cheek', 'head', wobble=0)
for s in (-1, 1):
    finish(sphere(f'eye{s}', HC + Vector((0.045 * s, -0.117, 0.035)), (0.015, 0.009, 0.018)), 'eye', 'head', level=1, wobble=0)
    finish(sphere(f'glint{s}', HC + Vector((0.041 * s + 0.006, -0.125, 0.042)), (0.005, 0.004, 0.005)), 'glint', 'head', level=1, wobble=0)
    finish(sphere(f'brow{s}', HC + Vector((0.048 * s, -0.12, 0.06)), (0.036, 0.018, 0.013), rot=(0, 0.18 * s, -0.12 * s)), 'beard', 'head', wobble=0.003)

# L'écharpe d'avoine, remontée jusqu'au nez : elle cache la bouche.
scarf = lathe('scarf', [(0.0, 0.12), (0.035, 0.158), (0.09, 0.158), (0.13, 0.14), (0.15, 0.115)], center=(HC.x, HC.y - 0.01, HC.z - 0.16), seg=32,
              mod=lambda th, z, r: r * (1 + 0.04 * math.sin(5 * th + z * 30)), cap_bottom=False, cap_top=False)
finish(scarf, 'scarf', 'head', wobble=0.008)
finish(sphere('scarf_tail', HC + Vector((0.09, -0.11, -0.27)), (0.045, 0.028, 0.12), rot=(0.25, 0, 0.3)), 'scarf', 'chest')
# Une barbe courte, grise, qui dépasse sous l'écharpe.
finish(sphere('beard', HC + Vector((0, -0.075, -0.2)), (0.085, 0.055, 0.06)), 'beard', 'head', wobble=0.006)


def hood_shape(x, y, z):
    if z > 0:
        y += 0.25 * z * z   # elle retombe doucement en arrière, ronde
    return x, y, z


hood = sphere('hood', HC + Vector((0, 0.02, 0.035)), (0.178, 0.182, 0.182), seg=32, rings=18, shape=hood_shape)
bm = bmesh.new()
bm.from_mesh(hood.data)
cut = [f for f in bm.faces if f.calc_center_median().y < -0.065 and f.calc_center_median().z < 0.1]
bmesh.ops.delete(bm, geom=cut, context='FACES')
bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.022)
bm.to_mesh(hood.data)
bm.free()
finish(hood, 'hood', 'head', wobble=0.008)
finish(torus('hood_rim', HC + Vector((0, -0.125, 0.015)), 0.13, 0.03, scale=(1.0, 0.55, 1.18), rot=(math.radians(84), 0, 0)), 'hood_rim', 'head', wobble=0.005)

# ------------------------------------------------------------------ bras, jambes
for s, side in ((1, 'L'), (-1, 'R')):
    finish(tube(f'arm.{side}', (0.22 * s, 0, 1.06), (0.28 * s, 0, 0.84), 0.075, 0.066), 'sleeve', f'arm.{side}')
    finish(tube(f'fore.{side}', (0.28 * s, 0, 0.85), (0.30 * s, -0.03, 0.66), 0.068, 0.064), 'sleeve', f'fore.{side}')
    finish(sphere(f'mitt.{side}', (0.305 * s, -0.035, 0.6), (0.058, 0.052, 0.07)), 'mitt', f'fore.{side}')
    finish(sphere(f'thumb.{side}', (0.28 * s, -0.08, 0.625), (0.024, 0.024, 0.033), rot=(0.4, 0, 0)), 'mitt', f'fore.{side}')
    finish(tube(f'thigh.{side}', (0.1 * s, 0, 0.56), (0.11 * s, 0, 0.32), 0.085, 0.07), 'pants', f'thigh.{side}')
    finish(tube(f'shin.{side}', (0.11 * s, 0, 0.33), (0.11 * s, 0.01, 0.12), 0.068, 0.062), 'pants', f'shin.{side}')
    finish(sphere(f'boot.{side}', (0.11 * s, -0.04, 0.055), (0.08, 0.125, 0.06), shape=lambda x, y, z: (x, y, max(z, -0.7))), 'boot', f'shin.{side}')
    for k in range(2):
        finish(torus(f'bootcord.{side}{k}', (0.11 * s, 0.0, 0.1 + 0.035 * k), 0.066, 0.008), 'cord', f'shin.{side}', level=1, wobble=0)

# ------------------------------------------------------------------ le sac, la théière
for x in (-0.13, 0.13):
    finish(tube(f'post{x}', (x, 0.23, 0.66), (x, 0.24, 1.26), 0.02, 0.018, seg=10), 'wood', 'chest', level=1, wobble=0.003)
for z in (0.8, 1.04):
    finish(tube(f'bar{z}', (-0.15, 0.24, z), (0.15, 0.24, z), 0.017, 0.017, seg=10), 'wood', 'chest', level=1, wobble=0.003)
finish(tube('roll', (-0.21, 0.26, 1.24), (0.21, 0.26, 1.24), 0.08, 0.08, seg=24), 'canvas', 'chest', wobble=0.006)
for x in (-0.1, 0.1):
    finish(torus(f'strapr{x}', (x, 0.26, 1.24), 0.083, 0.01, rot=(0, math.pi / 2, 0)), 'leather', 'chest', level=1, wobble=0)
pot = lathe('teapot', [(0, 0.0), (0.0, 0.045), (0.03, 0.062), (0.07, 0.058), (0.095, 0.035), (0.105, 0.01)], center=(0.22, 0.2, 0.78), seg=24)
finish(pot, 'copper', 'chest', level=1, wobble=0)
finish(tube('spout', (0.27, 0.18, 0.82), (0.32, 0.15, 0.86), 0.01, 0.007, seg=8), 'copper', 'chest', level=1, wobble=0)
finish(torus('handle', (0.18, 0.21, 0.83), 0.03, 0.006, rot=(0, math.pi / 2, 0)), 'copper', 'chest', level=1, wobble=0)

# La flûte de berger : à la ceinture d'ordinaire, à la bouche pour jouer.
flute_belt = tube('flute_belt', (-0.16, -0.24, 0.62), (-0.05, -0.27, 0.86), 0.013, 0.011, seg=8)
finish(flute_belt, 'flute', 'spine', level=1, wobble=0)
flute_play = tube('flute_play', HC + Vector((0.0, -0.15, -0.075)), HC + Vector((0.03, -0.4, -0.33)), 0.014, 0.012, seg=8)
finish(flute_play, 'flute', 'head', level=1, wobble=0)

# Le bâton, planté au sol, et la bûche où il s'assoit.
stick = tube('stick', (-0.36, -0.1, 0.0), (-0.35, -0.1, 1.22), 0.02, 0.017, seg=10)
finish(stick, 'wood', 'root', level=1, wobble=0.004)
knob = sphere('knob', (-0.35, -0.1, 1.23), (0.032, 0.03, 0.04))
finish(knob, 'wood', 'root', level=1)
log = tube('log', (-0.34, 0.06, 0.13), (0.34, 0.06, 0.13), 0.13, 0.12, seg=16)
finish(log, 'log', 'root', wobble=0.006)

# ------------------------------------------------------------------ caméra, rendu (sans contour)
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 1.9
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
if os.environ.get('SIDE'):
    cam.location = (4.5, 0, 0.78)
    cam.rotation_euler = Euler((math.radians(90), 0, math.radians(90)))
else:
    # À hauteur d'homme, tourné vers la droite de l'écran : il regarde le feu.
    yaw = math.radians(42)
    cam.location = (4.6 * math.sin(yaw), -4.6 * math.cos(yaw), 1.5)
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
scene.render.use_freestyle = False   # la charte : aucun contour


# ------------------------------------------------------------------ gestes
def pose(rot, root=(0, 0, 0)):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = Euler([math.radians(a) for a in rot.get(pb.name, (0, 0, 0))])
    rig.location = root


def act(name, t):
    """Un geste au temps t (0 → 1, en boucle). +X penche le buste en avant,
    les jambes et les bras en arrière. Ce sont des gestes d'histoire : aucun
    ne reprend un mouvement d'exercice."""
    w = math.sin(t * 2 * math.pi)
    w2 = math.sin(t * 4 * math.pi)
    if name == 'idle':
        return pose({'chest': (2 * w, 0, 0), 'head': (-3 * w, 5 * math.sin(t * 2 * math.pi + 1), 0),
                     'arm.R': (-8, 0, -10), 'fore.R': (-18, 0, 0), 'arm.L': (4 * w, 0, 4)})
    if name == 'walk':
        return pose({'hips': (0, 0, 6 * w), 'spine': (8, 0, -3 * w), 'head': (-6, 0, 3 * w),
                     'thigh.L': (-24 * w, 0, 0), 'shin.L': (max(0, 30 * w2) + 10, 0, 0),
                     'thigh.R': (24 * w, 0, 0), 'shin.R': (max(0, -30 * w2) + 10, 0, 0),
                     'arm.L': (20 * w, 0, 4), 'arm.R': (-20 - 14 * w, 0, -6), 'fore.R': (-30, 0, 0)},
                    root=(0, 0, 0.015 * abs(w2)))
    if name == 'hammer':
        k = 0.5 + 0.5 * math.cos(t * 2 * math.pi)
        return pose({'spine': (20, 0, 0), 'head': (12, 0, 0),
                     'thigh.L': (-80, 0, 0), 'shin.L': (80, 0, 0), 'thigh.R': (10, 0, 0), 'shin.R': (100, 0, 0),
                     'arm.R': (-60 - 70 * k, 0, -8), 'fore.R': (-30 * k, 0, 0), 'arm.L': (-40, 0, 10), 'fore.L': (-40, 0, 0)},
                    root=(0, 0, -0.26))
    if name == 'kneel_blow':
        return pose({'spine': (24 + 3 * w, 0, 0), 'chest': (8 + 2 * w, 0, 0), 'head': (10 - 4 * w, 0, 0),
                     'thigh.L': (-80, 0, 0), 'shin.L': (80, 0, 0), 'thigh.R': (10, 0, 0), 'shin.R': (100, 0, 0),
                     'arm.L': (-50, 0, 10), 'fore.L': (-40, 0, 0), 'arm.R': (-45, 0, -10), 'fore.R': (-50, 0, 0)},
                    root=(0, 0, -0.26))
    if name == 'flute':
        # Assis sur la bûche, il joue. Le corps se balance doucement, la tête
        # suit la phrase, les doigts courent : les avant-bras battent à peine.
        sway = 4 * w
        return pose({'spine': (6 + 1.5 * w2, 0, sway), 'chest': (2, 0, sway * 0.5), 'head': (6 + 3 * w2, 0, 2 * w),
                     'thigh.L': (-84, 0, 10), 'shin.L': (82, 0, 0), 'thigh.R': (-84, 0, -10), 'shin.R': (82, 0, 0),
                     # Les angles qui posent les deux mains sur la flûte, trouvés par
                     # recherche (à 1-2 cm près) ; les doigts courent autour.
                     'arm.L': (-80, 0, -50), 'fore.L': (-60 + 3 * math.sin(t * 6 * math.pi), 0, 0),
                     'arm.R': (-94, 0, 64), 'fore.R': (-24 + 3 * math.sin(t * 6 * math.pi + 1.3), 0, 0)},
                    root=(0, 0, -0.27))
    raise ValueError(name)


meshes = [o for o in scene.objects if o.type == 'MESH']
original = {o.name: list(o.data.materials) for o in meshes}


def set_pass(kind):
    for o in meshes:
        for i in range(len(o.data.materials)):
            o.data.materials[i] = original[o.name][i] if kind == 'albedo' else NORMAL_MAT
    scene.view_settings.view_transform = 'Standard' if kind == 'albedo' else 'Raw'


def props(name):
    playing = name == 'flute'
    low = name in ('hammer', 'kneel_blow', 'flute')
    stick.hide_render = knob.hide_render = low
    log.hide_render = not playing
    flute_play.hide_render = not playing
    flute_belt.hide_render = playing


if PREVIEW:
    props(ACTIONS[0])
    act(ACTIONS[0], 0.1)
    set_pass('albedo')
    scene.render.filepath = f"{OUT}/preview_{ACTIONS[0]}.png"
    bpy.ops.render.render(write_still=True)
    sys.exit(0)

for name in ACTIONS:
    props(name)
    for f in range(FRAMES):
        act(name, f / FRAMES)
        bpy.context.view_layer.update()
        for kind in ('albedo', 'normal'):
            set_pass(kind)
            scene.render.filepath = f"{OUT}/{name}_{kind}_{f:02d}.png"
            bpy.ops.render.render(write_still=True)
    print('rendu', name)
