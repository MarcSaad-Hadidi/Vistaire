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

## Before opening a PR

Run:

```bash
npm run assets:check
npm run lfs:check
```

If either command fails, move the asset out of Git or add a reviewed exact
exception. Do not bypass the guard with `git add -f` unless the exception has
already been documented and approved.
