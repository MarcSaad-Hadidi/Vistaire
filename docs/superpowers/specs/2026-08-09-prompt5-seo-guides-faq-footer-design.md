# Vistaire Prompt 5 — SEO guides, contextual FAQ, footer, and PDF comparison design

## Status and authority

This design implements the user-approved Prompt 5 specification. It does not expand the requested scope.

- Certified base: `52ebf08e9a396ccba9dd7399d17b00b47ee662cf`.
- Post-merge PR #199 gate: 16/16 GitHub check runs completed successfully, including `webkit-critical`; Vercel completed successfully.
- Working branch: `feat/seo-guides-faq-footer` in an isolated worktree.
- Package manager: npm, proven by `package-lock.json`; no Yarn or pnpm lockfile exists.
- Baseline: `npm ci`, `npm ls --depth=0`, assets, LFS, lint, typecheck, build, SEO tests, landing contracts, landing i18n, and slider keyboard contract pass.

## Existing-route inventory

| Route | Locale | Search intent | H1 | Effective title | Canonical pair | Current page JSON-LD | Visible FAQ | Main CTA path | Footer | Principal risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `/menu-pdf-vs-menu-digital` | FR | PDF versus real digital menu comparison | Un PDF n'est pas un menu digital. | Menu PDF vs menu digital restaurant \| Vistaire | self ↔ `/en/pdf-vs-digital-menu` | WebPage, BreadcrumbList, Service, FAQPage | 6 items from `page.faq` | Demo + booking in hero and final | `PreviewFooter` | phone loses presence at 1280; adjacent duplicate demo link in final internal links |
| `/en/pdf-vs-digital-menu` | EN | Same comparison intent | A PDF is not a digital menu. | PDF menu vs digital restaurant menu \| Vistaire | self ↔ FR | Same localized page graph | 6 localized items | Sample menu + booking | `PreviewFooter` EN | same geometry and CTA risks |
| `/menu-digital-restaurant` | FR | Premium digital restaurant menu category | Le menu digital premium transforme la carte en expérience. | Menu digital restaurant premium \| Vistaire | self ↔ `/en/digital-restaurant-menu` | WebPage, BreadcrumbList, Service, FAQPage | 6 route-specific items | Demo + booking | `PreviewFooter` | dead `/admin` CTA remains in data; adjacent duplicate demo link in final internal links |
| `/en/digital-restaurant-menu` | EN | Same category intent | A premium digital menu turns the menu into an experience. | Premium digital restaurant menu \| Vistaire | self ↔ FR | Same localized page graph | 6 localized items | Sample menu + booking | `PreviewFooter` EN | same CTA drift risk |
| `/` | FR | Brand and premium QR menu landing | Donnez envie avant la première bouchée. | Menu digital QR premium pour restaurants haut de gamme \| Vistaire | self ↔ `/en` | WebPage, Service plus global graph | none | product proof, owner proof, final booking | `PreviewFooter` | do not duplicate pillar FAQ or over-prune distinct CTAs |
| `/en` | EN | English brand landing | Make every dish tempting before the first bite. | Premium QR digital menu for high-end restaurants \| Vistaire | self ↔ FR | WebPage, Service plus global graph | none | localized equivalents | `PreviewFooter` EN | global organization/service descriptions remain French; do not widen scope unless touched by guide schema |
| `/demo` | FR/default | Product proof destination only | CARTE DIGITALE | Menu client exemple \| Vistaire | self ↔ `/en/vistaire-menu` | WebPage, BreadcrumbList | none | experience switching | `PreviewFooter` | regression target only; no SEO rewrite or FAQ |

Other published SEO routes already have contextual FAQs. The QR, 3D/AR, pricing, and GEO/AEO pages keep their existing route-specific questions. No sitewide FAQ is injected. About, contact, booking, sample menus, and noindex restaurant menus receive no new FAQ.

## Baseline PDF comparison geometry

All values are real Chromium bounding boxes at device scale factor 1 after fonts and the active Maison Élyse renderer were ready.

| Viewport | Phone width | Phone height | Slider card width | Phone/card ratio | Horizontal overflow | Observable CLS |
|---|---:|---:|---:|---:|---:|---:|
| 1440×900 | 404.50 | 724.11 | 634.50 | 0.6375 | 0 | 0.000082 |
| 1280×800 | 329.30 | 590.41 | 559.30 | 0.5888 | 0 | 0.000116 |
| 768×1024 | 312.00 | 559.66 | 538.00 | 0.5799 | 0 | 0.000448 |
| 430×932 | 231.61 | 418.30 | 392.00 | 0.5908 | 0 | 0.010213 |
| 390×844 | 231.61 | 418.30 | 352.00 | 0.6580 | 0 | 0 |

The current device uses no transform. Console, page errors, failed requests, HTTP 4xx/5xx, and GLB/USDZ requests were all empty during these measurements.

## Architecture decisions

### PDF comparison

Add a route-scoped device-emphasis variant to the existing interactive comparison. The default landing and digital-menu geometry must not change. The emphasized variant may change real grid tracks, max width, and responsive layout, but must keep a true 9:16 screen, correct reserved layout space, and the existing slider semantics.

Target after measurement, not as a brittle pixel contract:

- approximately 25–35% more phone width at 1440 and 1280;
- a materially more readable phone at 768, 430, and 390 without horizontal overflow;
- no `transform: scale()` as the sizing mechanism;
- pointer, touch, keyboard, clip geometry, and 3D request behavior unchanged.

### FAQ

Keep `SeoPageData.faq` as the single source of truth. The same array continues to feed `SeoFaq` and `buildFaqPageJsonLd`; no parallel schema registry is introduced.

Improve the four required localized FAQ sets so PDF comparison and digital-menu intent stay distinct. A small accessible accordion may be added only with real buttons, `aria-expanded`, `aria-controls`, visible focus, native Enter/Space behavior, SSR HTML for every answer, and reduced-motion handling. No dependency is added. Automated tests normalize whitespace and prove exact visible/schema parity for FR and EN rendered HTML.

### Editorial guides

Create one typed editorial guide registry and one shared premium server-rendered guide layout. Six routes are published:

- `/guides/anatomie-menu-digital-premium`
- `/en/guides/premium-digital-menu-anatomy`
- `/guides/menu-qr-mobile-sans-application`
- `/en/guides/mobile-qr-menu-without-app`
- `/guides/3d-restaurant-utile-vs-gadget`
- `/en/guides/restaurant-3d-useful-vs-gimmick`

Each pair has unique metadata, self-canonical hreflang through the existing bilingual registry, one H1, visible breadcrumb navigation plus BreadcrumbList, useful cross-links, and optional `Article` JSON-LD without invented author or dates. The existing bilingual registry drives sitemap inclusion. No thin `/guides` hub is created; the landing's existing Guides section becomes the useful discovery surface for all three resources.

### Footer

Evolve `PreviewFooter` in `VistairePreviewChrome.tsx`; do not render `SeoFooter` and do not add a layout-level footer that would leak into admin, owner, or restaurant-menu surfaces.

The groups are Product, Guides, Solutions/Needs, Local, and Contact. Links come only from real bilingual routes. Local contains only Montréal, Laval, and Brossard published routes; restaurant segments are not mislabeled as locations. The existing pricing route may remain linked, but its page is not changed. No legal placeholder, `href="#"`, future local route, or new `/apercu-restaurateur` work is added.

Mobile uses a true single-column composition with at least 44px interactive targets where feasible and no compressed desktop grid.

### CTA audit

Preserve distinct conversion roles: nav booking, hero proof/booking, strategic final CTA, and footer booking. Remove only adjacent duplicates proven by route structure:

- on PDF and digital-menu pages, remove the repeated sample-menu link from the final internal-link row when the immediately preceding final secondary button already targets the same route;
- in the footer, do not render two adjacent labels to the same sample-menu URL;
- preserve analytics behavior; current marketing CTAs have no active event wiring, so no menu-scoped analytics helper is added.

### Performance and scope

No dependency, font, image, video, GLB, USDZ, or LFS rule is added. Existing images remain unchanged. FAQ and guide content is server rendered. No Pricing, restaurant-preview, dashboard, 3D/AR runtime, restaurant-menu redesign, auth, or security baseline implementation is included.

## Validation contract

- Static: assets, LFS, lint, typecheck, build, focused Node tests, SEO, i18n, and landing tests.
- Browser: dedicated Prompt 5 Playwright suites for PDF geometry/interaction, FAQ parity/accessibility, six guides, and footer links/mobile.
- Regression: core, landing, `/demo`, Maison Élyse FR/EN switch, Trouvable, Sauge Noire, all four required SEO routes, admin QR critical, and WebKit critical.
- Runtime HTML: parse all affected JSON-LD and prove no duplicate FAQPage/Article/BreadcrumbList injection.
- Network: no unexpected 404/500, hydration error, or eager GLB/USDZ request.
- Final GitHub/Vercel: exact PR HEAD, no pending/failure, behind main = 0, no merge or auto-merge.
