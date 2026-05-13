#!/usr/bin/env python3
"""Compare scene-level USDZ stats for an original and a candidate package."""

from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath

from pxr import Usd, UsdGeom, UsdShade


def scene_stats(path: Path) -> dict[str, object]:
    stage = Usd.Stage.Open(str(path))
    if stage is None:
        raise RuntimeError(f"Unable to open USDZ stage: {path}")

    bbox_cache = UsdGeom.BBoxCache(
        Usd.TimeCode.Default(),
        [UsdGeom.Tokens.default_, UsdGeom.Tokens.render, UsdGeom.Tokens.proxy],
        useExtentsHint=True,
    )
    bounds = bbox_cache.ComputeWorldBound(stage.GetDefaultPrim()).ComputeAlignedRange()

    meshes: list[dict[str, object]] = []
    materials: list[str] = []
    shaders: list[str] = []
    textures: list[dict[str, object]] = []

    for prim in stage.Traverse():
        if prim.IsA(UsdGeom.Mesh):
            mesh = UsdGeom.Mesh(prim)
            points = mesh.GetPointsAttr().Get() or []
            face_counts = mesh.GetFaceVertexCountsAttr().Get() or []
            face_indices = mesh.GetFaceVertexIndicesAttr().Get() or []
            meshes.append(
                {
                    "path": str(prim.GetPath()),
                    "points": len(points),
                    "faces": len(face_counts),
                    "faceVertexIndices": len(face_indices),
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
                textures.append(
                    {
                        "file": PurePosixPath(asset_path).name if asset_path else None,
                        "resolved": bool(getattr(asset, "resolvedPath", None)),
                    }
                )

    return {
        "defaultPrim": str(stage.GetDefaultPrim().GetPath()),
        "primCount": sum(1 for _ in stage.Traverse()),
        "meshCount": len(meshes),
        "meshes": meshes,
        "materialCount": len(materials),
        "shaderCount": len(shaders),
        "textures": textures,
        "boundsMin": [round(value, 6) for value in bounds.GetMin()],
        "boundsMax": [round(value, 6) for value in bounds.GetMax()],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original", type=Path)
    parser.add_argument("candidate", type=Path)
    args = parser.parse_args()

    original = scene_stats(args.original)
    candidate = scene_stats(args.candidate)
    print(
        json.dumps(
            {
                "same": original == candidate,
                "original": original,
                "candidate": candidate,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
