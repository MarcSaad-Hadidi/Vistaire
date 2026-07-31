# Menu translation data backfill

This runbook covers the controlled data-only backfill for Maison Élyse, Trouvable, and Sauge Noire. The tool is `scripts/backfill-menu-translations.mjs`. It reads the relational menu by the exact restaurant slug, uses the primary non-archived menu relation, and writes only the three translation tables plus the guarded Maison Élyse `menus.settings_json` locale contract when needed.

## Verified environment inventory for this checkout

The read-only audit used the trusted local `.env.local` binding for project ref `bkpewsjvxswqruwqljcy`. It performed no writes. The Vercel Preview and Production bindings remain unproven and must not be inferred from the local ref.

| Environment | Supabase project ref | Binding evidence | Safe disposition |
| --- | --- | --- | --- |
| Vercel Preview | Unknown / unverified | Deployment metadata and the public payload do not expose the bound Supabase ref | Refused until the preview ref is supplied and explicitly allowed |
| Vercel Production | Unknown / unverified | No production environment binding was exposed to this audit | Refused until Vercel production binding and ref are proven |
| Local app | `bkpewsjvxswqruwqljcy` | URL hostname parsed to the same ref; service-role value was read only in the trusted process | Read-only dry-run completed; apply not run |
| Local tests | Fixture-only | E2E support starts a localhost Sauge fixture and uses a synthetic service-role value; it is not a Supabase project | Never use for apply |

The known Maison Élyse identifiers in repository-owned media policy are not used as implicit authorization. The script always requires `--project-ref` and a matching `--allow-project-ref`.

## What the script guarantees

- Dry-run is the default; `--apply` is mandatory for writes.
- The resolved Supabase hostname ref must match `--project-ref` and the explicit `--allow-project-ref` allowlist.
- Production apply additionally requires `--authorize-production`, `--production-binding <same-ref>`, `VERCEL_ENV=production`, and `VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF=<same-ref>`.
- Restaurant identity is selected by exact `slug`; menus, categories, dishes, and translation rows are constrained by their real foreign-key relations.
- `source_hash` and `field_hashes` use the production SHA-256 helpers from `lib/translation/menuTranslationModel.ts`.
- Existing `manual_overrides` and their content are preserved. An empty manual override is an error.
- Maison Élyse requires `fr-CA` as the default/source locale and a complete canonical `en-CA` content set for every real source field. A source divergence or incomplete field blocks apply.
- Trouvable receives an explicit English `content.name` for all 9 category slugs and all 36 production dish slugs. A missing or extra real slug makes the complete plan fail closed; the five-item demo fixture is not sufficient. Sauge Noire follows the same rule through its canonical dataset. Placeholder names are rejected, and incomplete content remains non-ready; complete content receives `up_to_date` with recalculated hashes.
- Maison Élyse plans a guarded `menus.settings_json` patch when needed: it preserves existing keys, sets `defaultLocale` to `fr-CA`, and adds `fr-CA`/`en-CA` to `supportedLocales`. Apply rereads and hashes the row before updating so concurrent settings changes refuse the write.
- The report includes environment/ref identity, restaurant/menu IDs and slugs, category/dish counts, per-table translation row counts, operation diffs, statuses, current/desired `source_hash` and `field_hashes`, explicit hash divergences, and settings hashes. Secrets are never printed. Planning errors are collected per target before the command refuses the run.

## Read-only commands

Run from the repository root with environment variables injected by the trusted operator shell. Do not paste service-role values into command history or reports.

```powershell
node scripts/backfill-menu-translations.mjs `
  --environment preview `
  --project-ref <preview-ref> `
  --allow-project-ref <preview-ref> `
  --restaurant maison-elyse `
  --report .tmp-menu-translation-preview.json
```

Repeat with `--environment production` only after independently confirming the production deployment's `NEXT_PUBLIC_SUPABASE_URL` and `VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF`. Preview and production refs must be compared and must not be assumed identical.

For a local dedicated Supabase project, use its actual ref and mark it explicitly:

```powershell
node scripts/backfill-menu-translations.mjs `
  --environment local `
  --project-ref <local-ref> `
  --allow-project-ref <local-ref>
```

The default target set is all three restaurants. Use `--restaurant trouvable` or `--restaurant sauge-noire` for a focused audit. Use `--locale en-CA` unless the operator has a separately reviewed locale contract.

Apply never uses direct table upserts. The migration `20260731100000_menu_translation_backfill_rpc.sql` locks all target menus in deterministic order, compares `updated_at`, hashes, content, and manual overrides, and rolls back the complete batch on any conflict or database error. If that RPC is not installed in the explicitly bound project, `--apply` refuses to write.

## Apply rules

Preview/local apply requires the same explicit ref binding as dry-run, the transactional migration installed in that project, and the service-role key in the trusted process environment. Production requires all of the following:

```powershell
$env:VERCEL_ENV = "production"
$env:VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF = "<production-ref>"
node scripts/backfill-menu-translations.mjs `
  --apply `
  --environment production `
  --project-ref <production-ref> `
  --allow-project-ref <production-ref> `
  --authorize-production `
  --production-binding <production-ref>
```

If a trusted Vercel binding cannot be proven, deliver the dry-run report and stop. Do not substitute the repository's Maison Élyse media ref, a Preview ref, a fixture URL, or a Supabase project name.

## Audit result for PR #173 reprise

The preview serves the same restaurant/menu record IDs for all three slugs, but the Supabase project ref remains unexposed and the preview/production bindings are therefore not treated as proven.

The executed local dry-run resolved project ref `bkpewsjvxswqruwqljcy` and completed successfully without writes. It reported Maison Élyse `4` categories / `12` dishes / `17` planned inserts plus the locale settings patch; Trouvable `9` / `36` with `44` updates; and Sauge Noire `7` / `36` with `43` updates. Preview/production data remains unverified and no apply was executed.
