import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildDishPhotoStoragePath } from "../../lib/owner/dishPhotoUpload.ts";
import {
  buildPreparedModelArLiteStoragePath,
  buildPreparedModelUsdzStoragePath,
  buildPreparedModelWebStoragePath
} from "../../lib/owner/preparedModelWorkflow.ts";

export const MAISON_ELYSE_RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
export const MAISON_ELYSE_SLUG = "maison-elyse";
export const MAISON_ELYSE_PROJECT_REF = "bkpewsjvxswqruwqljcy";
export const ALLOWED_SLUGS = [
  "ravioles-romarin",
  "tartare-saumon",
  "homard-bisque",
  "canette-aux-figues",
  "risotto-cepe",
  "bar-ligne",
  "pave-boeuf",
  "souffle-chocolat",
  "tarte-citron-basilic",
  "cocktail-maison-elyse",
  "negroni-fut",
  "mocktail-bergamote"
];

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const MANIFEST_PATH = join(ROOT, "scripts", "owner", "maison-elyse-media.manifest.json");
const PHOTO_BUCKET = "vistaire-media";
const MODEL_BUCKET = "vistaire-3d";
const MAX_USDZ_RUNTIME_BYTES = 5 * 1024 * 1024;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const ASSET_KEYS = ["photo", "webGlb", "arLiteGlb", "usdzRuntime"];

function fail(message) {
  throw new Error(message);
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeRelativePath(value) {
  return typeof value === "string" && value && !value.startsWith("/") && !value.includes("..") && !value.includes("\\");
}

function isCanonicalUuid(value) {
  return typeof value === "string" && UUID_SHAPE.test(value);
}

function loadManifest(manifestPath = MANIFEST_PATH) {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

export { loadManifest };

export function validateManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1) fail("manifest schemaVersion is unsupported");
  if (manifest.restaurant?.slug !== MAISON_ELYSE_SLUG || manifest.restaurant?.id !== MAISON_ELYSE_RESTAURANT_ID) {
    fail("manifest restaurant allowlist does not match Maison Élyse");
  }
  if (manifest.supabaseProjectRef !== MAISON_ELYSE_PROJECT_REF) fail("manifest Supabase project ref is not Vistaire");
  if (manifest.source?.mappingKey !== "dish.slug") fail("manifest must map assets by dish.slug");
  if (!Array.isArray(manifest.dishes) || manifest.dishes.length !== ALLOWED_SLUGS.length) {
    fail("manifest must contain exactly the twelve allowlisted dishes");
  }
  const slugs = manifest.dishes.map((dish) => dish?.slug);
  if (JSON.stringify(slugs) !== JSON.stringify(ALLOWED_SLUGS)) fail("manifest slug allowlist/order is invalid");
  for (const dish of manifest.dishes) {
    if (!isCanonicalUuid(dish.knownSupabaseDishId)) fail(`knownSupabaseDishId is invalid for ${dish.slug}`);
    if (!dish.photo || !safeRelativePath(dish.photo.path)) fail(`photo asset is missing for ${dish.slug}`);
    for (const key of ASSET_KEYS) {
      const asset = dish[key];
      if (!asset) continue;
      if (!safeRelativePath(asset.path) || !Number.isInteger(asset.bytes) || asset.bytes <= 0 || !SHA256.test(asset.sha256)) {
        fail(`${key} inventory is invalid for ${dish.slug}`);
      }
    }
    if (dish.historicalPrimaryUsdz && dish.historicalPrimaryUsdz.disposition !== "source-only") {
      fail(`historical USDZ must be source-only for ${dish.slug}`);
    }
  }
  for (const sourceOnly of manifest.sourceOnlyAssets ?? []) {
    if (!safeRelativePath(sourceOnly.path) || !/\.usdz$/i.test(sourceOnly.path) || !/source-only|master/i.test(sourceOnly.reason ?? "")) {
      fail("every excluded USDZ must be explicitly source-only");
    }
  }
  return { ok: true };
}

function assetBytes(rootDir, asset) {
  const absolute = resolve(rootDir, asset.path);
  const root = resolve(rootDir);
  if (absolute !== root && !absolute.startsWith(root + "\\") && !absolute.startsWith(root + "/")) fail(`asset escapes repository: ${asset.path}`);
  if (!existsSync(absolute)) return { status: "absent", path: asset.path };
  const bytes = readFileSync(absolute);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== asset.bytes) fail(`byte count mismatch for ${asset.path}`);
  if (sha256 !== asset.sha256.toLowerCase()) fail(`sha256 mismatch for ${asset.path}`);
  return { status: "ready", ...asset, absolute, bytes: bytes.byteLength, sha256 };
}

function validateGlb(file) {
  if (file.subarray(0, 4).toString() !== "glTF" || file.readUInt32LE(4) !== 2 || file.readUInt32LE(8) !== file.byteLength) fail("invalid GLB header");
  const jsonLength = file.readUInt32LE(12);
  if (file.subarray(16, 20).toString() !== "JSON" || 20 + jsonLength > file.byteLength) fail("GLB JSON chunk is invalid");
  let json;
  try {
    json = JSON.parse(file.subarray(20, 20 + jsonLength).toString("utf8").replace(/\0+$/g, ""));
  } catch {
    fail("GLB JSON chunk is not parseable");
  }
  const externalUris = [...(json.buffers ?? []), ...(json.images ?? [])].map((entry) => entry?.uri).filter(Boolean);
  if (externalUris.length) fail(`GLB has external URIs: ${externalUris.join(", ")}`);
}

function validateFileAsset(rootDir, asset) {
  const inventory = assetBytes(rootDir, asset);
  if (inventory.status === "absent") return inventory;
  const file = readFileSync(inventory.absolute);
  if (asset.contentType === "image/png" && file.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") fail(`PNG signature is invalid for ${asset.path}`);
  if (asset.contentType === "model/gltf-binary") validateGlb(file);
  if (asset.contentType === "model/vnd.usdz+zip") {
    if (file.subarray(0, 4).toString("hex") !== "504b0304") fail(`USDZ ZIP signature is invalid for ${asset.path}`);
    if (asset.path.includes("homard-bisque.usdz") || file.byteLength > MAX_USDZ_RUNTIME_BYTES) fail(`USDZ master/runtime budget rejected for ${asset.path}`);
  }
  return inventory;
}

function extractDemoSlugs(rootDir) {
  const source = readFileSync(join(rootDir, "lib", "demoMenuData.ts"), "utf8");
  return [...source.matchAll(/\bslug:\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

export function buildLocalAssetInventory({ rootDir = ROOT, manifest }) {
  validateManifest(manifest);
  const demoSlugs = extractDemoSlugs(rootDir);
  const missingDemoSlugs = ALLOWED_SLUGS.filter((slug) => !demoSlugs.includes(slug));
  if (missingDemoSlugs.length) fail(`demoMenuData is missing allowlisted slugs: ${missingDemoSlugs.join(", ")}`);
  const bySlug = {};
  const summary = { photo: { ready: 0, absent: 0 }, webGlb: { ready: 0, absent: 0 }, arLiteGlb: { ready: 0, absent: 0 }, usdzRuntime: { ready: 0, absent: 0 } };
  for (const dish of manifest.dishes) {
    const entry = {};
    for (const key of ASSET_KEYS) {
      const value = dish[key] ? validateFileAsset(rootDir, dish[key]) : { status: "absent" };
      entry[key] = value;
      summary[key][value.status] += 1;
    }
    const historical = dish.historicalPrimaryUsdz;
    entry.historicalPrimaryUsdz = historical
      ? { ...assetBytes(rootDir, historical), disposition: "source-only" }
      : { status: "absent", disposition: "none" };
    bySlug[dish.slug] = entry;
  }
  return { bySlug, summary };
}

function extensionFor(asset) {
  const match = asset.path.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "bin";
}

function safeMetadata(value) {
  return { ...asObject(value) };
}

function objectPlan({ bucket, path, asset, inventory, existingObjectPaths }) {
  const existing = existingObjectPaths.has(`${bucket}/${path}`) || existingObjectPaths.has(path);
  return {
    bucket,
    path,
    action: existing ? "reuse" : "create",
    localPath: asset.path,
    bytes: asset.bytes,
    contentType: asset.contentType,
    sha256: asset.sha256,
    data: inventory.absolute ? readFileSync(inventory.absolute) : undefined,
    upsert: false
  };
}

function publicModelUrl(dishId, variant, version) {
  const base = `/api/public/menu-dishes/${dishId}/model/glb`;
  return variant ? `${base}?variant=${variant}&v=${encodeURIComponent(version)}` : `${base}?v=${encodeURIComponent(version)}`;
}

export function createBackfillPlan({ manifest, inventory, rows, existingObjectPaths = new Set() }) {
  validateManifest(manifest);
  const bySlug = new Map(manifest.dishes.map((dish) => [dish.slug, dish]));
  const storageObjects = [];
  const dishUpdates = [];
  for (const row of rows) {
    const slug = row.slug;
    const dish = bySlug.get(slug);
    if (!dish) fail(`Supabase row is outside the Maison Élyse slug allowlist: ${slug}`);
    if (row.restaurant_id !== MAISON_ELYSE_RESTAURANT_ID) fail(`Supabase row has the wrong restaurant: ${slug}`);
    if (!isCanonicalUuid(row.id) || row.id !== dish.knownSupabaseDishId) fail(`Supabase row UUID does not match the slug allowlist: ${slug}`);
    const local = inventory.bySlug[slug];
    for (const key of ASSET_KEYS) {
      if (dish[key] && local[key].status !== "ready") fail(`Required local asset is missing for ${slug}: ${key}`);
    }
    const modelHashes = [dish.webGlb, dish.arLiteGlb, dish.usdzRuntime].filter(Boolean).map((asset) => asset.sha256.slice(0, 12));
    const version = `maison-elyse-${manifest.version}-${(modelHashes[0] ?? dish.photo.sha256).slice(0, 12)}`;
    const photoPath = buildDishPhotoStoragePath({
      restaurantId: MAISON_ELYSE_RESTAURANT_ID,
      dishId: row.id,
      dishSlug: slug,
      extension: extensionFor(dish.photo),
      sha256: dish.photo.sha256
    });
    const photoObject = objectPlan({ bucket: PHOTO_BUCKET, path: photoPath, asset: dish.photo, inventory: local.photo, existingObjectPaths });
    storageObjects.push(photoObject);
    const metadata = safeMetadata(row.metadata);
    metadata.photoStatus = "ready";
    metadata.photoStorageBucket = PHOTO_BUCKET;
    metadata.photoStoragePath = photoPath;
    metadata.photoSha256 = dish.photo.sha256;
    metadata.photoContentType = dish.photo.contentType;
    metadata.photoBytes = dish.photo.bytes;
    const publishedModels = [];
    if (dish.webGlb) {
      const path = buildPreparedModelWebStoragePath({
        restaurantId: MAISON_ELYSE_RESTAURANT_ID,
        dishSlug: slug,
        assetVersion: version
      });
      storageObjects.push(objectPlan({ bucket: MODEL_BUCKET, path, asset: dish.webGlb, inventory: local.webGlb, existingObjectPaths }));
      metadata.webModel3dStorageBucket = MODEL_BUCKET;
      metadata.webModel3dStoragePath = path;
      metadata.webModel3dUrl = publicModelUrl(row.id, "", version);
      metadata.webModel3dBytes = dish.webGlb.bytes;
      metadata.webModel3dSha256 = dish.webGlb.sha256;
      metadata.model3dUrl = metadata.webModel3dUrl;
      publishedModels.push(dish.webGlb);
    }
    if (dish.arLiteGlb) {
      const path = buildPreparedModelArLiteStoragePath({
        restaurantId: MAISON_ELYSE_RESTAURANT_ID,
        dishSlug: slug,
        assetVersion: version
      });
      storageObjects.push(objectPlan({ bucket: MODEL_BUCKET, path, asset: dish.arLiteGlb, inventory: local.arLiteGlb, existingObjectPaths }));
      metadata.arModel3dStorageBucket = MODEL_BUCKET;
      metadata.arModel3dStoragePath = path;
      metadata.arModel3dUrl = publicModelUrl(row.id, "ar-lite", version);
      metadata.arModel3dBytes = dish.arLiteGlb.bytes;
      metadata.arModel3dSha256 = dish.arLiteGlb.sha256;
      publishedModels.push(dish.arLiteGlb);
    }
    if (dish.usdzRuntime) {
      const path = buildPreparedModelUsdzStoragePath({
        restaurantId: MAISON_ELYSE_RESTAURANT_ID,
        dishSlug: slug,
        assetVersion: version
      });
      storageObjects.push(objectPlan({ bucket: MODEL_BUCKET, path, asset: dish.usdzRuntime, inventory: local.usdzRuntime, existingObjectPaths }));
      metadata.arUsdzStorageBucket = MODEL_BUCKET;
      metadata.arUsdzStoragePath = path;
      metadata.arUsdzUrl = `/api/public/menu-dishes/${row.id}/model/usdz?v=${encodeURIComponent(version)}`;
      metadata.usdzUrl = "";
      metadata.arUsdzBytes = dish.usdzRuntime.bytes;
      metadata.arUsdzSha256 = dish.usdzRuntime.sha256;
      metadata.quickLookQaStatus = "not-tested";
      metadata.usdzSourceStored = false;
      publishedModels.push(dish.usdzRuntime);
    }
    metadata.modelStatus = publishedModels.length ? "ready" : "missing";
    metadata.modelAssetVersion = version;
    metadata.modelAssetSha256 = publishedModels.map((asset) => asset.sha256).join(",");
    metadata.mediaBackfillVersion = manifest.version;
    metadata.mediaBackfillSource = "demo-assets-by-slug";
    dishUpdates.push({
      row,
      patch: {
        image_url: `/api/public/menu-dishes/${row.id}/photo`,
        has_immersive_view: publishedModels.length > 0,
        metadata
      },
      slug
    });
  }
  return { storageObjects, dishUpdates };
}

export function parseCliArgs(argv) {
  const args = { mode: "dry-run", manifestPath: MANIFEST_PATH, restaurantId: "", restaurantSlug: "", expectedProjectRef: "", confirmProduction: "", localOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") args.mode = "apply";
    else if (arg === "--dry-run") args.mode = "dry-run";
    else if (arg === "--local-only") args.localOnly = true;
    else if (arg === "--manifest") args.manifestPath = argv[++index] ?? "";
    else if (arg === "--restaurant-id") args.restaurantId = argv[++index] ?? "";
    else if (arg === "--restaurant-slug") args.restaurantSlug = argv[++index] ?? "";
    else if (arg === "--expected-project-ref") args.expectedProjectRef = argv[++index] ?? "";
    else if (arg === "--confirm-production") args.confirmProduction = argv[++index] ?? "";
    else if (arg === "--help" || arg === "-h") args.help = true;
    else fail(`Unknown argument: ${arg}`);
  }
  if (args.mode === "apply" && (!args.restaurantId || !args.restaurantSlug || !args.expectedProjectRef || !args.confirmProduction)) {
    fail("--apply is production-gated: restaurant-id, restaurant-slug, expected-project-ref and confirmation are required");
  }
  return args;
}

function validateApplyGuards(args, manifest) {
  if (args.restaurantId !== manifest.restaurant.id || args.restaurantSlug !== manifest.restaurant.slug || args.expectedProjectRef !== manifest.supabaseProjectRef || args.confirmProduction !== "MAISON-ELYSE") {
    fail("Production allowlist/confirmation does not match Maison Élyse and Vistaire; refusing --apply");
  }
}

export async function applyPlan({ adapter, plan }) {
  const createdObjects = [];
  const updatedRows = [];
  try {
    for (const object of plan.storageObjects) {
      if (object.action !== "create") continue;
      const result = await adapter.uploadObject(object);
      if (result?.created !== false) createdObjects.push(object);
    }
    for (const update of plan.dishUpdates) {
      await adapter.updateDish(update);
      updatedRows.push(update.row);
    }
  } catch (error) {
    for (const row of updatedRows.reverse()) await adapter.restoreDish(row);
    for (const object of createdObjects.reverse()) await adapter.removeObject(object);
    throw error;
  }
  return { createdObjects, updatedRows };
}

function planSummary(plan) {
  return {
    storageObjects: plan.storageObjects.map(({ bucket, path, action, bytes, contentType, sha256, localPath }) => ({ bucket, path, action, bytes, contentType, sha256, localPath })),
    objectCounts: {
      create: plan.storageObjects.filter((object) => object.action === "create").length,
      reuse: plan.storageObjects.filter((object) => object.action === "reuse").length
    },
    dishUpdates: plan.dishUpdates.map((update) => ({ slug: update.slug, id: update.row.id, imageUrl: update.patch.image_url, hasImmersiveView: update.patch.has_immersive_view })),
    deletionCount: 0
  };
}

function localRows(manifest) {
  return manifest.dishes.map((dish) => ({ id: dish.knownSupabaseDishId, restaurant_id: manifest.restaurant.id, slug: dish.slug, image_url: null, has_immersive_view: false, metadata: {} }));
}

async function createSupabaseAdapter() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) fail("Supabase credentials are unavailable; use --local-only for an offline plan");
  const projectRef = new URL(url).hostname.split(".")[0];
  if (projectRef !== MAISON_ELYSE_PROJECT_REF) fail("Supabase URL is not the Vistaire project; refusing access");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: restaurant, error: restaurantError } = await client.from("restaurants").select("id,slug,name").eq("id", MAISON_ELYSE_RESTAURANT_ID).eq("slug", MAISON_ELYSE_SLUG).maybeSingle();
  if (restaurantError || !restaurant) fail("Maison Élyse restaurant row could not be verified");
  const { data: rows, error: dishError } = await client.from("menu_dishes").select("id,restaurant_id,slug,name,image_url,has_immersive_view,metadata").eq("restaurant_id", MAISON_ELYSE_RESTAURANT_ID).order("slug");
  if (dishError || !rows || rows.length !== ALLOWED_SLUGS.length) fail("Supabase dish allowlist did not return exactly twelve rows");
  const rowSlugs = rows.map((row) => row.slug);
  if (JSON.stringify([...rowSlugs].sort()) !== JSON.stringify([...ALLOWED_SLUGS].sort())) fail("Supabase dish slugs do not match the exact allowlist");
  const existingObjectPaths = new Set();
  async function listPrefix(bucket, prefix) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } });
    if (error) fail(`Storage list failed for ${bucket}/${prefix}`);
    for (const item of data ?? []) {
      const name = item.name;
      if (!name) continue;
      const path = `${prefix}/${name}`;
      if (item.id || item.metadata) existingObjectPaths.add(`${bucket}/${path}`);
      else await listPrefix(bucket, path);
    }
  }
  await listPrefix(PHOTO_BUCKET, `restaurants/${MAISON_ELYSE_RESTAURANT_ID}`);
  await listPrefix(MODEL_BUCKET, `restaurants/${MAISON_ELYSE_RESTAURANT_ID}`);
  const adapter = {
    rows,
    existingObjectPaths,
    async uploadObject(object) {
      const { error } = await client.storage.from(object.bucket).upload(object.path, object.data, { contentType: object.contentType, cacheControl: "31536000", upsert: false });
      if (error) fail(`Storage upload failed for ${object.bucket}/${object.path}`);
      return { created: true };
    },
    async updateDish(update) {
      const { data, error } = await client.from("menu_dishes").update(update.patch).eq("id", update.row.id).eq("restaurant_id", MAISON_ELYSE_RESTAURANT_ID).select("id").maybeSingle();
      if (error || !data) fail(`DB update failed for ${update.slug}`);
      return data;
    },
    async restoreDish(row) {
      await client.from("menu_dishes").update({ image_url: row.image_url, has_immersive_view: row.has_immersive_view, metadata: row.metadata }).eq("id", row.id).eq("restaurant_id", MAISON_ELYSE_RESTAURANT_ID);
    },
    async removeObject(object) {
      await client.storage.from(object.bucket).remove([object.path]);
    }
  };
  return { adapter, rows, existingObjectPaths, restaurant };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/owner/backfill-maison-elyse-media.mjs [--dry-run|--apply] [--local-only] [production guards]");
    return;
  }
  const manifest = loadManifest(args.manifestPath);
  validateManifest(manifest);
  if (args.mode === "apply") validateApplyGuards(args, manifest);
  const inventory = buildLocalAssetInventory({ rootDir: ROOT, manifest });
  let rows = localRows(manifest);
  let existingObjectPaths = new Set();
  let adapter = null;
  let verification = "local-only; Supabase was not contacted";
  if (!args.localOnly) {
    const remote = await createSupabaseAdapter();
    rows = remote.rows;
    existingObjectPaths = remote.existingObjectPaths;
    adapter = remote.adapter;
    verification = `read-only Supabase verification: ${remote.restaurant.name ?? MAISON_ELYSE_SLUG}`;
  }
  const plan = createBackfillPlan({ manifest, inventory, rows, existingObjectPaths });
  if (args.mode === "dry-run") {
    console.log(JSON.stringify({ mode: args.mode, supabaseMutated: false, verification, inventory: inventory.summary, plan: planSummary(plan) }, null, 2));
    return;
  }
  if (!adapter) fail("--apply requires a live, allowlisted Supabase adapter; --local-only cannot apply");
  const result = await applyPlan({ adapter, plan });
  console.log(JSON.stringify({ mode: args.mode, supabaseMutated: true, verification, uploaded: result.createdObjects.length, updated: result.updatedRows.length, deletionCount: 0 }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
