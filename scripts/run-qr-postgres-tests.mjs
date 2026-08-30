import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const database = process.env.PGDATABASE ?? "";

if (process.env.VISTAIRE_QR_POSTGRES_TEST !== "1" && process.env.CI !== "true") {
  throw new Error(
    "Refusing to initialize PostgreSQL outside CI: set VISTAIRE_QR_POSTGRES_TEST=1 for a dedicated ephemeral test database."
  );
}
if (!/(?:^|[_-])(?:test|ci)(?:$|[_-])/i.test(database)) {
  throw new Error("PGDATABASE must clearly identify a dedicated test or CI database.");
}

const commonArgs = [
  "-X",
  "--no-psqlrc",
  "--set=ON_ERROR_STOP=1",
  "--quiet",
  "--tuples-only",
  "--no-align"
];

function psql(args, options = {}) {
  const result = spawnSync("psql", [...commonArgs, ...args], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    ...options
  });
  if (result.error) {
    throw new Error(`Unable to execute psql: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`psql failed: ${(result.stderr || "unknown PostgreSQL error").trim()}`);
  }
  return result.stdout.trim();
}

function sql(statement) {
  return psql(["--command", statement]);
}

function migration(relativePath) {
  psql(["--file", path.join(root, relativePath)]);
}

const serverVersion = Number(sql("select current_setting('server_version_num');"));
if (serverVersion < 170000 || serverVersion >= 180000) {
  throw new Error(`PostgreSQL 17 is required; server_version_num=${serverVersion}.`);
}

migration("tests/postgres/qr-lifecycle/run.sql");
// Availability scheduling depends on the canonical QR/menu schema installed by
// the suite above. Apply the production migration, then exercise its real
// PostgreSQL lifecycle, isolation, concurrency, and DST contracts.
migration("supabase/migrations/20260811190000_admin_availability_schedule.sql");
migration("tests/postgres/admin-availability-scheduling/run.sql");
// The canonical suite installs the production migration once. A second real
// psql application here is a blocking proof that its complete DDL is rerunnable.
migration("supabase/migrations/20260717120000_owner_qr_canonical_lifecycle.sql");
// Re-apply the additive permanence boundary after the historical migration
// rerun so the final installed RPC definitions remain protected as well.
migration("supabase/migrations/20260805090000_enforce_public_qr_permanence.sql");

console.log("QR PostgreSQL 17 migration, history, security, RPC, rotation, and concurrency checks passed.");
