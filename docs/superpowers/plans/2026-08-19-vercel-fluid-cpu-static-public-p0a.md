# Vistaire Vercel Fluid CPU P0-A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make the explicitly approved public marketing routes static or ISR, remove public request dependence from the document root, and reduce Proxy execution without changing cache TTLs or weakening Vistaire behavior.

**Architecture:** Replace the request-scoped top-level document with two URL-invisible FR/EN root groups and one locale-aware shared shell. Keep runtime surfaces explicitly dynamic, make one owner for each homepage representation header, and prove static rendering with build manifests plus emitted-artifact safety checks.

**Tech Stack:** Next.js 16.2.11 App Router, React 19.2.6, TypeScript 5.9.3, npm, Node test runner, Playwright Chromium/WebKit, Vercel configuration.

**Spec:** docs/superpowers/specs/2026-08-19-vercel-fluid-cpu-static-public-p0a-design.md

## Global Constraints

- Work only in the isolated worktree for branch perf/vercel-fluid-cpu-static-public, based on fddf75c41ebc96c0f71295d5cc074277c0c2fba2.
- Do not deploy production, merge main, apply a migration, modify Supabase remotely, change a Vercel/Cloudflare dashboard setting, buy a service, or run a load test.
- P0-A does not change landing/menu TTLs, cache keys, tags, invalidation, deduplication, persistence, or deep menu caching. All four existing revalidate values in lib/landing/menuExperiences.ts remain 60.
- The homepage target is “static or ISR with current cache semantics preserved.”
- Keep /demo, /en/vistaire-menu, both GEO catch-alls, /menu/**, /admin/**, /owner/**, /api/**, /q/**, /sign-in/**, /todos/**, and /legacy/** dynamic.
- Preserve public URLs, initial html language, metadata, canonical, alternates, hreflang, JSON-LD, Open Graph, Twitter, Clarity, WebMCP, Sauge Noire, and the hero without new wording or visual changes.
- A static route must have deterministic fallback behavior and may not serialize signed URLs, tokens, secrets, cookies, Owner/Admin data, or private capabilities into public HTML/RSC/manifests.
- Use tests first for every behavioral change; record the RED command/failure and GREEN command/result.
- Use npm. Do not add a dependency or large/raw/generated media asset.
- Keep Cloudflare as documentation only. Keep Vercel production untouched.

## File Ownership Map

| Unit | Files it owns |
| --- | --- |
| Static documents | app/(fr)/layout.tsx, app/(en)/layout.tsx, components/layout/VistaireDocumentShell.tsx, lib/rootDocument.ts |
| Route topology | moved app/(fr)/** and app/(en)/en/** trees, path-coupled source/tests, scripts/ci/detect-changes.mjs |
| Negotiation boundary | proxy.ts, utils/supabase/middleware.ts, lib/agent-discovery/homeResponseHeaders.ts, next.config.ts |
| Public landing safety | lib/landing/landingDishIdentity.ts, lib/landing/landingMenuUiPreview.ts, focused landing tests |
| Build proof | scripts/ci/check-static-public-routes.mjs, scripts/ci/check-public-prerender-artifacts.mjs, tests for both scripts, app CI invocation |
| Browser proof | e2e/static-public-rendering.spec.ts plus focused edits to existing public/landing/Sauge suites |
| Free controls | vercel.json and docs/operations/cloudflare-marketing-cache-rule.md |
| Evidence | docs/reports/2026-08-19-vercel-fluid-cpu-p0a.md and archived command output outside Git |

Each task ends in its own checkpoint commit. If a checkpoint must be backed out, use a non-destructive git revert of that task’s exact commit after recording the reason; never reset the worktree or discard another task’s changes. Task 1 is the root-layout gate, Task 2 consumes its static-language boundary, Task 3 consumes both boundaries, and Tasks 4–7 cannot start until their predecessors have a clean task review.

---

### Task 1: Static FR/EN document roots and controlled route move

**Files:**
- Create: app/(fr)/layout.tsx
- Create: app/(en)/layout.tsx
- Create: components/layout/VistaireDocumentShell.tsx
- Create: lib/rootDocument.ts
- Create: tests/static-public-root-layout.test.mjs
- Delete after moves: app/layout.tsx
- Move: app/page.tsx to app/(fr)/page.tsx
- Move: app/(geo) to app/(fr)/(geo)
- Move: app/(seo) to app/(fr)/(seo)
- Move: app/a-propos, app/admin, app/apercu-restaurateur, app/contact, app/demo, app/guides, app/legacy, app/menu, app/owner, app/prendre-rendez-vous, app/q, app/sign-in, and app/todos beneath app/(fr)
- Move: app/en to app/(en)/en
- Modify: components/landing/comparison/TrouvableComparisonPreview.tsx
- Modify: scripts/ci/detect-changes.mjs
- Modify: tests/ci-change-detection.test.mjs and every test whose literal app path moved
- Modify: app/(fr)/(geo)/[slug]/page.tsx, app/(en)/en/(geo)/[slug]/page.tsx, app/(fr)/demo/page.tsx, app/(en)/en/vistaire-menu/page.tsx, app/(fr)/legacy/[...slug]/page.tsx, app/(fr)/q/invalid/page.tsx, app/(fr)/sign-in/[[...sign-in]]/page.tsx

**Interfaces:**
- Produces: buildRootMetadata(locale: Locale): Metadata and ROOT_VIEWPORT: Viewport from lib/rootDocument.ts.
- Produces: VistaireDocumentShell(props: { locale: Locale; children: React.ReactNode }): JSX.Element.
- Produces: literal html lang values fr-CA and en-CA without request APIs.
- Consumes: Locale and LOCALE_LANGUAGE_TAG from lib/i18n.ts and existing JSON-LD builders from lib/seo.ts.

- [ ] **Step 1: Add the failing route/document contract**

Create tests/static-public-root-layout.test.mjs with a REQUIRED_NAMED_FILES table for all 26 approved page files under their destination groups. Read both new layout sources, the shell, and the old top-level path. Assert:

~~~js
test("FR and EN roots own literal request-independent documents", async () => {
  assert.equal(existsSync("app/layout.tsx"), false);
  assert.equal(existsSync("app/(fr)/page.tsx"), true);
  assert.equal(existsSync("app/(en)/en/page.tsx"), true);
  const fr = await readFile("app/(fr)/layout.tsx", "utf8");
  const en = await readFile("app/(en)/layout.tsx", "utf8");
  for (const source of [fr, en]) {
    assert.match(source, /<html/);
    assert.match(source, /<body/);
    assert.doesNotMatch(source, /\b(headers|cookies|connection|draftMode)\s*\(/);
    assert.doesNotMatch(source, /next\/headers|VISTAIRE_LOCALE_HEADER|VISTAIRE_ROUTE_THEME_HEADER/);
  }
  assert.match(fr, /lang="fr-CA"/);
  assert.match(en, /lang="en-CA"/);
});
~~~

Add assertions that each dynamic exception exports dynamic = "force-dynamic", neither catch-all exports generateStaticParams, the shared shell owns one skip link/JsonLd/WebMcpProvider/MicrosoftClarity/contenu boundary, and app/robots.txt/route.ts remains the sole robots producer.

- [ ] **Step 2: Run the contract and record the expected RED**

Run:

~~~powershell
node --test tests/static-public-root-layout.test.mjs
~~~

Expected: FAIL because app/(fr)/layout.tsx and app/(en)/layout.tsx do not exist and app/layout.tsx still exists.

- [ ] **Step 3: Add locale-aware root metadata and the shared shell**

In lib/rootDocument.ts, export ROOT_VIEWPORT with the existing viewport values and buildRootMetadata(locale). Preserve the French defaults exactly. For en, use:

~~~ts
const ENGLISH_ROOT_DESCRIPTION =
  "Vistaire creates a premium mobile-first digital menu for high-end restaurants: QR code, visual dish pages, allergens and selective 3D/AR.";
~~~

Use title default Vistaire | Premium QR digital menu for high-end restaurants, the existing SITE_NAME template, locale en_CA, the same robots/application/creator/publisher fields, and summary Twitter card.

In VistaireDocumentShell, select “Aller au contenu” or “Skip to content” by locale and render the existing three global JSON-LD builders, WebMcpProvider, MicrosoftClarity, and div id="contenu" exactly once.

- [ ] **Step 4: Perform the controlled moves**

Move the exact trees in Files, preserving their internal shape and URL segments. Leave app/api/**, app/.well-known/**, app/auth.md/route.ts, app/openapi.json/route.ts, app/robots.txt/route.ts, app/sitemap.ts, app/icon.svg, and app/globals.css at root. Do not create app/robots.ts.

Create synchronous root layouts that import ../globals.css, export locale metadata and ROOT_VIEWPORT, render literal html/body, retain data-scroll-behavior="smooth", and call the shared shell.

Change the one production import to:

~~~ts
import { trouvableTypography } from "@/app/(fr)/menu/[slug]/trouvableTypography";
~~~

- [ ] **Step 5: Keep explicitly dynamic surfaces dynamic**

Remove generateStaticParams and unused SEO_GEO_PAGES imports from both catch-alls. Add:

~~~ts
export const dynamic = "force-dynamic";
~~~

to both catch-all pages, /demo, /en/vistaire-menu, /legacy/[...slug], /q/invalid, and /sign-in/[[...sign-in]]. Do not add force-static anywhere.

- [ ] **Step 6: Update path-coupled tests and CI classification**

Replace literal old paths with their grouped paths in the exact inventory from p0a-route-move-audit.md. Update CI classification so app/(fr)/(seo|geo), app/(fr)/menu, app/(fr)/admin, app/(fr)/owner, app/(fr)/demo, app/(fr)/apercu-restaurateur, app/(en)/en/**, and the new shell/root helpers retain their prior specialized test families.

Add table cases to tests/ci-change-detection.test.mjs proving grouped SEO, landing, menu, admin, owner, public-preview, FR root, and EN root paths select run_static and run_build plus their existing relevant browser family.

- [ ] **Step 7: Verify GREEN and the no-TTL invariant**

Run:

~~~powershell
node --test tests/static-public-root-layout.test.mjs tests/ci-change-detection.test.mjs tests/microsoft-clarity-contract.test.mjs tests/sauge-noire-viewport-contract.test.mjs
rg -n "revalidate:\s*60" lib/landing/menuExperiences.ts
npm run typecheck
~~~

Expected: all tests PASS, typecheck PASS, and exactly four revalidate: 60 matches remain.

- [ ] **Step 8: Commit the checkpoint**

~~~powershell
git add app components lib scripts tests
git commit -m "refactor: split static public root layouts"
~~~

### Task 2: Minimal fail-closed Proxy and single-owner homepage headers

**Files:**
- Create: lib/agent-discovery/homeResponseHeaders.ts
- Modify: lib/agent-discovery/index.ts
- Modify: proxy.ts
- Modify: utils/supabase/middleware.ts
- Modify: next.config.ts
- Modify: tests/proxy-matcher.test.mjs
- Modify: tests/agent-discovery.test.mjs
- Modify: tests/owner-auth-policy.test.mjs when its boundary needs the new signature

**Interfaces:**
- Produces: HOME_AGENT_LINK_HEADER: string and buildHomeAgentLinkHeader(): string from a request-independent module.
- Produces: updateSession(request: NextRequest, requestHeaders: Headers): Promise<NextResponse>.
- Consumes: shouldServeMarkdownForAcceptHeader as the only representation-selection parser.

- [ ] **Step 1: Replace old matcher expectations with failing behavior tests**

In tests/proxy-matcher.test.mjs, use unstable_doesMiddlewareMatch with request headers. Assert the matcher includes only root Markdown, /owner/**, /todos/**, /api/restaurants/**, /api/owner/**, and exact /api/analytics/summary. Assert named marketing, menu, admin, sign-in, q, discovery, public media, unrelated APIs, /trpc, ordinary root HTML, */*, and no Accept do not match.

Use a case-insensitive header matcher and include Text/Markdown as a matching case. Directly call Proxy for:

~~~js
[
  ["text/markdown", "GET", "markdown"],
  ["text/markdown;q=0", "GET", "next"],
  ["text/html, text/markdown;q=0.8", "GET", "next"],
  ["text/markdown;q=0.9, text/html;q=0.1", "GET", "markdown"],
  ["text/markdown", "HEAD", "markdown-head"],
  ["text/markdown", "POST", "next"]
]
~~~

Assert a Markdown HEAD body is empty, POST is not synthesized as Markdown, trusted bypass input is removed from normal Owner/Todos/API request overrides, and a valid local development bypass can recreate it only for approved Owner routes.

- [ ] **Step 2: Run Proxy/header tests and record RED**

Run:

~~~powershell
node --test tests/proxy-matcher.test.mjs tests/agent-discovery.test.mjs tests/owner-auth-policy.test.mjs
~~~

Expected: FAIL because the old matcher includes marketing HTML, Proxy owns duplicate HTML headers, HEAD has a body, POST can synthesize Markdown, and Todos forwards unsanitized headers.

- [ ] **Step 3: Extract the shared request-independent Link value**

Move only the homepage Link literal/builder into homeResponseHeaders.ts. Re-export it from index.ts. Import the same builder into next.config.ts so the / static headers rule emits exactly one matching Link and Vary: Accept.

- [ ] **Step 4: Narrow Proxy and preserve auth/session behavior**

Use this case-insensitive root gate:

~~~ts
{
  source: "/",
  has: [{
    type: "header",
    key: "accept",
    value: ".*[tT][eE][xX][tT]/[mM][aA][rR][kK][dD][oO][wW][nN].*"
  }]
}
~~~

Add the five protected matcher strings from the approved design. Replace requestHeadersWithLocale with sanitizedRequestHeaders that clones request.headers and deletes DEV_OWNER_BYPASS_TRUSTED_HEADER only. Remove locale/theme imports and all ordinary homepage header mutation.

Synthesize Markdown only for GET/HEAD after the q-value parser chooses it. Return null body for HEAD. For other methods or parser rejection, return a normal NextResponse.next using sanitized headers.

Pass sanitized headers into updateSession. When Supabase refreshes cookies, rebuild NextResponse.next with request: { headers: requestHeaders } and copy refreshed response cookies exactly as before.

- [ ] **Step 5: Verify GREEN and header ownership**

Run:

~~~powershell
node --test tests/proxy-matcher.test.mjs tests/agent-discovery.test.mjs tests/owner-auth-policy.test.mjs
npm run typecheck
~~~

Expected: PASS with one Link value, Accept present once as a token in Vary, all q/method cases correct, and protected request headers sanitized.

- [ ] **Step 6: Commit the checkpoint**

~~~powershell
git add proxy.ts next.config.ts utils/supabase/middleware.ts lib/agent-discovery tests
git commit -m "perf: limit proxy to negotiated and protected routes"
~~~

### Task 3: Hermetic public landing projection and artifact scanners

**Files:**
- Modify: lib/landing/landingDishIdentity.ts
- Modify: lib/landing/landingMenuUiPreview.ts
- Create: tests/landing-public-payload-safety.test.mjs
- Create: scripts/ci/check-public-prerender-artifacts.mjs
- Create: tests/public-prerender-artifact-safety.test.mjs
- Create: scripts/ci/check-static-public-import-boundary.mjs
- Create: tests/static-public-import-boundary.test.mjs
- Create: scripts/ci/check-static-public-routes.mjs
- Create: tests/static-public-route-manifest.test.mjs
- Modify: .github/workflows/app-ci.yml
- Modify: tests/ci-workflow-contract.test.mjs

**Interfaces:**
- Produces: landingPhotoForDish(dish): LandingDishPhoto | null with its existing name and a stricter stable-public-media contract.
- Produces: inspectStaticPublicImportBoundary(entries): finding[] and a CLI that rejects request/private imports outside the one documented landing loader graph.
- Produces: validateStaticPublicRoutes(manifest): { named: string[]; dynamic: string[] } and a CLI that exits nonzero on contract failure.
- Produces: scanPublicPrerenderArtifacts(root, sentinels): finding[] and a CLI that exits nonzero on any finding.

- [ ] **Step 1: Write failing media/payload safety tests**

Add literal cases for canonical matching photo URLs, benign v query, /images/**, and credential-free public HTTPS. Reject mismatched dish IDs, data/blob URLs, URL credentials, /storage/v1/object/sign/, and query keys token, signature, expires, x-amz-algorithm, x-amz-credential, x-amz-signature, x-amz-security-token.

Assert projectLandingMenuUiMenu maps every dish imageUrl and thumbnailUrl through the same stable-media boundary and never returns the signed input. Assert a signed live source with a dish id and hasPhoto becomes /api/public/menu-dishes/<encoded-id>/photo, not an empty visual.

- [ ] **Step 2: Write failing synthetic scanner tests**

Create temporary .next/server/app route artifacts. Verify safe canonical photo paths and public UUIDs pass. Verify each of these fails with file and marker evidence:

~~~text
/storage/v1/object/sign/
token=synthetic-capability
signature=synthetic-signature
expires=9999999999
X-Amz-Signature=
synthetic-service-role-secret
synthetic-owner-email@example.test
synthetic-session-cookie
x-vistaire-owner-e2e-authorized
~~~

Use synthetic values only. Do not scan .next server JavaScript bundles or framework preview keys.

- [ ] **Step 3: Write the failing static import-boundary test**

Build temporary module graphs and assert the scanner resolves relative imports, @/ aliases, extensionless .ts/.tsx/index modules, and literal dynamic imports. It must reject next/headers, next/cookies, Clerk server auth, utils/supabase/admin, utils/supabase/server, lib/admin/**, lib/owner/**, app/(fr)/admin/**, app/(fr)/owner/**, app/api/**, createSignedUrl, and non-public environment reads from named static entry graphs.

Run the scanner against both root layouts and all 26 named page entries. Permit the landing entrypoints to reach lib/landing/menuExperiences.ts only through VistairePreviewLanding; record that loader as the single reviewed external-data exception and rely on the public projection/artifact tests for its transitive data boundary. No other named route may reach it.

- [ ] **Step 4: Write the failing manifest classifier test**

Use a hand-authored prerender-manifest fixture. The exact 26 named routes must be keys in routes; all approved dynamic exceptions must be absent. Accept false or a positive number for initialRevalidateSeconds; reject a missing named route and reject a dynamic exception appearing as prerendered.

- [ ] **Step 5: Run all four tests and record RED**

Run:

~~~powershell
node --test tests/landing-public-payload-safety.test.mjs tests/public-prerender-artifact-safety.test.mjs tests/static-public-import-boundary.test.mjs tests/static-public-route-manifest.test.mjs
~~~

Expected: FAIL because arbitrary signed media currently passes and all three build-proof scripts are missing.

- [ ] **Step 6: Implement stable public-media projection**

Prefer a matching canonical public photo route. If a dish has a stable id and hasPhoto/photoStatus indicates a public photo but the available source is signed, emit /api/public/menu-dishes/<encoded-id>/photo. Permit /images/** and HTTPS URLs only when there is no username/password and no credential query key. Apply the sanitizer to featured previews, category previews, and every projected menu dish.

Do not change getLandingExperiences cache wrappers, cache keys, TTLs, tags, or error/fallback policy.

- [ ] **Step 7: Implement build contracts and CI execution**

The manifest CLI reads .next/prerender-manifest.json. The import-boundary CLI evaluates the real named entry list. The artifact CLI recursively scans only .html, .rsc, .body, and .meta files beneath .next/server/app plus the prerender manifest. It accepts sentinel values from VISTAIRE_PUBLIC_ARTIFACT_SENTINELS as a JSON array.

In app-ci build-app, keep the loopback Supabase fixture and add deterministic VISTAIRE_EXCHANGE_RATES_FIXTURE_JSON. Run the import-boundary CLI before npm run build. After the build and before uploading .next, run the manifest and artifact CLIs with fixture-only secret/owner/session sentinels.

Update the workflow contract to prove the local fixture, exchange-rate fixture, two scanners, and fail-before-upload ordering.

- [ ] **Step 8: Verify GREEN and unchanged TTLs**

Run:

~~~powershell
node --test tests/landing-public-payload-safety.test.mjs tests/public-prerender-artifact-safety.test.mjs tests/static-public-import-boundary.test.mjs tests/static-public-route-manifest.test.mjs tests/ci-workflow-contract.test.mjs
rg -n "revalidate:\s*60" lib/landing/menuExperiences.ts
npm run typecheck
~~~

Expected: PASS and exactly four unchanged 60-second cache declarations.

- [ ] **Step 9: Commit the checkpoint**

~~~powershell
git add lib/landing scripts/ci tests .github/workflows/app-ci.yml
git commit -m "test: guard static public build artifacts"
~~~

### Task 4: Production build and static-route acceptance gate

**Files:**
- Modify only files proven by a failing build/manifest contract
- Create outside Git: route table, manifest summary, and artifact scan evidence

**Interfaces:**
- Consumes: the two CLIs from Task 3.
- Produces: a passing production build whose manifest contains all 26 named routes and excludes every approved dynamic exception.

- [ ] **Step 1: Run the deterministic build with repository fixture controls**

Start the existing Sauge Noire fixture using its documented CI command. Supply loopback NEXT_PUBLIC_SUPABASE_URL, fixture publishable/service values, canonical Maison fixture identity, fixed exchange rates, and synthetic scanner sentinels. Run npm run build once.

Expected first result: either PASS or a focused FAIL naming a route/import/static-generation defect. Do not add a retry, skip, timeout increase, force-static blanket, or force-dynamic escape hatch.

- [ ] **Step 2: Run build proof CLIs**

~~~powershell
node scripts/ci/check-static-public-routes.mjs
node scripts/ci/check-public-prerender-artifacts.mjs
~~~

Expected: both PASS. Archive the build route table and summarized prerender/app-path manifests outside Git.

- [ ] **Step 3: Fix only evidence-backed build defects with TDD**

For each defect, add a minimal focused failing test or extend the manifest contract, observe RED, make the smallest production correction, and rerun the focused test before rebuilding. Named routes may not remain dynamic without an exact dependency and a user-approved exception.

- [ ] **Step 4: Run static/SEO/source regression suites**

~~~powershell
npm run test:seo
npm run test:landing:contract
npm run test:landing:i18n
npm run test:restaurateur-preview:node
node --test tests/*menu*test.mjs tests/*auth*test.mjs
~~~

Expected: PASS. If shell glob expansion is unsuitable on Windows, enumerate the matching test files with rg --files and invoke node --test with explicit paths; do not omit a selected test silently.

- [ ] **Step 5: Commit any build-gate fixes**

If Task 4 changed repository files:

~~~powershell
git add -u
git commit -m "fix: satisfy static public build contracts"
~~~

If no files changed, record the passing SHA in the SDD ledger and do not create an empty commit.

### Task 5: Chromium/WebKit, hero, SEO, language, and Sauge QA

**Files:**
- Create: e2e/static-public-rendering.spec.ts
- Modify: e2e/public-navigation.spec.ts
- Modify: e2e/landing-redesign.spec.ts only where an approved invariant lacks coverage
- Modify: existing Sauge spec only where direct-load/refresh/390/430 proof is missing

**Interfaces:**
- Produces browser evidence for initial document language, FR↔EN full-root navigation, metadata/JSON-LD, hero media selection, no eager 3D, Sauge first paint, response headers, and no horizontal overflow.

- [ ] **Step 1: Add failing cross-root and static response browser contracts**

For representative and named routes, assert response status below 400, initial document.documentElement.lang, canonical and hreflang, at least one JSON-LD block, no unexpected console/page error, and no horizontal overflow.

Navigate / → /en and /en → / using visible locale links. Assert the target initial document lang, final canonical, no 404/redirect loop, and the correct active navigation state. Capture navigation entries and accept a full document navigation between root groups.

Use the Playwright request context to assert root HTML includes one discovery Link value and Vary contains Accept as a case-insensitive token. Assert Markdown GET/HEAD content type/body behavior separately.

- [ ] **Step 2: Add missing hero and Sauge assertions**

At desktop, assert currentSrc ends in upscaled-video-desktop-scrub.mp4. At 390 and 430, collect video requests and assert the mobile MP4 is requested while the desktop MP4 is absent. Assert data-video-failed="false", data-video-deferred="false", poster contract, scroll changes currentTime/state, and no initial .glb/.usdz request.

For /menu/sauge-noire, cover direct load and refresh at 390/430, the server descendant marker, light viewport metadata, no visible default-dark flash beyond the existing threshold, then a transition away and back. Do not claim real iPhone Quick Look or Android Scene Viewer validation.

- [ ] **Step 3: Run focused tests and record RED if coverage exposes a defect**

~~~powershell
node scripts/run-playwright-e2e.mjs e2e/static-public-rendering.spec.ts e2e/public-navigation.spec.ts e2e/landing-redesign.spec.ts --project=chromium --workers=1 --retries=0 --forbid-only
node scripts/run-playwright-e2e.mjs e2e/static-public-rendering.spec.ts e2e/public-navigation.spec.ts e2e/sauge-noire-static-page-handoff.spec.ts --project=webkit --workers=1 --retries=0 --forbid-only
~~~

Expected: PASS with zero retry/skip and pristine runtime error collection.

- [ ] **Step 4: Correct proven regressions through RED→GREEN**

For a real defect, retain the failing browser assertion, make the smallest code change within the owning task’s boundary, and rerun the one spec/project before the grouped command.

- [ ] **Step 5: Commit browser contracts and fixes**

~~~powershell
git add e2e app components lib tests
git commit -m "test: verify static public routes across browsers"
~~~

### Task 6: Free preview controls and documented Cloudflare emergency rule

**Files:**
- Create: vercel.json
- Create: tests/vercel-git-policy.test.mjs
- Create: docs/operations/cloudflare-marketing-cache-rule.md

**Interfaces:**
- Produces: Vercel deploymentEnabled false only for dependabot/** and renovate/**.
- Produces: a non-applied Cloudflare allowlist for build-proven routes, excluding root and every dynamic/private/media surface.

- [ ] **Step 1: Write the failing Vercel policy test**

Parse vercel.json as JSON. Assert the schema URL, exactly two disabled branch globs, and absence of main, perf/vercel-fluid-cpu-static-public, wildcard human branches, or a global disable entry.

- [ ] **Step 2: Run and record RED**

~~~powershell
node --test tests/vercel-git-policy.test.mjs
~~~

Expected: FAIL with ENOENT because vercel.json does not exist.

- [ ] **Step 3: Add the approved local Vercel configuration**

Create exactly:

~~~json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "dependabot/**": false,
      "renovate/**": false
    }
  }
}
~~~

- [ ] **Step 4: Document but do not apply the Cloudflare rule**

Document the exact allowlist after substituting only routes proven prerendered in Task 4. Exclude /, /admin/**, /owner/**, /api/**, /q/**, /menu/**, /sign-in/**, /todos/**, photo/model routes, Authorization, session cookies, Markdown Accept, non-GET/HEAD methods, and Vercel preview hosts. Set Edge TTL to 2 hours and Browser TTL to Respect Existing Headers. Include purge-after-marketing-deploy and controlled MISS→HIT/BYPASS verification steps. State clearly NOT APPLIED.

Also document the emergency Vercel dashboard procedure “Project → Settings → Build and Deployment → Ignored Build Step → Only build production” as a manual temporary option that was not enabled.

- [ ] **Step 5: Verify GREEN and commit**

~~~powershell
node --test tests/vercel-git-policy.test.mjs
~~~

Expected: PASS.

~~~powershell
git add vercel.json tests/vercel-git-policy.test.mjs docs/operations/cloudflare-marketing-cache-rule.md
git commit -m "chore: disable bot preview deployments"
~~~

### Task 7: P0-A full gate, independent review, and intermediate report

**Files:**
- Create: docs/reports/2026-08-19-vercel-fluid-cpu-p0a.md
- Modify only files required by a failing final gate or independent review

**Interfaces:**
- Produces: a reviewed P0-A checkpoint from which the separate P0-B plan may start.

- [ ] **Step 1: Run repository quality gates**

~~~powershell
npm ls --depth=0
npm run assets:check
npm run lfs:check
npm run lint
npm run typecheck
npm run build
node scripts/ci/check-static-public-routes.mjs
node scripts/ci/check-public-prerender-artifacts.mjs
git diff --check
~~~

Run the focused Node and Chromium/WebKit commands from Tasks 1–6 again only once at final integrated HEAD. Do not run a request loop or load test.

- [ ] **Step 2: Perform local production browser/DevTools-equivalent QA**

Start npm run start from the verified build. Inspect /, /en, /a-propos, /en/about, one FR guide, one EN guide, /contact, one pricing route, /menu/maison-elyse, one dish, /admin, /owner, and /q/invalid. Record console, failed network requests, 404/500s, initial lang, metadata/JSON-LD, hero sources, 3D requests, redirects, response/cache headers, and 390/430 overflow.

- [ ] **Step 3: Dispatch a whole-branch independent review**

Review against the P0-A spec and this plan. Every Critical/Important or P0/P1 finding must be fixed with a covering failing test and scoped re-review before this checkpoint is accepted.

- [ ] **Step 4: Create and inspect one controlled Vercel Preview**

Use the configured Vistaire Vercel project to create one Preview deployment from the reviewed P0-A checkpoint, never a production deployment. Wait for READY. Make only one controlled HTML request to / and /en, one Markdown GET/HEAD pair to /, and one protected/dynamic smoke request per representative family needed to classify behavior. Inspect deployment route output and logs for marketing Function/Proxy invocations. Do not loop, crawl, benchmark, or alter a remote project setting.

- [ ] **Step 5: Write the evidence report**

Include base/head SHA, app tree before/after, moved files, route table before/after, exact count of dynamic routes before/after, named static/ISR count, reasons for each remaining dynamic route, Proxy surface before/after, FR/EN initial language, SEO/JSON-LD/header evidence, hero/Sauge/browser evidence, external build reads and fallbacks, hermetic limitations, artifact scan, unchanged four 60-second TTLs, Vercel Git policy, non-applied Cloudflare expression, commands/results, review disposition, cleanup, and NON-VERIFIABLE items.

- [ ] **Step 6: Clean and commit the report**

Remove task-generated .next, test-results, playwright-report, screenshots, videos, traces, temporary fixture output, and debug files when not intentionally tracked. Verify no environment file, secret, heavy asset, migration, or production change exists.

~~~powershell
git status --short
git add docs/reports/2026-08-19-vercel-fluid-cpu-p0a.md
git commit -m "docs: report Vercel CPU P0-A evidence"
~~~

The controller must then continue immediately into a separately committed P0-B design/plan and implementation. No user pause is required because the user explicitly authorized P0-B and all later phases on 2026-08-19.
