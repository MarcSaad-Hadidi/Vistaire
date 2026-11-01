import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const database = process.env.PGDATABASE ?? "";
if (process.env.VISTAIRE_ADMIN_SCHEDULING_POSTGRES_TEST !== "1" && process.env.CI !== "true") {
  throw new Error("Refusing scheduling PostgreSQL tests outside CI; explicitly opt in for a dedicated ephemeral database.");
}
if (!/^[a-zA-Z0-9_]+$/.test(database) || !/(?:^|[_-])(?:test|ci)(?:$|[_-])/i.test(database)) {
  throw new Error("PGDATABASE must identify a dedicated test or CI database.");
}
if (!["127.0.0.1", "localhost", "::1"].includes(process.env.PGHOST ?? "") ||
    (process.env.PGHOSTADDR && !["127.0.0.1", "::1"].includes(process.env.PGHOSTADDR))) {
  throw new Error("Only an explicit local PostgreSQL host is allowed.");
}
if (process.env.PGSERVICE || process.env.PGSERVICEFILE) {
  throw new Error("A PostgreSQL service override is not allowed.");
}
const args = ["-X", "--no-psqlrc", "--set=ON_ERROR_STOP=1", "--quiet", "--tuples-only", "--no-align"];
function psql(extra) {
  const result = spawnSync("psql", [...args, ...extra], {
    cwd: root, env: process.env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, windowsHide: true
  });
  if (result.error) throw new Error(`Unable to execute psql: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`psql failed: ${(result.stderr || "unknown error").trim()}`);
  return result.stdout.trim();
}
const version = Number(psql(["--command", "select current_setting('server_version_num');"]));
if (version < 170000 || version >= 180000) throw new Error(`PostgreSQL 17 is required; found ${version}.`);
const count = Number(psql(["--command", "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','f');"]));
if (count !== 0) throw new Error("Refusing a nonempty public schema; use a new dedicated database.");
console.log(psql(["--file", path.join(root, "supabase/tests/admin_dish_scheduling.sql")]));
