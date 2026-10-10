# Bounded same-host composition investigation

This opt-in sidecar investigates the three seams visible in the supplied Oct10 contact sheets: encryption→grip, sustainability→testimonies, and testimonies→social-content. Original MP4 playback is unavailable. It does not establish complete twelve-chapter acceptance or physical iPhone smoothness.

The existing `scripts/benchmark-landing.mjs` schema2 protocol stays byte-identical. The App CI `composition` input (with landing/full target), or `landing-composition` label before a new push, selects the composition investigation instead of the full schema2 workload. All ordinary correctness suites remain selected normally. The performance runner stays30minutes, with a25minute sidecar deadline and40second action bounds; incomplete work is retained and fails the measurement gate.

## Inputs

Caller requirements:

- Both production builds have finished; no concurrent build or benchmark on this runner
- Exact build checkouts and corresponding `.next` artifacts exist in separate directories
- The existing hermetic fixture is healthy on127.0.0.1:55434
- Port3000 is free; the sidecar owns and stops one Next server at a time
- The same installed dependencies and pinned Playwright Chromium are available

Run `node scripts/diagnose-landing-composition.mjs` with:

- `VISTAIRE_COMPOSITION_OUTPUT`: absolute evidence directory
- `VISTAIRE_COMPOSITION_RUNTIMES_JSON`: JSON object with `baseline` and `candidate`, each containing `root`, `headSHA`, `buildSHA`, `runURL`, `artifactID`, `artifactSHA256`, and optionally `artifactName`

`buildSHA` is the actual synthetic merge commit used by PR CI, not the feature head. The baseline is head31ac86733abf54aa5844386dca155465ee25872f, builddc88019ce8448c8c56390a2b6cc2c9544fe28c25, run38073599002, artifact11677657188, ZIP SHA256d968b11f36d93ae1ce14723579485431c2f90332b90b9c7dc48692739348f1be. The workflow must strictly verify these ZIP bytes before extraction. Candidate archive ID/digest may be null when the current-run download exposes only its artifact name; that uncertainty is explicit, and checkout, BUILD_ID and local build-manifest hashes are retained.

The script fails if actual checkout differs from buildSHA, runtime sources are modified, or dependency/config/public-asset Git objects differ between revisions. It checks actual browser version, renderer capabilities, DPR, CSS size and drawing buffer equality. Unknown browser/process cleanup completion stops later measured passes, rather than risking overlap or measuring the wrong server.

## Workloads and interpretation

Mobile CSS390×844, DPR1, touch-capable Chromium, normal motion, unchanged SwiftShader flags. This is controlled emulation, not a physical device.

Active order is A1/B1, B2/A2, A3/B3. Each pass launches a fresh browser/context, clears HTTP cache, and primes the same visible models before measurement. OS/process/driver caches are not cold. Each seam is driven forward and reverse over3000ms of requested wall time. Requested positions and actual scroll-event times are saved. Software-renderer stalls may skip intermediate coordinates; a nominal3000ms request is not a guarantee of uniform delivered motion.

The active pass is query-free and reuses the exact checksum-guarded schema2 browser probe. It records per-phase Scene callback wall, render-submission wall, callback cadence, React root commits, resources and separate CDP whole-page counters. Driver/probe work is included. Scene callback wall can include synchronous driver/backpressure waits and is not isolated JavaScript compute or GPU duration. Actual social video decoding/advancement, model readiness and absence of unexpected runtime/network errors gate completion. Missing workloads, bounded-buffer overflow or mismatched rendering conditions invalidate comparison.

The separate visual pass enables `sceneDiagnostics=1`, so its cost is never mixed with visitor performance. It runs continuous forward/reverse replays with passive actual camera/object transforms and inline DOM publication samples. It then retains0/25/50/75/100 jump/checkpoint observations in both directions. These are distinct evidence types. Screenshots have their own start/end timestamps and may show a later damped pose than the preceding JSON snapshot.

Baseline background-ownership findings are expected evidence; candidate acceptance requires the old stage to be transparent and the existing40% tint to exist on the world layer, following actual identities copy opacity including zero. Support/grip coexistence is observed without weakening its existing pose/speed contract or assuming all overlap is caused by damping.

`composition-pair.json`, server logs and targeted PNGs are saved after each completed phase/checkpoint and on bounded failure when the page remains responsive. Only complete matched repetitions are comparable. No averages silently include failed phases. The sidecar exits nonzero for incomplete measurement or failed candidate visual acceptance; it sets no arbitrary FPS threshold.

Unmeasured: complete twelve-chapter coverage, physical input/display FPS, GPU elapsed, power/thermal state, exact VRAM, component-specific React duration. Existing loading/idle gains remain supported by their earlier frozen-schema2 evidence; this narrower sidecar is not a replacement claim for that full protocol.
