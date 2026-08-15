import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import {
  buildCheckpointEnvelope,
  buildMeasureReport,
  checkpointEntryMatches,
  deduplicateMediaObjectBytes,
  deterministicSourceSetDigest,
  validateApplyMeasureReport,
  verifyDerivativeObject
} from "../lib/owner/mediaBackfill.ts";
import {
  MediaCapacityWorkError,
  mediaWritesEnabled,
  withMediaCapacityReservation
} from "../lib/owner/mediaCapacity.ts";
import { inspectImmutableStorageObject } from "../lib/owner/mediaObjectIntegrity.ts";
import { rollbackCreatedMediaObjects } from "../lib/owner/mediaRollback.ts";
import { parseBackfillNumericOptions } from "../lib/owner/mediaCli.ts";

const require = createRequire(import.meta.url);
const RECIPE = require("../lib/owner/dishPhotoRecipe.json");
const VARIANTS = Object.entries(RECIPE.variants).map(([name, config]) => ({ name, ...config }));
const DEFAULT_CHECKPOINT = path.resolve(
  process.env.VISTAIRE_MEDIA_BACKFILL_CHECKPOINT ??
    ".cache/media-backfill/dish-photo-derivatives.json"
);
const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const apply = args.has("--apply");
const measureOnly = args.has("--measure-only");
const verifyOnly = args.has("--verify-only");
const verifySource = args.has("--verify-source");
const verifyHash = args.has("--verify-hash");
const confirmProduction = args.has("--confirm-production");
const checkpointArg = process.argv.find((value) => value.startsWith("--checkpoint="));
const measureReportArg = process.argv.find((value) => value.startsWith("--measure-report="));
let cliParseError = null;
let numericOptions;
try {
  numericOptions = parseBackfillNumericOptions(rawArgs);
} catch (error) {
  cliParseError = error;
  numericOptions = parseBackfillNumericOptions([]);
}
const { rowLimit, concurrency, verifyMaxObjects, verifyMaxBytes, verifyTimeoutMs } = numericOptions;
const checkpointPath = path.resolve(checkpointArg?.split("=")[1] ?? DEFAULT_CHECKPOINT);
const measureReportPath = measureReportArg
  ? path.resolve(measureReportArg.split("=")[1])
  : null;
const restaurantFilter = process.argv.find((value) => value.startsWith("--restaurant-id="))?.split("=")[1]?.trim();
const dishFilter = process.argv.find((value) => value.startsWith("--dish-id="))?.split("=")[1]?.trim();
let checkpointWriteQueue = Promise.resolve();

function fail(message) {
  if (measureOnly) {
    console.log(JSON.stringify({
      reportVersion: 1,
      status: "fail",
      pass: false,
      generatedAt: new Date().toISOString(),
      reasons: ["execution-error"],
      errors: [message]
    }, null, 2));
  } else {
    console.error(`[media:backfill] ${message}`);
  }
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

function legacyDerivativeObject(value, restaurantId, sourceSha256, variant) {
  if (!value || typeof value !== "object") return null;
  const bytes = Number(value.bytes);
  if (!Number.isInteger(bytes) || bytes <= 0) return null;
  const storagePath = typeof value.storagePath === "string" ? value.storagePath : "";
  const legacyPath = new RegExp(
    `^restaurants/${restaurantId}/photos/derivatives/${sourceSha256}/${variant}\\.webp$`,
    "i"
  );
  return legacyPath.test(storagePath)
    ? { bucket: "vistaire-media", path: storagePath, bytes }
    : null;
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

async function rollbackUploadedDerivatives(bucket, client, plan, created) {
  // A failed guarded update may race another dish with the same source SHA.
  // If references cannot be read, keep the objects as safe orphans.
  const references = await referencedDerivativePaths(client, plan);
  return rollbackCreatedMediaObjects({ bucket, created, referencedPaths: references });
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
  const projectRef = parsed.hostname.endsWith(".supabase.co")
    ? parsed.hostname.slice(0, -".supabase.co".length).toLowerCase()
    : parsed.hostname.toLowerCase();
  const expectedProjectRef = process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF?.trim().toLowerCase();
  if (!expectedProjectRef || expectedProjectRef !== projectRef) {
    throw new Error("Projet Supabase attendu absent ou différent de la cible.");
  }
  if (apply && (
    !confirmProduction ||
    process.env.VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY !== "1" ||
    !mediaWritesEnabled()
  )) {
    throw new Error("Apply bloque: opt-in production et kill switch média explicites requis.");
  }
  return { url: parsed.origin, key, projectRef, local };
}

function storageInfoContentType(info) {
  const value = info?.metadata?.mimetype ?? info?.metadata?.contentType ?? info?.contentType;
  return typeof value === "string" ? value.split(";")[0].trim().toLowerCase() : null;
}

async function downloadWithTimeout(bucket, storagePath) {
  let timer;
  try {
    return await Promise.race([
      bucket.download(storagePath),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout Storage: ${storagePath}`)), verifyTimeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readRows(client) {
  const rows = [];
  for (let offset = 0; offset < rowLimit; offset += 1000) {
    const end = Number.isFinite(rowLimit)
      ? Math.min(offset + 999, rowLimit - 1)
      : offset + 999;
    const { data, error } = await client
      .from("menu_dishes")
      .select("id,restaurant_id,slug,name,metadata")
      .not("metadata", "is", null)
      .order("id", { ascending: true })
      .range(offset, end);
    if (error) throw new Error(`Lecture menu_dishes impossible: ${error.message}`);
    if (!Array.isArray(data)) throw new Error("Lecture menu_dishes partielle ou indisponible.");
    const page = data;
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

async function verifyPlanObjects(bucket, plan, budget, requireHash) {
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
    let contentType = null;
    let body;
    if (complete) {
      const object = await bucket.info(metadata.storagePath);
      if (object.error) {
        if (!isStorageNotFound(object.error)) {
          throw new Error(`Vérification Storage indisponible: ${object.error.message ?? metadata.storagePath}`);
        }
      } else if (!object.data) {
        throw new Error(`Réponse Storage partielle: ${metadata.storagePath}`);
      } else {
        objectBytes = storageInfoBytes(object.data);
        contentType = storageInfoContentType(object.data);
        objectPresent = objectBytes !== null;
        if (requireHash && objectPresent) {
          if (budget.objects + 1 > verifyMaxObjects) throw new Error("Limite d'objets verify-hash dépassée.");
          if (budget.bytes + objectBytes > verifyMaxBytes) throw new Error("Limite mémoire/bytes verify-hash dépassée.");
          budget.objects += 1;
          budget.bytes += objectBytes;
          const downloaded = await downloadWithTimeout(bucket, metadata.storagePath);
          if (downloaded.error || !downloaded.data) {
            throw new Error(`Download verify-hash impossible: ${downloaded.error?.message ?? metadata.storagePath}`);
          }
          body = Buffer.from(await downloaded.data.arrayBuffer());
        }
      }
    }
    const verified = await verifyDerivativeObject({
      restaurantId: plan.restaurantId,
      sourceSha256: plan.sourceSha,
      variant: variant.name,
      metadata,
      object: objectPresent ? { bytes: objectBytes, contentType: contentType ?? "", body } : null,
      verifyHash: requireHash
    });
    checks.push({
      variant: variant.name,
      complete,
      objectPresent,
      objectBytes,
      contentType,
      reasons: verified.reasons
    });
  }
  return checks;
}

function checkpointInputForPlan(plan, validatedAt) {
  const outputs = {};
  for (const variant of VARIANTS) {
    const metadata = plan.metadata.photoDerivatives?.[variant.name];
    outputs[variant.name] = String(metadata?.outputSha256 ?? metadata?.sha256 ?? "").toLowerCase();
  }
  return {
    dishId: String(plan.row.id),
    restaurantId: plan.restaurantId,
    sourcePath: plan.sourcePath,
    sourceSha256: plan.sourceSha,
    recipeId: RECIPE.id,
    schemaVersion: RECIPE.schemaVersion,
    expectedVariants: VARIANTS.map((variant) => variant.name),
    outputs,
    validatedAt
  };
}

async function processPlan(client, plan, checkpoint, runtime) {
  const key = `${plan.row.id}:${plan.sourceSha}`;
  if (!apply && !measureOnly && !verifyOnly) {
    checkpoint.planned = (checkpoint.planned ?? 0) + 1;
    return { status: "dry-run", key, missing: plan.missing.map((variant) => variant.name) };
  }

  const bucket = client.storage.from("vistaire-media");
  if (verifyOnly) {
    const checks = await verifyPlanObjects(bucket, plan, runtime.verifyBudget, verifyHash);
    if (checks.some((check) => check.reasons.length)) {
      return { status: "error", key, error: "Derivative metadata/object verification failed.", checks };
    }
    if (verifySource) {
      const downloaded = await downloadWithTimeout(bucket, plan.sourcePath);
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
    return {
      status: "verified",
      key,
      checks,
      sourceChecked: verifySource,
      hashChecked: verifyHash,
      verifiedObjects: verifyHash ? checks.length : 0,
      verifiedBytes: verifyHash
        ? checks.reduce((total, check) => total + Number(check.objectBytes ?? 0), 0)
        : 0
    };
  }

  if (apply && plan.status === "complete") {
    const current = await client
      .from("menu_dishes")
      .select("id,restaurant_id,metadata")
      .eq("id", plan.row.id)
      .eq("restaurant_id", plan.restaurantId)
      .maybeSingle();
    if (current.error || !current.data) throw new Error(`Plat actif impossible à vérifier: ${plan.row.id}`);
    const activePlan = planRow(current.data);
    if (!activePlan || activePlan.status !== "complete") throw new Error(`Checkpoint devenu obsolète: ${plan.row.id}`);
    const checks = await verifyPlanObjects(bucket, activePlan, runtime.verifyBudget, verifyHash);
    if (checks.some((check) => check.reasons.length)) throw new Error(`Checkpoint Storage invalide: ${plan.row.id}`);
    const entry = checkpoint.completed?.[key];
    const validatedAt = typeof entry?.validatedAt === "string" ? entry.validatedAt : "";
    if (validatedAt && checkpointEntryMatches(entry, checkpointInputForPlan(activePlan, validatedAt))) {
      return { status: "checkpoint-skip", key, checks };
    }
    return { status: "already-complete", key, checks };
  }

  const downloaded = await downloadWithTimeout(bucket, plan.sourcePath);
  if (downloaded.error || !downloaded.data) throw new Error(`Original impossible à lire: ${downloaded.error?.message ?? plan.sourcePath}`);
  const sourceBytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (sourceBytes.byteLength > verifyMaxBytes) throw new Error(`Original dépasse la limite mémoire: ${plan.sourcePath}`);
  if (Number(plan.metadata.photoBytes) !== sourceBytes.byteLength) throw new Error(`Taille originale différente: ${plan.sourcePath}`);
  const sourceContentType = typeof downloaded.data.type === "string"
    ? downloaded.data.type.split(";")[0].toLowerCase()
    : "";
  if (sourceContentType && sourceContentType !== String(plan.metadata.photoContentType ?? "").split(";")[0].toLowerCase()) {
    throw new Error(`Content-Type original différent: ${plan.sourcePath}`);
  }
  if (sha256(sourceBytes) !== plan.sourceSha) throw new Error(`SHA original différent: ${plan.sourcePath}`);

  const verifiedExisting = [];
  for (const variant of VARIANTS) {
    const metadata = plan.metadata.photoDerivatives?.[variant.name];
    if (!isCompleteDerivative(metadata, plan.restaurantId, plan.sourceSha, variant.name)) continue;
    const integrity = await inspectImmutableStorageObject({
      bucket,
      path: metadata.storagePath,
      expectedBytes: Number(metadata.bytes),
      expectedSha256: String(metadata.outputSha256 ?? metadata.sha256).toLowerCase(),
      expectedContentType: "image/webp",
      maxBytes: verifyMaxBytes,
      timeoutMs: verifyTimeoutMs
    });
    if (integrity.state !== "reusable") throw new Error(`Dérivé existant absent: ${metadata.storagePath}`);
    verifiedExisting.push({ storagePath: metadata.storagePath, bytes: integrity.bytes });
  }

  const generatedPlans = [];
  for (const variant of plan.missing) {
    const generated = await makeDerivative(sourceBytes, variant);
    const bytes = generated.data;
    const outputSha256 = sha256(bytes);
    const outputPath = `restaurants/${plan.restaurantId}/photos/derivatives/${plan.sourceSha}/${RECIPE.id}/${variant.name}-${outputSha256}.webp`;
    const integrity = await inspectImmutableStorageObject({
      bucket,
      path: outputPath,
      expectedBytes: bytes.byteLength,
      expectedSha256: outputSha256,
      expectedContentType: "image/webp",
      maxBytes: verifyMaxBytes,
      timeoutMs: verifyTimeoutMs
    });
    generatedPlans.push({ variant, generated, bytes, outputSha256, outputPath, integrity });
  }

  if (measureOnly) {
    const measured = generatedPlans.map((item) => ({
      variant: item.variant.name,
      storagePath: item.outputPath,
      bytes: item.bytes.byteLength,
      additionalBytes: item.integrity.state === "missing" ? item.bytes.byteLength : 0,
      width: Number(item.generated.info?.width ?? 0),
      height: Number(item.generated.info?.height ?? 0),
      outputSha256: item.outputSha256
    }));
    return {
      status: "measure-only",
      key,
      source: { storagePath: plan.sourcePath, bytes: sourceBytes.byteLength },
      existing: verifiedExisting,
      measured
    };
  }

  const toUpload = generatedPlans.filter((item) => item.integrity.state === "missing");
  const requestedBytes = toUpload.reduce((total, item) => total + item.bytes.byteLength, 0);
  const result = await withMediaCapacityReservation({
    client,
    projectRef: runtime.projectRef,
    reservationKey: `backfill:${plan.restaurantId}:${plan.row.id}:${plan.sourceSha}:${RECIPE.id}`,
    requestedBytes,
    work: async () => {
      const photoDerivatives = { ...(plan.metadata.photoDerivatives ?? {}) };
      const uploadedObjects = [];
      let newlyCreatedBytes = 0;
      try {
        for (const item of generatedPlans) {
          if (item.integrity.state === "missing") {
            const uploaded = await bucket.upload(item.outputPath, item.bytes, {
              contentType: "image/webp",
              cacheControl: "31536000",
              upsert: false
            });
            if (uploaded.error) {
              const conflict = await inspectImmutableStorageObject({
                bucket,
                path: item.outputPath,
                expectedBytes: item.bytes.byteLength,
                expectedSha256: item.outputSha256,
                expectedContentType: "image/webp",
                maxBytes: verifyMaxBytes,
                timeoutMs: verifyTimeoutMs
              });
              if (conflict.state !== "reusable") throw new Error(`Upload ${item.variant.name} impossible: ${uploaded.error.message}`);
            } else {
              uploadedObjects.push({ path: item.outputPath, bytes: item.bytes.byteLength });
              newlyCreatedBytes += item.bytes.byteLength;
            }
          }
          photoDerivatives[item.variant.name] = {
            storagePath: item.outputPath,
            schemaVersion: RECIPE.schemaVersion,
            recipeId: RECIPE.id,
            variant: item.variant.name,
            sha256: item.outputSha256,
            outputSha256: item.outputSha256,
            contentType: "image/webp",
            format: "webp",
            width: Number(item.generated.info?.width ?? 0),
            height: Number(item.generated.info?.height ?? 0),
            bytes: item.bytes.byteLength,
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
        ) throw new Error(`Photo modifiée pendant le backfill: ${plan.row.id}`);
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
        const rollback = await rollbackUploadedDerivatives(
          bucket,
          client,
          plan,
          uploadedObjects
        );
        throw new MediaCapacityWorkError(
          error instanceof Error ? error.message : String(error),
          rollback.retainedBytes
        );
      }
      return { value: { photoDerivatives }, newlyCreatedBytes };
    }
  });
  const completedPlan = { ...plan, metadata: { ...plan.metadata, photoDerivatives: result.photoDerivatives } };
  const validatedAt = new Date().toISOString();
  checkpoint.completed = {
    ...(checkpoint.completed ?? {}),
    [key]: buildCheckpointEnvelope(checkpointInputForPlan(completedPlan, validatedAt))
  };
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

function codeVersion() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    encoding: "utf8",
    windowsHide: true
  }).trim();
}

async function capacityState(client, projectRef) {
  const { data, error } = await client.rpc("get_media_capacity_state", {
    p_project_ref: projectRef
  });
  const value = Array.isArray(data) ? data[0] : data;
  if (error || !value || typeof value !== "object" || value.status !== "available") {
    throw new Error(`État de capacité indisponible: ${error?.message ?? value?.reason ?? "réponse absente"}`);
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
    !Number.isFinite(Date.parse(String(value.usageMeasuredAt ?? "")))
  ) throw new Error("État de capacité incomplet; quota/usage autoritatif requis.");
  return { quotaBytes, usedBytes, activeReservedBytes, quotaSource: value.quotaSource, usageMeasuredAt: value.usageMeasuredAt };
}

async function readMeasureReport() {
  if (!measureReportPath) throw new Error("--measure-report=<json> est requis pour apply.");
  let parsed;
  try {
    parsed = JSON.parse(await readFile(measureReportPath, "utf8"));
  } catch (error) {
    throw new Error(`Rapport de mesure illisible: ${error instanceof Error ? error.message : error}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Rapport de mesure invalide.");
  }
  return parsed;
}

function uniqueBytes(entries, pathKey, bytesKey) {
  const byPath = new Map();
  for (const entry of entries) {
    const storagePath = entry?.[pathKey];
    const bytes = Number(entry?.[bytesKey]);
    if (typeof storagePath !== "string" || !storagePath) continue;
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new Error(`Taille autoritative absente pour ${storagePath}`);
    }
    const existing = byPath.get(storagePath);
    if (existing !== undefined && existing !== bytes) throw new Error(`Taille contradictoire pour ${storagePath}`);
    byPath.set(storagePath, bytes);
  }
  return [...byPath.values()].reduce((total, bytes) => total + bytes, 0);
}

async function main() {
  if (cliParseError) throw cliParseError;
  if (apply && (measureOnly || verifyOnly)) {
    throw new Error("--apply ne peut pas être combiné avec --measure-only ou --verify-only.");
  }
  if (measureOnly && verifyOnly) {
    throw new Error("--measure-only et --verify-only sont exclusifs.");
  }
  if (verifyHash && !verifyOnly) {
    throw new Error("--verify-hash requiert --verify-only.");
  }
  const config = supabaseConfig();
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const checkpoint = await loadCheckpoint();
  const rows = await readRows(client);
  const plans = rows.map(planRow).filter(Boolean);
  const missingPlans = plans.filter((plan) => plan.status !== "complete");
  const sourceBytes = uniqueBytes(
    plans.map((plan) => ({ storagePath: plan.sourcePath, bytes: plan.metadata.photoBytes })),
    "storagePath",
    "bytes"
  );
  const derivativeObjects = plans.reduce((objects, plan) => {
    const derivatives = plan.metadata.photoDerivatives && typeof plan.metadata.photoDerivatives === "object"
      ? plan.metadata.photoDerivatives
      : {};
    for (const variant of VARIANTS) {
      const value = derivatives[variant.name];
      if (isCompleteDerivative(value, plan.restaurantId, plan.sourceSha, variant.name)) {
        objects.v2.push({ bucket: "vistaire-media", path: value.storagePath, bytes: Number(value.bytes) });
      } else {
        const legacy = legacyDerivativeObject(
          value,
          plan.restaurantId,
          plan.sourceSha,
          variant.name
        );
        if (legacy) objects.v1.push(legacy);
      }
    }
    return objects;
  }, { v1: [], v2: [] });
  const derivativeByteTotals = {
    v1: deduplicateMediaObjectBytes(derivativeObjects.v1),
    v2: deduplicateMediaObjectBytes(derivativeObjects.v2)
  };
  const existingDerivativeBytes = derivativeByteTotals.v1 + derivativeByteTotals.v2;
  const currentCodeVersion = codeVersion();
  const sourceSetDigest = deterministicSourceSetDigest(plans.map((plan) => ({
    dishId: String(plan.row.id),
    restaurantId: plan.restaurantId,
    sourcePath: plan.sourcePath,
    sourceSha256: plan.sourceSha
  })));
  const target = config.local ? "non-production" : "production";
  if (apply) {
    const measureReport = await readMeasureReport();
    const gate = validateApplyMeasureReport(measureReport, {
      now: new Date(),
      projectRef: config.projectRef,
      codeVersion: currentCodeVersion,
      recipeId: RECIPE.id,
      schemaVersion: RECIPE.schemaVersion,
      sourceSetDigest,
      productionOptIn: confirmProduction && process.env.VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY === "1",
      mediaWritesEnabled: mediaWritesEnabled()
    });
    if (!gate.ok || measureReport.target !== target) {
      const reasons = gate.ok ? ["target-mismatch"] : gate.reasons;
      throw new Error(`Apply bloqué par le rapport de mesure: ${reasons.join(", ")}`);
    }
  }
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
    concurrency,
    verifyHash,
    verifyMaxObjects,
    verifyMaxBytes,
    verifyTimeoutMs
  };
  if (!measureOnly) console.log(JSON.stringify(report, null, 2));
  const workPlans = verifyOnly || apply || measureOnly ? plans : missingPlans;
  const runtime = {
    projectRef: config.projectRef,
    verifyBudget: { objects: 0, bytes: 0 }
  };
  const results = await mapLimited(
    workPlans,
    concurrency,
    (plan) => processPlan(client, plan, checkpoint, runtime)
  );
  const errors = results.filter((result) => result?.status === "error");
  const measuredEntries = results.flatMap((result) => result?.measured ?? []);
  const measuredBytes = uniqueBytes(measuredEntries, "storagePath", "bytes");
  const uniqueAdditionalBytes = uniqueBytes(measuredEntries, "storagePath", "additionalBytes");
  const measuredSourceBytes = uniqueBytes(
    results.map((result) => result?.source).filter(Boolean),
    "storagePath",
    "bytes"
  );
  const verifiedExistingDerivativeBytes = uniqueBytes(
    results.flatMap((result) => result?.existing ?? []),
    "storagePath",
    "bytes"
  );
  if (measureOnly) {
    const state = await capacityState(client, config.projectRef);
    const measureReport = buildMeasureReport({
      projectRef: config.projectRef,
      target,
      generatedAt: new Date().toISOString(),
      codeVersion: currentCodeVersion,
      recipeId: RECIPE.id,
      schemaVersion: RECIPE.schemaVersion,
      sourceSetDigest,
      rowCount: plans.length,
      sourceCount: new Set(plans.map((plan) => plan.sourcePath)).size,
      currentGlobalBytes: state.usedBytes + state.activeReservedBytes,
      existingSourceBytes: measuredSourceBytes,
      existingDerivativeBytes: verifiedExistingDerivativeBytes + derivativeByteTotals.v1,
      measuredDerivativeBytes: measuredBytes,
      uniqueAdditionalBytes,
      authoritativeQuotaBytes: state.quotaBytes,
      errors: errors.map((entry) => entry.error)
    });
    console.log(JSON.stringify({
      ...measureReport,
      globalUsedBytes: state.usedBytes,
      activeReservedBytes: state.activeReservedBytes,
      quotaSource: state.quotaSource,
      usageMeasuredAt: state.usageMeasuredAt
    }, null, 2));
    if (measureReport.status !== "pass") process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({
    ...report,
    derivativeBytes: measureOnly ? measuredBytes : null,
    measuredSourceBytes: measureOnly ? measuredSourceBytes : null,
    expectedDerivativeBytesAfterRun: measureOnly
      ? existingDerivativeBytes + measuredBytes
      : null,
    results: results.length,
    errors,
    verification: verifyOnly ? {
      mode: verifyHash ? "hash" : "existence-size",
      objects: runtime.verifyBudget.objects,
      bytes: runtime.verifyBudget.bytes,
      timeoutMs: verifyTimeoutMs,
      memoryLimitBytes: verifyMaxBytes
    } : null
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
