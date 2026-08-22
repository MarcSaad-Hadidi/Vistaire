import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const nextCacheHooksSymbol = Symbol.for(
  "vistaire.test.missing-mutation-identity-next-cache"
);
const nextCacheModuleUrl = `data:text/javascript,${encodeURIComponent(`
  function hooks() {
    return globalThis[Symbol.for("vistaire.test.missing-mutation-identity-next-cache")];
  }
  export function revalidatePath(...args) { return hooks().revalidatePath(...args); }
  export function revalidateTag(...args) { return hooks().revalidateTag(...args); }
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
        if (existsSync(url) && statSync(url).isFile()) {
          return { url: url.href, shortCircuit: true };
        }
      }
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL
    ) {
      const baseUrl = new URL(specifier, context.parentURL);
      for (const extension of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url) && statSync(url).isFile()) {
          return { url: url.href, shortCircuit: true };
        }
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
const RESTAURANT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const DISH_ID = "11111111-2222-4333-8444-555555555555";

function transientlyFailingRestaurantClient() {
  return {
    from(table) {
      assert.equal(table, "restaurants");
      const builder = {
        select(columns) {
          assert.equal(columns, "slug,name");
          return builder;
        },
        eq(column, value) {
          assert.equal(column, "id");
          assert.equal(value, RESTAURANT_ID);
          return builder;
        },
        async maybeSingle() {
          throw new Error("transient-restaurant-lookup-failure");
        }
      };
      return builder;
    }
  };
}

test("a transient pre-commit identity lookup failure emits a retry without malformed cache paths", async () => {
  const events = [];
  globalThis[nextCacheHooksSymbol] = {
    revalidatePath(path) {
      events.push(`path:${path}`);
    },
    revalidateTag(tag) {
      events.push(`tag:${tag}`);
    }
  };

  const identity = await revalidation.resolvePublicMutationIdentity({
    client: transientlyFailingRestaurantClient(),
    restaurantId: RESTAURANT_ID,
    dishId: DISH_ID,
    dishSlug: " Plat du Chef "
  });

  assert.deepEqual(identity, {
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "",
    restaurantKey: "",
    featuredExperienceId: null,
    dishSlug: "plat-du-chef",
    dishId: DISH_ID,
    retryOnly: true
  });

  const report = await revalidation.invalidateCommittedPublicMutation(identity, {
    callbacks: {
      revalidatePath(path) {
        events.push(`path:${path}`);
      },
      revalidateTag(tag) {
        events.push(`tag:${tag}`);
      }
    },
    invalidateAssetMetadata(scope) {
      events.push(`asset:${scope.restaurantId}:${scope.dishId}`);
      return 1;
    },
    signalRetry(signal) {
      events.push(`retry:${signal.restaurantId}:${signal.dishId}`);
    }
  });

  assert.deepEqual(report, {
    attempted: 0,
    queuedCallReturned: 0,
    enqueueErrors: [],
    identityUnavailable: true
  });
  assert.deepEqual(events, [
    `asset:${RESTAURANT_ID}:${DISH_ID}`,
    `retry:${RESTAURANT_ID}:${DISH_ID}`
  ]);
});

test("an explicit retry identity remains fail closed and never schedules an empty public path", async () => {
  const identity = revalidation.createPublicMutationRetryIdentity({
    restaurantId: ` ${RESTAURANT_ID} `,
    dishId: ` ${DISH_ID} `
  });
  const scheduled = [];
  const retries = [];
  const report = await revalidation.invalidateCommittedPublicMutation(identity, {
    callbacks: {
      revalidatePath(path) {
        scheduled.push(path);
      },
      revalidateTag(tag) {
        scheduled.push(tag);
      }
    },
    invalidateAssetMetadata() {
      return 0;
    },
    signalRetry(signal) {
      retries.push(signal);
    }
  });

  assert.equal(report.identityUnavailable, true);
  assert.deepEqual(scheduled, []);
  assert.deepEqual(retries, [
    {
      kind: "menu-revalidation-retry-required",
      restaurantId: RESTAURANT_ID,
      dishId: DISH_ID
    }
  ]);
});

test.after(() => {
  delete globalThis[nextCacheHooksSymbol];
});
