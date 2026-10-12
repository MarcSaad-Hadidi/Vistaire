# Restaurant offscreen experiment (inactive)

This is a gated comparison, not an active runtime replacement. The normal loader
continues using the independently checked `restaurant-visible-59412334.glb`.
No second-stage binary, CDN upload, resolver entry or production activation is
included. The original restaurant and the first derived checkpoint remain.

## Candidate

`scripts/3d/prune-restaurant-offscreen-experiment.mjs` accepts only phase one's
SHA-256 and removes the complete `FrontSide_3`, `FrontSide_24`, and `FrontSide_29`
primitives and resources used only by them. All retained compressed payloads,
materials, node transforms, donor geometry and floor-raycast meshes are unchanged.
A direct decoded comparison and independent glTF validation found no asset errors.

Candidate SHA-256:
`e92a37f1eafc320091ef6ed3764f3552e82e3c443a1cf25f5965a4b400cbaf6f`.

| Measure | Phase one | Experiment | Incremental reduction |
| --- | ---: | ---: | ---: |
| Raw file bytes | 3,091,452 | 3,027,428 | 64,024 (2.07%) |
| Stored triangles | 81,821 | 80,143 | 1,678 (2.05%) |
| Mesh primitives | 44 | 41 | 3 |
| Embedded images | 43 | 40 | 3 |
| RGBA8 base texture estimate | 68,878,336 | 67,633,152 | 1,245,184 (1.1875 MiB) |
| Local gzip level 9 bytes | 2,996,370 | 2,936,472 | 59,898 |
| Local Brotli quality 11 bytes | 2,973,846 | 2,915,043 | 58,803 |

For comparison, original restaurant local gzip9/Brotli11 sizes were
4,018,867/3,991,689 bytes. Compression figures are local measurements, not observed
HTTP transfer or assertions about server Content-Encoding. No FPS, GPU-time,
physical-device performance, actual VRAM or decode-time gain has been measured.

## Evidence and limits

The three complete primitive bounds did not intersect 11,424 synthetic stress
frusta built from the 119 exact-4ef9eaf mobile camera checkpoints, aspect ratios
0.33 through 32:9, distance factors 0.6/1/1.667/2, and extra horizontal offsets.
Those are numerical cross-checks, not actual desktop captures, complete reverse
journey evidence, or a proof over every possible aspect ratio.

The investigation protected larger candidates when they entered any stress view.
Partial-face re-encoding was rejected: the default could change retained UV
values, while strictly float-preserving encoding increased asset size for the
small additional triangle reduction. No approximate re-encoding is included.

## Hosted visual gate

The exclusive test `e2e/restaurant-geometry-ab.spec.ts`:

- Generates candidate bytes in memory through the pinned native Node generator
- Uses the same production build, Chromium version and SwiftShader renderer,
  separate baseline/candidate contexts, DPR1 and normal motion
- Intercepts only the restaurant request, with exact source/candidate SHA checks
- Keeps geometry, lights, camera, exposure, resolution and runtime code identical
- Decodes and pauses video at 0.25 s in both contexts to make texture pixels stable
- After media readiness, non-cached poses make one awaited real 1px scroll nudge
  and return to the exact target. Both legs require newer production draws and
  the expected distinct/restored processed scroll distance. This replaces the
  artificial same-position redraw; cached room samples remain untouched
- Samples all 12 chapter holds, quarter/mid/three-quarter points of all 9 external
  joins and both opening legs, forward then reverse
- Exercises all 7 dishes at actual 60% zoom and reset, plus maximum sushi close-up
  and reset; verifies the rendered dolly values, not just requested controls
- Recaptures the offers and FAQ backdrop with each selected dish, because entry
  framing can depend on the measured dish bounds
- Runs the complete path and dish/zoom/cache checks independently at all seven
  final layouts: 390×844, 430×932, 844×390, 1440×900, 1337×591, 2560×720 and
  3440×1440. The four alternate layouts actually resize a loaded original view
  before the full path, including portrait-to-landscape rotation
- Requires identical rendered pose and renderer/buffer before exact pixel
  comparison; any pixel difference fails. The visible offers/FAQ/footer backdrop
  is compared even when the renderer is suspended; no cached sample is skipped
- Captures the complete fixed canvas with a viewport-relative page screenshot,
  without screenshot-induced scrolling. Equal finite positive canvas bounds must
  exactly fill the viewport; decoded PNG dimensions must cover that whole clip.
  Pure observations before and after capture require unchanged camera, scene,
  cache, scroll, layout, buffer, media and each page's own frame ID. The two
  contexts need not have equal lifetime frame counts. Capture still has a
  30-second deadline; pixels and geometric matching have no relaxed tolerance
- Checks canonical pricing-entry pose, ready state, generation, buffer dimensions
  and the current document theme; validates all 23 camera/projection numbers and
  requires the same canonical pose on forward/reverse/direct entry for the same
  viewport and dish. Active offers require the real hand ready/progress
- Samples the hand entry at quarters, its exit, and the FAQ room in both directions.
  Live document join identity is separate from the intentionally cached camera pose
- Preserves representative image pairs, failure image pairs and JSON metadata,
  actual poses and cache metadata, media state, pixel hashes/differences, errors
  and completion status. Last-render draw/triangle counters and diagnostic CPU time
  are recorded separately from equality guards, with the recorded frame ID. They
  can outlive a draw and must not be summed as per-sample work. Idle cached
  counters are null; these samples are not a timing benchmark
- Writes retained compared PNGs directly into the uploaded test-results tree,
  alongside their hashes; reporter-only attachments are not the sole evidence
- Records the actual viewport/canvas sizes, measured per-chapter calibration
  frames and existing framing diagnostics for subsequent swept-envelope analysis;
  recorded waypoints alone do not establish continuous visibility

This is a finite correctness matrix, not continuous-frame capture or a universal
visibility proof. Cached lower-section acceptance targets the new offers runtime;
the old opaque-pricing skip is deliberately removed. Even a passing run requires review before changing the loader.
Physical PC/phone preview review remains separate. A timeout or unmatched pose
is an incomplete/failed gate and must not be called a visual pass.

Run seven independent hosted jobs with profile `phone`, `phone430`,
`phoneLandscape`, `desktop`, `desktop1337`, `wide`, or `wide3440`:

```
VISTAIRE_RESTAURANT_AB_PROFILE=phone \
node scripts/run-playwright-e2e.mjs e2e/restaurant-geometry-ab.spec.ts \
  --project=chromium --workers=1 --retries=0 --forbid-only \
  --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts \
  --output=test-results/restaurant-geometry-ab-phone
```

Use the existing local Supabase fixture and hermetic production server workflow;
do not target production data or bypass external-environment safeguards. The test
has a 20-minute correctness budget per profile, at most 140 test runner-minutes
across seven jobs, plus the existing setup/build overhead;
these are resource caps, not latency/performance targets. App CI runs the seven
isolated profiles for landing changes in PR #296. Each
profile reuses the verified build and retains its JSON/image evidence for seven
days; CI Gate fails on any failed, cancelled, skipped or incomplete selected
profile. Other branches can opt in with `restaurant_ab=true` and `target=landing`
on workflow dispatch. No passing result automatically activates this candidate.

Local checks completed: direct Node tests, scoped ESLint, TypeScript check and
Playwright test discovery. The local browser restriction prevents local rendering;
there is no claimed complete image-equivalence result.

The [initial hosted run](https://github.com/MarcSaad-Hadidi/Vistaire/actions/runs/38184503498)
at `ab14f9c` failed closed. Four desktop/wide profiles reached matching hero poses
but timed out inside the element screenshot's stability wait before any pixels
were captured. This motivated the bounded page-capture repair above; the exact
reason the element RAF wait stalled was not established. The 390px profile
recorded five differing foreground-dish pixels after 19 exact comparisons,
while each context advanced one two-pass render between the recorded sample
and failure observation. The old harness did not identify the exact instant of
that draw. The pixel difference is unresolved, not attributed to the crop. The 430px profile stopped on an exact
quaternion mismatch after 37 pixel comparisons. Neither mismatch is waived by
the capture repair, and neither profile established full journey acceptance.
The rotated 844×390 profile completed 102 exact pixel comparisons across the
full forward/reverse waypoint path, then timed out in element capture at the
first 60% dish-zoom sample. All seven profiles therefore finished failed; the
repaired capture path still requires hosted validation.

A bounded Node check against installed Three r183 reproduced both exact 430px
quaternion strings: damped interpolation of the same nearly-unit target can
alternate its final floating-point bit, while the runtime's scroll damping of 1
maps either observed history to the same target. This establishes a mechanism,
not the precise browser-event history of the failed run. The awaited nudge/return
uses that existing production path without changing runtime or relaxing exact
pose/pixel guards. Any later frame or pose drift still fails capture acceptance.


## 2026-10-12: same-source guarded-index candidate

The current seven existing CI profiles explicitly select `VISTAIRE_RESTAURANT_AB_MODE=guarded-index`. Each pair loads the same pinned phase-one restaurant bytes. Only the candidate context receives `restaurantCrop=guarded`; ordinary navigation remains unmodified. No second profile matrix or benchmark is added.

The inactive candidate compacts ordered indices for 19,150 of 81,821 room faces. It retains source attributes, bounds, original index storage, donor/floor geometry, and 261,678 bytes of CPU backup. Before each actual room draw, expanded-frustum and renderer/material/geometry guards either permit the compact indices or permanently restore the original indices before submission. Unsupported shadow modes also restore. This does not reduce downloaded bytes or GPU allocation.

The harness retains seven complete paths, exact visible transforms/camera/cache/media guards, zero-pixel tolerance, and the existing deadlines. Captures are serialized in foreground pages; strictly zero-scale direct-root objects retain raw diagnostics while comparison uses their exactly collapsed transform. An already-requested laptop preload must settle; the harness never initiates catalogue loading to pass.

At least one real cropped room draw is required to prove engagement. That alone is not useful performance coverage: inspect per-region active/restored state, actual submitted triangles/calls, and guard/restore costs. All pixel and browser outcomes remain pending. Historical failed asset-comparison runs do not certify this query-only candidate, and no default crop activation is authorized by this checkpoint.
