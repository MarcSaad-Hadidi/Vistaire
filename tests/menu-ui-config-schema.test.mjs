import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const migrationPath = "supabase/migrations/0008_menu_ui_configs.sql";

test("menu_ui_configs migration creates locked-down draft and published config table", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /create table if not exists public\.menu_ui_configs/i);
  assert.match(sql, /id uuid primary key default gen_random_uuid\(\)/i);
  assert.match(sql, /restaurant_id uuid not null/i);
  assert.match(sql, /theme text not null default 'fresh-homemade'/i);
  assert.match(sql, /config_json jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /status text not null default 'draft'/i);
  assert.match(sql, /check \(status in \('draft', 'published', 'archived'\)\)/i);
  assert.match(sql, /menu_ui_configs_restaurant_id_idx/i);
  assert.match(sql, /where status = 'published'/i);
  assert.match(sql, /where status = 'draft'/i);
  assert.match(sql, /alter table public\.menu_ui_configs enable row level security/i);
  assert.match(sql, /revoke all on table public\.menu_ui_configs from anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.menu_ui_configs to service_role/i);
});

