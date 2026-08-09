import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
});
