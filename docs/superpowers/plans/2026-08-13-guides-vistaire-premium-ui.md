# Vistaire Guides Premium UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the six public Vistaire Guide routes as one restaurant-first, glass preview system aligned with `/menu-digital-restaurant`, while preserving editorial data, routes, SEO, i18n and accessibility contracts.

**Architecture:** Keep every route as a thin wrapper around `VistaireEditorialGuide`. Add a small presentation contract keyed by the existing `EditorialGuideKey` to choose approved image/layout hints without duplicating copy. Render one shared page shell with `PreviewNav`, restaurant background, a 12-column glass frame, varied section compositions, accessible table/checklist/related cards, the existing CTA and `PreviewFooter`.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, existing Next `Image` assets, BT Suave and Neue Montreal already used by the public preview system.

## Global Constraints

- Use the latest `origin/main` base (`292f83c9bc1b7cc5d836dfb14dc2d6c4c9d30de0`) and the isolated `fix/guides-vistaire-premium-ui` worktree.
- Do not change `lib/editorialGuides.ts` copy, published slugs, SEO builders, Admin, Pricing, Supabase, 3D runtime or media folders.
- Reuse existing restaurant/food images only; do not add heavy media or dependencies.
- Keep all content server-rendered and all existing JSON-LD, canonical, alternate and sitemap inputs intact.
- Validate mobile at 390/430, tablet at 768 and desktop at 1280/1440, plus Chromium/WebKit when the environment permits.

## Current State and File Ownership

- `components/guides/VistaireEditorialGuide.tsx` currently renders one narrow editorial column with a gradient-only background, a simple contents aside, linear sections, a dark checklist, link rows and a cream CTA.
- `components/guides/VistaireEditorialGuide.module.css` uses Cormorant for headings and does not share the BT Suave/Neue Montreal preview tokens or restaurant image treatment.
- The six route files only call `getEditorialGuide(key, locale)` and render the shared component; this is the route/content parity contract to preserve.
- `lib/editorialGuides.ts` remains the single source of truth for all copy, bullets, tables, checklist items, related paths and CTA destinations.
- Landing implementation is owned by the separate `guides-landing-glass-ui` worktree and must be integrated only after its diff is reviewed.

### Task 1: Add the minimal guide presentation contract

**Files:**
- Create: `components/guides/editorialGuidePresentation.ts`
- Test: existing editorial guide data/route tests and TypeScript typecheck

**Interfaces:**
- Consumes: `EditorialGuideKey` and `EditorialGuideLocale` from `lib/editorialGuideRoutes.ts`.
- Produces: `getEditorialGuidePresentation(key, locale)` returning a static image, localized image alt text, hero composition variant and section layout hints.

- [ ] **Step 1: Define the contract**

  ```ts
  export type GuideSectionLayout = "feature" | "split" | "table" | "quiet";
  export type EditorialGuidePresentation = {
    heroImage: StaticImageData;
    heroImageAlt: { fr: string; en: string };
    heroVariant: "visual-right" | "visual-left" | "editorial-stack";
    sectionLayouts: Record<string, GuideSectionLayout>;
  };
  ```

- [ ] **Step 2: Map the three existing keys to existing `Framer/` assets**

  Use `PageDigital.png` for the menu anatomy guide, `PhotoQRcode1.png` for the QR guide and `PhotoDigital2.png` (or another already validated food/3D image) for the 3D guide. Keep the map exhaustive so an unknown key fails loudly.

- [ ] **Step 3: Typecheck the new module**

  Run: `npm run typecheck`

### Task 2: Replace the editorial shell with the Vistaire preview shell

**Files:**
- Modify: `components/guides/VistaireEditorialGuide.tsx`
- Modify: `components/guides/VistaireEditorialGuide.module.css`

**Interfaces:**
- Consumes: the existing `EditorialGuide` object, the presentation contract, `PreviewNav`, `PreviewFooter`, JSON-LD helpers and existing `relatedPaths`.
- Produces: one SSR page with a restaurant image background, sticky preview navigation, a wide glass frame, varied content surfaces and unchanged semantic headings/links/tables.

- [ ] **Step 1: Add the background image and presentation lookup**

  Import `Image`, `PhotoRestoComplet5.png` and `getEditorialGuidePresentation`; render the background image lazily with `fill`, `sizes="100vw"`, `quality={75}`, `alt=""`, `aria-hidden` and a CSS veil behind the page content. Keep only the guide hero image as the prioritized LCP asset.

- [ ] **Step 2: Preserve metadata and JSON-LD exactly**

  Keep `buildEditorialGuideMetadata`, `buildWebPageJsonLd`, `buildArticleJsonLd` and `buildBreadcrumbJsonLd` calls and their current paths/labels. Keep the single `h1`, breadcrumb nav, section ids, table caption/headers/scopes, checklist text and all CTA/related hrefs.

- [ ] **Step 3: Build the hero inside `.previewFrame`**

  Render breadcrumb, eyebrow, h1, dek, definition and a presentation image in a two-column hero card. Use the existing guide CTA only as a secondary hero action when its real href is present; do not invent destinations.

- [ ] **Step 4: Render internal navigation as a compact accessible glass rail**

  Keep anchors for every section and `#checklist`, use a `nav`/`ol` structure and make desktop sticky behavior subtle. Collapse to a normal full-width block on mobile.

- [ ] **Step 5: Render section compositions from data, not key-specific JSX branches**

  Use the presentation map for classes/layout hints. Paragraphs remain paragraphs; bullets remain lists; tables remain real HTML tables in a horizontally scrollable labeled region. Add a visual or accent panel only around the existing content.

- [ ] **Step 6: Turn checklist, related links and CTA into preview surfaces**

  Checklist becomes a responsive two-column grid with champagne checks; related paths become two-to-four full-card links with title/eyebrow/arrow; CTA becomes a large glass panel using its existing label and href. Keep `PreviewFooter` unchanged.

- [ ] **Step 7: Replace fonts and visual tokens in CSS**

  Define the same BT Suave/Neue Montreal `@font-face` sources and cream/champagne variables as the menu preview. Use the preview frame border/radius/inset highlights/shadows, one moderate `backdrop-filter`, translucent warm surfaces and a fallback opaque surface when unsupported.

- [ ] **Step 8: Add responsive and motion rules**

  At <=920px use one column and smaller frame padding; at <=520px keep tappable controls at least 44px, avoid horizontal overflow and remove sticky internal navigation. Disable transitions under `prefers-reduced-motion: reduce`.

### Task 3: Integrate the landing Guides glass section

**Files:**
- Integrate after review: `components/landing/GuidesVistaireSection.tsx` and any directly-owned CSS module from the `guides-landing-glass-ui` worktree.

- [ ] **Step 1: Review the agent diff**

  Confirm only the section and directly-required styles changed, the three cards still come from `getEditorialGuides(locale)`, and the existing pillar link remains intact.

- [ ] **Step 2: Cherry-pick or apply only the focused diff**

  Integrate the landing changes into `fix/guides-vistaire-premium-ui`; do not merge unrelated worktree changes.

- [ ] **Step 3: Run landing contract tests**

  Run: `npm run test:landing:contract` and `npm run test:landing:i18n`.

### Task 4: Targeted regression and browser QA

**Files:**
- Modify only tests under `tests/` or `e2e/` if a new contract is required; do not rewrite UI for a test convenience.

- [ ] **Step 1: Run focused static contracts**

  Run: `node --test tests/*guides*.test.mjs tests/bilingual-seo.test.mjs tests/seo-foundation.test.mjs` (using the exact matching files present in the repository).

- [ ] **Step 2: Run lint, typecheck and build**

  Run: `npm run lint`, `npm run typecheck`, `npm run build`.

- [ ] **Step 3: Run asset/LFS checks and diff hygiene**

  Run: `npm run assets:check`, `npm run lfs:check`, `git diff --check`.

- [ ] **Step 4: Exercise six Guide routes and both landing locales in Playwright**

  Verify load, one internal anchor, one related link, CTA destination, no horizontal overflow, no console/hydration errors, and Chromium/WebKit coverage for the glass/sticky behavior when browser binaries are available.

- [ ] **Step 5: Complete the production-candidate review**

  Compare `/guides/anatomie-menu-digital-premium` against `/menu-digital-restaurant` without reading the copy. Report P0/P1/P2 for visual consistency, mobile, accessibility, SEO, FR/EN parity, landing continuity, blur performance and broken links. Fix P0/P1 before any completion claim.

### Task 5: Final verification and handoff

- [ ] **Step 1: Inspect `git status --short` and cleanup task-generated output**

  Remove only screenshots, traces, reports or debug files generated by this task; never remove product assets or the user’s pre-existing dirty checkout changes.

- [ ] **Step 2: Re-run the exact final commands**

  Use fresh output for `assets:check`, `lfs:check`, `lint`, `typecheck`, `build`, targeted tests and applicable Playwright projects.

- [ ] **Step 3: Prepare one focused draft PR**

  PR title: `feat(ui): align Vistaire guides with premium public design`. Include the required Problem, `/menu-digital-restaurant` design reference, Guide pages, Landing Guides, shared architecture, SEO, accessibility, responsive QA, performance, validation, review, files changed and unverified sections. Do not auto-merge.
