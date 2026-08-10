import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);
const appCiWorkflow = await readFile(
  new URL("../.github/workflows/app-ci.yml", import.meta.url),
  "utf8"
);

test("Prompt 5 browser specs start the shared public-menu fixture", async () => {
  const runner = await readFile(
    new URL("../scripts/run-playwright-e2e.mjs", import.meta.url),
    "utf8"
  );

  assert.match(
    runner,
    /const includesPrompt5BrowserFlow[\s\S]*prompt5-\(\?:pdf-comparison\|faq\|footer\|guides\)/,
    "Prompt 5 routes render shared menu previews and require the hermetic fixture"
  );
  assert.match(
    runner,
    /includesPrompt5BrowserFlow[\s\S]*new URL\("\/robots\.txt", baseURL\)/,
    "Prompt 5 startup must probe a static route instead of compiling the landing page"
  );
  assert.match(
    runner,
    /PROMPT5_WARMUP_ROUTES[\s\S]*\/menu-pdf-vs-menu-digital[\s\S]*\/en\/pdf-vs-digital-menu[\s\S]*\/menu-qr-code-restaurant/,
    "Prompt 5 must compile its FAQ routes before the browser timeout starts"
  );
  assert.match(
    runner,
    /useLocalDemoServer[\s\S]*waitForServer\(baseURL, 300_000\)/,
    "the local core suite must precompile its landing route before Playwright starts"
  );
});

test("the SEO browser CI family executes every Prompt 5 suite", () => {
  const seoBrowserScript = packageJson.scripts["test:seo:e2e"];

  for (const spec of [
    "prompt5-pdf-comparison.spec.ts",
    "prompt5-faq.spec.ts",
    "prompt5-footer.spec.ts",
    "prompt5-guides.spec.ts"
  ]) {
    assert.match(
      seoBrowserScript,
      new RegExp(`e2e/${spec.replaceAll(".", "\\.")}`),
      `${spec} must run in the SEO browser CI family`
    );
  }

  const publicJob = appCiWorkflow.slice(
    appCiWorkflow.indexOf("  e2e-public-chromium:"),
    appCiWorkflow.indexOf("  e2e-sauge-chromium:")
  );
  assert.match(publicJob, /run: npm run test:seo:e2e/);
  assert.match(publicJob, /outputs\.run_seo == 'true'/);
});
