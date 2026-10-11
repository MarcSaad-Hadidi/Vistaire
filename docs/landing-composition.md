# Bounded landing journey QA and paired investigation

The App CI `composition` input (with landing/full target), or `landing-composition` label before a new push, now selects **candidate-only full-journey QA**. It consumes the current verified build without downloading a pinned baseline. Ordinary correctness suites remain selected normally. The performance runner stays 30 minutes, with the original 25-minute helper deadline, 40-second action bounds and owned-process cleanup.

The no-flag CLI remains the historical three-seam paired investigation. Its order, active workload, query-free measurement and separate visual passes are unchanged. `scripts/benchmark-landing.mjs` remains byte-identical. Full-journey QA is not a new paired benchmark and establishes no CPU gain or physical-iPhone smoothness claim.

## Candidate-only journey QA

Run `node scripts/diagnose-landing-composition.mjs --journey-qa` with:

- `VISTAIRE_COMPOSITION_OUTPUT`: absolute evidence directory
- `VISTAIRE_COMPOSITION_RUNTIMES_JSON`: exactly one `candidate` object with `root`, `headSHA`, `buildSHA`, `runURL`, `artifactName`, and nullable `artifactID`/`artifactSHA256`

The caller must already have the matching production build and healthy hermetic fixture on 127.0.0.1:55434, with port 3000 free. The helper does not build, install dependencies, change server configuration or start another benchmark. It checks the actual checkout against `buildSHA`, unchanged runtime sources, `.next/BUILD_ID`, and hashes the three local build manifests. A missing archive digest stays explicitly unknown. The current workflow supplies current-run provenance; there is no baseline contract or artifact dependency in this mode.

One fresh normal-motion page at `/en?sceneDiagnostics=1` uses CSS 390×844, DPR 1, touch-capable pinned Chromium and the existing SwiftShader launch flags. Actual WebGL renderer identity must contain SwiftShader; canvas coverage and drawing-buffer identity are checked throughout. This instrumented QA has substantial additional callback, DOM/media observation, screenshot and serialization cost. Its durations must not be compared with visitor active costs or interpreted as display FPS.

The finite default-pace coverage contract is:

- All 12 regions exist exactly once and in order: hero, ai, wearable, features, encryption, grip, sustainability, testimonies, social-content, product, open-weight, footer
- All nine external joins come from the actual published DOM windows, are finite, reachable, ordered and non-overlapping; the first seven preserve 3.2H travel, with natural-pricing capping allowed on the last two
- Opening: two 3.2H camera legs, the new 2H AI reading hold, and unchanged 1.5H phone hold
- Seven interior presentations use their measured neighboring join boundaries: 8H for features/social, 4H for the other five, with 1.1H entry edges; reading centers correspond to three 2H holds separated by two 1H changes
- Nonzero native pricing and footer ranges complete the document traversal without adding artificial scroll distance

Every range uses the existing requested 3000ms continuous driver forward and reverse, followed by 0/25/50/75/100 checkpoints. Reading presentations also observe 12.5/87.5%, giving all three hold centers in each direction. Requested coordinates, actual delivered scroll-event timestamps, real rendered transforms and contemporaneous inline DOM/card/pager/media state are retained. Per-replay rendered-callback counts and processed-scroll/transition divergence are evidence, with no arbitrary FPS or lag threshold. Screenshots have separate timestamps and may show a later damped pose.

Completion fails closed on missing ranges/directions/checkpoints, invalid or missing rendered pose, missing full-world coverage, broken identities world-scrim ownership/opacity, wrong selected card/pager, missing normal-speed decoded social playback/advancement, buffer overflow, unexpected runtime/network errors, hidden document or unknown cleanup completion. Every region must be observed onscreen with readable non-inert copy. Intentional scene suspension is allowed only behind full-viewport opaque native pricing; its retained pose is not called a fresh draw. All three social videos must actually advance decoded frames in both directions. Each phone-hold midpoint separately retains `phoneReady` and the detached phone-video state; phone media advancement remains explicitly `unverified`, and social decoding is not phone proof.

Exactly 16 forward images are retained: one midpoint per external join, the AI hold, and three feature/three social holds. Reducing redundant images keeps room for broader traversal. `landing-journey-qa.json` retains phase/checkpoint progress, inputs, passive samples, failures and cleanup evidence even when a region or later check fails. The exit gate is `complete` plus `journeyChecksPassed`, with no report errors or exceeded deadline. `comparable` stays false; `visualAcceptance` stays `not-established`. QR/support coexistence, Mac composition and overall chapter-to-chapter quality still require visual review; automated completeness is not universal visual acceptance.

## Historical paired-mode inputs

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

The script fails if actual checkout differs from buildSHA, runtime sources are modified, or dependency/config/public-asset Git objects differ between revisions. It checks actual browser version, renderer capabilities, DPR, CSS size and drawing buffer equality. Unknown browser/process cleanup completion stops later measured passes, rather than risking overlap or measuring the wrong server. Cleanup retains resource timestamps, connection/exit state and nested errors. The browser uses the existing40second action bound to allow pinned Playwright’s own30second graceful-close/owned-kill sequence; repeated cleanup awaits that same original close promise. Next still has2seconds after SIGTERM and2seconds after SIGKILL. A teardown failure invalidates the pass. The first361cc808 attempt completed one baseline workload then failed cleanup; its original aggregate omitted the resource cause, so that cause remains unknown and no paired comparison is claimed.

## Historical paired-mode workloads and interpretation

Mobile CSS390×844, DPR1, touch-capable Chromium, normal motion, unchanged SwiftShader flags. This is controlled emulation, not a physical device.

Active order is A1/B1, B2/A2, A3/B3. Each pass launches a fresh browser/context, clears HTTP cache, and primes the same visible models before measurement. OS/process/driver caches are not cold. Each seam is driven forward and reverse over3000ms of requested wall time. Requested positions and actual scroll-event times are saved. Software-renderer stalls may skip intermediate coordinates; a nominal3000ms request is not a guarantee of uniform delivered motion.

The active pass is query-free and reuses the exact checksum-guarded schema2 browser probe. It records per-phase Scene callback wall, render-submission wall, callback cadence, React root commits, resources and separate CDP whole-page counters. Driver/probe work is included. Scene callback wall can include synchronous driver/backpressure waits and is not isolated JavaScript compute or GPU duration. Actual social video decoding/advancement, model readiness and absence of unexpected runtime/network errors gate completion. Missing workloads, bounded-buffer overflow or mismatched rendering conditions invalidate comparison.

The separate visual pass enables `sceneDiagnostics=1`, so its cost is never mixed with visitor performance. It runs continuous forward/reverse replays with passive actual camera/object transforms and inline DOM publication samples. It then retains0/25/50/75/100 jump/checkpoint observations in both directions. These are distinct evidence types. Screenshots have their own start/end timestamps and may show a later damped pose than the preceding JSON snapshot.

Baseline background-ownership findings are expected evidence; candidate acceptance requires the old stage to be transparent and the existing40% tint to exist on the world layer, following actual identities copy opacity including zero. Support/grip coexistence is observed without weakening its existing pose/speed contract or assuming all overlap is caused by damping.

`composition-pair.json`, server logs and targeted PNGs are saved after each completed phase/checkpoint and on bounded failure when the page remains responsive. Only complete matched repetitions are comparable. No averages silently include failed phases. The sidecar exits nonzero for incomplete measurement or failed candidate visual acceptance; it sets no arbitrary FPS threshold.

Unmeasured: complete twelve-chapter coverage, physical input/display FPS, GPU elapsed, power/thermal state, exact VRAM, component-specific React duration. Existing loading/idle gains remain supported by their earlier frozen-schema2 evidence; this narrower sidecar is not a replacement claim for that full protocol.
