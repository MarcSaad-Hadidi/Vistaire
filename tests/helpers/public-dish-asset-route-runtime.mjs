import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire, registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

function dependencyRequire() {
  const localRequire = createRequire(import.meta.url);
  try {
    localRequire.resolve("typescript");
    return localRequire;
  } catch {
    const commonGitDir = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: process.cwd(), encoding: "utf8" }
    ).trim();
    return createRequire(path.join(path.dirname(commonGitDir), "package.json"));
  }
}

const requireDependency = dependencyRequire();
const ts = requireDependency("typescript");
const nextServerUrl = pathToFileURL(requireDependency.resolve("next/server")).href;
const nextCacheUrl = pathToFileURL(requireDependency.resolve("next/cache")).href;
const rootUrl = pathToFileURL(`${path.resolve(process.cwd())}${path.sep}`).href;
const adminStubUrl = "public-dish-asset-test:admin";
const adminAuthStubUrl = "public-dish-asset-test:admin-auth";

function localModuleUrl(url) {
  const parsed = new URL(url);
  if (path.extname(parsed.pathname)) return parsed.href;
  for (const extension of [".ts", ".tsx", ".mjs", ".js"]) {
    const candidate = new URL(`${parsed.href}${extension}`);
    if (existsSync(candidate)) return candidate.href;
  }
  return parsed.href;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export%20default%20%7B%7D", shortCircuit: true };
    }
    if (specifier === "@/utils/supabase/admin") {
      return { url: adminStubUrl, shortCircuit: true };
    }
    if (specifier === "@/lib/admin/apiAuth") {
      return { url: adminAuthStubUrl, shortCircuit: true };
    }
    if (specifier === "next/server") {
      return { url: nextServerUrl, shortCircuit: true };
    }
    if (specifier === "next/cache") {
      return { url: nextCacheUrl, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return {
        url: localModuleUrl(new URL(specifier.slice(2), rootUrl).href),
        shortCircuit: true
      };
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:")
    ) {
      const unresolved = new URL(specifier, context.parentURL).href;
      const candidate = localModuleUrl(unresolved);
      if (candidate !== unresolved) {
        return { url: candidate, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === adminStubUrl) {
      return {
        format: "module",
        source:
          "export const getSupabaseAdminClient = () => globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN__;",
        shortCircuit: true
      };
    }
    if (url === adminAuthStubUrl) {
      return {
        format: "module",
        source:
          "export const requireAdminApiAccess = async () => globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN_ACCESS__;",
        shortCircuit: true
      };
    }
    if (url.endsWith(".ts") || url.endsWith(".tsx")) {
      const filename = new URL(url);
      const source = readFileSync(filename, "utf8");
      const output = ts.transpileModule(source, {
        fileName: filename.pathname,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX
        }
      });
      return { format: "module", source: output.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  }
});

export async function createNextRequest(url, init) {
  const { NextRequest } = await import("next/server");
  return new NextRequest(url, init);
}

export function loadPhotoRoute() {
  return import("../../app/api/public/menu-dishes/[dishId]/photo/route.ts");
}

export function loadAdminPhotoRoute() {
  return import("../../app/(fr)/admin/api/menu-dishes/[dishId]/photo/route.ts");
}

export function loadGlbRoute() {
  return import("../../app/api/public/menu-dishes/[dishId]/model/glb/route.ts");
}

export function loadUsdzRoute() {
  return import("../../app/api/public/menu-dishes/[dishId]/model/usdz/route.ts");
}

export function loadPublicDishAssetRedirect() {
  return import("../../lib/publicDishAssetRedirect.ts");
}

export function loadPublicMenuCache() {
  return import("../../lib/menu/publicMenuCache.ts");
}

export function loadPublicMenu() {
  return import("../../lib/menu/publicMenu.ts");
}

export function loadMenuSchemaProjections() {
  return import("../../lib/menu/menuSchemaProjections.ts");
}

export function loadMenuMutationRevalidation() {
  return import("../../lib/owner/menuMutationRevalidation.ts");
}
