function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

async function requireJson(response, label) {
  if (!response?.ok) throw new Error(`${label} failed with HTTP ${response?.status ?? "unknown"}`);
  return response.json();
}

export async function removeVercelPreview({ fetchImpl = fetch, token, teamId, projectId, deployment }) {
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

  const url = new URL(`https://api.vercel.com/v13/deployments/${encodeURIComponent(uid)}`);
  url.searchParams.set("teamId", scopeTeamId);
  return requireJson(
    await fetchImpl(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    }),
    `Vercel preview removal for ${uid}`
  );
}
