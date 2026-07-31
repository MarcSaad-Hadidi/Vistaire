import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export%20default%20undefined",
        shortCircuit: true
      };
    }
    if (specifier === "next/cache") {
      return {
        url: "data:text/javascript,export%20const%20unstable_cache%3D(fn)%3D%3Efn",
        shortCircuit: true
      };
    }
    if (specifier.startsWith("@/")) {
      const baseUrl = new URL(specifier.slice(2), projectRootUrl);
      for (const extension of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
      const baseUrl = new URL(specifier, context.parentURL);
      for (const extension of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts") || url.endsWith(".tsx")) {
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022
          }
        }).outputText,
        shortCircuit: true
      };
    }
    return nextLoad(url, context);
  }
});

async function getFreePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  probe.close();
  await once(probe, "close");
  return port;
}

async function waitForFixture(origin, child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`fixture server exited with ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${origin}/fixture/health`);
      if (response.ok) return;
    } catch {
      // Keep polling during fixture startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("fixture server did not become healthy");
}

test("HTTP fixture projects English public menus into landing payloads", async () => {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const fixture = spawn(
    process.execPath,
    ["e2e/support/sauge-noire-fixture-server.mjs"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VISTAIRE_SAUGE_NOIRE_FIXTURE_PORT: String(port)
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    "sauge-noire-fixture-service-role-key";
  process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF = "";
  process.env.VISTAIRE_EXCHANGE_RATES_FIXTURE_JSON =
    '{"CAD":1,"USD":0.72,"EUR":0.6225}';
  process.env.NODE_ENV = "production";

  try {
    await waitForFixture(origin, fixture);
    const { resolvePublicMenuRenderContext } = await import(
      "../lib/menu/publicMenuRenderContext.ts"
    );
    const {
      getLandingExperiences,
      getLandingMenuPreviewPayload
    } = await import("../lib/landing/menuExperiences.ts");

    const context = await resolvePublicMenuRenderContext({
      slug: "maison-elyse",
      query: { lang: "en-CA" }
    });
    assert.ok(context);
    assert.equal(context.locale, "en");
    assert.equal(context.menu.activeLocale, "en-CA");
    assert.equal(context.menu.menuName, "The Menu");
    assert.equal(context.menu.dishes[0].category, "Starters");
    assert.equal(
      context.menu.dishes[0].name,
      "Fresh goat cheese ravioli with Monteregie honey"
    );

    const experiences = await getLandingExperiences("en");
    assert.equal(experiences.length, 3);
    const maisonExperience = experiences.find(
      (experience) => experience.id === "maison-elyse"
    );
    assert.ok(maisonExperience?.renderPayload);
    assert.equal(maisonExperience.renderPayload.locale, "en");
    assert.equal(
      maisonExperience.renderPayload.menuUi.menu.activeLocale,
      "en-CA"
    );
    assert.equal(
      maisonExperience.renderPayload.menuUi.menu.dishes[0].category,
      "Starters"
    );
    for (const experience of experiences) {
      const payload = await getLandingMenuPreviewPayload(experience.id, "en");
      assert.ok(payload, `missing ${experience.id} payload`);
      assert.equal(payload.locale, "en");
      assert.equal(payload.menuUi.menu.activeLocale, "en-CA");
      assert.equal(payload.menuUi.menu.menuName, "The Menu");
      assert.doesNotMatch(
        JSON.stringify(payload.menuUi.menu),
        /La Carte|Entrees|Beurre noisette|Produit de saison|À confirmer/
      );
    }
  } finally {
    fixture.kill();
    if (fixture.exitCode === null) await once(fixture, "exit");
  }
});
