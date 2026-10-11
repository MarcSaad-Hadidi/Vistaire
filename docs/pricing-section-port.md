# Landing offers and closing sections

Source: [Vistaire PR #297](https://github.com/MarcSaad-Hadidi/Vistaire/pull/297), checkpoint commit `5b0f966c2cbb65ca0eceebe0f430a8c52631c65c`, `docs/checkpoints/vistaire-sites-2026-10-11/project/src/Pricing.jsx` and its lower-section helpers. The checkpoint's published Site predates its final source changes and is not visual verification of this port.

## Scope

- Four collection cards in the original hand-held native phone, followed inside the same screen by the common monthly subscription and optional Pilotage preview
- External full-pricing, meeting and dashboard-presentation links
- Existing shared FAQ component and same-origin question service, followed by the complete existing footer navigation
- French and English labels; keyboard focus/reversible native-page reading; unchanged complete pricing routes and conditions

Prices come from the current `lib/pricingPage.ts`, not duplicated source constants. The landing retains “À partir de” / “From”, CAD, taxes extra and the initial 12-month commitment. Setup minimums remain 2,000 / 2,050 / 2,100 / 2,200 CAD, with 200 CAD monthly and optional Pilotage at an additional 100 CAD monthly. The longer inclusion/production/terms detail remains on the existing complete pricing page.

The existing cinematic scheduler, main camera, restaurant assets/geometry, table anchoring, production data, authentication and backend are not replaced by the checkpoint. Only the lower hand scene borrows the existing renderer and existing phone model. Its temporary renderer state is restored after each submission, including failure paths.

## Exact hand asset provenance

- Runtime path: `public/immersive-assets/pricing-hand/fair-hand-grip-v3.png`
- Source: owner-supplied front-facing hand PNG, recorded in the PR #297 checkpoint asset manifest and hand provenance
- Verified download: `https://vistaire-actuel-fluide-e820d3.plumtuna4.chatgpt.site/assets/pricing-hand/fair-hand-grip-v3.png`
- Dimensions: 1071 × 1469
- Bytes: 1,101,344
- SHA-256: `8f3254bd90ca10e189596207f23a910edc90ef056976fa95805c94a01c1e0a31`
- The PNG is copied byte-for-byte. The photographed phone rectangle is masked in the shader so the existing real iPhone model, rounded screen, case, island and live accessible HTML occupy it. No new phone GLB is imported
- The source's production fair-hand branch always samples the final captured product/camera tracks. Exact decoded Float32 final-pose values are retained in the helper; unused old hand skeleton/atlas/animations are excluded
- Track verification sources: `product_animation.buf`, 2,964 bytes, SHA-256 `5ff003d014d597a49baaee763f80a05062c030cdbba611d5281620147f3d88f1`; `hero_camera.buf`, 2,360 bytes, SHA-256 `630dec10376945e410eb0cbc8d2f873c9fa4eef562108bf5032a92d4fcefd9cc`. Both verified against the checkpoint manifest, used to extract the final pose, and not shipped as new runtime dependencies

## Reused images

The four offer photos remain the current `HOME:pricing:*` marketing assets. Pilotage reuses the approved genuine public-demo Studio screenshot at `/images/demo-walkthrough/dashboard-studio.webp`, with an explicit fictional-demonstration-data label. It does not mount an admin dashboard or expose private restaurant data. The checkpoint's separate code-rendered Studio illustrations are not imported.

## Reading and interaction contract

The native page owns all scroll input. Phone content has a measured, non-scrollable-by-gesture viewport; the latest native page position sets its offset. Reading starts after the hand entry plus a short lead. Keyboard arrows, Page Up/Down, Home/End and focused links resolve back to native page positions. Reverse scrolling restores the corresponding offer. There is no independent wheel/touch handler, second WebGL context, or permanent animation loop.

Phone and action layers start hidden/inert until presented. The HTML transform derives from the actual phone screen mesh. Failure to render the hand retains a readable CSS phone fallback. Full-pricing links remain native links; FAQ uses the existing accessible component and `/api/public/faq`.

## Verification status

New pure behavior tests were run red before implementation, then passed: native-scroll inversion/entry/reverse/idle writes and exact hand bytes/native screen projection. Existing pricing/locale tests passed before editing. Integration browser evidence and repository-wide final checks belong to the complete App/Scene integration; no physical-device FPS or AR validation is claimed by these pure checks.


## Intentional lower-background and resource contract

The requested source design keeps a single room backdrop behind the offers,
FAQ and compact footer. The former large footer CTA/product frame is removed;
complete navigation, contact, social, share and offer-terms links remain. The
footer retains a one-viewport minimum so the final native anchor is reachable.
The original cinematic scene resumes when scrolling back above the offers.

The cache is captured only after the existing main transforms/framing pipeline
has composed the same measured pricing-entry pose, regardless of entry history.
A current-ready marker records capture generation, physical buffer dimensions,
theme and canonical camera/projection identity. Reused pixels are not new draws.

The HDR target is allocated lazily, capped by the existing four-million-pixel
buffer, and released on reverse exit/unmount. At the cap, RGBA16F color storage
is approximately 32 MB plus depth and implementation overhead. This is an
allocation estimate, not measured VRAM. Unsupported float targets, incomplete
framebuffers or shader failures select the semantic phone fallback instead of
quantizing the linear HDR room into an unverified 8-bit texture. Existing context
loss behavior falls back to the video/semantic presentation; automatic WebGL
restoration is not claimed.

External on-photo text retains light readable tokens and a translucent dark
surface in either theme; the phone keeps its own light/dark surface. Browser
projection, theme, input and visual acceptance remain hosted checks. The earlier
restaurant file savings do not establish a net GPU-memory or FPS improvement
for this different lower-section design.
