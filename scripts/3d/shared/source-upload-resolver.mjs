import { shouldUseR2ForBucket } from "../../../lib/storage/r2Config.ts";
import { storageBucket } from "../../../lib/storage/backend.ts";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, normalize, relative, resolve, sep } from "node:path";

const DEFAULT_SOURCE_UPLOADS_TABLE = "owner_3d_ar_source_uploads";
const SAFE_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9._-]{1,126}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RESOLVABLE_SOURCE_UPLOAD_STATUSES = new Set([
  "source_uploaded",
  "analyzing",
  "analysis_failed",
  "analysis_complete",
  "optimized",
  "needs_review",
  "ready_to_finalize",
  "ready_to_publish"
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isSafeSegment(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    value === value.toLowerCase() &&
    !value.includes("..") &&
    SAFE_SEGMENT_PATTERN.test(value)
  );
}

export function assertSourceUploadIdentity(identity) {
  for (const key of ["restaurantSlug", "menuSlug", "dishSlug", "version"]) {
    if (!isSafeSegment(identity?.[key])) throw new Error(`Invalid runner identity: ${key}`);
  }
}

function identityFromRow(row) {
  return {
    restaurantSlug: String(row.restaurant_slug ?? ""),
    menuSlug: String(row.menu_slug ?? ""),
    dishSlug: String(row.dish_slug ?? ""),
    version: String(row.version ?? "")
  };
}

function identitiesMatch(left, right) {
  return (
    left.restaurantSlug === right.restaurantSlug &&
    left.menuSlug === right.menuSlug &&
    left.dishSlug === right.dishSlug &&
    left.version === right.version
  );
}

function safeJoin(rootDir, ...segments) {
  const root = normalize(resolve(rootDir));
  const fullPath = normalize(resolve(rootDir, ...segments));
  if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) {
    throw new Error(`Refusing path outside ${root}`);
  }
  return fullPath;
}

export function toRunnerRelativePath(rootDir, filePath) {
  const relativePath = relative(rootDir, filePath).replaceAll("\\", "/");
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    relativePath.includes("../") ||
    relativePath.startsWith("/") ||
    /^[a-z]:/i.test(relativePath)
  ) {
    throw new Error(`Path is outside runner root: ${filePath}`);
  }
  return relativePath;
}

export function sourceUploadsTableName(env = process.env) {
  const raw = env.VISTAIRE_3D_SOURCE_UPLOADS_TABLE?.trim();
  return raw && /^[a-z][a-z0-9_]{0,62}$/.test(raw)
    ? raw
    : DEFAULT_SOURCE_UPLOADS_TABLE;
}

export function sourceBucketName(env = process.env) {
  const bucket = String(env.VISTAIRE_3D_SOURCE_BUCKET ?? "").trim();
  if (!BUCKET_PATTERN.test(bucket)) throw new Error("VISTAIRE_3D_SOURCE_BUCKET is required.");
  return bucket;
}

export function parseAllowedRestaurantSlugs(value) {
  if (Array.isArray(value)) {
    if (value.includes("*")) return null;
    const slugs = value.map((entry) => String(entry).trim()).filter(Boolean);
    for (const slug of slugs) {
      if (!isSafeSegment(slug)) throw new Error("Invalid runner restaurant access scope.");
    }
    return slugs.length ? slugs : null;
  }
  const raw = String(value ?? "").trim();
  if (!raw || raw === "*") return null;
  const slugs = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (slugs.includes("*")) return null;
  for (const slug of slugs) {
    if (!isSafeSegment(slug)) throw new Error("Invalid runner restaurant access scope.");
  }
  return slugs.length ? slugs : null;
}

function assertRestaurantAllowed(identity, allowedRestaurantSlugs) {
  const allowed = parseAllowedRestaurantSlugs(allowedRestaurantSlugs);
  if (allowed && !allowed.includes(identity.restaurantSlug)) {
    throw new Error(`Runner is not allowed to process restaurant ${identity.restaurantSlug}.`);
  }
}

export function buildPrivateSourceStoragePath({ identity, sha256: sourceSha256 }) {
  assertSourceUploadIdentity(identity);
  if (!SHA256_PATTERN.test(String(sourceSha256))) throw new Error("Invalid source SHA-256");
  return [
    "sources",
    identity.restaurantSlug,
    identity.menuSlug,
    identity.dishSlug,
    identity.version,
    `${sourceSha256}.glb`
  ].join("/");
}

export function safeLocalSourcePath({ rootDir, identity, sha256: sourceSha256 = null }) {
  assertSourceUploadIdentity(identity);
  if (sourceSha256 !== null && !SHA256_PATTERN.test(String(sourceSha256))) {
    throw new Error("Invalid source SHA-256");
  }
  return safeJoin(
    rootDir,
    "assets",
    "3d",
    "source",
    identity.restaurantSlug,
    identity.menuSlug,
    identity.dishSlug,
    identity.version,
    "source.glb"
  );
}

function isGitLfsPointer(bytes) {
  return bytes
    .subarray(0, Math.min(bytes.length, 256))
    .toString("utf8")
    .startsWith("version https://git-lfs.github.com/spec/v1");
}

export function validateSourceGlbBytes(bytes) {
  if (isGitLfsPointer(bytes)) throw new Error("Source GLB is a Git LFS pointer, not a binary asset.");
  if (bytes.byteLength < 20 || bytes.subarray(0, 4).toString("ascii") !== "glTF") {
    throw new Error("Source file is not a valid GLB binary.");
  }
  if (bytes.readUInt32LE(4) !== 2) throw new Error("Only GLB version 2 sources are accepted.");
  if (bytes.readUInt32LE(8) !== bytes.byteLength) {
    throw new Error("GLB declared length does not match the downloaded bytes.");
  }
  let offset = 12;
  let hasJson = false;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new Error("GLB chunk header is truncated.");
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkLength <= 0 || chunkLength % 4 !== 0 || offset + chunkLength > bytes.byteLength) {
      throw new Error("GLB chunk layout is invalid.");
    }
    if (chunkType === 0x4e4f534a) {
      JSON.parse(bytes.subarray(offset, offset + chunkLength).toString("utf8").replace(/[\u0000\u0020]+$/g, ""));
      hasJson = true;
    }
    offset += chunkLength;
  }
  if (!hasJson || offset !== bytes.byteLength) throw new Error("GLB JSON chunk is missing.");
}

export function verifySourceUploadRecord(row, { identity, env = process.env, allowedRestaurantSlugs = null } = {}) {
  if (!row || typeof row !== "object") throw new Error("No private source upload is available.");
  assertSourceUploadIdentity(identity);
  assertRestaurantAllowed(identity, allowedRestaurantSlugs);
  const rowIdentity = identityFromRow(row);
  assertSourceUploadIdentity(rowIdentity);
  if (!identitiesMatch(rowIdentity, identity)) {
    throw new Error("Source upload identity does not match the runner job identity.");
  }
  if (row.storage_provider !== "supabase-storage") throw new Error("Source upload is not stored in Supabase Storage.");
  if (row.storage_bucket !== sourceBucketName(env)) throw new Error("Source upload bucket does not match runner configuration.");
  if (!SHA256_PATTERN.test(String(row.sha256))) throw new Error("Source metadata SHA-256 is invalid.");
  if (!Number.isFinite(Number(row.bytes)) || Number(row.bytes) <= 0) throw new Error("Source metadata byte length is invalid.");
  if (!RESOLVABLE_SOURCE_UPLOAD_STATUSES.has(String(row.status))) {
    throw new Error("Source upload status cannot be materialized by the runner.");
  }
  const expectedPath = buildPrivateSourceStoragePath({ identity, sha256: row.sha256 });
  if (row.storage_path !== expectedPath) throw new Error("Source storage path does not match identity metadata.");
  return row;
}

async function bytesFromStorageObject(data) {
  if (!data) throw new Error("Source download failed: storage returned no body.");
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (typeof data.arrayBuffer === "function") return Buffer.from(await data.arrayBuffer());
  throw new Error("Source download failed: unsupported storage response body.");
}

function assertNoSymlinkAncestors(rootDir, targetPath) {
  const root = normalize(resolve(rootDir));
  let current = dirname(targetPath);
  while (current !== root && current.startsWith(`${root}${sep}`)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error("Refusing to write source below a symlink.");
    }
    current = dirname(current);
  }
}

function assertWritableNonSymlinkTarget(rootDir, targetPath, label) {
  assertNoSymlinkAncestors(rootDir, targetPath);
  if (existsSync(targetPath) && lstatSync(targetPath).isSymbolicLink()) {
    throw new Error(`Refusing to write ${label} over a symlink.`);
  }
}

export async function resolveSourceUploadRecord(
  client,
  { identity, sourceUploadId = null, env = process.env, allowedRestaurantSlugs = null } = {}
) {
  assertSourceUploadIdentity(identity);
  assertRestaurantAllowed(identity, allowedRestaurantSlugs);
  if (sourceUploadId && !UUID_PATTERN.test(String(sourceUploadId))) {
    throw new Error("--source-upload-id is invalid.");
  }
  let query = client
    .from(sourceUploadsTableName(env))
    .select("*")
    .eq("restaurant_slug", identity.restaurantSlug)
    .eq("menu_slug", identity.menuSlug)
    .eq("dish_slug", identity.dishSlug)
    .eq("version", identity.version);
  query = sourceUploadId
    ? query.eq("id", sourceUploadId)
    : query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Source metadata lookup failed: ${error.message}`);
  if (!data) throw new Error("No private source upload is available for this job identity.");
  return verifySourceUploadRecord(data, { identity, env, allowedRestaurantSlugs });
}

export async function downloadAndMaterializeSourceUpload(
  client,
  { rootDir, identity, sourceUpload, env = process.env, allowedRestaurantSlugs = null } = {}
) {
  const row = verifySourceUploadRecord(sourceUpload, { identity, env, allowedRestaurantSlugs });
  const bucket = row.storage_bucket;
  if (!shouldUseR2ForBucket(bucket) && typeof client.storage?.getBucket === "function") {
    const bucketStatus = await client.storage.getBucket(bucket);
    if (bucketStatus.error) throw new Error(`Source bucket lookup failed: ${bucketStatus.error.message}`);
    if (bucketStatus.data?.public === true) throw new Error("Source upload bucket must be private.");
  }
  const download = await storageBucket(client.storage, bucket).download(row.storage_path);
  if (download.error) throw new Error(`Source download failed: ${download.error.message}`);
  const bytes = await bytesFromStorageObject(download.data);
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== row.sha256) throw new Error("Downloaded source SHA-256 does not match metadata.");
  if (Number(row.bytes) !== bytes.length) throw new Error("Downloaded source byte length does not match metadata.");
  validateSourceGlbBytes(bytes);
  const sourcePath = safeLocalSourcePath({ rootDir, identity, sha256: actualSha256 });
  const sourceShaPath = `${sourcePath}.sha256`;
  assertWritableNonSymlinkTarget(rootDir, sourcePath, "source");
  assertWritableNonSymlinkTarget(rootDir, sourceShaPath, "source SHA-256 sidecar");
  mkdirSync(dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, bytes);
  writeFileSync(sourceShaPath, `${actualSha256}\n`);
  return {
    sourceUpload: row,
    sourcePath,
    relativeSourcePath: toRunnerRelativePath(rootDir, sourcePath),
    sha256: actualSha256,
    bytes: bytes.length,
    artifact: {
      id: `source_${String(row.id ?? actualSha256.slice(0, 16)).replace(/[^a-zA-Z0-9._:-]/g, "_")}`,
      type: "source",
      label: "Private source GLB",
      path: toRunnerRelativePath(rootDir, sourcePath),
      sha256: actualSha256,
      bytes: bytes.length,
      sourceUploadId: row.id ?? null
    }
  };
}

export async function resolveSourceUploadToLocalSource(
  client,
  { rootDir, identity, sourceUploadId = null, env = process.env, allowedRestaurantSlugs = null } = {}
) {
  const sourceUpload = await resolveSourceUploadRecord(client, {
    identity,
    sourceUploadId,
    env,
    allowedRestaurantSlugs
  });
  return downloadAndMaterializeSourceUpload(client, {
    rootDir,
    identity,
    sourceUpload,
    env,
    allowedRestaurantSlugs
  });
}
