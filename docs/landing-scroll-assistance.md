# Bounded native scroll assistance candidate

## Scope and provenance

This candidate starts from the supplied published `8db3be1` runtime snapshot, copied from `vistaire-transition-validation`. That snapshot contains no `.git`, so the source identity below is verified by SHA-256 rather than a locally verifiable Git commit.

Only `EntryScrollAssist.js`, its existing node test file, and this document change. App, Scene, SceneDirector, authored camera/hand choreography, assets, native distance, and browser input deltas remain unchanged. No dependency or animation loop was added.

## Why the original could feel weak

The published assistance limit was `min(160px, 0.22 × frozen stage, 0.12 × measured transition)`. At the default pace every eligible handoff spans 3.2 stages. A stage of 844px therefore permits assistance only in the last 160px of a 2700.8px handoff, or the last 5.92%.

Two additional activation defects were reproduced deterministically before fixing them:

- A previously clicked button/link remaining focused blocked a subsequent wheel or touch gesture aimed at the scene. Persistent focus protection now covers editors, sliders, media, dialogs and menus. The broader gesture-target exclusions remain unchanged, including keyboard events aimed at a focused button/link.
- A same-direction input tail with no additional pixel movement erased the real native movement already observed. That movement now survives until the same input type and direction settle. Switching input types requires fresh matching native movement. Reversal, controls, navigation and completion still consume/cancel it; residual packets without fresh native motion cannot rearm a completed assist.

These are real source-level defects, but neither is established as the cause of a particular user's session.

## Movement contract

After trusted native scrolling settles, exactly one existing phase may complete:

1. **Section ending:** within the final `min(360px, 0.45 × frozen stage, 20% of the interval between measured handoffs)`, finish to that section's existing exit-start pose. Reverse movement mirrors this to its first reading pose. This does not automatically continue through the next handoff.
2. **Cinematic handoff:** once at least half the measured handoff has already been traversed in the requested direction, complete to its adjacent stable reading pose. The remaining automatic travel is capped at `min(50% of the handoff, 2 × frozen stage)`.

The short end-of-section finish deliberately stops before the next handoff. A subsequent native gesture must commit to that transition before its own assistance can complete it. This preserves one authored phase per completion instead of automatically joining two phases.

Pricing/FAQ/footer reading and both pricing-related transitions are excluded. The opening AI/phone holds remain separate intervals; assistance never consumes an entire hold or chains through it. Fresh wheel, touch, key, pointer or control input stops the helper's own smooth scroll immediately. Native scrolling outside the helper is never forcibly stopped.

## Quantitative boundaries

These are source-derived geometry calculations using the published SceneDirector and existing deterministic stage fixtures, not new browser or physical-device captures. All values below use default pace and an 844px frozen stage.

| Eligible handoff | Start | Stable end | Published maximum remainder | Candidate maximum remainder |
| --- | ---: | ---: | ---: | ---: |
| hero → ai | 0 | 2700.8 | 160 | 1350.4 |
| ai → wearable | 4388.8 | 7089.6 | 160 | 1350.4 |
| wearable → features | 8355.6 | 11056.4 | 160 | 1350.4 |
| features → encryption | 17808.4 | 20509.2 | 160 | 1350.4 |
| encryption → grip | 23885.2 | 26586 | 160 | 1350.4 |
| grip → sustainability | 29962 | 32662.8 | 160 | 1350.4 |
| sustainability → testimonies | 36038.8 | 38739.6 | 160 | 1350.4 |
| testimonies → social-content | 42115.6 | 44816.4 | 160 | 1350.4 |
| social-content → product | 51568.4 | 54269.2 | 160 | 1350.4 |

The same default handoffs at a 900px stage permit 1440px instead of 160px; at a 932px stage they permit 1491.2px instead of 160px. At 844px with the slowest 0.25× preview pace, a handoff is 8271.2px long but automatic travel remains capped at 1688px, requiring approximately 79.59% native progress. At 4× preview pace the handoff is 1308.2px and the cap is 654.1px.

Tests exercise both directions, all nine handoffs, the section-ending boundary, and slow/fast preview geometries. Requested path samples remain wholly inside the same authored phase. These spatial checks do not measure browser frame timing or projected on-screen velocity.

## Activation and timing limits

The caller still disables assistance while the scene is unready or in GPU fallback, a menu/modal/AR session is open, or reduced motion is requested. Hidden documents, protected focus, excluded input targets, synthetic inputs, direct anchors and programmatic positioning remain excluded. Input without first matching document movement expires after 600ms.

Native `scrollend` owns settlement where supported. Older browsers without it use the existing conservative 280ms quiet interval, restarted by native input/scroll and only after physical touch/key release. That fallback cannot prove physical Safari inertia has ended.

The implementation uses one platform-native smooth scroll. It does not control duration/easing, scale input, classify input devices, or run a spring/RAF smoother. The two-stage spatial ceiling prevents a full multi-stage handoff being launched from its beginning, but does not certify film-like velocity: browser timing may make a longer completion faster. Smoothness, elapsed duration and projected movement speed still need browser/physical-input verification. No device-performance acceptance is claimed here.

## Existing published Chromium failures remain separate

The retained published offers-test artifacts report a 39.8px remainder at 390px forward and a 40px remainder at 1440px reverse after 15 seconds. Both were already inside the original 160px limit. Their snapshots show document-level active focus and their fixture sends one wheel event, so neither widening the zone nor the two reproduced activation fixes can honestly be claimed to resolve these cases without a new observed run.

The artifacts contain no per-event helper lifecycle. Input target, scene-ready publication, native/compositor position before JS input delivery, first-scroll delay, programmatic scrollend ordering, and ResizeObserver cancellation remain possible explanations. Future diagnostics should capture those actual values rather than assign a cause from the threshold alone.

## Verification

- Published baseline: helper/integration tests 8/8 passed.
- New stale-focus and no-pixel-tail regressions each failed before their production fix.
- Expanded section/transition tests failed before the movement change.
- `node --test tests/landing-entry-scroll-assist.test.mjs tests/landing-scroll-continuity.test.mjs tests/landing-model-gesture.test.mjs`: 40/40 passed, including 12 helper/integration cases.
- `./node_modules/.bin/eslint components/immersive/EntryScrollAssist.js tests/landing-entry-scroll-assist.test.mjs --max-warnings=0`: passed.
- `npm run test:node`: 2061 total; 2053 passed, 2 failed, 6 skipped. Failures: `console: IPv6 startup URL serves authenticated requests` (local fetch/socket failure), and `3D pipeline branch does not add public media binaries or wildcard LFS rules` (the source snapshot has no `.git`). No socket retry or bypass was attempted.
- The full node run preceded the final same-input-type safety refinement; the final 40 targeted tests and targeted lint were rerun afterward. The failed local socket check was not retried.
- No browser launch, browser/socket workaround, build, publish, or production operation was performed. Full lint/typecheck/build, assets/LFS and browser acceptance remain integration checks; the isolated source snapshot is not the final integrated application.

## File identities

Published helper SHA-256: `46c40b7ee86ed8865d0242cbb6b2b9f11554abd9dc7a7103335aff2cda62f870`.

Candidate helper SHA-256: `321883a1367abc35d418888ab5e62c4c2cf52aa1ceab6d148f01dfc472274f8f`.

Candidate helper tests SHA-256: `e993ae70ddd471b4f47b9922d8809776ab823395e77b18cef9ac074e6b16b571`.

Unchanged App SHA-256: `e944053ea56973294975ee0d48237ce2a78a699935d41813f5329f2f41547e90`.

Unchanged Scene SHA-256: `48962fe3a122213e34a0045d3ee902895904b81669ac5e05ff0aecb2e383ea9e`.

Unchanged SceneDirector SHA-256: `c48b3454a2e6e9b47b8ab0a3ff93df56bdb3d9c89dcae112d0a8e41d9158b224`.
