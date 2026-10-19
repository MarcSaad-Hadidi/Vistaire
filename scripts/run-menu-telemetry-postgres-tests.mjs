import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = process.env;
if (env.CI !== "true" && env.VISTAIRE_MENU_TELEMETRY_POSTGRES_TEST !== "1") throw new Error("Explicit telemetry test opt-in or CI=true required.");
if (!/^[a-zA-Z0-9_]+$/.test(env.PGDATABASE ?? "")) throw new Error("PGDATABASE must be a plain database name, never a connection string.");
if (!/(?:^|[_-])(?:test|ci)(?:$|[_-])/i.test(env.PGDATABASE ?? "")) throw new Error("PGDATABASE must identify a dedicated test/CI database.");
if (env.PGSERVICE || env.PGSERVICEFILE) throw new Error("PostgreSQL service overrides are forbidden.");
for (const key of ["PGHOST", "PGHOSTADDR"]) {
  if (env[key] && !["localhost", "127.0.0.1", "::1"].includes(env[key])) throw new Error(`${key} must be local.`);
}
if (!env.PGHOST) throw new Error("Set PGHOST explicitly to localhost for this ephemeral test.");
const args = ["-X", "--no-psqlrc", "--set=ON_ERROR_STOP=1", "--quiet", "--tuples-only", "--no-align"];
function run(input) {
  const result = spawnSync("psql", args, { input, cwd: root, env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (result.error) throw new Error(`Unable to execute psql: ${result.error.message}`);
  return result;
}
const preflight = run("select current_setting('server_version_num'); select count(*) from information_schema.tables where table_schema='public';");
if (preflight.status !== 0) throw new Error(preflight.stderr);
const [version, tables] = preflight.stdout.trim().split(/\s+/).map(Number);
if (version < 170000 || version >= 180000 || tables !== 0) throw new Error("Requires empty local PostgreSQL17 database; never point this runner at an existing project.");
const migration = readFileSync(new URL("../supabase/migrations/20261019050917_menu_telemetry_v2_preserve_history.sql", import.meta.url), "utf8");
// Run every statement, including trailing comments/DDL, inside the fixture's
// rollback-only transaction. Remove only the migration's outer transaction.
if (!/^\s*begin;[\s\S]*commit;\s*$/i.test(migration)) throw new Error("Migration must have one outer BEGIN/COMMIT wrapper.");
const body = migration.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, "");
const fixture = readFileSync(new URL("../supabase/tests/menu_telemetry_v2.sql", import.meta.url), "utf8");
const marker = "-- TELEMETRY_MIGRATION_BODY";
if (fixture.split(marker).length !== 2) throw new Error("Missing unique migration fixture marker.");
const result = run(fixture.replace(marker, () => body));
if (result.status !== 0) throw new Error(`Telemetry PostgreSQL contracts failed: ${result.stderr}`);
console.log("PASS: complete migration, deduplication, privacy, environment, v2 identity, rate limit and preservation of all historical rows without expiry or purge.");
