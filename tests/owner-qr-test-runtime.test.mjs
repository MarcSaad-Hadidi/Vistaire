import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the QR loader resolves next/server before registering its resolve hook", async () => {
  const source = await readFile(
    new URL("./helpers/owner-qr-test-runtime.mjs", import.meta.url),
    "utf8"
  );
  const registerHooksOffset = source.indexOf("registerHooks({");
  const precomputedOffset = source.indexOf(
    'const NEXT_SERVER_URL = pathToFileURL(requireDependency.resolve("next/server")).href;'
  );
  const hookSource = source.slice(registerHooksOffset);

  assert.ok(registerHooksOffset > 0, "the runtime must register its loader hooks");
  assert.ok(
    precomputedOffset > 0 && precomputedOffset < registerHooksOffset,
    "next/server must be resolved before registerHooks to avoid recursive Node 24 resolution"
  );
  assert.doesNotMatch(
    hookSource,
    /requireDependency\.resolve\(specifier\)/,
    "the active resolve hook must not call require.resolve recursively"
  );
  assert.match(hookSource, /url:\s*NEXT_SERVER_URL/);
});
