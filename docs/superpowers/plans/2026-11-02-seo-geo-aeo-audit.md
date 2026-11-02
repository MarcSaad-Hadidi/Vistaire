# Vistaire SEO, GEO and AEO audit implementation plan

> **For agentic workers:** Execute with `superpowers:executing-plans`; read the user brief and this plan. Review the complete branch independently before handoff.

**Goal:** Correct verified public discovery and content defects, preserving Vistaire's existing visual experience and preparing one unmerged PR.

**Architecture:** Reuse the current Next.js metadata, bilingual content, Markdown serializers and Playwright workflows. No new runtime dependency, CMS, page family, crawler access policy or production configuration.

**Tech stack:** Next.js 16.4, React 19, TypeScript, npm, node:test, Playwright.

**Spec:** The user's 2 November 2026 audit brief: audit first, implement confirmed defects, validate equivalent environments, leave a reviewable PR and preview; never merge or deploy production.

## Global constraints

- Vistaire only; no Bump identity, offers or data.
- Retain design, animations, restaurant/menu functionality and intentional private/preview restrictions.
- Use verified visible commercial terms; do not invent clients, prices, dates, reviews, authors or guarantees.
- Free tools only, no external accounts, paid credits or agency requests; distinguish performed, cached, blocked and unmeasured work.
- Audit utilities and raw evidence remain outside application dependencies and public assets.
- Existing `main` baseline: `4d2d7505988fd3d2f09937ea8961f9c05b2e86ad`; dedicated branch `fix/vistaire-seo-geo-aeo-audit`. No relevant open PR.

## Baseline and scope

The bounded live crawl found 54/54 sitemap URLs returning 200 with unique titles, self canonicals, one H1 each and reciprocal FR/EN alternates. Six focused Node test files passed 52 tests; the production build passed before changes. External audit contradictions are checked against actual HTML instead of treated as defects.

Confirmed work: descriptive homepage semantics and lead, Markdown pricing omissions, existing discovery-file structure/coverage/unsupported promise, internal editorial instructions visible on public local pages, ambiguous experience-gallery wording. Lastmod dates are changed only for pages actually edited; unverified historical freshness is not fabricated. The earlier owner authorization and menu-publication findings are separate from this SEO/content objective and remain outside this PR.

## Review focus

- French and English commercial terms must remain equally explicit in HTML and Markdown.
- Hero wordmark styling, mobile layout and animation selectors must retain their behavior.
- Local copy must explain restaurant delivery without invented offices or client results.
- Discovery resources must stay public and crawlable while duplicated aggregate text need not become a search landing page.
- Scores, laboratory measurements and observed engine mentions must remain separate, with URLs, dates and environments disclosed.

## Task 1: Accurate public content and semantics

**Files:** `components/immersive/App.jsx`, `components/immersive/locale.jsx`, `components/immersive/styles.css`, `components/vistaire-preview/RestaurantExperiences.tsx`, selected entries in `lib/seoGeoPages.fr.ts` / `.en.ts`, affected route dates in `lib/i18n.ts` / `lib/seoGeoRoutes.ts`; existing landing/SEO E2E expectations.

- [ ] Inspect current copy, CSS and existing test selectors before editing.
- [ ] Update the existing homepage E2E expectation to require a descriptive localized H1; run against the untouched production build and observe the intended failure.
- [ ] Keep the large VISTAIRE wordmark and cinematic layout; use the existing lead for the descriptive heading, preserving typography explicitly.
- [ ] Replace only demonstrated internal editorial language and ambiguous gallery claims with factual visitor-facing FR/EN copy.
- [ ] Record the actual editorial date only on changed route pairs; leave unrelated historical dates alone.
- [ ] Run existing focused Node tests and homepage/SEO browser checks.

## Task 2: Equivalent machine-readable content

**Files:** `lib/agent-discovery/pageMarkdown.ts`, `public/llms.txt`, `app/llms-full.txt/route.ts`, `tests/agent-discovery.test.mjs`.

- [ ] Add a regression assertion for existing pricing fields omitted from Markdown in both locales; watch it fail.
- [ ] Serialize replacement/correction terms, option disclosure and total, pricing-variable explanation and extras from the existing pricing data.
- [ ] Convert existing discovery URLs to descriptive Markdown links, accurately describe aggregate coverage, and remove the uncorroborated promise of subscription menu updates.
- [ ] Mark the aggregate representation noindex while keeping it publicly readable, rather than creating an indexable duplicate of the marketing pages.
- [ ] Verify every machine-readable term against visible content; run focused discovery/content tests.

## Task 3: Validate, review and hand off

**Files:** `docs/audits/2026-11-02-seo-geo-aeo.md`, with source changes limited to the confirmed tasks above.

- [ ] Inspect OSS licenses/methods before execution; run isolated Lighthouse CI and relevant accessibility checks without uploads.
- [ ] Run `npm run assets:check`, `npm run lfs:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:node` and relevant existing Playwright suites.
- [ ] Compare equivalent local production builds, crawl served HTML and Markdown, check robots/sitemap/JSON-LD/links, and validate mobile 390/430 plus desktop interactions, console and failed requests.
- [ ] Document actual executed tools, baseline scores, before/after scope, unknowns, official facts still required, and external actions; do not invent citation or ranking gains.
- [ ] Review the entire diff independently, address valid blockers, push only the dedicated branch, create/update one PR, inspect CI and its preview, leave it unmerged.

## Execution record

- Planning and source inspection completed before product changes. User explicitly authorized immediate execution without an additional approval pause.
- Audit evidence and command logs: `/workspace/scratch/4c6320860a9a/audit-evidence/` and adjacent task logs; report only non-sensitive summaries in the repository.
