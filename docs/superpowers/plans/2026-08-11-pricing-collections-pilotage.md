# Vistaire Pricing Collections + Pilotage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one premium bilingual pricing page centered on four physical Vistaire collections and the optional, factually verified Pilotage dashboard.

**Architecture:** Keep both Next.js route modules thin, centralize localized commercial data and structured data in `lib/pricingPage.ts`, and render one shared server component with its own CSS module. Extend the shared public chrome additively for the requested marketing navigation, and reuse the existing real restaurateur dashboard demo inside the Pilotage laptop.

**Tech Stack:** Next.js App Router 16, React 19, TypeScript, CSS Modules, Next Image/Link, Node test runner, Playwright.

## Global Constraints

- npm only; do not add dependencies.
- Four collections only: Acrylique 2,000 CAD, Sculpté 2,050 CAD, Carré 2,100 CAD, Signature 2,200 CAD.
- Vistaire is 200 CAD/month; Pilotage is an optional +100 CAD/month; combined total is 300 CAD/month.
- Do not claim live real-time sync, rolling 24-hour analytics, configurable service periods, report export, or analytics sharing.
- Do not touch `public/models`, `public/videos`, `public/frames`, `3D Plat`, or `3D photo`.
- Mobile-first proof at 390 and 430 px is mandatory.
- Use targeted tests during implementation and one complete validation matrix after stabilization.

---

## File map

- `lib/pricingPage.ts`: typed FR/EN product source and collection-only JSON-LD.
- `components/vistaire-preview/VistairePricingPreview.tsx`: shared semantic page composition.
- `components/vistaire-preview/VistairePricingPreview.module.css`: isolated visual and responsive system.
- `components/seo/pages/TarifsMenuDigitalRestaurantPage.tsx`: compatibility wrapper for the French route.
- `app/en/pricing-digital-restaurant-menu/page.tsx`: thin English route using the shared component.
- `app/(seo)/tarifs-menu-digital-restaurant/page.tsx`: metadata/social image alignment only.
- `components/vistaire-preview/VistairePreviewChrome.tsx` and `.module.css`: additive marketing navigation variant.
- `components/vistaire-preview/RestaurateurDashboardDemo.tsx`: optional initial period prop so Pricing opens on 30 days.
- `public/images/pricing/*.jpg`: four user-provided runtime product photos.
- `tests/tarifs-carte-vistaire-public.test.mjs`: exact bilingual commercial/JSON-LD contract.
- `e2e/pricing-page.spec.ts`: focused rendered behavior and responsive contract.

### Task 1: Lock the new commercial contract

**Files:**
- Modify: `tests/tarifs-carte-vistaire-public.test.mjs`
- Modify: `lib/pricingPage.ts`

**Interfaces:**
- Produces: `getPricingPage(locale)`, `getPricingMetadata(locale)`, `buildPricingPageJsonLd(env, locale)`, and localized `collections`, `includedGroups`, `pilotage`, `additional`, and `finalCta` data.

- [ ] **Step 1: Replace legacy assertions with the four-collection contract**

```js
assert.deepEqual(
  PRICING_PAGE.collections.map(({ name, setupAmount }) => [name, setupAmount]),
  [["Vistaire Acrylique", 2000], ["Vistaire Sculpté", 2050], ["Vistaire Carré", 2100], ["Vistaire Signature", 2200]]
);
assert.equal(PRICING_PAGE.monthlyAmount, 200);
assert.equal(PRICING_PAGE.pilotage.monthlyAmount, 100);
assert.equal(PRICING_PAGE.pilotage.totalMonthlyAmount, 300);
```

- [ ] **Step 2: Run the contract and verify the legacy data fails**

Run: `node --test tests/tarifs-carte-vistaire-public.test.mjs`

Expected: failure because `collections` and Pilotage amounts do not exist yet.

- [ ] **Step 3: Replace the legacy package/FAQ model in `lib/pricingPage.ts`**

Implement exact FR/EN content, four collection objects, three included groups, factual Pilotage bullets, quoted extras, starting-price variables, and localized CTAs. Build exactly four OfferCatalog entries and represent Pilotage as a Service additional property.

- [ ] **Step 4: Run the pricing contract**

Run: `node --test tests/tarifs-carte-vistaire-public.test.mjs`

Expected: all pricing tests pass with no Base/Premium legacy amount in localized data or JSON-LD.

### Task 2: Build the shared premium Pricing surface

**Files:**
- Create: `components/vistaire-preview/VistairePricingPreview.tsx`
- Create: `components/vistaire-preview/VistairePricingPreview.module.css`
- Modify: `components/seo/pages/TarifsMenuDigitalRestaurantPage.tsx`
- Modify: `components/vistaire-preview/RestaurateurDashboardDemo.tsx`
- Add: `public/images/pricing/vistaire-acrylique.jpg`
- Add: `public/images/pricing/vistaire-sculpte.jpg`
- Add: `public/images/pricing/vistaire-carre.jpg`
- Add: `public/images/pricing/vistaire-signature.jpg`

**Interfaces:**
- Consumes: `getPricingPage(locale)`, `getVistaireChromeRoutes()`, `PreviewNav`, `PreviewFooter`, and `RestaurateurDashboardDemo`.
- Produces: `<VistairePricingPreview locale="fr|en" routeMode="production" />`.

- [ ] **Step 1: Copy the four approved, lightweight JPG assets with stable runtime names**

Use Photo 4 for Acrylique, Photo 3 for Sculpté, Photo 5 for Carré, and Photo 2 for Signature. Do not copy Photo 1.

- [ ] **Step 2: Implement semantic shared composition**

Render hero, four collection articles, three included groups, Pilotage option, quoted extras/starting-price explanation, final CTA, and shared footer in that order. Use `Image` with square stable frames and localized alt text. Set `data-pricing-collection`, `data-pricing-pilotage`, and `data-pricing-dashboard` hooks for focused QA.

- [ ] **Step 3: Implement the page-local design system**

Define BT Suave/Neue Montreal, dark/cream/champagne variables, 1,360 px rail, four-column/2-column/1-column collection breakpoints, ivory Pilotage band, CSS laptop frame, reduced motion, focus-visible states, and mobile-safe two-row CTAs.

- [ ] **Step 4: Open the real dashboard at 30 days in the laptop**

Add `initialPeriodId?: RestaurateurPreviewPeriodId` with default `"24h"` to `RestaurateurDashboardDemo`; Pricing passes `"30d"`. Existing callers retain identical behavior.

- [ ] **Step 5: Point the French compatibility wrapper at the shared component**

```tsx
export function TarifsMenuDigitalRestaurantPage() {
  return <VistairePricingPreview locale="fr" routeMode="production" />;
}
```

### Task 3: Align routes, public chrome, and metadata

**Files:**
- Modify: `components/vistaire-preview/VistairePreviewChrome.tsx`
- Modify: `components/vistaire-preview/VistairePreviewChrome.module.css`
- Modify: `app/en/pricing-digital-restaurant-menu/page.tsx`
- Modify: `app/(seo)/tarifs-menu-digital-restaurant/page.tsx`

**Interfaces:**
- Produces: additive `<PreviewNav variant="marketing" />`; default `PreviewNav` callers remain unchanged.

- [ ] **Step 1: Add the marketing navigation variant**

Map Features/Fonctionnalités to the digital-menu pillar, Examples/Exemples to the sample menu, Pricing/Tarifs to the current route, Work/Réalisations to `#experiences` on the landing page, and About/À propos to the existing route. Localize the CTA to Book/Reserve a demo.

- [ ] **Step 2: Add responsive five-link styling**

Use five columns on wide screens and a six-track, two-row arrangement below 520 px so long French labels never create page overflow.

- [ ] **Step 3: Reduce the English route to metadata + shared component**

Keep the existing canonical/hreflang/robots/OG/Twitter/JSON-LD structure and render `<VistairePricingPreview locale="en" />`.

- [ ] **Step 4: Align social metadata with the new collection imagery**

Use the Acrylique product image as the bilingual social image and supply localized alt text.

- [ ] **Step 5: Run targeted static checks**

Run: `node --test tests/tarifs-carte-vistaire-public.test.mjs tests/bilingual-seo.test.mjs tests/seo-foundation.test.mjs`

Expected: all targeted tests pass.

### Task 4: Add focused rendered QA and stabilize once

**Files:**
- Create: `e2e/pricing-page.spec.ts`

**Interfaces:**
- Consumes: both public pricing routes and `data-pricing-*` hooks.
- Produces: reproducible responsive/console/network evidence.

- [ ] **Step 1: Add FR/EN public contract checks**

Assert localized H1, exactly four collections, exact setup and monthly prices, Pilotage option/total, marketing nav, final CTAs, and footer. Assert the page does not render Vistaire Base, Vistaire Premium, 125, 169, 249, or 2,500 pricing.

- [ ] **Step 2: Add responsive checks at required widths**

For 390×844, 430×932, 768×1024, 1280×800, and 1440×900, assert `document.documentElement.scrollWidth <= innerWidth`, visible collection cards, undistorted images, visible Pilotage, and reachable CTAs.

- [ ] **Step 3: Add console/network/hydration checks**

Collect page errors and error console messages, fail on 404/500 responses for first-party resources, and fail if any GLB/USDZ request occurs before user intent.

- [ ] **Step 4: Run the focused Playwright spec once for stabilization**

Run: `npm run test:e2e -- e2e/pricing-page.spec.ts --project=chromium --workers=1 --retries=0 --forbid-only`

Expected: all pricing scenarios pass.

### Task 5: Final verification, review, and delivery

**Files:**
- Review only; no new production surface unless findings require it.

- [ ] **Step 1: Run the single final matrix**

Run once, after stabilization: `npm ls --depth=0`, `npm run assets:check`, `npm run lfs:check`, `npm run lint`, `npm run typecheck`, `npm run build`, targeted Node tests, and the focused pricing Playwright spec.

- [ ] **Step 2: Compare reference and implementation**

Use `view_image` on Photo 1 and the latest 1,280/1,440 and 390 px screenshots. Record at least five comparison points: copy/order, typography, palette, collection photography, Pilotage break, spacing, and responsive collapse.

- [ ] **Step 3: Run one independent final review**

Provide the reviewer the base SHA, HEAD/diff, product brief, and focus areas: pricing accuracy, Pilotage truth, FR/EN parity, responsive behavior, metadata/JSON-LD, asset policy, and regressions. Fix Critical/Important findings only, then rerun only the directly affected proof unless production code changed after the final matrix.

- [ ] **Step 4: Clean and publish**

Remove `.next`, Playwright reports/results/traces/screenshots, and temporary scripts from the worktree; verify no secrets or debug statements; check `git status --short`; commit, push the dedicated branch, and inspect exact-HEAD CI/Vercel checks and preview when credentials/network allow.
