# Model Lab, 3D/AR and dependency audit

Audit base: `2220762673087226f7ed914d8aca97f13d3baa78` (`origin/main`).
Scope: remove unreachable legacy code and unused direct dependencies; narrow
Model Lab's server packaging without changing its worker or public 3D behavior.
No public media, model, demo data, route, auth guard or active viewer is changed.

## Verified runtime paths

- `/owner/model-lab` is reachable from the owner portfolio navigation and
  dashboard. Its authenticated page mounts `ModelLabClient`; config, inspect
  and optimize routes are active. Model Lab is retained.
- `optimizeGlb.ts` starts `optimizeWorker.mjs`, which imports glTF-Transform
  core/extensions/functions, meshoptimizer and Sharp. It does not use the
  Meshy CLI or Babylon's USDZ exporter. Its existing limits, timeout, preset
  behavior and optional external gltfpack fallback remain unchanged.
- The owner GLB and publish endpoints call `restaurantMeshyPipeline.ts`, then
  the restaurant Meshy script and GLB/USDZ conversion scripts. Their CLI,
  Babylon, fflate and image dependencies remain necessary and are retained.
- Current dish routes use Maison Elyse, Public, Trouvable and Sauge Noire
  renderers with `DishModelViewer`. The standalone legacy `DishDetail` has no
  application caller. Active Quick Look, Scene Viewer and intent-driven model
  loading are unchanged.

## Deletions and their evidence

| File | Reason |
| --- | --- |
| `components/dish/DishDetail.tsx` | Unreachable legacy detail component; current routes use the renderers listed above. |
| `components/dish/DishDetailHero.tsx` | Only called by the deleted legacy detail. |
| `components/dish/AllergenBadge.tsx` | Only called by the legacy detail and legacy `DishCard`, removed by the architecture lot. Active allergen surfaces are separate. |
| `lib/dishAssetWarmup.ts` | Only legacy detail and legacy `DemoMenuClient` callers; the latter is removed by the architecture lot. |
| `lib/quickLookAssets.ts` | Only the deleted legacy detail imports this old local-USDZ resolver. Warmup carries a separate duplicate. |
| `lib/arEnvironment.ts` | No runtime imports; viewer detection was replaced in commit `e25a9f38`. |
| `scripts/update-frame-config.mjs` | Only regenerates configuration for removed legacy frame heroes. Its sole package command is removed; assets are preserved. |

The legacy source deletion commit must be integrated with the architecture
lot's `DemoMenuClient`/`DishCard` deletions and the tests lot's obsolete-contract
cleanup. The remaining active `DishModelViewer` tests must be preserved.

## Dependencies and scripts

- Remove direct development dependencies `autoprefixer` and
  `@eslint/eslintrc`: PostCSS uses `@tailwindcss/postcss`; ESLint uses native
  flat configuration. ESLint still brings its required eslintrc transitively.
- Lockfile removes only autoprefixer and its unused `fraction.js` and
  `postcss-value-parser` dependencies, plus the two root declarations. No
  existing package version changes. Non-root lock entries fall from 662 to
  659; production direct dependencies stay at 22, development declarations
  fall from 14 to 12.
- `ci/npm-audit-baseline.json` updates only the canonical lockfile SHA-256.
  A fresh `npm audit --json` reports zero advisories; no exception is added.
- Remove `frames:update-config`; update `test:seo` to name the two retained
  pricing suites directly after the tests lot removes their side-effect
  imports and the obsolete pillar-animation suite.
- Keep GSAP/Lenis (mounted smooth-scroll provider), 3D libraries (active
  renderer/conversion pipelines), Supabase, Brevo, QR and page-flip libraries.
  No dependency is removed solely because its name appears heavy.

## Server packaging

`next.config.ts` gives `/api/owner/model-lab/optimize` its own explicit worker
dependency closure. The two Meshy routes retain their package/script includes
except for the unrelated Model Lab worker. Public assets remain excluded from
these function bundles. Sharp's platform-specific optional packages remain
included, so this is not a Windows-only deployment configuration.

An isolated temporary directory containing only the Model Lab include list
successfully ran the actual worker with a generated textured triangle GLB for
all six presets: source-clean, safe, balanced, target-5mb, ultra and ar-bridge.
Each output parsed as GLB with one mesh and one image; ar-bridge had no required
extensions. The directory contained neither Babylon nor the glTF CLI and was
removed after validation. This checks the subprocess's runtime dependency
closure rather than just matching configuration strings.

The measured Model Lab NFT manifest fell from 15,133 entries /
133,901,764 bytes to 666 entries / 38,784,076 bytes. It contains no Babylon and
only a nested meshoptimizer copy under the CLI directory, not the CLI itself.
These are local trace sums, including duplicate manifest entries, not deployed
compressed function sizes. The final integration measurement is authoritative.
The second build after the final clean npm install reproduced these figures.

The local Meshy trace grew because this installation contains optional Sharp
WASM/emnapi files absent from the baseline installation. All added files were
already covered by unchanged Meshy globs; the only removed file was the Model
Lab worker. No Meshy size improvement is claimed. Removing incidental npm
bundled metadata did not remove this installation difference.

## Validation and limits

The Windows npm launcher is broken in this environment. Package commands were
run through `node E:/Stocks/Node/node_modules/npm/bin/npm-cli.js` (Node 25.2.1).

- `npm ci --no-audit --no-fund`: passed with the final minimal lockfile.
- `npm audit --json` and `node scripts/ci/check-npm-audit-baseline.mjs <report>`:
  passed, zero vulnerabilities, baseline entries remain empty.
- `npm run assets:check`, `npm run lfs:check`, `npm run lint`,
  `npm run typecheck`, `npm run build`: passed before legacy source deletion.
- `node --test tests/dish-asset-warmup.test.mjs tests/dish-detail-intent.test.mjs
  tests/ar-experience-state.test.mjs tests/model-lab-before-after-sync.test.mjs`:
  41/41 passed before edits.
- `node --test tests/model-lab-before-after-sync.test.mjs
  tests/ar-experience-state.test.mjs tests/owner-prepared-glb-workflow.test.mjs`:
  31/31 passed after the dependency/configuration changes.
- `node scripts/ci/check-static-public-import-boundary.mjs`,
  `node scripts/ci/check-static-public-routes.mjs`, and
  `node scripts/ci/check-public-prerender-artifacts.mjs`: passed.
- Independent review found no P0/P1 problem and confirmed the runtime closure
  and dependency removals. It identified the existing trace-source contract
  that assumes a shared route list; its update belongs to the tests lot.

Final typecheck/build, the full Node suite and browser QA are run by the
orchestrator after combining the source and test deletions. They cannot be
claimed from this isolated source-deletion commit: the obsolete menu callers
and contract tests still exist on this branch until integration. No local
authenticated owner-browser session, physical iPhone/Android AR test or Vercel
deployment was performed; cross-platform deployment remains to be verified.
No active UI behavior was rewritten. No new framework, test dependency,
production abstraction, secret or generated media was added.
