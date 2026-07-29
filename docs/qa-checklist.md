# Vistaire QA Checklist

Use the smallest checklist that proves the change.

## Baseline Checks
- `npm run assets:check`
- `npm run lfs:check`
- `npm run lint`
- `npm run typecheck` when present
- `npm run build`

## Targeted Logic Tests
Run `node --test tests/*.test.mjs` or a narrower `node --test tests/<file>.test.mjs` when touching logic covered by tests.

## Route Smoke Checks
Use browser DevTools or Playwright for routes affected by the task. Common smoke routes:
- `/`
- `/demo`
- `/demo`
- `/admin` when admin preview changes
- `/owner` when auth or owner surfaces change

## DevTools Checks
- Console has no unexpected errors.
- Network has no obvious 404/500 assets.
- Mobile viewport has no horizontal overflow.
- Hydration warnings are not introduced.
- Hero media still loads from approved paths.
- GLB/USDZ files are not fetched before user intent unless an approved existing preload explains it.

## Asset And AR Checks
- For repo safety, use `docs/repo-asset-policy.md`.
- For AR asset preparation, use `docs/ar-asset-optimization-pipeline.md`.
- For USDZ and real-device limitations, use `docs/usdz-optimization.md`.
- Report iPhone Safari Quick Look and Android Scene Viewer as verified only when tested on real devices.

## Playwright
`npm run test:e2e` uses `npm run start`, so build first unless testing against an already running compatible server. Keep broad or diagnostic Playwright suites out of default CI until they are stable enough for required checks.

### Sauge Noire
`npm run test:sauge-noire:smoke` vérifie dans Chromium les routes critiques déterministes : ouverture d'une section, menu vers fiche puis retour, plat suivant/précédent et montage de la 3D après intention utilisateur. Les anciennes suites diagnostiques basées sur les gestes synthétiques, les phases PageFlip, les transforms ou les timings précis ne doivent pas être restaurées.

Les corrections visuelles Sauge Noire peuvent être validées avec une Preview Vercel, un vrai appareil contrôlé par le propriétaire, puis `npm run lint`, `npm run typecheck` et `npm run build`. Le propriétaire vérifie manuellement le défilement, PageFlip, la typographie, la devise, la traduction et le responsive, notamment à 390 px et 430 px. Ces vérifications manuelles ne doivent pas être présentées comme une validation GitHub Actions.

Un nouveau test E2E n'est pas obligatoire pour chaque correction. Un scénario E2E Sauge Noire ne devient bloquant que s'il vérifie un résultat utilisateur déterministe, se reproduit en CI, réussit cinq fois de suite localement et n'utilise ni geste tactile synthétique trompeur, ni assertion sur une frame, une phase ou un état transitoire exact de PageFlip.

## Cleanup
- `git status --short` reviewed.
- No generated `.next`, `test-results`, `playwright-report`, screenshots, videos, traces, or temp files left behind.
- No `.env`, secret, debug log, or unreviewed asset added.
