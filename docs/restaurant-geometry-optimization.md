# Lossless restaurant geometry pruning

Owner: MarcSaad-Hadidi. User-authorized optimization for PR #296, 2026-10-11.

## Verified checkpoint: invisible backing removal

Original retained for rollback:
`public/immersive-assets/restaurant/restaurant-evening.glb`
SHA-256 `9c9a160387f36a6830f395e5c863b44ac79863513558ffe5e1bdf24e9e6931f1`.

Derived runtime:
`public/immersive-assets/restaurant/restaurant-visible-59412334.glb`
SHA-256 `594123340aa71cf74cb0e83c69b966c399230fc03e2188ed5cb80931d05f4f66`.
The existing public-model resolver uses `immersive.restaurant.visible`; no CDN
URL is invented, uploaded or activated. The original manifest entry remains.

| Measure | Original | Derived | Reduction |
| --- | ---: | ---: | ---: |
| File bytes | 4,131,356 | 3,091,452 | 1,039,904 (25.17%) |
| Stored triangles | 163,642 | 81,821 | 81,821 (50%) |
| Mesh primitives | 48 | 44 | 4 |
| Materials | 45 | 44 | 1 |
| Embedded WebP images | 44 | 43 | 1 |
| Encoded Draco payload bytes | 1,354,949 | 534,672 | 820,277 |
| Accessor-array byte estimate | 12,348,918 | 3,882,862 | 8,466,056 |
| RGBA8 base texture estimate | 69,926,912 | 68,878,336 | 1,048,576 (1 MiB) |

These are file/geometry/image measurements, not browser decode time, measured
VRAM, GPU time, display FPS or download latency. Accessor estimates omit runtime
index conversions, temporary decoder memory and driver allocation. Texture
estimates omit mipmaps, sharing and implementation choices.

## Why the removal is independent of every camera pose

The four original `BackSide_0` meshes use material 44 (`TextureMaterial_44`):
`alphaMode=BLEND`, base-color alpha zero. Actual installed Three GLTFLoader
material loading confirms opacity zero, normal blending, and `depthWrite=false`.
They contribute neither color nor depth, regardless of frustum, aspect ratio,
chapter, reverse scroll, zoom, fade or intermediate pose.

- RestaurantModel explicitly disables room shadow casting
- The scene's environment map comes from a separate Three RoomEnvironment;
  it is not captured from this restaurant. There is no live room reflection pass
- RestaurantTable fades multiply the original opacity, so zero-alpha backing
  remains zero even on its cloned materials
- All 44 visible primitive Draco payloads and all 43 retained WebP payloads are
  copied byte-for-byte. No simplification, geometry re-encoding, texture
  recompression, resolution reduction or material-property change occurs
- Source nodes/transforms, visible indices/attributes, floor raycast meshes,
  table/chair source bounds and foreground probes are retained
- Camera fitting considers the showcased products, not the room's outer bounds
- Only invisible backing selections are removed from the foreground inventory;
  original visible table/chair/accessory extraction still validates its exact
  source counts, index probes and position probes

This checkpoint does not delete visible decor based on a single screenshot.
The view-independent material proof is stronger than a finite pose sample for
these particular four meshes. It does not establish that other decor is safe
to remove.

## Reproduction and checks

Run from the repository root:

- `node scripts/3d/prune-restaurant-invisible.mjs`
- `node --test tests/restaurant-geometry-pruning.test.mjs tests/public-model-assets.test.mjs tests/restaurant-table-presentation.test.mjs tests/immersive-loading-locale.test.mjs tests/landing-camera-fit.test.mjs`

The generator accepts only the pinned original SHA and writes a separate
fingerprinted asset. It preserves all retained compressed payloads. The focused
tests load actual Three materials/node transforms with native Draco-decoded
geometry; image decoding is stubbed because image byte identity is checked
separately. They verify reproducibility, exact visible payloads and geometry,
foreground extraction/fades/exclusions, fixed anchor, and existing camera tests.
An independent control against the full inventory at commit `4ef9eaf` also
verified identical visible foreground/room geometry after exclusion and identical
physical metadata; regression tests pin those baseline geometry digests, floor
height and anchor. Total extracted triangles change 3,800→1,900, and room
exclusions 8,188→4,094. This is not a browser render comparison.

Focused suite: 24 tests passed. Asset policy, LFS policy and scoped ESLint passed.
Integration owns final full lint, typecheck, production build and CI/browser QA.

Existing exact-head `4ef9eaf` composition evidence contains 119 mobile 390×844,
DPR1 SwiftShader checkpoints across all twelve chapters. It failed a progression
assertion on footer reverse and did not finish the reverse journey. The active
benchmark completed its mobile profile but not desktop. Neither is an A/B of
this candidate, and neither certifies physical-phone performance or visual
acceptance. Local Chromium execution is restricted; protected Vercel preview
has not been bypassed. PC/phone preview review and comparable rendered A/B
remain acceptance gates, not claimed passes.

## Rollback

Restore the RestaurantModel resolver reference to `immersive.restaurant` to load
the retained original. The visible-only foreground recipe also works with that
original; invisible room backing returns but visible geometry stays unchanged.
Restore the previous inventory too only when reproducing the exact old invisible
foreground submissions is necessary. Do not delete the original or activate an
unverified CDN URL.
