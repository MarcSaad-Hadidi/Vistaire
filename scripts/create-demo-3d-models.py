"""
Modèles GLB MVP Maison Élyse — génération procédurale Blender 3.6+ / 4.x.

Sortie : public/models/demo/*.glb

Exécution (depuis la racine du dépôt) :
  blender --background --python scripts/create-demo-3d-models.py

Alternative sans Blender (Three.js, résultat équivalent aux assets versionnés) :
  npm run demo:generate-3d

Les modèles sont stylisés (preuve de concept), pas des scans photoréalistes.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy  # type: ignore  # noqa: I001 — fourni par Blender
from mathutils import Euler, Vector  # type: ignore


ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "models" / "demo"


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def new_mat(name: str, color, rough=0.45, metal=0.25, **kwargs):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    for n in list(nodes):
        nodes.remove(n)
    out = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.inputs["Base Color"].default_value = (*color[:3], 1.0)
    principled.inputs["Roughness"].default_value = rough
    principled.inputs["Metallic"].default_value = metal
    if "alpha" in kwargs:
        m.blend_method = "BLEND"
        principled.inputs["Alpha"].default_value = kwargs["alpha"]
    if "emission" in kwargs:
        principled.inputs["Emission Color"].default_value = (*kwargs["emission"][:3], 1.0)
        principled.inputs["Emission Strength"].default_value = kwargs.get("emission_strength", 0.12)
    links.new(principled.outputs["BSDF"], out.inputs["Surface"])
    return m


def cylinder(name, r, depth, loc, mat, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=r, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    if rot:
        o.rotation_euler = Euler(rot, "XYZ")
    return o


def sphere(name, radius, loc, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=24, ring_count=18, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = Vector(scale)
    o.data.materials.append(mat)
    return o


def torus(name, major, minor, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=56, minor_segments=12, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = Euler(rot, "XYZ")
    o.data.materials.append(mat)
    return o


def export(name: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
    )


def center_normalize_scene(target: float = 2.2) -> None:
    """Centre la scène mesh sur l'origine puis normalise l'échelle (max dim ≈ target)."""
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        return

    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]

    # Origine au centre géométrique
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

    # Bounding box
    min_c = Vector((1e9, 1e9, 1e9))
    max_c = Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            min_c.x = min(min_c.x, w.x)
            min_c.y = min(min_c.y, w.y)
            min_c.z = min(min_c.z, w.z)
            max_c.x = max(max_c.x, w.x)
            max_c.y = max(max_c.y, w.y)
            max_c.z = max(max_c.z, w.z)
    center = (min_c + max_c) / 2
    size = max_c - min_c
    max_dim = max(size.x, size.y, size.z, 1e-6)
    scale_f = target / max_dim

    for o in meshes:
        o.matrix_world.translation -= center
        o.scale = o.scale * scale_f
        o.matrix_world.translation *= scale_f


def build_ravioles() -> None:
    clear_scene()
    plate_m = new_mat("plate", (0.09, 0.09, 0.11), 0.35, 0.42)
    rim_m = new_mat("rim", (0.12, 0.12, 0.16), 0.28, 0.55)
    sauce_m = new_mat("sauce", (0.65, 0.48, 0.32), 0.45, 0.12)
    dough_m = new_mat("dough", (0.91, 0.86, 0.74), 0.55, 0.02)
    honey_m = new_mat("honey", (0.79, 0.58, 0.18), 0.25, 0.35, emission=(0.15, 0.1, 0.02), emission_strength=0.15)
    herb_m = new_mat("herb", (0.18, 0.29, 0.2), 0.75, 0.05)
    dot_m = new_mat("dot", (0.56, 0.42, 0.27), 0.4, 0.1)

    cylinder("plate", 1.15, 0.08, (0, 0.04, 0), plate_m)
    torus("rim", 1.18, 0.028, (0, 0.086, 0), rim_m, rot=(math.pi / 2, 0, 0))

    bpy.ops.mesh.primitive_circle_add(vertices=44, radius=0.95, location=(0, 0.086, 0))
    disc = bpy.context.active_object
    disc.name = "sauce_pool"
    disc.rotation_euler = Euler((math.pi / 2, 0, 0), "XYZ")
    disc.data.materials.append(sauce_m)

    positions = [(0, 0.12), (0.32, 0.18), (-0.29, 0.2), (0.22, -0.32), (-0.34, -0.18), (-0.06, -0.36), (0.42, -0.05)]
    for i, (x, z) in enumerate(positions):
        sphere(f"raviol_{i}", 0.21, (x, 0.16, z), dough_m, scale=(1.05, 0.48, 1.02))

    # Filet miel (beziers -> curve)
    curve = bpy.data.curves.new(name="honey_curve", type="CURVE")
    curve.dimensions = "3D"
    poly = curve.splines.new("BEZIER")
    poly.bezier_points.add(2)
    pts = [(-0.52, 0.2, -0.52), (0.08, 0.36, 0.12), (0.58, 0.2, 0.45)]
    for j, p in enumerate(pts):
        poly.bezier_points[j].co = p
        poly.bezier_points[j].handle_left_type = poly.bezier_points[j].handle_right_type = "AUTO"
    obj = bpy.data.objects.new("honey_strip", curve)
    bpy.context.collection.objects.link(obj)
    obj.data.bevel_depth = 0.028
    obj.data.materials.append(honey_m)

    import random

    random.seed(42)
    for i in range(5):
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.04, radius2=0.0, depth=0.22 + i * 0.02)
        lf = bpy.context.active_object
        lf.name = f"rosemary_{i}"
        a = (i / 5) * math.pi * 1.8 - 0.4
        lf.location = (math.cos(a) * 0.75, 0.22, math.sin(a) * 0.75)
        lf.rotation_euler = (random.uniform(-0.15, 0.15), 0, 0.35 + i * 0.12)
        lf.data.materials.append(herb_m)

    for i in range(12):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.026, location=(0, 0.1, 0))
        dot = bpy.context.active_object
        dot.name = f"butter_dot_{i}"
        rr = 0.55 + random.random() * 0.35
        ang = random.random() * math.pi * 2
        dot.location = (math.cos(ang) * rr, 0.1, math.sin(ang) * rr)
        dot.data.materials.append(dot_m)

    center_normalize_scene()
    export("ravioles-chevre-miel.glb")


def build_homard() -> None:
    clear_scene()
    plate_m = new_mat("plat_noir", (0.07, 0.06, 0.08), 0.32, 0.48)
    bisque_m = new_mat("bisque", (0.76, 0.36, 0.15), 0.22, 0.18, emission=(0.18, 0.07, 0.02), emission_strength=0.12)
    ring_m = new_mat("ring", (0.65, 0.28, 0.12), 0.28, 0.08)
    body_m = new_mat("homard", (0.1, 0.29, 0.45), 0.42, 0.22)
    tail_m = new_mat("tail", (0.72, 0.36, 0.22), 0.38, 0.18)
    claw_m = new_mat("claw", (0.1, 0.29, 0.45), 0.4, 0.28)
    fennel_m = new_mat("fennel", (0.61, 0.77, 0.66), 0.5, 0.04)
    herb_m = new_mat("fine_herbe", (0.19, 0.36, 0.23), 0.65, 0.05)

    cylinder("plate_large", 1.45, 0.09, (0, 0.045, 0), plate_m)

    bpy.ops.mesh.primitive_circle_add(vertices=52, radius=1.12, location=(0, 0.098, 0))
    b_disc = bpy.context.active_object
    b_disc.name = "bisque"
    b_disc.rotation_euler = Euler((math.pi / 2, 0, 0), "XYZ")
    b_disc.data.materials.append(bisque_m)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.66, minor_radius=0.06, major_segments=48, minor_segments=10)
    rin2 = bpy.context.active_object
    rin2.name = "bisque_wave"
    rin2.rotation_euler = Euler((math.pi / 2, 0, 0), "XYZ")
    rin2.scale = (1.0, 1.0, 0.12)
    rin2.location.z = 0.102
    rin2.data.materials.append(ring_m)

    bpy.ops.mesh.primitive_capsule_add(radius=0.22, depth=0.77, ring_vertices=12, radial_segments=24)
    body = bpy.context.active_object
    body.name = "homard_corps"
    body.rotation_euler = (0, 0, math.pi / 2.25)
    body.location = (0.06, 0.22, -0.12)
    body.data.materials.append(body_m)

    bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.28, radius2=0, depth=0.72)
    tail = bpy.context.active_object
    tail.name = "queue"
    tail.rotation_euler = (math.pi / 2.1, 0.55, -0.55)
    tail.location = (-0.62, 0.2, 0.06)
    tail.data.materials.append(tail_m)

    for nm, loc, rz in [
        ("pince_d", (0.38, 0.15, 0.38), math.pi / 5),
        ("pince_g", (0.35, 0.16, -0.4), -math.pi / 8),
    ]:
        bpy.ops.mesh.primitive_cylinder_add(radius_top=0.11, radius_bottom=0.14, depth=0.38, location=loc, vertices=18)
        c = bpy.context.active_object
        c.name = nm
        c.rotation_euler = (0, rz, rz)
        c.data.materials.append(claw_m)

    for i in range(6):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.16, 0))
        fr = bpy.context.active_object
        fr.name = f"fennel_{i}"
        fr.scale = (0.08, 0.01, 0.55)
        t = (i / 6) * math.pi * 2
        fr.location = (math.cos(t) * 0.48, 0.16, math.sin(t) * 0.48)
        fr.rotation_euler = (0.25, t + 0.4, 0)
        fr.data.materials.append(fennel_m)

    for i in range(8):
        bpy.ops.mesh.primitive_cylinder_add(radius_top=0.012, radius_bottom=0.02, depth=0.15 + (i % 3) * 0.04, vertices=6)
        s = bpy.context.active_object
        s.name = f"garnish_{i}"
        u = (i / 8) * math.pi * 2
        s.location = (math.cos(u) * 0.82, 0.12, math.sin(u) * 0.82)
        s.rotation_euler = (0.4 + (i % 2) * 0.2, 0, 0)
        s.data.materials.append(herb_m)

    center_normalize_scene()
    export("homard-bisque.glb")


def build_souffle() -> None:
    clear_scene()
    plate_m = new_mat("assiette", (0.07, 0.06, 0.05), 0.42, 0.35)
    ram_m = new_mat("ramekin", (0.16, 0.09, 0.06), 0.55, 0.08)
    choc_m = new_mat("chocolat", (0.29, 0.16, 0.09), 0.82, 0.05, emission=(0.08, 0.03, 0.02), emission_strength=0.06)
    ice_m = new_mat("glace", (0.97, 0.93, 0.85), 0.72, 0.03)
    dust_m = new_mat("cacao", (0.16, 0.09, 0.06), 0.92, 0)

    cylinder("assiette", 1.08, 0.06, (0, 0.03, 0), plate_m)

    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.52, depth=0.38, location=(0, 0.28, 0))
    rk = bpy.context.active_object
    rk.name = "ramekin_wall"
    rk.data.materials.append(ram_m)

    cylinder("ramekin_fond", 0.5, 0.045, (0, 0.065, 0), ram_m)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.52, location=(0, 0.48, 0))
    suff = bpy.context.active_object
    suff.name = "souffle"
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.bissect(plane_co=(0, 0.82, 0), plane_no=(0, 1, 0), clear_inner=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    suff.data.materials.append(choc_m)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22, location=(0.74, 0.16, 0.06))
    ice = bpy.context.active_object
    ice.name = "glace"
    ice.scale = (1, 0.85, 1)
    ice.data.materials.append(ice_m)

    import random

    random.seed(7)
    for i in range(40):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.015 + random.random() * 0.01, location=(0, 0.075, 0))
        g = bpy.context.active_object
        g.name = f"tonka_{i}"
        g.location = (0.5 + random.random() * 0.5, 0.075 + random.random() * 0.05, -0.5 + random.random() * 0.7)
        g.data.materials.append(dust_m)

    center_normalize_scene()
    export("souffle-chocolat.glb")


def build_cocktail() -> None:
    clear_scene()
    glass_m = new_mat("glass", (1.0, 1.0, 1.0), 0.08, 0)
    glass_m.use_nodes = True
    nt = glass_m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    pr = nt.nodes.new("ShaderNodeBsdfPrincipled")
    pr.inputs["Roughness"].default_value = 0.08
    pr.inputs["Metallic"].default_value = 0
    pr.inputs["IOR"].default_value = 1.52
    pr.inputs["Alpha"].default_value = 0.85
    for key in ("Transmission Weight", "Transmission"):
        if key in pr.inputs:
            pr.inputs[key].default_value = 1.0
            break
    glass_m.blend_method = "BLEND"
    nt.links.new(pr.outputs["BSDF"], out.inputs["Surface"])

    liq_m = new_mat(
        "rose",
        (0.91, 0.72, 0.74),
        0.18,
        0.02,
        emission=(0.22, 0.12, 0.13),
        emission_strength=0.08,
        alpha=0.92,
    )
    garnish_m = new_mat("pink", (0.85, 0.54, 0.63), 0.45, 0.12)
    leaf_m = new_mat("leaf", (0.42, 0.61, 0.43), 0.55, 0.05)
    bub_m = new_mat("bubble", (1, 0.96, 0.97), 0.08, 0.15, alpha=0.42)

    bpy.ops.mesh.primitive_cylinder_add(radius_top=0.06, radius_bottom=0.08, depth=0.42, location=(0, 0.28, 0))
    stem = bpy.context.active_object
    stem.name = "tige"
    stem.data.materials.append(glass_m)

    cylinder("foot", 0.44, 0.05, (0, 0.05, 0), glass_m)

    # Coupe : sphère tronquée (approx.)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.55, location=(0, 0.75, 0))
    coupe = bpy.context.active_object
    coupe.name = "coupe_verre"
    coupe.scale = (1, 0.55, 1)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.bissect(plane_co=(0, 0.4, 0), plane_no=(0, -1, 0), clear_inner=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    coupe.location.y = 0.65
    coupe.data.materials.append(glass_m)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.42, location=(0, 0.68, 0))
    liquid = bpy.context.active_object
    liquid.name = "liqueur"
    liquid.scale = (1, 0.45, 1)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.bissect(plane_co=(0, 0.62, 0), plane_no=(0, -1, 0), clear_inner=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    liquid.location.y = 0.72
    liquid.data.materials.append(liq_m)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(0.36, 0.92, 0.04))
    gar = bpy.context.active_object
    gar.name = "garniture"
    gar.scale = (1, 0.55, 1)
    gar.rotation_euler = (0, 0, 0.5)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.bissect(plane_co=(0, 1, 0), plane_no=(0, -1, 0), clear_inner=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    gar.data.materials.append(garnish_m)

    bpy.ops.mesh.primitive_circle_add(radius=0.12, location=(-0.25, 0.88, 0.08))
    leaf = bpy.context.active_object
    leaf.name = "verveine"
    leaf.rotation_euler = (0.6, 0.2, 0.4)
    leaf.data.materials.append(leaf_m)

    bubbles = [(0.1, 0.72, 0.15), (-0.12, 0.78, 0.06), (0.04, 0.85, -0.1), (0.22, 0.8, -0.04), (-0.2, 0.74, -0.12)]
    for i, bb in enumerate(bubbles):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.028, location=bb)
        b = bpy.context.active_object
        b.name = f"bubble_{i}"
        b.data.materials.append(bub_m)

    center_normalize_scene()
    export("maison-elyse-n1.glb")


def main() -> None:
    build_ravioles()
    build_homard()
    build_souffle()
    build_cocktail()
    print(f"GLB écrits dans {OUT_DIR}")


if __name__ == "__main__":
    main()
