# Cloudflare emergency marketing cache rule

## Status and authority

**PROPOSAL ONLY — NOT APPLIED.**

This runbook documents a possible emergency cache rule. It does not authorize a
Cloudflare deployment, a Vercel dashboard change, or any other remote mutation.
Activation requires a separately approved change after the final accepted P0-A
build, a READY Vercel Preview, and the pre-activation checks below.

No Cloudflare plugin, API, dashboard control, DNS change, purge, or live cache
test was used to create this document.

## Build-proven route boundary

Task 4 proved all 26 named P0-A routes as prerendered: 20 static and 6 ISR at
60 seconds. This rule deliberately removes the negotiated root path, /, and the
two restaurant-preview paths, /apercu-restaurateur and
/en/restaurant-preview. The resulting allowlist contains exactly these 23
build-proven paths:

- /a-propos
- /contact
- /prendre-rendez-vous
- /menu-digital-restaurant
- /menu-pdf-vs-menu-digital
- /menu-qr-code-restaurant
- /menu-3d-ar-restaurant
- /tarifs-menu-digital-restaurant
- /guides/anatomie-menu-digital-premium
- /guides/menu-qr-mobile-sans-application
- /guides/3d-restaurant-utile-vs-gadget
- /en
- /en/about
- /en/contact
- /en/book-a-call
- /en/digital-restaurant-menu
- /en/pdf-vs-digital-menu
- /en/qr-code-restaurant-menu
- /en/3d-ar-restaurant-menu
- /en/pricing-digital-restaurant-menu
- /en/guides/premium-digital-menu-anatomy
- /en/guides/mobile-qr-menu-without-app
- /en/guides/restaurant-3d-useful-vs-gimmick

At the activation candidate HEAD, intersect this list again with the exact keys
in .next/prerender-manifest.json. Remove any path that is absent or dynamic.
Never add a prefix, wildcard, catch-all, discovery route, or path that merely
appears static.

## Exact proposed expression

In Cloudflare, this is a Cache Rule custom filter expression. Keep it exact:

~~~text
(
  ssl
  and http.host in {"vistaire.ca" "www.vistaire.ca"}
  and http.request.method in {"GET" "HEAD"}
  and http.request.uri.query eq ""
  and not http.request.headers.truncated
  and not has_key(http.request.headers, "authorization")
  and not has_key(http.request.headers, "cookie")
  and not has_key(http.request.headers, "range")
  and not has_key(http.request.headers, "rsc")
  and not has_key(http.request.headers, "next-router-state-tree")
  and not has_key(http.request.headers, "next-router-prefetch")
  and not has_key(http.request.headers, "next-router-segment-prefetch")
  and not has_key(http.request.headers, "next-url")
  and not has_key(http.request.headers, "x-middleware-prefetch")
  and (
    any(lower(http.request.headers["accept"][*])[*] contains "text/html")
    or any(lower(http.request.headers["accept"][*])[*] contains "application/xhtml+xml")
  )
  and not any(lower(http.request.headers["accept"][*])[*] contains "text/markdown")
  and http.request.uri.path in {
    "/a-propos"
    "/contact"
    "/prendre-rendez-vous"
    "/menu-digital-restaurant"
    "/menu-pdf-vs-menu-digital"
    "/menu-qr-code-restaurant"
    "/menu-3d-ar-restaurant"
    "/tarifs-menu-digital-restaurant"
    "/guides/anatomie-menu-digital-premium"
    "/guides/menu-qr-mobile-sans-application"
    "/guides/3d-restaurant-utile-vs-gadget"
    "/en"
    "/en/about"
    "/en/contact"
    "/en/book-a-call"
    "/en/digital-restaurant-menu"
    "/en/pdf-vs-digital-menu"
    "/en/qr-code-restaurant-menu"
    "/en/3d-ar-restaurant-menu"
    "/en/pricing-digital-restaurant-menu"
    "/en/guides/premium-digital-menu-anatomy"
    "/en/guides/mobile-qr-menu-without-app"
    "/en/guides/restaurant-3d-useful-vs-gimmick"
  }
)
~~~

The expression is fail-closed:

- Only HTTPS requests to the production hosts vistaire.ca and www.vistaire.ca
  can match. Vercel Preview hosts and every other host cannot match.
- Only GET or HEAD with an empty query string can match.
- A truncated header map cannot match.
- Any Authorization, Cookie, or Range header prevents a match.
- Accept must explicitly contain text/html or application/xhtml+xml, and must
  not contain text/markdown. Accept: */* alone does not match.
- RSC, Next-Router-State-Tree, Next-Router-Prefetch,
  Next-Router-Segment-Prefetch, Next-Url, and X-Middleware-Prefetch prevent a
  match, so an RSC/prefetch representation cannot occupy the HTML cache key.

The rule cannot match /, /apercu-restaurateur, /en/restaurant-preview,
/admin/**, /owner/**, /api/**, /q/**, /menu/**, /sign-in/**, /todos/**,
/legacy/**, /demo, /en/vistaire-menu, either GEO catch-all, /_next/**,
/images/**, public or private photo/model routes, GLB/USDZ files, media, or
other assets. Exact path membership provides this boundary; do not replace it
with negative matches or a marketing-looking prefix.

Rejecting every Cookie header is intentionally stricter than rejecting named
session cookies. It fails closed without relying on an incomplete cookie-name
inventory, but visitors carrying only analytics or preference cookies will
bypass this rule too. That safety tradeoff can materially reduce the cache hit
rate. Do not narrow it until the application has a reviewed, stable cookie
inventory and a separately approved rule revision.

## Exact cache action

Configure the matching rule with:

1. **Cache eligibility:** Eligible for cache.
2. **Edge TTL:** Ignore the origin cache-control header and use 2 hours
   (7200 seconds).
3. **Status Code TTL:** cache successful HTML only:
   - 200: 7200 seconds;
   - 100–199: no-store;
   - 201–303: no-store;
   - 304: do not add an override, so it inherits the cached 200 TTL;
   - 305–999: no-store.
4. **Browser TTL:** Respect origin / Respect Existing Headers.
5. **Cache key:** Keep Cloudflare's default cache key.

Do not cache redirects or errors. Before activation, each allowlisted response
must be public and deterministic, return 200 with Content-Type: text/html, and
contain no Set-Cookie, private data, signed capability URL, or user-specific
content. The Edge TTL override can otherwise make an origin private/no-store
response cacheable, so any failed precondition blocks activation.

The Cloudflare cache is an outer cache. Its 7200-second TTL can outlive the
underlying 60-second Vercel ISR window on five eligible ISR paths. This rule
does not change ISR semantics; it accepts that the edge may serve an older
version until purge or expiry. Purge after every marketing deployment and
rollback, and immediately after any urgent content correction.

Inspect existing Cache Rules before activation. When multiple matching rules
set the same property, Cloudflare uses the last matching assignment. This rule
must be the last rule that sets cache eligibility or Edge TTL for these exact
public requests, without weakening any private/security rule. Confirm the
effective result with Cloudflare Trace.

## Pre-activation gate

Do not deploy the rule until all of the following are recorded at the same
accepted HEAD:

1. The build and route scanner pass, and every one of the 23 paths is an exact
   prerender-manifest route key.
2. A READY Vercel Preview returns 200 HTML for every candidate with the
   expected language, canonical, and hreflang, no 404/500, no Set-Cookie, no
   signed URL, and no private or user-specific content.
3. Existing Cloudflare rule order is inspected read-only.
4. Cloudflare accepts the expression in its editor. Save it as a draft only;
   do not deploy it during this gate.
5. A separately authorized reviewer approves activation and its rollback
   owner.

## Controlled Cloudflare Trace matrix

Use Cloudflare Trace before activation, then repeat after any separately
authorized activation. Do not infer rule behavior from CF-Cache-Status alone
when another cache rule may also match.

| Controlled request | Candidate rule | Expected result |
| --- | --- | --- |
| HTTPS production host, allowlisted path, GET, empty query, no Cookie/Authorization/Range/Next headers, Accept: text/html | Match | Eligible, Edge TTL 7200, browser respects origin |
| Same safe request using HEAD | Match | Same cache action; no response body |
| Root / or either restaurant-preview path | No match | Origin/other rules only |
| Dynamic, private, menu, media, photo/model, or asset path | No match | Origin/other rules only |
| Any *.vercel.app or other non-production host | No match | Preview never enters this rule |
| POST or another non-GET/HEAD method | No match | Origin only |
| Any non-empty query string | No match | Origin only |
| Authorization, Cookie, or Range present | No match | Expected BYPASS or DYNAMIC; confirm with Trace |
| Accept: text/markdown or Accept: */* alone | No match | No HTML cache eligibility from this rule |
| RSC or any listed Next.js prefetch header present | No match | RSC/prefetch representation cannot enter the HTML cache key |
| Cloudflare reports request headers truncated | No match | Fail closed |

## Controlled MISS → HIT / BYPASS proof

Only after explicit activation approval:

1. Purge the affected prefixes.
2. From the same controlled client and Cloudflare point of presence, issue
   exactly two cookie-free GET requests to one allowlisted path with
   Accept: text/html.
3. The first response after purge must be CF-Cache-Status: MISS, or EXPIRED
   when tiering revalidates. The second must be HIT and include Age. On both,
   verify 200 HTML, the complete body, correct canonical/language, and absence
   of Set-Cookie or private data.
4. Issue one request per negative family from the Trace matrix. Cookie,
   Authorization, RSC/prefetch, Markdown, preview-host, dynamic/private/menu,
   media, and asset cases must not match this rule. BYPASS or DYNAMIC is
   acceptable for those origin-controlled cases; a HIT requires immediate
   Trace investigation and rollback if another rule produced an unsafe cache.
5. Stop after this controlled matrix. Do not crawl, benchmark, or load-test.

## Mandatory purge procedure

Immediately after every marketing deployment and every rollback, use
**Custom Purge → Prefix** for both production hosts and all affected paths.
Do not rely on single-file purge: an internal purge request may not satisfy
this GET/header-dependent rule.

The 23 exact routes fit within the 30-prefix limit by grouping English paths:

- purge vistaire.ca/en and www.vistaire.ca/en;
- purge each of the 11 French allowlisted hostname/path prefixes on both
  production hosts.

That is 24 prefixes. Record the deploy/rollback identifier, purge time,
operator, and result before performing the controlled MISS → HIT check.

## Rollback

Immediately roll back on wrong, private, user-specific, stale-critical,
mislocalized, RSC, Markdown, redirect, error, or representation-collision
content:

1. Disable the candidate Cache Rule; do not merely reorder it.
2. Purge the same affected prefixes on both production hosts.
3. Use Cloudflare Trace to prove the disabled rule no longer matches.
4. Make one controlled origin-path check for the affected route and verify the
   correct HTML/body/canonical, no Set-Cookie/private data, and no stale HIT
   from this rule. Investigate any remaining HIT as another-rule behavior.
5. Record the incident, rule version, purge result, and evidence. Keep the rule
   disabled until a separately reviewed correction is approved.

## Vercel emergency preview-build control

**NOT ENABLED.**

The repository policy continues to disable automatic deployments only for
dependabot/** and renovate/**. The existing root response-header transform in
vercel.json is unrelated and must remain intact.

If preview build volume becomes an incident, a separately authorized operator
may use this manual, temporary dashboard option:

**Project → Settings → Build and Deployment → Ignored Build Step → Only build production**

Record the owner, reason, start time, and prior setting; verify that production
builds remain enabled; and restore the prior setting when the incident ends.
This is not a normal repository setting, was not enabled by P0-A, and cannot be
claimed effective from local tests.

## References

- Cloudflare rules language:
  https://developers.cloudflare.com/ruleset-engine/rules-language/operators/
- Cloudflare Cache Rules settings:
  https://developers.cloudflare.com/cache/how-to/cache-rules/settings/
- Cache TTL by status code:
  https://developers.cloudflare.com/cache/how-to/configure-cache-status-code/
- Cloudflare Trace and cache-rule troubleshooting:
  https://developers.cloudflare.com/cache/how-to/cache-rules/
- Purge by prefix:
  https://developers.cloudflare.com/cache/how-to/purge-cache/purge_by_prefix/
