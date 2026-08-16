# Supabase efficiency v2 — architecture, capacity gate and rollout

Status: implementation is local-only and **not production-ready** until the
read-only capacity gate below is green. This document is the contract for the
media, delivery and public-menu cache changes on `perf/supabase-efficiency-v2`.

## Integrated architecture and deployment order

The v2 media path is one fail-closed system rather than three independent
features. Owner uploads and an eventual backfill generate immutable V2
derivatives; the project-wide PostgreSQL capacity ledger reserves bytes before
the first Storage write and settles the actual bytes retained; public menu
mapping selects the `thumbnail`, `card`, or `display` variant for the consumer;
the public redirect validates the byte-exact canonical path and token deadline;
and owner mutations invalidate both menu and asset metadata caches after the
database commit. Signed URLs are never stored in the durable menu cache.

The only supported rollout order is:

1. **Migration:** deploy `20260815120000_media_capacity_reservations.sql` and
   run the PostgreSQL 17 concurrency/RLS/ACL contract in an ephemeral database.
   The migration creates a closed gate and does not seed or guess a quota.
2. **Configuration:** a privileged operator records the authoritative
   `project_ref`, `quota_bytes`, `used_bytes`, `usage_measured_at`, and
   `quota_source` state. Configure the exact project identity and credentials,
   but leave media writes disabled while measuring and reviewing headroom.
3. **Code:** deploy the upload, delivery, cache, and card consumers. Enable
   writes only after the migration and state are verified. Measure first,
   approve one canary separately, and enable backfill apply only for that run.

Do not reverse or combine these stages. Code deployed without the migration or
authoritative state returns capacity unavailable and performs no media write.
There is **no upload or backfill rollout without at least 20% measured
post-operation headroom**. An unknown, stale, incomplete, inferred, or
historical quota/usage measurement is a failed gate, never approval.

### Required variables and closed defaults

| Variable | Required value / default |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Exact HTTPS Supabase target (localhost is allowed only for fixtures). Missing/invalid fails closed. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only credential for capacity RPC, audit, and operator tooling. Missing fails closed. |
| `VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF` | Must exactly match the target project ref. Missing/mismatch fails closed. |
| `VISTAIRE_MEDIA_WRITES_ENABLED` | Only the exact string `true` enables upload/delete/apply writes; missing or any other value disables them. |
| `VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY` | Only `1`, together with `--apply --confirm-production` and the global write switch, allows apply. Default is disabled. |
| `VISTAIRE_MEDIA_BACKFILL_CHECKPOINT` | Optional local checkpoint path; default `.cache/media-backfill/dish-photo-derivatives.json`. Never commit it. |
| `VISTAIRE_SUPABASE_AUDIT_TARGET` | Set to `production` only for an explicitly approved read-only audit with `--allow-production-read`; audit always refuses CI. |

Backfill apply additionally requires a fresh `--measure-report` (maximum age
15 minutes) matching project, target, Git commit, source set, recipe, schema,
quota, usage, and recomputed headroom. The default concurrency is 2 (maximum
4). Hash verification defaults to 10,000 objects, 256 MiB total downloaded
bytes, and 10 seconds per download; hard maxima are 100,000 objects, 1 GiB,
and 60 seconds. Capacity reservations have a five-minute heartbeat deadline;
expiry never releases bytes implicitly, and unsettled reservations remain
counted until explicit finalize/release. Every reservation persists its
operation id, restaurant id, dish id and recipe id for operator correlation;
the unique live reservation key remains the idempotency/race guard.

### Operator reconciliation for abandoned reservations

Reconciliation is a manual, reviewed incident procedure; no production SQL or
Storage mutation is run automatically. Keep media writes disabled while it is
in progress.

1. Run the read-only usage audit with the exact expected project ref and the
   explicit production-read opt-in. In the Supabase SQL editor, use a
   read-only transaction to list overdue `active` or `settlement_pending`
   reservations with their id, key, reserved/actual bytes, timestamps, and
   project ref. Export the result into the incident record.
2. Correlate each reservation key with application/backfill logs, the dish
   metadata row, and byte-exact Storage `info` results. For every attempted
   path, record one of: absent; present and referenced; present and unreferenced;
   or unknown. A timeout, partial provider response, hash mismatch, or missing
   cross-reference remains `unknown`.
3. Release an `active` reservation through
   `release_media_capacity_reservation` only when every attempted object is
   proven absent and no database metadata references it. Finalize through
   `finalize_media_capacity_reservation` with the deduplicated retained bytes
   when objects are present or their creation is still ambiguous. Never guess
   zero bytes, edit reservation tables directly, or delete an object as part of
   capacity reconciliation.
4. Re-measure all project Storage buckets, update the authoritative capacity
   snapshot with its exact `usage_measured_at` and evidence source through the
   separately approved operator change, then rerun the read-only audit. A
   second operator must verify that active reserved bytes, global used bytes,
   and the incident ledger reconcile before media writes are re-enabled.

Photo originals and derivatives are immutable, content-addressed and may be
reused by another instance before that instance commits its metadata. Inline
rollback and replacement cleanup therefore never delete photo objects: they
retain and capacity-bill attempted paths, report `skippedConcurrentReuseRisk`,
and leave deletion to a separately approved offline reconciliation performed
only after a stable reference scan. This closes the Storage/DB TOCTOU window.

## Evidence boundary

The Supabase connector was used for this snapshot in read-only mode against
project `bkpewsjvxswqruwqljcy`. No migration, SQL write, Storage upload/remove,
bucket change, plan change or load test was performed. The connector confirmed
organization plan `free`, project status `ACTIVE_HEALTHY`, region `us-west-2`
and PostgreSQL 17.6.1.

### Live read-only baseline (2026-08-14 UTC)

| Item | Measured value | Evidence / status |
| --- | ---: | --- |
| Supabase plan | Free | connector organization lookup |
| `vistaire-media` | 84 objects / 54,819,578 B | all 84 are photo originals |
| `vistaire-3d` | 220 objects / 944,887,706 B | private bucket |
| Storage total | 999,707,284 B | media + 3D; other buckets empty |
| versioned photos | 84 | 84 distinct source SHA-256 values |
| photos with derivatives | 0 | 84 original fallback candidates |
| missing photo source objects | 0 | metadata paths matched Storage objects |
| duplicate photo SHA groups | 0 | live metadata comparison |
| analytics events | 3,114 | 1,095 with `source = production` |
| analytics last 24 h / 7 d / 30 d | 4 / 140 / 1,116 | live SQL counts |

Photo original byte baseline is `p50=264,094 B`, `p95=2,140,404 B`,
`max=2,279,803 B`. Maison Élyse is the correct canary candidate by current
weight (`12` objects / `25,057,749 B`, `p95=2,202,057 B`). Sauge Noire is
`36` objects / `19,184,932 B`; Trouvable is `36` objects / `10,576,897 B`.
These are original bytes, not derivative measurements.

The historical derivative estimate remains `29,602,572 B`; it was not
re-generated by measure-only and must not be presented as a measured output.

### Live 3D inventory

| Category | Objects | Bytes |
| --- | ---: | ---: |
| web GLB (`models/web`) | 63 | 122,957,756 B |
| AR iOS USDZ (`models/ar-ios`) | 65 | 777,393,886 B |
| source GLB (`models/source`) | 28 | 44,017,812 B |
| manifests/reports (`models/manifests`) | 64 | 518,252 B |
| **total** | **220** | **944,887,706 B** |

The active runtime/reference fields (`webModel3dStoragePath`,
`arUsdzStoragePath`, `sourceModel3dStoragePath` and
`usdzOptimizationReportStoragePath`) reference `219` distinct existing
objects (`944,391,517 B`). There is one orphan candidate of `496,189 B`.
No active reference is missing. Separate legacy metadata fields still contain
28 missing `ar-lite` paths and 28 missing Meshy-manifest paths; these are
stale metadata references, not missing active runtime objects. Content SHA
deduplication for 3D is not measurable from current Storage metadata alone.

Controlled public reads were limited to HEAD/GET metadata and a few public menu
redirects. They showed the current 307 redirect contract and sampled original
fallback paths. Storage logs (100-row provider sample) contained 32 POST and
29 GET `/object/sign` calls, with repeated original paths appearing up to six
times; tokens were redacted. No token is stored in this report.

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

Public and Admin routes accept `thumbnail`, `card`, and `display`. Compact rows
use `thumbnail`; large/editorial/grid cards use `card`; dish details continue
to use `display`. A card URL is emitted only for immutable V2 metadata whose raw
path exactly matches restaurant, active source SHA-256, recipe, variant, and
output SHA-256. Legacy or malformed metadata falls back to the original. Admin
authorization runs on every request; Admin tokens are 300 seconds and every
Admin response is `private, no-store`.

The public contract is deliberately short and deadline-bound:

| Layer | TTL / bound |
| --- | ---: |
| Availability/metadata snapshot | 30 s from lookup start |
| Public signed token | at most 270 s |
| In-process signed URL reuse | at most 120 s |
| CDN redirect | at most 120 s |
| Token safety margin after CDN expiry | at least 30 s |
| Composed stale-access SLA | at most 300 s from snapshot start |
| Browser cache | `no-store` |

The redirect decodes the returned JWT `exp` and rejects a token that exceeds
the absolute snapshot deadline or has less than 150 seconds remaining. Its CDN
TTL is recomputed as `min(120, remaining token seconds - 30)`; token reuse never
extends expiry. `X-Vistaire-Asset-Revocation-SLA: 300` reports the composed
bound. Invalid/legacy assets, unavailable dishes, errors, and Admin redirects
receive no public cacheability. These caches are per warm instance; no signed
URL/token enters durable menu data or logs.

## Public menu data cache

`getPublicMenuBySlug` has a 60-second inter-request v3 cache whose identity is
the exact `(restaurantId, slug, locale)` tuple. A bounded 60-second identity
lookup discovers the restaurant id before the full menu is cached; the full
loader re-reads the restaurant row. Tags cover exact restaurant, slug, and
locale identities. Owner/Admin mutations invalidate in-process asset metadata
and the restaurant menu tag before the fallible slug lookup, then invalidate
the remaining exact tags and paths independently. An in-flight pre-invalidation
load cannot repopulate stale data. Failures produce an awaited, structured,
non-secret retry signal while preserving the already committed mutation result.
No cookies, sessions, permissions, Admin state, or signed material enter the
cache key/value. Unavailable dishes are never reintroduced by menu construction.

The cold loader still performs the existing five scoped PostgREST reads (four
parallel branches); no RPC was added without a measured contract. A warm hit is
the target of zero Supabase reads. The explicit projections remove wildcard
columns, but `menu_dishes.metadata` remains in the DB projection because the
current renderer still derives public media/3D state from it. Its byte reduction
is not claimed or measured; a future additive typed view/RPC must provide golden
parity before removing that column.

Analytics deliberately keeps the existing JavaScript fallback. Live size is
`1,204,224 B` table data + `1,302,528 B` indexes (`2,547,712 B` total) for
`3,114` rows. The current 13-column dashboard projection is approximately
`1,367,683 B` JSON versus `2,131,709 B` for full-row JSON. The 1 MB payload
threshold is therefore crossed, but no SQL rollup/RPC is claimed yet: the
dashboard still requires ordered event/session fields, funnels, buckets and
previous-period comparisons, and no sanitized golden fixture has been approved.
The target `raw rows transferred = 0` remains **not met**. The next additive
RPC must be fixture-tested before activation; do not activate rollups,
materialized tables, pg_cron or retention jobs in this mission.

## Capacity gate

The connector baseline is live and read-only. The local audit script remains
fail-closed unless an operator explicitly supplies a service-role key:

```powershell
$env:VISTAIRE_SUPABASE_AUDIT_TARGET = "production"
$env:VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF = "bkpewsjvxswqruwqljcy"
npm run supabase:usage:audit -- --allow-production-read --json
```

The script refuses CI, hosted projects without `--allow-production-read`, and
all writes. It reports bucket/category bytes, source/derivative coverage, 3D
reference candidates, analytics windows and projection status. The rollout
gate accepts quota and global usage only from the authoritative,
project-scoped capacity state returned by `get_media_capacity_state`; observed
bucket bytes, a plan label, or a published allowance are not quota authority.
The photo section exposes explicit `rowsWithoutPhoto`, `rowsOriginalOnly`,
`rowsV1Complete`, `rowsV2Complete`, `rowsPartial`, metadata/object/hash failure
counters and `rowsOriginalFallback`. Any `partial`, `fail`, or `unavailable`
result exits non-zero.

Definitions:

```text
CURRENT_STORAGE_BYTES       = measured bytes in both production buckets
ACTIVE_RESERVED_BYTES       = all active or settlement-pending reservations
EXPECTED_DERIVATIVE_BYTES   = sum of real --measure-only variant bytes
EXPECTED_STORAGE_AFTER      = AUTHORITATIVE_USED_BYTES + ACTIVE_RESERVED_BYTES + EXPECTED_DERIVATIVE_BYTES
EXPECTED_HEADROOM_BYTES     = AUTHORITATIVE_QUOTA_BYTES - EXPECTED_STORAGE_AFTER
EXPECTED_HEADROOM_PERCENT   = EXPECTED_HEADROOM_BYTES / AUTHORITATIVE_QUOTA_BYTES * 100
```

The backfill report counts complete V2 bytes **and retained V1 derivative bytes**
(`legacyDerivativeBytes`); V1 objects are not deleted by this rollout. The live
measure envelope exposes the stable operator aliases `reportSchemaVersion`,
`gitHead`, `rows`, `sources`, `existingStorageBytes`, `additionalBytes`,
`headroomBefore`, `headroomAfter`, `headroomPercent` and `capacityGate`; apply
validates those aliases against the canonical numeric fields and fails closed
on any mismatch. The live
current storage is `999,707,284 B`. The historical dry-run estimate of
`29,602,572 B` would produce `EXPECTED_STORAGE_AFTER=1,029,309,856 B`.
Using the published decimal 1 GB Free allowance only as a historical scenario
gives `292,716 B` (`0.029%`) current headroom and
`-29,309,856 B` (`-2.93%`) after that estimate. This is already a hard
scenario failure, but it is not eligible to populate or bypass the capacity
ledger. A real
`--measure-only` run is still required for the final derivative byte value.
The gate remains `FAIL / NOT READY` until an authoritative capacity state and
fresh measure report prove at least 20% post-run headroom and the quota/plan
decision is approved.

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

The live 3D inventory is now measured above: `219/220` active/orphan
candidates, with `496,189 B` in the single orphan candidate. No USDZ/GLB
optimization or deletion is authorized. Physical scale, textures, Quick Look
and Scene Viewer require a separate device-QA project.

Local schema/projection contracts and generated TypeScript types are validated
in CI, and the current public projections resolve against the live columns.
The migration history still has drift: the live project reports 30 timestamped
migrations with names/versions that do not exactly match the repository's
legacy `0001`-style and later timestamped files. No production reconciliation
was attempted. Advisor findings are now measured and remain unchanged:

- 4 unindexed foreign keys: the three translation `restaurant_id` keys and
  `qr_codes.supersedes_qr_code_id`;
- 18 unused-index notices, including `analytics_events_session_idx` and the
  3D pipeline/status indexes;
- 5 RLS-enabled tables without policies: translation tables/jobs and
  `qr_code_lifecycle_events`.

The indexes are small (mostly 8-16 KiB; `analytics_events_session_idx` is
90,112 B), and their zero scan counters are not enough to justify removal.
Each requires a real query plan, index-advisor check and write-cost review.
RLS no-policy findings remain fail-closed until intentional access is proven.

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

Not ready for production rollout: the live plan, storage, derivative coverage,
3D inventory and analytics volume are now measured, but Free capacity fails the
20% headroom gate before and after the derivative estimate. Photo source
p50/p95 are measured; derivative p50/p95 and WebP-vs-AVIF benchmarks are not.
Public metadata byte reduction and SQL analytics parity are not met; browser/
Admin/Owner production smoke, WebKit, physical AR and Vercel checks remain
pending. The backfill apply command, bucket visibility, plan, provider,
migrations and production variables remain unchanged.
