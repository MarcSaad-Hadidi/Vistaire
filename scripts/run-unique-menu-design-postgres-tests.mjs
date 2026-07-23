import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const database = process.env.PGDATABASE ?? "";

if (
  process.env.VISTAIRE_UNIQUE_MENU_POSTGRES_TEST !== "1" &&
  process.env.CI !== "true"
) {
  throw new Error(
    "Refusing to initialize PostgreSQL outside CI: set VISTAIRE_UNIQUE_MENU_POSTGRES_TEST=1 for a dedicated ephemeral test database."
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

function psql(args) {
  const result = spawnSync("psql", [...commonArgs, ...args], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error) throw new Error(`Unable to execute psql: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`psql failed: ${(result.stderr || "unknown PostgreSQL error").trim()}`);
  }
  return result.stdout.trim();
}

const serverVersion = Number(
  psql(["--command", "select current_setting('server_version_num');"])
);
if (serverVersion < 170000 || serverVersion >= 180000) {
  throw new Error(`PostgreSQL 17 is required; server_version_num=${serverVersion}.`);
}

psql(["--file", path.join(root, "tests/postgres/qr-lifecycle/bootstrap.sql")]);
psql(["--file", path.join(root, "supabase/migrations/0007_restaurants.sql")]);
psql(["--file", path.join(root, "supabase/migrations/0013_create_owner_restaurant_with_menu.sql")]);
psql(["--file", path.join(root, "supabase/migrations/0008_menu_ui_configs.sql")]);
psql([
  "--file",
  path.join(root, "supabase/migrations/20260701031742_menu_settings_and_rpc.sql")
]);
psql([
  "--file",
  path.join(root, "supabase/migrations/20260723120000_allergen_declarations_safety.sql")
]);
psql([
  "--file",
  path.join(root, "supabase/migrations/20260724090000_unique_menu_design_atomicity.sql")
]);
psql(["--file", path.join(root, "tests/postgres/unique-menu-design/run.sql")]);

console.log(
  "Unique menu design PostgreSQL 17 creation, isolation, lifecycle, and rollback checks passed."
);
