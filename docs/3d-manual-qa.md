# Vistaire 3D Manual QA

Automated validators prove structure, headers, budgets, and runtime safety.
They do not prove visual identity by themselves. A production candidate is
rejected until source and candidate have been rendered and compared with real
before/after/diff artifacts for web, mobile, and AR-lite.

The phrase "exactly the same visual" must be treated as: "visually
indistinguishable under deterministic multi-angle mobile dining-distance review
within strict thresholds." Do not approve pixel-perfect or absolute-identity
claims.

## Visual Identity Review

- Review web, mobile, and AR-lite before/after/diff artifacts.
- Review each deterministic angle, not only a hero angle.
- Confirm SSIM and perceptual scores meet the strict manifest thresholds.
- Reject blurry textures, silhouette changes, color drift, cheap-looking
  materials, broken scale/origin, visible low-poly simplification, or any loss
  of appetite appeal.
- Reject USDZ proxy packages, poster placeholders, and AR-lite copies presented
  as optimized production assets.
- Record the human reviewer, approval date, report path, and notes before
  publication.
- If budgets cannot be met without visible loss, keep the previous version and
  request artist retouching, retopology, texture baking, or manual source
  simplification.

## Chrome DevTools

Check `/`, `/demo`, `/demo`, and any affected production
menu route at 375px, 390px, 430px, and desktop.

- Console has no unexpected errors.
- Network has no unexpected 404/500 responses.
- `document.documentElement.scrollWidth - document.documentElement.clientWidth <= 2`.
- No `.glb` or `.usdz` request appears before explicit 3D/AR intent.
- After `Voir en 3D`, the selected GLB loads once.
- Desktop does not fetch USDZ.
- GLB uses `Content-Type: model/gltf-binary`.
- USDZ uses `Content-Type: model/vnd.usdz+zip` and `Content-Disposition: inline`.

## iPhone Safari

Use a real iPhone over HTTPS. Do not report this as validated from desktop
Chrome, Playwright, or an iOS user-agent override.

- Open the dish page in Safari.
- Confirm no USDZ loads before intent.
- Tap the AR control only after the 3D panel is open.
- Confirm Quick Look opens, scale is credible, object is grounded, and the dish
  appears in front of the user.
- Record the exact device, iOS version, Safari version, network type, manifest
  version, and USDZ URL.
- Repeat on WiFi and cellular.

## Android Scene Viewer

Use a real Android device with Chrome and ARCore support.

- Confirm only AR-lite GLBs are offered for Android AR.
- Confirm unsupported Android browsers fall back to local 3D copy.
- Confirm Scene Viewer opens only after intent.
- Confirm the dish is grounded, correctly scaled, and visually acceptable.
- Record the exact device, Android version, Chrome version, ARCore availability,
  network type, manifest version, and GLB URL.
