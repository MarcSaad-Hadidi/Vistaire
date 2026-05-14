import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path.cwd().resolve()
ASSETS = [
    Path("public/models/demo/ravioles-chevre-miel.glb"),
    Path("public/models/demo/homard-bisque.glb"),
    Path("public/models/demo/souffle-chocolat.glb"),
    Path("public/models/demo/maison-elyse-n1.glb"),
]


def round_list(values):
    return [round(float(value), 6) for value in values]


def round_matrix(matrix):
    return [round(float(matrix[row][column]), 6) for row in range(4) for column in range(4)]


def rel(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector((min(corner.x for corner in corners), min(corner.y for corner in corners), min(corner.z for corner in corners)))
    maximum = Vector((max(corner.x for corner in corners), max(corner.y for corner in corners), max(corner.z for corner in corners)))
    return {
        "min": round_list(minimum),
        "max": round_list(maximum),
        "size": round_list(maximum - minimum),
    }


def inspect_asset(path: Path):
    absolute = (ROOT / path).resolve()
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(absolute))
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    mesh_reports = []
    for obj in mesh_objects:
        mesh = obj.data
        polygons = list(mesh.polygons)
        vertex_count = len(mesh.vertices)
        face_count = len(polygons)
        triangle_count = sum(max(len(poly.vertices) - 2, 0) for poly in polygons)
        material_names = [slot.material.name if slot.material else None for slot in obj.material_slots]
        bounds = world_bounds(obj)
        dims = bounds["size"]
        is_plate_like = (
            vertex_count < 10_000
            and dims[0] > 0.1
            and dims[2] > 0.1
            and dims[1] < 0.08
        )
        is_support_or_ar_surface = "plate" in obj.name.lower() or "assiette" in obj.name.lower() or "surface" in obj.name.lower() or is_plate_like
        mesh_reports.append(
            {
                "objectName": obj.name,
                "meshName": mesh.name,
                "vertexCount": vertex_count,
                "faceCount": face_count,
                "triangleCount": triangle_count,
                "materialSlots": material_names,
                "bounds": bounds,
                "worldMatrix": round_matrix(obj.matrix_world),
                "sensitiveKeepLocked": bool(is_support_or_ar_surface),
                "riskNotes": [
                    note
                    for note in [
                        "protect: likely plate/support/contact surface" if is_support_or_ar_surface else None,
                        "heavy mesh candidate; inspect silhouette before any simplification" if triangle_count > 100_000 else None,
                    ]
                    if note
                ],
            }
        )
    mesh_reports.sort(key=lambda item: item["triangleCount"], reverse=True)
    return {
        "file": rel(absolute),
        "sha256": hashlib.sha256(absolute.read_bytes()).hexdigest(),
        "meshObjectCount": len(mesh_reports),
        "totalVertices": sum(item["vertexCount"] for item in mesh_reports),
        "totalFaces": sum(item["faceCount"] for item in mesh_reports),
        "totalTriangles": sum(item["triangleCount"] for item in mesh_reports),
        "meshes": mesh_reports,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="asset-review/3d-candidates/baseline/blender-mesh-audit.json")
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    reports = [inspect_asset(path) for path in ASSETS]
    output = (ROOT / args.output).resolve()
    output.write_text(json.dumps({"reports": reports}, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
