# Vistaire Prompt 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one merge-ready PR that enlarges the PDF comparison phone, strengthens exact visible/JSON-LD FAQ parity, publishes three premium bilingual editorial guides, consolidates the bilingual premium footer, and removes only proven duplicate CTAs.

**Architecture:** Four isolated worktree branches own non-overlapping implementation domains and are integrated by the orchestrator into `feat/seo-guides-faq-footer`. Existing SEO/i18n/schema/footer patterns remain authoritative; no parallel system or new dependency is introduced.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules/Tailwind, Node test runner, Playwright 1.59, npm.

## Global Constraints

- Base every implementation worktree on certified commit `52ebf08e9a396ccba9dd7399d17b00b47ee662cf` plus this plan commit.
- Never work on `main` or modify the dirty checkout at `E:\Projet perso\MenuAlive`.
- Do not touch `/apercu-restaurateur`, Pricing page implementation, dashboard functionality, 3D/AR runtime functionality, restaurant-menu redesign, production assets, LFS rules, auth, or security baselines.
- Do not add dependencies or heavy assets.
- Preserve the existing FAQ source `SeoPageData.faq`; visible and JSON-LD text must be exact after whitespace normalization.
- Preserve `PreviewFooter` as the only rendered shared footer; do not add a layout-level second footer.
- Size the PDF phone with real layout geometry, never `transform: scale()`.
- Work mobile-first and certify 390×844 and 430×932 as well as 768×1024, 1280×800, and 1440×900.
- No retries, skipped tests, arbitrary synchronization sleeps, invented product claims, invented people/dates/statistics, dead links, or placeholder hrefs.

---

### Task 1: PDF comparison device emphasis and interaction proof

**Worktree branch:** `feat/p5-pdf-comparison-ux`

**Files:**
- Modify: `components/landing/SeoInteractiveComparison.tsx`
- Modify: `components/landing/comparison/LandingComparison.tsx`
- Modify: `components/landing/comparison/LandingComparison.module.css`
- Modify only if required for inherited max width: `components/vistaire-preview/VistairePreviewPdfCompareSlider.module.css`
- Modify: `app/(seo)/menu-pdf-vs-menu-digital/page.tsx`
- Modify: `app/en/pdf-vs-digital-menu/page.tsx`
- Modify for CTA adjacency only if implementation needs the same route shell: `components/vistaire-preview/VistairePdfVsMenuDigitalPreview.tsx`
- Test: `e2e/prompt5-pdf-comparison.spec.ts`
- Test: focused Node source contract if a new prop/data attribute is introduced

**Interfaces:**
- Produces a route-scoped emphasis prop/data attribute consumed only by the two PDF routes.
- Leaves default `SeoInteractiveComparison` geometry unchanged for landing and digital-menu reveal pages.

- [ ] Add a failing Playwright ratio test using the measured baseline and tolerant containment assertions.
- [ ] Run the focused test and record the expected pre-change failure.
- [ ] Implement real grid/max-width/clamp geometry and route-scoped emphasis without transform scaling.
- [ ] Add stable data attributes only where existing selectors cannot express the geometry contract.
- [ ] Verify 1440, 1280, 768, 430, and 390 boxes; record before/after width, height, and phone/card ratio.
- [ ] Verify pointer drag, touch drag, keyboard sequence, handle alignment, layer containment, no crop, no overflow, console/network/hydration, and no GLB/USDZ request.
- [ ] Run focused Node and Playwright tests with zero retry/skip.
- [ ] Commit with `feat(pdf): emphasize the digital comparison device`.
- [ ] Produce the required objective/files/why/validations/risks/unverified report and complete an independent task review; fix P0/P1.

### Task 2: Contextual FAQ and exact rendered schema parity

**Worktree branch:** `feat/p5-faq-structured-data`

**Files:**
- Modify: `lib/seoPages.ts`
- Modify: `components/seo/SeoFaq.tsx`
- Create a colocated CSS module/client item only if the approved button accordion is used
- Modify only if a generic normalization helper is needed: `lib/seo.ts`
- Test: `tests/prompt5-faq-parity.test.mjs`
- Test: `e2e/prompt5-faq.spec.ts`

**Interfaces:**
- Consumes `SeoPageData.faq` unchanged as the single source.
- Produces no second FAQ registry and no route-local manual JSON-LD.

- [ ] Add failing FR/EN tests for contextual uniqueness and exact rendered FAQPage parity.
- [ ] Rewrite the four required FAQ sets with verified, route-specific product claims and no duplicate wording across intents.
- [ ] Implement premium accessible FAQ presentation with SSR answer HTML; if interactive, use buttons with `aria-expanded` and `aria-controls`, visible focus, native keyboard activation, and reduced-motion CSS.
- [ ] Prove one FAQPage per route, equal counts, equal normalized questions/answers, parsable JSON, and no hidden extra schema answers.
- [ ] Run focused Node and Playwright tests with zero retry/skip.
- [ ] Commit with `feat(seo): strengthen contextual faq parity`.
- [ ] Produce the required report and complete an independent task review; fix P0/P1.

### Task 3: Three bilingual premium editorial guides

**Worktree branch:** `feat/p5-guides-seo-geo`

**Files:**
- Create: `lib/editorialGuides.ts`
- Create: `components/guides/VistaireEditorialGuide.tsx`
- Create: `components/guides/VistaireEditorialGuide.module.css`
- Create six route files under `app/guides/...` and `app/en/guides/...`
- Modify: `lib/i18n.ts`
- Modify: `lib/seo.ts` only for an honest Article builder if used
- Modify: `components/landing/GuidesVistaireSection.tsx`
- Modify: `components/landing/VistaireLanding.tsx`
- Test: `tests/prompt5-editorial-guides.test.mjs`
- Test: `e2e/prompt5-guides.spec.ts`

**Interfaces:**
- Produces typed bilingual guide pairs and link metadata that the footer can consume after integration.
- Sitemap inclusion is produced by the existing bilingual route registry.

- [ ] Add failing inventory tests for all six routes, unique metadata, one H1, canonical/hreflang, sitemap, breadcrumb, internal links, and unsupported-claim guardrails.
- [ ] Write the French and English guide data as complete editorial experiences, not mechanical translations or thin summaries.
- [ ] Implement the shared server-rendered editorial layout with direct definitions, criteria/table/checklist structures, visible breadcrumbs, related guides, pillar links, and final booking CTA.
- [ ] Add Article JSON-LD only with real fields; omit author/date if unavailable.
- [ ] Register the three bilingual pairs and update the landing Guides discovery section without creating a thin hub.
- [ ] Test all six routes at desktop and mobile for metadata, content, links, footer presence after integration, overflow, console, hydration, and network.
- [ ] Commit with `feat(guides): publish premium bilingual restaurant guides`.
- [ ] Produce the required report and complete an independent task review; fix P0/P1.

### Task 4: Premium bilingual footer and proven CTA cleanup

**Worktree branch:** `feat/p5-footer-conversion`

**Files:**
- Modify: `components/vistaire-preview/VistairePreviewChrome.tsx`
- Modify: `components/vistaire-preview/VistairePreviewChrome.module.css`
- Modify: `components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.tsx`
- Do not modify PDF route/component files owned by Task 1.
- Test: `tests/prompt5-footer-contract.test.mjs`
- Test: `e2e/prompt5-footer.spec.ts`

**Interfaces:**
- Consumes the exact guide slugs defined in the design; after integration, switch hardcoded guide descriptors to the typed guide registry if available.
- Produces the sole rendered public marketing footer.

- [ ] Add failing tests for unique link targets per group, FR/EN labels, existing internal routes, no empty/hash href, Local geography integrity, and mobile target sizing.
- [ ] Rebuild the shared footer groups as Product, Guides, Solutions/Needs, Local, and Contact using only published bilingual routes.
- [ ] Remove adjacent same-target footer duplicates while preserving booking CTA, email, phone, social profiles, language switcher, and existing real routes.
- [ ] Remove only the digital-menu final internal sample-menu duplicate when the adjacent button already has that target; preserve hero/final/footer conversion roles.
- [ ] Certify single footer markup, 390/430 stacking, 44px interactive targets where feasible, focus, wrapping, and no overflow.
- [ ] Run focused Node and Playwright tests with zero retry/skip.
- [ ] Commit with `feat(footer): consolidate bilingual conversion links`.
- [ ] Produce the required report and complete an independent task review; fix P0/P1.

### Task 5: Semantic integration and complete Prompt 5 test entrypoint

**Worktree:** final orchestrator branch `feat/seo-guides-faq-footer`

**Files:**
- Modify overlaps only after comparing all task diffs.
- Modify `package.json` only if a dedicated `test:prompt5` script improves repeatability.
- Modify footer guide imports to consume `lib/editorialGuides.ts` rather than duplicate descriptors.
- Create no new product behavior beyond the four task contracts.

- [ ] Review every task report and diff; reject scope leakage and unverified P0/P1.
- [ ] Integrate Task 3 before Task 4 link wiring, Task 2 independently, and Task 1 with explicit PDF ownership conflict resolution.
- [ ] Resolve to one FAQ source, one FAQ JSON-LD builder, one footer, one guide registry, and one final phone emphasis variant.
- [ ] Re-run focused tests after each integration boundary.
- [ ] Run an independent final review package across `52ebf08…HEAD`; dispatch one fix wave for all findings and one scoped re-review.

### Task 6: Local and browser certification

- [ ] Run `npm ci` or prove the existing clean install matches `package-lock.json`; run `npm ls --depth=0`.
- [ ] Run assets, LFS, lint, typecheck, build, focused Node tests, SEO, i18n, landing, and Prompt 5 suites.
- [ ] Run Playwright core, landing, SEO, Prompt 5, menu, Sauge, admin QR critical, and WebKit critical without retries or skips.
- [ ] Inspect affected routes in Chromium/DevTools-equivalent automation at all required viewports; parse rendered JSON-LD and inspect console, network, layout, focus, headings, and links.
- [ ] Revalidate landing, `/demo`, Maison Élyse FR/EN switch, Trouvable, Sauge Noire, and all four SEO pillar routes.
- [ ] Compare baseline and final phone geometry, CLS, network, and generated bundle/build output.
- [ ] Clean only task-generated `.next`, reports, screenshots, traces, logs, and temporary files; verify no secrets/heavy assets.

### Task 7: Draft PR and exact remote-head gate

- [ ] Run `git diff --check`, final `git status --short`, asset/LFS delta checks, and verify `git rev-list --count HEAD..origin/main` is zero after a final fetch.
- [ ] Commit the final focused changes, push `feat/seo-guides-faq-footer`, and create one Draft PR to `main`.
- [ ] Record exact PR HEAD and base SHA; wait for Vercel Preview for that exact head and test it.
- [ ] Wait for all applicable GitHub checks, CodeQL/GHAS, Vercel, and reviews to complete with no failure or pending state.
- [ ] Leave Production Smoke disabled and do not enable auto-merge or merge the PR.
- [ ] Report merge-ready only with complete evidence; otherwise report `NOT READY` and exact unverified blockers.
