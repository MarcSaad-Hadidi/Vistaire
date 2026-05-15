# AR Asset Optimization Pipeline

Use this flow one dish at a time. The original source GLB/USDZ in `public/models/demo` stays untouched and is never the iPhone Quick Look production target.

## Asset Roles

- Original source asset: high-quality GLB/USDZ master, allowed to be large.
- Web 3D preview asset: `webModel3dUrl` GLB for `model-viewer`, allowed to use web-only compression.
- iPhone Quick Look production asset: `arUsdzUrl` USDZ under `/models/demo/ar-lite/`, no query string, `<= 5 MiB`.
- Candidate assets: temporary review outputs outside production under ignored `asset-review/3d-candidates/`; delete them before finishing unless intentionally documented.

## Build Candidates

```bash
npm run demo:build-ios-ultra -- homard-bisque
npm run demo:build-ios-ultra -- ravioles-chevre-miel
npm run demo:build-ios-ultra -- souffle-chocolat
```

The script creates conservative, balanced, ultra, and extreme candidates. It only promotes a production USDZ when a human visual review passes:

```bash
npm run demo:build-ios-ultra -- ravioles-chevre-miel --promote ultra --quality-approved
npm run demo:build-ios-ultra -- homard-bisque --promote ultra --quality-approved
npm run demo:build-ios-ultra -- souffle-chocolat --promote ultra --quality-approved
```

Reject candidates that look cheap, cartoon-like, toy-like, visibly low-poly, blurry, fake, or that damage the dish silhouette, plate, scale, or grounding.

Current approved production iPhone Quick Look USDZ:

- `ravioles-chevre-miel`: `/models/demo/ar-lite/ravioles-chevre-miel-ios-quicklook-ultra.usdz`
- `homard-bisque`: `/models/demo/ar-lite/homard-bisque-ios-quicklook-ultra.usdz`
- `souffle-chocolat`: `/models/demo/ar-lite/souffle-chocolat-ios-quicklook-ultra.usdz`

## Hard-Case Dishes

`ravioles-chevre-miel` was the first dish that failed the generic pipeline badly. Its source contains two nearly coincident high-density food shells with identical bounds, plus thousands of tiny loose geometry islands. Generic simplification preserved too much duplicated/split topology, so candidates stayed around 50 MB.

The approved ravioles iPhone asset required deeper AR-only source preparation:

- delete the duplicated expensive food shell while keeping the visible ravioles shell
- remove the unnecessary metallic/roughness texture and use scalar food roughness
- prune tiny loose components per candidate level
- simplify the retained visible shell, resize/recompress the base-color atlas, normalize, ground, and optimize USDZ binary layers

Future complex dishes that remain above budget after the standard candidate build should follow this pattern before activation: inspect for duplicated shells/internal geometry, remove invisible or phone-distance-insignificant islands, bake material detail into one small base-color texture where possible, then build a dedicated AR-only source. Do not activate `arUsdzUrl` until the production USDZ is valid, grounded, visually acceptable, and `<= 5 MiB`.

## Gates

Run:

```bash
npm run demo:validate-ios-budget
npm run demo:validate-ar-lite
npm run demo:validate-assets
npm run demo:validate-network
```

`arUsdzUrl` must point only to a production-approved USDZ `<= 5 MiB`. Do not fall back to `usdzUrl` for iPhone Quick Look. If no candidate passes both size and visual quality, keep the original source untouched, mark the dish as failed/not production-approved, and request artist work: texture atlas, baked details, mesh cleanup, retopology, or better source preparation.

## QA

Use Chrome DevTools to verify URL wiring, headers, console health, prefetch, mobile viewport, and throttled network behavior. Then test real iPhone Safari on 5G and WiFi, first and second open, with and without clearing Safari website data.

Quick Look cache reuse is native iOS behavior outside React control. Use small USDZ files, stable URLs, correct headers, current-dish prefetch, and readiness UX, but do not promise full native cache control.
