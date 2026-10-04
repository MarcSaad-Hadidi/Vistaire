# Vistaire repo asset policy

This policy exists to keep Vistaire deployable and reviewable. It is a P0
guardrail for Git history, LFS usage, and generated media. Existing large files
on `main` are grandfathered exceptions, not precedent.

## What belongs in Git

- Source code, tests, scripts, config, and docs.
- Lightweight JSON manifests and metadata.
- Lightweight SVG/WebP posters when they are intentional runtime assets.
- The two current optimized hero scrub videos while the hero depends on them:
  `public/videos/optimized/upscaled-video-desktop-scrub.mp4` and
  `public/videos/optimized/upscaled-video-mobile-scrub.mp4`.
- The reviewed Vistaire PR #45 landing hero runtime video:
  `public/videos/Vistaire2.mp4` (max 34,449,258 bytes,
  sha256 `e4a89ed6ab21f55f60c9ee33a676ea2292bae5b6ecef09efefcf3173a6e85e29`).
- Existing demo runtime assets already on `main`, until a separate migration
  moves them to storage/CDN.
- The three reviewed, optimized `/demo` mobile menu walkthroughs listed below.
  Their raw recordings and review output stay outside Git.

## What does not belong in Git

- New source drops or generated exports under `3D Plat/` or `3D photo/`.
- Work/review output under `asset-review/`, `assets/3d/source/`, or
  `assets/3d/work/`.
- New GLB, USDZ, MP4, MOV, WebM, ZIP, PSD, AI, FBX, OBJ, or Blend files without
  an explicit review.
- Production restaurant model binaries under `public/models/restaurants/**`
  unless they are reviewed, budgeted, and allowlisted.

## Storage and CDN

New large runtime assets should normally be uploaded to storage/CDN and
referenced through stable URLs. Git is not the delivery pipeline for heavy
client-specific 3D, source models, review renders, or raw video exports.
`.vercelignore` also excludes local source drops from deployment uploads.

## Git LFS

LFS is file-specific only in this repo. Do not add broad rules such as
`*.glb filter=lfs`, `*.usdz filter=lfs`, or `*.mp4 filter=lfs`.

No public runtime asset should be required through Git LFS. The former heavy
ravioles source USDZ was removed from the public deploy tree because Vercel
clones can fail before build when GitHub LFS bandwidth is exhausted. Future
heavy USDZ/GLB files must go to storage/CDN, or through an explicit reviewed
non-public asset workflow, so LFS cannot block Vercel clone or checkout.

## Thresholds

- Default hard review threshold: 5 MiB.
- Dangerous extensions are blocked unless allowlisted, even below 5 MiB:
  `.glb`, `.gltf`, `.usdz`, `.fbx`, `.obj`, `.blend`, `.mp4`, `.mov`,
  `.webm`, `.zip`, `.psd`, and `.ai`.
- PNG/JPG/WebP files are allowed only when they are reasonably sized and are
  actual runtime images. Generated source folders are blocked separately.

## 3D workflow

1. Keep source and work files outside Git or in ignored local folders.
2. Run optimization and validation locally.
3. Put reviewed manifests and lightweight posters in Git.
4. Put heavy GLB/USDZ production assets in storage/CDN, or request an explicit
   temporary allowlist exception in `scripts/check-large-files.mjs` with
   `owner`, `reason`, `maxBytes`, and `sha256` checksum.
5. Never promote `review` assets to published client surfaces without a
   separate production approval.

## Hero video workflow

1. Do not commit new raw exports.
2. Optimize locally.
3. Keep the current hero scrub files only while they are referenced by code.
4. Keep `public/videos/Vistaire2.mp4` only while the promoted Vistaire landing
   explicitly depends on that exact runtime video.
5. Any new hero video must pass network/performance review before it is
   allowlisted.

## Demo menu walkthroughs

Reviewed on 2026-10-03 for the requested `/demo` restaurant presentation.
Owner: `MarcSaad-Hadidi`. Each silent H264 clip shows the real published menu
at phone size, including one loaded and manipulated 3D dish. Runtime exports
are 780 × 1688, 24 fps, with MP4 faststart; their WebP posters live
under `public/images/demo-walkthrough/`. Browser playback, visual frames and
3D loading were reviewed before adding these exact exceptions.

The HD captures preserve the original action sequences and loop durations.
Their native double-density rendering and higher encoding quality address the
requested improvement in text and image clarity.

Each video has a maximum budget of **8,388,608 bytes**. No wildcard exception
or LFS rule is permitted. New versions require another review and checksum.

| Runtime file | Reviewed bytes | SHA256 |
| --- | ---: | --- |
| `public/videos/demo/maison-elyse.mp4` | 4,053,916 | `179465b86ac821e3e4aef6a0669f055334d7f87610d7db30a1486b1d73c8ec6a` |
| `public/videos/demo/trouvable.mp4` | 7,031,957 | `223505b2c8eee29a1f6aa59726fe215badfeecf1775e7917831fe963c6a5138c` |
| `public/videos/demo/sauge-noire.mp4` | 7,772,626 | `98dec39df7c10ac9036f0c0c533a8e2d80baae88370d950a92da651aa76a3089` |

These exceptions cover only the optimized files served by `/demo`.
Playwright WebM recordings, screenshots, scripts and intermediate encodes do
not belong in the repository. Native iPhone/Android AR has not been validated
by the desktop recordings.

## Before opening a PR

Run:

```bash
npm run assets:check
npm run lfs:check
```

If either command fails, move the asset out of Git or add a reviewed exact
exception. Do not bypass the guard with `git add -f` unless the exception has
already been documented and approved.
