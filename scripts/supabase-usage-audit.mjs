#!/usr/bin/env node

/**
 * Read-only Supabase usage audit.
 *
 * The script never calls Storage upload/remove or PostgREST mutations. A
 * project that looks like the configured production project requires the
 * explicit --allow-production-read flag. CI is always refused so credentials
 * cannot accidentally turn a build into a production probe.
 */
import process from "node:process";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  buildStrictPhotoCoverageCounts,
  classifyDishPhotoUsage,
  isFreshMediaUsageMeasurement,
  parseMediaMetadata,
  paginateProviderRows,
  requireStorageObjectBytes,
  verifyDerivativeObject,
  verifyLegacyDerivativeObject
} from "../lib/owner/mediaBackfill.ts";
import { parseUsageAuditNumericOptions } from "../lib/owner/mediaCli.ts";

const rawArgs = process.argv.slice(2);
const argv = new Set(rawArgs);
const jsonOnly = argv.has("--json");
const allowProductionRead = argv.has("--allow-production-read");
const verifyHash = argv.has("--verify-hash");
let cliParseError = null;
let numericOptions;
try {
  numericOptions = parseUsageAuditNumericOptions(rawArgs);
} catch (error) {
  cliParseError = error;
  numericOptions = parseUsageAuditNumericOptions([]);
}
const { storagePageSize, concurrency, verifyMaxObjects, verifyMaxBytes, verifyTimeoutMs } = numericOptions;
const PHOTO_VARIANTS = ["thumbnail", "card", "display"];

function fail(message) {
  if (jsonOnly) console.log(JSON.stringify({
    reportVersion: 2,
    status: "unavailable",
    pass: false,
    generatedAt: new Date().toISOString(),
    errors: [message]
  }, null, 2));
  else console.error(`[supabase:usage:audit] ${message}`);
  process.exitCode = 1;
  return { ok: false, error: message };
}

function collectAssetReferences(value, result = new Set()) {
  if (typeof value === "string" && /\.(?:glb|usdz)(?:\?|$)/i.test(value)) {
    result.add(value.split("?")[0]);
  } else if (Array.isArray(value)) {
    for (const item of value) collectAssetReferences(item, result);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectAssetReferences(item, result);
  }
  return result;
}

function categoryForPath(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".usdz")) return "usdz";
  if (lower.endsWith(".glb") && /ar[-_]?lite|ar-lite/i.test(lower)) return "ar-lite-glb";
  if (lower.endsWith(".glb") && /source|original/i.test(lower)) return "source-glb";
  if (lower.endsWith(".glb")) return "web-glb";
  if (lower.endsWith("manifest.json")) return "manifest";
  return "other";
}

async function listStorageObjects(client, bucket, prefix = "", pageSize = storagePageSize) {
  const objects = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw new Error(`${bucket} list ${prefix || "/"}: ${error.message}`);
    if (!Array.isArray(data)) throw new Error(`${bucket} list ${prefix || "/"}: partial provider response`);
    const entries = data;
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Storage folders are represented by an entry with no id/metadata.
      if (!entry.id && !entry.metadata) {
        objects.push(...(await listStorageObjects(client, bucket, path, pageSize)));
      } else {
        const objectBytes = requireStorageObjectBytes(entry.metadata, `${bucket}/${path}`);
        objects.push({
          path,
          bytes: objectBytes,
          contentType: entry.metadata?.mimetype ?? entry.metadata?.contentType ?? null,
          category: categoryForPath(path)
        });
      }
    }
    if (entries.length < pageSize) break;
  }
  return objects;
}

async function readAllDishes(client) {
  return paginateProviderRows({
    pageSize: 1_000,
    fetchPage: async (offset, limit) => {
      const result = await client
        .from("menu_dishes")
        .select("id,restaurant_id,image_url,metadata")
        .order("id", { ascending: true })
        .range(offset, offset + limit - 1);
      return { data: result.data, error: result.error };
    },
    identity: (row) => String(row.id ?? "")
  });
}

async function mapLimited(items, workerCount, worker) {
  const results = [];
  let cursor = 0;
  async function loop() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, Math.max(items.length, 1)) }, loop));
  return results;
}

async function downloadBounded(bucket, storagePath, expectedBytes, budget) {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0) throw new Error(`unknown object size: ${storagePath}`);
  if (budget.objects + 1 > verifyMaxObjects) throw new Error("verify-hash object limit exceeded");
  if (budget.bytes + expectedBytes > verifyMaxBytes) throw new Error("verify-hash byte/memory limit exceeded");
  budget.objects += 1;
  budget.bytes += expectedBytes;
  let timer;
  try {
    const result = await Promise.race([
      bucket.download(storagePath),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`verify-hash timeout: ${storagePath}`)), verifyTimeoutMs);
      })
    ]);
    if (result.error || !result.data) throw new Error(`download unavailable: ${result.error?.message ?? storagePath}`);
    const body = Buffer.from(await result.data.arrayBuffer());
    if (body.byteLength !== expectedBytes) throw new Error(`download size changed: ${storagePath}`);
    return body;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function deduplicateStorageObjects(bucket, objects) {
  const byPath = new Map();
  for (const object of objects) {
    const key = `${bucket}/${object.path}`;
    const prior = byPath.get(key);
    if (prior && (prior.bytes !== object.bytes || prior.contentType !== object.contentType)) {
      throw new Error(`conflicting duplicate Storage object: ${key}`);
    }
    byPath.set(key, object);
  }
  return [...byPath.values()];
}

async function capacityState(client, projectRef) {
  const { data, error } = await client.rpc("get_media_capacity_state", { p_project_ref: projectRef });
  const value = Array.isArray(data) ? data[0] : data;
  if (error || !value || typeof value !== "object" || value.status !== "available") {
    return { status: "unavailable", reason: error?.message ?? value?.reason ?? "missing capacity state" };
  }
  const quotaBytes = Number(value.quotaBytes);
  const usedBytes = Number(value.usedBytes);
  const activeReservedBytes = Number(value.activeReservedBytes);
  if (
    value.projectRef !== projectRef ||
    !Number.isSafeInteger(quotaBytes) || quotaBytes <= 0 ||
    !Number.isSafeInteger(usedBytes) || usedBytes < 0 ||
    !Number.isSafeInteger(activeReservedBytes) || activeReservedBytes < 0 ||
    typeof value.quotaSource !== "string" || !value.quotaSource.trim() ||
    !isFreshMediaUsageMeasurement(value.usageMeasuredAt)
  ) return { status: "unavailable", reason: "invalid authoritative capacity state" };
  return {
    status: "available",
    quotaBytes,
    usedBytes,
    activeReservedBytes,
    quotaSource: value.quotaSource,
    usageMeasuredAt: value.usageMeasuredAt,
    headroomBytes: quotaBytes - usedBytes - activeReservedBytes,
    headroomPercent: ((quotaBytes - usedBytes - activeReservedBytes) / quotaBytes) * 100
  };
}

async function auditPhotoRow({ row, bucket, objectByPath, budget }) {
  const parsedMetadata = parseMediaMetadata(row.metadata);
  const metadata = parsedMetadata.metadata;
  const objectResults = {};
  const sourcePath = typeof metadata.photoStoragePath === "string" ? metadata.photoStoragePath : "";
  const sourceSha256 = typeof metadata.photoSha256 === "string" ? metadata.photoSha256.toLowerCase() : "";
  if (sourcePath) {
    const sourceObject = objectByPath.get(sourcePath);
    const reasons = [];
    if (!sourceObject) reasons.push("missing-object");
    else {
      if (sourceObject.bytes !== Number(metadata.photoBytes)) reasons.push("wrong-size");
      const expectedType = typeof metadata.photoContentType === "string"
        ? metadata.photoContentType.split(";")[0].toLowerCase()
        : "";
      if (sourceObject.contentType !== expectedType) reasons.push("wrong-content-type");
      if (verifyHash && reasons.length === 0) {
        const body = await downloadBounded(bucket, sourcePath, sourceObject.bytes, budget);
        const actualSha = createHash("sha256").update(body).digest("hex");
        if (actualSha !== sourceSha256) reasons.push("wrong-hash");
      }
    }
    objectResults.source = { reasons };
  }

  const derivatives = metadata.photoDerivatives && typeof metadata.photoDerivatives === "object" && !Array.isArray(metadata.photoDerivatives)
    ? metadata.photoDerivatives
    : {};
  for (const variant of PHOTO_VARIANTS) {
    const derivative = derivatives[variant];
    const derivativePath = derivative && typeof derivative === "object"
      ? derivative.storagePath
      : "";
    const object = typeof derivativePath === "string" ? objectByPath.get(derivativePath) : null;
    let body;
    if (verifyHash && object) body = await downloadBounded(bucket, derivativePath, object.bytes, budget);
    if (derivative?.schemaVersion === 1 || derivative?.recipeId === "dish-photo-v1") {
      const verified = await verifyLegacyDerivativeObject({
        restaurantId: String(row.restaurant_id ?? ""),
        sourceSha256,
        variant,
        metadata: derivative,
        object: object ? { bytes: object.bytes, contentType: object.contentType ?? "", body } : null,
        verifyHash
      });
      objectResults[variant] = { reasons: verified.reasons };
    } else {
      const verified = await verifyDerivativeObject({
        restaurantId: String(row.restaurant_id ?? ""),
        sourceSha256,
        variant,
        metadata: derivative,
        object: object ? { bytes: object.bytes, contentType: object.contentType ?? "", body } : null,
        verifyHash
      });
      objectResults[variant] = { reasons: verified.reasons };
    }
  }
  return {
    dishId: row.id,
    restaurantId: row.restaurant_id,
    ...classifyDishPhotoUsage({
      metadata,
      metadataValid: parsedMetadata.valid,
      imageUrl: row.image_url,
      objectResults
    })
  };
}

async function countAnalytics(client, restaurantId, fromIso) {
  let query = client
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("source", "production");
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  if (fromIso) query = query.gte("created_at", fromIso);
  const { count, error } = await query;
  if (error) return { ok: false, error: error.message, count: null };
  return { ok: true, count: count ?? 0 };
}

async function projectionStatus(client, table, columns) {
  const { error } = await client.from(table).select(columns).limit(1);
  return error
    ? { ok: false, table, error: error.message }
    : { ok: true, table, columns: columns.split(",") };
}

async function main() {
  if (cliParseError) return fail(cliParseError instanceof Error ? cliParseError.message : String(cliParseError));
  if (process.env.CI === "true" || process.env.CI === "1") {
    return fail("Refusing Supabase usage audit in CI; production requests must remain zero.");
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY explicitly.");
  }
  let projectRef = "";
  let isSupabaseHosted = false;
  try {
    const hostname = new URL(supabaseUrl).hostname.toLowerCase();
    isSupabaseHosted = hostname.endsWith(".supabase.co");
    projectRef = hostname.endsWith(".supabase.co")
      ? hostname.slice(0, -".supabase.co".length)
      : hostname;
  } catch {
    return fail("NEXT_PUBLIC_SUPABASE_URL is invalid.");
  }
  const expectedRef = process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF?.trim().toLowerCase();
  if (expectedRef && expectedRef !== projectRef) {
    return fail("Configured project ref is different from the Supabase target.");
  }
  const looksProduction = Boolean(
    process.env.VISTAIRE_SUPABASE_AUDIT_TARGET === "production" ||
      isSupabaseHosted
  );
  if (looksProduction && !allowProductionRead) {
    return fail("Target matches the configured production project; add --allow-production-read for a read-only audit.");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "vistaire-supabase-usage-audit" } }
  });
  const now = Date.now();
  let restaurantRows;
  let dishes;
  try {
    restaurantRows = await paginateProviderRows({
      pageSize: 1_000,
      fetchPage: async (offset, limit) => {
        const result = await client.from("restaurants").select("id").order("id", { ascending: true }).range(offset, offset + limit - 1);
        return { data: result.data, error: result.error };
      },
      identity: (row) => String(row.id ?? "")
    });
    dishes = await readAllDishes(client);
  } catch (error) {
    return fail(`paginated database read failed: ${error instanceof Error ? error.message : error}`);
  }
  const restaurantIds = restaurantRows.map((row) => row.id).filter(Boolean);
  const photoRows = dishes.map((row) => parseMediaMetadata(row.metadata).metadata);
  const sourcePaths = new Set(photoRows.map((metadata) => metadata.photoStoragePath).filter(Boolean));
  const derivativeCount = photoRows.reduce((count, metadata) => {
    const derivatives = metadata.photoDerivatives;
    return count + (derivatives && typeof derivatives === "object" ? Object.keys(derivatives).length : 0);
  }, 0);

  const buckets = {};
  const storageObjectsByBucket = new Map();
  for (const bucket of ["vistaire-media", "vistaire-3d"]) {
    try {
      const objects = deduplicateStorageObjects(
        bucket,
        await listStorageObjects(client, bucket)
      );
      storageObjectsByBucket.set(bucket, objects);
      const byCategory = {};
      for (const object of objects) {
        const category = object.category;
        byCategory[category] = byCategory[category] ?? { objects: 0, bytes: 0 };
        byCategory[category].objects += 1;
        byCategory[category].bytes += object.bytes;
      }
      buckets[bucket] = {
        objects: objects.length,
        bytes: objects.reduce((sum, object) => sum + object.bytes, 0),
        byCategory
      };
      if (bucket === "vistaire-3d") {
        const referenced = new Set();
        for (const row of dishes) collectAssetReferences(row.metadata, referenced);
        const objectPaths = new Set(objects.map((object) => object.path));
        buckets[bucket].referencedCandidates = referenced.size;
        buckets[bucket].missingReferenceCandidates = [...referenced].filter((path) => !objectPaths.has(path)).length;
        buckets[bucket].orphanCandidates = objects.filter((object) => !referenced.has(object.path)).length;
      }
    } catch (error) {
      buckets[bucket] = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  const storageUnavailable = [...Object.values(buckets)].some((entry) => entry.error);
  const mediaObjects = storageObjectsByBucket.get("vistaire-media");
  // Storage list responses are intentionally not emitted in the report, but
  // retaining them briefly lets us report measured source/derivative bytes.
  const mediaSourceBytes = mediaObjects
    ? mediaObjects
    .filter((object) => /\/photos\/originals\//i.test(object.path))
    .reduce((sum, object) => sum + object.bytes, 0)
    : null;
  const mediaDerivativeBytes = mediaObjects
    ? mediaObjects
    .filter((object) => /\/photos\/derivatives\//i.test(object.path))
    .reduce((sum, object) => sum + object.bytes, 0)
    : null;

  const verifyBudget = { objects: 0, bytes: 0 };
  let photoAudit = [];
  if (!storageUnavailable && mediaObjects) {
    const mediaBucket = client.storage.from("vistaire-media");
    const objectByPath = new Map(mediaObjects.map((object) => [object.path, object]));
    photoAudit = await mapLimited(dishes, concurrency, async (row) => {
      try {
        return await auditPhotoRow({ row, bucket: mediaBucket, objectByPath, budget: verifyBudget });
      } catch (error) {
        return {
          dishId: row.id,
          restaurantId: row.restaurant_id,
          classification: "unavailable",
          status: "unavailable",
          reasons: [error instanceof Error ? error.message : String(error)]
        };
      }
    });
  } else {
    photoAudit = dishes.map((row) => ({
      dishId: row.id,
      restaurantId: row.restaurant_id,
      classification: "unavailable",
      status: "unavailable",
      reasons: ["Storage listing unavailable"]
    }));
  }
  const classifications = {};
  for (const entry of photoAudit) {
    classifications[entry.classification] = (classifications[entry.classification] ?? 0) + 1;
  }
  const strictCoverage = buildStrictPhotoCoverageCounts(photoAudit);
  const capacity = await capacityState(client, projectRef);

  const analytics = {
    total: await countAnalytics(client),
    last24h: await countAnalytics(client, undefined, new Date(now - 86_400_000).toISOString()),
    last7d: await countAnalytics(client, undefined, new Date(now - 7 * 86_400_000).toISOString()),
    last30d: await countAnalytics(client, undefined, new Date(now - 30 * 86_400_000).toISOString())
  };
  const schema = await Promise.all([
    projectionStatus(client, "menus", "id,restaurant_id,name,slug,status,is_primary,settings_json,created_at,updated_at"),
    projectionStatus(client, "menu_categories", "id,restaurant_id,menu_id,name,slug,description,display_order,created_at,updated_at"),
    projectionStatus(client, "analytics_events", "id,restaurant_id,menu_id,dish_id,session_id,event_name,source,dish_slug,category_slug,search_query,filter_name,cta_name,created_at")
  ]);
  const photoStatus = photoAudit.some((entry) => entry.status === "unavailable")
    ? "unavailable"
    : photoAudit.some((entry) => entry.status === "fail")
      ? "fail"
      : photoAudit.some((entry) => entry.status === "partial")
        ? "partial"
        : "pass";
  const overallStatus = storageUnavailable || capacity.status === "unavailable" || photoStatus === "unavailable"
    ? "unavailable"
    : photoStatus === "fail"
      ? "fail"
      : photoStatus === "partial"
        ? "partial"
        : "pass";
  const report = {
    reportVersion: 2,
    status: overallStatus,
    generatedAt: new Date(now).toISOString(),
    projectRef,
    target: looksProduction ? "production-read-only" : "non-production-read-only",
    project: {
      status: capacity.status,
      note: "Quota and global usage come only from the authoritative project-scoped capacity state."
    },
    storage: buckets,
    capacity,
    photoCoverage: {
      status: photoStatus,
      dishes: dishes.length,
      sources: sourcePaths.size,
      derivativeEntries: derivativeCount,
      rowsWithDerivatives: photoRows.filter((metadata) => metadata.photoDerivatives && typeof metadata.photoDerivatives === "object" && Object.keys(metadata.photoDerivatives).length > 0).length,
      originalFallbackCandidates: photoAudit.filter(
        (entry) => entry.classification === "original-only" || entry.status === "partial"
      ).length,
      sourceBytes: mediaSourceBytes,
      derivativeBytes: mediaDerivativeBytes,
      classifications,
      ...strictCoverage,
      verification: {
        mode: verifyHash ? "hash" : "existence-size-content-type",
        objects: verifyBudget.objects,
        bytes: verifyBudget.bytes,
        maxObjects: verifyMaxObjects,
        maxBytes: verifyMaxBytes,
        timeoutMs: verifyTimeoutMs,
        concurrency
      },
      rows: photoAudit
    },
    analytics,
    schema: { status: schema.every((entry) => entry.ok) ? "pass" : "drift-or-unavailable", projections: schema },
    advisors: {
      status: "not-queried",
      reason: "Supabase advisor endpoints are provider APIs, not part of the read-only PostgREST contract. Capture them separately in the provider dashboard."
    },
    notes: [
      "Read-only audit: no Storage writes/removes, no DB mutations, no plan/provider changes.",
      `Restaurants observed: ${restaurantIds.length}.`,
      "An empty photoDerivatives object is classified as partial, never complete.",
      "3D reference/orphan counts are candidates based on metadata path matches; review URL normalization before any cleanup."
    ]
  };
  if (jsonOnly) console.log(JSON.stringify(report, null, 2));
  else {
    console.log("Supabase usage audit (read-only)");
    console.log(`Project: ${report.projectRef} (${report.target})`);
    for (const [bucket, value] of Object.entries(report.storage)) {
      console.log(`Storage ${bucket}: ${value.error ? value.error : `${value.objects} objects / ${value.bytes} bytes`}`);
      if (value.byCategory) console.log(`  categories: ${JSON.stringify(value.byCategory)}`);
    }
    console.log(`Photos: ${report.photoCoverage.dishes} dishes, ${report.photoCoverage.rowsWithDerivatives} derivative rows, ${report.photoCoverage.sources} distinct sources`);
    console.log(`Photo audit: ${report.photoCoverage.status} ${JSON.stringify(report.photoCoverage.classifications)}`);
    console.log(`Analytics: ${JSON.stringify(report.analytics)}`);
    console.log(`Schema projections: ${report.schema.status}`);
    console.log(JSON.stringify(report, null, 2));
  }
  if (overallStatus !== "pass") process.exitCode = 1;
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
