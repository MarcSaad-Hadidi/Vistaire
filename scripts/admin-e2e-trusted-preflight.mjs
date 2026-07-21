import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateControlledAdminE2EContract } from "./admin-e2e-fixture-contract.mjs";

const QR_SECRET_NAMES = [
  "VISTAIRE_ADMIN_E2E_QR_TOKEN",
  "VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN",
  "VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN",
  "VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN"
];
const TRUSTED_REPOSITORY = "MarcSaad-Hadidi/Vistaire";
const TRUSTED_PRODUCTION_HOST = "vistaire.ca";
const TRUSTED_PRODUCTION_HOSTS = new Set(["vistaire.ca", "www.vistaire.ca"]);

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
    value.port ||
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

function metadataOrigin(metadata, key) {
  const value = deploymentEnv(metadata, key);
  let parsed;
  try {
    parsed = new URL(String(value ?? ""));
  } catch {
    fail(`the authenticated ${key} binding is invalid.`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    fail(`the authenticated ${key} binding is invalid.`);
  }
  return parsed;
}

function deploymentEnv(metadata, key) {
  if (Array.isArray(metadata.env)) {
    return metadata.env.find((entry) => entry?.key === key)?.value;
  }
  return metadata.env?.[key];
}

async function vercelJson(fetchDeployment, endpoint, apiToken, purpose) {
  let response;
  try {
    response = await fetchDeployment(endpoint, {
      headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` }
    });
  } catch {
    fail(`the Vercel ${purpose} lookup failed.`);
  }
  if (!response?.ok) {
    fail(`the Vercel ${purpose} lookup failed.`);
  }
  try {
    return await response.json();
  } catch {
    fail(`the Vercel ${purpose} response was invalid.`);
  }
}

function repositoryIdentity(metadata) {
  const namespace = metadata.gitRepo?.namespace ?? metadata.meta?.githubCommitOrg;
  const name = metadata.gitRepo?.name ?? metadata.meta?.githubCommitRepo;
  const repoId = metadata.gitRepo?.repoId ?? metadata.gitSource?.repoId;
  return {
    fullName: namespace && name ? `${namespace}/${name}` : "",
    repoId
  };
}

function hasProductionAlias(metadata) {
  return (Array.isArray(metadata.alias) ? metadata.alias : []).some((alias) => {
    const hostname = String(alias).toLowerCase();
    return TRUSTED_PRODUCTION_HOSTS.has(hostname) ||
      hostname.endsWith(".vistaire.ca") ||
      /(?:^|[-.])production(?:[-.]|$)/.test(hostname);
  });
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
    baseUrl.origin !== `https://${expectedHost}` ||
    baseUrl.hostname.toLowerCase() !== expectedHost ||
    !expectedHost.endsWith(".vercel.app") ||
    /(?:^|[-.])(?:main|master|production)(?:[-.]|$)/.test(expectedHost)
  ) {
    fail("the browser URL must be the exact non-production Vercel branch Preview.");
  }

  const branch = required(env, "VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH");
  const sha = required(env, "VISTAIRE_ADMIN_E2E_EXPECTED_COMMIT_SHA");
  const projectId = required(env, "VISTAIRE_ADMIN_E2E_VERCEL_PROJECT_ID");
  const teamId = required(env, "VISTAIRE_ADMIN_E2E_VERCEL_TEAM_ID");
  const expectedRepository = required(env, "VISTAIRE_ADMIN_E2E_EXPECTED_REPOSITORY");
  const apiToken = required(env, "VISTAIRE_ADMIN_E2E_VERCEL_API_TOKEN");
  if (/^(?:main|master|production)$/i.test(branch)) {
    fail("the expected Git branch must be non-production.");
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    fail("the expected commit must be a full lowercase SHA.");
  }
  if (!/^prj_[A-Za-z0-9]+$/.test(projectId)) fail("the Vercel project id is invalid.");
  if (!/^team_[A-Za-z0-9]+$/.test(teamId)) fail("the Vercel team id is invalid.");
  if (expectedRepository !== TRUSTED_REPOSITORY) fail("the trusted repository is invalid.");
  if (apiToken.length < 16 || /\s/.test(apiToken)) fail("the Vercel API token is invalid.");

  const supabaseUrl = origin(env, "VISTAIRE_ADMIN_E2E_SUPABASE_URL");
  const supabaseRef = required(
    env,
    "VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF"
  ).toLowerCase();
  if (
    !/^[a-z0-9]{8,64}$/.test(supabaseRef) ||
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

  const metadata = await vercelJson(fetchDeployment, endpoint, apiToken, "Preview deployment identity");
  const deploymentBranch = metadata.meta?.githubCommitRef ?? metadata.gitSource?.ref;
  const deploymentSha = metadata.meta?.githubCommitSha ?? metadata.gitSource?.sha;
  const deploymentProject = metadata.projectId ?? metadata.project?.id;
  const deploymentTeam = metadata.teamId ?? metadata.ownerId;
  const deploymentHost = String(metadata.url ?? "").toLowerCase();
  const deploymentRepository = repositoryIdentity(metadata);
  const previewTarget = metadata.target === null || metadata.target === "preview";
  if (!previewTarget || metadata.readyState !== "READY") {
    fail("the deployment must be a READY Vercel Preview.");
  }
  if (deploymentTeam !== teamId) fail("the Vercel team does not match.");
  if (deploymentHost !== expectedHost) fail("the Vercel Preview host does not match.");
  if (hasProductionAlias(metadata)) fail("the Vercel Preview has a forbidden Production alias.");
  if (deploymentProject !== projectId) fail("the Vercel project does not match.");
  if (deploymentBranch !== branch) fail("the Vercel branch does not match.");
  if (deploymentSha?.toLowerCase() !== sha) fail("the Vercel exact commit does not match.");
  if (deploymentRepository.fullName !== expectedRepository || !deploymentRepository.repoId) {
    fail("the deployment must come from the trusted non-fork repository.");
  }
  if (metadata.gitSource?.type !== "github") {
    fail("the deployment must come from the trusted non-fork repository.");
  }

  const projectEndpoint = new URL(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}`
  );
  projectEndpoint.searchParams.set("teamId", teamId);
  const project = await vercelJson(fetchDeployment, projectEndpoint, apiToken, "project identity");
  const projectRepository = project.link?.org && project.link?.repo
    ? `${project.link.org}/${project.link.repo}`
    : "";
  if (
    project.id !== projectId ||
    project.accountId !== teamId ||
    project.link?.type !== "github" ||
    projectRepository !== expectedRepository ||
    !project.link?.repoId ||
    project.link.repoId !== deploymentRepository.repoId ||
    metadata.gitSource?.repoId !== project.link.repoId
  ) {
    fail("the Vercel project repository binding does not match.");
  }

  const productionEndpoint = new URL(
    `https://api.vercel.com/v13/deployments/${TRUSTED_PRODUCTION_HOST}`
  );
  productionEndpoint.searchParams.set("teamId", teamId);
  const production = await vercelJson(
    fetchDeployment,
    productionEndpoint,
    apiToken,
    "Production identity"
  );
  const productionSupabaseRef = deploymentEnv(
    production,
    "VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF"
  );
  const productionSupabaseUrl = metadataOrigin(production, "NEXT_PUBLIC_SUPABASE_URL");
  const productionAliases = new Set(
    (Array.isArray(production.alias) ? production.alias : [])
      .map((alias) => String(alias).toLowerCase())
  );
  if (
    production.target !== "production" ||
    production.readyState !== "READY" ||
    (production.projectId ?? production.project?.id) !== projectId ||
    (production.teamId ?? production.ownerId) !== teamId ||
    ![...TRUSTED_PRODUCTION_HOSTS].some((host) => productionAliases.has(host)) ||
    !/^[a-z0-9]{8,64}$/.test(String(productionSupabaseRef ?? "")) ||
    productionSupabaseUrl.hostname.toLowerCase() !== `${productionSupabaseRef}.supabase.co` ||
    productionSupabaseRef === supabaseRef
  ) {
    fail("the Supabase URL must match a dedicated non-Production Preview project ref.");
  }
  if (
    deploymentEnv(metadata, "NEXT_PUBLIC_SUPABASE_URL") !== supabaseUrl.origin ||
    deploymentEnv(metadata, "VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF") !== supabaseRef
  ) {
    fail("the deployed Supabase binding does not match the Preview fixture.");
  }

  return {
    readyState: "READY",
    target: "preview",
    projectMatch: true,
    repositoryMatch: true,
    branchMatch: true,
    shaMatch: true,
    supabaseMatch: true
  };
}

async function main() {
  const result = await runTrustedAdminE2EPreflight();
  console.log(
    `${result.readyState}; ${result.target}; project match; repository match; branch match; SHA match; Supabase match.`
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
