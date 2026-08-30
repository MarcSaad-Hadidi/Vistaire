import { createHash } from "node:crypto";

type StorageBucket = {
  info: (path: string) => Promise<{ data: unknown; error: unknown }>;
  download: (path: string) => Promise<{ data: unknown; error: unknown }>;
};

export class MediaObjectIntegrityError extends Error {
  readonly reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.name = "MediaObjectIntegrityError";
    this.reason = reason;
  }
}

function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const value = Number(record.statusCode ?? record.status);
  return Number.isInteger(value) ? value : null;
}

function isNotFound(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === 404) return true;
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return /not[ -]?found|does not exist/i.test(String(record.message ?? ""));
}

function infoRecord(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}

function storageInfo(data: unknown): { bytes: number; contentType: string } | null {
  const record = infoRecord(data);
  if (!record) return null;
  const metadata = infoRecord(record.metadata) ?? {};
  const bytes = Number(metadata.size ?? metadata.size_bytes ?? record.size);
  const contentType = String(
    metadata.mimetype ?? metadata.contentType ?? record.contentType ?? ""
  ).split(";")[0].trim().toLowerCase();
  if (!Number.isSafeInteger(bytes) || bytes < 0 || !contentType) return null;
  return { bytes, contentType };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new MediaObjectIntegrityError("timeout", "Storage integrity check timed out.")),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function bodyBuffer(value: unknown): Promise<Buffer> {
  if (value instanceof Blob) return Buffer.from(await value.arrayBuffer());
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new MediaObjectIntegrityError("provider-unavailable", "Storage download returned no bytes.");
}

export async function inspectImmutableStorageObject(args: {
  bucket: StorageBucket;
  path: string;
  expectedBytes: number;
  expectedSha256: string;
  expectedContentType: string;
  maxBytes: number;
  timeoutMs: number;
}): Promise<
  | { state: "missing" }
  | { state: "reusable"; bytes: number; sha256: string }
> {
  let infoResponse: Awaited<ReturnType<StorageBucket["info"]>>;
  try {
    infoResponse = await withTimeout(args.bucket.info(args.path), args.timeoutMs);
  } catch (error) {
    if (error instanceof MediaObjectIntegrityError) throw error;
    throw new MediaObjectIntegrityError("provider-unavailable", "Storage metadata is unavailable.");
  }
  if (infoResponse.error) {
    if (isNotFound(infoResponse.error)) return { state: "missing" };
    throw new MediaObjectIntegrityError("provider-unavailable", "Storage metadata is unavailable.");
  }
  const info = storageInfo(infoResponse.data);
  if (!info) {
    throw new MediaObjectIntegrityError("provider-unavailable", "Storage metadata response is incomplete.");
  }
  if (info.bytes !== args.expectedBytes) {
    throw new MediaObjectIntegrityError("size-mismatch", "Immutable object size mismatch.");
  }
  if (info.bytes > args.maxBytes) {
    throw new MediaObjectIntegrityError("memory-limit", "Immutable object exceeds verification memory limit.");
  }
  const expectedContentType = args.expectedContentType.split(";")[0].trim().toLowerCase();
  if (info.contentType !== expectedContentType) {
    throw new MediaObjectIntegrityError("content-type-mismatch", "Immutable object content type mismatch.");
  }

  let downloadResponse: Awaited<ReturnType<StorageBucket["download"]>>;
  try {
    downloadResponse = await withTimeout(args.bucket.download(args.path), args.timeoutMs);
  } catch (error) {
    if (error instanceof MediaObjectIntegrityError) throw error;
    throw new MediaObjectIntegrityError("provider-unavailable", "Storage download is unavailable.");
  }
  if (downloadResponse.error || !downloadResponse.data) {
    throw new MediaObjectIntegrityError("provider-unavailable", "Storage download is unavailable.");
  }
  const bytes = await bodyBuffer(downloadResponse.data);
  if (bytes.byteLength !== args.expectedBytes) {
    throw new MediaObjectIntegrityError("size-mismatch", "Downloaded immutable object size mismatch.");
  }
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== args.expectedSha256.toLowerCase()) {
    throw new MediaObjectIntegrityError("hash-mismatch", "Immutable object hash mismatch.");
  }
  return { state: "reusable", bytes: bytes.byteLength, sha256: actualSha256 };
}
