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
npm run demo:build-ios-ultra -- homard-bisque --promote ultra --quality-approved
```

Reject candidates that look cheap, cartoon-like, toy-like, visibly low-poly, blurry, fake, or that damage the dish silhouette, plate, scale, or grounding.

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
