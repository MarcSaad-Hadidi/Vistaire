from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path
from typing import Any

from pxr import Usd, UsdGeom, UsdShade


ROOT = Path.cwd().resolve()
ASSETS = [
    Path("public/models/demo/ravioles-chevre-miel.usdz"),
    Path("public/models/demo/homard-bisque.usdz"),
    Path("public/models/demo/souffle-chocolat.usdz"),
    Path("public/models/demo/maison-elyse-n1.usdz"),
]
USAGE = {
    "ravioles-chevre-miel.usdz": {
        "dish": "ravioles-romarin",
        "url": "/models/demo/ravioles-chevre-miel.usdz",
        "role": "iOS Quick Look via model-viewer ios-src",
    },
    "homard-bisque.usdz": {
        "dish": "homard-bisque",
        "url": "/models/demo/homard-bisque.usdz",
        "role": "iOS Quick Look via model-viewer ios-src",
    },
    "souffle-chocolat.usdz": {
        "dish": "souffle-chocolat",
        "url": "/models/demo/souffle-chocolat.usdz?v=plate-source-20260511",
        "role": "iOS Quick Look via model-viewer ios-src",
    },
    "maison-elyse-n1.usdz": {
        "dish": "cocktail-maison-elyse",
        "url": "/models/demo/maison-elyse-n1.usdz",
        "role": "iOS Quick Look via model-viewer ios-src; audit only",
    },
}


def round_list(values: Any) -> list[float]:
    return [round(float(value), 6) for value in values]


def round_matrix(matrix: Any) -> list[float]:
    flattened: list[float] = []
    for row_index in range(4):
        row = matrix[row_index]
        for column_index in range(4):
            flattened.append(round(float(row[column_index]), 6))
    return flattened


def mib(size: int) -> float:
    return round(size / 1024 / 1024, 4)


def rel(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def range_summary(bounds: Any) -> dict[str, list[float]]:
    minimum = bounds.GetMin()
    maximum = bounds.GetMax()
    return {
        "min": round_list(minimum),
        "max": round_list(maximum),
        "size": round_list(maximum - minimum),
    }


def zip_alignment(path: Path) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    with zipfile.ZipFile(path, "r") as archive:
        for info in archive.infolist():
            data_offset = info.header_offset + 30 + len(info.filename.encode("utf-8")) + len(info.extra)
            entries.append(
                {
                    "name": info.filename,
                    "compressType": info.compress_type,
                    "fileSize": info.file_size,
                    "compressSize": info.compress_size,
                    "dataOffset": data_offset,
                    "dataOffsetMod64": data_offset % 64,
                    "storeOnly": info.compress_type == zipfile.ZIP_STORED,
                }
            )
    return {
        "entryCount": len(entries),
        "entries": entries,
        "allStoreOnly": all(entry["storeOnly"] for entry in entries),
        "allDataOffsets64Aligned": all(entry["dataOffsetMod64"] == 0 for entry in entries),
    }


def inspect_usdz(path: Path) -> dict[str, Any]:
    absolute = path.resolve()
    raw = absolute.read_bytes()
    stage = Usd.Stage.Open(str(absolute))
    if stage is None:
        raise RuntimeError(f"Unable to open USDZ stage: {absolute}")

    default_prim = stage.GetDefaultPrim()
    if not default_prim:
        raise RuntimeError(f"USDZ stage has no default prim: {absolute}")

    bbox_cache = UsdGeom.BBoxCache(
        Usd.TimeCode.Default(),
        [UsdGeom.Tokens.default_, UsdGeom.Tokens.render, UsdGeom.Tokens.proxy],
        useExtentsHint=True,
    )
    meshes: list[dict[str, Any]] = []
    materials: list[str] = []
    shaders: list[str] = []
    textures: list[dict[str, Any]] = []
    unresolved_textures: list[str] = []

    for prim in stage.Traverse():
        if prim.IsA(UsdGeom.Mesh):
            mesh = UsdGeom.Mesh(prim)
            points = mesh.GetPointsAttr().Get() or []
            face_counts = mesh.GetFaceVertexCountsAttr().Get() or []
            face_indices = mesh.GetFaceVertexIndicesAttr().Get() or []
            bound_material, _ = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()
            transform = UsdGeom.Xformable(prim).ComputeLocalToWorldTransform(Usd.TimeCode.Default())
            meshes.append(
                {
                    "path": str(prim.GetPath()),
                    "points": len(points),
                    "faces": len(face_counts),
                    "faceVertexIndices": len(face_indices),
                    "bounds": range_summary(bbox_cache.ComputeWorldBound(prim).ComputeAlignedRange()),
                    "boundMaterial": str(bound_material.GetPath()) if bound_material else None,
                    "worldMatrix": round_matrix(transform),
                }
            )
        if prim.IsA(UsdShade.Material):
            materials.append(str(prim.GetPath()))
        if prim.GetTypeName() == "Shader":
            shaders.append(str(prim.GetPath()))
            shader = UsdShade.Shader(prim)
            file_input = shader.GetInput("file")
            if file_input:
                asset = file_input.Get()
                asset_path = getattr(asset, "path", None)
                resolved_path = getattr(asset, "resolvedPath", None)
                textures.append(
                    {
                        "path": asset_path,
                        "file": Path(asset_path).name if asset_path else None,
                        "resolved": bool(resolved_path),
                    }
                )
                if not resolved_path:
                    unresolved_textures.append(asset_path or str(prim.GetPath()))

    return {
        "file": rel(absolute),
        "usage": USAGE.get(absolute.name),
        "bytes": len(raw),
        "mib": mib(len(raw)),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "zip": zip_alignment(absolute),
        "defaultPrim": str(default_prim.GetPath()),
        "primCount": sum(1 for _ in stage.Traverse()),
        "bounds": range_summary(bbox_cache.ComputeWorldBound(default_prim).ComputeAlignedRange()),
        "meshCount": len(meshes),
        "pointCount": sum(mesh["points"] for mesh in meshes),
        "faceCount": sum(mesh["faces"] for mesh in meshes),
        "faceVertexIndexCount": sum(mesh["faceVertexIndices"] for mesh in meshes),
        "materialCount": len(materials),
        "shaderCount": len(shaders),
        "textureCount": len(textures),
        "unresolvedTextures": unresolved_textures,
        "meshes": sorted(meshes, key=lambda mesh: mesh["points"], reverse=True),
        "materials": materials,
        "textures": textures,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", nargs="?", default="asset-review/3d-candidates/baseline/usdz-baseline.json")
    args = parser.parse_args()
    reports = [inspect_usdz(path) for path in ASSETS]
    output = (ROOT / args.output).resolve()
    output.write_text(json.dumps({"reports": reports}, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
