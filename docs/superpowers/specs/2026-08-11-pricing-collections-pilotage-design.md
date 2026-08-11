# Vistaire Pricing Collections + Pilotage Design

## Status

Approved by the user-provided product brief and the five supplied visual references on 2026-08-11. The written brief is the newest source of truth wherever it differs from the overview mockup.

## Objective

Replace the legacy Base / Premium / Signature SaaS-style packages on both public pricing routes with one premium restaurant experience made of four physical collections plus an optional Pilotage dashboard. The page must stay food-first, warm, dark, bilingual, mobile-first, and factual.

## Product contract

- Four physical collections only: Acrylique at 2,000 CAD, Sculpté at 2,050 CAD, Carré at 2,100 CAD, and Signature at 2,200 CAD.
- Every collection has a one-time setup price and the same 200 CAD monthly Vistaire service.
- Pilotage is an add-on, never a fifth collection: +100 CAD monthly, for a total of 300 CAD monthly with Vistaire.
- Every collection includes up to 20 personalized QR supports and up to five 3D dishes.
- Extra/replacement supports and extra 3D experiences are quoted separately.
- “Starting at” is explained by menu size, dish count, menu count, content preparation, 3D count, establishment count, support quantity, and project complexity.

## Information architecture

1. Existing Vistaire public navigation, extended with the requested five-item marketing set.
2. Centered editorial hero with the supplied eyebrow, H1, and supporting copy.
3. Four physical collection cards using the supplied product photographs.
4. Open, editorial “included in every offer” section grouped into experience, physical/immersive, and delivery/continuity columns.
5. Full-width ivory Pilotage option section with factual copy and the real Vistaire restaurateur dashboard rendered inside a laptop frame.
6. Compact quote-only information and “starting at” explanation.
7. Dark final CTA and the existing shared public footer.

The same shared component renders French and English. Route files remain thin and own only metadata, alternates, social metadata, and JSON-LD.

## Visual system

- Fonts: existing BT Suave display serif and Neue Montreal body family.
- Dark palette: `#0b0704` / `#100a06`, cream `#fff8eb`, champagne `#e8cf9b`, and fine translucent cream/champagne borders.
- Light interruption: warm ivory `#f1eadf` with charcoal copy for Pilotage.
- Containers: one wide editorial rail up to 1,360 px; square collection photography; subtle glass only where the reference uses framed physical objects.
- Cards: restrained 12–16 px radii and one-pixel borders. Signature receives a slightly stronger border/top rule, not a badge.
- Motion: hover lift/focus treatment only, disabled under reduced motion.
- No pricing toggle, annual billing, ecommerce control, aggressive popularity badge, cold gradient, or generic dashboard art.

## Assets

The user-supplied JPGs are the only faithful product images and are production-sized (approximately 189–283 KB each):

- `Photo 4` → Vistaire Acrylique.
- `Photo 3` → Vistaire Sculpté.
- `Photo 5` → Vistaire Carré; both wood finishes remain one collection.
- `Photo 2` → Vistaire Signature.

`Photo 1` is design reference only. Its vertical Signature object is superseded by the horizontal Signature explicitly defined in the brief and shown in Photo 2.

The physical images will be stored with stable names under `public/images/pricing/`. No LFS is needed. Existing restaurant imagery provides the page atmosphere. The Pilotage visual uses `RestaurateurDashboardDemo`, not a newly invented screenshot or fake dashboard.

## Pilotage truth boundary

Verified product capabilities that may be stated:

- update dish availability from the dashboard and reflect it after validation;
- menu openings;
- dishes viewed and consultations by category;
- searches, with privacy thresholds where applicable;
- 3D/AR interactions;
- activity by UTC time ranges;
- today, 7-day, and 30-day views with prior-period comparison;
- copying the public menu link.

Claims deliberately excluded because the repo does not prove them: pushed/live real-time synchronization, rolling 24-hour analytics, restaurant-configured service periods, report/data export, and sharing analytics reports.

## Navigation

The shared `PreviewNav` gains a marketing variant while preserving its existing default behavior:

- FR: Fonctionnalités, Exemples, Tarifs, Réalisations, À propos, Réserver une démo.
- EN: Features, Examples, Pricing, Work, About, Book a demo.

“Réalisations / Work” targets the existing landing experience section; no unimplemented route is invented.

## Responsive behavior

- 390 and 430 px: one collection per row, two-row marketing links, stacked included groups, Pilotage copy before laptop, full-width accessible CTAs, no page overflow.
- 768 px: two collection columns and stacked Pilotage composition.
- 1,280 and 1,440 px: four collection columns and two-column Pilotage layout.
- Product images use stable square frames and per-asset object positioning; no stretching.

## SEO and structured data

- Preserve both URLs, canonical URLs, FR/EN hreflang, x-default, robots, Open Graph, and Twitter metadata.
- Replace legacy package metadata and copy with the collection/Pilotage model.
- OfferCatalog contains exactly four collection offers. Pilotage is an optional property/add-on of the parent service, not a fifth catalog collection.
- Remove legacy FAQPage data because the new required page has no visible FAQ and the old answers contain contradictory prices.
- Keep WebPage, Service, OfferCatalog, and BreadcrumbList JSON-LD without ratings or reviews.

## Verification

- Node contract tests prove exact names, amounts, 200/100/300 monthly arithmetic, four JSON-LD offers, bilingual parity, and absence of legacy packages/prices.
- One focused Playwright pricing spec proves FR and EN rendering, public chrome/CTAs/footer, Pilotage, responsive widths, no horizontal overflow, no hydration/console error, no 404/500 response, and no early GLB/USDZ request.
- After targeted stabilization, run the requested final command matrix once, then one independent code/design review.

## Scope boundary

No changes to models, video, frames, 3D source folders, production dashboard behavior, auth, analytics collection, or unrelated marketing pages. Shared chrome changes are additive and default-preserving.
