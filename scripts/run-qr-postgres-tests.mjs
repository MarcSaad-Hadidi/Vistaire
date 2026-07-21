import { spawn, spawnSync } from "node:child_process";
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

function concurrentPsql(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [...commonArgs, "--command", statement], {
      cwd: root,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 1024 * 1024) child.kill();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > 1024 * 1024) child.kill();
    });
    child.once("error", (error) => reject(new Error(`Unable to execute psql: ${error.message}`)));
    child.once("exit", (code, signal) => {
      if (code === 0) return resolve(stdout.trim());
      reject(new Error(`Concurrent psql failed${signal ? ` (${signal})` : ""}: ${stderr.trim()}`));
    });
  });
}

const roleBootstrap = String.raw`
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'create role anon nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'create role service_role nologin bypassrls';
  end if;
end;
$$;
alter role service_role bypassrls;
`;

const snapshot = String.raw`
create schema qr_test;
create table qr_test.historical_before as
select id, to_jsonb(qr) as payload
from public.qr_codes as qr
where id::text like '10000000-%';
alter table qr_test.historical_before add primary key (id);
`;

const serverVersion = Number(sql("select current_setting('server_version_num');"));
if (serverVersion < 170000 || serverVersion >= 180000) {
  throw new Error(`PostgreSQL 17 is required; server_version_num=${serverVersion}.`);
}

sql(roleBootstrap);
migration("supabase/migrations/0001_qr_codes.sql");
migration("supabase/migrations/0002_qr_resolve_scan_rpc.sql");
migration("supabase/migrations/0007_restaurants.sql");
migration("tests/fixtures/qr-postgres-bootstrap.sql");
migration("supabase/migrations/20260709180000_admin_qr_access.sql");
sql(snapshot);
migration("supabase/migrations/20260717120000_owner_qr_canonical_lifecycle.sql");
// A second real psql application proves rerunnability without rewriting history.
migration("supabase/migrations/20260717120000_owner_qr_canonical_lifecycle.sql");
migration("tests/fixtures/qr-postgres-assertions.sql");

const denied = spawnSync(
  "psql",
  [...commonArgs, "--command", "set role anon; select * from public.resolve_qr_code_scan_metadata('legacy-menu-demo-hash');"],
  {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true
  }
);
if (denied.error) throw new Error(`Unable to execute psql: ${denied.error.message}`);
if (denied.status === 0 || !/permission denied/i.test(denied.stderr)) {
  throw new Error("anon unexpectedly executed the service-role-only QR resolver.");
}

const candidates = Array.from({ length: 20 }, (_, index) => {
  const ordinal = String(index + 1).padStart(12, "0");
  return {
    id: `50000000-0000-4000-8000-${ordinal}`,
    hash: `concurrent-candidate-${String(index + 1).padStart(2, "0")}-hash`
  };
});

const concurrentResults = await Promise.all(
  candidates.map(({ id, hash }) =>
    concurrentPsql(String.raw`
set role service_role;
select created::text || '|' || id::text
from public.owner_get_or_create_canonical_qr(
  '${id}',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'QR concurrent', 'admin', 'concurrent', '/admin',
  '${hash}', 'candidate', 'cipher-${id}', 'nonce-${id}', 'v1',
  '{"foregroundColor":"#616161"}'::jsonb
);
`)
  )
);

const parsed = concurrentResults.map((output) => {
  const line = output.split(/\r?\n/).map((item) => item.trim()).find((item) => /^(?:true|false)\|/i.test(item));
  if (!line) throw new Error(`Unexpected concurrent psql output: ${output}`);
  const [created, id] = line.split("|");
  return { created: created === "true", id };
});
const winnerIds = new Set(parsed.map((result) => result.id));
if (winnerIds.size !== 1 || parsed.filter((result) => result.created).length !== 1) {
  throw new Error("Concurrent canonical RPC calls did not converge on exactly one winner.");
}

const winnerId = [...winnerIds][0];
const loserIds = candidates.filter((candidate) => candidate.id !== winnerId).map((candidate) => `'${candidate.id}'`).join(",");
const databaseConcurrencyState = sql(String.raw`
select
  count(*) filter (where is_canonical)::text || '|' ||
  count(distinct id)::text || '|' ||
  count(*) filter (where id in (${loserIds}))::text
from public.qr_codes
where restaurant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  and target_kind = 'admin'
  and purpose_key = 'concurrent';
`);
if (databaseConcurrencyState !== "1|1|0") {
  throw new Error(`Unexpected concurrent canonical database state: ${databaseConcurrencyState}`);
}

console.log("QR PostgreSQL 17 migration, history, security, RPC, rotation, and concurrency checks passed.");
