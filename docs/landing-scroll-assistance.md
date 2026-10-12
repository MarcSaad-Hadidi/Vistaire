# Continue to the next authored reading stop

## Scope and evidence

This candidate follows the user's request to remove distance eligibility and continue a released native gesture toward the next reading stop, without automatically chaining chapters. It starts from the preserved speed-tuning candidate based on published `38a45a7`. That speed-only snapshot remains unpublished and unchanged. The local snapshots have no `.git`; file comparisons and hashes establish scope.

Runtime edits are confined to `EntryScrollAssist.js`. Its existing tests and this document change; the integrating lead separately updates the existing offers acceptance cases. App, Scene, SceneDirector, authored geometry, assets and dependencies remain unchanged. One gesture-scoped RAF observes native motion **or** advances one continuation; an idle page has no assistance RAF.

The retained 38 browser traces establish two specific failures, independent of proximity:

- Chromium and WebKit continuations abandoned their destination after actual callback gaps of 133–1163ms. Some first callbacks were delayed; some first writes repeated the starting position. This candidate preserves logical progress across those stalls instead.
- One Chromium first native scroll was delivered 1624ms after accepted input and rejected by the old 600ms gate. Candidate first-motion acceptance now depends on trusted event ordering, direction and still-current intent, not elapsed wall time alone.

Those hosted traces all handed off through `scrollend`, with zero sampled velocity and no deceleration samples. They do **not** demonstrate early-deceleration activation, physical-device fluidity or gapless motion. New hosted and physical-device acceptance is still required.

## Destinations: authored navigation poses

App's opening navigation anchors are hero=0, AI=0.5 and wearable=1 times measured `opening.motionTravel`, offset by `opening.top`. AI therefore stops at the **middle of its reading hold**, not the first reveal leg's end. Other cinematic navigation poses equal their measured incoming transition ends, as checked against `chapterNavigationTarget()` in the tests.

At frozen stage H=844px and default pace:

| Stop | Scroll position |
| --- | ---: |
| Hero | 0 |
| AI | 3544.8 |
| Wearable | 7089.6 |
| Features | 11056.4 |
| Encryption | 20509.2 |
| Grip | 26586 |
| Sustainability | 32662.8 |
| Sustainability, laptop fully open | 36038.8 |
| Testimonies | 38739.6 |
| Social content | 44816.4 |
| Product | 54269.2 |

Sustainability also has an internal stop where `chapterPhase("sustainability")` reaches 1: the lid is at its widest opening keyframe and the dashboard is readable. It sits at the chapter's `(sceneScreens - edgeScreens) / sceneScreens` progress, which is exactly where the departure toward Three experiences starts, so one gesture never plays the whole opening and that departure without a pause. Features and the video menus likewise stop where option 2 and option 3 become fully stable (the end of each `readingTiming()` change), so each detail and each menu gets its own reading stop before the next chapter. These numbers illustrate measured geometry; they are not runtime constants. The candidate chooses the nearest authored stop strictly ahead in the native gesture's direction. There is no minimum progress, proximity zone, one-pixel eligibility cutoff or travel cap. At an exact stop, the next gesture selects the adjacent stop. A native overshoot selects the next stop in its direction and never pulls backward. A forward gesture inside an AI hold can therefore continue through its remaining hold and transition to Wearable.

One gesture owns one target. Completion consumes that ownership; the controller's scroll events cannot arm another chapter. At the final cinematic stop there is no forward automatic destination. Pricing/FAQ/footer are not stops, and the existing exclusion once pricing is visible (`scrollY + innerHeight >= pricing.top`) remains in force, including reverse reading gestures there.

## Native ownership and release

The earlier handoff retains the speed candidate's 40ms input/release silence and 32ms stationary evidence. After genuine document movement, a single observer can transfer before a missing or late `scrollend` only when:

1. No touch, key or pointer is held, with at least 40ms since input or physical release.
2. Two decreasing same-direction native velocity samples were observed on fresh 8–50ms intervals, ending at no more than 0.15px/ms.
3. At least two stationary frames span at least 32ms, and the last moving sample is no older than 80ms.
4. The observed position agrees with the processed document scroll, UI/control gates are clear and a directional reading stop exists.

The observer never writes while sampled native positions are advancing. It timestamps actual position reads with `performance.now()`, not a potentially stale RAF timestamp. Long observer delivery invalidates velocity/deceleration evidence. A 2-second observation ceiling stops that observer but does not clear the gesture; a later real `scrollend` can still hand off. If a browser advertises `scrollend` but never delivers it and no earlier evidence qualifies, assistance can remain pending. This is not a universal completion guarantee.

Real `scrollend` respects the same 40ms contact/input gate, so intermediate end events in a 16ms wheel packet train cannot repeatedly start assistance. Browsers without the property retain the conservative 280ms input/scroll-silence fallback after release. The presence of the property is not proof of timely event delivery. Browser-native smooth-scroll easing/duration and compositor inertia remain browser-controlled: see [CSSOM View scrolling](https://drafts.csswg.org/cssom-view/#scrolling).

The proven compositor-before-wheel bookkeeping remains intact: a matching position difference is credited once only when its ordered trusted document scroll arrives. Its unknown pre-handler timing never becomes a velocity estimate. A candidate first scroll must be trusted, timestamped no earlier than the current input and no later than delivery, and agree with gesture direction. New input, navigation/layout reset or hiding invalidates the old intent even if that old event arrives later.

Touch gestures are anchored at `touchstart`, not at the latest `touchmove`:

- Document movement that arrives before the first `touchmove`, in the touch's direction, counts as the gesture's native motion.
- A `touchmove` packet with no vertical change carries no new intent and leaves the gesture intact.
- A coalesced scroll event stamped before the latest `touchmove` but after `touchstart` is accepted.

These orderings were reproduced in software sequences; they do not by themselves prove the cause on a specific physical device.

## Travel-scaled continuation

The controller makes instant per-frame document-position writes along smooth velocity ramps and a constant-speed cruise. It does not stack a native smooth scroller with another smoother. A globally stretched quintic was rejected because a long zero-seed trip needed 128–304ms after handoff merely to request one CSS pixel. The fixed-ramp curve makes startup independent of long travel.

For remaining distance d, frozen stage H and fresh same-direction sampled speed v in px/ms:

- Decay measured speed linearly to zero by 80ms after the last moving sample.
- Bound seed speed to `s = min(max(0, v), 4H/1000)` and initially choose `p = max(s, 3H/1000)`.
- Choose ramp time `R = min(120ms, max(60ms, d/p))`; for positive s also require `R <= 2d/(3s)`.
- For short trips reduce peak speed to `p = min(p, d/R − s/2)`.
- Set cruise time `C = max(0, (d − R(s/2 + p))/p)` and logical duration `T = 2R + C`.

The seed bound on R ensures the adjusted peak remains at least s and nonnegative. Both ramp areas plus the cruise exactly cover d; no position clamp hides reversal or overshoot. The 60ms short-trip ramps preserve a 120ms nominal duration floor, except when a positive seed mathematically requires a shorter stop. Long trips retain 120ms ramps and add cruise time. There is no 850ms ceiling and no near-zero-seed crawl. Unusually high measured seed speed is bounded; no device classification or wheel-delta scaling is used.

Let `F(u) = u³ − u⁴/2`, the integral of velocity smoothstep `3u² − 2u³`. During the entry ramp, traveled position is `s*t + (p−s)*R*F(t/R)`. The cruise starts at `R(s+p)/2` and runs at p. During the final ramp, its incremental distance is `p*R*(u−F(u))`. Velocity is continuous and nonnegative, and acceleration is zero at the controller endpoints and both cruise joins. These controller conditions do not prove acceleration continuity with unknown native compositor motion.

Analytic zero-seed examples at H=844px, without interrupted or stalled frames:

| Travel | Logical duration | Peak px/ms | First ≥0.5px / ≥1px request after handoff, 16ms cadence |
| --- | ---: | ---: | ---: |
| 40px | 120ms | 0.667 | 16 / 32ms |
| 1000px | 514.94ms | 2.532 | 16 / 32ms |
| Hero → AI, 3544.8px | 1520ms | 2.532 | 16 / 32ms |
| Wearable → Features, 3966.8px | 1686.67ms | 2.532 | 16 / 32ms |
| Ordinary 6076.8px gap | 2520ms | 2.532 | 16 / 32ms |
| Long default 9452.8px gap | 3853.33ms | 2.532 | 16 / 32ms |
| Long 0.25× preview gap, 35279.2px | 14053.33ms | 2.532 | 16 / 32ms |

The first assisted write is on the next callback. In the deterministic immediate-end fixture it occurs 64ms after last native movement: a 48ms frame-quantized release gate plus 16ms. Its first ≥1px request occurs at 80ms. The deceleration fixture writes 48ms after last movement: 32ms stationary proof plus 16ms. The first long-trip frame requests 0.6722px regardless of distance, versus 0.0022px/0.00016px for the rejected stretched longest default/slow-preview curves. A changed requested position is not necessarily a visible pixel. The remaining stationary/input-release window and browser scheduling prohibit a zero-gap or perceived-smoothness promise.

## Delayed frames preserve the destination

The 80ms actual-delivery boundary is retained as a **no-catch-up boundary**, not an abandonment condition. Every animation callback reads `performance.now()` once. After ownership checks:

- At the first gap greater than 80ms, write nothing, preserve the same target/curve/logical elapsed time, rebase the delivery clock and request the next frame.
- On consecutive late callbacks, advance only one bounded 16ms logical step. Sustained 83–100ms delivery therefore still makes progress instead of remaining paused forever.
- At a timely gap, advance logical elapsed only by that delivered interval and clear the stalled state.
- Finish exactly at the target when logical duration is complete, then stop scheduling frames.

This also applies to a delayed **first** callback and stale-looking RAF timestamps. Repeated stalls do not create repeated handoffs or wall-time catch-up jumps. At the ordinary 2.532px/ms peak, a slow-cadence 16ms logical step covers at most 40.512px; the capped 3.376px/ms seed raises that maximum to 54.016px. Such sparse physical frames cannot look like a smooth 60Hz animation. No rendering is possible if callbacks cease entirely. Eventual completion requires further callbacks and continuing ownership, and is deliberately slower in wall time under persistent stalls.

## Remaining cancellation and safety exceptions

User interaction immediately wins: new wheel/touch/key/pointer, click/focus/control input or reversal consumes the old continuation. There is no revival after interruption, including while paused. Persistent editing/slider/dialog focus remains protected; stale ordinary button/link focus does not block a genuine scene-targeted gesture.

Non-user safety cancellation still exists: document hiding, blur/page departure, reduced-motion changes, unmount/disposal, caller UI blocks, App measure/ResizeObserver/pace/navigation remaps, or foreign document movement more than one CSS pixel from the controller's expected position. Resumed native inertia is foreign movement and cancels assistance rather than fighting the browser. The helper also refuses a handoff if its observed and processed position disagree. This contract does not promise that every non-interrupted scroll always finishes under all browser/layout conditions.

A touch `pointercancel` caused by UA panning relinquishes pointer ownership while preserving an independently valid active Touch Events gesture. True `touchcancel` still resets it. Both event-start orderings remain tested. See [Pointer Events stream suppression](https://www.w3.org/TR/pointerevents3/#suppressing-a-pointer-event-stream).

## Diagnostic comparison and hosted contract

Mode is chosen when the helper initializes:

- `?sceneDiagnostics=1&scrollAssistMode=baseline`: published 7c spatial limits, 600ms first-scroll expiry, native `scrollend`/280ms fallback and browser-native smooth completion.
- `?sceneDiagnostics=1&scrollAssistMode=early`: this next-stop candidate with diagnostics.
- Ordinary runtime, `sceneDiagnostics=1` alone, or `scrollAssistMode=baseline` without diagnostics: candidate behavior.

The baseline is a deliberately retained diagnostic comparison, not normal production gating. It remains 7c, not 38. The optional, exception-isolated `window.__vistaireScrollAssistTrace(row)` has consumer-owned bounded retention. Existing input/event/handler timestamps, gesture/contact state, position, reasons and immutable active-controller scalar snapshots remain. New `continuation-paused` rows retain `gap`, logical `elapsed`, `logicalStep` (0 for the first rebase, 16 for continued late delivery) and `target`; `handoff.duration` is logical duration, which excludes later pauses. Completed duration is logical elapsed, not wall time.

The existing offers harness pairs baseline/early at 390px/1440px, uses genuine Chromium wheel bursts and separately labeled released WebKit keyboard input, and explicitly writes retained JSON before assertions. Its common endpoint is now the wearable → features join, since candidate AI uses the real midpoint navigation anchor while baseline keeps its old first-leg endpoint. Independent candidate cases cover early Hero → AI, long reverse, AI → Wearable and no chaining, alongside interruption/reduced-motion checks. The integrating lead owns that E2E file.

The paired trace retains actual positions, timing, velocity and first assisted writes. Review the recorded handoff source: a `scrollend`-only run does not certify the early-deceleration path. Keyboard and generated wheel evidence cannot substitute for physical touch/trackpad acceptance. No local browser was launched or alternate denied route used.

## Focused validation

- Preserved speed baseline: 60/60 targeted tests passed before this change.
- Eleven behavioral cases failed before the initial next-stop implementation, including the separately reproduced 1624ms first-delivery rejection. Four additional expected failures then proved the stretched startup and sustained-slow-cadence issues before the ramp/cruise and bounded-progress fixes.
- Current targeted command: `node --test tests/landing-entry-scroll-assist.test.mjs tests/landing-scroll-continuity.test.mjs tests/landing-model-gesture.test.mjs`: **67/67 passed**, no skips.
- Helper suite includes every authored gap/handoff in both directions at 0.25×/1×/4×, exact stops/overshoot, zero/slow/fast seeds, short/long travel, one-stop ownership, repeated stalls before/after the first write, persistent 83/100ms cadence, fixed startup across long distances, velocity continuity at ramp/cruise joins, paused interruption, actual delivery clocks, ordered late first motion, controls/contact and disposal.
- Scoped helper/test ESLint passed. The integrating lead owns aggregate Node/typecheck/lint and hosted acceptance. No build, browser or publication was performed by this helper task.

Unchanged App SHA-256: `8bfe2ec3dc5014be874bcd8f9b7271f679c9af87b8f8399a512763cb31be3e0a`.

Unchanged SceneDirector SHA-256: `c48b3454a2e6e9b47b8ab0a3ff93df56bdb3d9c89dcae112d0a8e41d9158b224`.
