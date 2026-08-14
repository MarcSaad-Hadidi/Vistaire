# Supabase efficiency v2 — architecture, capacity gate and rollout

Status: implementation is local-only and **not production-ready** until the
read-only capacity gate below is green. This document is the contract for the
media, delivery and public-menu cache changes on `perf/supabase-efficiency-v2`.

## Evidence boundary

No Supabase service-role or Management API credential was present in the
worktree. Consequently, no live Storage listing, plan lookup, advisor query,
database mutation, Storage mutation or load test was performed. The project ref
`bkpewsjvxswqruwqljcy` and the following values are operator-provided historical
claims, not measurements from this run:

| Item | Supplied value | Status |
| --- | ---: | --- |
| Supabase plan | Free | unverified |
| `vistaire-media` | 54,819,578 B | unverified |
| `vistaire-3d` | 944,887,706 B | unverified |
| Storage total | 999,707,284 B | unverified |
| versioned photos | 84 | unverified |
| photos with derivatives | 0 | unverified |
| historical derivative dry-run | 29,602,572 B | estimate, not a measurement |
| 3D objects / referenced | 220 / 219 | unverified |
| analytics events | 3,114 | unverified |

Controlled public reads were limited to HEAD/GET metadata and a few public menu
redirects. They showed the current 307 redirect contract and that sampled
Sauge Noire, Maison Élyse and Trouvable photos fell back to original paths. No
signed token is stored in this report; locations were redacted before hashing.

## Canonical photo pipeline

`lib/owner/dishPhotoRecipe.json` and its typed export are the only recipe source:

| Variant | Width cap | Encoder |
| --- | ---: | --- |
| `thumbnail` | 320 px | WebP quality 82, Sharp effort 4 |
| `card` | 768 px | WebP quality 84, Sharp effort 4 |
| `display` | 1,440 px | WebP quality 86, Sharp effort 4 |

Recipe id: `dish-photo-v2`. The id must change whenever dimensions, quality,
format, encoder or any byte-affecting Sharp option changes. V2 originals are
content-addressed (`.../photos/originals/<sourceSha256>.<ext>`). Derivatives are
content-addressed (`.../photos/derivatives/<sourceSha256>/dish-photo-v2/<variant>-<outputSha256>.webp`).
All new uploads use `upsert: false`; an existing content-addressed path is an
idempotent conflict, never an overwrite. V1 metadata and paths remain readable
only during migration, and cleanup recognizes both V1 and V2.

V2 metadata contains `schemaVersion`, `recipeId`, `variant`, `storagePath`,
`sourceSha256`, `outputSha256`, `sha256` (compatibility alias), `contentType`,
`format`, `width`, `height`, `bytes`, `generatedAt` and `encoder`. Delivery
validates those fields and the path before signing; invalid metadata falls back
to the original or returns the existing 404/503 contract.

Sharp inspection is explicit and bounded before transformation:

- JPEG, PNG and WebP only (AVIF is intentionally rejected until product/browser
  support is explicitly approved).
- MIME and magic bytes must agree; truncated/spoofed files fail closed.
- 40,000,000 input pixels, 12,000 px maximum width/height, four channels,
  one page/frame, `failOn: "warning"`, and a 15-second Sharp timeout.
- EXIF orientation is normalized with `rotate()`. Animated/multi-page images,
  invalid dimensions, decompression bombs and channel violations are rejected.

The generator decodes one source pipeline and uses `clone()` per variant. No
queue, cron, Edge Function or external provider is enabled. Synchronous
generation remains the selected path while uploads are infrequent and the
bounded input is below 5 MB; p95 timeout/memory evidence would be required
before introducing an asynchronous queue.

## Delivery and cache contract

Public and Admin routes accept `thumbnail`, `card` and `display`. Cards/lists
use the thumbnail URL; details use the display URL. No normal card path uses
`display`, and no detail path uses the original when a validated derivative is
available. Admin authorization runs on every request and its redirect is
`private, no-store`; Admin signed URLs are 600 seconds.

For a public, available, versioned asset, authorization/availability is checked
against the dish row first. A production-only bounded metadata LRU/in-flight
cache (60 seconds, versioned public keys only) avoids repeating that PostgREST
read at the origin while preserving the explicit 45-minute public availability
SLA. A second bounded in-process LRU and in-flight map then reuses a signed URL
by bucket/path/version for 2,700 seconds (512 entries), below the 3,600-second
Storage token lifetime. It is deliberately not user-specific and tokens are
never put in client metadata or logs. These are per-warm-instance optimizations;
cross-region/global deduplication would require a shared KV and is out of scope.

The public redirect advertises `s-maxage=2700`, `Surrogate-Control: public,
max-age=2700` and `X-Vistaire-Asset-Revocation-SLA: 2700`. Therefore changing
`is_available` to false does **not** revoke an already cached redirect
immediately: the explicit maximum stale-redirect window is 45 minutes. The
signed token itself may remain cryptographically valid for up to one hour, but
the application/CDN will not issue a new redirect after availability is false.
Admin access is not covered by this public SLA.

## Public menu data cache

`getPublicMenuBySlug` now has a 60-second inter-request `unstable_cache` keyed by
`public-menu/v2/<slug>/<locale>`. Tags include `public-menu:<slug>`,
`restaurant:<id>`, `menu-locale:<slug>:<locale>` and their explicit aliases.
Owner/Admin mutations for dishes, categories, photos, model assets, settings and
translations call the shared invalidation helper as well as path revalidation.
Route-handler writes expire the tags with `revalidateTag(tag, { expire: 0 })`,
so read-your-writes is immediate; the 60-second TTL is the no-mutation freshness
SLA. No cookies, sessions, permissions or admin state enter the cache key.

The cold loader still performs the existing five scoped PostgREST reads (four
parallel branches); no RPC was added without a measured contract. A warm hit is
the target of zero Supabase reads. The explicit projections remove wildcard
columns, but `menu_dishes.metadata` remains in the DB projection because the
current renderer still derives public media/3D state from it. Its byte reduction
is not claimed or measured; a future additive typed view/RPC must provide golden
parity before removing that column.

Analytics deliberately keeps the existing JavaScript fallback. No SQL rollup/RPC
is claimed because the dashboard currently requires ordered event/session
fields, funnels, buckets and previous-period comparisons without a stable SQL
fixture. The target “raw rows transferred = 0” is therefore **not met**. Enable
an additive SQL function only after golden parity tests exist and one of these
objective thresholds is crossed: 100,000 rows, 1 MB dashboard payload, p95
aggregation over 250 ms, or sustained database CPU over 60%. Until then, do not
activate rollups, materialized tables, pg_cron or retention jobs.

## Capacity gate

The gate is intentionally fail-closed until the audit runs with an explicitly
approved read-only service-role credential:

```powershell
$env:VISTAIRE_SUPABASE_AUDIT_TARGET = "production"
$env:VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF = "bkpewsjvxswqruwqljcy"
npm run supabase:usage:audit -- --allow-production-read --json
```

The script refuses CI, hosted projects without `--allow-production-read`, and
all writes. It reports bucket/category bytes, source/derivative coverage, 3D
reference candidates, analytics windows, projection status and the reason
plan quotas/advisors require the Management API.

Definitions:

```text
CURRENT_STORAGE_BYTES       = measured bytes in both production buckets
EXPECTED_DERIVATIVE_BYTES   = sum of real --measure-only variant bytes
EXPECTED_STORAGE_AFTER       = CURRENT_STORAGE_BYTES + EXPECTED_DERIVATIVE_BYTES
EXPECTED_HEADROOM_BYTES      = PLAN_STORAGE_LIMIT - EXPECTED_STORAGE_AFTER
EXPECTED_HEADROOM_PERCENT    = EXPECTED_HEADROOM_BYTES / PLAN_STORAGE_LIMIT * 100
```

The backfill report counts complete V2 bytes **and retained V1 derivative bytes**
(`legacyDerivativeBytes`); V1 objects are not deleted by this rollout. The
supplied historical numbers would imply approximately 1,029,309,856 B after
the historical 29,602,572 B derivative estimate. Against a decimal 1 GB Free
allowance that would exceed quota by about 29 MB; because both quota and
derivative value are unverified, this is not a rollout approval. The gate is
`FAIL / NOT READY` until measured headroom is at least 20% and the quota is
unambiguous.

Capacity options (no option is activated here):

| Option | Calculation / evidence needed | Decision |
| --- | --- | --- |
| A — Supabase Pro | 100 GB included file storage; compare measured buckets and egress to the plan’s included quotas | likely pass for the supplied ~1 GB, but requires billing approval |
| B — separate runtime 3D object store/CDN | move only active GLB/USDZ runtime bytes; keep private source/original policy and cross-reference metadata | candidate after TCO and device QA; no provider/code change now |
| C — verified 3D byte reduction | reduce active bytes by at least `EXPECTED_STORAGE_AFTER - PLAN_LIMIT`, then prove scale, Quick Look and Scene Viewer QA | not approved; no deletion or optimization in this mission |

## Delivery-policy ADR

| Policy | Security / direct URL | Cache and cost | GLB/USDZ | Decision |
| --- | --- | --- | --- | --- |
| A. Private derivatives + reusable signed URLs | private bucket, authorization at app, direct Storage URL is short-lived | high cache reuse at redirect and Storage, no public bucket change | supported | **current default** |
| B. Private originals + public runtime derivatives | public derivative URL is revocable only by cache/object policy; larger exposure | strong CDN hit rate, fewer signs, but public visibility change | supported | reject without explicit approval |
| C. External CDN/object storage | separate IAM and purge contract; migration/lock-in | potentially lowest egress, new request/egress billing surface | supported if CDN preserves binary types | study only |
| D. Supabase Pro Smart CDN/Image Transformations | managed private/public semantics depend on product configuration | lower origin reads, transformation and plan costs must be measured | transformations are photo-focused; 3D remains object delivery | study only |

The bucket visibility policy is unchanged. No public derivative bucket is created.

## Backfill and canary runbook

1. Run `--measure-only` with a small `--restaurant-id`/`--limit` sample and
   archive the JSON report. It downloads sources, generates all missing V2
   variants locally and uploads nothing; `expectedDerivativeBytesAfterRun` is
   based on real output bytes. `--verify-only` checks metadata and
   `Storage.info` without downloading originals; add `--verify-source` only
   when a source SHA recheck is specifically required.
2. Run the read-only usage audit and obtain an approved capacity gate (>=20%
   headroom).
3. Prepare, but do not execute in this mission, an apply command for exactly one
   canary restaurant (Maison Élyse is only a candidate after the audit confirms
   it is the heaviest and has no concurrent photo edits).
4. Verify metadata, object paths, Admin thumbnails, public cards/details,
   redirect headers, fallback behavior and actual Network bytes.
5. Observe the canary through at least one cache TTL window; then obtain a new
   approval before applying the remainder.

The apply command is intentionally not run. A failed metadata update rolls back
only newly uploaded, cross-reference-safe objects; uncertain references are
kept. Checkpoint/resume and bounded concurrency are enabled, but checkpoints
are local operator artifacts and must not be committed.

## 3D, schema and advisor policy

The local repository contains grandfathered 3D assets (tracked `public` GLB/USDZ
and `3D Plat` files); this is not a production inventory. Live active/orphan
bytes, duplicate SHA groups and missing references require the read-only audit.
No USDZ/GLB optimization or deletion is authorized. Physical scale, textures,
Quick Look and Scene Viewer require a separate device-QA project.

Local schema/projection contracts and generated TypeScript types are validated in
CI. Live drift remains unverified without a read-only schema query. Advisor
findings (foreign-key indexes, `qr_codes.supersedes_qr_code_id`, unused indexes,
RLS tables without policies) must be reviewed with query plans, write cost and
index size; no index or RLS policy is added on an advisor name alone.

Supabase’s 2026 Data API exposure change means a future additive view/RPC must
also be explicitly exposed and granted, with RLS/security-invoker reviewed; a
function is not considered available merely because its migration file exists.

## Provider model (not an invoice)

The following scenario model uses the explicit assumption of 12 thumbnail/card
requests plus one display request per menu open and 1.84 MB uncached media per
open. Replace the assumption with Network/HAR measurements before a purchasing
decision.

| Opens / month | Modeled media | R2 Class-B GETs (13/open) | R2 request cost* | Vercel Blob transfer after 10 GB* |
| ---: | ---: | ---: | ---: | ---: |
| 10,000 | 18.4 GB | 130,000 | ~$0.05 | ~$0.42 |
| 100,000 | 184 GB | 1,300,000 | ~$0.47 | ~$8.70 |
| 1,000,000 | 1.84 TB | 13,000,000 | ~$4.68 | ~$91.50 |

`*` Excludes storage, transformations, taxes, plan minimums and cached/uncached
split. R2 uses $0.36 per million Class-B operations and free egress; Vercel
Blob uses $0.05/GB transfer after its included allowance. Supabase Free/Pro
quota and overage rates, Cloudflare R2/Images and Vercel Blob/Image Optimization
must be recalculated from the official pricing pages at approval time:

- [Supabase pricing](https://supabase.com/pricing) and [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/)
- [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Vercel Image Optimization pricing](https://vercel.com/docs/image-optimization/limits-and-pricing)

For a comparable Supabase model, assume the 1.84 MB/open figure is split 50/50
between cached and uncached egress and the measured post-rollout storage is
approximately 1.03 GB. Free is therefore not viable even at 10,000 opens (the
1 GB storage and 5 GB-per-class quotas are crossed). Pro remains inside its
100 GB storage and 250 GB-per-class egress inclusions at 10,000 and 100,000
opens; at 1,000,000 opens the illustrative egress overage is about $80.40/month
(`670 GB × $0.09` uncached + `670 GB × $0.03` cached), before the plan minimum,
requests and transformations. This is a sensitivity model, not an invoice:
replace the open/media assumption with measured Network data and the approved
plan's current quotas before selecting an option.

Engineering/migration cost, cache hit ratio, cached versus uncached egress,
request counts, transformations and 3D binary support must be included in the
approval worksheet; no external provider is added by this branch.

## Network and CI budgets

- Admin listing: thumbnail/card metadata only; no original download.
- Public cards: thumbnail (or a measured card variant); never display.
- Dish detail: display; original is fallback-only and should be zero in the
  normal post-backfill flow.
- Initial menu: zero GLB and zero USDZ requests.
- Viewer/AR: GLB/USDZ only after explicit intent.
- CI: zero production Supabase requests; `supabase:usage:audit` hard-refuses CI.

The browser gate still requires Chrome/Playwright checks at 390 px and 430 px,
console/network inspection, no horizontal overflow, and verification that no
initial 3D request occurs. Real iPhone Quick Look/Android Scene Viewer behavior
is not claimed without physical-device testing.

## Readiness verdict

Implemented and locally verified: immutable V2 recipe/path contract, bounded
Sharp inspection, V1-compatible cleanup, card route parsing, signed URL reuse,
public menu cache/tag invalidation, read-only audit and targeted tests.

Not ready for production rollout: live capacity/plan, derivative coverage and
3D inventory are unverified; photo p50/p95 and WebP-vs-AVIF benchmarks are not
measured; public metadata byte reduction and SQL analytics parity are not met;
browser/Admin/Owner production smoke and Vercel checks remain pending. The
backfill apply command, bucket visibility, plan, provider, migrations and
production variables remain unchanged.
