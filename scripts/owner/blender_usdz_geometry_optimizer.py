#!/usr/bin/env python3
"""Blender headless USD geometry optimizer for Vistaire USDZ runtime builds.

This script runs inside Blender (`blender --background --python ... -- ...`).
It imports an extracted USD root layer, removes empty/hidden mesh objects,
merges vertices conservatively, applies a bounded decimate pass when a mesh is
above the profile target, and exports a fresh USD layer. Metrics are written as
JSON for the Node/Python orchestrator; no source USDZ is persisted here.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy  # type: ignore
from mathutils import Matrix, Vector  # type: ignore


DISH_SCALE_TARGETS = {
    "burger": {"dimension": "height", "targetMeters": 0.15, "minMeters": 0.10, "maxMeters": 0.22},
    "pizza": {"dimension": "footprint", "targetMeters": 0.32, "minMeters": 0.22, "maxMeters": 0.40},
    "plate": {"dimension": "footprint", "targetMeters": 0.26, "minMeters": 0.18, "maxMeters": 0.34},
    "bowl": {"dimension": "footprint", "targetMeters": 0.18, "minMeters": 0.12, "maxMeters": 0.25},
    "dessert": {"dimension": "footprint", "targetMeters": 0.12, "minMeters": 0.08, "maxMeters": 0.18},
    "drink": {"dimension": "height", "targetMeters": 0.18, "minMeters": 0.12, "maxMeters": 0.25},
    "platter": {"dimension": "footprint", "targetMeters": 0.32, "minMeters": 0.22, "maxMeters": 0.45},
    "fallback": {"dimension": "footprint", "targetMeters": 0.20, "minMeters": 0.10, "maxMeters": 0.35},
}

GROUND_EPSILON_METERS = 0.001
SCALE_EPSILON = 0.001


def mesh_triangle_count(obj) -> int:
    if obj.type != "MESH" or obj.data is None:
        return 0
    return sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons)


def scene_triangle_count() -> int:
    total = 0
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            total += mesh_triangle_count(obj)
    return total


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.data is not None]


def scene_bounds() -> dict | None:
    points = []
    for obj in mesh_objects():
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    if not points:
        return None
    min_x = min(point.x for point in points)
    max_x = max(point.x for point in points)
    min_y = min(point.y for point in points)
    max_y = max(point.y for point in points)
    min_z = min(point.z for point in points)
    max_z = max(point.z for point in points)
    width = max_x - min_x
    depth = max_y - min_y
    height = max_z - min_z
    return {
        "minX": min_x,
        "maxX": max_x,
        "minY": min_y,
        "maxY": max_y,
        "minZ": min_z,
        "maxZ": max_z,
        "width": width,
        "depth": depth,
        "height": height,
        "footprint": max(width, depth),
        "centerX": (min_x + max_x) / 2,
        "centerY": (min_y + max_y) / 2,
        "bottomZ": min_z,
    }


def round_meters(value: float) -> float:
    return round(float(value), 6)


def center_offset(bounds: dict | None) -> float:
    if not bounds:
        return 0
    return ((float(bounds["centerX"]) ** 2) + (float(bounds["centerY"]) ** 2)) ** 0.5


def physical_scale_warnings(dish_kind: str, before: dict | None, scale_factor: float) -> list[str]:
    warnings = []
    if dish_kind == "fallback":
        warnings.append("Fallback physical scale preset used.")
    if abs(scale_factor) > 20:
        warnings.append("Scale factor above 20; source physical units are likely wrong.")
    elif abs(scale_factor) > 8:
        warnings.append("Scale factor above 8; source physical units may be wrong.")
    source_footprint = float(before["footprint"]) if before else 0
    if 0 < source_footprint < 0.03:
        warnings.append("Source footprint is very small.")
    if source_footprint > 1.5:
        warnings.append("Source footprint is very large.")
    return warnings


def physical_scale_payload(status: str, dish_kind: str, target: dict, before: dict | None, after: dict | None, scale_factor: float) -> dict:
    centered_x = abs(float(after["centerX"])) <= GROUND_EPSILON_METERS if after else False
    centered_y = abs(float(after["centerY"])) <= GROUND_EPSILON_METERS if after else False
    grounded = abs(float(after["minZ"])) <= GROUND_EPSILON_METERS if after else False
    return {
        "status": status,
        "dishKind": dish_kind,
        "dimension": target["dimension"],
        "targetMeters": target["targetMeters"],
        "minMeters": target["minMeters"],
        "maxMeters": target["maxMeters"],
        "heightBeforeMeters": round_meters(before["height"]) if before else 0,
        "widthBeforeMeters": round_meters(before["width"]) if before else 0,
        "depthBeforeMeters": round_meters(before["depth"]) if before else 0,
        "footprintBeforeMeters": round_meters(before["footprint"]) if before else 0,
        "heightAfterMeters": round_meters(after["height"]) if after else 0,
        "widthAfterMeters": round_meters(after["width"]) if after else 0,
        "depthAfterMeters": round_meters(after["depth"]) if after else 0,
        "footprintAfterMeters": round_meters(after["footprint"]) if after else 0,
        "scaleFactor": round_meters(scale_factor),
        "centeredX": centered_x,
        "centeredY": centered_y,
        "grounded": grounded,
        "centerOffsetBeforeMeters": round_meters(center_offset(before)),
        "centerOffsetAfterMeters": round_meters(center_offset(after)),
        "warnings": physical_scale_warnings(dish_kind, before, scale_factor),
    }


def bake_meshes_to_world() -> None:
    for obj in mesh_objects():
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        obj.data.update()


def transform_mesh_geometry(matrix: Matrix) -> None:
    for obj in mesh_objects():
        obj.data.transform(matrix)
        obj.data.update()


def normalize_physical_scale(dish_kind: str) -> dict:
    normalized_kind = dish_kind if dish_kind in DISH_SCALE_TARGETS else "fallback"
    target = DISH_SCALE_TARGETS[normalized_kind]
    before = scene_bounds()
    if before is None:
        return physical_scale_payload("failed", normalized_kind, target, None, None, 1.0)

    dimension = target["dimension"]
    current = float(before[dimension])
    if current <= 0:
        return physical_scale_payload("failed", normalized_kind, target, before, before, 1.0)

    bake_meshes_to_world()
    needs_scale = current < target["minMeters"] or current > target["maxMeters"]
    scale_factor = float(target["targetMeters"]) / current if needs_scale else 1.0
    if needs_scale:
        transform_mesh_geometry(Matrix.Scale(scale_factor, 4))

    scaled = scene_bounds()
    if scaled is None:
        return physical_scale_payload("failed", normalized_kind, target, before, None, scale_factor)

    recenter_changed = (
        abs(float(scaled["centerX"])) > GROUND_EPSILON_METERS
        or abs(float(scaled["centerY"])) > GROUND_EPSILON_METERS
    )
    if recenter_changed:
        transform_mesh_geometry(Matrix.Translation((-float(scaled["centerX"]), -float(scaled["centerY"]), 0)))

    centered = scene_bounds()
    if centered is None:
        return physical_scale_payload("failed", normalized_kind, target, before, None, scale_factor)

    ground_offset = -float(centered["minZ"])
    if abs(ground_offset) > GROUND_EPSILON_METERS:
        transform_mesh_geometry(Matrix.Translation((0, 0, ground_offset)))

    after = scene_bounds()
    final_value = float(after[dimension]) if after else 0
    bottom = float(after["minZ"]) if after else 0
    center_x = float(after["centerX"]) if after else float("inf")
    center_y = float(after["centerY"]) if after else float("inf")
    valid_size = target["minMeters"] - GROUND_EPSILON_METERS <= final_value <= target["maxMeters"] + GROUND_EPSILON_METERS
    valid_ground = abs(bottom) <= GROUND_EPSILON_METERS
    valid_center = abs(center_x) <= GROUND_EPSILON_METERS and abs(center_y) <= GROUND_EPSILON_METERS
    status = "normalized" if needs_scale or recenter_changed or abs(ground_offset) > GROUND_EPSILON_METERS else "unchanged"
    if not valid_size or not valid_ground or not valid_center or abs(scale_factor) <= SCALE_EPSILON:
        status = "failed"
    return physical_scale_payload(status, normalized_kind, target, before, after, scale_factor)


def optimize_meshes(target_triangles: int, decimate_ratio: float, merge_distance: float) -> dict:
    removed = []
    optimized = []
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in mesh_objects:
        if obj.hide_get() or obj.hide_viewport or obj.hide_render or obj.data is None:
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        if len(obj.data.vertices) == 0 or len(obj.data.polygons) == 0:
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
            continue

        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.delete_loose()
        bpy.ops.mesh.remove_doubles(threshold=merge_distance, use_sharp_edge_from_normals=True)
        bpy.ops.object.mode_set(mode="OBJECT")

    before = scene_triangle_count()
    if before > target_triangles and before > 0:
        ratio = max(0.05, min(1.0, target_triangles / before, decimate_ratio))
        for obj in [item for item in bpy.context.scene.objects if item.type == "MESH"]:
            if mesh_triangle_count(obj) < 512:
                continue
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            modifier = obj.modifiers.new(name="VistaireRuntimeDecimate", type="DECIMATE")
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
                optimized.append({"name": obj.name, "ratio": ratio})
            except Exception:
                obj.modifiers.remove(modifier)
            obj.select_set(False)

    for obj in [item for item in bpy.context.scene.objects if item.type == "MESH"]:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=0.523599)
        except Exception:
            try:
                bpy.ops.object.shade_smooth()
            except Exception:
                pass
        obj.select_set(False)

    after = scene_triangle_count()
    return {"removedObjects": removed, "optimizedObjects": optimized, "trianglesBefore": before, "trianglesAfter": after}


def main() -> None:
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--metrics", type=Path, required=True)
    parser.add_argument("--target-triangles", type=int, required=True)
    parser.add_argument("--decimate-ratio", type=float, default=0.72)
    parser.add_argument("--merge-distance", type=float, default=0.00005)
    parser.add_argument("--dish-kind", type=str, default="fallback", choices=sorted(DISH_SCALE_TARGETS.keys()))
    args = parser.parse_args(argv)

    clear_scene()
    bpy.ops.wm.usd_import(filepath=str(args.input))
    before_import = scene_triangle_count()
    metrics = optimize_meshes(args.target_triangles, args.decimate_ratio, args.merge_distance)
    physical_scale = normalize_physical_scale(args.dish_kind)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.exists():
        args.output.unlink()
    bpy.ops.wm.usd_export(filepath=str(args.output), selected_objects_only=False)
    payload = {
        "ok": True,
        "blenderVersion": bpy.app.version_string,
        "trianglesBeforeImport": before_import,
        "physicalScale": physical_scale,
        **metrics,
    }
    args.metrics.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
