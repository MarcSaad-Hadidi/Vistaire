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
    args = parser.parse_args(argv)

    clear_scene()
    bpy.ops.wm.usd_import(filepath=str(args.input))
    before_import = scene_triangle_count()
    metrics = optimize_meshes(args.target_triangles, args.decimate_ratio, args.merge_distance)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.exists():
        args.output.unlink()
    bpy.ops.wm.usd_export(filepath=str(args.output), selected_objects_only=False)
    payload = {
        "ok": True,
        "blenderVersion": bpy.app.version_string,
        "trianglesBeforeImport": before_import,
        **metrics,
    }
    args.metrics.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
