import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AGENT_SKILL_DOCS,
  LINKSET_CONTENT_TYPE,
  MARKDOWN_CONTENT_TYPE,
  buildAgentSkillsIndex,
  buildApiCatalog,
  buildAuthMarkdown,
  buildHomeAgentLinkHeader,
  buildHomepageMarkdown,
  buildMcpServerCard,
  buildOauthProtectedResourceMetadata,
  buildOpenApiDocument,
  shouldServeMarkdownForAcceptHeader
} from "../lib/agent-discovery/index.ts";

const repoRoot = process.cwd();

function readRepoFile(path) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

test("homepage discovery headers use registered or documented link relations", () => {
  const header = buildHomeAgentLinkHeader();

  assert.ok(header.includes('</.well-known/api-catalog>; rel="api-catalog"'));
  assert.ok(header.includes('</.well-known/agent-skills/index.json>; rel="service-desc"'));
  assert.ok(header.includes('</.well-known/mcp/server-card.json>; rel="service-desc"'));
  assert.ok(header.includes('</auth.md>; rel="service-doc"'));
  assert.ok(header.includes('</docs/api>; rel="service-doc"'));
});

test("markdown negotiation source is useful and configured through proxy", () => {
  const proxySource = readRepoFile("proxy.ts");
  const discoverySource = readRepoFile("lib/agent-discovery/index.ts");
  const markdown = buildHomepageMarkdown();

  assert.match(proxySource, /Accept/);
  assert.match(discoverySource, /text\/markdown/);
  assert.match(proxySource, /Vary/);
  assert.equal(MARKDOWN_CONTENT_TYPE, "text/markdown; charset=utf-8");
  assert.match(markdown, /^# Vistaire/m);
  assert.match(markdown, /Agent discovery/);
  assert.doesNotMatch(markdown, /<html/i);
});

test("markdown negotiation honors Accept q-values and HTML preference", () => {
  assert.equal(shouldServeMarkdownForAcceptHeader("text/markdown"), true);
  assert.equal(shouldServeMarkdownForAcceptHeader("text/html, text/markdown;q=0"), false);
  assert.equal(shouldServeMarkdownForAcceptHeader("text/html;q=1, text/markdown;q=0.5"), false);
  assert.equal(shouldServeMarkdownForAcceptHeader("text/markdown;q=0.9, text/html;q=0.1"), true);
  assert.equal(shouldServeMarkdownForAcceptHeader("text/html, text/markdown"), false);
  assert.equal(shouldServeMarkdownForAcceptHeader("text/markdown, text/html"), true);
  assert.equal(shouldServeMarkdownForAcceptHeader("*/*"), false);
});

test("api catalog is a conservative RFC 9727 linkset", () => {
  const catalog = buildApiCatalog();

  assert.equal(
    LINKSET_CONTENT_TYPE,
    'application/linkset+json; charset=utf-8; profile="https://www.rfc-editor.org/info/rfc9727"'
  );
  assert.ok(Array.isArray(catalog.linkset));
  assert.equal(catalog.linkset.length, 1);
  assert.ok(catalog.linkset[0].anchor.endsWith("/.well-known/api-catalog"));
  assert.ok(catalog.linkset[0]["service-desc"][0].href.endsWith("/openapi.json"));
  assert.ok(catalog.linkset[0]["service-doc"].some((link) => link.href.endsWith("/auth.md")));
  assert.ok(!JSON.stringify(catalog).includes("/api/owner"));
});

test("agent skills index digests match served skill content", () => {
  const index = buildAgentSkillsIndex();

  assert.equal(index.$schema, "https://schemas.agentskills.io/discovery/0.2.0/schema.json");
  assert.equal(index.skills.length, AGENT_SKILL_DOCS.length);

  for (const skill of index.skills) {
    const source = AGENT_SKILL_DOCS.find((candidate) => candidate.name === skill.name);
    assert.ok(source, `missing source for ${skill.name}`);
    const digest = sha256(source.content);
    assert.equal(skill.digest, `sha256:${digest}`);
    assert.equal(skill.sha256, digest);
    assert.equal(skill.type, "skill-md");
    assert.match(skill.url, /^https:\/\/www\.vistaire\.ca\//);
  }
});

test("auth and protected resource metadata do not invent OAuth server endpoints", () => {
  const authMarkdown = buildAuthMarkdown();
  const metadata = buildOauthProtectedResourceMetadata();

  assert.match(authMarkdown, /^# Vistaire auth\.md/m);
  assert.match(authMarkdown, /does not currently provide self-service agent registration/);
  assert.match(authMarkdown, /Clerk session authentication/);
  assert.match(authMarkdown, /Supabase is used for data and storage/);
  assert.match(authMarkdown, /OAuth Protected Resource Metadata/);
  assert.deepEqual(metadata.authorization_servers, []);
  assert.equal(Object.hasOwn(metadata, "scopes_supported"), false);
  assert.deepEqual(metadata.bearer_methods_supported, []);
  assert.ok(metadata.resource.endsWith("/"));
  assert.equal(metadata.resource_documentation, "https://www.vistaire.ca/auth.md");
  assert.match(metadata.oauth_status, /not_available/);
  assert.ok(!JSON.stringify(metadata).includes("token_endpoint"));
  assert.ok(!JSON.stringify(metadata).includes("authorization_endpoint"));
  assert.ok(!JSON.stringify(metadata).includes("owner:write"));
  assert.doesNotMatch(authMarkdown, /^agent_auth:/m);
  assert.doesNotMatch(authMarkdown, /register_uri:\s*https?:\/\//);
});

test("auth copy distinguishes protected owner routes from public admin preview", () => {
  const authMarkdown = buildAuthMarkdown();

  assert.doesNotMatch(authMarkdown, /Owner\/admin routes are protected/);
  assert.match(authMarkdown, /Owner routes and owner APIs/);
  assert.match(authMarkdown, /admin.*public.*noindex/i);
});

test("public OpenAPI document excludes owner admin and auth server endpoints", () => {
  const openApi = buildOpenApiDocument();
  const paths = Object.keys(openApi.paths);
  const serialized = JSON.stringify(openApi);

  assert.deepEqual(paths.sort(), [
    "/api/exchange-rates",
    "/api/public/menu-dishes/{dishId}/model/glb",
    "/api/public/menu-dishes/{dishId}/model/usdz",
    "/api/public/menu-dishes/{dishId}/photo"
  ].sort());
  assert.doesNotMatch(serialized, /\/api\/owner/);
  assert.doesNotMatch(serialized, /\/api\/admin/);
  assert.doesNotMatch(serialized, /\/owner/);
  assert.doesNotMatch(serialized, /\/admin/);
  assert.doesNotMatch(serialized, /\/oauth\/token|\/oauth\/authorize|jwks/i);
  assert.ok(paths.every((path) => openApi.paths[path].get));
  assert.ok(paths.every((path) => !openApi.paths[path].post));
});

test("mcp server card is explicit about missing backend transport", () => {
  const card = buildMcpServerCard();

  assert.equal(card.serverInfo.name, "Vistaire");
  assert.equal(card.endpoint, null);
  assert.equal(card.status, "not_available");
  assert.deepEqual(card.transports, []);
  assert.deepEqual(card.capabilities.tools, []);
  assert.ok(card.limitations.some((item) => item.includes("No remote MCP transport")));
});

test("WebMCP source is feature-detected and non-destructive", () => {
  const source = readRepoFile("components/agent/WebMcpProvider.tsx");

  assert.match(source, /navigator/);
  assert.match(source, /modelContext/);
  assert.match(source, /registerTool/);
  assert.match(source, /AbortController/);
  assert.doesNotMatch(source, /delete/i);
  assert.doesNotMatch(source, /upload/i);
  assert.doesNotMatch(source, /api\/owner/);
});

test("DNS-AID docs exist with manual SVCB and DNSSEC instructions", () => {
  const path = join(repoRoot, "docs", "agent-discovery", "dns-aid.md");
  assert.ok(existsSync(path));

  const docs = readFileSync(path, "utf8");
  assert.match(docs, /www\.vistaire\.ca/);
  assert.match(docs, /_index\._agents\.www\.vistaire\.ca/);
  assert.doesNotMatch(docs, /^_a2a\._agents\.www\.vistaire\.ca.*IN (?:SVCB|HTTPS)/m);
  assert.match(docs, /HTTPS/);
  assert.match(docs, /SVCB/);
  assert.match(docs, /alpn=/);
  assert.match(docs, /endpoint/);
  assert.match(docs, /DNSSEC/);
  assert.match(docs, /dig HTTPS _index\._agents\.www\.vistaire\.ca \+dnssec/);
  assert.match(docs, /manual DNS action required/i);
});

test("discovery outputs do not expose known secret names", () => {
  const outputs = [
    buildHomepageMarkdown(),
    buildAuthMarkdown(),
    JSON.stringify(buildApiCatalog()),
    JSON.stringify(buildAgentSkillsIndex()),
    JSON.stringify(buildMcpServerCard()),
    JSON.stringify(buildOauthProtectedResourceMetadata())
  ].join("\n");

  for (const forbidden of [
    "SUPABASE_SERVICE_ROLE",
    "CLERK_SECRET",
    "BREVO_API_KEY",
    "API_KEY",
    "SECRET",
    "TOKEN"
  ]) {
    assert.ok(!outputs.includes(forbidden), `discovery output contains ${forbidden}`);
  }
});
