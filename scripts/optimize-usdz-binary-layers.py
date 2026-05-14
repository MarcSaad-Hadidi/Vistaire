#!/usr/bin/env python3
"""Create a USDZ candidate with USDA layers converted to binary USDC layers.

This keeps authored scene data, textures, transforms, and materials intact. It
uses Pixar USD APIs for extraction and packaging so the result is a real USDZ
package, not a manually zipped archive.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import tempfile
import zipfile
from pathlib import Path

from pxr import Sdf, Usd, UsdUtils

REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = REPO_ROOT / "public"
USDZ_CANDIDATE_ROOT = REPO_ROOT / "asset-review" / "3d-candidates"


def mib(size: int) -> float:
    return round(size / (1024 * 1024), 2)


def is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def validate_candidate_output(output: Path) -> None:
    if is_relative_to(output, PUBLIC_ROOT):
        raise ValueError(f"Refusing to write USDZ candidate under public: {output}")
    if not is_relative_to(output, USDZ_CANDIDATE_ROOT):
        raise ValueError(
            "Refusing to write USDZ candidate outside asset-review/3d-candidates: "
            f"{output}"
        )


def package_entries(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        return archive.namelist()


def rewrite_layer_references(text: str, mapping: dict[str, str]) -> str:
    updated = text
    for old_rel, new_rel in sorted(mapping.items(), key=lambda item: len(item[0]), reverse=True):
        updated = updated.replace(old_rel, new_rel)
        updated = updated.replace(f"./{old_rel}", f"./{new_rel}")
    return updated


def rewrite_texture_references(text: str) -> str:
    return re.sub(r"@(?:\./)?textures/([^@]+)@", r"@0/\1@", text)


def copy_package_textures(root: Path) -> list[str]:
    source_dir = root / "textures"
    if not source_dir.exists():
        return []

    copied: list[str] = []
    package_dir = root / "0"
    package_dir.mkdir(parents=True, exist_ok=True)
    for source in sorted(path for path in source_dir.iterdir() if path.is_file()):
        target = package_dir / source.name
        shutil.copy2(source, target)
        copied.append(target.relative_to(root).as_posix())
    return copied


def convert_layer(source: Path, target: Path) -> None:
    layer = Sdf.Layer.FindOrOpen(str(source))
    if layer is None:
        raise RuntimeError(f"Unable to open USD layer: {source}")
    if not layer.Export(str(target)):
        raise RuntimeError(f"Unable to export binary USD layer: {target}")


def export_layer_text(layer_path: Path) -> str:
    layer = Sdf.Layer.FindOrOpen(str(layer_path))
    if layer is None:
        raise RuntimeError(f"Unable to open USD layer: {layer_path}")
    return layer.ExportToString()


def ensure_rewritten_asset_paths_exist(root: Path, layer_path: Path) -> list[str]:
    """OpenUSD may rewrite package-local texture paths while exporting USDC.

    Babylon exports textures under `textures/`, while OpenUSD can rewrite those
    asset paths to package-local folders like `0/`. Ensure the rewritten paths
    exist before creating the USDZ package, otherwise CreateNewUsdzPackage emits
    missing texture warnings even though the final package can sometimes recover.
    """

    text = export_layer_text(layer_path)
    asset_paths = sorted(set(re.findall(r"@([^@]+\.(?:jpe?g|png|webp))@", text, re.IGNORECASE)))
    copied: list[str] = []
    for asset_path in asset_paths:
        target = root / asset_path
        if target.exists():
            continue
        matches = [path for path in root.rglob(Path(asset_path).name) if path.is_file()]
        if not matches:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(matches[0], target)
        copied.append(asset_path)
    return copied


def optimize(source: Path, output: Path) -> dict[str, object]:
    source = source.resolve()
    output = output.resolve()
    if source == output:
        raise ValueError("Refusing in-place optimization; write a candidate first, then promote it after validation.")
    validate_candidate_output(output)
    entries_before = package_entries(source)
    if not entries_before:
        raise RuntimeError(f"USDZ package is empty: {source}")

    root_entry = entries_before[0]
    before_bytes = source.stat().st_size

    with tempfile.TemporaryDirectory(prefix="usdz-binary-") as temp_name:
        extracted = Path(temp_name) / "extracted"
        extracted.mkdir(parents=True, exist_ok=True)

        if not UsdUtils.ExtractUsdzPackage(str(source), str(extracted), True, False, True):
            raise RuntimeError(f"Unable to extract USDZ package: {source}")

        usda_layers = sorted(extracted.rglob("*.usda"))
        mapping: dict[str, str] = {}
        for layer_path in usda_layers:
            old_rel = layer_path.relative_to(extracted).as_posix()
            mapping[old_rel] = old_rel[:-5] + ".usdc"

        for layer_path in usda_layers:
            original = layer_path.read_text(encoding="utf-8")
            rewritten = rewrite_layer_references(original, mapping)
            rewritten = rewrite_texture_references(rewritten)
            if rewritten != original:
                layer_path.write_text(rewritten, encoding="utf-8")

        copied_package_textures = copy_package_textures(extracted)

        converted_layers: list[str] = []
        for layer_path in usda_layers:
            rel = layer_path.relative_to(extracted).as_posix()
            target = extracted / mapping[rel]
            convert_layer(layer_path, target)
            converted_layers.append(target.relative_to(extracted).as_posix())
            layer_path.unlink()

        root_binary_rel = mapping.get(root_entry, root_entry)
        root_binary_path = extracted / root_binary_rel
        if not root_binary_path.exists():
            raise RuntimeError(f"Converted root layer is missing: {root_binary_path}")

        copied_assets = ensure_rewritten_asset_paths_exist(extracted, root_binary_path)

        local_stage = Usd.Stage.Open(str(root_binary_path))
        if local_stage is None:
            raise RuntimeError(f"Converted local stage does not open: {root_binary_path}")

        output.parent.mkdir(parents=True, exist_ok=True)
        if output.exists():
            output.unlink()
        if not UsdUtils.CreateNewUsdzPackage(str(root_binary_path), str(output)):
            raise RuntimeError(f"Unable to create USDZ package: {output}")

    packaged_stage = Usd.Stage.Open(str(output))
    if packaged_stage is None:
        raise RuntimeError(f"Packaged USDZ does not open: {output}")

    entries_after = package_entries(output)
    after_bytes = output.stat().st_size
    return {
        "source": str(source),
        "output": str(output),
        "beforeBytes": before_bytes,
        "afterBytes": after_bytes,
        "beforeMiB": mib(before_bytes),
        "afterMiB": mib(after_bytes),
        "reductionPercent": round((1 - after_bytes / before_bytes) * 100, 2),
        "rootBefore": root_entry,
        "rootAfter": entries_after[0] if entries_after else None,
        "entriesBefore": entries_before,
        "entriesAfter": entries_after,
        "convertedLayers": converted_layers,
        "copiedPackageTextures": copied_package_textures,
        "copiedRewrittenAssets": copied_assets,
        "stageDefaultPrim": str(packaged_stage.GetDefaultPrim().GetPath()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    summary = optimize(args.source, args.output)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
