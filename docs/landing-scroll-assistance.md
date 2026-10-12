# Earlier bounded scroll handoff experiment

## Source, scope and current status

This candidate is based on published `7c67bf2f0afdb7280c5571345b595a1060544a84`, supplied as the `vistaire-activation-validation` snapshot. It preserves the proven Chromium compositor-before-wheel activation repair and its diagnostic event ordering. The snapshot has no `.git`; file comparisons and hashes establish local scope.

Only the helper, its existing tests, this document and the existing offers E2E harness change. App, Scene, SceneDirector, measured camera choreography, assets and dependencies are unchanged. The helper owns one RAF at a time: native-motion observation **or** its continuation, never concurrent helper controllers. Ordinary settled pages have no assistance loop.

The candidate can transfer before `scrollend` when a released native gesture has demonstrably decelerated and its observed position has stopped advancing briefly. Deterministic lifecycle/trajectory tests pass. Hosted motion traces and physical-device acceptance remain pending; this is not a gapless-scroll or performance claim.

## Audit of the published behavior

The published helper uses document `scrollend` exclusively when the property exists. Unsupported browsers use 280ms of input/scroll silence after physical release. It then starts browser-native smooth scrolling, whose timing/easing it cannot control. Native smooth-scroll timing is browser-defined; `scrollend` denotes completed scrolling/gesture, not an exposed compositor-velocity handoff API. See the [CSSOM View scrolling specification](https://drafts.csswg.org/cssom-view/#scrolling).

Published spatial limits are half the handoff, capped at two frozen stages, and a section tail capped at 360px/0.45 stage/20% of its measured gap. At an 844px stage/default pace, a handoff spans 2700.8px and assistance accepts its final 1350.4px.

The retained c9 Chromium rings prove lost pre-handler movement, fixed by 7c. They do **not** prove late `scrollend`: its callback immediately followed the scroll callback. The desktop wheel had approximately 3.93 seconds of pre-handler delivery delay; the mobile-width case had approximately 22.5ms. WebKit's prior 8.25px error was native keyboard overshoot, not the same activation bug. These remain separate from the user's perceived stop/restart complaint.

## Earlier ownership transfer

After accepted, observed native movement, the candidate observes actual `scrollY` on one gesture-scoped RAF. It never writes while observed native positions are advancing. Early eligibility requires all of:

1. No held touch, key or pointer, and at least 60ms without new input. Physical key/touch/pointer release restarts this window.
2. Two decreasing, same-direction velocity samples from fresh frames, each 8–50ms apart, with the last moving speed at most 0.15px/ms.
3. At least two stationary frames spanning at least 32ms since the last moving frame, with that sample no older than 80ms.
4. Current position agreeing with the last processed scroll event, existing UI/control/reduced-motion gates clear, and an eligible bounded authored endpoint.

The observer hands off without waiting for a missing/late `scrollend`. The first assisted write occurs on the next display frame. In the deterministic 16ms fixture, this is 32ms to decide plus another 16ms to write, or **48ms after the last observed movement**. Actual browser scheduling can differ. A stationary-frame requirement necessarily introduces a short gap; it does not establish physically seamless or zero-gap continuation.

Any new native movement resets stationary/deceleration evidence. Observation timestamps use `performance.now()` at the position read, not a potentially older rAF timestamp. A long observation frame invalidates velocity evidence. A 2-second observation ceiling, measured from the latest input/release, prevents an indefinite missing-event loop; later real `scrollend` can still settle the gesture. Offers/FAQ/footer reading does not start this observer.

A real `scrollend` also transfers to the candidate controller, but respects the same 60ms input-silence/contact-release gate. This prevents a decreasing wheel packet train from starting and canceling assistance after every packet. It may add up to 60ms for a lone packet whose end event is immediate. The paired trace must expose that tradeoff rather than imply all input becomes faster. The existing 280ms unsupported-browser fallback remains the conservative last option when no early evidence qualifies.

## Interruption and native-inertia limits

Fresh wheel/touch/key/pointer/control input, protected focus, navigation/layout cancellation, reverse movement, hidden/reduced-motion state, disposal and unexpected position changes yield immediately. Before every assisted write the controller rechecks ownership. If native inertia resumes after the quiet observation, the next observed displacement cancels assistance; the platform does not provide proof that future compositor movement cannot resume. Physical Safari/trackpad behavior therefore remains a required acceptance check.

A continuation frame delayed more than 80ms, measured at actual callback delivery rather than its potentially older rAF timestamp, cancels instead of jumping forward along a stale trajectory. This prioritizes avoiding a large discontinuity over forcibly completing a phase during a main-thread stall. It can leave the user short of the target; hosted traces must distinguish this safety cancellation from activation failure.

`pointercancel` is not treated as physical touch release when an independently valid Touch Events stream is still active. UA panning suppresses Pointer Events; the standard does not prescribe combined Touch Events ordering. Both start orderings are covered by a regression, along with true `touchcancel`. An already active continuation still cancels. See [Pointer Events stream suppression](https://www.w3.org/TR/pointerevents3/#suppressing-a-pointer-event-stream).

## Bounded range and trajectory

The candidate can finish one current section ending or one committed adjacent handoff, never both automatically:

| Phase | Published 7c | Candidate |
| --- | --- | --- |
| Handoff remainder | min(50% span, 2 stages) | min(85% span, 3 stages) |
| Section-ending remainder | min(360px, 0.45 stage, 20% gap) | min(1.5 stages, 50% gap) |

At H=844px/default pace, handoff remainder grows from 1350.4px to 2295.68px and section-ending maximum from 360px to 1266px. At 0.25× pace the 8271.2px handoff still permits at most 2532px, requiring 69.39% native progress. At 4× pace its 1308.2px span permits 1111.97px. Pricing-related handoffs and natural reading remain excluded. Direction is preserved, including after keyboard overshoot; the helper does not pull backward to an endpoint already crossed.

The active controller uses instant per-frame position writes along a finite quintic, not a second browser-native smoother. Let remaining distance be d, same-direction sampled speed v in px/ms and frozen stage H:

`T = clamp(1.5d / max(v, 5H/1000), 160ms, 850ms)`

For nonzero v, shorten T if needed so `T <= 2d/v`. Thus `m=vT/d` lies in [0,2]. Normalized position is:

`p(t)=mt+(10−6m)t³+(8m−15)t⁴+(6−3m)t⁵`.

Its derivative is `(1−t)²[m+2mt+(30−15m)t²]`, nonnegative over the interval. Position is monotone without overshoot clamping, begins at the estimated velocity, ends at zero velocity, and has zero controller acceleration at its endpoints. These mathematical conditions do not prove continuity with unknown compositor acceleration.

Seed speed decays to zero over 80ms since its measured motion. The proven pre-handler displacement repair establishes that native movement occurred but **never** supplies speed: its timing is unknown. No wheel-delta scaling or inferred input-device classification is used.

Examples at H=844px are analytic projections, not measured browser results:

| Remainder / seed | Duration | Peak speed |
| --- | ---: | ---: |
| 40px / 0px/ms | 160ms | 0.469px/ms |
| 1000px / 0px/ms | 355.45ms | 5.275px/ms |
| 1000px / 2.5px/ms | 355.45ms | 4.331px/ms |
| 2295.68px / 0px/ms | 816ms | 5.275px/ms |
| 2532px / 0px/ms | 850ms | 5.585px/ms |

Long-transition pace remains subject to visual review. Completing within this duration is not guaranteed if interrupted or a frame stalls.

## Same-build diagnostic comparison

The mode is chosen when the helper initializes; no App change is required:

- `?sceneDiagnostics=1&scrollAssistMode=baseline`: published 7c thresholds, native `scrollend`/280ms timing and browser-native smooth completion.
- `?sceneDiagnostics=1&scrollAssistMode=early`: candidate with diagnostic events.
- Ordinary runtime, `sceneDiagnostics=1` alone, or `scrollAssistMode=baseline` without `sceneDiagnostics=1`: candidate behavior. A diagnostic flag alone cannot disable the candidate.

`window.__vistaireScrollAssistTrace(row)` remains optional and exception-isolated. The consumer owns bounded retention. The `handoff` row adds `source` (`deceleration`, `scrollend` or `quiet-timer`), `target`, `velocity`, `sampleAge`, `duration`, `stationaryMs`, `stationaryFrames`, `inputQuietMs` and `decelerationSamples`. Existing position, event/handler timestamp, gesture, contact, mode and cancellation fields remain available. Active-controller diagnostics copy scalar state at capture time, so later frames cannot rewrite a retained row. No per-frame trace recorder is installed in ordinary runtime.

The existing `e2e/landing-offers.spec.ts` now contains the same-build paired capture, avoiding protected external URLs. It alternates baseline/early order at 390px/1440px, uses trusted decreasing Chromium wheel packets or separately labeled released WebKit keyboard input, and retains actual RAF positions/velocities, native events and assisted writes. The recorder is bounded to 7 seconds/3000 rows, writes JSON before assertions, and preserves failures from either mode while attempting both. Existing acceptance cases are retained.

Run in the repository's normal hosted offers job, or its equivalent configured build environment:

```sh
./node_modules/.bin/playwright test e2e/landing-offers.spec.ts --project=chromium --project=webkit
```

Only test discovery has been run in this execution environment, not a browser. No alternative denied browser/socket route was used. A successful capture requires trusted input, multiple actual positions, reported mode, a retained handoff and the common endpoint; it does not automatically certify the `deceleration` path or perceived smoothness. Review the retained source: if only `scrollend` qualified, earlier handoff remains unverified on that run. Physical touch/trackpad acceptance cannot be inferred from keyboard or generated wheel packets.

## Verification checkpoint

- Exact 7c baseline helper tests: 17/17 passed before changes.
- Five initial candidate tests failed before implementation. Further fail-before regressions covered native-end acknowledgment, release timing, stalled continuation frames and mixed touch/pointer cancellation.
- Final targeted command: `node --test tests/landing-entry-scroll-assist.test.mjs tests/landing-scroll-continuity.test.mjs tests/landing-model-gesture.test.mjs`: 59/59 passed, no skips.
- Final aggregate `npm run typecheck` and full `npm run lint` passed after the pointer-stream refinement and final harness corrections.
- Existing offers harness discovery lists 32 cases across Chromium/WebKit; no browser was launched locally.
- Final full Node suite: 2,087 passed, two environment failures and six skips. Failures are the IPv6 owner-console startup request (`UND_ERR_SOCKET`) and the Git-dependent production asset validator in this snapshot without `.git`; neither is reported as passing.
- Production build and hosted asset/LFS/browser checks remain exact-SHA integration gates. The local snapshot's external dependency symlink is unsuitable for the known Turbopack root restriction; no alternate browser route or heavy dependency-copy workaround was attempted. Physical-device acceptance remains pending.

Unchanged App SHA-256: `8bfe2ec3dc5014be874bcd8f9b7271f679c9af87b8f8399a512763cb31be3e0a`.

Unchanged SceneDirector SHA-256: `c48b3454a2e6e9b47b8ab0a3ff93df56bdb3d9c89dcae112d0a8e41d9158b224`.
