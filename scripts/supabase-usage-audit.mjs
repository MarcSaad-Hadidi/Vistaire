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
import { createClient } from "@supabase/supabase-js";

const argv = new Set(process.argv.slice(2));
const jsonOnly = argv.has("--json");
const allowProductionRead = argv.has("--allow-production-read");
const limitArg = process.argv.find((value) => value.startsWith("--storage-limit="));
const storagePageSize = Math.max(
  50,
  Math.min(Number(limitArg?.split("=")[1] ?? 1_000) || 1_000, 1_000)
);

function fail(message) {
  if (jsonOnly) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(`[supabase:usage:audit] ${message}`);
  process.exitCode = 1;
  return { ok: false, error: message };
}

function parseMetadata(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
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
    const entries = data ?? [];
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Storage folders are represented by an entry with no id/metadata.
      if (!entry.id && !entry.metadata) {
        objects.push(...(await listStorageObjects(client, bucket, path, pageSize)));
      } else {
        objects.push({
          path,
          bytes: Number(entry.metadata?.size ?? entry.metadata?.size_bytes ?? 0) || 0,
          contentType: entry.metadata?.mimetype ?? entry.metadata?.contentType ?? null,
          category: categoryForPath(path)
        });
      }
    }
    if (entries.length < pageSize) break;
  }
  return objects;
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
  const looksProduction = Boolean(
    process.env.VISTAIRE_SUPABASE_AUDIT_TARGET === "production" ||
      (expectedRef && projectRef === expectedRef) ||
      // An unlabelled hosted project is ambiguous; fail closed until the
      // operator explicitly acknowledges a production-capable read.
      (!expectedRef && isSupabaseHosted)
  );
  if (looksProduction && !allowProductionRead) {
    return fail("Target matches the configured production project; add --allow-production-read for a read-only audit.");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "vistaire-supabase-usage-audit" } }
  });
  const now = Date.now();
  const restaurantResult = await client.from("restaurants").select("id").limit(10_000);
  if (restaurantResult.error) return fail(`restaurants read failed: ${restaurantResult.error.message}`);
  const restaurantIds = (restaurantResult.data ?? []).map((row) => row.id).filter(Boolean);
  const dishResult = await client
    .from("menu_dishes")
    .select("id,restaurant_id,metadata", { count: "exact" })
    .limit(10_000);
  if (dishResult.error) return fail(`menu_dishes read failed: ${dishResult.error.message}`);
  const dishes = dishResult.data ?? [];
  const photoRows = dishes.map((row) => parseMetadata(row.metadata));
  const sourcePaths = new Set(photoRows.map((metadata) => metadata.photoStoragePath).filter(Boolean));
  const derivativeCount = photoRows.reduce((count, metadata) => {
    const derivatives = metadata.photoDerivatives;
    return count + (derivatives && typeof derivatives === "object" ? Object.keys(derivatives).length : 0);
  }, 0);

  const buckets = {};
  const storageObjectsByBucket = new Map();
  for (const bucket of ["vistaire-media", "vistaire-3d"]) {
    try {
      const objects = await listStorageObjects(client, bucket);
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

  const mediaObjects = storageObjectsByBucket.get("vistaire-media") ?? [];
  // Storage list responses are intentionally not emitted in the report, but
  // retaining them briefly lets us report measured source/derivative bytes.
  const mediaSourceBytes = mediaObjects
    .filter((object) => /\/photos\/originals\//i.test(object.path))
    .reduce((sum, object) => sum + object.bytes, 0);
  const mediaDerivativeBytes = mediaObjects
    .filter((object) => /\/photos\/derivatives\//i.test(object.path))
    .reduce((sum, object) => sum + object.bytes, 0);

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
  const report = {
    generatedAt: new Date(now).toISOString(),
    projectRef,
    target: looksProduction ? "production-read-only" : "non-production-read-only",
    project: {
      plan: "not-available-via-data-api",
      status: "not-available-via-data-api",
      note: "Supabase Management API credentials are intentionally not accepted by this audit."
    },
    storage: buckets,
    capacity: {
      status: "not-computed",
      reason: "Plan/quota values require the Supabase Management API and are not inferred from Storage list responses."
    },
    photoCoverage: {
      dishes: dishResult.count ?? dishes.length,
      sources: sourcePaths.size,
      derivativeEntries: derivativeCount,
      rowsWithDerivatives: photoRows.filter((metadata) => metadata.photoDerivatives && typeof metadata.photoDerivatives === "object").length,
      originalFallbackCandidates: photoRows.filter((metadata) => !metadata.photoDerivatives || typeof metadata.photoDerivatives !== "object").length,
      sourceBytes: mediaSourceBytes,
      derivativeBytes: mediaDerivativeBytes
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
    console.log(`Analytics: ${JSON.stringify(report.analytics)}`);
    console.log(`Schema projections: ${report.schema.status}`);
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
