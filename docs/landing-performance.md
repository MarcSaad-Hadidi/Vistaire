# Landing software-renderer performance baseline

The prepared `benchmark-landing.mjs` uses existing Playwright and does not alter application source. Run from the repository after a verified production build has finished and the existing hermetic fixture/Next production server is running. No other build or benchmark should run on this machine concurrently.

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
VISTAIRE_BENCHMARK_SHA=<verified-runtime-head-and-build-sha> \
VISTAIRE_BENCHMARK_OUTPUT=/absolute/path/to/evidence \
node scripts/benchmark-landing.mjs
```

The script only accepts a loopback server, to keep benchmark traffic on the hermetic fixture.

## Existing App CI opt-in

Use the `benchmark` boolean input together with the `landing` or `full` validation target, or add the `landing-performance` label to a PR before its next push. Adding the label alone does not trigger a workflow. Remove it after collecting the requested comparisons. The measurement job runs on a separate runner, consumes the same run’s verified production build, and must complete successfully when selected. It does not set an arbitrary FPS threshold.

On PR events, the build SHA is GitHub’s synthetic merge commit, while `headSha` identifies the feature branch revision. The report also records the exact run/attempt URL. Keep all three with exported artifacts; do not describe merge-build measurements as head-only builds.

Inspection started at `f836193f6058f8e581e64e9d573cfd700e6e6c07`. Its rendered tests exposed functional defects in fractional scroll geometry, direct fragment arrival and food/table clearance. Necessary functional corrections are included before the first performance baseline. Record the actual baseline build and feature-head SHAs from the benchmark artifact; do not describe it as an unchanged f836 runtime. No performance improvement is claimed by this setup.

## Conditions and outputs

- Chromium headless with the same explicit SwiftShader flags as current rendered correctness tests
- Desktop CSS 1440×900 and mobile CSS 390×844, DPR 1, normal motion; both use the same desktop software-rendering machine
- Three fresh-context HTTP-cold starts, each followed by same-context warm reload; OS/process/GPU caches are not cold
- Three repeated idle, phone-video, full forward/reverse scroll, opaque-pricing idle, dish pointer/zoom, actual dish/support selection, all three social-menu videos and support keyboard cycles in an at-least-three-minute warm session per profile
- Setup/settling phases kept separate from true idle intervals; setup can make elapsed session exceed three minutes
- One local pricing FAQ open/close and a public About navigation/back per profile; no RAG/Mistral query is sent
- Expected video frame advancement, model readiness and absence of unexpected network/console/page errors are completion gates; these are not FPS thresholds
- A 25-minute script deadline leaves time inside the 30-minute job for artifact uploads
- Native hide/wake is attempted using tab focus; if the headless browser keeps `document.hidden=false`, this check is explicitly unverified
- JSON is saved after each cold/warm start and each phase, plus failure screenshots or final screenshot; a late lost/failed WebGL context fails the profile instead of producing fallback numbers

`landing-performance.json` records separate tested build SHA, PR head SHA, exact CI run/attempt URL, server URL, host/browser, viewport/DPR/internal canvas dimensions, readiness times, request timings and sizes, callbacks, long tasks, React root commits, draw calls/triangles, CDP metrics, media frames, heap snapshots and warnings.

## Interpretation

Scene callback identification observes standard WebGL draw-command submissions, with the existing `canvas.dataset.frames` change as a secondary fallback, then remembers callback identity. The wrappers forward each native method unchanged and perform no synchronization/readback. Keep only lightweight lifecycle state (`ready`, `section`, `settled`, `suspended`) in candidate builds; verbose diagnostics may remain disabled. Before/after runs must use this exact same instrumentation. If it cannot identify a scene callback, CPU attribution is missing, not zero; inspect `sceneCallbackIds` and sample counts.

The scene RAF callback body measures JavaScript update, preparation and render submission. The old `renderCPUms` is submission-only and excludes `frameSubjects`. Browser RAF intervals are callback cadence, not physical displayed FPS. GPU duration, physical refresh, power/thermal state, texture/geometry/program resource counts and exact VRAM remain unmeasured. Renderer resource counts must never be mislabeled as bytes.

The light RAF probe, native draw-count wrappers, WeakRef media registry and React hook add overhead. CDP counters include the whole page plus the benchmark driver; their durations are seconds. Heap snapshots include the bounded probe arrays and cannot alone establish a leak. React measurements count actual root commits, not LandingContent renders or component CPU duration. Detached phone video is observed through weak references without changing media playback, and start/end samples expose decoded-frame advancement.

No tracing, synchronous GPU reads, `gl.finish`, performance threshold, arbitrary FPS cap, network throttling, reduced-motion substitution or fallback-versus-WebGL comparison is used. Scripted scroll and pointer/keyboard input are not physical touch/trackpad/AR validation.

## Validation performed on the prepared script

- `node --check`: passed
- Repository ESLint configuration via `--stdin --stdin-filename scripts/benchmark-landing.mjs`: passed
- Independent read-only source review: corrections incorporated for driver attribution, disabled zoom, readiness loss, phase-entry races, detached video observation and bounded phase actions
- Browser execution: not run locally because the known Chromium Unix-socket restriction must not be bypassed; CI execution is still required
