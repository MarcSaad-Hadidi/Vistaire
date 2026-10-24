# Vistaire offline asset tools

These tools generate five **derived** mobile meshes. The five supplied source
GLBs remain unchanged. They do not modify application code, iOS USDZ files,
texture resolution, texture contents, or material settings.

```sh
npm ci --prefix scripts/assets --ignore-scripts --registry=https://registry.npmjs.org
node scripts/assets/generate-dish-lods.mjs
```

Dependencies are pinned in this directory's lockfile and isolated from the
frontend package. The generated files live in `public/assets/dishes/lod/`;
`docs/lod-inventory.json` records their hashes and validation evidence.

## Method and safeguards

- Verify each supplied source SHA-256 before and after generation.
- Decode Draco/Meshopt without editing any source file.
- Weld only bitwise-identical complete vertices.
- Simplify onto existing vertices with Meshopt's attribute-aware algorithm:
  target 120,000 triangles, maximum combined error 0.002, normal weight 0.2,
  UV weight 4. No sloppy, permissive, vertex-update or pruning mode.
- Retain every surviving vertex's exact position, normal, UV and other attribute
  values; remove unused vertices and reorder for GPU cache locality.
- Encode the existing component arrays losslessly with Meshopt. The extension's
  `QUANTIZE` encoder mode is selected, but **no `quantize()` transform is run**.
  Original quantized arrays stay quantized; original float arrays stay floats.
- Assert identical embedded image bytes, appearance properties, node transforms
  and copyright. Assert exact vertex-attribute roundtrip through serialization.
- Validate both compressed output and its fully decoded equivalent with the
  Khronos glTF Validator; reject any validation error or result outside the
  80,000–150,000-triangle budget.

The combined simplification error is an algorithm estimate, not a measured
Hausdorff distance or a maximum pixel error. Collapsing triangles necessarily
changes the surface and interpolation between surviving UVs. Rendered close-ups,
silhouettes and multiple angles must still be compared before claiming visual
parity. This task has not measured physical-device FPS or thermal performance.

The float-based chocolat and burger scans can produce a larger download than
their aggressively quantized Draco originals even with fewer triangles. Their
decoded vertex/index memory still falls. File size is not GPU memory or FPS.

## Attribution and rights

The five models were supplied by the user for Vistaire. Their explicit request
authorizes these derived LODs; no broader licence or third-party ownership is
inferred. The embedded material/texture payloads and available attribution are
retained. Original hashes and provenance are in the inventory.

Tool dependencies come from `registry.npmjs.org` and their primary projects:

| Tool                                                             | Version        | Author                 | Licence    |
| ---------------------------------------------------------------- | -------------- | ---------------------- | ---------- |
| [glTF Transform](https://github.com/donmccurdy/glTF-Transform)   | 4.5.1          | Don McCurdy            | MIT        |
| [meshoptimizer](https://github.com/zeux/meshoptimizer)           | 1.1.1          | Arseny Kapoulkine      | MIT        |
| [Draco](https://github.com/google/draco)                         | 1.5.7          | Google LLC             | Apache-2.0 |
| [glTF Validator](https://github.com/KhronosGroup/glTF-Validator) | 2.0.0-dev.3.10 | The Khronos Group Inc. | Apache-2.0 |

Licence texts and validator notices are retained in `licenses/`.

## Exact projected framing hulls

`generate-framing-hulls.mjs` reads the eight active dish variants and writes
`public/assets/dishes/framing-hulls.json`. It needs the pinned JavaScript
dependencies above, the frontend's Three.js package, and Python with NumPy and
SciPy. The inspected Python environment has NumPy 2.3.5 and SciPy 1.17.0.

```sh
node scripts/assets/generate-framing-hulls.mjs
```

This is an offline CPU operation. It decodes every indexed drawable vertex,
applies every intrinsic glTF node transform, and mirrors Scene's current
normalization: `2.35 / max(size.x, size.z, size.y * 1.3, .001)`, centered on X/Z
with the bounding bottom at Y=0. Its source bounds reproduce Three GLTFLoader's
accessor bounds and the non-precise Box3 used by Scene, rather than substituting
glTF Transform's tighter vertex bounds.

SciPy's ConvexHull uses all distinct vertices and Qhull `Qc Tv` (no sampling,
QJ jitter, geometric simplification or coordinate rounding). Every source point
is independently checked against every hull plane. The largest observed outside
distance is 1.56e-15 normalized units, within the recorded 1e-9 arithmetic
tolerance. These are floating-point results, not a proof of infinite-precision
arithmetic.

| Active variant    | Decoded vertices | Hull vertices |
| ----------------- | ---------------: | ------------: |
| Homard desktop    |          392,921 |         4,941 |
| Homard mobile     |          177,230 |         2,215 |
| Soufflé           |          147,986 |         8,285 |
| Huîtres LOD       |           85,253 |           525 |
| Sushi LOD         |           83,242 |           368 |
| Chocolat fumé LOD |           74,457 |         2,752 |
| Poutine LOD       |           82,331 |         3,837 |
| Burger LOD        |          108,453 |         1,258 |

`byUrl[modelUrl].vertices` contains nested XYZ arrays in base-normalized model
coordinates, **before** the live dishRoot transform and any presentation scale.
Project them using `dishRoot.matrixWorld` plus the same presentation scale applied
to the model; the current burger presentation uses 0.55. Using
`activeDish.matrixWorld` would normalize twice. The shared viewer camera envelope
does not expand a smaller model again to fill the frame.
For camera-front geometry, hull projection gives the exact extremal drawable
vertex extent without the empty corners introduced by a world AABB. Camera-plane
crossings still require the projection helper's explicit guard.

Every variant records source SHA-256, original bounds, scale/offset, source
provenance and containment validation. Homard/Soufflé originate from the official
Vistaire runtime; the other variants originate from user-authorized LODs of the
supplied scans. The derived metadata grants no new rights over those models.
The source assets and their original attribution/licensing remain unchanged.

## Independent source and texture integrity verification

```sh
node scripts/assets/verify-asset-integrity.mjs
node scripts/assets/verify-asset-integrity.mjs --record
```

The verifier parses raw GLB chunks without glTF Transform, Meshopt or Draco. It
checks all five original/LOD SHA-256 pairs, extracts each original embedded image
bufferView, and asserts identical image bytes, MIME and ordering in the derived
LOD. All 17 embedded images pass, as does embedded copyright preservation.
It also checks the unchanged restaurant source and all eight hull-source hashes.
`--record` stores only verification evidence in `docs/lod-inventory.json`; neither
mode regenerates or changes any model, texture, or hull coordinate.

| Dish          | Embedded images | Identical image bytes |
| ------------- | --------------: | --------------------: |
| Huîtres       |               3 |               315,778 |
| Sushi         |               4 |               283,000 |
| Chocolat fumé |               3 |               271,166 |
| Poutine       |               3 |               188,578 |
| Burger        |               4 |               309,118 |
