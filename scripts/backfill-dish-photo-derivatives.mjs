import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const VARIANTS = [
  { name: "thumbnail", width: 320, quality: 82 },
  { name: "display", width: 1440, quality: 86 }
];
const DEFAULT_CHECKPOINT = path.resolve(
  process.env.VISTAIRE_MEDIA_BACKFILL_CHECKPOINT ??
    ".cache/media-backfill/dish-photo-derivatives.json"
);
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const confirmProduction = args.has("--confirm-production");
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const concurrencyArg = process.argv.find((value) => value.startsWith("--concurrency="));
const checkpointArg = process.argv.find((value) => value.startsWith("--checkpoint="));
const rowLimit = Math.max(1, Math.min(Number(limitArg?.split("=")[1] ?? 1000), 10_000));
const concurrency = Math.max(1, Math.min(Number(concurrencyArg?.split("=")[1] ?? 2), 4));
const checkpointPath = path.resolve(checkpointArg?.split("=")[1] ?? DEFAULT_CHECKPOINT);
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

function derivativePath(restaurantId, sha256, variant) {
  return `restaurants/${restaurantId}/photos/derivatives/${sha256.toLowerCase()}/${variant}.webp`;
}

function isCompleteDerivative(value, restaurantId, sourceSha256, variant) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.storagePath === derivativePath(restaurantId, sourceSha256, variant) &&
      isSha(value.sha256) &&
      value.contentType === "image/webp" &&
      Number.isInteger(Number(value.bytes)) &&
      Number(value.bytes) > 0 &&
      String(value.sourceSha256 ?? "").toLowerCase() === sourceSha256
  );
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function makeDerivative(bytes, config) {
  return sharp(bytes, { failOn: "error" })
    .rotate()
    .resize({ width: config.width, height: config.width, fit: "inside", withoutEnlargement: true })
    .webp({ quality: config.quality, effort: 4 })
    .toBuffer();
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
  if (checkpoint.completed?.[key]) return { status: "checkpoint-skip", key };
  if (!apply) {
    checkpoint.planned = (checkpoint.planned ?? 0) + 1;
    return { status: "dry-run", key, missing: plan.missing.map((variant) => variant.name) };
  }

  const bucket = client.storage.from("vistaire-media");
  const downloaded = await bucket.download(plan.sourcePath);
  if (downloaded.error || !downloaded.data) throw new Error(`Original impossible à lire: ${downloaded.error?.message ?? plan.sourcePath}`);
  const sourceBytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (sha256(sourceBytes) !== plan.sourceSha) throw new Error(`SHA original différent: ${plan.sourcePath}`);

  const photoDerivatives = { ...(plan.metadata.photoDerivatives ?? {}) };
  const uploadedPaths = [];
  try {
    for (const variant of plan.missing) {
      const bytes = await makeDerivative(sourceBytes, variant);
      const outputPath = derivativePath(plan.restaurantId, plan.sourceSha, variant.name);
      const existing = await bucket.info(outputPath);
      if (existing.error && !isStorageNotFound(existing.error)) {
        throw new Error(`Vérification ${variant.name} impossible: ${existing.error.message ?? outputPath}`);
      }
      const uploaded = await bucket.upload(outputPath, bytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true
      });
      if (uploaded.error) throw new Error(`Upload ${variant.name} impossible: ${uploaded.error.message}`);
      if (!existing.data) uploadedPaths.push(outputPath);
      photoDerivatives[variant.name] = {
        storagePath: outputPath,
        sha256: sha256(bytes),
        contentType: "image/webp",
        bytes: bytes.byteLength,
        sourceSha256: plan.sourceSha
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
    if (uploadedPaths.length) await bucket.remove(uploadedPaths);
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
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { status: "error", error: error instanceof Error ? error.message : String(error) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, workerLoop));
  return results;
}

async function main() {
  const config = supabaseConfig();
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const checkpoint = await loadCheckpoint();
  const rows = await readRows(client);
  const plans = rows.map(planRow).filter(Boolean);
  const missingPlans = plans.filter((plan) => plan.status !== "complete");
  const sourceBytes = missingPlans.reduce((total, plan) => total + Number(plan.metadata.photoBytes ?? 0), 0);
  const report = {
    mode: apply ? "apply" : "dry-run",
    rows: rows.length,
    objectsWithPhotos: plans.length,
    objectsMissingDerivatives: missingPlans.length,
    sourceBytes,
    estimatedDerivativeBytes: Math.round(sourceBytes * 0.54),
    estimateModel: "planning estimate only: thumbnail 12% + display 42% of source bytes",
    checkpoint: checkpointPath,
    concurrency
  };
  console.log(JSON.stringify(report, null, 2));
  const results = await mapLimited(missingPlans, concurrency, (plan) => processPlan(client, plan, checkpoint));
  const errors = results.filter((result) => result?.status === "error");
  console.log(JSON.stringify({ ...report, results: results.length, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
