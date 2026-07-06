# Vistaire client readiness

## Executive summary

Vistaire is close to a credible first high-end restaurant pilot, provided the
launch is sold and delivered as a guided premium service, not as a self-serve
SaaS. The current product can show a polished public landing page, a public
Maison Elyse demo menu, dish detail pages with selective 3D/AR affordances, a
public restaurateur preview, and a protected internal owner area.

The first restaurant should launch with a manually onboarded menu, approved
photos, one 3D/AR signature dish at most unless extra assets pass the same
review, and a Vistaire-managed readout of anonymous menu attention. Vistaire is
not ready to promise autonomous client dashboards, menu upload, POS, ordering,
payment, marketplace features, or fully automated 3D production.

## Readiness score

Overall current readiness: **74 / 100** for a controlled first restaurant pilot.

This is not a SaaS-readiness score. It means Vistaire can be taken into a
premium sales demo and first pilot if the manual boundaries below are respected.

| Area | Score | Current interpretation |
| --- | ---: | --- |
| Product | 78 | Strong menu-first concept, clear premium direction, still pilot-led. |
| Landing | 84 | Public positioning and always-video hero are demo-ready, pending deploy QA before each pitch. |
| Client menu | 78 | `/demo` proves navigation, categories, search, filters, dish cards, and mobile flow. |
| Dish detail | 76 | Rich food-first dish pages with ingredients, allergens, chef note, and optional immersive CTA. |
| 3D/AR | 62 | Runtime supports selective 3D/AR, but real-device QA and production asset approval remain manual gates. |
| Admin preview | 70 | `/admin` is useful for sales as a public noindex demo preview, not a protected client dashboard. |
| Owner/internal | 64 | `/owner` is protected internal pilot tooling; not yet tenant-scoped client self-service. |
| Pipeline | 72 | 3D manifest and validation docs/scripts exist, but delivery/storage and per-client activation remain manual. |
| Mobile performance | 73 | Mobile checks exist and hero video contract is covered; every pilot still needs 375/390/430 QA. |
| Sales | 66 | Offer and demo story are ready to package; pricing, legal copy, and first-client process still need owner sign-off. |

## Ready for a first restaurant

- A premium public story: Vistaire replaces a basic QR/PDF menu with a polished
  mobile menu experience for high-end restaurants.
- A public demo restaurant: Maison Elyse shows the desired client path without
  claiming to be a real customer.
- A convincing menu surface: categories, dish cards, search, filters, prices,
  availability, photos, allergens, chef notes, and signature dish emphasis.
- A selective immersive moment: one or a few dishes can expose "Voir en 3D" only
  after user intent.
- A restaurateur readout concept: `/admin` demonstrates anonymous menu attention
  signals such as opens, dish views, searches, service moments, and immersive
  interactions.
- Internal pilot tooling: `/owner` can support Vistaire's own tracking of
  restaurants and setup work behind Clerk.
- Asset guardrails: repo policy and checks exist to keep heavy/raw media out of
  Git.

## Still blocking

- No self-serve client dashboard exists.
- No tenant/organization authorization exists for restaurant-owned analytics.
- `/admin` is public preview content and must not be sold as a protected client
  portal.
- `/api/analytics/events` is public ingestion; origin, abuse, rate limiting, and
  known restaurant/menu enforcement still need production review.
- `/api/admin/assistant` is same-origin checked but unauthenticated; cost and
  abuse controls must be verified before heavy public use.
- Real Supabase data can fall back to demo insights when incomplete; a real
  client must never see demo numbers presented as live performance.
- Real iPhone Quick Look and Android Scene Viewer validation must happen on real
  devices and the exact deployed URL.
- Production client 3D activation still needs runtime resolver/header/CDN review:
  the current pipeline validates structure, but storage/CDN delivery and client
  asset activation remain future work.
- QR generation, menu import, photo editing, 3D production, approvals, and launch
  operations remain manual.

## Product boundaries

| Surface | Status | Boundary |
| --- | --- | --- |
| Public landing | Public, indexable | Marketing and value proposition for Vistaire. |
| Public demo Maison Elyse | Public, indexable at `/demo` | Demo restaurant only; not a real customer claim. |
| Public admin preview demo | Public, noindex and robots-disallowed at `/admin` | Sales preview of restaurateur insights; not private admin or SEO content. |
| Protected owner internal | Clerk + owner allowlist at `/owner` | Vistaire internal pilot operations; not client self-service. |
| Future client dashboard | Not built | Requires tenant auth, restaurant scoping, production data contracts, and client UX. |
| Public APIs | Public ingestion/preview only | `/api/analytics/events`, `/api/admin/assistant`; constrained but not authenticated. |
| Protected APIs | Clerk + owner allowlist | `/api/restaurants`, `/api/owner/*`, `/api/analytics/summary`; owner-only internal operations, not tenant client authorization. |

## Routes and indexing

Public routes:

- `/`
- `/apercu-restaurateur`
- `/demo`
- `/demo`
- `/admin`
- `/sign-in`
- SEO pages such as `/menu-digital-restaurant`, `/menu-qr-code-restaurant`,
  `/menu-3d-ar-restaurant`, and `/menu-pdf-vs-menu-digital`

Protected routes:

- `/owner`
- `/todos` (starter route, outside product scope)
- `/api/restaurants`
- `/api/owner/*`
- `/api/analytics/summary`

Routes that should not be indexed:

- `/admin`
- `/owner`
- `/sign-in`
- `/todos`
- `/api/*`
- `/demo` pages, because individual demo dishes are useful for QA
  and sales navigation but should not become search landing pages.

Security and auth risks to verify:

- Noindex and robots rules are SEO hygiene, not security.
- `/owner` is protected by Clerk and server-side owner allowlists; it should
  still never be presented as a client portal.
- Protected APIs should not be treated as tenant-safe until role/org checks and
  restaurant ownership filters exist.
- Public analytics ingestion needs abuse/rate-limit review before production
  volume.
- Public assistant traffic should not create unbounded AI/API cost.
- Analytics must stay anonymous. Search terms and free-text inputs should not be
  treated as consented personal data, and Vistaire should not claim GDPR, PCI, or
  legal compliance without a separate review.

## First restaurant onboarding checklist

Restaurant information:

- Legal name and displayed restaurant name.
- Public slug and preferred menu URL.
- Address, city, neighborhood, country, and time zone.
- Cuisine type and service format.
- Currency.
- Primary owner/contact name, email, and phone.
- Launch contact for day-of corrections.
- Internal notes and go/no-go owner.

Branding:

- Logo or monogram.
- Brand colors and any forbidden colors.
- Preferred visual tone: intimate, bright, classic, modern, tasting-menu, etc.
- Short French tagline.
- Short restaurant description.
- Dining-room context line for the menu header.
- Confirmation that all Maison Elyse demo labels are replaced for the pilot.

Menu:

- Menu version and effective date.
- Categories in display order.
- Category descriptions.
- Dish list per category.
- Prices, supplements, market-price exceptions, taxes/service wording if needed.
- Availability and seasonal notes.
- Signature and recommended flags.

Dish content:

- Dish name.
- URL slug.
- Short description for cards.
- Full description for detail page.
- Ingredients.
- Allergens, verified by the restaurant.
- Options, substitutions, and dietary notes.
- Sides, supplements, or sharing formats.
- Chef recommendation, pairing, or service note.
- Estimated preparation label only if the restaurant wants it displayed.

Photos and documents:

- Source photo per priority dish.
- Usage rights confirmation.
- Mobile card crop approval.
- Dish detail crop approval.
- Alt text or descriptive photo notes.
- Logo files, menu PDFs, wine/cocktail sheets, and brand references.
- Any files above the repo policy threshold must stay outside Git unless an
  explicit exception is approved. See `docs/repo-asset-policy.md`.
- Anything under `public/` is directly served to users. Do not place review
  renders, backups, raw source models, candidate GLB/USDZ files, screenshots,
  logs, secrets, or internal launch notes there.

3D/AR signature dishes:

- Select 1 required launch dish and up to 2 candidates for later release.
- Confirm the dish benefits from volume, plating, or table projection.
- Keep source/work/review assets outside Git.
- Produce approved web GLB, mobile/AR-lite GLB, iOS USDZ, and poster variants
  only through the documented 3D pipeline.
- Record URLs, bytes, checksum, status, reviewer, approval date, and publish
  date.
- Validate model-viewer behavior, iOS Quick Look, Android Scene Viewer,
  fallbacks, headers, and no early GLB/USDZ requests before publication.
- Use `docs/production-3d-ar-pipeline.md`, `docs/ar-asset-optimization-pipeline.md`,
  `docs/usdz-optimization.md`, and `docs/repo-asset-policy.md` as source docs.
  Do not treat structural validation as real-device approval.

Client validation:

- Menu copy approved.
- Prices approved.
- Allergens and dietary notes approved by the restaurant.
- Photos approved.
- 3D/AR approved on real devices if launched.
- Preview URL approved by restaurant owner.
- QR destination approved.
- Written go/no-go before publication.

Publication:

- Stable production URL.
- QR code generated manually from the final URL.
- QR code tested from printed table-card proof.
- Analytics ingestion verified.
- Rollback URL or static fallback prepared.
- First-service monitoring window assigned to a Vistaire owner.

## Go/no-go gate

Go for a first restaurant pilot only when:

- The final restaurant menu, prices, photos, allergens, and QR destination are
  approved in writing.
- The production deploy passes route, mobile, console, Network, asset, LFS,
  lint, typecheck, build, and smoke validation.
- No real client journey displays Maison Elyse demo/fallback analytics.
- `/owner` remains internal and protected, and `/admin` is not represented as a
  private client portal.
- Any launched 3D/AR dish has approved assets, byte/header evidence, browser QA,
  and real iPhone/Android device results if AR support is claimed.

No-go if:

- The restaurant expects ordering, payment, POS, reservations, or self-serve
  dashboard access in the first launch.
- Allergens or prices are not restaurant-approved.
- QR points to the wrong environment.
- GLB/USDZ files load before user intent without an explicitly approved preload.
- Demo data or fallback analytics could be mistaken for live restaurant data.

## First client delivery pipeline

Day 0 setup:

- Confirm restaurant owner, decision maker, launch date, and pilot scope.
- Create internal tracking entry.
- Decide whether launch includes 0 or 1 3D/AR dish.
- Freeze the no-POS, no-payment, no-ordering scope in writing.

Collection:

- Gather menu, pricing, allergens, photos, brand assets, and contact details.
- Convert any messy source files into a structured onboarding sheet.
- Flag missing prices, allergen uncertainty, unavailable dishes, or legal copy.

Menu creation:

- Build categories, dish records, flags, and descriptions.
- Add photos and crop notes.
- Review on mobile first.
- Keep demo data separate from real restaurant data.

Photos and assets:

- Optimize images.
- Confirm card and detail crops at 375, 390, and 430 px.
- Keep large/raw/source files out of Git and deployment.
- Use `docs/repo-asset-policy.md` as source of truth for asset handling.

3D/AR signatures:

- Produce only the agreed launch dish first.
- Validate manifests, bytes, checksums, and headers.
- Run model-viewer QA in browser.
- Test iOS Quick Look and Android Scene Viewer on real devices before claiming
  support.
- Keep fallback copy ready if AR fails.

QA mobile:

- Test `/`, `/demo`, `/demo`, `/admin`, and `/owner`.
- Check 375, 390, and 430 px widths.
- Check console and Network.
- Confirm no horizontal overflow.
- Confirm no GLB/USDZ before user intent, except an explicitly documented and
  approved preload path.

Client preview:

- Send a preview link and a short review checklist.
- Ask the restaurant to approve menu content, prices, allergens, photos, and
  3D/AR separately.
- Log required corrections.

Corrections:

- Apply only approved changes.
- Re-run targeted QA for changed routes and assets.
- Reconfirm launch URL and QR destination.

Launch:

- Publish final URL.
- Test QR code on iPhone and Android from a printed proof.
- Monitor first service.
- Collect feedback and analytics sanity checks the next day.

## Commercial demo checklist

- Landing `/` loads.
- Hero video is active and uses the expected desktop/mobile video for viewport.
- Primary CTA opens `/demo`.
- `/demo` loads Maison Elyse menu and clearly reads as a demo restaurant.
- Search, filters, category tabs, and dish cards work at 375, 390, and 430 px.
- `/demo` loads.
- "Voir en 3D" is visible for Homard and no `model-viewer` exists before click.
- No GLB/USDZ is requested before user intent.
- Clicking 3D loads the GLB path without 404/500.
- `/admin` loads as public noindex demo preview.
- `/owner` redirects or blocks when signed out and does not expose the private
  dashboard publicly.
- Vercel deployment URL matches the demo URL used in sales.
- Console has no unexpected errors.
- Network has no obvious 404/500.
- No private or raw asset is requested from public pages.

## Real mobile QA checklist

- iPhone width around 390 px, Safari.
- iPhone width around 430 px, Safari.
- Android Chrome around 390-430 px.
- Restaurant WiFi.
- Mobile data.
- Low-power or data-saving mode if available.
- QR scan from printed table-card proof.
- Landing first viewport readable and hero video active.
- Menu search and filters usable with thumb reach.
- Category tabs do not create horizontal overflow.
- Dish photos crop correctly on cards and detail pages.
- Price, allergens, options, and chef note remain legible.
- Back navigation from dish to menu is clear.
- `/admin` is readable but not presented as a private client portal.
- Any auth redirect from `/owner` is understandable and does not reveal owner
  content.

## Real 3D/AR QA checklist

Before user intent:

- `/demo` does not request GLB or USDZ.
- Dish detail does not render `model-viewer` before "Voir en 3D".
- USDZ is not linked or prefetched unless an approved path requires it.
- Demo-only prefetch behavior is not production approval; client assets need a
  stricter documented intent/preload decision.

Model-viewer:

- `model-viewer` custom element loads after intent.
- Web GLB loads without 404/500.
- Loader, timeout, retry, and fallback states work.
- The dish can rotate and remain framed on mobile.
- Analytics event for 3D click does not block the experience.

iOS Quick Look:

- Test on real iPhone Safari over HTTPS.
- Use the exact deployment URL, not localhost.
- Confirm `rel="ar"` handoff opens Quick Look.
- Confirm fallback copy if USDZ is absent or blocked.
- Record device, iOS version, browser, URL, commit/deploy, date, and reviewer.

Android Scene Viewer:

- Test on real Android Chrome over HTTPS.
- Confirm whether Scene Viewer is available on that device.
- Confirm fallback copy when not available.
- Record device, Android version, Chrome version, URL, date, and reviewer.

Headers and bytes:

- Validate GLB/USDZ content type, cache headers, range support where needed, and
  inline USDZ behavior.
- Record bytes for each variant and compare against the current 3D pipeline
  budgets.
- Keep heavy production assets in storage/CDN or an approved path, not as new
  Git binaries.
- Current structural validators do not by themselves prove storage/CDN runtime
  readiness, real-device AR behavior, or tenant-safe client activation.

## Useful restaurant metrics

- Menu opens.
- Estimated anonymous sessions.
- Dish detail views.
- Card-to-detail rate when impressions are available.
- Top dishes and top categories.
- Search terms.
- Searches with no useful result.
- Filter and allergen usage.
- 3D/AR click rate per eligible dish.
- Service time windows when guests consult the menu.
- Dish detail time, treated directionally.
- 3D/AR failures and fallback rate by device, kept mostly internal.

## Metrics to avoid

- Revenue, ROI, margin, covers, orders, reservations, tips, satisfaction, or
  reviews unless integrated data exists.
- "Purchase intent" claims from 3D or dish views alone.
- Raw 3D/AR click totals without a denominator.
- Model rotations, zooms, drag counts, polygon counts, or texture sizes as
  restaurateur-facing KPIs.
- Black-box engagement scores unless explained as simple attention ranking.
- `dashboard_demo_opened` as a restaurant success metric.
- Demo fallback numbers in a real client readout.

## Manual at the beginning

- Sales qualification.
- Menu import and cleanup.
- Dish slugs and category ordering.
- Photo selection, optimization, and crop approval.
- Allergen verification.
- 3D/AR dish selection and production review.
- Client approval.
- QR code creation and printed proof.
- First-service monitoring.
- Post-launch corrections.
- Restaurant-facing insight summary.

## Automate later

- Structured menu import from spreadsheet/PDF.
- Restaurant-specific public route or domain provisioning.
- Client-safe dashboard with tenant auth.
- Role-based access for restaurant owners and staff.
- Production analytics completeness diagnostics.
- QR code generation and print-ready exports.
- Asset upload workflow with validation.
- 3D/AR manifest publishing from storage/CDN.
- Alerting for failed analytics ingestion or asset 404s.
- Client-facing weekly insight summary.

## Features to avoid now

- POS.
- Payment.
- Ordering.
- Reservations.
- Marketplace.
- Full self-serve dashboard.
- Menu upload CMS.
- Staff management.
- Inventory.
- Loyalty.
- Heavy AI assistant claims.
- Complex analytics workbench.
- Multi-restaurant client portals.
- Any promise that Vistaire replaces existing restaurant operations software.

## Recommended pilot offer

Offer: **Vistaire Premier Restaurant Pilot**.

Positioning:

- Replace the restaurant's basic QR/PDF menu with a premium mobile menu.
- Launch with restaurant-approved copy, prices, allergens, photos, and one
  optional signature 3D/AR dish.
- Provide a Vistaire-managed readout of anonymous attention signals after the
  first services.

Included:

- One branded mobile menu.
- Up to one active menu version.
- Core dish pages for the launch menu.
- Photo crop/optimization guidance.
- One 3D/AR signature dish if production and device QA pass.
- QR code destination and launch QA.
- One post-launch insight summary.

Explicitly excluded:

- Payment, ordering, POS, reservations, loyalty, and marketplace.
- Self-serve dashboard or menu upload.
- Guaranteed sales lift or ROI.
- More than one 3D/AR dish unless separately approved.

## Demo script: 5 minutes

1. Open `/` and say: "Vistaire turns a restaurant QR code into a premium menu
   experience, built for high-end dining rather than generic ordering software."
2. Point to the hero and value proposition: food-first visuals, menu clarity,
   and a selective immersive moment.
3. Open `/demo`: "This is Maison Elyse, our demonstration restaurant, showing
   the guest path after scanning a table QR code."
4. Filter/search quickly, then open Homard: "The guest sees the dish, price,
   ingredients, allergens, options, and chef note before deciding."
5. Click "Voir en 3D": "Immersive assets load after intent. We do not force
   heavy 3D on the first menu view."
6. Open `/admin`: "For the restaurateur, Vistaire can summarize anonymous
   attention signals: what guests open, search, and explore. This is a public
   demo preview, not yet a self-serve portal."
7. Close: "The first pilot is manually onboarded, polished, and realistic. We
   start with the menu and one signature immersive dish, then expand only after
   the first service proves the workflow."

## Demo script: 15 minutes

1. Start on `/` and frame the problem: QR menus often feel like PDFs; Vistaire
   turns them into a premium, mobile-first menu experience.
2. Explain the pilot boundary: no ordering, no payment, no POS, no marketplace.
   The first release focuses on the guest choosing with confidence.
3. Open `/demo` on mobile width or a real phone. Show the Maison Elyse identity,
   categories, search, filters, and dish cards.
4. Open a non-3D dish first to show the normal menu quality: photo, price,
   ingredients, allergens, chef note.
5. Open `homard-bisque`. Explain why only signature dishes deserve 3D/AR at
   first: production cost, device QA, and performance.
6. Before clicking 3D, state that no GLB/USDZ should load until the guest asks
   for it. Then click and show the model-viewer experience.
7. Discuss real-device AR caveat: iPhone Quick Look and Android Scene Viewer can
   be validated only on actual devices and the exact deploy URL.
8. Return to `/demo` and show how the menu remains useful without 3D.
9. Open `/admin`. Present it as a demo preview of restaurateur insights:
   menu opens, dish views, search patterns, service moments, and immersive
   interactions.
10. Clarify `/admin` versus `/owner`: `/admin` is public preview; `/owner` is
    protected internal Vistaire tooling; future client dashboards need tenant
    authorization.
11. Walk through onboarding: menu data, photos, allergens, 1 signature dish,
    client approval, QR proof, launch QA.
12. Finish with the pilot offer and a decision question: "Which one dish would
    be worth making unforgettable in 3D/AR for your guests?"

## Objections and responses

| Objection | Response |
| --- | --- |
| "We already have a QR menu." | "Vistaire is not another PDF behind a QR code. It is a branded mobile menu that helps guests understand dishes, allergens, signatures, and the story of the table." |
| "Can guests order or pay?" | "Not in the pilot. The first version protects the dining experience and avoids POS complexity. Ordering/payment can be evaluated later only if it serves the restaurant." |
| "Is this a dashboard we manage ourselves?" | "Not yet. The pilot is concierge-style: Vistaire handles setup and gives a clear readout. A client dashboard comes later after access control and data scoping are production-ready." |
| "Will 3D slow the menu?" | "The menu is food-first. 3D loads after user intent, and only for approved dishes. We verify no GLB/USDZ loads on first menu view." |
| "Can every dish be in AR?" | "Technically later, but not strategically now. The premium approach is 1 signature dish first, then expand when production quality and device QA are proven." |
| "Will this prove more sales?" | "Vistaire can show attention signals, not sales or ROI unless connected to ordering/POS data. We stay honest: what guests open, search, and explore." |
| "What happens if AR fails on a phone?" | "The menu remains complete without AR. AR has fallbacks, and we only claim iOS/Android support after real-device testing." |
| "Can you import our PDF automatically?" | "For the pilot, onboarding is manual so the copy, allergens, prices, and photos are correct. Automation comes after the first workflow is stable." |

## Red team

What can make Vistaire lose trust:

- Presenting Maison Elyse as a real customer.
- Calling `/admin` a protected client dashboard.
- Letting a real restaurant see demo fallback analytics.
- Claiming iPhone Quick Look or Android Scene Viewer without real-device proof.
- Loading GLB/USDZ before user intent on a menu page.
- Adding heavy restaurant assets to Git.
- Promising ordering, payment, POS, reservations, or ROI.
- Hiding that onboarding is manual.
- Overusing AI language instead of restaurant value.
- Showing `/owner` as the product instead of as internal Vistaire tooling.

Corrections applied to this strategy:

- The pilot is described as guided and manual-first.
- `/admin` is explicitly public demo preview.
- `/owner` is explicitly internal and protected.
- Future client dashboard is explicitly not built.
- 3D/AR is limited to approved signature dishes with real-device QA.
- Restaurant metrics stay within anonymous attention signals.
- Asset/LFS limits point to `docs/repo-asset-policy.md`.

## Next recommended PRs

1. Add client-specific route/data design doc for the first real restaurant,
   still docs-only, before runtime wiring.
2. Add analytics request guards and production diagnostics for public ingestion.
3. Add a client-safe dashboard/auth design for tenant ownership before exposing
   any real restaurant analytics.
4. Pilot one approved 3D dish manifest through storage/CDN without Git binaries.
5. Add first-restaurant onboarding template or spreadsheet export once the
   pilot fields are approved.
6. Add Vercel/deploy checklist for launch-day environment variables, Clerk,
   Supabase, analytics, and asset delivery.
