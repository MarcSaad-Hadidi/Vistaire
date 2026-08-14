import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const RECIPE = require("../lib/owner/dishPhotoRecipe.json");
const VARIANTS = Object.entries(RECIPE.variants).map(([name, config]) => ({ name, ...config }));
const DEFAULT_CHECKPOINT = path.resolve(
  process.env.VISTAIRE_MEDIA_BACKFILL_CHECKPOINT ??
    ".cache/media-backfill/dish-photo-derivatives.json"
);
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const measureOnly = args.has("--measure-only");
const verifyOnly = args.has("--verify-only");
const verifySource = args.has("--verify-source");
const confirmProduction = args.has("--confirm-production");
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const concurrencyArg = process.argv.find((value) => value.startsWith("--concurrency="));
const checkpointArg = process.argv.find((value) => value.startsWith("--checkpoint="));
const rowLimit = Math.max(1, Math.min(Number(limitArg?.split("=")[1] ?? 1000), 10_000));
const concurrency = Math.max(1, Math.min(Number(concurrencyArg?.split("=")[1] ?? 2), 4));
const checkpointPath = path.resolve(checkpointArg?.split("=")[1] ?? DEFAULT_CHECKPOINT);
const restaurantFilter = process.argv.find((value) => value.startsWith("--restaurant-id="))?.split("=")[1]?.trim();
const dishFilter = process.argv.find((value) => value.startsWith("--dish-id="))?.split("=")[1]?.trim();
let checkpointWriteQueue = Promise.resolve();

function fail(message) {
  console.error(`[media:backfill] ${message}`);
  process.exitCode = 1;
}

function parseMetadata(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return { ...value };
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ...parsed } : {};
    } catch {
      return {};
    }
  }
  return {};
}

function isSha(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value.trim());
}

function isSafeRestaurantId(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isSafeOriginalPath(value, restaurantId) {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    new RegExp(
      `^restaurants/${restaurantId}/photos/originals/[a-z0-9][a-z0-9._-]*\\.(?:jpg|png|webp)$`,
      "i"
    ).test(value) &&
    !value.includes("..")
  );
}

function isCompleteDerivative(value, restaurantId, sourceSha256, variant) {
  const outputSha256 = typeof value?.outputSha256 === "string"
    ? value.outputSha256.toLowerCase()
    : typeof value?.sha256 === "string"
      ? value.sha256.toLowerCase()
      : "";
  const outputPathMatch = typeof value?.storagePath === "string"
    ? new RegExp(`^restaurants/${restaurantId}/photos/derivatives/${sourceSha256}/${RECIPE.id}/${variant}-([a-f0-9]{64})\\.webp$`, "i").exec(value.storagePath)
    : null;
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.storagePath === "string" &&
      outputPathMatch &&
      outputPathMatch[1].toLowerCase() === outputSha256 &&
      isSha(outputSha256) &&
      (!value.sha256 || String(value.sha256).toLowerCase() === outputSha256) &&
      value.variant === variant &&
      value.recipeId === RECIPE.id &&
      value.schemaVersion === RECIPE.schemaVersion &&
      value.contentType === "image/webp" &&
      value.format === "webp" &&
      typeof value.generatedAt === "string" &&
      Number.isFinite(Date.parse(value.generatedAt)) &&
      typeof value.encoder === "string" &&
      value.encoder.length > 0 &&
      Number.isInteger(Number(value.bytes)) &&
      Number(value.bytes) > 0 &&
      Number.isInteger(Number(value.width)) &&
      Number(value.width) > 0 &&
      Number(value.width) <= Number(RECIPE.variants[variant].width) &&
      Number.isInteger(Number(value.height)) &&
      Number(value.height) > 0 &&
      Number(value.height) <= Number(RECIPE.variants[variant].width) &&
      String(value.sourceSha256 ?? "").toLowerCase() === sourceSha256
  );
}

function legacyDerivativeByteSize(value, restaurantId, sourceSha256, variant) {
  if (!value || typeof value !== "object") return 0;
  const bytes = Number(value.bytes);
  if (!Number.isInteger(bytes) || bytes <= 0) return 0;
  const storagePath = typeof value.storagePath === "string" ? value.storagePath : "";
  const legacyPath = new RegExp(
    `^restaurants/${restaurantId}/photos/derivatives/${sourceSha256}/${variant}\\.webp$`,
    "i"
  );
  return legacyPath.test(storagePath) ? bytes : 0;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function makeDerivative(bytes, config) {
  return sharp(bytes, {
    failOn: RECIPE.sharpPolicy.failOn,
    limitInputPixels: RECIPE.sharpPolicy.limitInputPixels,
    limitInputChannels: RECIPE.sharpPolicy.limitInputChannels,
    pages: RECIPE.sharpPolicy.pages
  })
    .rotate()
    .resize({ width: config.width, height: config.width, fit: "inside", withoutEnlargement: true })
    .webp({ quality: config.quality, effort: 4 })
    .timeout({ seconds: RECIPE.sharpPolicy.timeoutSeconds })
    .toBuffer({ resolveWithObject: true });
}

async function loadCheckpoint() {
  try {
    const parsed = JSON.parse(await readFile(checkpointPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveCheckpoint(checkpoint) {
  const snapshot = `${JSON.stringify(checkpoint, null, 2)}\n`;
  checkpointWriteQueue = checkpointWriteQueue.then(async () => {
    await mkdir(path.dirname(checkpointPath), { recursive: true });
    await writeFile(checkpointPath, snapshot, "utf8");
  });
  await checkpointWriteQueue;
}

function isStorageNotFound(error) {
  return Boolean(
    error &&
      (Number(error.statusCode) === 404 ||
        Number(error.status) === 404 ||
        /not found|does not exist/i.test(String(error.message ?? error)))
  );
}

function storageInfoBytes(info) {
  const value = info?.metadata?.size ?? info?.metadata?.size_bytes ?? info?.size;
  const bytes = Number(value);
  return Number.isInteger(bytes) && bytes >= 0 ? bytes : null;
}

function derivativePathsFromMetadata(value) {
  const metadata = parseMetadata(value);
  const derivatives = metadata.photoDerivatives;
  if (!derivatives || typeof derivatives !== "object" || Array.isArray(derivatives)) {
    return [];
  }
  return Object.values(derivatives)
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "";
      const storagePath = entry.storagePath;
      return typeof storagePath === "string" ? storagePath.trim() : "";
    })
    .filter(Boolean);
}

async function referencedDerivativePaths(client, plan) {
  try {
    const { data, error } = await client
      .from("menu_dishes")
      .select("metadata")
      .eq("restaurant_id", plan.restaurantId);
    if (error || !Array.isArray(data)) return null;

    const references = new Set();
    for (const row of data) {
      for (const storagePath of derivativePathsFromMetadata(row?.metadata)) {
        references.add(storagePath);
      }
    }
    return references;
  } catch {
    return null;
  }
}

async function rollbackUploadedDerivatives(bucket, client, plan, uploadedPaths) {
  if (!uploadedPaths.length) return;

  // A failed guarded update may race another dish with the same source SHA.
  // If references cannot be read, keep the objects as safe orphans.
  const references = await referencedDerivativePaths(client, plan);
  if (!references) return;

  const rollbackPaths = uploadedPaths.filter((storagePath) => !references.has(storagePath));
  if (rollbackPaths.length) await bucket.remove(rollbackPaths);
}

const sourceLocks = new Map();

async function withSourceLock(key, work) {
  const previous = sourceLocks.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  sourceLocks.set(key, current);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (sourceLocks.get(key) === current) sourceLocks.delete(key);
  }
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  const parsed = new URL(url);
  const local = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !local) throw new Error("URL Supabase HTTPS ou fixture locale requise.");
  if (apply && !local && (!confirmProduction || process.env.VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY !== "1")) {
    throw new Error("Apply bloque: ajoutez --confirm-production et VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY=1 après revue du dry-run.");
  }
  return { url: parsed.origin, key };
}

async function readRows(client) {
  const rows = [];
  for (let offset = 0; offset < rowLimit; offset += 1000) {
    const { data, error } = await client
      .from("menu_dishes")
      .select("id,restaurant_id,slug,name,metadata")
      .not("metadata", "is", null)
      .order("id", { ascending: true })
      .range(offset, Math.min(offset + 999, rowLimit - 1));
    if (error) throw new Error(`Lecture menu_dishes impossible: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function planRow(row) {
  const metadata = parseMetadata(row.metadata);
  const restaurantId = typeof row.restaurant_id === "string" ? row.restaurant_id.trim() : "";
  const sourcePath = typeof metadata.photoStoragePath === "string" ? metadata.photoStoragePath.trim() : "";
  const sourceSha = typeof metadata.photoSha256 === "string" ? metadata.photoSha256.trim().toLowerCase() : "";
  if (!isSafeRestaurantId(restaurantId) || !isSha(sourceSha) || !isSafeOriginalPath(sourcePath, restaurantId)) return null;
  if (restaurantFilter && restaurantId !== restaurantFilter) return null;
  if (dishFilter && String(row.id) !== dishFilter) return null;
  const existing = metadata.photoDerivatives && typeof metadata.photoDerivatives === "object"
    ? metadata.photoDerivatives
    : {};
  const missing = VARIANTS.filter((variant) => {
    const item = existing[variant.name];
    return !isCompleteDerivative(item, restaurantId, sourceSha, variant.name);
  });
  if (!missing.length) return { row, metadata, restaurantId, sourcePath, sourceSha, missing, status: "complete" };
  return { row, metadata, restaurantId, sourcePath, sourceSha, missing, status: "planned" };
}

async function processPlan(client, plan, checkpoint) {
  const key = `${plan.row.id}:${plan.sourceSha}`;
  if (!verifyOnly && checkpoint.completed?.[key]) return { status: "checkpoint-skip", key };
  if (!apply && !measureOnly && !verifyOnly) {
    checkpoint.planned = (checkpoint.planned ?? 0) + 1;
    return { status: "dry-run", key, missing: plan.missing.map((variant) => variant.name) };
  }

  const bucket = client.storage.from("vistaire-media");
  if (verifyOnly) {
    const checks = [];
    for (const variant of VARIANTS) {
      const metadata = plan.metadata.photoDerivatives?.[variant.name];
      const complete = isCompleteDerivative(
        metadata,
        plan.restaurantId,
        plan.sourceSha,
        variant.name
      );
      let objectPresent = false;
      let objectBytes = null;
      if (complete) {
        const object = await bucket.info(metadata.storagePath);
        objectBytes = storageInfoBytes(object.data);
        objectPresent =
          !object.error &&
          Boolean(object.data) &&
          objectBytes !== null &&
          objectBytes === Number(metadata.bytes);
      }
      checks.push({ variant: variant.name, complete, objectPresent, objectBytes });
    }
    if (checks.some((check) => !check.complete || !check.objectPresent)) {
      return { status: "error", key, error: "Derivative metadata/object verification failed.", checks };
    }
    if (verifySource) {
      const downloaded = await bucket.download(plan.sourcePath);
      if (downloaded.error || !downloaded.data) {
        return {
          status: "error",
          key,
          error: `Original impossible à lire: ${downloaded.error?.message ?? plan.sourcePath}`,
          checks
        };
      }
      const sourceBytes = Buffer.from(await downloaded.data.arrayBuffer());
      if (sha256(sourceBytes) !== plan.sourceSha) {
        return { status: "error", key, error: `SHA original différent: ${plan.sourcePath}`, checks };
      }
    }
    return { status: "verified", key, checks, sourceChecked: verifySource };
  }

  const downloaded = await bucket.download(plan.sourcePath);
  if (downloaded.error || !downloaded.data) throw new Error(`Original impossible à lire: ${downloaded.error?.message ?? plan.sourcePath}`);
  const sourceBytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (sha256(sourceBytes) !== plan.sourceSha) throw new Error(`SHA original différent: ${plan.sourcePath}`);

  if (measureOnly) {
    const measured = [];
    for (const variant of plan.missing) {
      const generated = await makeDerivative(sourceBytes, variant);
      measured.push({
        variant: variant.name,
        bytes: generated.data.byteLength,
        width: Number(generated.info?.width ?? 0),
        height: Number(generated.info?.height ?? 0),
        outputSha256: sha256(generated.data)
      });
    }
    return { status: "measure-only", key, sourceBytes: sourceBytes.byteLength, measured };
  }
  const photoDerivatives = { ...(plan.metadata.photoDerivatives ?? {}) };
  const uploadedPaths = [];
  try {
    for (const variant of plan.missing) {
      const generated = await makeDerivative(sourceBytes, variant);
      const bytes = generated.data;
      const outputSha256 = sha256(bytes);
      const outputPath = `restaurants/${plan.restaurantId}/photos/derivatives/${plan.sourceSha}/${RECIPE.id}/${variant.name}-${outputSha256}.webp`;
      const existing = await bucket.info(outputPath);
      if (existing.error && !isStorageNotFound(existing.error)) {
        throw new Error(`Vérification ${variant.name} impossible: ${existing.error.message ?? outputPath}`);
      }
      const existingBytes = storageInfoBytes(existing.data);
      if (existing.data && existingBytes !== null && existingBytes !== bytes.byteLength) {
        throw new Error(`Conflit immutable ${variant.name}: taille Storage inattendue.`);
      }
      const uploaded = await bucket.upload(outputPath, bytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false
      });
      if (uploaded.error) {
        const conflict = await bucket.info(outputPath);
        if (conflict.error || !conflict.data) throw new Error(`Upload ${variant.name} impossible: ${uploaded.error.message}`);
        const conflictBytes = storageInfoBytes(conflict.data);
        if (conflictBytes !== null && conflictBytes !== bytes.byteLength) {
          throw new Error(`Conflit immutable ${variant.name}: taille Storage inattendue.`);
        }
      }
      // Rollback may remove only objects created by this process. A
      // concurrent immutable-path conflict is idempotent but not ours to
      // delete, even if the pre-upload info call saw 404.
      if (!existing.data && !uploaded.error) uploadedPaths.push(outputPath);
      photoDerivatives[variant.name] = {
        storagePath: outputPath,
        schemaVersion: RECIPE.schemaVersion,
        recipeId: RECIPE.id,
        variant: variant.name,
        sha256: outputSha256,
        outputSha256,
        contentType: "image/webp",
        format: "webp",
        width: Number(generated.info?.width ?? 0),
        height: Number(generated.info?.height ?? 0),
        bytes: bytes.byteLength,
        sourceSha256: plan.sourceSha,
        generatedAt: new Date().toISOString(),
        encoder: RECIPE.encoder
      };
    }
    const current = await client
      .from("menu_dishes")
      .select("metadata")
      .eq("id", plan.row.id)
      .eq("restaurant_id", plan.restaurantId)
      .maybeSingle();
    const currentMetadata = parseMetadata(current.data?.metadata);
    if (
      current.error ||
      String(currentMetadata.photoSha256 ?? "").toLowerCase() !== plan.sourceSha ||
      currentMetadata.photoStoragePath !== plan.sourcePath
    ) {
      throw new Error(`Photo modifiée pendant le backfill: ${plan.row.id}`);
    }
    const updated = await client
      .from("menu_dishes")
      .update({ metadata: { ...currentMetadata, photoDerivatives } })
      .eq("id", plan.row.id)
      .eq("restaurant_id", plan.restaurantId)
      .filter("metadata->>photoSha256", "ilike", plan.sourceSha)
      .filter("metadata->>photoStoragePath", "eq", plan.sourcePath)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) throw new Error(`Metadata impossible à mettre à jour: ${updated.error?.message ?? plan.row.id}`);
  } catch (error) {
    await rollbackUploadedDerivatives(bucket, client, plan, uploadedPaths);
    throw error;
  }
  checkpoint.completed = { ...(checkpoint.completed ?? {}), [key]: true };
  checkpoint.applied = (checkpoint.applied ?? 0) + 1;
  await saveCheckpoint(checkpoint);
  return { status: "applied", key };
}

async function mapLimited(items, workerCount, worker) {
  const results = [];
  let cursor = 0;
  async function workerLoop() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        const item = items[index];
        const lockKey = `${item.restaurantId}:${item.sourceSha}`;
        results[index] = await withSourceLock(lockKey, () => worker(item, index));
      } catch (error) {
        results[index] = { status: "error", error: error instanceof Error ? error.message : String(error) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, workerLoop));
  return results;
}

async function main() {
  if (apply && (measureOnly || verifyOnly)) {
    throw new Error("--apply ne peut pas être combiné avec --measure-only ou --verify-only.");
  }
  if (measureOnly && verifyOnly) {
    throw new Error("--measure-only et --verify-only sont exclusifs.");
  }
  const config = supabaseConfig();
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const checkpoint = await loadCheckpoint();
  const rows = await readRows(client);
  const plans = rows.map(planRow).filter(Boolean);
  const missingPlans = plans.filter((plan) => plan.status !== "complete");
  const sourceBytes = missingPlans.reduce((total, plan) => total + Number(plan.metadata.photoBytes ?? 0), 0);
  const derivativeByteTotals = plans.reduce((totals, plan) => {
    const derivatives = plan.metadata.photoDerivatives && typeof plan.metadata.photoDerivatives === "object"
      ? plan.metadata.photoDerivatives
      : {};
    for (const variant of VARIANTS) {
      const value = derivatives[variant.name];
      if (isCompleteDerivative(value, plan.restaurantId, plan.sourceSha, variant.name)) {
        totals.v2 += Number(value.bytes);
      } else {
        totals.v1 += legacyDerivativeByteSize(
          value,
          plan.restaurantId,
          plan.sourceSha,
          variant.name
        );
      }
    }
    return totals;
  }, { v1: 0, v2: 0 });
  const existingDerivativeBytes = derivativeByteTotals.v1 + derivativeByteTotals.v2;
  const report = {
    mode: apply ? "apply" : measureOnly ? "measure-only" : verifyOnly ? "verify-only" : "dry-run",
    rows: rows.length,
    objectsWithPhotos: plans.length,
    objectsMissingDerivatives: missingPlans.length,
    sourceBytes,
    existingDerivativeBytes,
    legacyDerivativeBytes: derivativeByteTotals.v1,
    v2DerivativeBytes: derivativeByteTotals.v2,
    derivativeBytes: null,
    expectedDerivativeBytesAfterRun: null,
    recipeId: RECIPE.id,
    variants: VARIANTS,
    checkpoint: checkpointPath,
    concurrency
  };
  console.log(JSON.stringify(report, null, 2));
  const workPlans = verifyOnly ? plans : missingPlans;
  const results = await mapLimited(workPlans, concurrency, (plan) => processPlan(client, plan, checkpoint));
  const errors = results.filter((result) => result?.status === "error");
  const measuredBytes = results.flatMap((result) => result?.measured ?? []).reduce((sum, item) => sum + item.bytes, 0);
  const measuredSourceBytes = results.reduce((sum, result) => sum + Number(result?.sourceBytes ?? 0), 0);
  console.log(JSON.stringify({
    ...report,
    derivativeBytes: measureOnly ? measuredBytes : null,
    measuredSourceBytes: measureOnly ? measuredSourceBytes : null,
    expectedDerivativeBytesAfterRun: measureOnly
      ? existingDerivativeBytes + measuredBytes
      : null,
    results: results.length,
    errors
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
