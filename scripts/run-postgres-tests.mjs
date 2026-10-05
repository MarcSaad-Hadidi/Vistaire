import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const suites = {
  qr: {
    flag: "VISTAIRE_QR_POSTGRES_TEST",
    refusal: "Refusing to initialize PostgreSQL outside CI: set VISTAIRE_QR_POSTGRES_TEST=1 for a dedicated ephemeral test database.",
    compact: true,
    files: [
      "tests/postgres/qr-lifecycle/run.sql",
      "supabase/migrations/20260717120000_owner_qr_canonical_lifecycle.sql",
      "supabase/migrations/20260805090000_enforce_public_qr_permanence.sql"
    ],
    success: "QR PostgreSQL 17 migration, history, security, RPC, rotation, and concurrency checks passed."
  },
  "maison-elyse": {
    flag: "VISTAIRE_MAISON_ELYSE_POSTGRES_TEST",
    refusal: "Refusing to initialize PostgreSQL outside CI: set VISTAIRE_MAISON_ELYSE_POSTGRES_TEST=1 for a dedicated ephemeral test database.",
    compact: true,
    files: [
      "tests/postgres/qr-lifecycle/bootstrap.sql",
      "supabase/migrations/0007_restaurants.sql",
      "tests/postgres/maison-elyse-media/run.sql",
      "supabase/migrations/20260722062916_maison_elyse_media_backfill_rpc.sql"
    ],
    success: "Maison Elyse media PostgreSQL 17 migration, security, atomicity, CAS, and concurrency checks passed."
  },
  "unique-menu-design": {
    flag: "VISTAIRE_UNIQUE_MENU_POSTGRES_TEST",
    refusal: "Refusing to initialize PostgreSQL outside CI: set VISTAIRE_UNIQUE_MENU_POSTGRES_TEST=1 for a dedicated ephemeral test database.",
    compact: true,
    files: [
      "tests/postgres/qr-lifecycle/bootstrap.sql",
      "supabase/migrations/0007_restaurants.sql",
      "tests/postgres/unique-menu-design/schema-catchup.sql",
      "supabase/migrations/0013_create_owner_restaurant_with_menu.sql",
      "supabase/migrations/0008_menu_ui_configs.sql",
      "supabase/migrations/20260701031742_menu_settings_and_rpc.sql",
      "supabase/migrations/20260723120000_allergen_declarations_safety.sql",
      "supabase/migrations/20260724090000_unique_menu_design_atomicity.sql",
      "tests/postgres/unique-menu-design/run.sql"
    ],
    success: "Unique menu design PostgreSQL 17 creation, isolation, lifecycle, and rollback checks passed."
  },
  "translation-backfill": {
    flag: "VISTAIRE_TRANSLATION_BACKFILL_POSTGRES_TEST",
    refusal: "Refusing PostgreSQL backfill tests outside CI: set VISTAIRE_TRANSLATION_BACKFILL_POSTGRES_TEST=1 for an ephemeral test database.",
    files: ["tests/postgres/translation-backfill-run.sql"],
    success: "Translation backfill PostgreSQL 17 checks passed."
  },
  "media-capacity": {
    flag: "VISTAIRE_MEDIA_CAPACITY_POSTGRES_TEST",
    refusal: "Refusing PostgreSQL capacity tests outside CI: set VISTAIRE_MEDIA_CAPACITY_POSTGRES_TEST=1 for a dedicated ephemeral test database.",
    files: ["tests/postgres/media-capacity/run.sql"],
    success: "Media capacity PostgreSQL concurrency and security checks passed."
  }
};

const suite = suites[process.argv[2]];
if (!suite) throw new Error("Unknown PostgreSQL test suite: " + process.argv[2]);
if (process.env[suite.flag] !== "1" && process.env.CI !== "true") throw new Error(suite.refusal);
if (!/(?:^|[_-])(?:test|ci)(?:$|[_-])/i.test(process.env.PGDATABASE ?? "")) {
  throw new Error("PGDATABASE must clearly identify a dedicated test or CI database.");
}

function psql(args) {
  const commonArgs = ["-X", "--no-psqlrc", "--set=ON_ERROR_STOP=1", "--quiet"];
  if (suite.compact || args.includes("--command")) commonArgs.push("--tuples-only", "--no-align");
  const result = spawnSync("psql", [...commonArgs, ...args], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error) throw new Error("Unable to execute psql: " + result.error.message);
  if (result.status !== 0) throw new Error("psql failed: " + (result.stderr || "unknown PostgreSQL error").trim());
  return result.stdout.trim();
}

const serverVersion = Number(psql(["--command", "select current_setting('server_version_num');"]));
if (serverVersion < 170000 || serverVersion >= 180000 || !Number.isFinite(serverVersion)) {
  throw new Error("PostgreSQL 17 is required; server_version_num=" +
    (suite.compact ? serverVersion : serverVersion || "unknown") + ".");
}

let output = "";
for (const file of suite.files) output = psql(["--file", path.join(root, file)]);
console.log(suite.compact ? suite.success : output || suite.success);
