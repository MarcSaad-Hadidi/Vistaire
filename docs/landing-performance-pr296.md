# PR296 performance diagnosis

## Baseline and observed failures

Source head: `7957173a281468eab30e578e7ada85bdd7cd8ed6`. CI merge build: `c4504a84c75e3928a06c72ad966a4c25b3c04221`.
Evidence: [App CI 38085600901](https://github.com/MarcSaad-Hadidi/Vistaire/actions/runs/38085600901).

* Performance job 114311884068: full journey stopped at `features:presentation:forward:hold-2`, during a checkpoint screenshot's 40-second deadline. Four of twelve regions were reached. No geometry finding had been recorded. The last captured pose was settled with reason mask zero. This is incomplete acceptance, not evidence of a four-region geometry failure or a proven renderer freeze.
* Chromium job 114311883927: desktop scroll reached the 600-second test deadline; desktop zoom failed the 15-second settled assertion at `homard:damped-reset`; mobile zoom exhausted its global deadline at `burger:damped-rotation`. Mobile scroll completed. Preserve these separate outcomes.
* Desktop zoom's passive diagnostic recorded a RAF delivery delay of 9,685 ms followed by a 2.2 ms callback body; another owned request was pending for 5,670.8 ms. Final settling mask 512 denotes projection settling. These samples distinguish delivery cadence from callback wall time but do not identify driver, compositor, CPU or runtime root cause.
* WebKit job 114311883957: both locale tests stalled on Maison Élysé video advancement at 430px after testing 390px. `paused=false` and `readyState=2` do not prove decoded playback. This is a separate DOM-video investigation.

## Diagnostic command

Use the existing hermetic fixture and verified production build, exactly as the composition CI step does:

```sh
node scripts/diagnose-landing-composition.mjs --journey-qa --diagnostic-profile
```

Existing environment inputs remain unchanged: `VISTAIRE_COMPOSITION_RUNTIMES_JSON` holds one `candidate` with `root`, exact `headSHA`, actual `buildSHA`, `runURL` and current build `artifactName`; `VISTAIRE_COMPOSITION_OUTPUT` is the artifact directory. The runtime checkout must match the production build and have no runtime edits. Profiling is rejected without `--journey-qa` so it cannot silently contaminate the paired active benchmark.

After readiness, CDP V8 profiling samples at 10,000 microseconds. The raw `candidate-journey.cpuprofile` is stopped and saved in `finally`, including when a checkpoint fails. The JSON report retains profiler status, elapsed/sample time and per-call-frame sampled self time. Production function names can be minified; use raw call tree, URL and locations, not guessed names. Missing or failed profile flush is a failure, not a successful measurement.

The existing passive probe retains requested/start/end times, pending owned RAF age, actual rendered pose, and input delivery timestamps. Profiling, scene diagnostics, screenshots and serialization add overhead. This run diagnoses heavy QA behavior; it does not measure visitor performance, GPU duration, physical display FPS, or a before/after gain.

Checkpoint screenshots keep all existing coverage/assertions, normal animations, and their 40-second limit. The native Playwright timeout preserves its call log instead of a generic outer race error. Capture wall time is recorded even on error. No font wait is bypassed and no screenshot is dropped. Installed Playwright's screenshot preparation waits for fonts; ordinary `page.screenshot` does not require the two matching images used by screenshot assertions. The call log and profile are evidence to investigate the failing stage, not proof in advance that fonts or SwiftShader caused it.

### Native screenshot diagnostic

The first profiled run, `38110261528` at head `d4923b98ce33323141f1f3ac38c5820a93c174d2`, reproduced the same checkpoint failure. Its call log confirms fonts loaded. V8 sampling was approximately 98.6% idle overall; the approximate screenshot interval was entirely idle. Scene pose was settled, reason mask zero, with no owned RAF pending. This rules against a continuously executing JavaScript loop in that sampled interval, but does not localize a compositor/GPU/native capture stall. Clock correlation uses the page timestamp before the profiler start command and is approximate.

Under the existing diagnostic flag only, the `features:presentation:forward:hold-2` capture additionally records a native CDP trace. Categories are `toplevel`, `blink`, `devtools.timeline`, `cc`, `viz`, and `gpu`; buffer mode is circular with 16 MiB allocation and a 16 MiB output limit. It starts immediately before that single capture and ends in `finally`, including timeout. A clock-sync marker identifies capture start. `captureWallMs` records the unchanged screenshot call alone; the outer image wall time includes diagnostic setup/flush overhead.

Trace setup commands each have a 5-second bound, flush/read has a shared 5-second bound and stream close a 1-second bound. The original screenshot remains 40 seconds and the overall journey deadline is unchanged. Unknown flush, oversized output, stream-close failure or reported data loss fails the diagnostic rather than claiming complete evidence. Browser cleanup retains final process ownership. The raw `candidate-features-hold-2.trace.json` is separate from the V8 profile. Trace categories provide evidence only if the browser emits the relevant events; absent events are not proof that a subsystem was idle. No additional capture, GPU readback, forced render loop or quality reduction is introduced. CDP has no dedicated cancellation command for `Page.captureScreenshot`; the normal Playwright timeout and owned browser shutdown remain in place.

Protocol references: [CDP Tracing](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/), [CDP IO](https://chromedevtools.github.io/devtools-protocol/tot/IO/). Installed Playwright protocol definitions verify the trace-buffer, data-loss and stream fields.

### Controlled legacy screenshot experiment (opt-in, not a product fix)

Run `38111937302` reproduced the timeout with a complete 7,605,359-byte trace (`dataLossOccurred=false`). Two native `CopyOutputRequest` spans remained open; the GPU process ran 16,874 delayed tasks from `ScheduleDelayedGPUTaskFromGPUThread`. Renderer-main task wall time summed to 21.7 ms over the capture window. This localizes the observed screenshot stall to native capture/readback processing; it does not establish the cause of visitor scroll latency.

The trace's actual launch command includes `--enable-features=CDPScreenshotNewSurface`. Installed `playwright-core` 1.62.1 conditionally omits that switch when `PLAYWRIGHT_LEGACY_SCREENSHOT` is truthy (`lib/coreBundle.js`, launcher configuration). The controlled experiment is:

```sh
node scripts/diagnose-landing-composition.mjs --journey-qa --diagnostic-profile --legacy-screenshot-diagnostic
```

The opt-in flag sets Playwright's existing environment switch before loading its launcher. It is rejected without both journey QA and profiling; inherited legacy-mode configuration is rejected unless explicitly requested. `screenshotMode` records the requested mode and the native trace command line must confirm the actual launch change. No browser security flag is added, no browser version/quality/viewport/DPR/runtime asset is changed, and all screenshots, assertions, coverage and capture deadlines remain intact. The active benchmark process is unaffected. A changed outcome is evidence about the capture implementation only, not an application performance improvement. Do not adopt this mode as default or erase the failed default-mode evidence without reviewing the controlled result.

Source: [Playwright Chromium switches](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/chromium/chromiumSwitches.ts). The installed version, not the moving main branch, was checked for the exact condition. [Chromium 151.0.7922.34 readback implementation](https://raw.githubusercontent.com/chromium/chromium/151.0.7922.34/components/viz/service/display_embedder/skia_output_surface_impl_on_gpu.cc) identifies the repeated readback-completion scheduling path; the pending callback's internal cause remains unresolved.

Diagnostic CI runs may use two matrix workloads on separate runners: composition (heavy QA/profiler/trace) and active (the frozen query-free benchmark without composition screenshots). Both consume the same build and both must pass the aggregate job gate; artifacts have workload suffixes. Different runners cannot support a before/after performance comparison. Normal benchmark/composition behavior remains a single selected workload. The later before/after comparison below still requires the same runner.

## Same-runner comparison after a justified fix

The existing non-journey mode already runs baseline/candidate in order B1,C1,C2,B2,B3,C3. It requires the exact same public assets, package files and server configuration; a media change must not silently invalidate that contract. Measurements are serialized, with one caller-owned fixture and one application/browser owner at a time. Fresh browser/cache and identical warmup apply to each pass.

Pinned baseline archive at inspection:

* Artifact `next-build-38085600901`, ID `11681932019`, 201,611,537 bytes
* SHA256 `bcbc02aa0b326da2703ac3b21dd6c072b19a04ff32d48797875156476160e830`
* Expires 2026-10-11 20:56:52 UTC; recheck availability before use

Minimal CI wiring: download the authenticated Actions ZIP, verify its archive digest before extraction, checkout the exact merge build above, install the unchanged lockfile, extract into its `.next`, and provide its artifact identity alongside the verified candidate identity. Do not substitute a later build under the old digest. The helper checks Git/runtime contracts, BUILD_ID and build manifests. Retain its 25-minute process deadline and the existing 30-minute job budget; incomplete passes remain failures. Download/setup time must also fit the job budget.

This comparison covers three seams only. Full twelve-region QA remains separate; active timing phases must remain separate from screenshots and profiler runs. Report only matched complete passes and actual callback cadence/costs. Real iOS input, physical GPU/display, power and thermal behavior require separate hardware validation.

## Local validation limits

Node tests exercise the real passive probe and scheduler without a browser. The profiler summary test verifies that callback delivery gaps are not fabricated as application self time. Browser execution here is not a substitute for CI: local Chromium was previously blocked and the available cloud browser lacks the required WebGL workload. No blocked route is retried or bypassed.

### Features natural geometry correction

The early browser regression at head `78b99a8d338b22fa958d49fd58b3d944e0fec179` (run `38113151281`, artifact `11692801092`) executed all four FR/EN × 390/430 cases. Both 390 px cases failed on a 16.25 CSS px focus-height variation between the three stable reading holds; both 430 px cases passed. This is independent of the software-GPU capture failure. The desktop cloud fallback at 1188 × 761 was stable and does not establish mobile correctness.

The candidate reserves the natural maximum translated content height by placing the three panels in one grid cell. Inactive panels remain in layout but are hidden, inert and excluded from the accessibility tree. Text, links, scroll distances, renderer and quality are unchanged. The regression now persists its geometry JSON and additionally checks positive focus dimensions and unclipped card bounds. The composition probe reads the active panel while retaining its baseline selector for the previous DOM. Candidate browser results are pending; no whole-landing or hardware performance gain is claimed from this local correction.

### Restore Retina quality after explicit Safari feedback

The user's exact Safari preview `vistaire-8iwq4xrnv-capoships-projects.vercel.app` was resolved through Vercel to READY deployment `dpl_79daHHeEJgZ9PqLfDT79gxxQEjcR`, head `3e68f1c82d3f4cd0cb3cd1ab7eccfe8aca231bce`. It already contains the Features correction but retains the DPR 1.5 cap introduced in `7957173`.

The quality correction restores only the preceding DPR cap of 3 and four-million-pixel budget. On a DPR 3 screen at 390 × 844, the drawing buffer returns from 585 × 1266 to 1170 × 2532; at 430 × 932, from 645 × 1398 to 1290 × 2796. This quadruples pixels relative to the reduced-resolution checkpoint and is explicitly a quality restoration, not a performance gain. The demand scheduler, same-frame synchronization, assets, materials and unchanged-size resize guard remain unchanged.

The production resize function passes 17 scheduler/resize tests including portrait/landscape/return, exact mobile resolution and the large-screen pixel bound. Root reran those tests using the installed dependencies in the QA worktree against the integrated Scene.jsx; its dependency-free integration worktree cannot independently resolve Three. Physical iOS rendering and actual device frame times remain unverified. The first Features browser candidate independently passed all four geometry cases, with 0 px focus variation versus the baseline 16.25 px at 390 px.

### Bounded local Safari capture

`?performanceCapture=1` mounts a lazy diagnostic panel only on explicit request. The visitor must click to begin a 20-second capture, may stop/cancel/close, and may download the JSON locally. It does not activate `sceneDiagnostics`, load QA hulls, upload data, or start a permanent sampling loop. The normal route does not mount the panel.

The capture allowlists existing scene counters, target scroll distance, browser user-agent, canvas/backing dimensions and resize revisions. It records both native RAF timestamps and actual callback delivery times, including initial delay, incomplete trailing wait and deadline overshoot. No URL, query, hash, cookie, token or form content is exported. These are callback/submission measurements, not physical display FPS or GPU execution times. Layout reads occur only at the boundaries; arrays, timers and callbacks are bounded and cleaned on cancellation, unmount, hidden/pagehide interruption.

Independent review found and corrected URL exposure and missing first/final-delay information before publication. The final helper/panel contract passes 11 tests against the integrated sources, including delayed delivery after the deadline and fallback with a residual canvas. Build, normal-route chunk absence and real downloaded-file QA are still required before requesting the user's Safari capture. Physical Safari download and the underlying stutter cause are not yet verified.
