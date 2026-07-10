import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

test("atomic availability RPC has narrow typed inputs and service-role-only execution", async () => {
  const names = await readdir("supabase/migrations");
  const name = names.find((candidate) => candidate.endsWith("_admin_dish_availability_rpc.sql"));
  assert.ok(name, "generated admin dish availability migration is required");
  const sql = await readFile(`supabase/migrations/${name}`, "utf8");

  assert.match(sql, /set_admin_dish_availability\s*\(\s*p_qr_id uuid,\s*p_restaurant_id uuid,\s*p_dish_id uuid,\s*p_available boolean\s*\)/is);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path\s*=\s*''/i);
  assert.match(sql, /public\.qr_codes/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /target_kind\s*=\s*'admin'/i);
  assert.match(sql, /status\s*=\s*'active'/i);
  assert.match(sql, /target_path/i);
  assert.match(sql, /public\.menus/i);
  assert.match(sql, /public\.menu_dishes/i);
  assert.match(sql, /restaurant_id\s*=\s*p_restaurant_id/i);
  assert.match(sql, /menu_id\s*=\s*v_menu_id/i);
  assert.match(sql, /returns table\s*\(\s*dish_id uuid,\s*dish_slug text,\s*is_available boolean,\s*updated_at timestamptz\s*\)/is);
  assert.match(sql, /revoke execute on function[^;]+from public, anon, authenticated/is);
  assert.match(sql, /grant execute on function[^;]+to service_role/is);
  assert.doesNotMatch(sql, /grant execute on function[^;]+to (?:anon|authenticated)/is);
  const setClause = sql.match(/update\s+public\.menu_dishes[\s\S]*?set([\s\S]*?)where/i)?.[1] ?? "";
  assert.match(setClause, /is_available\s*=\s*p_available/i);
  assert.match(setClause, /updated_at\s*=\s*now\(\)/i);
  assert.doesNotMatch(setClause, /(?:name|slug|price|description|restaurant_id|menu_id)\s*=/i);
});
