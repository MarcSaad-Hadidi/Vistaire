# Landing software-renderer performance baseline

The prepared `benchmark-landing.mjs` uses existing Playwright and does not alter application source. Run from the repository after a verified production build has finished and the existing hermetic fixture/Next production server is running. No other build or benchmark should run on this machine concurrently.

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
VISTAIRE_BENCHMARK_SHA=<verified-build-sha> \
VISTAIRE_BENCHMARK_HEAD_SHA=<verified-feature-head-sha> \
VISTAIRE_BENCHMARK_OUTPUT=/absolute/path/to/evidence \
node scripts/benchmark-landing.mjs
```

The script only accepts a loopback server, to keep benchmark traffic on the hermetic fixture.

## Existing App CI opt-in

Use the `benchmark` boolean input together with the `landing` or `full` validation target, or add the `landing-performance` label to a PR before its next push. Adding the label alone does not trigger a workflow. Remove it after collecting the requested comparisons. The measurement job runs on a separate runner, consumes the same run’s verified production build, and must complete successfully when selected. It does not set an arbitrary FPS threshold.

On PR events, the build SHA is GitHub’s synthetic merge commit, while `headSHA` identifies the feature branch revision. The report also records the exact run/attempt URL. Keep all three with exported artifacts; do not describe merge-build measurements as head-only builds.

Inspection started at `f836193f6058f8e581e64e9d573cfd700e6e6c07`. Its rendered tests exposed functional defects in fractional scroll geometry, direct fragment arrival and food/table clearance. Necessary functional corrections are included before the first performance baseline. Record the actual baseline build and feature-head SHAs from the benchmark artifact; do not describe it as an unchanged f836 runtime. No performance improvement is claimed by this setup.

## Conditions and outputs

- Chromium headless with the same explicit SwiftShader flags as current rendered correctness tests
- Desktop CSS 1440×900 and mobile CSS 390×844, DPR 1, normal motion; both use the same desktop software-rendering machine
- Three fresh-context HTTP-cold starts, each followed by same-context warm reload; OS/process/GPU caches are not cold
- Three serial hero-idle, decoded phone-video and opaque-pricing-idle workloads run first, before stress can prevent their repetition
- Then three full forward/reverse scroll, dish pointer/zoom, actual dish/support selection, all three social-menu video and support keyboard stress cycles; scrolling must reach both the actual document endpoint and the renderer’s corresponding section
- The warm session is at least three minutes only if required workloads finish; a failed stress phase leaves full-profile comparability and the complete soak explicitly unmet
- Setup/settling phases kept separate from true idle intervals; setup can make elapsed session exceed three minutes
- One local pricing FAQ open/close and a public About navigation/back per profile; no RAG/Mistral query is sent
- Expected video frame advancement, model readiness and absence of unexpected network/console/page errors are completion gates; these are not FPS thresholds
- A 25-minute script deadline leaves time inside the 30-minute job for artifact uploads
- Native hide/wake is attempted using tab focus; if the headless browser keeps `document.hidden=false`, this check is explicitly unverified
- Each action retains its 40-second watchdog; a blocked software renderer is reported as a failure rather than excused by an increased budget
- JSON is saved after each cold/warm start and each phase, plus bounded best-effort failure snapshot/screenshot, substep and failed-phase counters or a final screenshot; a late lost/failed WebGL context fails the profile instead of producing fallback numbers

`landing-performance.json` schema 2 records its exact harness SHA-256, per-workload completion/comparability, explicit phase timing windows, separate tested build SHA, PR head SHA, exact CI run/attempt URL, server URL, host/browser, viewport/DPR/internal canvas dimensions, readiness times, request timings and sizes, callbacks, long tasks, React root commits, draw calls/triangles, CDP metrics, media frames, heap snapshots and warnings.

## Interpretation

Scene callback identification observes standard WebGL draw-command submissions, with the existing `canvas.dataset.frames` change as a secondary fallback, then remembers callback identity. The wrappers forward each native method unchanged and perform no synchronization/readback. Keep only lightweight lifecycle state (`ready`, `section`, `settled`, `suspended`) in candidate builds; verbose diagnostics may remain disabled. Before/after runs must use this exact same instrumentation. If it cannot identify a scene callback, CPU attribution is missing, not zero; inspect `sceneCallbackIds` and sample counts.

The fields retaining `CPUms` in their names measure elapsed callback wall time, including JavaScript update, preparation, render submission and possible synchronous driver/backpressure waits. They do not measure CPU utilization or isolated GPU duration. The old `renderCPUms` is submission-only and excludes `frameSubjects`. Browser RAF intervals are callback cadence, not physical displayed FPS. GPU duration, physical refresh, power/thermal state, texture/geometry/program resource counts and exact VRAM remain unmeasured. Renderer resource counts must never be mislabeled as bytes.

The light RAF probe, native draw-count wrappers, WeakRef media registry and React hook add overhead. If any bounded sample buffer exceeds its 50,000-entry cap, the report warns and marks the affected workload/profile incomparable; truncated samples are never treated as zero work. CDP counters include the whole page plus the benchmark driver; their durations are seconds. Heap snapshots include the bounded probe arrays and cannot alone establish a leak. React measurements count actual root commits, not LandingContent renders or component CPU duration. Detached phone video is observed through weak references without changing media playback, and start/end samples expose decoded-frame advancement.

WebGL capability metadata is queried once per document after load and cached; this can perturb startup and is included in the same protocol for every comparison. No per-phase GPU queries, tracing, framebuffer readback, `gl.finish`, performance threshold, arbitrary FPS cap, network throttling, reduced-motion substitution or fallback-versus-WebGL comparison is used. Scripted scroll and pointer/keyboard input are not physical touch/trackpad/AR validation.

## Schema 2 measurement correction

The initial schema-1 CI run at feature head `af29c7d03d9ef49a9bd58707d65473d2872bfe6b` captured all three cold/warm pairs for both profiles, then failed its unchanged 40-second stress budgets. Desktop forward scrolling included a 32,094 ms callback (32,091 ms inside render submission); mobile’s 20-step gesture exceeded the budget. These are instrumented software-renderer observations, not physical GPU results. Neither profile completed its three-cycle soak.

That probe also attributed some intervals spanning phase boundaries to the next phase, and kept the previous phase active while serializing reports. Schema 2 closes each workload before CDP/report collection, drops straddling RAF intervals, attributes buffered long tasks using actual start/end times, and explicitly labels between-phase work. Both browser measurement-window duration and outer wall duration are retained. Slow warm navigation retains separate DOMContentLoaded/ready wall timing and the original Navigation Timing entries; it is not automatically attributed to resource loading.

Schema 2 uses the same four-step drag path/endpoints in all comparisons, rather than schema 1’s twenty steps. Completed isolated workloads may be examined separately when all their repetitions and required media are verified, while incomplete stress and soak remain invalid. Do not compare schema-1 phase distributions or gesture totals directly with schema 2, and do not label the entire profile comparable merely because isolated workloads finished. Before/after comparisons require matching harness checksum and conditions.

## Validation performed on the revised script

- `node --check`: passed
- Repository ESLint configuration via `--stdin --stdin-filename scripts/benchmark-landing.mjs`: passed
- Independent read-only source review: corrections incorporated for driver attribution, disabled zoom, readiness loss, phase-entry races, detached video observation and bounded phase actions
- Three pure-node probe regressions fail against schema 1 and pass schema 2: RAF boundary isolation (including late callbacks), buffered long-task attribution, and cached renderer metadata
- Schema 1 ran in CI with the incomplete outcomes documented above. Schema 2 has not yet run in a browser. Local Chromium’s known Unix-socket restriction must not be bypassed; corrected CI measurement is required
