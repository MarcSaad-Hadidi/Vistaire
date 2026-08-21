import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const nextCacheHooksSymbol = Symbol.for("vistaire.test.next-cache-hooks");
const nextCacheModuleUrl = `data:text/javascript,${encodeURIComponent(`
  function hooks() {
    const value = globalThis[Symbol.for("vistaire.test.next-cache-hooks")];
    if (!value) throw new Error("Missing test next/cache hooks.");
    return value;
  }
  export function revalidatePath(...args) {
    return hooks().revalidatePath(...args);
  }
  export function revalidateTag(...args) {
    return hooks().revalidateTag(...args);
  }
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export%20default%20undefined",
        shortCircuit: true
      };
    }
    if (specifier === "next/cache") {
      return { url: nextCacheModuleUrl, shortCircuit: true };
    }
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

const revalidation = await import("../lib/owner/menuMutationRevalidation.ts");

const FEATURED_STATIC_PATHS = [
  "/",
  "/en",
  "/menu-digital-restaurant",
  "/menu-pdf-vs-menu-digital",
  "/en/digital-restaurant-menu",
  "/en/pdf-vs-digital-menu"
];

function nextCacheRecorder({ failAt = -1, events = [] } = {}) {
  const calls = [];
  globalThis[nextCacheHooksSymbol] = {
    revalidateTag(tag, profile) {
      const call = { kind: "tag", target: tag, profile };
      calls.push(call);
      events.push(`tag:${tag}`);
      if (calls.length - 1 === failAt) {
        throw new Error("never-print-this-scheduling-sentinel");
      }
    },
    revalidatePath(path) {
      const call = { kind: "path", target: path };
      calls.push(call);
      events.push(`path:${path}`);
      if (calls.length - 1 === failAt) {
        throw new Error("never-print-this-scheduling-sentinel");
      }
    }
  };
  return calls;
}

function restaurantClient(row, events = []) {
  let reads = 0;
  return {
    get reads() {
      return reads;
    },
    from(table) {
      assert.equal(table, "restaurants");
      events.push("identity:restaurants");
      const builder = {
        select(columns) {
          assert.equal(columns, "slug,name");
          return builder;
        },
        eq(column, value) {
          assert.equal(column, "id");
          assert.equal(value, "restaurant-id");
          return builder;
        },
        async maybeSingle() {
          reads += 1;
          return { data: row, error: null };
        }
      };
      return builder;
    }
  };
}

async function featuredIdentity(overrides = {}) {
  return revalidation.resolvePublicMutationIdentity({
    client: restaurantClient({ slug: "Maison Élyse", name: "ignored" }),
    restaurantId: "restaurant-id",
    dishSlug: " Plat du Chef ",
    ...overrides
  });
}

test("public mutation identity is resolved before commit and retains canonical delete data", async () => {
  const events = [];
  const client = restaurantClient(
    { slug: "", name: " Maison Élyse " },
    events
  );

  const identity = await revalidation.resolvePublicMutationIdentity({
    client,
    restaurantId: "restaurant-id",
    dishSlug: " Plat Éphémère "
  });
  events.push("commit:delete");

  assert.deepEqual(identity, {
    restaurantId: "restaurant-id",
    restaurantSlug: "maison-elyse",
    restaurantKey: "maison-elyse",
    featuredExperienceId: "maison-elyse",
    dishSlug: "plat-ephemere"
  });
  assert.deepEqual(events, ["identity:restaurants", "commit:delete"]);
  assert.equal(client.reads, 1);
});

test("featured commits enqueue exact locale tags, precise menu paths and six static paths", async () => {
  const calls = nextCacheRecorder();
  const report = await revalidation.invalidateCommittedPublicMutation(
    await featuredIdentity()
  );

  assert.deepEqual(
    calls.filter((call) => call.kind === "tag"),
    [
      {
        kind: "tag",
        target: "vistaire-public:v1:landing:restaurant=maison-elyse:experience=maison-elyse:locale=fr",
        profile: { expire: 0 }
      },
      {
        kind: "tag",
        target: "vistaire-public:v1:landing:restaurant=maison-elyse:experience=maison-elyse:locale=en",
        profile: { expire: 0 }
      }
    ]
  );
  assert.deepEqual(
    calls.filter((call) => call.kind === "path").map((call) => call.target),
    [
      "/menu/maison-elyse",
      "/menu/maison-elyse/dishes/plat-du-chef",
      ...FEATURED_STATIC_PATHS
    ]
  );
  assert.deepEqual(report, {
    attempted: 10,
    queuedCallReturned: 10,
    enqueueErrors: []
  });
  assert.equal("expired" in report, false);
  assert.equal("success" in report, false);
});

test("non-featured commits remain isolated to their precise public menu paths", async () => {
  const calls = nextCacheRecorder();
  const identity = await revalidation.resolvePublicMutationIdentity({
    client: restaurantClient({ slug: "Chez Léa", name: "Chez Léa" }),
    restaurantId: "restaurant-id",
    dishSlug: "Soupe du Jour"
  });
  const report = await revalidation.invalidateCommittedPublicMutation(identity);

  assert.deepEqual(calls, [
    { kind: "path", target: "/menu/chez-lea" },
    { kind: "path", target: "/menu/chez-lea/dishes/soupe-du-jour" }
  ]);
  assert.deepEqual(report, {
    attempted: 2,
    queuedCallReturned: 2,
    enqueueErrors: []
  });
});

test("every enqueue call is attempted after one fails and the report stays redacted", async () => {
  const calls = nextCacheRecorder({ failAt: 0 });
  const report = await revalidation.invalidateCommittedPublicMutation(
    await featuredIdentity()
  );

  assert.equal(calls.length, 10);
  assert.deepEqual(report, {
    attempted: 10,
    queuedCallReturned: 9,
    enqueueErrors: [
      { kind: "tag", operationIndex: 0, code: "enqueue_call_failed" }
    ]
  });
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /never-print-this|expired|success/i);
});

async function invokeLikeNext(handler, events) {
  try {
    const response = await handler();
    assert.ok(response instanceof Response);
    events.push("next:pending-revalidation-flush");
    return response;
  } catch (error) {
    events.push("next:throw-bypassed-flush");
    throw error;
  }
}

async function committedRouteHandler({ events, cleanup, outcome = "committed" }) {
  const identity = await revalidation.resolvePublicMutationIdentity({
    client: restaurantClient({ slug: "Maison Élyse", name: "Maison Élyse" }, events),
    restaurantId: "restaurant-id",
    dishSlug: "Plat du Chef"
  });

  if (["failed", "noop", "draft", "dry-run"].includes(outcome)) {
    events.push(`result:${outcome}`);
    return new Response(JSON.stringify({ ok: outcome !== "failed", outcome }), {
      status: outcome === "failed" ? 503 : 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  }

  events.push(`commit:${outcome}`);
  const scheduling = await revalidation.invalidateCommittedPublicMutation(identity);
  try {
    await cleanup?.();
  } catch {
    events.push("cleanup:caught");
    const retry = await revalidation.invalidateCommittedPublicMutation(identity);
    return new Response(
      JSON.stringify({
        ok: false,
        committed: true,
        cleanup: "failed",
        scheduling: {
          attempted: scheduling.attempted + retry.attempted,
          queuedCallReturned:
            scheduling.queuedCallReturned + retry.queuedCallReturned,
          enqueueErrorCount:
            scheduling.enqueueErrors.length + retry.enqueueErrors.length
        }
      }),
      {
        status: 202,
        headers: { "content-type": "application/json", "cache-control": "no-store" }
      }
    );
  }

  return new Response(JSON.stringify({ ok: true, committed: true }), {
    status: outcome === "partial" ? 207 : 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

test("a post-commit cleanup error is caught, rescheduled and returned as a controlled Response", async () => {
  const events = [];
  const calls = nextCacheRecorder({ events });
  const response = await invokeLikeNext(
    () =>
      committedRouteHandler({
        events,
        cleanup: async () => {
          events.push("cleanup:start");
          throw new Error("never-print-this-cleanup-sentinel");
        }
      }),
    events
  );

  assert.equal(response.status, 202);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    ok: false,
    committed: true,
    cleanup: "failed",
    scheduling: {
      attempted: 20,
      queuedCallReturned: 20,
      enqueueErrorCount: 0
    }
  });
  assert.equal(calls.length, 20, "cleanup catch must schedule the retained identity again");
  assert.ok(events.indexOf("identity:restaurants") < events.indexOf("commit:committed"));
  assert.ok(events.indexOf("commit:committed") < events.findIndex((event) => event.startsWith("tag:")));
  assert.ok(events.findIndex((event) => event.startsWith("path:")) < events.indexOf("cleanup:start"));
  assert.ok(events.indexOf("cleanup:caught") < events.indexOf("next:pending-revalidation-flush"));
  assert.equal(events.includes("next:throw-bypassed-flush"), false);
  assert.doesNotMatch(JSON.stringify(events), /never-print-this/);
});

test("only committed and partial outcomes schedule; failed, no-op, draft and dry-run outcomes do not", async () => {
  for (const outcome of ["failed", "noop", "draft", "dry-run"]) {
    const events = [];
    const calls = nextCacheRecorder({ events });
    const response = await invokeLikeNext(
      () => committedRouteHandler({ events, outcome }),
      events
    );
    assert.ok(response instanceof Response);
    assert.equal(calls.length, 0, outcome);
  }

  const partialEvents = [];
  const partialCalls = nextCacheRecorder({ events: partialEvents });
  const partialResponse = await invokeLikeNext(
    () => committedRouteHandler({ events: partialEvents, outcome: "partial" }),
    partialEvents
  );
  assert.equal(partialResponse.status, 207);
  assert.equal(partialCalls.length, 10);
  assert.ok(
    partialEvents.indexOf("commit:partial") <
      partialEvents.findIndex((event) => event.startsWith("tag:"))
  );
});

test("the historical helper delegates through retained identity without changing its call shape", async () => {
  const calls = nextCacheRecorder();
  await revalidation.revalidateOwnerMenuMutationPaths({
    client: restaurantClient({ slug: "Chez Léa", name: "Chez Léa" }),
    restaurantId: "restaurant-id",
    dishSlug: "Soupe du Jour"
  });
  assert.deepEqual(calls, [
    { kind: "path", target: "/menu/chez-lea" },
    { kind: "path", target: "/menu/chez-lea/dishes/soupe-du-jour" }
  ]);
});

test.after(() => {
  delete globalThis[nextCacheHooksSymbol];
});
