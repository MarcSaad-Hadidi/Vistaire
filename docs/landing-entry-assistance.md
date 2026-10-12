# Bounded entry assistance and restaurant fog correction

## Entry assistance

The original8db behavior below is historical. The current stronger phase-completion behavior and its validation limits are documented in [landing-scroll-assistance.md](landing-scroll-assistance.md).

The native document scroll still owns position and the existing cinematic timeline. After a trusted wheel, keyboard or touch gesture has stopped near the end of a section entrance, a single browser smooth-scroll can finish that entrance. The proximity is bounded by 160 CSS pixels, 22% of the stage height and 12% of the transition distance. Direction is respected, and a gesture cannot complete multiple sections.

New input, focus, navigation, layout changes, opening a menu/dialog, AR, document hiding and reduced-motion preference cancel the assistance. Interactive controls and the offers/FAQ/footer reading area are excluded. No input-device classification, wheel delta scaling, extra RAF loop or scene interpolation was added.

Where available, native document `scrollend` is used. Older browsers use 280 ms without scroll/input after release; that is a conservative heuristic, not proof of physical Safari inertia completion. Hosted wheel, reverse, interrupt and reduced-motion cases accompany the unit tests. Real trackpad, mouse and phone feedback must use the same preview SHA; no hardware smoothness claim is made from unit tests.

## Section movement refinement

The approved hand reveals itself with a stable meaningful orientation. The ordinary chapter blend previously rotated appearing/disappearing subjects toward an unrelated next/previous chapter default even when that other endpoint had zero scale. The measured examples include about226 degrees of plate rewind on features → encryption and about192 degrees for a flipped stand on encryption → grip.

The render-composition helper now retains the visible endpoint's orientation during the existing scale reveal/hide. It reuses the same two authored endpoint evaluations. Translation, scale, camera, focus/copy, timing, the existing C2 curve, opening choreography and pricing hand are unchanged. At exactly zero scale the hidden coordinates may reset, while the complete rendered world transform remains continuous. Both-visible subjects retain their authored interpolation. The refinement requires a finite, positive-sized endpoint frame fully inside the stage; cropped, missing or invalid frames keep their exact authored motion. This deliberately preserves the already cropped dish/laptop poses in the recorded short landscape layout rather than worsening clipping. The focused projection analysis compared 37,884 samples and 61,096 visible subjects across seven recorded layouts with no new or worsened clipping/contact and bit-identical cameras; this finite analysis does not replace browser or physical-device acceptance.

Tests exercise the actual Scene composition, forward/reverse replay, user flip/yaw, endpoint world-vertex continuity and the existing camera/near-plane/reset contracts. Hosted tests retain real quaternion/bounds evidence and screenshots at390/1440px. This is a specific movement correction, not proof that every transition or physical-device frame rate is already satisfactory.

## Restaurant color

The approved lower-section HDR room capture blends linear fog before tone mapping. The main canvas previously blended display-space fog after tone mapping. The room-material hook now converts a display-uploaded fog uniform back to linear where required and places the existing fog operation before the existing tone-map/output operations. HDR targets keep their already-linear fog uniform. Shared room materials and foreground fade clones receive the same hook.

No light, exposure, texture, gradient, geometry, camera, postprocessing pass or render target is added or changed. This corrects the identified fog-order mismatch, not all possible transparent-surface blending differences between per-material canvas output and the HDR capture. Hosted shader compilation and retained pixels of both views remain required before visual acceptance.

## Regression fixes

- Delayed mobile svh/lvh orientation resolution is consumed from the existing probe sizes through ResizeObserver; touch toolbar-only changes remain frozen after resolution
- Keyboard reading at the ends of the fixed phone portal explicitly continues the page instead of depending on browser scroll chaining
- A projected-hand readiness marker is cleared on exit and set only after current HTML projection publication
- Studio screenshot journeys are split into bounded cases without deleting assertions or increasing deadlines
- The composition checksum follows the independently reviewed cache-readiness benchmark protocol; historical workload hashes remain distinct

- The hidden fixed pricing portal omits its Studio image URL until measured pricing approach; the existing early laptop/dashboard request assertions remain intact
- Obsolete lower-section browser selectors are mapped to the current phone, FAQ and compact footer while retaining pricing routes, native-touch and accessibility checks
