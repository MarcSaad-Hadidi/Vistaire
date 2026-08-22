import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildHomeAgentLinkHeader } from "../lib/agent-discovery/index.ts";

async function readVercelConfig() {
  return JSON.parse(await readFile("vercel.json", "utf8"));
}

function applyVaryTransforms(value, transforms) {
  let tokens = commaSeparatedTokens(value);

  for (const transform of transforms) {
    const args = String(transform.args).toLowerCase();
    if (transform.op === "delete") {
      tokens = tokens.filter((token) => token !== args);
    } else if (transform.op === "append") {
      tokens.push(args);
    } else {
      throw new Error(`unexpected Vary transform operation: ${transform.op}`);
    }
  }

  return tokens;
}

function commaSeparatedTokens(value) {
  return value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

test("Vercel disables only bot preview deployments", async () => {
  const config = await readVercelConfig();

  assert.equal(config.$schema, "https://openapi.vercel.sh/vercel.json");
  assert.deepEqual(config.git, {
    deploymentEnabled: {
      "dependabot/**": false,
      "renovate/**": false
    }
  });
  assert.deepEqual(Object.keys(config.git.deploymentEnabled).sort(), [
    "dependabot/**",
    "renovate/**"
  ]);
  assert.equal(config.git.deploymentEnabled.main, undefined);
  assert.equal(
    config.git.deploymentEnabled["perf/vercel-fluid-cpu-static-public"],
    undefined
  );
  assert.equal(config.git.deploymentEnabled["**"], undefined);
});

test("Vercel normalizes root discovery headers without dropping Markdown Vary", async () => {
  const config = await readVercelConfig();

  assert.equal(config.routes.length, 1);
  const [route] = config.routes;
  assert.deepEqual(Object.keys(route).sort(), [
    "continue",
    "methods",
    "src",
    "transforms"
  ]);
  assert.equal(route.src, "^/$");
  assert.deepEqual(route.methods, ["GET", "HEAD"]);
  assert.equal(route.continue, true);
  assert.equal(new RegExp(route.src).test("/"), true);
  for (const pathname of [
    "/en",
    "/a-propos",
    "/owner",
    "/todos",
    "/api/analytics/summary",
    "/menu/maison-elyse"
  ]) {
    assert.equal(new RegExp(route.src).test(pathname), false, pathname);
  }

  assert.deepEqual(route.transforms, [
    {
      type: "response.headers",
      op: "set",
      target: { key: "Link" },
      args: buildHomeAgentLinkHeader()
    },
    {
      type: "response.headers",
      op: "delete",
      target: { key: "Vary" },
      args: "rsc"
    },
    {
      type: "response.headers",
      op: "append",
      target: { key: "Vary" },
      args: "rsc"
    },
    {
      type: "response.headers",
      op: "delete",
      target: { key: "Vary" },
      args: "Accept"
    },
    {
      type: "response.headers",
      op: "append",
      target: { key: "Vary" },
      args: "Accept"
    }
  ]);

  const varyTransforms = route.transforms.filter(
    (transform) => transform.target.key.toLowerCase() === "vary"
  );
  const tokens = applyVaryTransforms(
    "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, future-router-token, ACCEPT, Accept-Encoding, accept",
    varyTransforms
  );
  assert.deepEqual(tokens, [
    "next-router-state-tree",
    "next-router-prefetch",
    "next-router-segment-prefetch",
    "future-router-token",
    "accept-encoding",
    "rsc",
    "accept"
  ]);
  assert.equal(tokens.filter((token) => token === "rsc").length, 1);
  assert.equal(tokens.filter((token) => token === "accept").length, 1);

  const markdownTokens = applyVaryTransforms("Accept", varyTransforms);
  assert.deepEqual(markdownTokens, ["rsc", "accept"]);
});
