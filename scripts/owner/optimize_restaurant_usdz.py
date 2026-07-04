#!/usr/bin/env python3
"""Vistaire transient USDZ runtime optimizer.

Input:  a local temp path to a heavy USDZ *source* (master).
Output: a local temp path to an optimized USDZ *runtime*, plus a JSON report.

Design constraints (P0):
- This worker NEVER uploads anything. It only reads the source and writes the
  runtime + report to caller-provided temp paths.
- It refuses to write into `public/` or a repo-tracked tree.
- It cleans its own extraction workspace in a `finally` block.
- Geometry decimation is NOT faked: it is reported as "skipped" with a reason,
  because reliable USD mesh decimation is not implemented here.

It uses Pixar OpenUSD (`pxr`) for extraction/packaging and Pillow for texture
re-encoding. Data maps (normal / roughness / metallic / occlusion) are resized
but never recolored or lossily flattened into sRGB, to avoid the plastic look.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

try:
    from pxr import Sdf, Usd, UsdGeom, UsdShade, UsdUtils  # type: ignore
except Exception as exc:  # pragma: no cover - environment guard
    print(
        json.dumps(
            {
                "ok": False,
                "error": f"OpenUSD (pxr) indisponible: {exc}",
                "stage": "import-pxr",
            }
        ),
        file=sys.stderr,
    )
    sys.exit(3)

try:
    from PIL import Image  # type: ignore
except Exception as exc:  # pragma: no cover - environment guard
    print(
        json.dumps(
            {"ok": False, "error": f"Pillow (PIL) indisponible: {exc}", "stage": "import-pil"}
        ),
        file=sys.stderr,
    )
    sys.exit(3)


PROFILES: dict[str, dict[str, float | int]] = {
    "premium": {
        "baseColorMax": 2048,
        "normalMax": 1536,
        "ormMax": 1536,
        "jpegQuality": 90,
        "targetTriangles": 300_000,
        "decimateRatio": 0.78,
        "mergeDistance": 0.00003,
    },
    "balanced": {
        "baseColorMax": 1536,
        "normalMax": 1280,
        "ormMax": 1024,
        "jpegQuality": 88,
        "targetTriangles": 180_000,
        "decimateRatio": 0.66,
        "mergeDistance": 0.00005,
    },
    "light": {
        "baseColorMax": 1024,
        "normalMax": 1024,
        "ormMax": 1024,
        "jpegQuality": 84,
        "targetTriangles": 100_000,
        "decimateRatio": 0.5,
        "mergeDistance": 0.00008,
    },
    "emergency": {
        "baseColorMax": 768,
        "normalMax": 768,
        "ormMax": 768,
        "jpegQuality": 76,
        "targetTriangles": 70_000,
        "decimateRatio": 0.38,
        "mergeDistance": 0.00010,
    },
}

DISH_PHYSICAL_SCALE_TARGETS = {
    "burger": {"dimension": "height", "targetMeters": 0.15, "minMeters": 0.10, "maxMeters": 0.22},
    "pizza": {"dimension": "footprint", "targetMeters": 0.32, "minMeters": 0.22, "maxMeters": 0.40},
    "plate": {"dimension": "footprint", "targetMeters": 0.26, "minMeters": 0.18, "maxMeters": 0.34},
    "bowl": {"dimension": "footprint", "targetMeters": 0.18, "minMeters": 0.12, "maxMeters": 0.25},
    "dessert": {"dimension": "footprint", "targetMeters": 0.12, "minMeters": 0.08, "maxMeters": 0.18},
    "drink": {"dimension": "height", "targetMeters": 0.18, "minMeters": 0.12, "maxMeters": 0.25},
    "platter": {"dimension": "footprint", "targetMeters": 0.32, "minMeters": 0.22, "maxMeters": 0.45},
    "fallback": {"dimension": "footprint", "targetMeters": 0.20, "minMeters": 0.10, "maxMeters": 0.35},
}

DATA_ROLES = {"normal", "roughness", "metallic", "occlusion"}
TEXTURE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
USD_LAYER_SUFFIXES = (".usd", ".usdc", ".usda")


@dataclass
class TextureInfo:
    path: Path
    role: str = "unknown"
    original_bytes: int = 0
    original_size: tuple[int, int] | None = None
    final_bytes: int = 0
    final_size: tuple[int, int] | None = None
    changed: bool = False
    final_path: Path | None = None


@dataclass
class Report:
    profile: str
    source_bytes: int
    runtime_bytes: int = 0
    geometry_optimization: str = "skipped"
    geometry_optimization_reason: str = (
        "Blender geometry pass was not required or not available; geometry is preserved."
    )
    blender_version: str | None = None
    triangle_count_before: int = 0
    triangle_count_after: int = 0
    geometry_reduction_percent: float = 0.0
    target_triangles: int = 0
    removed_objects: list[str] = field(default_factory=list)
    optimized_objects: list[dict] = field(default_factory=list)
    physical_scale: dict = field(default_factory=dict)
    layer_optimization: str = "skipped"
    root_layer_entry: str = ""
    internal_files: list[dict] = field(default_factory=list)
    largest_entries: list[dict] = field(default_factory=list)
    texture_bytes_before: int = 0
    texture_bytes_after: int = 0
    estimated_geometry_bytes: int = 0
    textures: list[dict] = field(default_factory=list)
    texture_count: int = 0
    material_count: int = 0
    changed_textures: int = 0
    optimization_applied: bool = False
    source_stored: bool = False
    cleanup: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    fails: list[str] = field(default_factory=list)


def fail(report: Report | None, message: str, stage: str) -> None:
    payload = {"ok": False, "error": message, "stage": stage}
    if report is not None:
        payload["report"] = report_to_dict(report)
    print(json.dumps(payload), file=sys.stderr)
    sys.exit(2)


def report_to_dict(report: Report) -> dict:
    return {
        "profile": report.profile,
        "sourceBytes": report.source_bytes,
        "runtimeBytes": report.runtime_bytes,
        "reductionPercent": (
            round((1 - report.runtime_bytes / report.source_bytes) * 100, 2)
            if report.source_bytes and report.runtime_bytes
            else 0.0
        ),
        "geometryOptimization": report.geometry_optimization,
        "geometryOptimizationReason": report.geometry_optimization_reason,
        "blenderVersion": report.blender_version,
        "triangleCountBefore": report.triangle_count_before,
        "triangleCountAfter": report.triangle_count_after,
        "geometryReductionPercent": report.geometry_reduction_percent,
        "targetTriangles": report.target_triangles,
        "removedObjects": report.removed_objects,
        "optimizedObjects": report.optimized_objects,
        "physicalScale": report.physical_scale,
        "layerOptimization": report.layer_optimization,
        "rootLayerEntry": report.root_layer_entry,
        "internalFiles": report.internal_files,
        "largestEntries": report.largest_entries,
        "textureBytesBefore": report.texture_bytes_before,
        "textureBytesAfter": report.texture_bytes_after,
        "estimatedGeometryBytes": report.estimated_geometry_bytes,
        "textureCount": report.texture_count,
        "materialCount": report.material_count,
        "changedTextures": report.changed_textures,
        "optimizationApplied": report.optimization_applied,
        "textures": report.textures,
        "sourceStored": report.source_stored,
        "cleanup": report.cleanup,
        "warnings": report.warnings,
        "fails": report.fails,
    }


def guard_output_path(output: Path) -> None:
    resolved = output.resolve()
    parts = {part.lower() for part in resolved.parts}
    if "public" in parts and "models" in parts:
        raise ValueError(f"Refus d'ecrire un runtime USDZ sous public/models: {resolved}")
    if ".git" in parts:
        raise ValueError(f"Refus d'ecrire un runtime USDZ dans un arbre git: {resolved}")


def env_int(name: str, fallback: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return fallback
    try:
        parsed = int(raw)
    except ValueError:
        return fallback
    return parsed if parsed > 0 else fallback


def apply_profile_env_overrides(profile_slug: str, profile: dict[str, float | int]) -> dict[str, float | int]:
    prefix = f"VISTAIRE_USDZ_{profile_slug.upper()}"
    return {
        **profile,
        "targetTriangles": env_int(
            f"{prefix}_TARGET_TRIANGLES", int(profile["targetTriangles"])
        ),
    }


def analyze_archive_entries(source: Path, archive_names: list[str]) -> tuple[list[dict], list[dict], int]:
    entries: list[dict] = []
    texture_bytes = 0
    with zipfile.ZipFile(source) as archive:
        info_by_name = {entry.filename: entry for entry in archive.infolist()}
    for name in archive_names:
        if name.endswith("/"):
            continue
        info = info_by_name.get(name)
        if info is None:
            continue
        suffix = PurePosixPath(name).suffix.lower()
        size = int(info.file_size)
        if suffix in TEXTURE_SUFFIXES:
            texture_bytes += size
        entries.append({"path": name, "bytes": size, "suffix": suffix})
    largest = sorted(entries, key=lambda item: int(item["bytes"]), reverse=True)[:12]
    return entries, largest, texture_bytes


def mesh_triangle_count(mesh: UsdGeom.Mesh) -> int:
    counts = mesh.GetFaceVertexCountsAttr().Get() or []
    total = 0
    for count in counts:
        if count >= 3:
            total += max(1, int(count) - 2)
    return total


def count_stage_triangles(stage: Usd.Stage) -> int:
    total = 0
    for prim in stage.Traverse():
        if prim.IsA(UsdGeom.Mesh):
            total += mesh_triangle_count(UsdGeom.Mesh(prim))
    return total


def resolve_blender() -> str | None:
    configured = os.environ.get("VISTAIRE_USDZ_BLENDER")
    if configured:
        return configured
    return shutil.which("blender")


def ensure_path_under_extracted(path: Path, extracted: Path, label: str) -> None:
    try:
        path.resolve().relative_to(extracted.resolve())
    except ValueError as exc:
        raise RuntimeError(f"{label} hors du package extrait: {path}") from exc


def unresolved_asset_dependencies(root_layer: Path) -> list[str]:
    try:
        _, _, unresolved = UsdUtils.ComputeAllDependencies(str(root_layer))
    except Exception as exc:
        return [f"validation dependencies impossible: {exc}"]
    return [str(item) for item in unresolved]


def validate_packaging_root(root_layer: Path, extracted: Path) -> list[str]:
    ensure_path_under_extracted(root_layer, extracted, "Root USDZ runtime")
    return unresolved_asset_dependencies(root_layer)


def run_blender_geometry_pass(
    root_layer: Path,
    extracted: Path,
    workspace: Path,
    profile: dict[str, float | int],
    report: Report,
    dish_kind: str,
) -> Path:
    blender = resolve_blender()
    if not blender:
        report.geometry_optimization = "skipped"
        report.geometry_optimization_reason = "Blender indisponible; geometryOptimization ne peut pas etre done."
        report.warnings.append("Blender headless indisponible; geometrie conservee.")
        target = DISH_PHYSICAL_SCALE_TARGETS[dish_kind]
        report.physical_scale = {
            "status": "failed",
            "dishKind": dish_kind,
            "dimension": target["dimension"],
            "targetMeters": target["targetMeters"],
            "minMeters": target["minMeters"],
            "maxMeters": target["maxMeters"],
            "heightBeforeMeters": 0,
            "widthBeforeMeters": 0,
            "depthBeforeMeters": 0,
            "footprintBeforeMeters": 0,
            "heightAfterMeters": 0,
            "widthAfterMeters": 0,
            "depthAfterMeters": 0,
            "footprintAfterMeters": 0,
            "scaleFactor": 1.0,
            "centeredX": False,
            "centeredY": False,
            "grounded": False,
            "centerOffsetBeforeMeters": 0,
            "centerOffsetAfterMeters": 0,
            "warnings": ["Blender unavailable; physical scale could not be measured."],
        }
        report.fails.append("Echelle physique invalide: Blender indisponible pour normaliser le modele AR.")
        return root_layer

    script = Path(__file__).with_name("blender_usdz_geometry_optimizer.py")
    optimized_root = root_layer.parent / "__vistaire_geometry_optimized.usdc"
    metrics_path = workspace / "geometry-metrics.json"
    command = [
        blender,
        "--background",
        "--python",
        str(script),
        "--",
        "--input",
        str(root_layer),
        "--output",
        str(optimized_root),
        "--metrics",
        str(metrics_path),
        "--target-triangles",
        str(int(profile["targetTriangles"])),
        "--decimate-ratio",
        str(float(profile["decimateRatio"])),
        "--merge-distance",
        str(float(profile["mergeDistance"])),
        "--dish-kind",
        dish_kind,
    ]
    try:
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=env_int("VISTAIRE_USDZ_BLENDER_TIMEOUT_SECONDS", 240),
        )
    except Exception as exc:
        report.geometry_optimization = "failed"
        report.geometry_optimization_reason = f"Blender geometry pass impossible: {exc}"
        report.warnings.append(report.geometry_optimization_reason)
        report.physical_scale = {"status": "failed", "dishKind": dish_kind}
        report.fails.append(f"Echelle physique invalide: Blender impossible ({exc}).")
        return root_layer

    if completed.returncode != 0 or not optimized_root.exists() or not metrics_path.exists():
        detail = (completed.stderr or completed.stdout or "").strip().splitlines()[-3:]
        report.geometry_optimization = "failed"
        report.geometry_optimization_reason = "Blender geometry pass echoue."
        if detail:
            report.warnings.append("Blender geometry pass echoue: " + " / ".join(detail))
        else:
            report.warnings.append("Blender geometry pass echoue sans detail.")
        report.physical_scale = {"status": "failed", "dishKind": dish_kind}
        report.fails.append("Echelle physique invalide: Blender n'a pas produit de metriques exploitables.")
        return root_layer

    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
    report.physical_scale = dict(metrics.get("physicalScale") or {"status": "failed", "dishKind": dish_kind})
    if report.physical_scale.get("status") == "failed":
        report.fails.append("Echelle physique invalide apres normalisation Blender.")
    before = int(metrics.get("trianglesBefore", report.triangle_count_before) or 0)
    after = int(metrics.get("trianglesAfter", before) or 0)
    scale_changed = report.physical_scale.get("status") == "normalized"
    use_optimized_root = scale_changed
    if before > 0 and after > 0 and after < before:
        try:
            ensure_path_under_extracted(optimized_root, extracted, "Root USDZ optimise")
        except RuntimeError as exc:
            report.geometry_optimization = "failed"
            report.geometry_optimization_reason = str(exc)
            report.warnings.append(report.geometry_optimization_reason)
            return root_layer
        report.geometry_optimization = "done"
        report.geometry_optimization_reason = "Blender headless decimation/cleanup applied."
        report.triangle_count_before = before
        report.triangle_count_after = after
        report.geometry_reduction_percent = round((1 - after / before) * 100, 2)
        report.blender_version = metrics.get("blenderVersion")
        report.removed_objects = list(metrics.get("removedObjects") or [])
        report.optimized_objects = list(metrics.get("optimizedObjects") or [])
        use_optimized_root = True
    else:
        report.geometry_optimization = "skipped"
        report.geometry_optimization_reason = "Blender ran but did not reduce triangle count."
        report.warnings.append(report.geometry_optimization_reason)

    if use_optimized_root:
        try:
            ensure_path_under_extracted(optimized_root, extracted, "Root USDZ optimise")
        except RuntimeError as exc:
            report.geometry_optimization = "failed"
            report.geometry_optimization_reason = str(exc)
            report.warnings.append(report.geometry_optimization_reason)
            return root_layer
        return optimized_root

    return root_layer


def relative_asset_path(path: Path, extracted: Path) -> str:
    return path.resolve().relative_to(extracted.resolve()).as_posix()


def classify_textures(stage: Usd.Stage, extracted: Path) -> dict[str, str]:
    """Map texture file basename -> role, via UsdPreviewSurface bindings."""
    roles: dict[str, str] = {}
    input_role = {
        "diffuseColor": "baseColor",
        "baseColor": "baseColor",
        "emissiveColor": "emissive",
        "normal": "normal",
        "roughness": "roughness",
        "metallic": "metallic",
        "occlusion": "occlusion",
    }
    for prim in stage.Traverse():
        shader = UsdShade.Shader(prim)
        if not shader:
            continue
        shader_id = shader.GetShaderId() if hasattr(shader, "GetShaderId") else ""
        if shader_id and shader_id != "UsdPreviewSurface":
            continue
        for input_name, role in input_role.items():
            surf_input = shader.GetInput(input_name)
            if not surf_input:
                continue
            source = surf_input.GetConnectedSources()
            connections = source[0] if source else []
            for connection in connections:
                tex_shader = UsdShade.Shader(connection.source.GetPrim())
                if not tex_shader:
                    continue
                file_input = tex_shader.GetInput("file")
                if not file_input:
                    continue
                asset = file_input.Get()
                if asset is None:
                    continue
                asset_path = getattr(asset, "path", str(asset))
                name = Path(str(asset_path)).name
                if name:
                    roles[name] = role
    return roles


def rewrite_texture_asset_references(
    stage: Usd.Stage, replacements: dict[str, str]
) -> None:
    if not replacements:
        return
    by_name = {PurePosixPath(old).name: new for old, new in replacements.items()}
    for prim in stage.Traverse():
        shader = UsdShade.Shader(prim)
        if not shader:
            continue
        file_input = shader.GetInput("file")
        if not file_input:
            continue
        asset = file_input.Get()
        if asset is None:
            continue
        raw = getattr(asset, "path", str(asset))
        replacement = replacements.get(str(raw)) or by_name.get(PurePosixPath(str(raw)).name)
        if replacement:
            file_input.Set(Sdf.AssetPath(replacement))


def resize_texture(info: TextureInfo, profile: dict[str, float | int], extracted: Path) -> None:
    suffix = info.path.suffix.lower()
    if suffix not in TEXTURE_SUFFIXES:
        return
    try:
        with Image.open(info.path) as image:
            image.load()
            info.original_size = image.size
            if info.role == "baseColor" or info.role == "emissive":
                max_dim = int(profile["baseColorMax"])
            elif info.role == "normal":
                max_dim = int(profile["normalMax"])
            elif info.role in DATA_ROLES:
                max_dim = int(profile["ormMax"])
            else:
                max_dim = int(profile["baseColorMax"])

            width, height = image.size
            needs_resize = max(width, height) > max_dim
            working = image
            if needs_resize:
                scale = max_dim / float(max(width, height))
                new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
                working = image.resize(new_size, Image.LANCZOS)

            should_convert_to_jpeg = info.role in {"baseColor", "emissive"} and suffix not in (
                ".jpg",
                ".jpeg",
            )
            if not needs_resize and not should_convert_to_jpeg:
                # Leave untouched to avoid recompressing data maps and shifting values.
                info.final_size = image.size
                info.final_bytes = info.original_bytes
                return

            is_data_map = info.role in DATA_ROLES
            output_path = info.path
            if should_convert_to_jpeg:
                output_path = info.path.with_suffix(".jpg")
            if output_path.suffix.lower() in (".jpg", ".jpeg") and not is_data_map:
                rgb = working.convert("RGB")
                rgb.save(output_path, format="JPEG", quality=int(profile["jpegQuality"]), optimize=True)
            elif suffix in (".jpg", ".jpeg") and is_data_map:
                # High quality to preserve linear data values.
                working.convert("RGB").save(output_path, format="JPEG", quality=96, optimize=True)
            elif output_path.suffix.lower() == ".png":
                working.save(output_path, format="PNG", optimize=True)
            elif suffix == ".webp":
                png_path = info.path.with_suffix(".png")
                working.save(png_path, format="PNG", optimize=True)
                output_path = png_path
            info.final_size = working.size
            info.final_path = output_path if output_path != info.path else None
            info.final_bytes = output_path.stat().st_size
            info.changed = True
    except Exception as exc:  # pragma: no cover - defensive
        info.final_size = info.original_size
        info.final_bytes = info.original_bytes
        raise RuntimeError(f"Echec traitement texture {info.path.name}: {exc}") from exc


def inspect_materials(stage: Usd.Stage, report: Report) -> None:
    material_count = 0
    saw_normal = False
    saw_roughness = False
    saw_metallic = False
    saw_occlusion = False
    for prim in stage.Traverse():
        if UsdShade.Material(prim):
            material_count += 1
        shader = UsdShade.Shader(prim)
        if not shader:
            continue
        shader_id = shader.GetShaderId() if hasattr(shader, "GetShaderId") else ""
        if shader_id and shader_id != "UsdPreviewSurface":
            continue
        normal_input = shader.GetInput("normal")
        if normal_input and (normal_input.HasConnectedSource() or normal_input.Get() is not None):
            saw_normal = True
        metallic_input = shader.GetInput("metallic")
        if metallic_input:
            value = metallic_input.Get()
            if metallic_input.HasConnectedSource():
                saw_metallic = True
            elif isinstance(value, (int, float)):
                saw_metallic = True
                if value is not None and float(value) > 0.2:
                    report.warnings.append(
                        f"metallic constant {float(value):.2f} eleve pour un aliment (rendu plastique probable)."
                    )
        roughness_input = shader.GetInput("roughness")
        if roughness_input:
            value = roughness_input.Get()
            if roughness_input.HasConnectedSource():
                saw_roughness = True
            elif isinstance(value, (int, float)):
                saw_roughness = True
                if value is not None and float(value) < 0.3:
                    report.warnings.append(
                        f"roughness constant {float(value):.2f} faible (rendu glossy probable)."
                    )
        occlusion_input = shader.GetInput("occlusion")
        if occlusion_input and (occlusion_input.HasConnectedSource() or occlusion_input.Get() is not None):
            saw_occlusion = True

    report.material_count = material_count
    if not saw_normal:
        report.warnings.append("Aucune normal map detectee.")
    if not saw_roughness:
        report.warnings.append("Aucune roughness detectee.")
    if not saw_metallic:
        report.warnings.append("Aucune metallic detectee.")
    if not saw_occlusion:
        report.warnings.append("Aucune occlusion (AO) detectee.")


def ensure_default_prim(stage: Usd.Stage) -> None:
    if stage.GetDefaultPrim():
        return
    for prim in stage.GetPseudoRoot().GetChildren():
        stage.SetDefaultPrim(prim)
        return


def find_root_layer_entry(archive_names: list[str]) -> PurePosixPath:
    """Return the first USD layer entry in archive order.

    USDZ packages use the first USD/USD[A/C] entry as the package root layer.
    Do not sort candidates: alphabetical order can select a sibling layer that
    is not the authored root.
    """
    for name in archive_names:
        if name.endswith("/"):
            continue
        entry = PurePosixPath(name)
        has_windows_drive = len(name) >= 2 and name[1] == ":" and name[0].isalpha()
        if (
            "\\" in name
            or has_windows_drive
            or entry.is_absolute()
            or any(part == ".." for part in entry.parts)
        ):
            raise RuntimeError(f"Chemin de couche USD dangereux dans le package: {name}")
        if entry.suffix.lower() in USD_LAYER_SUFFIXES:
            return entry
    raise RuntimeError("Aucune couche USD trouvee dans le package extrait.")


def find_root_layer(extracted: Path, archive_entry: PurePosixPath) -> Path:
    root = extracted.resolve()
    candidate = (root / Path(*archive_entry.parts)).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise RuntimeError(f"Chemin de couche USD dangereux dans le package: {archive_entry}") from exc
    if not candidate.exists():
        raise RuntimeError(
            f"Couche USD root introuvable apres extraction: {archive_entry.as_posix()}"
        )
    return candidate


def optimize(source: Path, output: Path, report_path: Path, profile_slug: str, dish_kind: str) -> None:
    raw_profile = PROFILES.get(profile_slug)
    if raw_profile is None:
        fail(None, f"Profil inconnu: {profile_slug}", "profile")
    profile = apply_profile_env_overrides(profile_slug, raw_profile)
    if dish_kind not in DISH_PHYSICAL_SCALE_TARGETS:
        dish_kind = "fallback"

    source = source.resolve()
    output = output.resolve()
    if source == output:
        fail(None, "Refus d'optimiser en place; source et output identiques.", "paths")
    guard_output_path(output)

    if not source.exists():
        fail(None, f"Source USDZ introuvable: {source}", "source")
    source_bytes = source.stat().st_size
    if source_bytes <= 0:
        fail(None, "Source USDZ vide.", "source")

    report = Report(profile=profile_slug, source_bytes=source_bytes)
    report.target_triangles = int(profile["targetTriangles"])

    try:
        with zipfile.ZipFile(source) as archive:
            archive_names = archive.namelist()
            if not archive_names:
                fail(report, "Package USDZ source vide.", "zip")
            root_layer_entry = find_root_layer_entry(archive_names)
            entries, largest_entries, texture_bytes = analyze_archive_entries(source, archive_names)
    except zipfile.BadZipFile:
        fail(report, "Source n'est pas un package USDZ/ZIP valide.", "zip")
    except RuntimeError as exc:
        fail(report, str(exc), "zip")

    report.root_layer_entry = root_layer_entry.as_posix()
    report.internal_files = entries
    report.largest_entries = largest_entries
    report.texture_bytes_before = texture_bytes
    report.estimated_geometry_bytes = max(0, source_bytes - texture_bytes)

    workspace = Path(tempfile.mkdtemp(prefix="vistaire-usdz-"))
    try:
        extracted = workspace / "extracted"
        extracted.mkdir(parents=True, exist_ok=True)
        if not UsdUtils.ExtractUsdzPackage(str(source), str(extracted), True, False, True):
            fail(report, f"Extraction USDZ impossible: {source}", "extract")

        root_layer = find_root_layer(extracted, root_layer_entry)
        stage = Usd.Stage.Open(str(root_layer))
        if stage is None:
            fail(report, f"Stage USD illisible: {root_layer}", "open")
        ensure_default_prim(stage)
        report.triangle_count_before = count_stage_triangles(stage)
        report.triangle_count_after = report.triangle_count_before

        root_layer = run_blender_geometry_pass(root_layer, extracted, workspace, profile, report, dish_kind)
        if report.physical_scale.get("status") == "failed":
            fail(report, "Echelle physique invalide apres normalisation Blender.", "physical-scale")
        stage = Usd.Stage.Open(str(root_layer))
        if stage is None:
            fail(report, f"Stage USD illisible apres Blender: {root_layer}", "open-blender")
        ensure_default_prim(stage)
        if report.geometry_optimization != "done":
            report.triangle_count_after = count_stage_triangles(stage)

        if report.triangle_count_before <= int(profile["targetTriangles"]) and report.geometry_optimization == "skipped":
            report.geometry_optimization_reason = "Triangle count already within profile target; physical scale pass still ran."

        if (
            report.target_triangles > 0
            and report.triangle_count_after > report.target_triangles
            and report.geometry_optimization != "done"
        ):
            report.fails.append(
                "Triangle budget depasse sans optimisation Blender reussie "
                f"({report.triangle_count_after} > {report.target_triangles})."
            )
        elif report.target_triangles > 0 and report.triangle_count_after > report.target_triangles:
            report.fails.append(
                f"Triangle budget depasse apres optimisation ({report.triangle_count_after} > {report.target_triangles})."
            )

        roles = classify_textures(stage, extracted)
        inspect_materials(stage, report)

        texture_paths = [
            p for p in extracted.rglob("*") if p.suffix.lower() in TEXTURE_SUFFIXES and p.is_file()
        ]
        report.texture_count = len(texture_paths)
        if report.texture_count == 0:
            report.warnings.append("Aucune texture detectee; runtime ~ repack seul.")

        replacements: dict[str, str] = {}
        for tex_path in sorted(texture_paths):
            info = TextureInfo(path=tex_path)
            info.original_bytes = tex_path.stat().st_size
            info.role = roles.get(tex_path.name, "unknown")
            resize_texture(info, profile, extracted)
            if info.changed:
                report.changed_textures += 1
            final_path = info.final_path or tex_path
            if info.final_path:
                replacements[relative_asset_path(tex_path, extracted)] = relative_asset_path(
                    final_path, extracted
                )
                replacements[tex_path.name] = relative_asset_path(final_path, extracted)
            report.textures.append(
                {
                    "name": tex_path.name,
                    "role": info.role,
                    "originalBytes": info.original_bytes,
                    "originalSize": list(info.original_size) if info.original_size else None,
                    "finalBytes": info.final_bytes,
                    "finalSize": list(info.final_size) if info.final_size else None,
                    "finalName": final_path.name,
                    "changed": info.changed,
                }
            )
        rewrite_texture_asset_references(stage, replacements)
        report.texture_bytes_after = sum(
            (info.get("finalBytes") or 0) for info in report.textures
        )

        report.optimization_applied = (
            report.changed_textures > 0
            or report.geometry_optimization == "done"
            or report.physical_scale.get("status") == "normalized"
        )

        # Save the stage (in case default prim was added) and repackage.
        stage.GetRootLayer().Save()
        unresolved_assets = validate_packaging_root(root_layer, extracted)
        if unresolved_assets:
            fail(
                report,
                "References USDZ runtime non resolues avant packaging: "
                + ", ".join(unresolved_assets[:10]),
                "package-dependencies",
            )
        output.parent.mkdir(parents=True, exist_ok=True)
        if output.exists():
            output.unlink()
        if not UsdUtils.CreateNewUsdzPackage(str(root_layer), str(output)):
            fail(report, f"Creation du package USDZ runtime impossible: {output}", "package")

        packaged = Usd.Stage.Open(str(output))
        if packaged is None:
            fail(report, f"Runtime USDZ illisible apres packaging: {output}", "verify")

        report.runtime_bytes = output.stat().st_size
        report.cleanup = {
            "sourceStored": False,
            "extractedWorkspaceRemoved": True,
            "candidateWorkspace": "transient",
            "cleanupMode": "finally",
        }

        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report_to_dict(report), indent=2), encoding="utf-8")
        print(json.dumps({"ok": True, "report": report_to_dict(report)}))
    finally:
        shutil.rmtree(workspace, ignore_errors=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument(
        "--profile", type=str, default="balanced", choices=sorted(PROFILES.keys())
    )
    parser.add_argument(
        "--dish-kind",
        type=str,
        default="fallback",
        choices=sorted(DISH_PHYSICAL_SCALE_TARGETS.keys()),
    )
    args = parser.parse_args()
    optimize(args.source, args.output, args.report, args.profile, args.dish_kind)


if __name__ == "__main__":
    main()
