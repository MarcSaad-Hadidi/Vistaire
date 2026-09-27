import importlib.util
import json
import os
import shutil
import sys
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/owner/pipeline-console/usdz_variants.py"
spec = importlib.util.spec_from_file_location("usdz_variants", SCRIPT)
variants = importlib.util.module_from_spec(spec)
spec.loader.exec_module(variants)


class VariantsTests(unittest.TestCase):
    def test_configured_blender_command_is_resolved_on_path(self):
        with tempfile.TemporaryDirectory() as temp:
            executable = Path(temp) / ("blender-custom.exe" if os.name == "nt" else "blender-custom")
            shutil.copy2(sys.executable, executable)
            with patch.dict(os.environ, {"BLENDER_BIN": executable.stem if os.name == "nt" else executable.name, "PATH": temp}):
                self.assertEqual(Path(variants.trouver_blender()), executable)

    def test_package_keeps_export_root_first_and_aligns_every_entry(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            files = root / "files"
            files.mkdir()
            (files / "a.usda").write_text("#usda 1.0")
            (files / "model.usd").write_text("#usda 1.0")
            output = root / "result.usdz"
            variants._package_usdz(str(files), str(output))
            with zipfile.ZipFile(output) as archive, output.open("rb") as raw:
                self.assertEqual(archive.namelist()[0], "model.usd")
                self.assertIsNone(archive.testzip())
                for entry in archive.infolist():
                    raw.seek(entry.header_offset + 26)
                    name_bytes, extra_bytes = struct.unpack("<HH", raw.read(4))
                    self.assertEqual((entry.header_offset + 30 + name_bytes + extra_bytes) % 64, 0)
                    self.assertEqual(entry.compress_type, zipfile.ZIP_STORED)
            (files / "model.usd").unlink()
            with self.assertRaisesRegex(RuntimeError, "model.usd"):
                variants._package_usdz(str(files), str(output))


    def test_byte_budget_uses_actual_sizes_and_cleans_the_whole_batch(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "dish.usdz"
            source.write_bytes(b"source")
            output = root / "output"
            output.mkdir()
            def generate(_blender, _script, _source, destination, ratio, _kind):
                with open(destination, "wb") as f:
                    f.truncate(16 * 1024 * 1024 + 1 if ratio == 0.25 else 7)
                return 1  # The budget must use the actual file size.
            with patch.object(variants, "trouver_blender", return_value="blender"), patch.object(variants, "generer_une_variante", side_effect=generate), patch.dict(os.environ, {"VISTAIRE_USDZ_VARIANTS_TARGET_BYTES": ""}):
                variants.generate_variants(str(source), str(output), [0.5])
                manifest = json.loads((output / "manifest.json").read_text())
                self.assertEqual(manifest["variantes"]["0.5"]["octets"], 7)
                with self.assertRaisesRegex(RuntimeError, "budget.*16777216"):
                    variants.generate_variants(str(source), str(output), [0.5, 0.25])
                self.assertEqual(list(output.iterdir()), [])
                with patch.dict(os.environ, {"VISTAIRE_USDZ_VARIANTS_TARGET_BYTES": "6"}):
                    with self.assertRaisesRegex(RuntimeError, "budget.*limite 6"):
                        variants.generate_variants(str(source), str(output), [0.5])
                self.assertEqual(list(output.iterdir()), [])
                self.assertEqual(source.read_bytes(), b"source")

    def test_failed_batch_removes_stale_outputs_and_rejects_invalid_ratios(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "dish.usdz"
            source.write_bytes(b"source")
            output = root / "output"
            output.mkdir()
            for name in ["dish_r50.usdz", "dish_r25.usdz", "manifest.json"]:
                (output / name).write_text("stale")
            def generate(_blender, _script, _source, destination, ratio, _kind):
                if ratio == 0.25:
                    raise RuntimeError("failed candidate")
                Path(destination).write_bytes(b"runtime")
                return 7
            with patch.object(variants, "trouver_blender", return_value="blender"), patch.object(variants, "generer_une_variante", side_effect=generate):
                with self.assertRaisesRegex(RuntimeError, "failed candidate"):
                    variants.generate_variants(str(source), str(output), [0.5, 0.25])
            self.assertEqual(list(output.iterdir()), [])
            self.assertEqual(source.read_bytes(), b"source")
            for ratios in [[], [float("nan")], [float("inf")], [0], [1], [0.5, 0.501]]:
                with self.assertRaises(ValueError):
                    variants.generate_variants(str(source), str(output), ratios)


if __name__ == "__main__":
    unittest.main()
