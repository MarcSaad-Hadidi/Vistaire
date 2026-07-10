import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260709180000_admin_qr_access.sql";
const migration = await readFile(migrationPath, "utf8").catch(() => "");
const sql = migration
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const normalizedSql = sql.replace(/\s+/g, " ").trim().toLowerCase();

function extractMetadataRpc() {
  return (
    sql.match(
      /create\s+or\s+replace\s+function\s+public\.resolve_qr_code_scan_metadata\s*\(\s*p_token_hash\s+text\s*\)[\s\S]*?\$\$\s*;/i
    )?.[0] ?? ""
  );
}

test("QR hardening migration is additive, guarded, and rerunnable", () => {
  assert.notEqual(migration, "", `Missing migration: ${migrationPath}`);
  assert.match(
    sql,
    /alter\s+table\s+public\.qr_codes\s+add\s+column\s+if\s+not\s+exists\s+target_kind\s+text/i
  );
  assert.match(normalizedSql, /^begin;/);
  assert.match(normalizedSql, /commit;$/);
  assert.match(
    sql,
    /create\s+or\s+replace\s+function\s+public\.resolve_qr_code_scan_metadata/i
  );
  assert.doesNotMatch(
    sql,
    /\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b|\bdrop\s+column\b/i
  );
});

test("QR hardening fails before backfill when a historical admin QR has no restaurant", () => {
  assert.match(
    normalizedSql,
    /if exists \( select 1 from public\.qr_codes where restaurant_id is null and \( target_kind = 'admin' or target_path = '\/admin' or target_path like '\/admin\/%' or target_path like '\/admin\?%' or target_path = '\/owner' or target_path like '\/owner\/%' or target_path like '\/owner\?%' \) \) then raise exception '[^']*admin[^']*restaurant_id[^']*'/
  );

  const preflight = normalizedSql.indexOf("raise exception");
  const firstBackfill = normalizedSql.indexOf("update public.qr_codes");
  assert.ok(preflight >= 0, "orphaned admin rows need a clear preflight exception");
  assert.ok(preflight < firstBackfill, "preflight must fail before any data update");
});

test("QR hardening fails before backfill when restaurant_id has no parent row", () => {
  assert.match(
    normalizedSql,
    /from public\.qr_codes as qr left join public\.restaurants as restaurant on restaurant\.id = qr\.restaurant_id where qr\.restaurant_id is not null and restaurant\.id is null/
  );
  assert.match(
    normalizedSql,
    /raise exception '[^']*restaurant_id[^']*public\.restaurants[^']*'/
  );

  const foreignKeyPreflight = normalizedSql.indexOf("left join public.restaurants");
  const firstBackfill = normalizedSql.indexOf("update public.qr_codes");
  assert.ok(foreignKeyPreflight >= 0);
  assert.ok(foreignKeyPreflight < firstBackfill);
});

test("QR hardening backfills kinds and canonicalizes every legacy admin route", () => {
  assert.match(
    normalizedSql,
    /update public\.qr_codes set target_kind = 'admin', target_path = '\/admin' where target_path = '\/admin' or target_path like '\/admin\/%' or target_path like '\/admin\?%' or target_path = '\/owner' or target_path like '\/owner\/%' or target_path like '\/owner\?%'/
  );
  assert.match(
    normalizedSql,
    /update public\.qr_codes set target_kind = 'menu' where target_kind is null and \( target_path = '\/demo' or target_path like '\/menu\/%' \)/
  );
});

test("QR hardening rejects unknown or kind-incoherent targets after explicit backfills", () => {
  assert.match(
    normalizedSql,
    /target_kind is null or target_kind not in \('menu', 'admin'\) or \(target_kind = 'admin' and target_path <> '\/admin'\) or \( target_kind = 'menu' and not \( target_path = '\/demo' or target_path like '\/menu\/%' \) \)/
  );
  assert.match(
    normalizedSql,
    /raise exception '[^']*target_kind[^']*target_path[^']*'/
  );

  const menuBackfill = normalizedSql.indexOf("update public.qr_codes set target_kind = 'menu'");
  const consistencyFailure = normalizedSql.indexOf("target_kind/target_path");
  assert.ok(menuBackfill >= 0);
  assert.ok(menuBackfill < consistencyFailure);
});

test("QR hardening preserves historical timestamps while running its backfills", () => {
  assert.match(
    normalizedSql,
    /from pg_trigger where tgrelid = 'public\.qr_codes'::regclass and tgname = 'qr_codes_set_updated_at'/
  );

  const disable = normalizedSql.indexOf(
    "alter table public.qr_codes disable trigger qr_codes_set_updated_at"
  );
  const adminBackfill = normalizedSql.indexOf("update public.qr_codes set target_kind = 'admin'");
  const menuBackfill = normalizedSql.indexOf("update public.qr_codes set target_kind = 'menu'");
  const enable = normalizedSql.indexOf(
    "alter table public.qr_codes enable trigger qr_codes_set_updated_at"
  );

  assert.ok(disable >= 0, "updated_at trigger must be disabled with a catalog guard");
  assert.ok(disable < adminBackfill, "disable must precede the admin backfill");
  assert.ok(adminBackfill < menuBackfill, "admin canonicalization must precede menu backfill");
  assert.ok(menuBackfill < enable, "trigger must be re-enabled after every backfill");
});

test("QR hardening makes target_kind required and restricts it to menu or admin", () => {
  assert.match(
    normalizedSql,
    /alter table public\.qr_codes alter column target_kind set not null/
  );
  assert.match(
    normalizedSql,
    /check \(target_kind in \('menu', 'admin'\)\)/
  );
});

test("QR hardening requires a restaurant for admin rows with a validated constraint", () => {
  assert.match(
    normalizedSql,
    /add constraint qr_codes_admin_restaurant_required_check check \(target_kind <> 'admin' or restaurant_id is not null\)/
  );
  assert.match(
    normalizedSql,
    /validate constraint qr_codes_admin_restaurant_required_check/
  );
  assert.match(normalizedSql, /validate constraint qr_codes_target_kind_values_check/);
  assert.match(
    normalizedSql,
    /add constraint qr_codes_admin_target_path_check check \(target_kind <> 'admin' or target_path = '\/admin'\)/
  );
  assert.match(normalizedSql, /validate constraint qr_codes_admin_target_path_check/);
  assert.match(
    normalizedSql,
    /add constraint qr_codes_menu_target_path_check check \( target_kind <> 'menu' or target_path = '\/demo' or target_path like '\/menu\/%' \)/
  );
  assert.match(normalizedSql, /validate constraint qr_codes_menu_target_path_check/);
  assert.match(
    normalizedSql,
    /add constraint qr_codes_restaurant_id_fkey foreign key \(restaurant_id\) references public\.restaurants \(id\) on delete cascade/
  );
  assert.match(normalizedSql, /validate constraint qr_codes_restaurant_id_fkey/);
  assert.doesNotMatch(sql, /\bnot\s+valid\b/i);
  assert.doesNotMatch(
    sql,
    /\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b|\bdrop\s+column\b/i
  );
});

test("QR hardening replaces every canonical constraint after all preflights", () => {
  const constraintNames = [
    "qr_codes_target_kind_values_check",
    "qr_codes_admin_restaurant_required_check",
    "qr_codes_admin_target_path_check",
    "qr_codes_menu_target_path_check",
    "qr_codes_restaurant_id_fkey"
  ];

  const firstDrop = normalizedSql.indexOf("drop constraint if exists");
  const lastPreflightFailure = normalizedSql.lastIndexOf("raise exception");
  assert.ok(lastPreflightFailure >= 0);
  assert.ok(lastPreflightFailure < firstDrop, "all invariant checks must precede constraint replacement");

  for (const constraintName of constraintNames) {
    const drop = normalizedSql.indexOf(`drop constraint if exists ${constraintName}`);
    const add = normalizedSql.indexOf(`add constraint ${constraintName}`);
    assert.ok(drop >= 0, `${constraintName} must be removed drift-safely`);
    assert.ok(drop < add, `${constraintName} must be recreated after removal`);
  }
});

test("QR hardening backfills do not mutate tokens, styles, state, counters, or dates", () => {
  const backfillSql = sql.split(
    /create\s+or\s+replace\s+function\s+public\.resolve_qr_code_scan_metadata/i
  )[0];
  const setClauses = [...backfillSql.matchAll(/update\s+public\.qr_codes\s+set\s+([\s\S]*?)\s+where\b/gi)]
    .map((match) => match[1]);

  assert.equal(setClauses.length, 2, "expected only the admin and menu backfills");
  for (const setClause of setClauses) {
    assert.doesNotMatch(
      setClause,
      /\b(?:token_hash|token_preview|style_json|status|scan_count|last_scanned_at|created_at|updated_at)\b/i
    );
  }
});

test("metadata scan RPC remains one atomic privileged update", () => {
  const rpc = extractMetadataRpc();
  const normalizedRpc = rpc.replace(/\s+/g, " ").trim().toLowerCase();

  assert.notEqual(rpc, "", "metadata resolver RPC must be redeclared");
  assert.equal(
    (normalizedRpc.match(/\bupdate public\.qr_codes\b/g) ?? []).length,
    1,
    "metadata resolution must use exactly one qr_codes UPDATE"
  );
  assert.match(
    normalizedRpc,
    /update public\.qr_codes as qr set scan_count = qr\.scan_count \+ 1, last_scanned_at = pg_catalog\.now\(\)[\s\S]*returning qr\.id as qr_id, qr\.restaurant_id, qr\.target_kind, qr\.target_path, qr\.status/
  );
  assert.match(normalizedRpc, /security definer set search_path = ''/);
  assert.match(
    normalizedSql,
    /revoke execute on function public\.resolve_qr_code_scan_metadata\(text\) from public, anon, authenticated/
  );
  assert.match(
    normalizedSql,
    /grant execute on function public\.resolve_qr_code_scan_metadata\(text\) to service_role/
  );
});
