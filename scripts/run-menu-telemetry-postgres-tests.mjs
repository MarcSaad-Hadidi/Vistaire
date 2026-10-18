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
const preflight = run("select current_setting('server_version_num'); select count(*) from information_schema.tables where table_schema='public'; select count(*) from pg_extension where extname='pg_cron';");
if (preflight.status !== 0) throw new Error(preflight.stderr);
const [version, tables, cron] = preflight.stdout.trim().split(/\s+/).map(Number);
if (version < 170000 || version >= 180000 || tables !== 0 || cron !== 0) throw new Error("Requires empty local PostgreSQL17 database without pg_cron; never point this runner at an existing project.");
const migration = readFileSync(new URL("../supabase/migrations/20261018213000_menu_telemetry_v2.sql", import.meta.url), "utf8");
const missingCron = run(migration);
if (missingCron.status === 0 || !/requires pg_cron/.test(missingCron.stderr)) throw new Error("Full migration did not fail closed on its missing pg_cron prerequisite.");
// Do not fake pg_extension or schedule a job. Exercise the exact unchanged
// schema/function body after independently testing its prerequisite above.
const start = migration.indexOf("alter table public.analytics_events");
const end = migration.indexOf("select cron.schedule");
if (start < 0 || end <= start) throw new Error("Migration structure changed; review the integration-test boundaries.");
const fixture = readFileSync(new URL("../supabase/tests/menu_telemetry_v2.sql", import.meta.url), "utf8");
const marker = "-- TELEMETRY_MIGRATION_BODY";
if (fixture.split(marker).length !== 2) throw new Error("Missing unique migration fixture marker.");
const result = run(fixture.replace(marker, () => migration.slice(start, end)));
if (result.status !== 0) throw new Error(`Telemetry PostgreSQL contracts failed: ${result.stderr}`);
console.log("PASS: pg_cron fail-closed prerequisite, exact schema/functions, deduplication, privacy, environment, v2 identity, rate limit and expiry purge.");
console.log("UNTESTED: actual pg_cron job installation/execution. Verify this separately during approved deployment on a pg_cron-enabled project.");
