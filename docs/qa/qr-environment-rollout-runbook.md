# QR environment rollout runbook (phases A–I)

This runbook is the operator gate for the canonical QR rollout. It never
authorizes a merge, deploy, remote migration or Production data mutation by
itself. Preview and Production are separate change records with separate
projects, origins, secrets, approvals and evidence.

## Verified baseline — 20 July 2026

- Supabase **Vistaire** runs PostgreSQL 17.6 with the legacy QR schema; migration
  `20260717120000_owner_qr_canonical_lifecycle.sql` is absent.
- That verified live legacy schema has only `active`, `paused` and `archived`;
  it does not yet have persisted `revoked`, lifecycle timestamps,
  `config_version`, disposition/idempotency lifecycle RPCs or owner inventory.
- Safe Vistaire aggregates show 7 active admin QRs and 1 active menu QR. No raw
  token, hash, ciphertext, nonce, row id or complete project ref was collected.
- The Supabase project named **Trouvable** is unrelated to Vistaire and has no
  `qr_codes` table. It must never be selected as a rollout target.
- The PR 153 Vercel Preview is `READY` on the exact audited branch/commit and
  project. Production is `READY` on `main` at the previously audited SHA.
- GitHub environment `admin-e2e` has no protection, reviewer, branch policy,
  repository/environment secret names or variables configured.
- Repository branch protection/rulesets return 403 on the current private plan.
  Required reviewers need an external plan upgrade/configuration.
- The observed Supabase branch price is `0.01344` per hour; the currency was not
  provided and is **NOT VERIFIED**. No Supabase branch was created because that
  requires explicit approval.

Therefore these docs and the read-only preflight can be reviewed, but the
lifecycle DB/runtime candidate is **NOT INTEGRATED** on this audited head. Live
QA is **NOT VERIFIED** and promotion is **BLOCKED** until the candidate commits,
explicit environment provisioning and independent approval controls exist. The
current expected admin E2E behavior is fail-closed before browser execution.

## Phase A — authorize and identify

- Open separate Preview and Production change records with owners, window and
  rollback authority.
- Record only redacted identifiers: environment name, project name, partial ref,
  deployment branch and short SHA.
- Confirm the target is Supabase Vistaire, never the unrelated Trouvable project.
- Do not create a Supabase branch without explicit approval, accepted cost and
  confirmed currency. The observed `0.01344` hourly amount is insufficient for
  authorization while its currency remains NOT VERIFIED.
- Stop if Preview and Production share a Supabase ref, public QR origin, service
  role, pepper, key ring or admin-session secret.

## Phase B — inventory read-only

- Confirm PostgreSQL major version and applied migration history using the
  provider's read-only metadata view.
- Collect only aggregates: row counts by `target_kind`, `status`,
  `is_canonical`, and distinct `token_key_version` counts.
- Never select tokens, hashes, previews, ciphertext, nonces, complete ids or
  client-identifying labels.
- Snapshot constraints, relevant columns and RPC signatures. Save redacted
  evidence with the change record.

Expected current Vistaire outcome: PostgreSQL 17.6, 8 active legacy rows in the
safe aggregate (7 admin, 1 menu), canonical migration absent. Stop before code
promotion while this mismatch remains.

## Phase C — provision secrets and external controls

- Provision all names listed in `.env.example` separately in Preview and
  Production; never put values in GitHub YAML, docs, tickets or command history.
- Add the `admin-e2e` variables/secrets explicitly before live QA. Today none
  are configured, so fail-closed is expected.
- Configure protected reviewers and branch policy outside this repository. If
  the private plan still returns 403, mark the control **BLOCKED** and do not
  substitute self-approval.
- Store the key ring and escrow through the procedure in
  `docs/owner-qr-schema.md`. Confirm every key decodes to exactly 32 bytes and
  the admin-session secret contains at least 32 UTF-8 bytes.
- From each environment's secret-controlled process, compute SHA-256
  fingerprints for the service role, every active/previous pepper, every
  decoded vault key and the admin-session secret. Supply only the other
  environment's fingerprints to the preflight; never co-locate or print the
  other environment's raw values. Fingerprints are sensitive metadata and must
  stay in the protected change record, not Git.
- Confirm no QR/service-role secret has a `NEXT_PUBLIC_` name.

## Phase D — local/config preflight

Populate values only in the approved secret-bearing process, then run:

```powershell
node scripts/qr-environment-preflight.mjs --config-only
```

The command prints environment, expected ref, origin and schema-contract status
only; it never prints a secret. `nominal_schema_contract=NOT VERIFIED` is expected in
config-only mode and does not authorize migration or deployment. The asserted public origin must
match the first runtime value actually used by QR URL generation:
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `SITE_URL`,
`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`, then the Vistaire fallback.

## Phase E — Preview database migration

- Reconfirm Preview identity and approval immediately before the change.
- Back up according to Supabase policy and test restore ownership.
- Stop unless the separately reviewed DB/runtime candidate commits have been
  integrated and their exact SHAs are recorded. The numeric migration filename
  alone is insufficient: the copy on audited head `8c6672d…` is the older,
  partial canonical contract.
- Apply the integrated candidate migration set in repository order through the
  approved change channel only after its PostgreSQL tests pass.
- Do not run the migration against Production in this phase.
- Do not backfill, promote, pause, archive, revoke or delete historical rows.
- After application, repeat Phase B aggregates and prove all historical counts
  and protected fields are unchanged.

## Phase F — Preview code and read-only schema preflight

Deploy only the reviewed commit to the dedicated Preview. Then run, from a
secret-controlled shell:

```powershell
node scripts/qr-environment-preflight.mjs
```

The script performs exactly two Supabase GET requests: an OpenAPI schema read
and a zero-row column projection. It never calls a resolver or lifecycle RPC,
never reads a QR row, and never mutates the database. It expects schema version
`qr-lifecycle-candidate-v1` by checking nominal canonical/lifecycle columns,
lifecycle-event columns, and get-or-create, rotation, lifecycle, clear and
resolution RPC paths. This does not prove the persisted status constraint, RPC
signatures or semantics, idempotency/dispositions, inventory authorization,
actual migration-history row or PostgreSQL server version. PostgreSQL tests,
Phase B provider metadata and Phase G authorization/functional evidence remain
mandatory and must be recorded separately as VERIFIED or NOT VERIFIED.

Fail closed on any ref/origin mismatch, missing 32-byte key, missing RPC/column,
public secret name, shared Preview/Production ref/origin/service role/pepper/
vault key/admin-session fingerprint, or non-2xx response.

## Phase G — Preview functional evidence

- Use dedicated, non-client fixtures only after `admin-e2e` has protected
  reviewers, branch policy and all required names provisioned.
- Verify canonical get-or-create, reload stability, style-only update,
  config-version conflicts, idempotent explicit rotation for each disposition,
  pause preserving canonical, resume, archive/revoke clearing canonical,
  irreversible revoke, metadata-only inventory, old active QR resolution,
  logout and restaurant A/B isolation.
- Keep trace, screenshot and video disabled for token-bearing scenarios; mask
  tokens before any browser call log.
- Verify no token appears in logs, URLs outside `/q/<token>`, analytics, reports
  or artifacts.
- Mark device-specific Quick Look/Scene Viewer behavior NOT VERIFIED unless
  tested on the real device.

## Phase H — Production approval and rollout

- Require an independent reviewer who did not execute the Preview change.
- Re-run Phases A–D for Production with Production-only values and compare the
  redacted identities against Preview to prove separation.
- Apply the migration before deploying code. Re-run the read-only preflight and
  aggregate preservation checks between those steps.
- Use a narrow validation QR owned by the rollout; do not rotate a historical
  client QR as a smoke test.
- No automatic promotion from Preview and no historical cleanup job are allowed.

## Phase I — observe, rollback or close

- Observe resolver error rate, admin-session failures and aggregate scan health
  without logging tokens or hashes.
- On failure, stop new canonical creation/rotation and roll back the application
  and environment configuration to the last known compatible version.
- Preserve both old and newly created QR rows. Do not drop additive schema,
  remove referenced vault keys, delete rows, or rewrite statuses during rollback.
- If a credential is suspected exposed, follow the incident procedure in
  `docs/owner-qr-schema.md`; rotate only the affected environment.
- Close only with redacted evidence, reviewer identity, exact checks/results,
  residual risks and explicit NOT VERIFIED items.

## Required completion record

Record: commit SHA; changed files; migration and deployment identifiers in
redacted form; read-only preflight result; before/after aggregates; functional
checks; reviewer; rollback readiness; cleanup; residual risks; and every item
that remains NOT VERIFIED or BLOCKED. Never attach environment values.
