import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const CANONICAL_SCHEMA_CONTRACT = "qr-lifecycle-candidate-v1";
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const PROJECT_REF_PATTERN = /^[a-z0-9]{8,64}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const REQUIRED_CANONICAL_COLUMNS = [
  "purpose_key",
  "is_canonical",
  "token_ciphertext",
  "token_nonce",
  "token_key_version",
  "supersedes_qr_code_id",
  "rotated_at",
  "revoked_at",
  "config_version"
];
const REQUIRED_CANONICAL_RPCS = [
  "owner_get_or_create_canonical_qr",
  "owner_rotate_canonical_qr",
  "owner_set_canonical_qr_lifecycle",
  "owner_clear_canonical_qr",
  "resolve_qr_code_scan_metadata"
];
const REQUIRED_LIFECYCLE_EVENT_COLUMNS = [
  "operation_id",
  "qr_code_id",
  "successor_qr_code_id",
  "action",
  "disposition",
  "previous_config_version",
  "new_config_version"
];
const RUNTIME_PUBLIC_ORIGIN_NAMES = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL"
];

function fail(message) {
  throw new Error(`[qr-environment-preflight] ${message}`);
}

function required(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) {
    fail(`${name} is required.`);
  }
  return value;
}

function parseOrigin(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${name} must be a valid HTTPS origin.`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    fail(`${name} must be an HTTPS origin without credentials, path, query, or fragment.`);
  }
  return url;
}

function resolveRuntimePublicOrigin(env) {
  const name = RUNTIME_PUBLIC_ORIGIN_NAMES.find((candidate) => env[candidate]);
  const raw = name ? env[name].trim() : "https://www.vistaire.ca";
  const value = /^[a-z][a-z\d+\-.]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${name ?? "Vistaire fallback"} does not resolve to a valid public origin.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    fail(`${name ?? "Vistaire fallback"} does not use HTTP(S).`);
  }
  return { name: name ?? "Vistaire fallback", origin: url.origin };
}

function validateOpaqueSecret(env, name, minimumBytes = 32) {
  const value = required(env, name);
  if (value !== value.trim() || Buffer.byteLength(value, "utf8") < minimumBytes) {
    fail(`${name} must contain at least ${minimumBytes} bytes and no surrounding whitespace.`);
  }
  return value;
}

function validateKeyRing(env) {
  const activeVersion = required(env, "VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION");
  const serialized = required(env, "VISTAIRE_QR_TOKEN_KEY_RING");
  if (!VERSION_PATTERN.test(activeVersion)) {
    fail("VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION has an invalid format.");
  }

  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    fail("VISTAIRE_QR_TOKEN_KEY_RING must be canonical JSON.");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.getPrototypeOf(parsed) !== Object.prototype ||
    JSON.stringify(parsed) !== serialized
  ) {
    fail("VISTAIRE_QR_TOKEN_KEY_RING must be a non-empty canonical single-line JSON object.");
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0 || !Object.hasOwn(parsed, activeVersion)) {
    fail("VISTAIRE_QR_TOKEN_KEY_RING must contain the active key version.");
  }
  for (const [version, encoded] of entries) {
    if (!VERSION_PATTERN.test(version) || typeof encoded !== "string" || !BASE64URL_PATTERN.test(encoded)) {
      fail("Every QR key-ring entry must have a valid version and canonical base64url value.");
    }
    const decoded = Buffer.from(encoded, "base64url");
    if (decoded.length !== 32 || decoded.toString("base64url") !== encoded) {
      fail("Every QR key-ring value must decode to exactly 32 bytes.");
    }
  }
  return entries.map(([, encoded]) => fingerprint(Buffer.from(encoded, "base64url")));
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fingerprintList(env, name) {
  const values = required(env, name).split(",").map((value) => value.trim().toLowerCase());
  if (values.some((value) => !/^[a-f0-9]{64}$/.test(value))) {
    fail(`${name} must contain comma-separated SHA-256 fingerprints.`);
  }
  return new Set(values);
}

function assertNoSharedFingerprint(current, other, label) {
  if (current.some((value) => other.has(value))) {
    fail(`Preview and Production must not share any ${label}.`);
  }
}

function validateSecretSeparation(env, values) {
  const otherServiceRole = fingerprintList(
    env,
    "VISTAIRE_QR_PREFLIGHT_OTHER_SERVICE_ROLE_FINGERPRINT"
  );
  const otherPeppers = fingerprintList(
    env,
    "VISTAIRE_QR_PREFLIGHT_OTHER_PEPPER_FINGERPRINTS"
  );
  const otherKeys = fingerprintList(
    env,
    "VISTAIRE_QR_PREFLIGHT_OTHER_KEY_FINGERPRINTS"
  );
  const otherAdminSession = fingerprintList(
    env,
    "VISTAIRE_QR_PREFLIGHT_OTHER_ADMIN_SESSION_FINGERPRINT"
  );

  const previousPeppers = [
    env.VISTAIRE_QR_TOKEN_PREVIOUS_SECRETS,
    env.VISTAIRE_QR_TOKEN_SECRET_PREVIOUS,
    env.VISTAIRE_QR_TOKEN_PREVIOUS_SECRET
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(/[\s,;]+/))
    .map((value) => value.trim())
    .filter(Boolean);

  assertNoSharedFingerprint(
    [fingerprint(values.serviceRole)],
    otherServiceRole,
    "Supabase service-role secret"
  );
  assertNoSharedFingerprint(
    [values.tokenSecret, ...previousPeppers].map((value) => fingerprint(value)),
    otherPeppers,
    "QR token pepper"
  );
  assertNoSharedFingerprint(values.keyFingerprints, otherKeys, "QR vault key");
  assertNoSharedFingerprint(
    [fingerprint(values.adminSessionSecret)],
    otherAdminSession,
    "admin-session secret"
  );
}

export function validateQrEnvironment(env = process.env) {
  const environment = required(env, "VISTAIRE_QR_PREFLIGHT_ENVIRONMENT");
  if (environment !== "preview" && environment !== "production") {
    fail("VISTAIRE_QR_PREFLIGHT_ENVIRONMENT must be exactly preview or production.");
  }

  for (const [name, value] of Object.entries(env)) {
    if (
      value &&
      name.startsWith("NEXT_PUBLIC_") &&
      /(?:SUPABASE_SERVICE_ROLE|VISTAIRE.*(?:SECRET|KEY_RING|ACTIVE_KEY_VERSION|PREVIOUS_SECRET))/i.test(name)
    ) {
      fail(`${name} is forbidden; QR and service-role secrets must remain server-only.`);
    }
  }

  const projectRef = required(env, "VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF").toLowerCase();
  const otherProjectRef = required(
    env,
    "VISTAIRE_QR_PREFLIGHT_OTHER_SUPABASE_PROJECT_REF"
  ).toLowerCase();
  if (!PROJECT_REF_PATTERN.test(projectRef) || !PROJECT_REF_PATTERN.test(otherProjectRef)) {
    fail("Supabase project refs must contain 8 to 64 lowercase letters or digits.");
  }
  if (projectRef === otherProjectRef) {
    fail("Preview and Production must use different Supabase project refs.");
  }

  const supabaseUrl = parseOrigin(
    required(env, "NEXT_PUBLIC_SUPABASE_URL"),
    "NEXT_PUBLIC_SUPABASE_URL"
  );
  if (supabaseUrl.hostname.toLowerCase() !== `${projectRef}.supabase.co`) {
    fail("NEXT_PUBLIC_SUPABASE_URL does not match VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF.");
  }

  const publicBaseUrl = parseOrigin(
    required(env, "VISTAIRE_QR_PREFLIGHT_PUBLIC_BASE_URL"),
    "VISTAIRE_QR_PREFLIGHT_PUBLIC_BASE_URL"
  );
  const otherPublicBaseUrl = parseOrigin(
    required(env, "VISTAIRE_QR_PREFLIGHT_OTHER_PUBLIC_BASE_URL"),
    "VISTAIRE_QR_PREFLIGHT_OTHER_PUBLIC_BASE_URL"
  );
  if (publicBaseUrl.origin === otherPublicBaseUrl.origin) {
    fail("Preview and Production must use different public QR origins.");
  }
  const runtimePublicOrigin = resolveRuntimePublicOrigin(env);
  if (publicBaseUrl.origin !== runtimePublicOrigin.origin) {
    fail(
      `VISTAIRE_QR_PREFLIGHT_PUBLIC_BASE_URL must match the effective runtime origin from ${runtimePublicOrigin.name}.`
    );
  }

  const expectedSchemaContract = required(
    env,
    "VISTAIRE_QR_PREFLIGHT_EXPECTED_SCHEMA_CONTRACT"
  );
  if (expectedSchemaContract !== CANONICAL_SCHEMA_CONTRACT) {
    fail(`Expected QR schema contract must be ${CANONICAL_SCHEMA_CONTRACT}.`);
  }

  const serviceRole = validateOpaqueSecret(env, "SUPABASE_SERVICE_ROLE_KEY");
  const tokenSecret = validateOpaqueSecret(env, "VISTAIRE_QR_TOKEN_SECRET");
  const adminSessionSecret = validateOpaqueSecret(
    env,
    "VISTAIRE_ADMIN_SESSION_SECRET"
  );
  const keyFingerprints = validateKeyRing(env);
  validateSecretSeparation(env, {
    serviceRole,
    tokenSecret,
    adminSessionSecret,
    keyFingerprints
  });

  return {
    environment,
    projectRef,
    supabaseUrl,
    publicBaseUrl,
    expectedSchemaContract
  };
}

export async function verifyQrDatabaseContract(
  contract,
  fetchImpl = fetch,
  env = process.env
) {
  const serviceRoleKey = required(env, "SUPABASE_SERVICE_ROLE_KEY");
  const headers = {
    Accept: "application/openapi+json, application/json",
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };
  const schemaUrl = new URL("/rest/v1/", contract.supabaseUrl);
  let response;
  try {
    response = await fetchImpl(schemaUrl, { method: "GET", headers });
  } catch {
    fail("Supabase schema lookup failed before any database mutation.");
  }
  if (!response?.ok) {
    fail(`Supabase schema lookup returned HTTP ${response?.status ?? "unknown"}.`);
  }

  let openApi;
  try {
    openApi = await response.json();
  } catch {
    fail("Supabase schema lookup returned invalid JSON.");
  }
  const properties = openApi?.definitions?.qr_codes?.properties ?? {};
  const missingColumns = REQUIRED_CANONICAL_COLUMNS.filter(
    (column) => !Object.hasOwn(properties, column)
  );
  const paths = openApi?.paths ?? {};
  const missingRpcs = REQUIRED_CANONICAL_RPCS.filter(
    (rpc) => !Object.hasOwn(paths, `/rpc/${rpc}`)
  );
  const lifecycleEventProperties =
    openApi?.definitions?.qr_code_lifecycle_events?.properties ?? {};
  const missingLifecycleEventColumns = REQUIRED_LIFECYCLE_EVENT_COLUMNS.filter(
    (column) => !Object.hasOwn(lifecycleEventProperties, column)
  );
  if (missingColumns.length || missingRpcs.length || missingLifecycleEventColumns.length) {
    fail(
      `Database does not expose QR contract ${contract.expectedSchemaContract}; missing nominal columns/RPCs: ${[
        ...missingColumns,
        ...missingRpcs,
        ...missingLifecycleEventColumns.map((column) => `qr_code_lifecycle_events.${column}`)
      ].join(", ")}.`
    );
  }

  const probeUrl = new URL("/rest/v1/qr_codes", contract.supabaseUrl);
  probeUrl.searchParams.set(
    "select",
    "id,target_kind,purpose_key,is_canonical,token_key_version,supersedes_qr_code_id,rotated_at,revoked_at,config_version"
  );
  probeUrl.searchParams.set("limit", "0");
  let probe;
  try {
    probe = await fetchImpl(probeUrl, {
      method: "GET",
      headers: { ...headers, Accept: "application/json" }
    });
  } catch {
    fail("Supabase zero-row QR column probe failed.");
  }
  if (!probe?.ok) {
    fail(`Supabase zero-row QR column probe returned HTTP ${probe?.status ?? "unknown"}.`);
  }

  return { schemaContract: contract.expectedSchemaContract, readOnlyRequests: 2 };
}

async function run() {
  const contract = validateQrEnvironment();
  const configOnly = process.argv.includes("--config-only");
  const database = configOnly
    ? { schemaContract: "NOT VERIFIED", readOnlyRequests: 0 }
    : await verifyQrDatabaseContract(contract);
  const redactedProjectRef = `${contract.projectRef.slice(0, 4)}…${contract.projectRef.slice(-4)}`;
  console.log(
    `[qr-environment-preflight] OK environment=${contract.environment} project_ref=${redactedProjectRef} public_origin=${contract.publicBaseUrl.origin} nominal_schema_contract=${database.schemaContract} read_only_requests=${database.readOnlyRequests}; status constraints, RPC signatures/semantics, inventory authorization, database migration history and PostgreSQL version require separate verification; secret values were not printed.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : "[qr-environment-preflight] failed.");
    process.exitCode = 1;
  });
}
