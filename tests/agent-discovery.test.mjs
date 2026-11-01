import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import nextConfig from "../next.config.ts";
import { buildNotFoundMarkdown, buildPageMarkdown, isMissingRoute } from "../lib/agent-discovery/pageMarkdown.ts";
import * as agentDiscovery from "../lib/agent-discovery/index.ts";
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

function linkEntries(value) {
  return value
    .split(/,\s*(?=<)/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

test("homepage discovery headers use registered or documented link relations", () => {
  const header = buildHomeAgentLinkHeader();

  assert.equal(agentDiscovery.HOME_AGENT_LINK_HEADER, header);
  assert.equal(new Set(linkEntries(header)).size, linkEntries(header).length);
  assert.ok(header.includes('</.well-known/api-catalog>; rel="api-catalog"'));
  assert.ok(header.includes('</.well-known/agent-skills/index.json>; rel="service-desc"'));
  assert.ok(header.includes('</.well-known/mcp/server-card.json>; rel="service-desc"'));
  assert.ok(header.includes('</auth.md>; rel="service-doc"'));
  assert.ok(header.includes('</openapi.json>; rel="service-desc"'));
});

test("static homepage HTML has one shared Link value and delegates final Vary", async () => {
  const homepageRules = (await nextConfig.headers()).filter(
    (rule) => rule.source === "/"
  );

  assert.equal(homepageRules.length, 1);
  const linkHeaders = homepageRules[0].headers.filter(
    ({ key }) => key.toLowerCase() === "link"
  );
  const varyHeaders = homepageRules[0].headers.filter(
    ({ key }) => key.toLowerCase() === "vary"
  );

  assert.equal(linkHeaders.length, 1);
  assert.equal(linkHeaders[0].value, buildHomeAgentLinkHeader());
  assert.equal(
    new Set(linkEntries(linkHeaders[0].value)).size,
    linkEntries(linkHeaders[0].value).length
  );
  assert.equal(varyHeaders.length, 0);
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

  for (const path of paths.filter((path) =>
    path.startsWith("/api/public/menu-dishes/")
  )) {
    const responses = openApi.paths[path].get.responses;
    assert.equal(Object.hasOwn(responses, "200"), false, path);
    assert.deepEqual(responses["307"], {
      description: "Empty redirect to the signed Storage object",
      headers: {
        Location: {
          required: true,
          schema: { type: "string", format: "uri" }
        }
      }
    });
    assert.equal(Object.hasOwn(responses["307"], "content"), false, path);
    // redirectPublicDishAsset answers JSON 404 and 503 for every dish asset route
    for (const status of ["404", "503"]) {
      assert.equal(responses[status].content["application/json"].schema.$ref, "#/components/schemas/Error", `${path} ${status}`);
    }
  }
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
    "RESEND_API_KEY",
    "API_KEY",
    "SECRET",
    "TOKEN"
  ]) {
    assert.ok(!outputs.includes(forbidden), `discovery output contains ${forbidden}`);
  }
});

test("agent readiness gaps: when-to-use, trust redirect, og:type, Organization address", async () => {
  assert.match(readRepoFile("public/llms.txt"), /^## When to use Vistaire$/m);
  assert.match(readRepoFile("app/(fr)/page.tsx"), /type: "website"/);
  assert.match(readRepoFile("lib/seo.ts"), /"@type": "Organization",[\s\S]*?address: ORGANIZATION_ADDRESS_JSON_LD/);

  const redirects = await nextConfig.redirects();
  assert.ok(redirects.some((r) => r.source === "/about" && r.destination === "/a-propos"));
});

test("unknown API paths answer a structured JSON 404", async () => {
  const routeModule = await import("../app/api/[[...path]]/route.ts");
  const { GET } = routeModule;
  // Every method, OPTIONS included, gets the same 404 instead of Next's auto 204.
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) assert.equal(routeModule[method], GET, method);
  const response = GET();
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /application\/json/);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.code, "not_found");
  assert.ok(body.hint.includes("/openapi.json"));
});

test("markdown 404 only when the app itself answers 404 for the path", async () => {
  const calls = [];
  const fakeFetch = (status) => async (url, init) => {
    calls.push({ url: String(url), init });
    if (status instanceof Error) throw status;
    return new Response(null, { status });
  };
  const url = new URL("https://www.vistaire.ca/guides/missing.json?x=1");
  assert.equal(await isMissingRoute(url, fakeFetch(404)), true);
  assert.equal(await isMissingRoute(url, fakeFetch(200)), false);
  assert.equal(await isMissingRoute(url, fakeFetch(307)), false);
  assert.equal(await isMissingRoute(url, fakeFetch(new Error("offline"))), false);
  assert.equal(calls[0].url, url.href);
  assert.equal(calls[0].init.method, "HEAD");
  assert.equal(calls[0].init.redirect, "manual");
  assert.match(calls[0].init.headers.accept, /text\/html/);
  // API paths keep their own JSON 404 body, so they are never probed.
  const before = calls.length;
  assert.equal(await isMissingRoute(new URL("https://www.vistaire.ca/api/nope"), fakeFetch(404)), false);
  assert.equal(await isMissingRoute(new URL("https://www.vistaire.ca/api"), fakeFetch(404)), false);
  // A probe GETs the route: /q/<token> would record a second QR scan.
  assert.equal(await isMissingRoute(new URL("https://www.vistaire.ca/q/live-token"), fakeFetch(404)), false);
  assert.equal(calls.length, before);
  // Only the single-segment scan route is exempt; other /q paths are probed normally.
  assert.equal(await isMissingRoute(new URL("https://www.vistaire.ca/q"), fakeFetch(404)), true);
  assert.equal(await isMissingRoute(new URL("https://www.vistaire.ca/q/token/extra"), fakeFetch(404)), true);

  const markdown = buildNotFoundMarkdown("/__probe");
  assert.ok(markdown.length > 20);
  assert.match(markdown, /\/llms\.txt/);
});

test("developer resources are discoverable: skills when-to-use, /developers, /privacy", async () => {
  for (const skill of AGENT_SKILL_DOCS) {
    assert.match(skill.content, /^## When to use$/m, skill.name);
  }

  const redirects = await nextConfig.redirects();
  assert.ok(redirects.some((r) => r.source === "/privacy" && r.destination === "/politique-de-confidentialite"));
  assert.ok(redirects.some((r) => r.source === "/docs" && r.destination === "/developers"));

  // FR and EN pages share one content module, which also feeds their Markdown twins.
  for (const path of ["/developers", "/en/developers"]) {
    const markdown = buildPageMarkdown(path);
    assert.ok(markdown, path);
    for (const resource of ["/openapi.json", "/auth.md", "/llms.txt", "/.well-known/agent-skills/index.json", "/api/exchange-rates"]) {
      assert.ok(markdown.includes(resource), `${path} ${resource}`);
    }
  }
  assert.ok(existsSync(join(repoRoot, "app/(en)/en/developers/page.tsx")));
  // Footer links go through the bilingual route map, so English pages reach /en/developers.
  const { getLocalizedPath } = await import("../lib/i18n.ts");
  assert.equal(getLocalizedPath("/developers", "en"), "/en/developers");
  const { getPublicFooterNavigation } = await import("../lib/publicFooterNavigation.ts");
  for (const locale of ["fr", "en"]) {
    const hrefs = getPublicFooterNavigation(locale).flatMap((group) => group.links.map((entry) => entry.href));
    assert.ok(hrefs.includes(getLocalizedPath("/developers", locale)), locale);
  }
  assert.match(readRepoFile("public/llms.txt"), /https:\/\/www\.vistaire\.ca\/developers/);

  const { buildSitemapEntries } = await import("../lib/seo.ts");
  for (const path of ["/developers", "/en/developers"]) {
    assert.ok(buildSitemapEntries().some((entry) => new URL(entry.url).pathname === path), path);
  }
});

test("developer pages describe each error body the API really returns", async () => {
  const { DEVELOPERS_PAGE } = await import("../lib/developersPage.ts");
  for (const page of Object.values(DEVELOPERS_PAGE)) {
    const text = page.sections.flatMap((section) => section.paragraphs ?? []).join(" ");
    // Only the unknown-path catch-all adds code and hint; dish media keep { ok, error }.
    assert.match(text, /\/api/, page.locale);
    assert.match(text, /`\{ "ok": false, "error": "…" \}`/, page.locale);
    assert.match(text, /404/, page.locale);
    assert.match(text, /503/, page.locale);
  }
});
