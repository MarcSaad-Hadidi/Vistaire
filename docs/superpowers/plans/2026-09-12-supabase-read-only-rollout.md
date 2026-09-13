# Supabase Read-only Rollout Implementation Plan

> **For agentic workers:** Execute the scoped workflow and regression-test tasks below; review production authorization separately from code completion.

**Goal:** Expose safe, independent measurement and verification for the existing photo backfill without weakening its production-write gates.

**Architecture:** Keep the native backfill engine, capacity ledger, recipe and delivery contracts unchanged. The manual Actions workflow selects its existing modes, disables write opt-ins in read-only steps, and retains detailed command output only in a private runner directory.

**Tech Stack:** GitHub Actions, Bash, Node.js built-in test runner; existing Supabase/Sharp backfill engine.

**Spec:** Continue the operator path introduced by PR #236, as requested by the repository owner. This change does not authorize a production rollout.

## Global constraints

- Start from current main on a dedicated branch; never merge automatically.
- No runtime, dependency, asset, LFS, schema, bucket visibility or production configuration changes.
- Preserve main-only manual execution, immutable action revisions, read-only repository permissions, exact project matching and the single-restaurant apply scope.
- Preserve the native fresh-measurement requirement, at least 20% post-operation headroom, source/code/recipe binding, reservations and immutable object semantics.
- Do not emit detailed reports, source paths or provider diagnostics into public Actions logs.

## Implementation and validation

1. Reproduce the missing read-only modes and public-log disclosure against the unchanged workflow with executable regressions.
2. Add `measure-only` and `verify-only`, retain `dry-run` as default, and require an explicit restaurant UUID for measurement, verification and apply.
3. Force both write opt-ins off for inventory, measurement and verification, even when repository variables enable the separately approved apply step.
4. Capture both stdout and stderr privately. Publish only fixed diagnostics, validated numeric measurement aggregates and actual step outcomes. Never replace the complete measurement file passed into apply with its public summary.
5. Keep verification bounded by the engine's existing limits and enable `--verify-hash`; do not increase download/concurrency limits.
6. Wire the executable regressions into the existing workflow security contract, then run targeted tests and the hosted CI/security gates on the exact PR head.

The regression harness executes the actual inline Bash/Node steps on a Linux-compatible Bash host. Only the provider-facing backfill process is replaced with a temporary local stub. It does not authenticate, query or mutate a real Supabase project. Test fixtures are removed after execution.

## Operator modes

| Mode | Restaurant input | Production writes | Purpose |
| --- | --- | --- | --- |
| `dry-run` | Optional; validated when supplied | Disabled | Existing inventory, optionally scoped |
| `measure-only` | Required UUID | Disabled | Exact scoped measurement without enabling apply |
| `verify-only` | Required UUID | Disabled | Scoped metadata/object/hash checks without enabling apply |
| `apply` | Required approved canary UUID | Separately gated | Scoped inventory, fresh measurement, apply, then verification |

All modes still run only through a manual dispatch on main. Read-only does not mean cost-free: measurement and hash verification can download objects and consume egress. They retain the engine's native limits. An unavailable or stale capacity state can correctly fail measurement; this workflow does not refresh that state or invent a quota.

The apply step retains all existing independent prerequisites: exact confirmation `APPLY-DISH-PHOTO-BACKFILL`, repository apply opt-in, media-write opt-in, expected project identity, fresh complete measurement, positive source coverage and the native capacity/integrity gates. Its inventory is now scoped to the same restaurant rather than reading every restaurant first. Independent measurement and verification do not run the unrelated inventory stage.

## Capacity and production authorization

Before any apply, obtain the actual quota and its scope from an authoritative source. Reconcile usage for that same scope, retained objects, outstanding reservations and the peak additional bytes of the proposed operation. Organization allowances, per-file limits, database size and project object totals are not interchangeable.

Publish a fresh capacity snapshot only through a separately approved, concurrency-safe operator procedure. Never fabricate freshness, reset uncertain reservations, increase a quota value on paper or lower the headroom threshold. Adding derivatives while retaining originals consumes additional storage, even when it reduces the size of delivered images.

If capacity is insufficient, quantify the remaining deficit and obtain explicit approval for a sufficient capacity change or a proven-safe cleanup. An orphan candidate is not deletion authorization. Do not delete rows in `storage.objects` to free underlying objects; do not change active 3D/media references or billing implicitly.

A code merge does not authorize changes to production environment variables, capacity records, plans, migrations or Storage. GitHub repository variables and Vercel runtime variables are separate configurations. Check how capacity snapshots will remain fresh for later Owner uploads; a one-off backfill is not ongoing operational readiness.

## Diagnostics and recovery

Raw stdout/stderr, measurement files and checkpoints are stored under a private, uniquely created `$RUNNER_TEMP` directory. They are neither uploaded nor printed and are removed in the final cleanup step. The run summary reports requested mode and actual stage outcomes, not an inferred rollout success. Dispatch inputs and existing non-secret identifiers are not a secret channel.

For a failed read-only operation, reproduce the same scoped inventory/measurement/verification command in an authorized private operator session. Do not paste private reports or credentials into a public issue. Do not rerun apply merely to recover diagnostics: first inspect persisted metadata, retained objects and reservation context, and follow the existing reconciliation runbook. Runner checkpoints are ephemeral and are not a durable recovery ledger.

After a successful approved canary, review non-empty coverage, public/Admin delivery and original fallbacks, then observe the complete cache/revocation window. A successful command is not proof of that elapsed observation or of all-restaurant coverage. Any wider rollout requires a fresh measurement and its own explicit approval.
