# Vistaire optimized Sites checkpoint — 2026-10-11

Draft checkpoint requested by the owner at 17:46 America/Toronto. Work stopped
at that point. This preserves the complete standalone Sites application source,
including the last unpublished edits. It does not replace the repository's
Next routes, modify PR #296, merge a change or publish another Site version.

The preceding public version is v15:
https://vistaire-actuel-fluide-e820d3.plumtuna4.chatgpt.site

Its source commit was `ed311f20ba524989114c8e6225137cf5f138ed32` in the independent
Sites repository. The ten pending source/test files are also included here.

## Included work

- Demand-driven shared 3D renderer, native scroll, original video/model quality
  and the existing chapter timing adjustments.
- Fair hand holding the real 3D phone, four collection photos/prices, 200 CAD/month
  menu subscription and optional Pilotage +100 CAD/month Studio illustration.
- External pricing/appointment/dashboard links, shared public navigation,
  bilingual routes, theme persistence and Studio dark/light screens.
- Unpublished CSS correction for pseudo-elements inside `:is()`: the light-mode
  room shade previously disappeared only when pricing activated.
- Unpublished button/copy contrast changes, compact numbered menu, and removal
  of the empty decorative setting from the presentation and its donor geometry.

## State of verification

The latest observed production build completed and verified all eight exact
runtime GLB/MP4 files. It ran before the final table metadata edit; no final
checkpoint build is claimed. The earlier public-theme/pricing Node run passed
11 checks, including SSR of 52 FR/EN routes. Subsequent menu click assertions
were added but not rerun before stopping.

The new `tests/theme-continuity.test.mjs` ran 3 checks: 2 passed, 1 failed on
floating-point scroll equality (`0` versus `1.2789769243681803e-13`). It remains
unchanged as requested. Its full numerical frame matrix did not complete.

User screenshots were inspected. No current-head browser/DevTools check,
frame-by-frame rendered acceptance, mobile-device verification or hardware FPS
measurement was performed. Visual contrast, click targets, transitions and the
new menu therefore still need rendered verification. This is not merge-ready.
Repository-wide Next validation was not run: the checkpoint is the separate
Sites source, not an integration into the Next application.

## Reproduce the standalone source

The media are represented by exact byte lengths/checksums and their currently
published CDN URLs in `project/checkpoint-assets.json`; no large model, video,
source drop, QA capture, build output, credentials or LFS rule was added to Git.
The asset URLs must remain available and unchanged. A mismatched or unavailable
asset causes restoration to fail rather than accepting a different version.

```bash
cd docs/checkpoints/vistaire-sites-2026-10-11/project
node scripts/restore-checkpoint-assets.mjs
npm ci
npm run build
node --test tests/public-site-theme.test.mjs tests/pricing-update.test.mjs
node --test tests/theme-continuity.test.mjs
```

`project/.openai/hosting.json` records the existing Site identity for source
provenance; it is not a request to deploy. Historical QA documents inside
`project` describe their own earlier versions and are not current acceptance.
