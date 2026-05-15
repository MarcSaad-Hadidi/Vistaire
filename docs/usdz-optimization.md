# USDZ Optimization Notes

## Current Demo Assets

These assets are served from `public/models/demo`. GLB files are used by
`model-viewer` for web 3D and Android AR. USDZ files are used by iOS Quick Look
through `ios-src` and the direct `rel="ar"` link.

| Dish | GLB bytes | GLB MiB | USDZ bytes | USDZ MiB | USDZ change |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ravioles chevre miel | 76,609,104 | 73.06 | 70,375,208 | 67.12 | -60.30% |
| Homard bisque | 29,010,112 | 27.67 | 26,352,806 | 25.13 | -48.33% |
| Souffle chocolat | 27,286,348 | 26.02 | 24,873,890 | 23.72 | -47.29% |
| Maison Elyse N1 | 86,380 | 0.08 | 208,984 | 0.20 | unchanged |

Only these production 3D assets should live in `public/models/demo`:

- `ravioles-chevre-miel.glb`
- `ravioles-chevre-miel.usdz`
- `homard-bisque.glb`
- `homard-bisque.usdz`
- `ar-lite/homard-bisque-ar-lite.glb`
- `ar-lite/homard-bisque-ios-quicklook-ultra.usdz`
- `souffle-chocolat.glb`
- `souffle-chocolat.usdz`
- `maison-elyse-n1.glb`
- `maison-elyse-n1.usdz`

## Public Asset Hygiene

The `public` directory is served directly by Next.js. Backups, generated
intermediates, source drops, and unvalidated candidates must not be kept there,
because they become public URLs and can be fetched even when they are not
referenced by `demoMenuData.ts`.

These Homard intermediate files were removed from `public/models/demo` because
they were not production references:

- `homard-bisque-ar.glb`
- `homard-bisque-ar.usdz`
- `homard-bisque-ar-lite.usdz`
- `homard-bisque-ios-quicklook-v2.usdz`
- `homard-bisque.before-mesh-opt.glb`
- `homard-bisque.before-texture-opt.glb`
- `homard-bisque.pre-opt.glb`
- `homard-bisque.raw-backup.glb`
- `homard-bisque.user-source.glb`
- `homard-bisque.user-source.usdz`

Future 3D candidates and heavy source drops should stay outside `public` until
they are structurally valid, visually reviewed, and intentionally wired into the
frontend. If a source asset must remain in the repo, place it in a documented
non-public source area; otherwise keep local drops ignored and outside commits.

## Ravioles Diagnosis

`ravioles-chevre-miel.usdz` is heavy because geometry dominates the package.
The two largest USDZ entries are USDA geometry files:

| Entry | Bytes | MiB | Points |
| --- | ---: | ---: | ---: |
| `geometries/Geometry_5.usda` | 116,087,039 | 110.71 | 1,231,088 |
| `geometries/Geometry_11.usda` | 47,565,520 | 45.36 | 433,119 |

The two included 2048x2048 PNG textures are only about 12.78 MiB combined.
Texture compression alone cannot meaningfully solve the ravioles USDZ size.

## Applied Optimization

The production USDZ files for ravioles, homard, and souffle were rebuilt with
Pixar OpenUSD (`usd-core`) by converting package layers from text USDA to binary
USDC and repacking with `UsdUtils.CreateNewUsdzPackage`.

This is a data-preserving optimization:

- geometry point, face, and index counts stayed identical;
- material, shader, texture count, and resolved texture filenames stayed
  identical;
- world bounds stayed identical;
- GLB files and web 3D rendering paths were not changed;
- public USDZ URLs stayed stable.

Do not use blind geometry simplification or texture resizing for these final
USDZ files unless a rendered old-vs-new review proves the result is visually
lossless.

## Quality Rule

Do not replace a production USDZ unless the candidate is visually lossless:

- same perceived colors and material response;
- same scale, pivot, orientation, and plate/support;
- no visible food, garnish, plate, or premium detail removed;
- no blind texture downscaling;
- no geometry simplification without old-vs-new visual QA.

## Safe Pipeline

1. Keep the original production assets untouched.
2. Create candidates outside production URLs.
3. Prefer versioned filenames over replacing existing immutable URLs.
4. Regenerate USDZ through a known USDZ-capable pipeline, not by manually
   rezipping package contents.
5. Run structural validation before any visual review.
6. Run browser/model-viewer visual QA for GLB candidates.
7. Run real iPhone Safari Quick Look QA for USDZ candidates before production
   when the environment is available.

## Validation Commands

Use `npm.cmd` on Windows PowerShell when `npm.ps1` is blocked by execution
policy.

```powershell
npm.cmd run demo:validate-assets
npm.cmd run demo:validate-network
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

USDZ binary-layer optimization and binary USDZ asset validation require the
Python `usd-core` package. `demo:validate-assets` intentionally fails for
binary-only USDZ files if OpenUSD is not available, because otherwise it cannot
verify geometry, plate meshes, placement, materials, or resolved textures.

```powershell
python -m pip install --user usd-core
$env:USDZ_VALIDATION_PYTHON = "python"
npm.cmd run demo:validate-assets
python scripts/optimize-usdz-binary-layers.py public/models/demo/ravioles-chevre-miel.usdz public/models/demo/review/ravioles-chevre-miel.candidate.usdz
python scripts/compare-usdz-scenes.py path/to/original.usdz path/to/candidate.usdz
```

For `demo:validate-network`, start the app first and set the base URL if needed:

```powershell
$env:VALIDATE_DEMO_BASE_URL = "http://localhost:3000"
npm.cmd run demo:validate-network
```

## iPhone Safari Checklist

Run this on a real iPhone in Safari over HTTPS:

1. Open `/demo/dishes/ravioles-romarin`.
2. Tap `Voir en 3D`.
3. Tap `Afficher devant moi`.
4. Confirm Quick Look opens and the dish appears at the expected scale.
5. Check color, material, plate/support, orientation, and visible details.
6. Exit AR and launch it again from the same page.
7. Repeat for homard, souffle, and Maison Elyse N1.

Desktop Chrome or Playwright with an iOS user agent can verify UI branching, but
it does not validate real Apple Quick Look behavior.

## Tools Needed For Deeper Optimization

The local Windows environment now has Pixar OpenUSD Python bindings installed as
`usd-core`. For any future optimization that changes geometry, textures, or
materials, use one of these reliable pipelines:

- Blender 3.6+ with the original source model to inspect and selectively reduce
  invisible or redundant geometry, then export GLB and regenerate USDZ.
- Reality Converter or Xcode tools on macOS to export Quick Look-compatible
  USDZ and verify package validity.
- OpenUSD tools (`usdchecker`, `usdcat`, `usdzip`) to inspect and package USDZ
  safely.
