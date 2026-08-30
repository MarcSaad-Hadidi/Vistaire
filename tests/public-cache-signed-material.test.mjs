import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const baseUrl = new URL(specifier.slice(2), projectRootUrl);
      for (const extension of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
      const baseUrl = new URL(specifier, context.parentURL);
      for (const extension of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
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

const safety = await import("../lib/cache/publicCacheSafety.ts");

function rejected(candidate, expectedReason) {
  let caught;
  try {
    safety.assertPublicCacheSafe(candidate);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof safety.PublicCacheSafetyError);
  assert.equal(caught.reason, expectedReason);
  return caught;
}

test("recursive safety rejects mixed-case credential fields anywhere in the candidate", () => {
  for (const field of [
    "SeCrEt",
    "SERVICE_KEY",
    "accessToken",
    "SESSION",
    "Authorization",
    "CoOkIe",
    "X_Amz_Credential",
    "X_Amz_Expires",
    "X_Amz_Algorithm",
    "X_Amz_Date",
    "X_Amz_SignedHeaders",
    "AWSAccessKeyId",
    "service_role",
    "SUPABASE_SERVICE_ROLE_KEY",
    "signedURL"
  ]) {
    const error = rejected(
      { menu: { config: { cards: [{ [field]: "never-print-this-sentinel" }] } } },
      "credential-field"
    );
    assert.doesNotMatch(error.message, /never-print-this-sentinel/i);
  }
});

test("recursive safety rejects URL userinfo, signed Storage paths and credential queries", () => {
  const privateUrls = [
    "https://user:never-print-this-sentinel@cdn.example.test/dish.webp",
    "//user:never-print-this-sentinel@cdn.example.test/dish.webp",
    "https://project.supabase.co/STORAGE/V1/OBJECT/SIGN/dishes/live.webp",
    "https://cdn.example.test/dish.webp?ToKeN=never-print-this-sentinel",
    "https://cdn.example.test/dish.webp?SIGNATURE=never-print-this-sentinel",
    "https://cdn.example.test/dish.webp?Expires=9999999999",
    "https://cdn.example.test/dish.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256",
    "https://cdn.example.test/dish.webp?X-Amz-Credential=never-print-this-sentinel",
    "https://cdn.example.test/dish.webp?X-Amz-Expires=900",
    "https://cdn.example.test/dish.webp?X-Amz-Signature=never-print-this-sentinel",
    "https://cdn.example.test/dish.webp?X-Amz-Security-Token=never-print-this-sentinel",
    "/redirect?next=https%3A%2F%2Fcdn.example.test%2Fdish.webp%3Ftoken%3Dnever-print-this-sentinel"
  ];

  for (const url of privateUrls) {
    const error = rejected({ ui: { redirects: [url] } }, "private-url");
    assert.equal(safety.isPrivateCapabilityUrl(url), true, url);
    assert.doesNotMatch(error.message, /never-print-this-sentinel|cdn\.example|supabase/i);
  }
});

test("nested redirects and browser-normalized backslash URLs fail closed", () => {
  let nested =
    "https://cdn.example.test/dish.webp?token=never-print-this-sentinel";
  for (let depth = 0; depth < 5; depth += 1) {
    nested = `/redirect?next=${encodeURIComponent(nested)}`;
  }

  const ambiguousUrls = [
    nested,
    String.raw`https:\\user:never-print-this-sentinel@cdn.example.test/dish.webp`,
    String.raw`\\user:never-print-this-sentinel@cdn.example.test/dish.webp`
  ];
  for (const url of ambiguousUrls) {
    const error = rejected({ redirect: url }, "private-url");
    assert.equal(safety.isPrivateCapabilityUrl(url), true);
    assert.doesNotMatch(error.message, /never-print-this-sentinel|cdn\.example/i);
  }
});

test("non-public data, blob and file URL protocols fail closed", () => {
  for (const url of [
    "data:image/png;base64,bmV2ZXItcHJpbnQtdGhpcy1zZW50aW5lbA==",
    "blob:https://vistaire.test/never-print-this-sentinel",
    "file:///never-print-this-sentinel/menu.json"
  ]) {
    const error = rejected({ media: url }, "private-url");
    assert.equal(safety.isPrivateCapabilityUrl(url), true);
    assert.doesNotMatch(error.message, /never-print-this-sentinel|data:|blob:|file:/i);
  }
});

test("safe public assets, canonical photos and internal redirects remain cacheable", () => {
  const shared = { image: "https://cdn.example.test/dish.webp?width=960&v=release-7" };
  const candidate = {
    menu: {
      image: "/images/landing/dish.webp",
      photo: "/api/public/menu-dishes/dish-id/photo?v=release-7",
      redirects: [
        "/menu/maison-elyse?lang=fr",
        "/en/pdf-vs-digital-menu#comparison"
      ],
      config: {
        cards: [shared, { nested: shared }],
        isSignature: true
      }
    }
  };

  assert.equal(safety.assertPublicCacheSafe(candidate), candidate);
  assert.equal(safety.isPrivateCapabilityUrl("/menu/trouvable?lang=en"), false);
  assert.equal(
    safety.isPrivateCapabilityUrl("https://cdn.example.test/dish.webp?v=7"),
    false
  );
});

test("cycles and traversal limit overflows fail closed", () => {
  const cycle = { menu: {} };
  cycle.menu.back = cycle;
  assert.equal(rejected(cycle, "cycle").path, "$.menu.back");

  const tooDeep = { a: { b: { c: { d: "safe" } } } };
  assert.equal(
    rejectedWithOptions(tooDeep, { maxDepth: 2 }).reason,
    "depth-limit"
  );

  const tooMany = { values: ["one", "two", "three", "four"] };
  assert.equal(
    rejectedWithOptions(tooMany, { maxNodes: 4 }).reason,
    "node-limit"
  );
});

test("larger cache budgets require an explicit bounded opt-in", () => {
  const candidate = {
    values: Array.from(
      { length: safety.PUBLIC_CACHE_SAFETY_DEFAULT_MAX_NODES },
      () => null
    )
  };

  assert.equal(rejected(candidate, "node-limit").reason, "node-limit");
  assert.equal(
    safety.assertPublicCacheSafe(candidate, {
      maxNodes: safety.PUBLIC_CACHE_SAFETY_MAX_NODES
    }),
    candidate
  );
  assert.throws(
    () =>
      safety.assertPublicCacheSafe(candidate, {
        maxNodes: safety.PUBLIC_CACHE_SAFETY_MAX_NODES + 1
      }),
    TypeError
  );
});

test("array accessors and non-index properties are rejected without invocation", () => {
  let getterInvoked = false;
  const accessorArray = [];
  Object.defineProperty(accessorArray, "0", {
    enumerable: true,
    get() {
      getterInvoked = true;
      throw new Error("never-print-this-sentinel");
    }
  });
  accessorArray.length = 1;

  const accessorError = rejected(
    { values: accessorArray },
    "non-serializable"
  );
  assert.equal(getterInvoked, false);
  assert.doesNotMatch(accessorError.message, /never-print-this-sentinel/i);

  const extraProperty = ["safe"];
  extraProperty.SeCrEt = "never-print-this-sentinel";
  assert.equal(
    rejected({ values: extraProperty }, "credential-field").path,
    "$.values.SeCrEt"
  );

  const symbolProperty = ["safe"];
  symbolProperty[Symbol("never-print-this-sentinel")] = "safe";
  const symbolError = rejected(
    { values: symbolProperty },
    "non-serializable"
  );
  assert.doesNotMatch(symbolError.message, /never-print-this-sentinel/i);
});

function rejectedWithOptions(candidate, options) {
  let caught;
  try {
    safety.assertPublicCacheSafe(candidate, options);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof safety.PublicCacheSafetyError);
  return caught;
}

test("errors redact credential values, full URLs and hostile structural keys", () => {
  const hostileKey =
    "https://user:never-print-this-sentinel@cdn.example.test/dish.webp?token=never-print-this-sentinel";
  const error = rejected({ config: { [hostileKey]: "otherwise-safe" } }, "private-url");

  assert.equal(error.path, '$.config["<field>"]');
  assert.match(error.message, /public cache candidate rejected/i);
  assert.doesNotMatch(
    error.message,
    /never-print-this-sentinel|cdn\.example|https?:\/\//i
  );
  assert.equal("candidate" in error, false);
  assert.equal("value" in error, false);
  assert.equal("url" in error, false);
});

test("non-serializable and non-finite candidate values are rejected", () => {
  assert.equal(rejected({ value: Number.NaN }, "non-serializable").path, "$.value");
  assert.equal(rejected({ value: 1n }, "non-serializable").path, "$.value");
  assert.equal(rejected({ value: new Map() }, "non-serializable").path, "$.value");
});
