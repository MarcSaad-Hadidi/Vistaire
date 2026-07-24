import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260724120000_restore_legacy_public_menu_settings.sql",
    import.meta.url
  ),
  "utf8"
);

test("legacy public menu settings backfill is scoped and idempotent", () => {
  assert.match(migration, /menu\.is_primary is true/);
  assert.match(migration, /coalesce\(menu\.settings_json, '\{\}'::jsonb\) = '\{\}'::jsonb/);
  assert.match(migration, /jsonb_strip_nulls\(ui\.config_json -> 'publicMenuSettings'\)/);
  assert.match(migration, /ui\.status in \('published', 'draft'\)/);
  assert.match(migration, /case ui\.status when 'published' then 0 else 1 end/);
  assert.match(migration, /ui\.updated_at desc nulls last/);
  assert.match(migration, /source\.source_rank = 1/);
  assert.match(migration, /not modified|never published/i);
  assert.match(migration, /raise exception/);
});

test("backfill migration never touches uniqueDesign or publishes drafts", () => {
  assert.doesNotMatch(migration, /update public\.menu_ui_configs/i);
  assert.doesNotMatch(migration, /status\s*=\s*'published'/i);
  assert.match(migration, /not exists\s*\(\s*select 1[\s\S]*uniqueDesign/i);
  assert.doesNotMatch(migration, /uniqueDesign\s*=/i);
});
