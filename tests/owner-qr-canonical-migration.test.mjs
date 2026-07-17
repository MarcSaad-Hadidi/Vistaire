import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260717120000_owner_qr_canonical_lifecycle.sql";
const migration = await readFile(migrationPath, "utf8").catch(() => "");
const sql = migration
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const normalizedSql = sql.replace(/\s+/g, " ").trim().toLowerCase();

function extractFunction(name) {
  return (
    sql.match(
      new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\([\\s\\S]*?\\$\\$\\s*;`,
        "i"
      )
    )?.[0] ?? ""
  );
}

test("canonical migration is additive, transactional, and never backfills history", () => {
  assert.notEqual(migration, "", `Missing migration: ${migrationPath}`);
  assert.match(normalizedSql, /^begin;/);
  assert.match(normalizedSql, /commit;$/);
  for (const column of [
    "purpose_key text",
    "is_canonical boolean not null default false",
    "token_ciphertext text",
    "token_nonce text",
    "token_key_version text"
  ]) {
    assert.match(
      normalizedSql,
      new RegExp(
        `alter table public\\.qr_codes add column if not exists ${column.replace(
          / /g,
          "\\s+"
        )}`
      )
    );
  }
  const schemaSql = normalizedSql.split(
    "create or replace function public.owner_get_or_create_canonical_qr"
  )[0];
  assert.doesNotMatch(
    schemaSql,
    /\b(?:delete|update|truncate)\s+(?:from\s+)?public\.qr_codes\b/
  );
  assert.doesNotMatch(
    normalizedSql,
    /\bdrop\s+(?:table|column)\b/
  );
});

test("canonical slot authority is status-independent and purpose is normalized", () => {
  assert.match(
    normalizedSql,
    /create unique index if not exists qr_codes_canonical_slot_key on public\.qr_codes \(restaurant_id, target_kind, purpose_key\) where is_canonical = true/
  );
  const index = normalizedSql.match(
    /create unique index if not exists qr_codes_canonical_slot_key[\s\S]*?;/
  )?.[0];
  assert.ok(index);
  assert.doesNotMatch(index, /\bstatus\b/);
  assert.match(
    normalizedSql,
    /purpose_key is null or \( purpose_key = pg_catalog\.lower\(pg_catalog\.btrim\(purpose_key\)\) and purpose_key <> '' \)/
  );
  assert.match(
    normalizedSql,
    /add constraint qr_codes_canonical_slot_complete_check check \( not is_canonical or \(restaurant_id is not null and purpose_key is not null\) \)/
  );
  assert.match(
    normalizedSql,
    /validate constraint qr_codes_canonical_slot_complete_check/
  );
});

test("vault envelope is either entirely null or entirely complete", () => {
  assert.match(
    normalizedSql,
    /add constraint qr_codes_token_envelope_all_or_none_check check \( \( token_ciphertext is null and token_nonce is null and token_key_version is null \) or \( token_ciphertext is not null and token_nonce is not null and token_key_version is not null \) \)/
  );
  assert.match(
    normalizedSql,
    /validate constraint qr_codes_token_envelope_all_or_none_check/
  );
});

test("canonical RPCs are locked down to the service role", () => {
  for (const name of [
    "owner_get_or_create_canonical_qr",
    "owner_rotate_canonical_qr"
  ]) {
    const fn = extractFunction(name);
    assert.notEqual(fn, "", `${name} must be declared`);
    assert.match(
      fn.replace(/\s+/g, " ").toLowerCase(),
      /security definer set search_path = ''/
    );
    assert.match(
      normalizedSql,
      new RegExp(
        `revoke execute on function public\\.${name}\\([^;]+\\) from public, anon, authenticated`
      )
    );
    assert.match(
      normalizedSql,
      new RegExp(
        `grant execute on function public\\.${name}\\([^;]+\\) to service_role`
      )
    );
  }
});

test("both RPCs serialize the same normalized canonical slot", () => {
  const getOrCreate = extractFunction("owner_get_or_create_canonical_qr")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const rotate = extractFunction("owner_rotate_canonical_qr")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const lock =
    /perform pg_catalog\.pg_advisory_xact_lock\( pg_catalog\.hashtextextended\( p_restaurant_id::text \|\| ':' \|\| v_target_kind \|\| ':' \|\| v_purpose_key, 0 \) \)/;

  assert.match(getOrCreate, lock);
  assert.match(rotate, lock);
  assert.doesNotMatch(
    normalizedSql,
    /pg_catalog\.coalesce/,
    "COALESCE is SQL syntax and cannot be schema-qualified"
  );
});

test("get-or-create rereads under lock and never overwrites a winner", () => {
  const fn = extractFunction("owner_get_or_create_canonical_qr");
  const normalized = fn.replace(/\s+/g, " ").toLowerCase();

  assert.match(
    normalized,
    /as \$\$ #variable_conflict use_column declare/,
    "ON CONFLICT inference columns must not conflict with RETURNS TABLE variables"
  );
  assert.match(normalized, /perform pg_catalog\.pg_advisory_xact_lock/);
  assert.match(
    normalized,
    /insert into public\.qr_codes[\s\S]*on conflict \(restaurant_id, target_kind, purpose_key\) where is_canonical = true do nothing/
  );
  assert.match(normalized, /if v_inserted_count = 0 then[\s\S]*from public\.qr_codes/);
  assert.doesNotMatch(normalized, /\bdo update\b|\bupsert\b/);
  assert.match(normalized, /canonical-unrecoverable/);
  assert.match(
    normalized,
    /pg_catalog\.btrim\(v_current\.token_ciphertext\) = ''/
  );
  assert.match(
    normalized,
    /p_token_ciphertext is null or p_token_nonce is null or p_token_key_version is null/
  );
  assert.match(
    normalized,
    /if v_target_kind is null or v_target_kind not in \('menu', 'admin'\) then/
  );
});

test("rotation requires confirmation and mutates only the old canonical flag", () => {
  const fn = extractFunction("owner_rotate_canonical_qr");
  const normalized = fn.replace(/\s+/g, " ").toLowerCase();

  assert.match(normalized, /if p_confirm is distinct from true then/);
  assert.match(
    normalized,
    /update public\.qr_codes as qr set is_canonical = false where qr\.id = p_previous_id and qr\.restaurant_id = p_restaurant_id and qr\.target_kind = v_target_kind and qr\.purpose_key = v_purpose_key and qr\.is_canonical = true/
  );
  const oldUpdate = normalized.match(
    /update public\.qr_codes as qr set[\s\S]*?where qr\.id = p_previous_id/
  )?.[0];
  assert.ok(oldUpdate);
  assert.doesNotMatch(
    oldUpdate,
    /\b(?:status|token_hash|token_preview|token_ciphertext|token_nonce|token_key_version|scan_count|last_scanned_at|style_json|target_kind|target_path|created_at|updated_at)\s*=/
  );
  assert.match(
    normalized,
    /insert into public\.qr_codes[\s\S]*'active'[\s\S]*true/
  );
  assert.match(
    normalized,
    /values \( p_new_id, p_restaurant_id, v_previous\.label, v_target_kind, v_purpose_key, v_previous\.target_path, p_token_hash, p_token_preview, p_token_ciphertext, p_token_nonce, p_token_key_version, v_previous\.style_json, 'active', true \)/
  );
  assert.match(
    normalized,
    /return query select 'previous', false, v_previous\.id[\s\S]*return query select 'canonical', true, v_current\.id/
  );
  assert.doesNotMatch(
    normalized,
    /values \( p_new_id, p_restaurant_id, (?:pg_catalog\.btrim\()?p_label/
  );
  assert.doesNotMatch(normalized, /\bdo update\b|\bupsert\b/);
});

test("canonical-only rotation preserves updated_at despite the legacy trigger", () => {
  assert.match(
    normalizedSql,
    /if \( pg_catalog\.to_jsonb\(new\) - array\['is_canonical', 'updated_at'\] \) is not distinct from \( pg_catalog\.to_jsonb\(old\) - array\['is_canonical', 'updated_at'\] \) then new\.updated_at = old\.updated_at; else new\.updated_at = pg_catalog\.now\(\); end if/
  );
});
