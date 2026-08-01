import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const database = process.env.PGDATABASE ?? "";
if (process.env.VISTAIRE_TRANSLATION_BACKFILL_POSTGRES_TEST !== "1" && process.env.CI !== "true") {
  throw new Error("Refusing PostgreSQL backfill tests outside CI: set VISTAIRE_TRANSLATION_BACKFILL_POSTGRES_TEST=1 for an ephemeral test database.");
}
if (!/(?:^|[_-])(?:test|ci)(?:$|[_-])/i.test(database)) {
  throw new Error("PGDATABASE must clearly identify a dedicated test or CI database.");
}
const args = ["-X", "--no-psqlrc", "--set=ON_ERROR_STOP=1", "--quiet"];
const version = spawnSync("psql", [...args, "--tuples-only", "--no-align", "--command", "select current_setting('server_version_num');"], {
  cwd: root, env: process.env, encoding: "utf8", windowsHide: true
});
if (version.error) throw new Error(`Unable to execute psql: ${version.error.message}`);
const serverVersion = Number((version.stdout || "").trim());
if (serverVersion < 170000 || serverVersion >= 180000) throw new Error(`PostgreSQL 17 is required; server_version_num=${serverVersion || "unknown"}.`);
const result = spawnSync("psql", [...args, "--file", path.join(root, "tests/postgres/translation-backfill-run.sql")], {
  cwd: root, env: process.env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, windowsHide: true
});
if (result.error) throw new Error(`Unable to execute psql: ${result.error.message}`);
if (result.status !== 0) throw new Error(`psql failed: ${(result.stderr || "unknown PostgreSQL error").trim()}`);
console.log(result.stdout.trim() || "Translation backfill PostgreSQL 17 checks passed.");
