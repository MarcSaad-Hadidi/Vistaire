import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CONTROLLED_ADMIN_E2E_FIXTURES = Object.freeze({
  restaurantA: "Vistaire E2E Restaurant A",
  restaurantB: "Vistaire E2E Restaurant B"
});

const REQUIRED_SECRET_NAMES = [
  "VISTAIRE_ADMIN_E2E_QR_TOKEN",
  "VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN",
  "VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN",
  "VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN"
];

function fail(message) {
  throw new Error(`[admin-e2e fixture contract] ${message}`);
}

function parsePreviewUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${name} must be a valid HTTPS URL.`);
  }

  if (url.protocol !== "https:") {
    fail(`${name} must use HTTPS.`);
  }
  if (url.username || url.password) {
    fail(`${name} must not contain URL credentials.`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    fail(`${name} must be an origin without a path, query, or fragment.`);
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "vistaire.ca" ||
    hostname.endsWith(".vistaire.ca")
  ) {
    fail(`${name} must target a controlled preview, never the production client.`);
  }

  return url;
}

function validateVercelPreviewHost(url, env) {
  const expectedHost = requiredFrom(
    env,
    "VISTAIRE_ADMIN_E2E_EXPECTED_VERCEL_HOST"
  ).toLowerCase();
  if (
    expectedHost.includes("://") ||
    expectedHost.includes("/") ||
    !expectedHost.endsWith(".vercel.app") ||
    !expectedHost.includes("-git-") ||
    /-git-(?:main|master|production)(?:-|\.vercel\.app$)/.test(expectedHost)
  ) {
    fail(
      "VISTAIRE_ADMIN_E2E_EXPECTED_VERCEL_HOST must be an exact Vercel branch preview hostname."
    );
  }
  if (url.hostname.toLowerCase() !== expectedHost) {
    fail(
      "VISTAIRE_ADMIN_E2E_BASE_URL must match the expected Vercel preview hostname."
    );
  }
  return expectedHost;
}

function validateSupabasePreviewProject(env) {
  const expectedProjectRef = requiredFrom(
    env,
    "VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF"
  ).toLowerCase();
  if (!/^[a-z0-9]{8,64}$/.test(expectedProjectRef)) {
    fail(
      "VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF must be a valid project ref."
    );
  }

  let url;
  try {
    url = new URL(requiredFrom(env, "VISTAIRE_ADMIN_E2E_SUPABASE_URL"));
  } catch {
    fail("VISTAIRE_ADMIN_E2E_SUPABASE_URL must be a valid HTTPS project URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.hostname.toLowerCase() !== `${expectedProjectRef}.supabase.co`
  ) {
    fail(
      "VISTAIRE_ADMIN_E2E_SUPABASE_URL must match the expected dedicated preview project."
    );
  }
  return expectedProjectRef;
}

function validateVercelApiInputs(env) {
  const vercelTeamId = requiredFrom(
    env,
    "VISTAIRE_ADMIN_E2E_VERCEL_TEAM_ID"
  );
  const vercelProjectId = requiredFrom(
    env,
    "VISTAIRE_ADMIN_E2E_VERCEL_PROJECT_ID"
  );
  const gitBranch = requiredFrom(
    env,
    "VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH"
  );
  const commitSha = requiredFrom(
    env,
    "VISTAIRE_ADMIN_E2E_EXPECTED_COMMIT_SHA"
  ).toLowerCase();
  const apiToken = requiredFrom(
    env,
    "VISTAIRE_ADMIN_E2E_VERCEL_API_TOKEN"
  );
  if (!/^team_[A-Za-z0-9]+$/.test(vercelTeamId)) {
    fail("VISTAIRE_ADMIN_E2E_VERCEL_TEAM_ID must be a valid Vercel team id.");
  }
  if (!/^prj_[A-Za-z0-9]+$/.test(vercelProjectId)) {
    fail(
      "VISTAIRE_ADMIN_E2E_VERCEL_PROJECT_ID must be a valid Vercel project id."
    );
  }
  if (
    gitBranch.trim() !== gitBranch ||
    !gitBranch ||
    /^(?:main|master|production)$/i.test(gitBranch)
  ) {
    fail(
      "VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH must identify a non-production branch."
    );
  }
  if (!/^[a-f0-9]{40}$/.test(commitSha)) {
    fail(
      "VISTAIRE_ADMIN_E2E_EXPECTED_COMMIT_SHA must be a full Git commit SHA."
    );
  }
  if (apiToken.length < 16 || /\s/.test(apiToken)) {
    fail(
      "VISTAIRE_ADMIN_E2E_VERCEL_API_TOKEN must be one opaque read-only token."
    );
  }
  return { vercelTeamId, vercelProjectId, gitBranch, commitSha };
}

export function validateControlledAdminE2EContract(env = process.env) {
  if (env.VISTAIRE_ADMIN_E2E_ENABLED !== "true") {
    fail("VISTAIRE_ADMIN_E2E_ENABLED must be exactly true.");
  }

  const baseUrl = parsePreviewUrl(
    requiredFrom(env, "VISTAIRE_ADMIN_E2E_BASE_URL"),
    "VISTAIRE_ADMIN_E2E_BASE_URL"
  );
  const vercelHost = validateVercelPreviewHost(baseUrl, env);
  const supabaseProjectRef = validateSupabasePreviewProject(env);
  const { vercelTeamId, vercelProjectId, gitBranch, commitSha } =
    validateVercelApiInputs(env);
  const playwrightBaseUrl = env.PLAYWRIGHT_BASE_URL;
  if (playwrightBaseUrl) {
    const playwrightUrl = parsePreviewUrl(playwrightBaseUrl, "PLAYWRIGHT_BASE_URL");
    if (playwrightUrl.origin !== baseUrl.origin) {
      fail("PLAYWRIGHT_BASE_URL must match VISTAIRE_ADMIN_E2E_BASE_URL.");
    }
  }

  const restaurantA = requiredFrom(env, "VISTAIRE_ADMIN_E2E_RESTAURANT_NAME");
  const restaurantB = requiredFrom(env, "VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME");
  if (restaurantA !== CONTROLLED_ADMIN_E2E_FIXTURES.restaurantA) {
    fail("VISTAIRE_ADMIN_E2E_RESTAURANT_NAME must name the dedicated Restaurant A fixture.");
  }
  if (restaurantB !== CONTROLLED_ADMIN_E2E_FIXTURES.restaurantB) {
    fail("VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME must name the dedicated Restaurant B fixture.");
  }
  if (/trouvable|client|production|demo/i.test(`${restaurantA} ${restaurantB}`)) {
    fail("fixture names must not identify a client or demo restaurant.");
  }

  const tokens = REQUIRED_SECRET_NAMES.map((name) => validateSecretFrom(env, name));
  if (new Set(tokens).size !== tokens.length) {
    fail("active A, active B, and suspended QR tokens must be distinct.");
  }

  return {
    baseOrigin: baseUrl.origin,
    vercelHost,
    vercelTeamId,
    vercelProjectId,
    gitBranch,
    commitSha,
    supabaseProjectRef,
    restaurantA,
    restaurantB,
    secretNames: [...REQUIRED_SECRET_NAMES]
  };
}

function deploymentEnvValue(metadata, key) {
  if (Array.isArray(metadata.env)) {
    const entry = metadata.env.find((candidate) => candidate?.key === key);
    return typeof entry?.value === "string" ? entry.value : undefined;
  }
  if (metadata.env && typeof metadata.env === "object") {
    const value = metadata.env[key];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

export async function verifyControlledAdminE2ERemoteIdentity(
  contract,
  env = process.env,
  fetchDeployment = fetch
) {
  const apiToken = requiredFrom(
    env,
    "VISTAIRE_ADMIN_E2E_VERCEL_API_TOKEN"
  );
  const endpoint = new URL(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(contract.vercelHost)}`
  );
  endpoint.searchParams.set("teamId", contract.vercelTeamId);
  endpoint.searchParams.set("withGitRepoInfo", "true");

  let response;
  try {
    response = await fetchDeployment(endpoint, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`
      }
    });
  } catch {
    fail("Vercel deployment identity lookup failed.");
  }
  if (!response?.ok) {
    fail(
      `Vercel deployment identity lookup returned HTTP ${response?.status ?? "unknown"}.`
    );
  }

  let metadata;
  try {
    metadata = await response.json();
  } catch {
    fail("Vercel deployment identity response was invalid.");
  }
  const targetIsPreview =
    Object.hasOwn(metadata, "target") &&
    (metadata.target === null || metadata.target === "preview");
  if (!targetIsPreview || metadata.readyState !== "READY") {
    fail("The controlled URL must resolve to a READY Vercel Preview deployment.");
  }

  const projectId = metadata.projectId ?? metadata.project?.id;
  const gitBranch =
    metadata.meta?.githubCommitRef ?? metadata.gitSource?.ref;
  const commitSha =
    metadata.meta?.githubCommitSha ?? metadata.gitSource?.sha;
  if (
    projectId !== contract.vercelProjectId ||
    gitBranch !== contract.gitBranch
  ) {
    fail("Vercel deployment project or Git branch identity does not match.");
  }
  if (commitSha?.toLowerCase() !== contract.commitSha) {
    fail("Vercel deployment commit identity does not match.");
  }

  const deployedSupabaseUrl = deploymentEnvValue(
    metadata,
    "NEXT_PUBLIC_SUPABASE_URL"
  );
  const deployedSupabaseProjectRef = deploymentEnvValue(
    metadata,
    "VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF"
  );
  if (
    deployedSupabaseUrl !== env.VISTAIRE_ADMIN_E2E_SUPABASE_URL ||
    deployedSupabaseProjectRef !== contract.supabaseProjectRef
  ) {
    fail("Vercel deployment Supabase binding does not match the preview fixture.");
  }

  return {
    readyState: "READY",
    target: "preview",
    projectId,
    gitBranch,
    commitSha: commitSha.toLowerCase(),
    supabaseProjectRef: deployedSupabaseProjectRef
  };
}

function requiredFrom(env, name) {
  const value = env[name];
  if (!value || !value.trim()) fail(`${name} is required.`);
  return value;
}

function validateSecretFrom(env, name) {
  const value = requiredFrom(env, name);
  if (value.trim() !== value || /\s/.test(value)) {
    fail(`${name} must be one opaque token without whitespace.`);
  }
  if (value.length < 16) {
    fail(`${name} is shorter than the controlled QR token minimum.`);
  }
  if (/trouvable|demo|production/i.test(value)) {
    fail(`${name} has a forbidden client/demo marker.`);
  }
  return value;
}

async function run() {
  const contract = validateControlledAdminE2EContract();
  await verifyControlledAdminE2ERemoteIdentity(contract);
  console.log(
    `Controlled admin E2E contract valid for ${contract.restaurantA} and ${contract.restaurantB} at ${contract.baseOrigin}. QR values were not printed.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : "Admin E2E fixture contract failed.");
    process.exitCode = 1;
  });
}
