# Continue to the next authored reading stop

## Physical evidence and root cause — PR #300, 2026-10-13

The production baseline was `29019017aa14a7793968691abb17594c5d41032d`. The user's iPhone Safari trace (recorded `Version/26.6.1`, session `1d8fdc86aei`) showed the full scene ready, reduced motion off and no scene fallback. Its last trusted document scroll reported y=1594 at 14506ms; scrollend reported y=1595 at 14599ms, before the final document scroll at 14615ms. The controller consumed the gesture when the final position lacked that acknowledgement, so no assistance followed.

The first physical candidate preserved that gesture but exposed per-frame instant-write echoes: a write immediately read back 1397, then a trusted scroll reported the preceding position 1395 before acknowledging 1397. Candidate 2 waited for those acknowledgements. The phone then completed stops, but the user reported vibration, slow travel and intermittent starts.

Three complete, retained candidate-2 trips in Safari session `9vur7qehd1o` quantify the delay:

| Destination | Release → handoff | Handoff → completion | Planned logical duration |
| --- | ---: | ---: | ---: |
| Features | 3566ms | 1240ms | 629ms |
| Encryption | 7313ms | 782ms | 393ms |
| Grip | 4414ms | 934ms | 493ms |

The first write followed handoff by 19–34ms in these trips. Differences between immediate JavaScript write readback and the following native event reached 41px; acknowledgement pauses stretched the complete trips to 1.90–1.99 times their logical duration. These differences were not actual reversals in the observed document-scroll sequence: the three complete trips and the retained interrupted reverse trip had monotonic native observations, including repeated positions. Their corroborated native ends already preceded handoff. Waiting for each write acknowledgement therefore introduced pauses even after native momentum had ended. These are instrumented event/position measurements, not displayed-frame or FPS measurements. The two earlier trips have no retained matching completion before the next handoff and are censored; no duration ratio is assigned to them. Dense diagnostic batches omitted some intervals, so absence of a row alone is not proof that an event never happened.

Among 13 retained touch releases in that session, three had corroborated native movement but no handoff before the next touch. Their explicit cancellations were `reverse-observed-motion` at 126108ms and `native-scroll-rejected` at 244257ms and 259226ms. Three other handoffs were cancelled after 17, 90 and 63ms when position advanced beyond the custom engine's expected write. The first advanced from 24212 to 24232 before any assisted write. These failures concern native motion ownership and event ordering; they do not establish proximity as the cause.

Candidate 3.1 used native smooth scrolling before inertia ended. Safari session `uqqwyywk96` retained 14 handoffs, nine completions, four foreign-scroll cancellations and one new-pointer cancellation, with zero reported dropped rows. Its complete trips took 318–350ms. The user rejected that speed and interruption of their motion. Three interrupted forward trips showed actual observed reversals: 6633→5163, 10423→8638 and 24956→21510, without new input or nearby viewport changes. The earlier user report of a backward jump on a new press was not independently reproduced by the one retained pointer cancellation in this session.

WebKit's [March 2026 momentum-scrolling change](https://github.com/WebKit/WebKit/pull/61534), merged as `310169@main`, makes iOS main-frame programmatic scroll requests preserve native momentum using `InterruptScrollAnimation::No`; its tests explicitly cover scrollTo during momentum. We have not identified the installed Safari binary's commit, so this is engine evidence supporting the ownership explanation, not a claim about every Safari version. Safari's official [26.2 release notes](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/) announce scrollend support. The controller detects that capability instead of parsing the user agent.

## One controlled continuation after the native end

A released touch no longer starts programmable scrolling while native momentum is active: the controller requires a matching trusted document scrollend, or 280ms of quiet trusted document position when the event is missing or unsupported. It waits for touch/key/pointer release before starting. A native end can precede keyup or touchend; retaining that evidence never starts assistance while input remains held. New input or a later different native position invalidates it. The existing 40ms input-release guard only prevents an intermediate end inside a wheel-packet train from starting assistance. A native end received before the first or final corroborating document scroll is retained until that trusted, current, matching-direction event arrives. The continuation can then start on the next animation frame; there is no extra deceleration window or stationary-frame test.

The 280ms position-quiet fallback is also allowed when a browser advertises scrollend but never sends it. A pending compositor correction cannot pass the fallback until its own trusted document scroll is observed. Neither waiting path writes scrollTo into momentum or runs an idle animation loop. This deliberate limitation avoids interrupting momentum merely because event delivery pauses. Neither path runs an idle RAF while waiting for native evidence.

Compositor movement can precede wheel/touchmove delivery or arrive before the first touchmove. Pending displacement still needs a trusted document event stamped inside the current input. A continuing same-direction packet retains that pending evidence. The first scroll of a new gesture otherwise measures movement from its input position, so a stale packet or movement inherited from the previous assistance cannot manufacture fresh motion. Synthetic, stale or cancelled motion cannot authorize a handoff. An opposite-direction first movement cannot prove the input. Once matching native movement has been confirmed, a later trusted position correction does not change or erase the input direction. A real touchmove reversal starts a new intent and requires fresh matching native movement, even while the same finger remains down. New input and explicit caller cancellation still discard the preceding gesture.

Safari session `yqktpcj5z6q` reproduced the missed Mac exit: after a confirmed forward release at 66689ms, native position advanced to 32543, reversed to 31870 while the toolbar viewport changed, then reached 35779. The first 74px reversal cancelled the gesture at 73329ms, so its native end at 80317ms found no gesture. No new input or assisted write occurred during that coast. The sustainability test replays these observations and was red before narrowing the direction check to the first unconfirmed movement. It also verifies that an actual touchmove reversal updates the direction and needs its own movement proof. This preserves the eventual Mac handoff; it does not shorten native inertia or claim to fix the cause of the viewport reversal.

Only once native input settles does one RAF write progressive instant positions through a short-ramp `cinematicEase` curve: smooth acceleration and deceleration with a steady middle. Duration is `clamp(650, 580 + 90 × remainingDistance / stageHeight, 1300)` milliseconds, continuous through six screens. A 14%-duration acceleration ramp improves initial responsiveness without changing scene-camera easing. Ordinary frame intervals, including 80–100ms intervals, advance by their actual elapsed time. A single interval above 125ms contributes at most 125ms, avoiding a large jump after a main-thread stall; repeated stalls can therefore extend wall-clock travel beyond the planned duration. There is no native-smooth alternative, acknowledgement queue, per-write wait or second curve framework.

Only trusted, current document scroll events update the continuation's observed position. Immediate scrollTo readback never becomes its ownership reference. Repeated native positions are accepted; real reverse movement or travel beyond the destination cancels. Completion requires the duration to finish and the current position to match a trusted observation within the existing one-CSS-pixel target rounding tolerance. A final write that rounds to an already observed pose needs no new scroll event. Completion consumes the gesture and cannot chain to another stop.

New wheel, touch, key, pointer, click, focus, navigation/layout cancellation, visibility changes, blur, reduced motion or disposal cancels the RAF without writing a reset position. Native input owns the visible pose immediately. Application navigation and layout remaps still call the existing cancel hook. That is also required before any programmatic document movement during a confirmed native gesture: trusted scroll events cannot distinguish an external script from a native position correction. During the controlled continuation, real observed reverse motion still cancels immediately. Actual Safari/Android testing remains necessary to judge visual fluidity; deterministic tests do not measure compositor output.

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

One gesture owns one target. Completion consumes that ownership; an anonymous scrollend without a corroborated gesture never arms a snap or another chapter. At the final cinematic stop there is no forward automatic destination. Pricing/FAQ/footer are not stops, and the existing exclusion once pricing is visible (`scrollY + innerHeight >= pricing.top`) remains in force, including reverse reading gestures there.

## Input, accessibility and viewport safeguards

The current coarse-pointer cinematic journey uses **controlled touch ownership** rather than competing with native vertical page scrolling. While authored scenes are active, the page's main element receives `cinematic-touch-lock` (`touch-action: pinch-zoom` retains zoom). Only the touchmove/touchend capture listeners are non-passive, to cancel eligible vertical swipes. A vertical gesture of at least 12px selects one authored stop and begins one RAF trip at release **without waiting for native document movement or scrollend**. Taps, horizontal 3D drags, multitouch, editing fields, dialogs and blocked scenes never arm this controller. Native panning is restored for pricing, guides, the FAQ and footer. Wheel, keyboard and other inputs preserve their existing protection rules.

The earlier native touch continuation remains a compatibility path outside the coarse-pointer cinematic lock; its success does not prove that the locked gesture path works.

Pointercancel from browser panning releases Pointer Events ownership while preserving an independently valid Touch Events pan. True touchcancel resets the gesture. Hidden pages, reduced motion, blocked UI and natural pricing/FAQ/footer reading remain excluded. The last cinematic stop has no automatic forward destination.

JourneyViewport also freezes toolbar-only reference-height changes on touch landscape widths at and above 768px. Visual stages may cover a growing 100dvh viewport without altering frozen chapter travel; the landing ignores room-only resizes when deciding whether to cancel assistance. Real width/orientation changes and desktop resizing still update geometry. This is independent of the scroll engine; App continues to own measured stops and 3D focus geometry.

A scripted trip advances by **RAF wall-clock time**, not by accumulating capped frame intervals. Missing frames on a busy 3D GPU therefore catch up to the authored destination instead of leaving a section halfway through its transition. A late browser scroll event is acknowledged within a bounded 400ms completion window; no second stop is chained.

## Diagnostics and verification

`?sceneDiagnostics=1` or an explicitly preinstalled `window.__vistaireScrollAssistTrace` consumer enables the existing helper trace. The latter permits lightweight input/scroll diagnostics without enabling Scene's per-frame bounds and serialization work. Reports identify one `mode: "controlled"`, input/release evidence, source/target, planned duration, frame writes and observed completion. The consumer is exception-isolated and owns retention. There is no separate diagnostic scroll engine.

The historical physical-candidate regression cases were revised test-first after the earlier rejection: preserve native momentum through a corroborated end and a gradual controlled trip; cancel an in-flight continuation without a reset write or replay. They also cover forward/reverse movement, repeated observations, ordinary 80ms frame intervals, missing API fallback and trusted final completion. The current correction adds independent regressions for owned vertical swipes without native document scroll, reverse travel, horizontal 3D dragging, tiny taps, restoration of native pricing and long-frame catch-up.

Existing tests retain authored stops, direction, contact/input guards, controls, pricing, reduced motion, viewport behavior and cleanup. WebKit browser QA at 390px also reproduced one native end at 115ms while ArrowDown remained held, followed by keyup at 199–200ms and no continuation. The existing held-input test was observed red after removing its artificial second end; storing the first end while still deferring departure until release makes it pass. This fixes the end-before-release ordering, not the long native coast measured on the iPhone. Three existing cases were observed red before their fixes: `diagnostics distinguish unconfirmed motion, blocked input and the authored destination`, `pending compositor evidence excludes stale programmatic scroll, reverse motion, rejected controls and active assistance`, and `trusted compositor movement delivered before touchmove is credited only by its queued document scroll` (extended to end-before-first-scroll). The diagnostic test also verifies identical behavior with no consumer, an explicit consumer without the Scene flag, an enabled flag and a throwing consumer. Tests tied to the removed acknowledgement/deceleration engines and historical proximity baseline are not retained.

Executed on the frozen candidate:

- `node --test tests/landing-entry-scroll-assist.test.mjs tests/landing-scroll-continuity.test.mjs tests/landing-model-gesture.test.mjs tests/landing-journey-viewport.test.mjs` — **63/63 pass, no skips**.
- `.\node_modules\.bin\eslint.cmd components/immersive/EntryScrollAssist.js components/immersive/JourneyViewport.js tests/landing-entry-scroll-assist.test.mjs tests/landing-journey-viewport.test.mjs --max-warnings=0` — pass.
- `git diff --check` — pass; Git reported only working-copy LF/CRLF normalization warnings.

The integrating lead records the production build, browser console/network QA and physical candidate retests separately. No displayed-FPS or real-device smoothness claim follows from these unit tests.
