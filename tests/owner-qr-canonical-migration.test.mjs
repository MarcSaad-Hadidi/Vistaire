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

function extractLastFunction(name) {
  const matches = [
    ...sql.matchAll(
      new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\([\\s\\S]*?\\$\\$\\s*;`,
        "gi"
      )
    )
  ];
  return matches.at(-1)?.[0] ?? "";
}

test("canonical migration is additive, transactional, and never backfills history", () => {
  assert.notEqual(migration, "", `Missing migration: ${migrationPath}`);
  assert.match(normalizedSql, /^begin;/);
  assert.match(normalizedSql, /commit;$/);
  for (const column of [
    "purpose_key text not null default 'default'",
    "is_canonical boolean not null default false",
    "token_ciphertext text",
    "token_nonce text",
    "token_key_version text",
    "supersedes_qr_code_id uuid",
    "rotated_at timestamptz"
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

test("canonical migration can be applied twice without DDL collisions", () => {
  assert.match(
    normalizedSql,
    /create table if not exists public\.qr_code_lifecycle_events/
  );

  for (const constraint of [
    "qr_codes_purpose_key_format_check",
    "qr_codes_config_version_check",
    "qr_codes_revoked_at_check"
  ]) {
    assert.match(
      normalizedSql,
      new RegExp(
        `drop constraint if exists ${constraint}; alter table public\\.qr_codes add constraint ${constraint}`
      )
    );
  }

  for (const index of [
    "qr_code_lifecycle_events_qr_code_id_idx",
    "qr_code_lifecycle_events_restaurant_id_idx",
    "qr_code_lifecycle_events_successor_qr_code_id_idx"
  ]) {
    assert.match(
      normalizedSql,
      new RegExp(`create index if not exists ${index}`)
    );
  }
});

test("legacy rows stay non-canonical and historical duplicates remain legal", () => {
  const schemaSql = normalizedSql.split(
    "create or replace function public.owner_get_or_create_canonical_qr"
  )[0];

  assert.match(
    schemaSql,
    /add column if not exists purpose_key text not null default 'default'/
  );
  assert.match(
    schemaSql,
    /add column if not exists is_canonical boolean not null default false/
  );
  assert.doesNotMatch(schemaSql, /\bupdate\s+public\.qr_codes\b/);

  const canonicalIndex = schemaSql.match(
    /create unique index if not exists qr_codes_canonical_slot_key[\s\S]*?;/
  )?.[0];
  assert.ok(canonicalIndex);
  assert.match(canonicalIndex, /where is_canonical = true/);
  assert.doesNotMatch(
    canonicalIndex,
    /where\s+(?:is_canonical\s*=\s*false|purpose_key\s*=\s*'default')/
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
    /add constraint qr_codes_canonical_slot_complete_check check \( not is_canonical or \( restaurant_id is not null and purpose_key is not null and status not in \('archived', 'revoked'\) \) \)/
  );
  assert.match(
    normalizedSql,
    /validate constraint qr_codes_canonical_slot_complete_check/
  );
});

test("revoked history is analyzed but never rewritten", () => {
  const schemaSql = normalizedSql.split(
    "create or replace function public.owner_get_or_create_canonical_qr"
  )[0];

  assert.match(
    schemaSql,
    /if exists \( select 1 from public\.qr_codes where status = 'revoked' and is_canonical = true \) then raise exception/
  );
  assert.doesNotMatch(
    schemaSql,
    /update\s+public\.qr_codes[\s\S]*status\s*=/
  );
});

test("vault envelope is either entirely null or entirely complete", () => {
  assert.match(
    normalizedSql,
    /add column if not exists token_key_version text/
  );
  assert.doesNotMatch(
    normalizedSql,
    /add column if not exists token_key_version smallint/
  );
  assert.match(
    normalizedSql,
    /add constraint qr_codes_token_envelope_all_or_none_check check \( \( token_ciphertext is null and token_nonce is null and token_key_version is null \) or \( token_ciphertext is not null and pg_catalog\.btrim\(token_ciphertext\) <> '' and token_nonce is not null and pg_catalog\.btrim\(token_nonce\) <> '' and token_key_version is not null and pg_catalog\.btrim\(token_key_version\) <> '' \) \)/
  );
  assert.match(
    normalizedSql,
    /validate constraint qr_codes_token_envelope_all_or_none_check/
  );
});

test("canonical RPCs are locked down to the service role", () => {
  assert.match(
    normalizedSql,
    /alter table public\.qr_codes enable row level security/
  );
  assert.match(
    normalizedSql,
    /revoke all on table public\.qr_codes from public, anon, authenticated/
  );
  assert.match(
    normalizedSql,
    /grant select, insert, update, delete on table public\.qr_codes to service_role/
  );

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

test("metadata resolution validates coherent metadata before incrementing", () => {
  const fn = extractFunction("resolve_qr_code_scan_metadata");
  const normalized = fn.replace(/\s+/g, " ").toLowerCase();

  assert.notEqual(fn, "", "canonical migration must harden the metadata resolver");
  assert.equal(
    (normalized.match(/\bupdate public\.qr_codes\b/g) ?? []).length,
    1
  );
  assert.match(
    normalized,
    /where qr\.token_hash = p_token_hash and qr\.status = 'active' and \( \( qr\.target_kind = 'menu' and \( qr\.target_path = '\/demo' or qr\.target_path like '\/menu\/%' \) \) or \( qr\.target_kind = 'admin' and qr\.restaurant_id is not null and qr\.target_path = '\/admin' \) \) returning/
  );
  assert.match(
    normalizedSql,
    /revoke execute on function public\.resolve_qr_code_scan_metadata\(text\) from public, anon, authenticated/
  );
  assert.match(
    normalizedSql,
    /grant execute on function public\.resolve_qr_code_scan_metadata\(text\) to service_role/
  );
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

test("rotation records lineage and time while preserving old secrets and status", () => {
  const fn = extractFunction("owner_rotate_canonical_qr");
  const normalized = fn.replace(/\s+/g, " ").toLowerCase();

  assert.match(normalized, /if p_confirm is distinct from true then/);
  assert.match(
    normalized,
    /update public\.qr_codes as qr set is_canonical = false, rotated_at = pg_catalog\.now\(\) where qr\.id = p_previous_id and qr\.restaurant_id = p_restaurant_id and qr\.target_kind = v_target_kind and qr\.purpose_key = v_purpose_key and qr\.is_canonical = true/
  );
  const oldUpdate = normalized.match(
    /update public\.qr_codes as qr set[\s\S]*?where qr\.id = p_previous_id/
  )?.[0];
  assert.ok(oldUpdate);
  assert.doesNotMatch(
    oldUpdate,
    /\b(?:status|token_hash|token_preview|token_ciphertext|token_nonce|token_key_version|scan_count|last_scanned_at|style_json|target_kind|target_path|created_at|updated_at|supersedes_qr_code_id)\s*=/
  );
  assert.match(
    normalized,
    /insert into public\.qr_codes[\s\S]*'active'[\s\S]*true/
  );
  assert.match(
    normalized,
    /values \( p_new_id, p_restaurant_id, v_previous\.label, v_target_kind, v_purpose_key, v_previous\.target_path, p_token_hash, p_token_preview, p_token_ciphertext, p_token_nonce, p_token_key_version, v_previous\.style_json, 'active', true, p_previous_id \)/
  );
  assert.match(
    normalized,
    /status, is_canonical, supersedes_qr_code_id \) values/
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

test("rotation replay fails closed after its successor stops being the current canonical", () => {
  const fn = extractLastFunction("owner_rotate_canonical_qr");
  const normalized = fn.replace(/\s+/g, " ").toLowerCase();

  assert.match(
    normalized,
    /if found then[\s\S]*select qr\.\* into v_current from public\.qr_codes as qr where qr\.id = v_event\.successor_qr_code_id[\s\S]*qr\.is_canonical = true[\s\S]*qr\.status = 'active'[\s\S]*qr\.config_version = v_event\.new_config_version[\s\S]*for update/
  );
  assert.match(
    normalized,
    /if not found then raise exception using errcode = '40001', message = 'qr rotation replay is no longer the current canonical result'/
  );
  assert.doesNotMatch(
    normalized,
    /return query select 'canonical', false, v_event\.successor_qr_code_id, 'active', true/
  );
});

test("lifecycle replay reconstructs the immutable event result", () => {
  const fn = extractFunction("owner_set_canonical_qr_lifecycle");
  const normalized = fn.replace(/\s+/g, " ").toLowerCase();

  assert.match(
    normalized,
    /return query select 'idempotent', v_event\.qr_code_id, v_event\.new_status, v_event\.new_status in \('active', 'paused'\), case when v_event\.new_status = 'revoked' then v_event\.occurred_at else null end, v_event\.new_config_version/
  );
  const replayBranch = normalized.match(
    /if found then[\s\S]*?return; end if;/
  )?.[0] ?? "";
  assert.notEqual(replayBranch, "");
  assert.doesNotMatch(
    replayBranch,
    /select qr\.\* into v_current from public\.qr_codes/
  );
});

test("archive replay reconstructs a non-canonical immutable clear result", () => {
  const fn = extractFunction("owner_clear_canonical_qr");
  const normalized = fn.replace(/\s+/g, " ").toLowerCase();

  assert.match(
    normalized,
    /return query select 'idempotent', v_event\.qr_code_id, v_event\.new_status, false, case when v_event\.new_status = 'revoked' then v_event\.occurred_at else null end, v_event\.new_config_version/
  );
  const replayBranch = normalized.match(
    /if found then[\s\S]*?return; end if;/
  )?.[0] ?? "";
  assert.notEqual(replayBranch, "");
  assert.doesNotMatch(
    replayBranch,
    /select qr\.\* into v_current from public\.qr_codes/
  );
});

test("canonical-only rotation preserves updated_at despite the legacy trigger", () => {
  assert.match(
    normalizedSql,
    /if \( pg_catalog\.to_jsonb\(new\) - array\['is_canonical', 'rotated_at', 'updated_at'\] \) is not distinct from \( pg_catalog\.to_jsonb\(old\) - array\['is_canonical', 'rotated_at', 'updated_at'\] \) then new\.updated_at = old\.updated_at; else new\.updated_at = pg_catalog\.now\(\); end if/
  );
});
