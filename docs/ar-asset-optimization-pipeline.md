# AR Asset Optimization Pipeline

Use this repeatable flow for each dish, one dish at a time.

1. Keep the original source GLB/USDZ untouched in `public/models/demo`.
2. Inspect the original GLB with `npx gltf-transform inspect` and record size, triangles, materials, textures, and extensions.
3. Generate conservative, balanced, and aggressive review candidates outside `public`; never promote a file by size alone.
4. Reject candidates that look cheap, blurry, low-poly, cartoon-like, or that alter the dish silhouette, plate, or food composition.
5. Choose the smallest candidate that still looks premium at normal mobile viewing distance.
6. Build the chosen AR-lite GLB without Scene Viewer-risky required extensions, then convert it to USDZ.
7. Add or update `arModel3dUrl` and `arUsdzUrl` while keeping the original `model3dUrl`, `webModel3dUrl`, and `usdzUrl`.
8. Run asset validation, network/header validation, lint, and build.
9. Verify in Chrome DevTools: requested AR-lite GLB/USDZ paths, no heavy original GLB for the web viewer, cache behavior, mobile viewport, throttled network, and console health.
10. Test real iPhone Quick Look and Android Scene Viewer/WebXR on mobile networks when possible.
11. Remove temporary candidates, logs, profiles, screenshots, and scratch scripts before shipping.
