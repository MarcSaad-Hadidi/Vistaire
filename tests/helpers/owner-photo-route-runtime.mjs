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
const rootUrl = pathToFileURL(`${path.resolve(process.cwd())}${path.sep}`).href;
const stubs = new Map([
  ["@/lib/auth/ownerApi", "owner-photo-test:auth"],
  ["@/lib/owner/demoCapabilities", "owner-photo-test:capability"],
  ["@/utils/supabase/admin", "owner-photo-test:admin"],
  ["@/lib/owner/dishPhotoUpload", "owner-photo-test:upload-helper"],
  ["@/lib/owner/dishPhotoDerivatives", "owner-photo-test:derivatives"],
  ["@/lib/owner/dishAssetReplacementCleanup", "owner-photo-test:cleanup"],
  ["@/lib/owner/menuMutationRevalidation", "owner-photo-test:revalidation"]
]);

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
    if (stubs.has(specifier)) return { url: stubs.get(specifier), shortCircuit: true };
    if (specifier === "next/server") return { url: nextServerUrl, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      return { url: localModuleUrl(new URL(specifier.slice(2), rootUrl).href), shortCircuit: true };
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const unresolved = new URL(specifier, context.parentURL).href;
      const candidate = localModuleUrl(unresolved);
      if (candidate !== unresolved) return { url: candidate, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const sources = {
      "owner-photo-test:auth": `
        export const requireVistaireOwnerApi = async () => globalThis.__OWNER_PHOTO_TEST__.owner;
        export const requireSameOriginOwnerMutation = () => null;
      `,
      "owner-photo-test:capability": `
        export const requireOwnerRestaurantCapability = async () => globalThis.__OWNER_PHOTO_TEST__.capability;
      `,
      "owner-photo-test:admin": `
        export const getSupabaseAdminClient = () => ({ ok: true, client: globalThis.__OWNER_PHOTO_TEST__.client });
      `,
      "owner-photo-test:upload-helper": `
        export const DISH_PHOTO_RECIPE = { id: "dish-photo-v2", schemaVersion: 2 };
        export const inspectDishPhotoFile = async () => globalThis.__OWNER_PHOTO_TEST__.validated;
        export const buildDishPhotoV2StoragePath = ({ restaurantId, sha256, extension }) => \`restaurants/\${restaurantId}/photos/originals/\${sha256}.\${extension}\`;
        export const buildDishPhotoDerivativeV2StoragePath = ({ restaurantId, sourceSha256, recipeId, variant, outputSha256 }) => \`restaurants/\${restaurantId}/photos/derivatives/\${sourceSha256}/\${recipeId}/\${variant}-\${outputSha256}.webp\`;
        export const buildDishPhotoPublicPath = (dishId, options) => \`/api/public/menu-dishes/\${dishId}/photo?v=\${options.assetVersion}\`;
        export const mergeDishPhotoMetadata = (existing, info) => ({ ...existing, photoStatus: "ready", photoStorageBucket: info.storageBucket, photoStoragePath: info.storagePath, photoSha256: info.sha256, photoContentType: info.contentType, photoBytes: info.bytes, photoDerivatives: info.derivatives ?? {} });
        export const clearDishPhotoMetadata = (existing) => { const result = { ...existing }; for (const key of ["photoStatus", "photoStorageBucket", "photoStoragePath", "photoSha256", "photoContentType", "photoBytes", "photoDerivatives"]) delete result[key]; return result; };
      `,
      "owner-photo-test:derivatives": `
        export const generateDishPhotoDerivatives = async () => globalThis.__OWNER_PHOTO_TEST__.derivatives;
      `,
      "owner-photo-test:cleanup": `
        export const cleanupReplacedDishAssets = async (args) => { globalThis.__OWNER_PHOTO_TEST__.events.push("cleanup"); globalThis.__OWNER_PHOTO_TEST__.cleanupArgs = args; return { candidates: [], deleted: [], skippedStillReferenced: [], skippedConcurrentReuseRisk: [], skippedUnsafeBucket: [], skippedUnsafePrefix: [], skippedMissingPath: [], errors: [] }; };
      `,
      "owner-photo-test:revalidation": `
        export const revalidateOwnerMenuMutationPaths = async () => { globalThis.__OWNER_PHOTO_TEST__.events.push("revalidate"); };
      `
    };
    if (sources[url]) return { format: "module", source: sources[url], shortCircuit: true };
    if (url.endsWith(".ts") || url.endsWith(".tsx")) {
      const filename = new URL(url);
      const source = readFileSync(filename, "utf8");
      const output = ts.transpileModule(source, {
        fileName: filename.pathname,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
      });
      return { format: "module", source: output.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  }
});

export function loadOwnerPhotoRoute() {
  return import("../../app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/photo/route.ts");
}
