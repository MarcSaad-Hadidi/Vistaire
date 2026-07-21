import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildDishPhotoStoragePath } from "../../lib/owner/dishPhotoUpload.ts";
import { DISH_MODEL_METADATA_KEYS } from "../../lib/owner/deleteDishModelAssets.ts";
import {
  buildPreparedModelArLiteStoragePath,
  buildPreparedModelUsdzStoragePath,
  buildPreparedModelWebStoragePath
} from "../../lib/owner/preparedModelWorkflow.ts";
import {
  assertPhysicalScalePublishable,
  cleanPhysicalScale
} from "../../lib/owner/usdzRuntimeJsonFlow.ts";

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
const PHYSICAL_SCALE_REPORT_KEY = "usdzPhysicalScaleReport";
const USDZ_PENDING_STATUS = "pending_manual_usdz";
const USDZ_PENDING_REASON = "requires-worker-v3";
const MODEL_ASSET_SHA256_FORMAT = "webGlb:<sha256>\narLiteGlb:<sha256>\nusdzRuntime:<sha256>";
const USDZ_METADATA_KEYS = [
  "arUsdzUrl",
  "arUsdzStorageBucket",
  "arUsdzStoragePath",
  "arUsdzBytes",
  "arUsdzSha256",
  "usdzUrl",
  "usdzRuntimeStatus",
  "usdzRuntimeStorageBucket",
  "usdzRuntimeStoragePath",
  "usdzRuntimeBytes",
  "usdzRuntimeSha256",
  "usdzRuntimeContentType",
  "usdzRuntimeUploadedAt",
  "usdzOptimizationReportStoragePath",
  "usdzPhysicalScaleStatus",
  "usdzPhysicalScaleDishKind",
  "usdzPhysicalScaleDimension",
  "usdzPhysicalScaleTargetMeters",
  "usdzPhysicalScaleMinMeters",
  "usdzPhysicalScaleMaxMeters",
  "usdzPhysicalScaleHeightBeforeMeters",
  "usdzPhysicalScaleWidthBeforeMeters",
  "usdzPhysicalScaleDepthBeforeMeters",
  "usdzPhysicalScaleFootprintBeforeMeters",
  "usdzPhysicalScaleHeightAfterMeters",
  "usdzPhysicalScaleWidthAfterMeters",
  "usdzPhysicalScaleDepthAfterMeters",
  "usdzPhysicalScaleFootprintAfterMeters",
  "usdzPhysicalScaleScaleFactor",
  "usdzPhysicalScaleCenteredX",
  "usdzPhysicalScaleCenteredY",
  "usdzPhysicalScaleGrounded",
  "usdzPhysicalScaleCenterOffsetBeforeMeters",
  "usdzPhysicalScaleCenterOffsetAfterMeters",
  "usdzPhysicalScaleWarnings",
  "usdzRuntimePendingReason"
];

function fail(message) {
  throw new Error(message);
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeRelativePath(value) {
  return typeof value === "string" && value && !value.startsWith("/") && !value.includes("..") && !value.includes("\\");
}

function normalizeContentType(value) {
  return typeof value === "string" ? value.split(";")[0].trim().toLowerCase() : "";
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
  if (
    manifest.usdzPolicy?.physicalScaleReportKey !== PHYSICAL_SCALE_REPORT_KEY ||
    manifest.usdzPolicy?.unvalidatedDisposition !== USDZ_PENDING_REASON
  ) {
    fail("manifest USDZ policy must fail closed on missing worker-v3 reports");
  }
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
    const report = dish[PHYSICAL_SCALE_REPORT_KEY];
    if (report && (
      !safeRelativePath(report.path) ||
      !Number.isInteger(report.bytes) ||
      report.bytes <= 0 ||
      !SHA256.test(report.sha256) ||
      normalizeContentType(report.contentType) !== "application/json"
    )) {
      fail(`${PHYSICAL_SCALE_REPORT_KEY} inventory is invalid for ${dish.slug}`);
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

export function validateUsdzPhysicalScaleReport(input, label = "USDZ physical-scale report") {
  let report = input;
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
    try {
      report = JSON.parse(Buffer.from(input).toString("utf8"));
    } catch {
      fail(`${label} is not valid JSON`);
    }
  } else if (typeof input === "string") {
    try {
      report = JSON.parse(input);
    } catch {
      fail(`${label} is not valid JSON`);
    }
  }
  if (!report || typeof report !== "object" || Array.isArray(report)) fail(`${label} must be an object`);
  if (report.sourceStored !== false) fail(`${label} must declare sourceStored=false`);
  if (Array.isArray(report.fails) && report.fails.length > 0) fail(`${label} contains worker failures`);
  const physicalScale = cleanPhysicalScale(report.physicalScale);
  try {
    assertPhysicalScalePublishable(physicalScale);
  } catch (error) {
    fail(`${label} failed the worker-v3 physical-scale gate: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { report, physicalScale };
}

function validatePhysicalScaleReportAsset(rootDir, asset) {
  const inventory = assetBytes(rootDir, asset);
  if (inventory.status === "absent") return inventory;
  if (normalizeContentType(asset.contentType) !== "application/json") fail(`USDZ report content type is invalid for ${asset.path}`);
  const file = readFileSync(inventory.absolute);
  const validation = validateUsdzPhysicalScaleReport(file, asset.path);
  return { ...inventory, ...validation };
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
  const summary = {
    photo: { ready: 0, absent: 0 },
    webGlb: { ready: 0, absent: 0 },
    arLiteGlb: { ready: 0, absent: 0 },
    usdzRuntime: { ready: 0, absent: 0 },
    usdzPhysicalScaleReport: { ready: 0, absent: 0 },
    usdzPublishable: { ready: 0, pending: 0 }
  };
  for (const dish of manifest.dishes) {
    const entry = {};
    for (const key of ASSET_KEYS) {
      const value = dish[key] ? validateFileAsset(rootDir, dish[key]) : { status: "absent" };
      entry[key] = value;
      summary[key][value.status] += 1;
    }
    const physicalScaleReport = dish[PHYSICAL_SCALE_REPORT_KEY]
      ? validatePhysicalScaleReportAsset(rootDir, dish[PHYSICAL_SCALE_REPORT_KEY])
      : { status: "absent" };
    entry[PHYSICAL_SCALE_REPORT_KEY] = physicalScaleReport;
    if (dish.usdzRuntime) {
      summary.usdzPhysicalScaleReport[physicalScaleReport.status] += 1;
      summary.usdzPublishable[physicalScaleReport.status === "ready" ? "ready" : "pending"] += 1;
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

function hasExistingModelMetadata(value) {
  const metadata = asObject(value);
  return DISH_MODEL_METADATA_KEYS.some((key) => {
    const current = metadata[key];
    if (current === undefined || current === null || current === "" || current === false) return false;
    if ((key === "modelStatus" || key === "model_status") && current === "missing") return false;
    return true;
  });
}

function existingObjectKey(bucket, path) {
  return `${bucket}/${path}`;
}

function normalizeExistingObjects(value) {
  const normalized = new Map();
  if (!value) return normalized;
  if (value instanceof Set) {
    for (const path of value) {
      normalized.set(String(path), { path: String(path), pathOnly: true });
    }
    return normalized;
  }
  const entries = value instanceof Map
    ? [...value.entries()].map(([key, object]) => ({ key, object }))
    : Array.isArray(value)
      ? value.map((object) => ({ key: existingObjectKey(object.bucket, object.path), object }))
      : [];
  for (const { key, object } of entries) {
    if (!object || typeof object !== "object") continue;
    const bucket = typeof object.bucket === "string" ? object.bucket : "";
    const path = typeof object.path === "string" ? object.path : "";
    normalized.set(String(key || existingObjectKey(bucket, path)), {
      bucket,
      path,
      size: Number.isInteger(object.size) ? object.size : null,
      contentType: normalizeContentType(object.contentType),
      sha256: SHA256.test(object.sha256 ?? "") ? object.sha256.toLowerCase() : "",
      pathOnly: false
    });
  }
  return normalized;
}

function findExistingObject(existingObjects, bucket, path) {
  const key = existingObjectKey(bucket, path);
  return existingObjects.get(key) ?? existingObjects.get(path) ?? null;
}

function objectPlan({ bucket, path, asset, inventory, existingObjects }) {
  const existing = findExistingObject(existingObjects, bucket, path);
  if (existing?.pathOnly) {
    fail(`Storage collision lacks bucket/size/contentType/SHA-256 metadata: ${bucket}/${path}`);
  }
  if (existing?.size !== null && existing?.size !== undefined && existing.size !== asset.bytes) {
    fail(`Storage collision has a different size: ${bucket}/${path}`);
  }
  if (existing?.contentType && normalizeContentType(existing.contentType) !== normalizeContentType(asset.contentType)) {
    fail(`Storage collision has a different Content-Type: ${bucket}/${path}`);
  }
  let action = "create";
  if (existing) {
    if (existing.sha256 && existing.sha256 !== asset.sha256.toLowerCase()) {
      fail(`Storage collision has a different SHA-256: ${bucket}/${path}`);
    }
    action = existing.sha256 ? "reuse" : "verify";
  }
  return {
    bucket,
    path,
    action,
    localPath: asset.path,
    bytes: asset.bytes,
    contentType: asset.contentType,
    sha256: asset.sha256,
    data: inventory.absolute ? readFileSync(inventory.absolute) : undefined,
    upsert: false
  };
}

export async function verifyStorageObjectCollisions({ adapter, plan }) {
  for (const object of plan.storageObjects.filter((candidate) => candidate.action === "verify")) {
    if (typeof adapter.downloadObject !== "function") {
      fail(`Storage collision cannot be verified without a dry-run download: ${object.bucket}/${object.path}`);
    }
    const downloaded = await adapter.downloadObject(object);
    if (!downloaded?.bytes || !Buffer.isBuffer(downloaded.bytes)) {
      fail(`Storage collision download returned no bytes: ${object.bucket}/${object.path}`);
    }
    const actualContentType = normalizeContentType(downloaded.contentType);
    const actualSha256 = createHash("sha256").update(downloaded.bytes).digest("hex");
    if (
      downloaded.bytes.byteLength !== object.bytes ||
      actualContentType !== normalizeContentType(object.contentType) ||
      actualSha256 !== object.sha256.toLowerCase()
    ) {
      fail(`Storage collision content does not match the manifest: ${object.bucket}/${object.path}`);
    }
    object.action = "reuse";
    object.verifiedExisting = { size: downloaded.bytes.byteLength, contentType: actualContentType, sha256: actualSha256 };
  }
  return plan;
}

function buildModelAssetSha256(assets) {
  const ordered = [
    ["webGlb", assets.webGlb],
    ["arLiteGlb", assets.arLiteGlb],
    ["usdzRuntime", assets.usdzRuntime]
  ].filter(([, asset]) => asset);
  if (ordered.length === 0) return "";
  return createHash("sha256")
    .update(ordered.map(([kind, asset]) => `${kind}:${asset.sha256.toLowerCase()}`).join("\n"), "utf8")
    .digest("hex");
}

function clearUnpublishedUsdzMetadata(metadata) {
  for (const key of USDZ_METADATA_KEYS) delete metadata[key];
}

function applyPhysicalScaleMetadata(metadata, physicalScale) {
  metadata.usdzPhysicalScaleStatus = physicalScale.status;
  metadata.usdzPhysicalScaleDishKind = physicalScale.dishKind;
  metadata.usdzPhysicalScaleDimension = physicalScale.dimension;
  metadata.usdzPhysicalScaleTargetMeters = physicalScale.targetMeters;
  metadata.usdzPhysicalScaleMinMeters = physicalScale.minMeters;
  metadata.usdzPhysicalScaleMaxMeters = physicalScale.maxMeters;
  metadata.usdzPhysicalScaleHeightBeforeMeters = physicalScale.heightBeforeMeters;
  metadata.usdzPhysicalScaleWidthBeforeMeters = physicalScale.widthBeforeMeters;
  metadata.usdzPhysicalScaleDepthBeforeMeters = physicalScale.depthBeforeMeters;
  metadata.usdzPhysicalScaleFootprintBeforeMeters = physicalScale.footprintBeforeMeters;
  metadata.usdzPhysicalScaleHeightAfterMeters = physicalScale.heightAfterMeters;
  metadata.usdzPhysicalScaleWidthAfterMeters = physicalScale.widthAfterMeters;
  metadata.usdzPhysicalScaleDepthAfterMeters = physicalScale.depthAfterMeters;
  metadata.usdzPhysicalScaleFootprintAfterMeters = physicalScale.footprintAfterMeters;
  metadata.usdzPhysicalScaleScaleFactor = physicalScale.scaleFactor;
  metadata.usdzPhysicalScaleCenteredX = physicalScale.centeredX;
  metadata.usdzPhysicalScaleCenteredY = physicalScale.centeredY;
  metadata.usdzPhysicalScaleGrounded = physicalScale.grounded;
  metadata.usdzPhysicalScaleCenterOffsetBeforeMeters = physicalScale.centerOffsetBeforeMeters;
  metadata.usdzPhysicalScaleCenterOffsetAfterMeters = physicalScale.centerOffsetAfterMeters;
  metadata.usdzPhysicalScaleWarnings = physicalScale.warnings;
}

function publicModelUrl(dishId, variant, version) {
  const base = `/api/public/menu-dishes/${dishId}/model/glb`;
  return variant ? `${base}?variant=${variant}&v=${encodeURIComponent(version)}` : `${base}?v=${encodeURIComponent(version)}`;
}

export function createBackfillPlan({ manifest, inventory, rows, existingObjects, existingObjectPaths }) {
  validateManifest(manifest);
  const bySlug = new Map(manifest.dishes.map((dish) => [dish.slug, dish]));
  const knownObjects = normalizeExistingObjects(existingObjects ?? existingObjectPaths);
  const storageObjects = [];
  const dishUpdates = [];
  for (const row of rows) {
    const slug = row.slug;
    const dish = bySlug.get(slug);
    if (!dish) fail(`Supabase row is outside the Maison Élyse slug allowlist: ${slug}`);
    if (row.restaurant_id !== MAISON_ELYSE_RESTAURANT_ID) fail(`Supabase row has the wrong restaurant: ${slug}`);
    if (!isCanonicalUuid(row.id) || row.id !== dish.knownSupabaseDishId) fail(`Supabase row UUID does not match the slug allowlist: ${slug}`);
    const local = inventory.bySlug[slug];
    if (!local) fail(`Local inventory is missing for ${slug}`);
    const hasModelInputs = Boolean(dish.webGlb || dish.arLiteGlb || dish.usdzRuntime);
    if (!hasModelInputs && hasExistingModelMetadata(row.metadata)) {
      fail(`Existing model metadata blocks the photo-only backfill for ${row.restaurant_id}/${row.id}`);
    }
    for (const key of ASSET_KEYS) {
      if (dish[key] && local[key].status !== "ready") fail(`Required local asset is missing for ${slug}: ${key}`);
    }
    const physicalScaleReport = local[PHYSICAL_SCALE_REPORT_KEY];
    const usdZPublishable = Boolean(dish.usdzRuntime && physicalScaleReport?.status === "ready");
    const modelHashes = [
      dish.webGlb,
      dish.arLiteGlb,
      usdZPublishable ? dish.usdzRuntime : null
    ].filter(Boolean).map((asset) => asset.sha256.slice(0, 12));
    const version = `maison-elyse-${manifest.version}-${(modelHashes[0] ?? dish.photo.sha256).slice(0, 12)}`;
    const photoPath = buildDishPhotoStoragePath({
      restaurantId: MAISON_ELYSE_RESTAURANT_ID,
      dishId: row.id,
      dishSlug: slug,
      extension: extensionFor(dish.photo),
      sha256: dish.photo.sha256
    });
    const photoObject = objectPlan({ bucket: PHOTO_BUCKET, path: photoPath, asset: dish.photo, inventory: local.photo, existingObjects: knownObjects });
    storageObjects.push(photoObject);
    const metadata = safeMetadata(row.metadata);
    clearUnpublishedUsdzMetadata(metadata);
    metadata.photoStatus = "ready";
    metadata.photoStorageBucket = PHOTO_BUCKET;
    metadata.photoStoragePath = photoPath;
    metadata.photoSha256 = dish.photo.sha256;
    metadata.photoContentType = dish.photo.contentType;
    metadata.photoBytes = dish.photo.bytes;
    if (dish.webGlb) {
      const path = buildPreparedModelWebStoragePath({
        restaurantId: MAISON_ELYSE_RESTAURANT_ID,
        dishSlug: slug,
        assetVersion: version
      });
      storageObjects.push(objectPlan({ bucket: MODEL_BUCKET, path, asset: dish.webGlb, inventory: local.webGlb, existingObjects: knownObjects }));
      metadata.webModel3dStorageBucket = MODEL_BUCKET;
      metadata.webModel3dStoragePath = path;
      metadata.webModel3dUrl = publicModelUrl(row.id, "", version);
      metadata.webModel3dBytes = dish.webGlb.bytes;
      metadata.webModel3dSha256 = dish.webGlb.sha256;
      metadata.model3dUrl = metadata.webModel3dUrl;
    }
    if (dish.arLiteGlb) {
      const path = buildPreparedModelArLiteStoragePath({
        restaurantId: MAISON_ELYSE_RESTAURANT_ID,
        dishSlug: slug,
        assetVersion: version
      });
      storageObjects.push(objectPlan({ bucket: MODEL_BUCKET, path, asset: dish.arLiteGlb, inventory: local.arLiteGlb, existingObjects: knownObjects }));
      metadata.arModel3dStorageBucket = MODEL_BUCKET;
      metadata.arModel3dStoragePath = path;
      metadata.arModel3dUrl = publicModelUrl(row.id, "ar-lite", version);
      metadata.arModel3dBytes = dish.arLiteGlb.bytes;
      metadata.arModel3dSha256 = dish.arLiteGlb.sha256;
    }
    if (usdZPublishable) {
      const path = buildPreparedModelUsdzStoragePath({
        restaurantId: MAISON_ELYSE_RESTAURANT_ID,
        dishSlug: slug,
        assetVersion: version
      });
      storageObjects.push(objectPlan({ bucket: MODEL_BUCKET, path, asset: dish.usdzRuntime, inventory: local.usdzRuntime, existingObjects: knownObjects }));
      const reportStoragePath = [
        "restaurants",
        MAISON_ELYSE_RESTAURANT_ID,
        "models",
        "manifests",
        `${slug}-${version}-usdz-report.json`
      ].join("/");
      storageObjects.push(objectPlan({
        bucket: MODEL_BUCKET,
        path: reportStoragePath,
        asset: dish[PHYSICAL_SCALE_REPORT_KEY],
        inventory: physicalScaleReport,
        existingObjects: knownObjects
      }));
      metadata.arUsdzStorageBucket = MODEL_BUCKET;
      metadata.arUsdzStoragePath = path;
      metadata.arUsdzUrl = `/api/public/menu-dishes/${row.id}/model/usdz?v=${encodeURIComponent(version)}`;
      metadata.usdzUrl = "";
      metadata.arUsdzBytes = dish.usdzRuntime.bytes;
      metadata.arUsdzSha256 = dish.usdzRuntime.sha256;
      metadata.usdzRuntimeStatus = "ready";
      metadata.usdzRuntimeStorageBucket = MODEL_BUCKET;
      metadata.usdzRuntimeStoragePath = path;
      metadata.usdzRuntimeBytes = dish.usdzRuntime.bytes;
      metadata.usdzRuntimeSha256 = dish.usdzRuntime.sha256;
      metadata.usdzRuntimeContentType = dish.usdzRuntime.contentType;
      metadata.usdzOptimizationReportStoragePath = reportStoragePath;
      applyPhysicalScaleMetadata(metadata, physicalScaleReport.physicalScale);
      metadata.quickLookQaStatus = "not-tested";
      metadata.usdzSourceStored = false;
    } else if (dish.usdzRuntime) {
      metadata.usdzRuntimeStatus = USDZ_PENDING_STATUS;
      metadata.usdzRuntimePendingReason = USDZ_PENDING_REASON;
      metadata.usdzSourceStored = false;
      metadata.quickLookQaStatus = "not-tested";
    }
    const publishedModelAssets = {
      webGlb: dish.webGlb ?? null,
      arLiteGlb: dish.arLiteGlb ?? null,
      usdzRuntime: usdZPublishable ? dish.usdzRuntime : null
    };
    const modelAssetSha256 = buildModelAssetSha256(publishedModelAssets);
    const hasGlb = Boolean(dish.webGlb || dish.arLiteGlb);
    metadata.modelStatus = usdZPublishable
      ? "ready"
      : hasGlb
        ? "web_ready_usdz_pending"
        : dish.usdzRuntime
          ? USDZ_PENDING_STATUS
          : "missing";
    if (hasModelInputs) metadata.modelAssetVersion = version;
    else delete metadata.modelAssetVersion;
    if (modelAssetSha256) {
      metadata.modelAssetSha256 = modelAssetSha256;
      metadata.modelAssetSha256Format = MODEL_ASSET_SHA256_FORMAT;
    } else {
      delete metadata.modelAssetSha256;
      delete metadata.modelAssetSha256Format;
    }
    metadata.mediaBackfillVersion = manifest.version;
    metadata.mediaBackfillSource = "demo-assets-by-slug";
    if (hasExistingModelMetadata(row.metadata) && canonicalJson(row.metadata) !== canonicalJson(metadata)) {
      fail(`Existing model metadata conflicts with the Maison Elyse plan for ${row.restaurant_id}/${row.id}`);
    }
    dishUpdates.push({
      row,
      patch: {
        image_url: `/api/public/menu-dishes/${row.id}/photo`,
        has_immersive_view: hasGlb || usdZPublishable,
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

function errorDetails(error) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error)
  };
}

function assertRestoredDish(result, row) {
  if (!result || result.error) {
    fail(`DB rollback failed for ${row.id}: ${result?.error?.message ?? "no response"}`);
  }
  const data = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
  if (!data.some((item) => item?.id === row.id && item?.restaurant_id === row.restaurant_id)) {
    fail(`DB rollback was not confirmed for ${row.restaurant_id}/${row.id}`);
  }
}

function assertRemovedObject(result, object) {
  if (!result || result.error) {
    fail(`Storage rollback failed for ${object.bucket}/${object.path}: ${result?.error?.message ?? "no response"}`);
  }
  const data = Array.isArray(result.data) ? result.data : [];
  const treated = data.some((item) => {
    const value = typeof item === "string" ? item : item?.path ?? item?.name;
    return value === object.path || value === `${object.bucket}/${object.path}`;
  });
  if (!treated) fail(`Storage rollback was not confirmed for ${object.bucket}/${object.path}`);
}

function createRollbackFailure(initialError, rollbackErrors) {
  const composite = new Error("Backfill apply failed and rollback was incomplete.", { cause: initialError });
  composite.name = "MaisonElyseBackfillRollbackError";
  composite.code = "BACKFILL_ROLLBACK_INCOMPLETE";
  composite.rollbackComplete = false;
  composite.initialError = errorDetails(initialError);
  composite.rollbackErrors = rollbackErrors;
  return composite;
}

function createBackfillUpdateError(message, mutationApplied) {
  const error = new Error(message);
  error.backfillMutationApplied = mutationApplied;
  return error;
}

export async function applyPlan({ adapter, plan }) {
  const createdObjects = [];
  const updatedRows = [];
  if (plan.storageObjects.some((object) => object.action === "verify")) {
    fail("Apply refused: every existing Storage collision must be content-verified first.");
  }
  try {
    for (const object of plan.storageObjects) {
      if (object.action !== "create") continue;
      const result = await adapter.uploadObject(object);
      if (result?.created !== false) createdObjects.push(object);
    }
    for (const update of plan.dishUpdates) {
      updatedRows.push(update);
      try {
        await adapter.updateDish(update);
      } catch (error) {
        if (error?.backfillMutationApplied === false) updatedRows.pop();
        throw error;
      }
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const update of updatedRows.reverse()) {
      try {
        const result = await adapter.restoreDish(update.row);
        assertRestoredDish(result, update.row);
      } catch (rollbackError) {
        rollbackErrors.push({
          phase: "database-restore",
          restaurantId: update.row.restaurant_id,
          dishId: update.row.id,
          error: errorDetails(rollbackError)
        });
      }
    }
    for (const object of createdObjects.reverse()) {
      try {
        const result = await adapter.removeObject(object);
        assertRemovedObject(result, object);
      } catch (rollbackError) {
        rollbackErrors.push({
          phase: "storage-remove",
          bucket: object.bucket,
          path: object.path,
          error: errorDetails(rollbackError)
        });
      }
    }
    if (rollbackErrors.length > 0) throw createRollbackFailure(error, rollbackErrors);
    throw error;
  }
  return { createdObjects, updatedRows };
}

function planSummary(plan) {
  return {
    storageObjects: plan.storageObjects.map(({ bucket, path, action, bytes, contentType, sha256, localPath }) => ({ bucket, path, action, bytes, contentType, sha256, localPath })),
    objectCounts: {
      create: plan.storageObjects.filter((object) => object.action === "create").length,
      reuse: plan.storageObjects.filter((object) => object.action === "reuse").length,
      verify: plan.storageObjects.filter((object) => object.action === "verify").length
    },
    dishUpdates: plan.dishUpdates.map((update) => ({ slug: update.slug, id: update.row.id, imageUrl: update.patch.image_url, hasImmersiveView: update.patch.has_immersive_view })),
    deletionCount: 0
  };
}

function localRows(manifest) {
  return manifest.dishes.map((dish) => ({ id: dish.knownSupabaseDishId, restaurant_id: manifest.restaurant.id, slug: dish.slug, image_url: null, has_immersive_view: false, metadata: {} }));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function matchesDishMediaSnapshot(current, expected) {
  return (
    current?.image_url === (expected.image_url ?? null) &&
    Boolean(current?.has_immersive_view) === Boolean(expected.has_immersive_view) &&
    canonicalJson(asObject(current?.metadata)) === canonicalJson(asObject(expected.metadata))
  );
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
  const existingObjects = new Map();
  async function listPrefix(bucket, prefix) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } });
    if (error) fail(`Storage list failed for ${bucket}/${prefix}`);
    for (const item of data ?? []) {
      const name = item.name;
      if (!name) continue;
      const path = `${prefix}/${name}`;
      const itemMetadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
      const isObject = Boolean(item.id || itemMetadata.mimetype || itemMetadata.size || itemMetadata.eTag);
      if (isObject) {
        const size = Number(item.size ?? itemMetadata.size);
        existingObjects.set(existingObjectKey(bucket, path), {
          bucket,
          path,
          size: Number.isInteger(size) && size >= 0 ? size : null,
          contentType: normalizeContentType(item.contentType ?? item.mimetype ?? itemMetadata.mimetype ?? ""),
          sha256: typeof itemMetadata.sha256 === "string" ? itemMetadata.sha256 : ""
        });
      } else {
        await listPrefix(bucket, path);
      }
    }
  }
  await listPrefix(PHOTO_BUCKET, `restaurants/${MAISON_ELYSE_RESTAURANT_ID}`);
  await listPrefix(MODEL_BUCKET, `restaurants/${MAISON_ELYSE_RESTAURANT_ID}`);
  const adapter = {
    rows,
    existingObjects,
    async uploadObject(object) {
      const { error } = await client.storage.from(object.bucket).upload(object.path, object.data, { contentType: object.contentType, cacheControl: "31536000", upsert: false });
      if (error) fail(`Storage upload failed for ${object.bucket}/${object.path}`);
      return { created: true };
    },
    async updateDish(update) {
      const current = await client
        .from("menu_dishes")
        .select("id,restaurant_id,image_url,has_immersive_view,metadata")
        .eq("id", update.row.id)
        .eq("restaurant_id", MAISON_ELYSE_RESTAURANT_ID)
        .maybeSingle();
      if (current.error || !current.data) {
        throw createBackfillUpdateError(`DB snapshot read failed for ${update.slug}`, false);
      }
      if (!matchesDishMediaSnapshot(current.data, update.row)) {
        throw createBackfillUpdateError(`DB media snapshot conflict for ${update.row.restaurant_id}/${update.row.id}`, false);
      }
      const updated = await client
        .from("menu_dishes")
        .update(update.patch)
        .eq("id", update.row.id)
        .eq("restaurant_id", MAISON_ELYSE_RESTAURANT_ID)
        .select("id,restaurant_id")
        .maybeSingle();
      if (updated.error || !updated.data || updated.data.id !== update.row.id || updated.data.restaurant_id !== update.row.restaurant_id) {
        throw createBackfillUpdateError(`DB update failed for ${update.slug}`, true);
      }
      return updated;
    },
    async restoreDish(row) {
      return client
        .from("menu_dishes")
        .update({ image_url: row.image_url, has_immersive_view: row.has_immersive_view, metadata: row.metadata })
        .eq("id", row.id)
        .eq("restaurant_id", row.restaurant_id)
        .select("id,restaurant_id")
        .maybeSingle();
    },
    async removeObject(object) {
      return client.storage.from(object.bucket).remove([object.path]);
    },
    async downloadObject(object) {
      const downloaded = await client.storage.from(object.bucket).download(object.path);
      if (downloaded.error || !downloaded.data) fail(`Storage collision download failed for ${object.bucket}/${object.path}`);
      return {
        bytes: Buffer.from(await downloaded.data.arrayBuffer()),
        contentType: downloaded.data.type
      };
    }
  };
  return { adapter, rows, existingObjects, restaurant };
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
  let existingObjects = new Map();
  let adapter = null;
  let verification = "local-only; Supabase was not contacted";
  if (!args.localOnly) {
    const remote = await createSupabaseAdapter();
    rows = remote.rows;
    existingObjects = remote.existingObjects;
    adapter = remote.adapter;
    verification = `read-only Supabase verification: ${remote.restaurant.name ?? MAISON_ELYSE_SLUG}`;
  }
  const plan = createBackfillPlan({ manifest, inventory, rows, existingObjects });
  if (!args.localOnly) await verifyStorageObjectCollisions({ adapter, plan });
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
