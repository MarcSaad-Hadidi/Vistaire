import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path.cwd().resolve()


def round_list(values):
    return [round(float(value), 6) for value in values]


def rel(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def triangle_count(mesh):
    return sum(max(len(poly.vertices) - 2, 0) for poly in mesh.polygons)


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector((min(corner.x for corner in corners), min(corner.y for corner in corners), min(corner.z for corner in corners)))
    maximum = Vector((max(corner.x for corner in corners), max(corner.y for corner in corners), max(corner.z for corner in corners)))
    return {
        "min": round_list(minimum),
        "max": round_list(maximum),
        "size": round_list(maximum - minimum),
    }


def is_locked_support(obj):
    name = obj.name.lower()
    mesh_name = obj.data.name.lower()
    dims = world_bounds(obj)["size"]
    plate_like = len(obj.data.vertices) < 10_000 and dims[0] > 0.1 and dims[2] > 0.1 and dims[1] < 0.08
    return (
        "assiette" in name
        or "plate" in name
        or "surface" in name
        or "rebord" in name
        or "torus" in mesh_name
        or plate_like
    )


def summarize_object(obj):
    return {
        "objectName": obj.name,
        "meshName": obj.data.name,
        "vertices": len(obj.data.vertices),
        "faces": len(obj.data.polygons),
        "triangles": triangle_count(obj.data),
        "bounds": world_bounds(obj),
        "lockedSupport": is_locked_support(obj),
    }


def make_candidate(input_path: Path, output_path: Path, summary_path: Path, ratio: float, min_triangles: int):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(input_path))
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    before = [summarize_object(obj) for obj in mesh_objects]
    changed = []

    for obj in mesh_objects:
        tris = triangle_count(obj.data)
        if is_locked_support(obj) or tris < min_triangles:
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        modifier = obj.modifiers.new(name=f"candidate_decimate_{ratio}", type="DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
        changed.append(obj.name)

    after_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    after = [summarize_object(obj) for obj in after_objects]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output_path), export_format="GLB")
    summary = {
        "input": rel(input_path),
        "output": rel(output_path),
        "ratio": ratio,
        "minTriangles": min_triangles,
        "changedObjects": changed,
        "before": before,
        "after": after,
        "risk": "lossy targeted geometry candidate; plate/support/contact meshes locked; visual QA required",
    }
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--ratio", type=float, required=True)
    parser.add_argument("--min-triangles", type=int, default=100_000)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    make_candidate(
        (ROOT / args.input).resolve(),
        (ROOT / args.output).resolve(),
        (ROOT / args.summary).resolve(),
        args.ratio,
        args.min_triangles,
    )


if __name__ == "__main__":
    main()
