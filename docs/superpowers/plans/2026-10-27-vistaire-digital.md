# Vistaire Digital Implementation Plan

> **For agentic workers:** Use the user-authorized four roles/worktrees below. Execute continuously; the user approved the design and implementation on 2026-10-27.

**Goal:** Add Digital as the first of five commercial offers, with its real illustrative Sauge Noire GLB, and create one draft PR without merging.

**Architecture:** Extend the existing commercial data, Three loader, cinematic shots and HTML pricing phone. Keep four physical collections distinct from five commercial offers and their presentation models. Publish the GLB through the approved immutable R2/CDN path; commit only its manifest and the lightweight supplied WebP.

**Tech Stack:** Existing Next.js App Router, React, TypeScript, Three, glTF-Transform, Sharp, npm and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-vistaire-digital-design.md` (approved).

## Global Constraints

- Base `origin/main` at `9e5cae0270af704931cb15c2ebc2c23cab2c624c`; preserve the original dirty privacy checkout.
- Digital setup CAD1500, monthly CAD200, 12 months; no support/book/printing/fabrication/delivery included. Physical setup CAD2000/2050/2100/2200 and extras40/45/55/55 unchanged.
- Pilotage+100, 3D packs149/249/449 and individual35–50 unchanged. Real FR/EN booking CTAs and routes unchanged.
- No new dependencies, engine, scroll library, AR/USDZ book pipeline, LFS or protected media edits. Original GLB remains outside Git.
- A/B/C own disjoint implementation files. D/main owns tests, integration, publication checks, final QA and the single draft PR. No merge or destructive action.
- One source of commercial numeric amounts. Expose `PricingOfferId = "digital" | PricingCollectionId`, add `kind: "digital" | "physical"` to `PricingCollection`, preserve `page.collections` as ordered commercial offers to avoid unnecessary renaming. Add `calculateFirstYearCost({ setupAmount, monthlyAmount })`; keep table rates physical-only.
- Keep physical `content.collections` at four entries. Export `presentationOptions` as Digital followed by those four, numeric amounts derived from pricing data. Export `presentationModelUrls` including Digital; retain `supportModelUrls` as the four physical models for callers that genuinely require supports.
- Digital model ID `immersive.presentation.digital`, shot `pricing-digital`. Do not activate CDN URL until actual full-byte/hash/HTTP/browser CORS verification; no invented legacy URL for a CDN-only model.
- New isolated behavioral tests must fail for the expected reason before production logic is written; reuse existing tests and E2E fixtures. No new framework or broad test infrastructure.

## Review Focus

- A table input of37 or100 must never raise Digital or claim20 included supports; physical estimates remain exact.
- Rapid Digital/Acrylique/Signature changes must preserve the previous usable model, hide it at the correct join, and avoid duplicate downloads or stale readiness.
- Book failure or missing WebGL must show a usable photo/text fallback without blocking navigation/scroll.
- Five offers lengthen phone reading: native scroll/keyboard/reverse boundaries must still reach Pilotage, FAQ and footer.
- A CDN-only asset must retain exact SHA/byte verification without weakening checks for the72 existing local assets or inventing a local fallback.

### Task A: commercial contract and knowledge

**Files:** `lib/pricingPage.ts`, `lib/pricingCalculator.ts`, `docs/faq-knowledge/05-tarifs.md`, `06-restaurateurs.md`, applicable corpus metadata, `lib/agent-discovery/pageMarkdown.ts`, `components/immersive/LandingFaq.jsx`.

**Interfaces:** Produce the global commercial types, kind, ordered `page.collections`, shared annual helper, existing `getPricingPage` and unchanged physical rates. Digital image source `/images/marketing/vistaire-digital-sauge-noire.webp` (C registers the image).

- [ ] D pins Digital fixed price at1/10/20/21/37/100 and annual totals3900/4400/4450/4500/4600 in existing pricing tests, runs red, then signals A.
- [ ] A adds the smallest commercial change, FR/EN copy/inclusions/conditional physical workflow and OfferCatalog. No fabricated capabilities or physical delivery for Digital.
- [ ] A updates FAQ/discovery from actual `origin/main`; no contact API changes. Self-review and commit owned files only.
- [ ] D runs `node --test tests/pricing-table-estimator.test.mjs tests/tarifs-carte-vistaire-public.test.mjs tests/faq-rag.test.mjs tests/agent-discovery.test.mjs`, reviews and integrates.

### Task B: real GLB and scene

**Files:** `components/immersive/SupportModels.js`, `Scene.jsx`, `PageShots.js`, `CinematicPage.jsx`, `CinematicPage.d.ts`, `App.jsx`, `content.js`, `locale.jsx`, scene/showroom CSS only as needed; `lib/publicModelAssets.ts`, `lib/publicModelAssets.json`, `docs/public-model-assets.md`.

**Interfaces:** Consume A's ordered numeric pricing data, produce `presentationOptions`, `presentationModelUrls`, shot `pricing-digital` and Digital scene selection. C uses those identities. D/main owns upload/checksum/CDN activation and tests.

- [ ] D pins recognized presentation ids, horizontal book normalization, physical map preserved and remote-only manifest behavior in existing loader/manifest tests; runs red, then signals B.
- [ ] Reuse loader: rotate Digital X=-π/2 before bounds, uniform width normalization and re-ground; preserve materials, cache, abort, late disposal and shared Draco.
- [ ] Add high oblique Digital shot; make second Acrylique presence enter as well as exit. Keep initial hero/footer support physical; use Digital only in the intended discovery/pricing scenes.
- [ ] Replace showroom hardcoded four-option navigation with actual presentation length; adapt accessible labels and rotation. Current/near-next preloads only, not all five at reveal. Model errors stay local and expose photograph fallback; no WebGL fallback remains usable.
- [ ] Add optional `legacyUrl` for the new remote-only record; register/redirect only existing legacy values. Preserve all existing records exactly.
- [ ] Self-review, targeted existing loader/camera tests and commit owned files only. D reviews/integrates and verifies browser rendering.

### Task C: commercial UI and photograph

**Files:** `components/immersive/Pricing.jsx`, `pricing.css` if needed, `components/vistaire-preview/VistairePricingPreview.tsx`, its module.css, `PricingTableEstimator.tsx`, `lib/seoMarketingImages.ts`, supplied WebP under `public/images/marketing`, existing photography documentation.

**Interfaces:** Consume A's `kind`/five `page.collections` and B's `pricing-digital` identity. Preserve selectors and anchors, add `#collection-digital`. Shared Digital photo slot; no duplicate binary.

- [ ] D updates relevant five-offer/photograph/phone assertions and runs red before C's change.
- [ ] Add first Digital HTML phone card from shared commercial data with photo, fixed price, correct links and no-support disclosure. Keep native phone reading and measured scroll budget.
- [ ] Add first pricing chapter/scene and estimator card; tables control applies to physical collections only. Digital keeps base price and no-support copy at every input.
- [ ] Register one supplied WebP158002bytes1536×1024 and localized alt/provenance; use contain for the Digital book only. Adjust existing grid to1/2/3columns as needed for five readable cards.
- [ ] Self-review/targeted checks and commit owned files only; D reviews and integrates.

### Task D/main: tests, publication, integration and draft PR

**Files:** relevant existing `tests/` and `e2e/` files, this plan/spec, focused final verification report. No unrelated production file ownership while A/B/C execute.

- [ ] Install exact npm lockfile in integration worktree; share this dependency tree read-only with implementation worktrees where practical. Read relevant installed Next guides before Next changes.
- [ ] Run relevant existing tests on the clean base. Define focused red tests above and record results. Add targeted E2E checks before integration; no broad suite construction.
- [ ] Publish original exact GLB to a new immutable approved R2 key; verify no overwrite, full SHA256, GET/HEAD/MIME/length/cache/Range and missing-object behavior. Verify browser CORS for production/localhost/actual preview and record actual URL.
- [ ] Integrate commits into the clean `codex/vistaire-digital-glb-experience` branch, review each scoped diff, resolve contract mismatches centrally.
- [ ] Run assets/LFS/lint/typecheck/build, targeted then full Node suite where stable. Run existing relevant public/SEO/Playwright routes with local fixtures, no production Supabase override.
- [ ] Browser QA at360/390/430/768/1280/1440: real book, all five selections, both transition directions, anchoring, keyboard/touch, reduced motion, failures, phone/FAQ boundaries, console/network/hydration/CORS, no overflow or eager all-model loads. Compare clean baseline where possible; state limitations honestly.
- [ ] Independent final branch review on the most capable available reviewer, correct P0/P1 and verify changes. Record commands/results and per-file rationale in final report.
- [ ] Inspect final diff/status, remove only task-generated junk, verify no secrets/new heavy assets. Commit and push task branch, create exactly one GitHub draft PR and attach it; no merge.

## Execution ledger

- 2026-10-27: Design explicitly approved; worktree created at `C:/Users/hadid/.codex/worktrees/vistaire-digital-glb/Vistaire`; branch created at approved base. Original checkout unchanged. Exact npm installation started.
- Ruling: The user's approved implementation method and request for complete execution supersede another design/plan approval round. Keep this plan compact and execute without further check-in.
- Ruling: User requested independent worktree roles, so A/B/C may execute disjoint ownership in parallel after D's red tests; they do not modify each other's files or tests. Root/D integrates and owns all reviews.
