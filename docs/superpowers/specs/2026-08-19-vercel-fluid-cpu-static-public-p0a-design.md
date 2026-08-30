# Vistaire Vercel Fluid CPU P0-A Design

## Decision and authority

Implement the approved two-root-layout architecture on `perf/vercel-fluid-cpu-static-public`, based exactly on `origin/main` commit `fddf75c41ebc96c0f71295d5cc074277c0c2fba2`.

P0-A changes the rendering architecture for named public marketing routes. It must make those routes static or ISR, remove request-scoped APIs from the public document root, and reduce Proxy execution to the routes that demonstrably require it. It must preserve all public URLs, bilingual SEO, the landing hero, menu experiences, authentication, agent discovery, and dynamic application surfaces.

This design does not authorize a production deployment, a merge to `main`, a migration, a paid service, a Vercel or Cloudflare dashboard change, or the P0-B landing/menu cache work.

The user approved two binding clarifications after the initial specification commit:

1. P0-A does not change any landing or menu cache TTL, tag, invalidation, deduplication, persistence, or signed-URL strategy. The homepage target is **static or ISR with current cache semantics preserved**, never “ISR 900 seconds” in P0-A.
2. Static generation must remain hermetic and must not serialize sensitive or ephemeral material into HTML, RSC payloads, manifests, build artifacts, or durable caches.

## Certified baseline

- Package manager: npm, proven by `package-lock.json`.
- Local production build: successful on the certified base.
- Current route output: nearly every page is dynamic (`ƒ`).
- Root cause: top-level `app/layout.tsx` awaits `headers()` to obtain locale and Sauge route-theme headers.
- Proxy cause: `proxy.ts` has a broad negative-lookahead matcher that covers almost every non-asset request.
- Prerender manifest: only discovery and metadata route handlers are prerendered; `dynamicRoutes` is empty.
- Production observation: the deployed base reproduces the dynamic route table. Read-only seven-day Vercel logs contained 147 middleware/proxy and 133 function events in the observed grouping, including marketing routes.
- Controlled live HTML checks: `/` and `/en` returned correct initial language, canonical data, hero sources, and no initial GLB/USDZ, but both were private/no-store and Cloudflare `DYNAMIC` with Vercel cache misses.
- Controlled content-negotiation check: `/` with `Accept: text/markdown` returned correct Markdown and `Vary: Accept`.
- Existing defect: live HTML did not include `Accept` in the final `Vary` header, while the `Link` discovery header was duplicated.

The detailed pre-change evidence remains archived outside Git in `vistaire-vercel-cpu-baseline.md` under the task visualization directory.

## P0-A scope

### Named routes that must become static or ISR

French:

- `/`
- `/a-propos`
- `/contact`
- `/prendre-rendez-vous`
- `/menu-digital-restaurant`
- `/menu-pdf-vs-menu-digital`
- `/menu-qr-code-restaurant`
- `/menu-3d-ar-restaurant`
- `/tarifs-menu-digital-restaurant`
- `/guides/anatomie-menu-digital-premium`
- `/guides/menu-qr-mobile-sans-application`
- `/guides/3d-restaurant-utile-vs-gadget`
- `/apercu-restaurateur`, provided its existing fixture remains isolated and request-independent

English:

- `/en`
- `/en/about`
- `/en/contact`
- `/en/book-a-call`
- `/en/digital-restaurant-menu`
- `/en/pdf-vs-digital-menu`
- `/en/qr-code-restaurant-menu`
- `/en/3d-ar-restaurant-menu`
- `/en/pricing-digital-restaurant-menu`
- `/en/guides/premium-digital-menu-anatomy`
- `/en/guides/mobile-qr-menu-without-app`
- `/en/guides/restaurant-3d-useful-vs-gimmick`
- `/en/restaurant-preview`, provided its existing fixture remains isolated and request-independent

The build is the authority for the final `○`/ISR classification. A named route may remain `ƒ` only if a request-time dependency is found, documented with code evidence, and explicitly accepted before P0-A is declared complete.

The P0-A route table must describe `/` exactly as “static or ISR with current cache semantics preserved.” A 900-second TTL is not part of this phase.

### Routes that intentionally remain dynamic

- `/demo`
- `/en/vistaire-menu`
- `/[slug]`
- `/en/[slug]`
- `/menu/[slug]`
- `/menu/[slug]/dishes/[dishSlug]`
- `/admin/**`
- `/owner/**`
- `/api/**`
- `/q/**`
- `/sign-in/**`
- `/todos/**`
- `/legacy/**`

The two GEO catch-alls must not receive `generateStaticParams` in P0-A. Static generation is deferred until a deterministic slug inventory, conflict audit, 404 behavior, redirects, and freshness have separate proof.

## Filesystem architecture and movement map

There will be no top-level `app/layout.tsx` after the route move.

The French root group receives every non-English page-bearing subtree so current URLs remain unchanged:

```text
app/(fr)/layout.tsx
app/(fr)/page.tsx
app/(fr)/(geo)/**
app/(fr)/(seo)/**
app/(fr)/a-propos/**
app/(fr)/admin/**
app/(fr)/apercu-restaurateur/**
app/(fr)/contact/**
app/(fr)/demo/**
app/(fr)/guides/**
app/(fr)/legacy/**
app/(fr)/menu/**
app/(fr)/owner/**
app/(fr)/prendre-rendez-vous/**
app/(fr)/q/**
app/(fr)/sign-in/**
app/(fr)/todos/**
```

The English root group receives the current English tree without changing its `/en` prefix:

```text
app/(en)/layout.tsx
app/(en)/en/**
```

Standalone route handlers and metadata files remain at the application root unless a page-bearing mixed subtree requires moving as one unit:

```text
app/api/**
app/.well-known/**
app/auth.md/**
app/openapi.json/**
app/robots.ts
app/sitemap.ts
app/icon.svg
app/globals.css
```

`admin` and `q` contain both pages and route handlers; each subtree moves intact into `(fr)` so it has one root layout and keeps every URL. The route groups are filesystem-only and must not appear in generated URLs, redirects, canonicals, sitemap entries, or links.

Before each move, relative imports and tests that open files by literal path must be inventoried. Moved modules retain their internal structure; only references whose filesystem depth actually changes may be updated. Alias imports remain unchanged.

## Static document roots

Both `app/(fr)/layout.tsx` and `app/(en)/layout.tsx` are synchronous, request-independent root layouts that render their own literal `<html>` and `<body>` elements.

The French layout sets `lang="fr-CA"`; the English layout sets `lang="en-CA"`. Neither layout may import or invoke `headers`, `cookies`, `connection`, `draftMode`, or another request-scoped API. Locale must not be corrected after hydration.

The root layouts import the same global stylesheet and call shared locale-aware metadata helpers. Locale-specific defaults use the existing French root metadata and the existing `/en` page's English messaging; no new marketing claims are invented.

`components/layout/VistaireDocumentShell.tsx` owns the shared body contents:

- localized skip link;
- global Organization, ProfessionalService, and Website JSON-LD;
- `WebMcpProvider`;
- `MicrosoftClarity`;
- the existing `#contenu` boundary.

The root files own only the required document elements, static language, global CSS import, metadata/viewport exports, and the shared shell call. This avoids duplication while satisfying Next.js multiple-root-layout constraints.

Metadata helpers must preserve `metadataBase`, title templates, descriptions, application name, creator, publisher, robots directives, Open Graph, Twitter cards, and locale. Page-level canonical, alternates, hreflang, and structured data remain authoritative and must survive the move byte-for-byte in meaning.

## Sauge Noire theme boundary

The root document must not regain request dependence for Sauge Noire.

The existing `app/menu/[slug]/layout.tsx` behavior remains localized to the menu surface:

- it resolves whether the slug is `sauge-noire`;
- it emits the server-rendered descendant marker `data-vistaire-route-theme="sauge-noire"`;
- global CSS uses that marker through the existing direct and `:has(...)` selectors;
- `SaugeNoireRouteThemeBridge` synchronizes `<html>` and `<body>` attributes during client navigation;
- `SaugeNoireTransitionCoordinator` remains unchanged unless a failing regression test proves a required adaptation.

Proxy-injected locale and route-theme request headers are removed. No replacement global header, cookie, or post-hydration language correction is permitted.

Direct navigation, refresh, first paint, route transitions, and 390 px/430 px viewports are blocking checks. A visible dark/light flash requires a design correction before integration; it must not be hidden by weakening the test.

## Minimal fail-closed Proxy

The target matcher contains only:

```ts
[
  {
    source: "/",
    has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }]
  },
  "/owner/:path*",
  "/todos/:path*",
  "/api/restaurants/:path*",
  "/api/owner/:path*",
  "/api/analytics/summary"
]
```

The header condition is an invocation filter only. The existing q-value parser remains the source of truth after a request enters Proxy. Therefore an `Accept` value containing Markdown with `q=0`, or preferring HTML, may enter Proxy but must still continue to the HTML page.

Expected negotiation behavior:

| Request | Expected result |
|---|---|
| `GET /`, `Accept: text/markdown` | Markdown response |
| `GET /`, `Accept: text/markdown;q=0` | HTML response |
| `GET /`, `Accept: text/html, text/markdown;q=0.8` | HTML response |
| `GET /`, `Accept: */*` | HTML response without Proxy invocation |
| `GET /`, no `Accept` | HTML response without Proxy invocation |
| `HEAD /`, Markdown preferred | Markdown representation headers and no response body |
| non-safe method on `/` | No synthetic Markdown body; normal route handling continues |

Proxy continues to provide Clerk protection for Owner and Todos, Clerk context for the approved API families, and the existing Supabase session behavior for Todos. Client-provided `x-vistaire-owner-e2e-authorized` is removed before protected application code sees the request; only the existing verified development bypass path may recreate its trusted value.

Marketing, menu, admin, sign-in, GEO, discovery, public-media, and unrelated API requests must not match Proxy. Their security remains in their existing route/page boundaries. No authentication policy is broadened or replaced.

## HTML and Markdown response headers

`/` remains content-negotiated without allowing HTML and Markdown cache variants to collide.

- The Markdown response owns its `Content-Type`, token estimate, one `Link` value, and `Vary: Accept`.
- The HTML response obtains one discovery `Link` value and `Vary: Accept` through the static response configuration.
- Proxy must not add a second HTML `Link` value.
- The final response may include other framework-required `Vary` tokens, but `Accept` must be present exactly as a token.
- Header assertions must parse comma-separated tokens rather than depend on ordering.
- HTML and Markdown body/content-type checks must accompany header checks.

The existing live omission of `Accept` on HTML is a P0 defect, not an observation to waive. Local production behavior and Vercel Preview must both prove the final result.

## Marketing rendering contract

P0-A removes only request-time dependencies that are unnecessary for the named marketing pages. It does not add a blanket `dynamic = "force-static"` declaration.

The landing may continue using its current cache implementation and TTL during P0-A. Cache TTL, menu data caching, tags, invalidation, deduplication, and signed-URL handling belong exclusively to P0-B.

No P0-A commit may change the existing `revalidate` values in `lib/landing/menuExperiences.ts` or introduce public-menu durable caching. No cache implementation from PR #209 may be cherry-picked or reconstructed during this phase.

Static generation must never import private admin/owner loaders, sessions, preview-only request state, or signed asset capabilities. `/apercu-restaurateur` and `/en/restaurant-preview` qualify only if their existing synthetic fixture and public components remain request-independent and their static import graph stays outside private boundaries.

The build route table and `.next/prerender-manifest.json` provide acceptance evidence. Named routes that become ISR must expose their revalidation behavior in the manifest; routes intentionally left dynamic must remain `ƒ`.

## Hermetic build and artifact-safety contract

Before a named route is accepted as static or ISR, its build-time dependency graph must identify every read of Supabase, an HTTP API, another external service, environment variables, menu data, and dynamic asset metadata.

When a public external source is unavailable during build, the route may use only an existing editorial or deterministic fallback already owned by Vistaire. It must not invent records, silently swallow an unexplained failure, add `force-dynamic` as an escape hatch, or require network access for the repository's hermetic CI build. The fallback branch and its observable output require a focused contract test.

The production build must be exercised with the repository's hermetic environment controls when available. If the environment cannot technically block every outbound connection, the report must identify that limitation and separately prove through dependency injection, fixtures, or controlled failure that the named route can prerender without the external source.

After each production build, automated and manual scans inspect generated HTML, RSC payloads, `.next/prerender-manifest.json`, relevant server/app manifests, and other emitted text artifacts for:

- Supabase signed-object paths;
- query parameters or fields named `token`, `signature`, or `expires` when they carry capability material;
- known secret and cookie values supplied by the hermetic test environment;
- Owner/Admin payload markers;
- private capability URLs;
- sensitive identifiers not already part of an approved public route contract.

The scan uses synthetic sentinel values, never real secrets. A match is a blocking failure until classified and removed. Static HTML may contain stable public asset URLs and public restaurant/menu identifiers already required by the existing user-facing experience; it may not contain expiring access capabilities or private data.

For every named static/ISR route, the intermediate report lists its external build reads, fallback behavior, and artifact-scan result. A route that cannot meet this contract stays dynamic temporarily, is documented with its exact dependency, and requires user approval before P0-A can be called conformant.

## Hero invariants

The landing visual implementation, wording, layout, and asset inventory are unchanged in P0-A. Route movement may change only its filesystem parent.

Blocking browser assertions cover:

- the video remains the primary hero experience;
- desktop loads the desktop source;
- 390 px and 430 px mobile viewports load the mobile source and never request the desktop video;
- the poster is only a loading/error fallback;
- `data-video-failed="false"` in the normal path;
- `data-video-deferred="false"` in the normal path;
- scroll changes the video state as before;
- no initial GLB or USDZ request;
- no unexpected console, hydration, 404, or 500 error;
- no horizontal overflow.

Existing public Chromium and WebKit suites are reused and extended only where they do not already observe these outcomes.

## Vercel preview policy

After the core P0-A rendering and Proxy changes pass their focused tests and production build, the repository may add a new `vercel.json` because no existing `vercel.json` or `vercel.ts` is present on the certified base:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "dependabot/**": false,
      "renovate/**": false
    }
  }
}
```

The file must parse as JSON and pass a focused contract test proving that `main`, the active performance branch, and unspecified human branches are not disabled. No remote setting changes are authorized. Effectiveness is verified prospectively by checking that the next matching bot branch does not create a deployment; it cannot be claimed from local validation alone.

## Cloudflare boundary

P0-A may document a strict allowlist Cache Rule but must not apply it. The first rule excludes `/`, all dynamic surfaces, menus, media/model/photo routes, requests with Authorization or session cookies, and Markdown responses. It targets only build-proven static marketing paths on `vistaire.ca` and `www.vistaire.ca`, GET/HEAD, HTML-compatible `Accept`, Edge TTL two hours, and Browser TTL respecting existing headers.

The final expression is proposed only after a READY Vercel Preview proves route output and cache headers. User approval is required before any Cloudflare change.

## TDD and validation sequence

Production changes follow red-green-refactor. Each new behavioral contract must first fail for the intended reason against the certified baseline.

Focused contracts must cover:

- route-group file mapping and absence of a top-level root layout;
- literal initial `fr-CA` and `en-CA` document languages;
- shared shell behavior and localized global JSON-LD/skip link;
- SEO canonical, alternates, hreflang, Open Graph, Twitter, and JSON-LD for representative and named routes;
- Proxy matcher inclusion/exclusion and all approved Accept cases;
- single `Link` and tokenized `Vary: Accept` behavior;
- Owner auth matching, bypass-header sanitization, and Todos session routing;
- public-preview static import boundary;
- hero source selection and no eager 3D assets;
- FR-to-EN and EN-to-FR full navigation;
- Sauge direct load, refresh, route transition, first paint, and responsive behavior;
- Vercel Git deployment policy.

Repository checks for P0-A are:

- deterministic targeted Node tests for touched logic and contracts;
- `npm run assets:check`;
- `npm run lfs:check`;
- `npm run lint`;
- `npm run typecheck` when present;
- `npm run build`;
- relevant public, SEO, landing, menu, auth, Sauge, Chromium, and WebKit suites;
- the repository-supported hermetic build path or the closest controlled external-failure equivalent, without increasing timeouts, adding retries, or adding skips;
- emitted-artifact scans using synthetic secret, cookie, token, signature, and expiry sentinels;
- `git diff --check`;
- final `git status --short` and generated-artifact cleanup.

Browser QA covers `/`, `/en`, `/a-propos`, `/en/about`, one guide per locale, `/contact`, a pricing page, `/menu/maison-elyse`, a dish page, `/admin`, `/owner`, and `/q/invalid` at desktop and required mobile widths. It inspects console, hydration, failed requests, cache and negotiation headers, language, metadata, JSON-LD, video sources, 3D requests, redirects, and horizontal overflow.

Vercel validation uses a single Preview and only a few controlled requests. No load test, recursive scanner, or repeated request loop is allowed.

## P0-A integration gate and report

P0-B cannot begin until the P0-A branch state has passed implementation review and the user has received an intermediate report containing:

- `app/` tree before and after;
- every moved file and any path-coupled test update;
- preserved public URLs;
- route table before and after with `○`, ISR, and `ƒ` classifications;
- reason for every dynamic exception;
- Proxy matcher and invocation surface before and after;
- initial FR and EN document language evidence;
- metadata, canonical, alternates, hreflang, JSON-LD, Open Graph, and Twitter evidence;
- HTML/Markdown bodies, content types, `Vary`, and `Link` evidence;
- Chromium and WebKit evidence;
- hero and Sauge evidence at 390 px and 430 px;
- review findings classified P0/P1 and their disposition;
- tests and commands with exact results;
- every named route's build-time external reads and deterministic fallback;
- hermetic-build evidence and emitted-artifact scan results;
- confirmation that landing/menu TTLs, tags, invalidation, deduplication, and durable-cache behavior did not change;
- exact before/after dynamic-route counts, marketing static/ISR counts, and expected Proxy invocation surface;
- Preview status and controlled runtime logs if a Preview is available;
- remaining risks and non-verifiable claims.

The user must explicitly authorize starting P0-B after this report.

## P0-B and other out-of-scope work

P0-A does not change:

- landing or public-menu TTLs;
- public-menu durable cache architecture;
- cache tags, invalidation, in-flight deduplication, or signed-URL policy;
- Supabase schema, migrations, media pipelines, or PR #209 capacity work;
- hero media, models, frames, LFS rules, or public asset inventory;
- admin, owner, menu, dish, demo, or preview product behavior;
- Cloudflare settings;
- Vercel dashboard settings or production deployment;
- GEO catch-all static generation;
- pricing content, wording, layout, or broad visual design.

P0-B will receive its own implementation plan after P0-A proof and explicit user authorization. It will retain `unstable_cache`, target 900 seconds only with proven post-commit invalidation, scope tags by tenant/menu/locale, keep ephemeral signed material out of durable caches, and test cross-tenant isolation.

## Evidence and confidence policy

Claims in the intermediate report use `VERIFIED CODE`, `VERIFIED COMMAND`, `VERIFIED LIVE`, `VERIFIED DOCS`, `INFERRED`, or `NON-VÉRIFIABLE`.

No report may claim a completed Fluid Active CPU reduction solely because tests or a build pass. Static route output, narrowed Proxy matching, controlled Preview logs, and lack of marketing function invocation are required pre-production evidence. The production CPU slope over 24 and 72 hours remains non-verifiable until a production deployment is separately authorized and observed.

## Self-review

This specification contains no placeholder. It keeps P0-A independent from cache P0-B, explicitly preserves every current TTL and cache policy, lists every named marketing target and deliberate dynamic exception, defines an exact route movement map, preserves literal server-rendered language, localizes Sauge without request headers, keeps the q-value parser authoritative, makes the HTML `Vary` defect blocking, requires hermetic prerendering and synthetic-sentinel artifact scans, excludes `/` from the first Cloudflare rule, and prohibits production, migrations, remote settings, paid services, asset changes, and merges to `main`.
