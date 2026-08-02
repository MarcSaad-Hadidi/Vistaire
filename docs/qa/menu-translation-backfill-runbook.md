# Menu translation data backfill

This runbook covers the controlled data-only backfill for Maison Élyse, Trouvable, and Sauge Noire. The tool is `scripts/backfill-menu-translations.mjs`. It reads the relational menu by the exact restaurant slug, uses the primary non-archived menu relation, and writes only the three translation tables plus the guarded Maison Élyse `menus.settings_json` locale contract when needed.

Integration order: PR #175 (`fix/menu-translation-backfill-safety`) is the data-safety prerequisite and must land before PR #174 (`fix/pr173-runtime-production-safety`). After #175 lands, update #174 from the latest `main` and rerun the combined backfill/readiness checks; this branch intentionally does not copy the runtime implementation from #174.

## Verified environment inventory for this checkout

No remote or local Supabase execution is claimed by this runbook. Preview, production, and local project bindings must be independently supplied and explicitly allowlisted before a read; a dry-run report is not evidence that an apply target is safe.

| Environment | Supabase project ref | Binding evidence | Safe disposition |
| --- | --- | --- | --- |
| Vercel Preview | Unknown / unverified | Deployment metadata and the public payload do not expose the bound Supabase ref | Refused until the preview ref is supplied and explicitly allowed |
| Vercel Production | Unknown / unverified | No production environment binding was exposed to this audit | Refused until Vercel production binding and ref are proven |
| Local app | Unknown / unverified | No local project binding is validated in this branch | Dry-run/apply not claimed |
| Local tests | Fixture-only | E2E support starts a localhost Sauge fixture and uses a synthetic service-role value; it is not a Supabase project | Never use for apply |

The known Maison Élyse identifiers in repository-owned media policy are not used as implicit authorization. The script always requires `--project-ref` and a matching `--allow-project-ref`.

## What the script guarantees

- Dry-run is the default; `--apply` is mandatory for writes.
- The locale is a strict, case-sensitive `en-CA` allowlist. The current datasets are exclusively Canadian English, so `en`, `en-US`, `fr-CA`, `es-ES`, `ar`, empty, whitespace-padded, and otherwise non-normalized values are rejected.
- Locale validation happens before Supabase client creation, reads, translated-content construction, RPC execution, and report-file writes. An invalid locale cannot leave a report behind.
- The resolved Supabase hostname ref must match `--project-ref` and the explicit `--allow-project-ref` allowlist.
- `--apply` is permitted only for local or test fixtures/databases. Preview and production are always dry-run; the command rejects `--apply` for either environment before creating a client.
- Restaurant identity is selected by exact `slug`; menus, categories, dishes, and translation rows are constrained by their real foreign-key relations.
- `source_hash` and `field_hashes` use the production SHA-256 helpers from `lib/translation/menuTranslationModel.ts`.
- Existing translated content, providers, valid `manual_overrides`, and per-field hashes are preserved. A preserved field keeps its old hash. An overridden field is excluded from automatic freshness proof, keeps its translated value and old hash, and does not prove any other field fresh. `source_hash` becomes current only after every non-overridden required field has current evidence. `translated_at` changes only when translated content is generated/refreshed.
- Maison Élyse requires `fr-CA` as the default/source locale and a complete canonical `en-CA` content set for every real source field. A source divergence or incomplete field blocks apply.
- Dish names remain French identity labels and are never generated into translated `content`, `source_hash`, `field_hashes`, `requiredFields`, or readiness. Existing legacy `content.name` values are preserved but ignored. Category and menu names remain translatable under their existing contracts; missing dish canonical English-name mappings cannot block freshness.
- Maison Élyse plans a guarded `menus.settings_json` patch when needed: it preserves existing keys, sets `defaultLocale` to `fr-CA`, and adds `fr-CA`/`en-CA` to `supportedLocales`. Apply rereads and hashes the row before updating so concurrent settings changes refuse the write.
- Update operations carry a complete CAS snapshot: `id`, `updated_at`, `translation_status`, `provider`, `source_hash`, `field_hashes`, `content`, `manual_overrides`, `error_message`, and `translated_at`. Inserts carry an explicit `expected: null`; nullable columns remain explicit JSON `null` values. The hardening migration `20260801090000_harden_menu_translation_backfill_rpc.sql` wraps the historical RPC, validates locale/relations/payloads before delegation, and preserves transaction rollback on any conflict or database error. The historical `20260731100000_menu_translation_backfill_rpc.sql` is unchanged.
- The report includes environment/ref identity, restaurant/menu IDs and slugs, category/dish counts, per-table translation row counts, operation diffs, statuses, current/desired `source_hash` and `field_hashes`, explicit hash divergences, and settings hashes. Secrets are never printed. Planning errors are collected per target before the command refuses the run.

## Read-only commands

Run from the repository root with environment variables injected by the trusted operator shell. Do not paste service-role values into command history or reports.

```powershell
node scripts/backfill-menu-translations.mjs `
  --environment preview `
  --project-ref <preview-ref> `
  --allow-project-ref <preview-ref> `
  --restaurant maison-elyse `
  --locale en-CA `
  --report .tmp-menu-translation-preview.json
```

Repeat with `--environment production` only for a dry-run after independently confirming the deployment's `NEXT_PUBLIC_SUPABASE_URL` and explicit allowlist. Never add `--apply` for preview or production.

For a local dedicated Supabase project, use its actual ref and mark it explicitly:

```powershell
node scripts/backfill-menu-translations.mjs `
  --environment local `
  --project-ref <local-ref> `
  --allow-project-ref <local-ref> `
  --locale en-CA
```

The default target set is all three restaurants. Use `--restaurant trouvable` or `--restaurant sauge-noire` for a focused audit. There is no separately reviewed locale contract accepted by this backfill: use exactly `--locale en-CA`.

Apply never uses direct table upserts. The historical RPC locks all target menus in deterministic order, while the hardening wrapper validates complete CAS snapshots and exact `en-CA` before delegation. If the migrations are not installed in the explicitly bound project, `--apply` refuses to write.

For a real PostgreSQL 17 fixture (CI or an explicitly named local test database), run:

```powershell
$env:VISTAIRE_TRANSLATION_BACKFILL_POSTGRES_TEST = "1"
npm run test:translation:backfill:postgres
```

The fixture applies the historical and hardening migrations, inserts a real restaurant/menu/category/dish graph, executes insert and noop paths, checks exact `en-CA` and complete-snapshot rejection, verifies a CAS conflict leaves content unchanged, and asserts that dish names are absent from generated content. The local checkout used for this review has no `psql` executable; CI's PostgreSQL 17 service is the executable evidence path.

## Apply rules

Apply is restricted to a local Supabase database or an isolated test fixture with the migration installed, the same explicit ref binding as dry-run, and a service-role key in the trusted process environment. Preview and production are dry-run only; `--apply` is rejected for either environment before a client is created.

```powershell
node scripts/backfill-menu-translations.mjs `
  --apply `
  --environment local `
  --project-ref <local-ref> `
  --allow-project-ref <local-ref> `
  --locale en-CA
```

If a local binding cannot be proven, deliver the dry-run report and stop. Do not substitute the repository's Maison Élyse media ref, a Preview/Production ref, a fixture URL, or a Supabase project name.

## Audit result for PR #173 reprise

This branch does not claim a remote Preview/Production or local Supabase execution. Binding, read, RPC, and write validation remain operator-run prerequisites; use the dry-run commands above and retain their redacted reports as the evidence for any later local/test-fixture apply.
