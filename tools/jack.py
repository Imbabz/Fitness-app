"""Jack, le chien de Firmin : modèle, squelette, gestes, rendu en sprites peints.

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
    # Jack : un chien de berger hirsute, gris et crème.
    'fur': (0.56, 0.55, 0.59),
    'fur_dark': (0.38, 0.37, 0.42),
    'cream': (0.88, 0.83, 0.73),
    'nose': (0.16, 0.13, 0.13),
    'eye': (0.09, 0.07, 0.06),
    'glint': (0.98, 0.96, 0.92),
    'collar': (0.60, 0.27, 0.16),
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


MATS = {k: material(k, v, wool=k not in ('eye', 'glint', 'nose')) for k, v in PALETTE.items()}

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
    # Un quadrupède, le museau vers l'objectif (-Y).
    'root': ((0, 0, 0), (0, 0, 0.1), None),
    'body': ((0, 0.13, 0.36), (0, -0.13, 0.37), 'root'),
    'neck': ((0, -0.13, 0.37), (0, -0.2, 0.47), 'body'),
    'head': ((0, -0.2, 0.47), (0, -0.34, 0.5), 'neck'),
    'tail': ((0, 0.15, 0.38), (0, 0.3, 0.46), 'body'),
    'leg.FL': ((0.075, -0.11, 0.3), (0.075, -0.115, 0.04), 'body'),
    'leg.FR': ((-0.075, -0.11, 0.3), (-0.075, -0.115, 0.04), 'body'),
    'leg.BL': ((0.08, 0.1, 0.3), (0.08, 0.11, 0.04), 'body'),
    'leg.BR': ((-0.08, 0.1, 0.3), (-0.08, 0.11, 0.04), 'body'),
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
def shag(x, y, z):
    # Le poil : la surface ondule en mèches.
    k = 1 + 0.06 * math.sin(9 * x + 5 * z) * math.cos(7 * y)
    return x * k, y, z * k


finish(sphere('body', (0, 0.0, 0.37), (0.13, 0.24, 0.13), shape=shag), 'fur', 'body', wobble=0.014)
finish(sphere('chest', (0, -0.13, 0.33), (0.105, 0.1, 0.12), shape=shag), 'cream', 'body', wobble=0.012)
finish(sphere('back', (0, 0.05, 0.45), (0.1, 0.18, 0.05), shape=shag), 'fur_dark', 'body', wobble=0.01)
finish(torus('collar', (0, -0.17, 0.43), 0.07, 0.012, rot=(math.radians(60), 0, 0)), 'collar', 'neck', level=1, wobble=0)

# ------------------------------------------------------------------ la tête
HC = Vector((0, -0.27, 0.49))
finish(sphere('neckfur', (0, -0.19, 0.43), (0.085, 0.09, 0.1), shape=shag), 'fur', 'neck', wobble=0.01)
finish(sphere('head', HC, (0.095, 0.1, 0.09), shape=shag), 'fur', 'head', wobble=0.01)
finish(sphere('snout', HC + Vector((0, -0.085, -0.03)), (0.05, 0.065, 0.042)), 'cream', 'head', wobble=0.005)
finish(sphere('nose', HC + Vector((0, -0.148, -0.012)), (0.02, 0.014, 0.015)), 'nose', 'head', level=1, wobble=0)
# La frange tombe sur les yeux : on les devine.
finish(sphere('fringe', HC + Vector((0, -0.07, 0.05)), (0.085, 0.045, 0.038), shape=shag), 'cream', 'head', wobble=0.01)
for s in (-1, 1):
    finish(sphere(f'eye{s}', HC + Vector((0.038 * s, -0.088, 0.02)), (0.012, 0.008, 0.012)), 'eye', 'head', level=1, wobble=0)
    finish(sphere(f'glint{s}', HC + Vector((0.034 * s, -0.095, 0.025)), (0.004, 0.003, 0.004)), 'glint', 'head', level=1, wobble=0)
    finish(sphere(f'ear{s}', HC + Vector((0.085 * s, 0.01, 0.0)), (0.03, 0.05, 0.075), rot=(0.2, 0.3 * s, 0.25 * s)), 'fur_dark', 'head', wobble=0.008)

# ------------------------------------------------------------------ pattes, queue
for side, x, y, bone in (('FL', 0.075, -0.11, 'leg.FL'), ('FR', -0.075, -0.11, 'leg.FR'), ('BL', 0.08, 0.1, 'leg.BL'), ('BR', -0.08, 0.1, 'leg.BR')):
    finish(tube(f'leg.{side}', (x, y, 0.3), (x, y - 0.005, 0.06), 0.045, 0.035, seg=12), 'cream' if side[0] == 'F' else 'fur', bone, wobble=0.006)
    finish(sphere(f'paw.{side}', (x, y - 0.025, 0.03), (0.04, 0.055, 0.03)), 'cream', bone, level=1, wobble=0.004)
finish(tube('tail', (0, 0.15, 0.38), (0, 0.3, 0.46), 0.04, 0.03, seg=12), 'fur', 'tail', wobble=0.01)
finish(sphere('tuft', (0, 0.31, 0.47), (0.045, 0.06, 0.05), shape=shag), 'cream', 'tail', wobble=0.01)

# ------------------------------------------------------------------ caméra : la même que Firmin
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 1.9
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
if os.environ.get('SIDE'):
    cam.location = (4.5, 0, 0.4)
    cam.rotation_euler = Euler((math.radians(90), 0, math.radians(90)))
else:
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
scene.render.use_freestyle = False


def pose(rot, root=(0, 0, 0)):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = Euler([math.radians(a) for a in rot.get(pb.name, (0, 0, 0))])
    rig.location = root


def act(name, t):
    """+X : le corps et la tête baissent le museau ; une patte part vers l'arrière.
    (Vérifié de profil : un os horizontal tourné de +X pique du nez.)"""
    w = math.sin(t * 2 * math.pi)
    w2 = math.sin(t * 4 * math.pi)
    if name == 'trot':
        return pose({'body': (2 * w2, 0, 0), 'neck': (4 * w2 - 6, 0, 0), 'tail': (-10, 0, 30 * w),
                     'leg.FL': (26 * w, 0, 0), 'leg.BR': (26 * w, 0, 0), 'leg.FR': (-26 * w, 0, 0), 'leg.BL': (-26 * w, 0, 0)},
                    root=(0, 0, 0.012 * abs(w2)))
    if name == 'sit':
        # Assis, il regarde Firmin, penche la tête, la queue balaie le sol.
        # Le corps se redresse de 38° ; les pattes avant compensent pour rester
        # droites, les arrière se replient vers l'avant sous lui.
        return pose({'body': (-38, 0, 0), 'neck': (26, 0, 0), 'head': (6, 0, 12 * math.sin(t * 2 * math.pi)),
                     'leg.FL': (38, 0, 0), 'leg.FR': (38, 0, 0), 'leg.BL': (-52, 0, 6), 'leg.BR': (-52, 0, -6),
                     'tail': (40, 0, 18 * w)}, root=(0, 0, -0.2))
    if name == 'lie':
        # Couché près du feu, il respire, le bout de la queue bat.
        return pose({'body': (1.5 * w, 0, 0), 'neck': (10, 0, 0), 'head': (8 + 2 * w, 0, 6),
                     'leg.FL': (-82, 0, 0), 'leg.FR': (-82, 0, 0), 'leg.BL': (-78, 0, 6), 'leg.BR': (-78, 0, -6),
                     'tail': (-30, 0, 20 + 14 * math.sin(t * 4 * math.pi))}, root=(0, 0, -0.2))
    raise ValueError(name)


meshes = [o for o in scene.objects if o.type == 'MESH']
original = {o.name: list(o.data.materials) for o in meshes}


def set_pass(kind):
    for o in meshes:
        for i in range(len(o.data.materials)):
            o.data.materials[i] = original[o.name][i] if kind == 'albedo' else NORMAL_MAT
    scene.view_settings.view_transform = 'Standard' if kind == 'albedo' else 'Raw'


if PREVIEW:
    act(ACTIONS[0], 0.1)
    set_pass('albedo')
    scene.render.filepath = f"{OUT}/preview_{ACTIONS[0]}.png"
    bpy.ops.render.render(write_still=True)
    sys.exit(0)

for name in ACTIONS:
    for f in range(FRAMES):
        act(name, f / FRAMES)
        bpy.context.view_layer.update()
        for kind in ('albedo', 'normal'):
            set_pass(kind)
            scene.render.filepath = f"{OUT}/{name}_{kind}_{f:02d}.png"
            bpy.ops.render.render(write_still=True)
    print('rendu', name)
