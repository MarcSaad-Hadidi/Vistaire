#!/usr/bin/env python3
"""
usdz_variants.py — Génère plusieurs variantes optimisées d'un fichier .usdz.

Pour chaque ratio demandé : décimation géométrique via Blender (headless)
+ recompression des textures (PIL), puis repackage en .usdz.

C'est le workflow validé visuellement sur 64 plats (iPhone, ARKit) :
4 variantes par plat -> test visuel -> choix du bon ratio par plat.

Usage CLI :
    python3 usdz_variants.py plat.usdz --out-dir ./variants/
    python3 usdz_variants.py plat.usdz --out-dir ./variants/ --ratios 0.5,0.25,0.15,0.10

Usage comme module :
    from usdz_variants import generate_variants
    resultats = generate_variants("plat.usdz", out_dir="./variants/")
    # -> {"0.5": "./variants/plat_r50.usdz", "0.25": ..., ...}

Prérequis :
    - Blender >= 4.x (binaire `blender` dans le PATH, ou variable d'env BLENDER_BIN)
    - Pillow : pip install pillow
"""

import argparse
import binascii
import datetime
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import zipfile
from PIL import Image

# Ratios par défaut : les 4 options validées (Prod / Doux / Poussé / Max)
RATIOS_DEFAUT = [0.5, 0.25, 0.15, 0.10]

# Réglages textures validés (ne pas changer sans re-QA visuelle)
TEXTURE_MAX_PX = 1024
JPEG_QUALITY = 65

# Script Blender exécuté en headless : import USD, normalisation d'échelle
# physique selon le type de plat, décimation Collapse, export USD.
# Écrit dans un fichier temporaire à chaque appel (module = un seul fichier).
# Table et logique recopiées de scripts/owner/blender_usdz_geometry_optimizer.py
# (DISH_SCALE_TARGETS) : on ne met à l'échelle que si la dimension mesurée
# sort de [minMeters, maxMeters], vers targetMeters ; type inconnu -> "fallback".
_BLENDER_SCRIPT = r'''
import bpy, sys, os, math, mathutils
args = sys.argv[sys.argv.index('--') + 1:]
inp, outdir, ratio, dish_kind = args[0], args[1], float(args[2]), args[3]
TARGETS = {
    "burger": ("height", 0.15, 0.10, 0.22),
    "pizza": ("footprint", 0.32, 0.22, 0.40),
    "plate": ("footprint", 0.26, 0.18, 0.34),
    "bowl": ("footprint", 0.18, 0.12, 0.25),
    "dessert": ("footprint", 0.12, 0.08, 0.18),
    "drink": ("height", 0.18, 0.12, 0.25),
    "platter": ("footprint", 0.32, 0.22, 0.45),
    "fallback": ("footprint", 0.20, 0.10, 0.35),
}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=inp)
def _bounds():
    xs, ys, zs = [], [], []
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        m = o.matrix_world
        for c in o.bound_box:
            w = m @ mathutils.Vector(c)
            xs.append(w.x); ys.append(w.y); zs.append(w.z)
    if not xs:
        return None
    dx, dy, dz = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
    return {"dx": dx, "dy": dy, "dz": dz,
            "footprint": max(dx, dy), "height": dz,
            "cx": (max(xs) + min(xs)) / 2, "cy": (max(ys) + min(ys)) / 2,
            "minZ": min(zs)}
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        mod = obj.modifiers.new(name="DecimateBatch", type='DECIMATE')
        mod.ratio = ratio
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.context.view_layer.update()
# Normalisation : même contrat que blender_usdz_geometry_optimizer.py.
# Mise à l'échelle uniforme dans l'espace monde : pour un objet racine
# (sans parent), monde(v) = loc + R @ (scale * v) ; multiplier loc ET scale
# par s donne exactement s * monde(v), comme Matrix.Scale(s, 4) du pipeline
# canonique (qui, lui, transforme les sommets directement).
kind = dish_kind if dish_kind in TARGETS else "fallback"
dim, target, min_m, max_m = TARGETS[kind]
b = _bounds()
if (not b or not all(math.isfinite(v) for v in b.values()) or b[dim] <= 0
        or not any(o.type == 'MESH' and len(o.data.polygons) > 0 for o in bpy.data.objects)):
    raise RuntimeError("SCALE_VALIDATION_FAILED: empty or invalid mesh bounds")
if b and b[dim] > 0:
    s = target / b[dim] if (b[dim] < min_m or b[dim] > max_m) else 1.0
    roots = [o for o in bpy.data.objects if o.parent is None]
    if s != 1.0:
        for o in roots:
            o.location = (o.location.x * s, o.location.y * s, o.location.z * s)
            o.scale = (o.scale.x * s, o.scale.y * s, o.scale.z * s)
        bpy.context.view_layer.update()
        b = _bounds()
    if b and (abs(b["cx"]) > 1e-4 or abs(b["cy"]) > 1e-4):
        for o in roots:
            o.location = (o.location.x - b["cx"], o.location.y - b["cy"], o.location.z)
        bpy.context.view_layer.update()
        b = _bounds()
    if b and abs(b["minZ"]) > 1e-4:
        for o in roots:
            o.location = (o.location.x, o.location.y, o.location.z - b["minZ"])
        bpy.context.view_layer.update()
        b = _bounds()
    # Validation : après une mise à l'échelle exacte dans l'espace monde,
    # la dimension doit se trouver dans [min_m, max_m]. En cas d'échec,
    # on sort en erreur AVANT "EXPORT DONE" : le runner refuse la variante
    # au lieu d'empaqueter un modèle mal dimensionné.
    if b:
        final = b["footprint"] if dim == "footprint" else b["height"]
        if (not all(math.isfinite(v) for v in b.values())
                or not (min_m * 0.999 <= final <= max_m * 1.001)
                or max(abs(b["cx"]), abs(b["cy"]), abs(b["minZ"])) > 0.001):
            print(f"SCALE_VALIDATION_FAILED dish={kind} final {dim}={final:.4f}m hors "
                  f"[{min_m},{max_m}]", flush=True)
            sys.exit(3)
        print(f"NORMALIZED dish={kind} scale={s:.4f}", flush=True)
os.makedirs(outdir, exist_ok=True)
bpy.ops.wm.usd_export(filepath=os.path.join(outdir, "model.usd"))
print("EXPORT DONE", flush=True)
'''


def trouver_blender() -> str:
    """Localise le binaire Blender : $BLENDER_BIN, sinon le PATH."""
    env = os.environ.get("BLENDER_BIN")
    if env and os.path.isfile(env):
        return env
    which = shutil.which(env or "blender")
    if which:
        return which
    raise RuntimeError(
        "Blender introuvable. Installe Blender >= 4.x ou définis "
        "BLENDER_BIN=/chemin/vers/blender"
    )


def _optimiser_textures(dossier: str) -> None:
    """Redimensionne/recompresse les textures extraites par Blender."""
    texdir = os.path.join(dossier, "textures")
    if not os.path.isdir(texdir):
        return
    for root, _, files in os.walk(texdir):
        for f in files:
            p = os.path.join(root, f)
            if os.path.getsize(p) == 0:
                continue
            try:
                im = Image.open(p)
                if max(im.size) > TEXTURE_MAX_PX:
                    r = TEXTURE_MAX_PX / max(im.size)
                    im = im.resize(
                        (int(im.size[0] * r), int(im.size[1] * r)), Image.LANCZOS
                    )
                low = f.lower()
                if low.endswith((".jpg", ".jpeg")):
                    im.convert("RGB").save(p, "JPEG", quality=JPEG_QUALITY, optimize=True)
                elif low.endswith(".png"):
                    im.save(p, "PNG", optimize=True)
            except Exception:
                pass  # texture illisible : on la garde telle quelle


# Alignement exigé par la spec USDZ (§16.4.1.3) : les DONNÉES de chaque
# fichier doivent commencer sur un multiple de 64 octets. Comme le writer
# de référence (SdfZipFileWriter), on insère le padding dans le champ
# "extra" du local header — les lecteurs zip l'ignorent.
_USDZ_DATA_ALIGNMENT = 64
_USDZ_ALIGN_EXTRA_ID = 0xBEEF


def _package_usdz(dossier: str, sortie: str) -> None:
    """Repackage un dossier en .usdz conforme : entrées STORED (non compressées),
    première entrée = le layer USD, données alignées sur 64 octets."""
    fichiers = []
    for root, _, names in os.walk(dossier):
        for n in names:
            full = os.path.join(root, n)
            arc = os.path.relpath(full, dossier).replace(os.sep, "/")
            fichiers.append((full, arc))
    if not os.path.isfile(os.path.join(dossier, "model.usd")):
        raise RuntimeError("Blender did not export model.usd")
    fichiers.sort(key=lambda e: (0 if e[1] == "model.usd" else 1, e[1]))

    dt = datetime.datetime.now()
    dosdate = ((dt.year - 1980) << 9) | (dt.month << 5) | dt.day
    dostime = (dt.hour << 11) | (dt.minute << 5) | (dt.second // 2)

    central = []
    with open(sortie, "wb") as out:
        offset = 0
        for full, arc in fichiers:
            with open(full, "rb") as fh:
                data = fh.read()
            name_b = arc.encode("utf-8")
            flags = 0x800 if any(b > 127 for b in name_b) else 0
            # Padding pour aligner le début des DONNÉES sur 64 octets.
            extra_start = offset + 30 + len(name_b)
            pad = _USDZ_DATA_ALIGNMENT - (extra_start % _USDZ_DATA_ALIGNMENT)
            if pad == _USDZ_DATA_ALIGNMENT:
                pad = 0
            elif pad < 4:  # trop petit pour l'en-tête extra (4 octets)
                pad += _USDZ_DATA_ALIGNMENT
            extra = (struct.pack("<HH", _USDZ_ALIGN_EXTRA_ID, pad - 4)
                     + b"\x00" * (pad - 4)) if pad else b""
            crc = binascii.crc32(data) & 0xFFFFFFFF
            header_start = offset
            out.write(struct.pack(
                "<IHHHHHIIIHH", 0x04034B50, 20, flags, 0,
                dostime, dosdate, crc, len(data), len(data),
                len(name_b), len(extra)))
            out.write(name_b)
            out.write(extra)
            assert out.tell() % _USDZ_DATA_ALIGNMENT == 0, \
                f"données non alignées pour {arc}"
            out.write(data)
            central.append(struct.pack(
                "<IHHHHHHIIIHHHHHII", 0x02014B50, 20, 20, flags, 0,
                dostime, dosdate, crc, len(data), len(data),
                len(name_b), len(extra), 0, 0, 0, 0, header_start)
                + name_b + extra)
            offset = out.tell()
        central_start = offset
        central_data = b"".join(central)
        out.write(central_data)
        out.write(struct.pack(
            "<IHHHHIIH", 0x06054B50, 0, 0,
            len(central), len(central), len(central_data), central_start, 0))


def generer_une_variante(blender: str, bl_script: str, entree: str,
                         sortie: str, ratio: float, dish_kind: str = "plate") -> int:
    """Génère une variante à `ratio`. Retourne la taille en octets. Lève en cas d'échec."""
    tmpdir = tempfile.mkdtemp(prefix="usdzv_")
    try:
        r = subprocess.run(
            [blender, "--background", "--python", bl_script,
             "--", entree, tmpdir, str(ratio), dish_kind],
            capture_output=True, text=True, timeout=600,
        )
        if r.returncode != 0 or "EXPORT DONE" not in r.stdout:
            detail = r.stderr[-500:]
            for line in r.stdout.splitlines():
                if "SCALE_VALIDATION_FAILED" in line:
                    detail = f"{line.strip()} | {detail}"
                    break
            raise RuntimeError(f"Blender a échoué (ratio {ratio}) : {detail}")
        _optimiser_textures(tmpdir)
        # Repackage USDZ conforme (STORED + alignement 64 octets).
        _package_usdz(tmpdir, sortie)
        return os.path.getsize(sortie)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def suffixe_ratio(ratio: float) -> str:
    """0.5 -> 'r50', 0.25 -> 'r25', 0.15 -> 'r15', 0.10 -> 'r10'."""
    return f"r{int(round(ratio * 100))}"


def generate_variants(entree: str, out_dir: str,
                      ratios=None, dish_kind: str = "plate") -> dict:
    """
    Génère une variante .usdz par ratio.

    Retourne {str(ratio): chemin_sortie}. Écrit aussi un manifest.json
    (tailles avant/après) dans out_dir.
    """
    ratios = list(RATIOS_DEFAUT) if ratios is None else list(ratios)
    if not ratios or any(not math.isfinite(r) or not 0 < r < 1 for r in ratios):
        raise ValueError("Ratios must be finite and strictly between 0 and 1")
    if len({suffixe_ratio(r) for r in ratios}) != len(ratios):
        raise ValueError("Ratios must produce distinct output filenames")
    blender = trouver_blender()
    os.makedirs(out_dir, exist_ok=True)
    t0 = os.path.getsize(entree)

    # Le script Blender vit dans un fichier temporaire (module monofichier).
    fd, bl_script = tempfile.mkstemp(suffix=".py", prefix="usdzv_bl_")
    try:
        with os.fdopen(fd, "w") as fh:
            fh.write(_BLENDER_SCRIPT)
        resultats = {}
        manifest = {"source": os.path.abspath(entree),
                    "source_octets": t0, "dish_kind": dish_kind, "variantes": {}}
        base = os.path.splitext(os.path.basename(entree))[0]
        try:
            for ratio in ratios:
                sortie = os.path.join(out_dir, f"{base}_{suffixe_ratio(ratio)}.usdz")
                t1 = generer_une_variante(blender, bl_script, entree, sortie, ratio,
                                          dish_kind)
                resultats[str(ratio)] = sortie
                manifest["variantes"][str(ratio)] = {
                    "fichier": os.path.basename(sortie),
                    "octets": t1,
                    "reduction_pct": round((1 - t1 / t0) * 100),
                }
                print(f"OK ratio {ratio} : {t0 // 1024} -> {t1 // 1024} Ko "
                      f"({os.path.basename(sortie)})", flush=True)
            with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as fh:
                json.dump(manifest, fh, indent=2)
        except Exception:
            # Échec en cours de batch : on retire TOUS les noms de fichiers
            # attendus avant de propager, pour ne pas laisser un mélange de
            # sorties partielles + manifest périmé dans un out_dir réutilisé.
            for r in ratios:
                try:
                    os.remove(os.path.join(out_dir, f"{base}_{suffixe_ratio(r)}.usdz"))
                except OSError:
                    pass
            try:
                os.remove(os.path.join(out_dir, "manifest.json"))
            except FileNotFoundError:
                pass
            raise
        return resultats
    finally:
        os.unlink(bl_script)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Génère des variantes optimisées d'un .usdz (décimation Blender + textures).")
    ap.add_argument("entree", help="Fichier .usdz source")
    ap.add_argument("--out-dir", required=True, help="Dossier de sortie des variantes")
    ap.add_argument("--ratios", default=",".join(map(str, RATIOS_DEFAUT)),
                    help="Ratios séparés par des virgules (défaut : 0.5,0.25,0.15,0.10)")
    ap.add_argument("--dish-kind", default="plate",
                    choices=["bowl", "burger", "dessert", "drink",
                             "fallback", "pizza", "plate", "platter"],
                    help="Type de plat pour la normalisation d'échelle physique "
                         "(mêmes choix que le worker du repo)")
    args = ap.parse_args()
    try:
        ratios = [float(x) for x in args.ratios.split(",")]
    except ValueError:
        print("Ratios invalides. Exemple : --ratios 0.5,0.25,0.15,0.10", file=sys.stderr)
        return 2
    try:
        generate_variants(args.entree, args.out_dir, ratios,
                          dish_kind=args.dish_kind)
    except Exception as e:
        print(f"ERREUR : {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
