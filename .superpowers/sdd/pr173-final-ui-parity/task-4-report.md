# Task 4 report — Full English landing and menu localization

## Outcome

Task 4 localizes the landing comparison, PDF layer, featured dishes, and menu preview data before React projection.

- Landing menu resolution now uses canonical `fr-CA` / `en-CA` locale tags.
- Successful menu resolution keeps `current.preview` instead of the stale fallback preview.
- French and English landing caches remain isolated under concurrent resolution.
- Trouvable demo dishes select typed French, English, or Greek names without leaking French names.
- Stored public-menu dish names now participate in owner generation, readiness, field/source hashes, persisted JSON content, and public application.
- PDF titles, PDF region labels, digital region labels, dish/category image alternatives, and preview status messages come from typed locale copy.
- Featured dish cards and comparison regions declare `fr-CA` or `en-CA`.
- Shared bilingual PDF-preview callers now pass locale through data construction and rendering.

## TDD evidence

RED was observed before implementation:

- English Trouvable returned `Dejeuner classique maison`.
- Landing copy had no typed PDF title/region/status fields.
- English projected image labels remained French.
- Concurrent landing resolution retained stale fallback preview data.
- Featured cards had no canonical `lang`.
- Owner/public translation source and application seams excluded dish `name`.

Initial focused result: 58 passed, 6 failed for the intended missing behavior.

GREEN after implementation:

- Focused combined suite: 65/65 passed.
- Canonical landing contract: 18/18 passed.
- Landing i18n, menu translations/readiness, Sauge data, and Trouvable suite: 53/53 passed.

The concurrent test calls:

`Promise.all([getLandingExperiences("fr"), getLandingExperiences("en")])`

Its `unstable_cache` test double memoizes by fixed key parts and serialized invocation arguments, and assertions cover each restaurant's localized featured name, description, alt, URL, and current preview.

## Changed files

### Landing and PDF localization

- `lib/landing/landingCopy.ts`
- `lib/landing/menuExperiences.ts`
- `lib/landing/publicMenuPreview.ts`
- `lib/pdfComparePreviewData.ts`
- `components/landing/LandingDishStorySection.tsx`
- `components/landing/comparison/LandingActiveMenuPreview.tsx`
- `components/landing/comparison/LandingComparison.tsx`
- `components/vistaire-preview/VistairePreviewPdfCompareSlider.tsx`
- `components/vistaire-preview/VistairePdfToDigitalHoverReveal.tsx`
- `components/vistaire-preview/VistairePdfVsMenuDigitalPreview.tsx`
- `components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.tsx`

### Menu data and stored translations

- `lib/menu/publicMenu.ts`
- `lib/menu/publicMenuRenderContext.ts`
- `lib/menu/publicMenuTranslationReadiness.ts`
- `lib/menu/publicMenuTranslations.ts`
- `lib/owner/menuTranslations.ts`

No schema or migration change was required: the existing generic translation field hashes, task flattening, JSON persistence, and application helpers already support the newly included `name` field.

### Tests

- `tests/landing-i18n.test.mjs`
- `tests/landing-showcase-contract.test.mjs`
- `tests/menu-translations.test.mjs`
- `tests/public-menu-translation-readiness.test.mjs`
- `tests/trouvable-premium-menu-source.test.mjs`

## Verification

- `npm.cmd run test:landing:contract` — passed, 18/18.
- `node --test tests/landing-i18n.test.mjs tests/menu-translations.test.mjs tests/public-menu-translation-readiness.test.mjs tests/sauge-noire-menu-data.test.mjs tests/trouvable-premium-menu-source.test.mjs` — passed, 53/53.
- `npm.cmd run typecheck` — passed.
- Touched-file ESLint with `--max-warnings=0` — passed.
- `git diff --check` — passed.

Full `npm run lint`, build, and browser/e2e QA were not run. The task explicitly requested touched lint, no build, and preservation of the pre-existing unstaged `e2e/landing-redesign.spec.ts` change. Residual risk is limited to unexecuted browser rendering; source/runtime localization contracts and TypeScript validation pass.

## Self-review

- No scroll, auth, schema, unrelated owner backend, public asset, 3D, top-bar, or hero-video code was changed.
- No dependencies, generated assets, secrets, environment files, logs, screenshots, videos, traces, or build output were added.
- The pre-existing `e2e/landing-redesign.spec.ts` diff remains unstaged and untouched by this task.
- Landing payload sanitization and lazy renderer boundaries remain intact.
- Public menu translations are applied before landing projection; React consumes localized menu data and typed presentation copy.
- The task remains a focused i18n change.

## Commit

`fix(i18n): localize comparison and featured dishes`
