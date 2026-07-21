import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateControlledAdminE2EContract } from "./admin-e2e-fixture-contract.mjs";

const QR_SECRET_NAMES = [
  "VISTAIRE_ADMIN_E2E_QR_TOKEN",
  "VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN",
  "VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN",
  "VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN"
];

function fail(message) {
  throw new Error(`[admin-e2e trusted preflight] ${message}`);
}

function required(env, name) {
  const value = env[name];
  if (!value || value.trim() !== value) {
    fail(`${name} is required and must be trimmed.`);
  }
  return value;
}

function origin(env, name) {
  let value;
  try {
    value = new URL(required(env, name));
  } catch {
    fail(`${name} must be a valid URL.`);
  }
  if (
    value.protocol !== "https:" ||
    value.username ||
    value.password ||
    value.pathname !== "/" ||
    value.search ||
    value.hash
  ) {
    fail(`${name} must be a credential-free HTTPS origin.`);
  }
  return value;
}

function deploymentEnv(metadata, key) {
  if (Array.isArray(metadata.env)) {
    return metadata.env.find((entry) => entry?.key === key)?.value;
  }
  return metadata.env?.[key];
}

export async function runTrustedAdminE2EPreflight(
  env = process.env,
  fetchDeployment = fetch
) {
  validateControlledAdminE2EContract(env);

  const baseUrl = origin(env, "VISTAIRE_ADMIN_E2E_BASE_URL");
  const playwrightUrl = origin(env, "PLAYWRIGHT_BASE_URL");
  const expectedHost = required(
    env,
    "VISTAIRE_ADMIN_E2E_EXPECTED_VERCEL_HOST"
  ).toLowerCase();
  if (
    baseUrl.origin !== playwrightUrl.origin ||
    baseUrl.hostname.toLowerCase() !== expectedHost ||
    !expectedHost.endsWith(".vercel.app") ||
    !expectedHost.includes("-git-") ||
    /-git-(?:main|master|production)(?:-|\.vercel\.app$)/.test(expectedHost)
  ) {
    fail("the browser URL must be the exact non-production Vercel branch Preview.");
  }

  const branch = required(env, "VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH");
  const sha = required(env, "VISTAIRE_ADMIN_E2E_EXPECTED_COMMIT_SHA");
  const projectId = required(env, "VISTAIRE_ADMIN_E2E_VERCEL_PROJECT_ID");
  const teamId = required(env, "VISTAIRE_ADMIN_E2E_VERCEL_TEAM_ID");
  const apiToken = required(env, "VISTAIRE_ADMIN_E2E_VERCEL_API_TOKEN");
  if (/^(?:main|master|production)$/i.test(branch)) {
    fail("the expected Git branch must be non-production.");
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    fail("the expected commit must be a full lowercase SHA.");
  }
  if (!/^prj_[A-Za-z0-9]+$/.test(projectId)) fail("the Vercel project id is invalid.");
  if (!/^team_[A-Za-z0-9]+$/.test(teamId)) fail("the Vercel team id is invalid.");
  if (apiToken.length < 16 || /\s/.test(apiToken)) fail("the Vercel API token is invalid.");

  const supabaseUrl = origin(env, "VISTAIRE_ADMIN_E2E_SUPABASE_URL");
  const supabaseRef = required(
    env,
    "VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF"
  ).toLowerCase();
  const productionSupabaseRef = required(
    env,
    "VISTAIRE_ADMIN_E2E_PRODUCTION_SUPABASE_PROJECT_REF"
  ).toLowerCase();
  if (
    !/^[a-z0-9]{8,64}$/.test(supabaseRef) ||
    !/^[a-z0-9]{8,64}$/.test(productionSupabaseRef) ||
    supabaseRef === productionSupabaseRef ||
    supabaseUrl.hostname.toLowerCase() !== `${supabaseRef}.supabase.co`
  ) {
    fail("the Supabase URL must match a dedicated non-Production Preview project ref.");
  }

  const qrSecrets = QR_SECRET_NAMES.map((name) => required(env, name));
  if (qrSecrets.some((value) => !/^[A-Za-z0-9_-]{16,}$/.test(value))) {
    fail("controlled QR secrets must be URL-safe opaque values of at least 16 characters.");
  }
  if (new Set(qrSecrets).size !== qrSecrets.length) {
    fail("controlled QR secrets must be distinct.");
  }

  const endpoint = new URL(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(expectedHost)}`
  );
  endpoint.searchParams.set("teamId", teamId);
  endpoint.searchParams.set("withGitRepoInfo", "true");

  let response;
  try {
    response = await fetchDeployment(endpoint, {
      headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` }
    });
  } catch {
    fail("the Vercel deployment identity lookup failed.");
  }
  if (!response?.ok) {
    fail(`the Vercel lookup returned HTTP ${response?.status ?? "unknown"}.`);
  }

  let metadata;
  try {
    metadata = await response.json();
  } catch {
    fail("the Vercel deployment identity response was invalid.");
  }
  const deploymentBranch = metadata.meta?.githubCommitRef ?? metadata.gitSource?.ref;
  const deploymentSha = metadata.meta?.githubCommitSha ?? metadata.gitSource?.sha;
  const deploymentProject = metadata.projectId ?? metadata.project?.id;
  const previewTarget = metadata.target === null || metadata.target === "preview";
  if (!previewTarget || metadata.readyState !== "READY") {
    fail("the deployment must be a READY Vercel Preview.");
  }
  if (
    deploymentProject !== projectId ||
    deploymentBranch !== branch ||
    deploymentSha?.toLowerCase() !== sha
  ) {
    fail("the Vercel project, branch, or exact commit does not match.");
  }
  if (
    deploymentEnv(metadata, "NEXT_PUBLIC_SUPABASE_URL") !== supabaseUrl.origin ||
    deploymentEnv(metadata, "VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF") !== supabaseRef
  ) {
    fail("the deployed Supabase binding does not match the Preview fixture.");
  }

  return { branch, sha, projectId, readyState: "READY", target: "preview" };
}

async function main() {
  const result = await runTrustedAdminE2EPreflight();
  console.log(
    `Trusted admin E2E preflight passed for ${result.branch} at ${result.sha}. Secret values were not printed.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Trusted admin E2E preflight failed."
    );
    process.exitCode = 1;
  });
}
