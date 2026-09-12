import { listDeploymentAliases } from "./vercel-preview-cleanup-read.mjs";

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function normalizeHostname(value) {
  const hostname = requiredText(value, "Hostname").toLowerCase();
  return hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
}

async function requireJson(response, label) {
  if (!response?.ok) throw new Error(`${label} failed with HTTP ${response?.status ?? "unknown"}`);
  return response.json();
}

export async function removeVercelPreview({
  fetchImpl = fetch,
  token,
  teamId,
  projectId,
  deployment,
  productionDomains,
}) {
  const authToken = requiredText(token, "Vercel token");
  const scopeTeamId = requiredText(teamId, "Vercel team id");
  const scopeProjectId = requiredText(projectId, "Vercel project id");
  const uid = requiredText(deployment?.uid, "Deployment id");

  if (deployment?.projectId !== scopeProjectId) {
    throw new Error("Refusing removal for a deployment outside the configured project");
  }
  if (deployment?.target !== null) {
    throw new Error("Refusing removal for a non-preview deployment target");
  }
  if (String(deployment?.readySubstate ?? "").toUpperCase() === "PROMOTED") {
    return { deleted: false, protectedProductionAlias: true, reason: "promoted-preview" };
  }
  if (!Array.isArray(productionDomains)) {
    throw new Error("Production domain inventory is required before Preview removal");
  }

  const protectedDomains = new Set(
    productionDomains
      .filter((domain) => domain?.verified !== false && typeof domain?.name === "string" && domain.name.trim())
      .map((domain) => normalizeHostname(domain.name))
  );
  if (protectedDomains.size === 0) {
    throw new Error("Production domain inventory is empty; refusing Preview removal");
  }

  const aliases = await listDeploymentAliases({
    fetchImpl,
    token: authToken,
    teamId: scopeTeamId,
    deploymentId: uid,
  });
  const servesProductionDomain = aliases.some((alias) => {
    if (typeof alias?.alias !== "string" || !alias.alias.trim()) return false;
    return protectedDomains.has(normalizeHostname(alias.alias));
  });
  if (servesProductionDomain) {
    return { deleted: false, protectedProductionAlias: true, reason: "production-domain-alias" };
  }

  const url = new URL(`https://api.vercel.com/v13/deployments/${encodeURIComponent(uid)}`);
  url.searchParams.set("teamId", scopeTeamId);
  const response = await requireJson(
    await fetchImpl(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    }),
    `Vercel preview removal for ${uid}`
  );
  return { deleted: true, protectedProductionAlias: false, response };
}
