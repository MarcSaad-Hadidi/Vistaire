function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

async function requireJson(response, label) {
  if (!response?.ok) throw new Error(`${label} failed with HTTP ${response?.status ?? "unknown"}`);
  return response.json();
}

export async function listVercelDeployments({ fetchImpl = fetch, token, teamId, projectId }) {
  const authToken = requiredText(token, "Vercel token");
  const scopeTeamId = requiredText(teamId, "Vercel team id");
  const scopeProjectId = requiredText(projectId, "Vercel project id");
  const deployments = [];
  const seenCursors = new Set();
  let until = null;

  for (let page = 0; page < 100; page += 1) {
    const url = new URL("https://api.vercel.com/v7/deployments");
    url.searchParams.set("projectId", scopeProjectId);
    url.searchParams.set("teamId", scopeTeamId);
    url.searchParams.set("limit", "100");
    if (until !== null) url.searchParams.set("until", String(until));

    const data = await requireJson(
      await fetchImpl(url, { headers: { Authorization: `Bearer ${authToken}` } }),
      "Vercel deployment listing"
    );
    if (!Array.isArray(data?.deployments)) {
      throw new Error("Vercel deployment listing returned an invalid deployments payload");
    }
    deployments.push(...data.deployments);

    const next = data?.pagination?.next;
    if (next === null || next === undefined) return deployments;
    if (!Number.isFinite(next) || seenCursors.has(next)) {
      throw new Error("Vercel deployment pagination returned an invalid cursor");
    }
    seenCursors.add(next);
    until = next;
  }

  throw new Error("Vercel deployment pagination exceeded the safety limit");
}

export async function listProductionProjectDomains({ fetchImpl = fetch, token, teamId, projectId }) {
  const authToken = requiredText(token, "Vercel token");
  const scopeTeamId = requiredText(teamId, "Vercel team id");
  const scopeProjectId = requiredText(projectId, "Vercel project id");
  const domains = [];
  const seenCursors = new Set();
  let until = null;

  for (let page = 0; page < 100; page += 1) {
    const url = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(scopeProjectId)}/domains`);
    url.searchParams.set("teamId", scopeTeamId);
    url.searchParams.set("production", "true");
    url.searchParams.set("redirects", "false");
    url.searchParams.set("limit", "100");
    if (until !== null) url.searchParams.set("until", String(until));

    const data = await requireJson(
      await fetchImpl(url, { headers: { Authorization: `Bearer ${authToken}` } }),
      "Vercel production domain listing"
    );
    if (!Array.isArray(data?.domains)) {
      throw new Error("Vercel production domain listing returned an invalid domains payload");
    }
    domains.push(...data.domains);

    const next = data?.pagination?.next;
    if (next === null || next === undefined) return domains;
    if (!Number.isFinite(next) || seenCursors.has(next)) {
      throw new Error("Vercel production domain pagination returned an invalid cursor");
    }
    seenCursors.add(next);
    until = next;
  }

  throw new Error("Vercel production domain pagination exceeded the safety limit");
}

export async function listDeploymentAliases({ fetchImpl = fetch, token, teamId, deploymentId }) {
  const authToken = requiredText(token, "Vercel token");
  const scopeTeamId = requiredText(teamId, "Vercel team id");
  const uid = requiredText(deploymentId, "Vercel deployment id");
  const aliases = [];
  const seenCursors = new Set();
  let until = null;

  for (let page = 0; page < 100; page += 1) {
    const url = new URL(`https://api.vercel.com/v2/deployments/${encodeURIComponent(uid)}/aliases`);
    url.searchParams.set("teamId", scopeTeamId);
    url.searchParams.set("limit", "100");
    if (until !== null) url.searchParams.set("until", String(until));

    const data = await requireJson(
      await fetchImpl(url, { headers: { Authorization: `Bearer ${authToken}` } }),
      `Vercel alias listing for ${uid}`
    );
    if (!Array.isArray(data?.aliases)) {
      throw new Error(`Vercel alias listing for ${uid} returned an invalid aliases payload`);
    }
    aliases.push(...data.aliases);

    const next = data?.pagination?.next;
    if (next === null || next === undefined) return aliases;
    const cursor = Number(next);
    if (!Number.isFinite(cursor) || seenCursors.has(cursor)) {
      throw new Error(`Vercel alias listing for ${uid} returned an invalid pagination cursor`);
    }
    seenCursors.add(cursor);
    until = cursor;
  }

  throw new Error(`Vercel alias listing for ${uid} exceeded the safety pagination limit`);
}

async function listPullRequestsByState({ fetchImpl = fetch, token, repository, state }) {
  const authToken = requiredText(token, "GitHub token");
  const repo = requiredText(repository, "GitHub repository");
  if (state !== "open" && state !== "closed") throw new Error("GitHub pull request state must be open or closed");
  const pullRequests = [];

  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(`https://api.github.com/repos/${repo}/pulls`);
    url.searchParams.set("state", state);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    if (state === "closed") {
      url.searchParams.set("sort", "updated");
      url.searchParams.set("direction", "desc");
    }

    const data = await requireJson(
      await fetchImpl(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${authToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }),
      `GitHub ${state} pull request listing`
    );
    if (!Array.isArray(data)) throw new Error(`GitHub ${state} pull request listing returned an invalid payload`);
    pullRequests.push(...data);
    if (data.length < 100) return pullRequests;
  }

  throw new Error(`GitHub ${state} pull request pagination exceeded the safety limit`);
}

export function listOpenPullRequests(options) {
  return listPullRequestsByState({ ...options, state: "open" });
}

export function listClosedPullRequests(options) {
  return listPullRequestsByState({ ...options, state: "closed" });
}
