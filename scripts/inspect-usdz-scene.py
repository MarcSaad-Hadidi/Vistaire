#!/usr/bin/env python3
"""Inspect a USDZ scene with OpenUSD and return validation stats as JSON."""

from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath

from pxr import Usd, UsdGeom, UsdShade


def rounded(values) -> list[float]:
    return [round(value, 6) for value in values]


def range_summary(bounds) -> dict[str, list[float]]:
    minimum = bounds.GetMin()
    maximum = bounds.GetMax()
    return {
        "min": rounded(minimum),
        "max": rounded(maximum),
        "size": rounded(maximum - minimum),
    }


def inspect_scene(path: Path) -> dict[str, object]:
    stage = Usd.Stage.Open(str(path))
    if stage is None:
        raise RuntimeError(f"Unable to open USDZ stage: {path}")

    default_prim = stage.GetDefaultPrim()
    if not default_prim:
        raise RuntimeError(f"USDZ stage has no default prim: {path}")

    bbox_cache = UsdGeom.BBoxCache(
        Usd.TimeCode.Default(),
        [UsdGeom.Tokens.default_, UsdGeom.Tokens.render, UsdGeom.Tokens.proxy],
        useExtentsHint=True,
    )

    meshes: list[dict[str, object]] = []
    materials: list[str] = []
    shaders: list[str] = []
    textures: list[dict[str, object]] = []
    unresolved_textures: list[str] = []

    for prim in stage.Traverse():
        if prim.IsA(UsdGeom.Mesh):
            mesh = UsdGeom.Mesh(prim)
            points = mesh.GetPointsAttr().Get() or []
            face_counts = mesh.GetFaceVertexCountsAttr().Get() or []
            face_indices = mesh.GetFaceVertexIndicesAttr().Get() or []
            mesh_bounds = bbox_cache.ComputeWorldBound(prim).ComputeAlignedRange()
            bound_material, _ = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()
            meshes.append(
                {
                    "path": str(prim.GetPath()),
                    "points": len(points),
                    "faces": len(face_counts),
                    "faceVertexIndices": len(face_indices),
                    "bounds": range_summary(mesh_bounds),
                    "boundMaterial": str(bound_material.GetPath()) if bound_material else None,
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
                texture = {
                    "file": PurePosixPath(asset_path).name if asset_path else None,
                    "path": asset_path,
                    "resolved": bool(resolved_path),
                }
                textures.append(texture)
                if not resolved_path:
                    unresolved_textures.append(asset_path or str(prim.GetPath()))

    scene_bounds = bbox_cache.ComputeWorldBound(default_prim).ComputeAlignedRange()
    source_plate_meshes = [
        mesh
        for mesh in meshes
        if 1000 < mesh["points"] < 10_000
        and mesh["bounds"]["size"][0] > 0.12
        and mesh["bounds"]["size"][2] > 0.12
    ]

    return {
        "defaultPrim": str(default_prim.GetPath()),
        "primCount": sum(1 for _ in stage.Traverse()),
        "meshCount": len(meshes),
        "meshes": meshes,
        "meshMaterialBindingCount": len([mesh for mesh in meshes if mesh["boundMaterial"]]),
        "sourcePlateMeshCount": len(source_plate_meshes),
        "materialCount": len(materials),
        "shaderCount": len(shaders),
        "textureCount": len(textures),
        "unresolvedTextures": unresolved_textures,
        "bounds": range_summary(scene_bounds),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("usdz", type=Path)
    args = parser.parse_args()
    print(json.dumps(inspect_scene(args.usdz), indent=2))


if __name__ == "__main__":
    main()
