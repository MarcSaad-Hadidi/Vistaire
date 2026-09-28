import "server-only";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { isR2Bucket, r2StorageEnabled } from "./r2Config";

/**
 * Adaptateur de backend objet : expose une interface compatible avec le bucket
 * Supabase (`storage.from(bucket)`), adossée à Cloudflare R2 via l'API S3.
 *
 * Utilisation : remplacer `client.storage.from(bucket)` par
 * `storageBucket(client.storage, bucket)` sur les chemins migrés.
 * Les buckets non migrés (QA, sources, tout bucket hors vistaire-media/vistaire-3d)
 * retournent le bucket Supabase d'origine, sans changement de comportement.
 *
 * Si R2_STORAGE_ENABLED=true mais que les variables R2_S3_* sont absentes,
 * chaque opération échoue bruyamment (503) au lieu de basculer silencieusement
 * sur Supabase : on ne veut jamais écrire sur le mauvais backend.
 */

export type StorageErrorShape = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  statusCode?: number | string;
};

export type StorageResult<T> = {
  data: T | null;
  error: StorageErrorShape | null;
};

export type StorageUploadOptions = {
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
};

export type StorageListItem = {
  name: string;
  id: string | null;
  metadata: unknown;
};

export type StorageObjectInfo = {
  metadata: { size: number; mimetype: string };
  size: number;
  contentType: string;
};

export type StorageBucketHandle = {
  upload(
    path: string,
    body: Uint8Array | Blob,
    options?: StorageUploadOptions
  ): Promise<StorageResult<{ path: string }>>;
  download(path: string): Promise<StorageResult<Blob>>;
  remove(paths: string[]): Promise<StorageResult<Array<{ name: string }>>>;
  info(path: string): Promise<StorageResult<StorageObjectInfo>>;
  list(
    path: string,
    options?: { limit?: number; offset?: number; sortBy?: { column: string; order: string } }
  ): Promise<StorageResult<StorageListItem[]>>;
  createSignedUploadUrl(
    path: string
  ): Promise<StorageResult<{ signedUrl: string; token: string; path: string }>>;
};

type SupabaseStorageLike = {
  from(bucket: string): unknown;
};

class R2ConfigurationError extends Error {
  readonly statusCode = 503;

  constructor() {
    super(
      "R2 storage is not configured (R2_S3_ENDPOINT / R2_S3_ACCESS_KEY_ID / R2_S3_SECRET_ACCESS_KEY)."
    );
    this.name = "R2ConfigurationError";
  }
}

function s3StatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  const metadata =
    record.$metadata && typeof record.$metadata === "object"
      ? (record.$metadata as Record<string, unknown>)
      : null;
  const raw = metadata?.httpStatusCode ?? record.statusCode ?? record.status;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function isS3NotFound(error: unknown): boolean {
  if (s3StatusCode(error) === 404) return true;
  if (error && typeof error === "object") {
    const name = String((error as Record<string, unknown>).name ?? "");
    return name === "NotFound" || name === "NoSuchKey";
  }
  return false;
}

function toStorageError(error: unknown): StorageErrorShape {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown storage error");
  const statusCode =
    s3StatusCode(error) ??
    (error instanceof R2ConfigurationError ? error.statusCode : undefined);
  return statusCode ? { message, statusCode } : { message };
}

function readR2S3Config(
  env: NodeJS.ProcessEnv
): { endpoint: string; accessKeyId: string; secretAccessKey: string } | null {
  const endpoint = env.R2_S3_ENDPOINT?.trim();
  const accessKeyId = env.R2_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, accessKeyId, secretAccessKey };
}

let cachedClient: S3Client | null = null;
let cachedConfigKey = "";

function getS3Client(env: NodeJS.ProcessEnv = process.env): S3Client {
  const config = readR2S3Config(env);
  if (!config) throw new R2ConfigurationError();
  const key = `${config.endpoint}|${config.accessKeyId}`;
  if (!cachedClient || cachedConfigKey !== key) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
    cachedConfigKey = key;
  }
  return cachedClient;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) throw new Error("Storage download returned an empty body.");
  if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());
  if (typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Storage download returned an unreadable body.");
}

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

const NOT_FOUND_ERROR: StorageErrorShape = {
  message: "Object not found",
  statusCode: 404
};

class R2BucketHandle implements StorageBucketHandle {
  constructor(private readonly bucket: string) {}

  async upload(
    path: string,
    body: Uint8Array | Blob,
    options?: StorageUploadOptions
  ): Promise<StorageResult<{ path: string }>> {
    try {
      const client = getS3Client();
      const input: PutObjectCommandInput = {
        Bucket: this.bucket,
        Key: path,
        Body: body,
        ...(options?.contentType ? { ContentType: options.contentType } : {}),
        ...(options?.cacheControl ? { CacheControl: options.cacheControl } : {}),
        // upsert: false -> échoue si l'objet existe déjà (équivalent Supabase).
        ...(options?.upsert === false ? { IfNoneMatch: "*" } : {})
      };
      await client.send(new PutObjectCommand(input));
      return { data: { path }, error: null };
    } catch (error) {
      return { data: null, error: toStorageError(error) };
    }
  }

  async download(path: string): Promise<StorageResult<Blob>> {
    try {
      const client = getS3Client();
      const response = await client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: path })
      );
      const bytes = await streamToBuffer(response.Body);
      // Copie sur un ArrayBuffer dédié : les Buffers Node utilisent un pool
      // partagé, incompatible avec le type BlobPart des définitions récentes.
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return {
        data: new Blob([copy], { type: response.ContentType ?? "" }),
        error: null
      };
    } catch (error) {
      return {
        data: null,
        error: isS3NotFound(error) ? NOT_FOUND_ERROR : toStorageError(error)
      };
    }
  }

  async remove(paths: string[]): Promise<StorageResult<Array<{ name: string }>>> {
    try {
      const client = getS3Client();
      const cleanPaths = paths.map((p) => p.trim()).filter(Boolean);
      // DeleteObjects accepte 1000 clés max par appel ; l'opération est
      // idempotente (les clés absentes sont un succès, comme côté Supabase).
      for (const group of chunk(cleanPaths, 1000)) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: group.map((Key) => ({ Key })) }
          })
        );
      }
      return { data: cleanPaths.map((name) => ({ name })), error: null };
    } catch (error) {
      return { data: null, error: toStorageError(error) };
    }
  }

  async info(path: string): Promise<StorageResult<StorageObjectInfo>> {
    try {
      const client = getS3Client();
      const head = await client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: path })
      );
      const size = head.ContentLength ?? 0;
      const contentType = (head.ContentType ?? "").split(";")[0].trim().toLowerCase();
      return {
        data: {
          metadata: { size, mimetype: contentType },
          size,
          contentType
        },
        error: null
      };
    } catch (error) {
      return {
        data: null,
        error: isS3NotFound(error) ? NOT_FOUND_ERROR : toStorageError(error)
      };
    }
  }

  async list(
    path: string,
    _options?: { limit?: number; offset?: number; sortBy?: { column: string; order: string } }
  ): Promise<StorageResult<StorageListItem[]>> {
    try {
      const client = getS3Client();
      const prefix = path ? (path.endsWith("/") ? path : `${path}/`) : "";
      const items: StorageListItem[] = [];
      let continuationToken: string | undefined;
      do {
        const out = await client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            Delimiter: "/",
            ContinuationToken: continuationToken,
            MaxKeys: 1000
          })
        );
        for (const commonPrefix of out.CommonPrefixes ?? []) {
          const full = commonPrefix.Prefix ?? "";
          if (!full || full === prefix) continue;
          const name = full.slice(prefix.length).replace(/\/+$/, "");
          if (!name) continue;
          items.push({ name, id: null, metadata: null });
        }
        for (const object of out.Contents ?? []) {
          const key = object.Key ?? "";
          if (!key || key === prefix || !key.startsWith(prefix)) continue;
          const name = key.slice(prefix.length);
          if (!name || name.includes("/")) continue;
          items.push({
            name,
            id: key,
            metadata: { size: object.Size ?? 0 }
          });
        }
        continuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
      } while (continuationToken);
      return { data: items, error: null };
    } catch (error) {
      return { data: null, error: toStorageError(error) };
    }
  }

  async createSignedUploadUrl(
    path: string
  ): Promise<StorageResult<{ signedUrl: string; token: string; path: string }>> {
    try {
      const client = getS3Client();
      // L'URL pré-signée S3 est auto-suffisante : un simple PUT du fichier
      // suffit, aucun token séparé n'est nécessaire (token: "").
      const signedUrl = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: this.bucket, Key: path }),
        { expiresIn: 3600 }
      );
      return { data: { signedUrl, token: "", path }, error: null };
    } catch (error) {
      return { data: null, error: toStorageError(error) };
    }
  }
}

export function storageBucket(
  storage: SupabaseStorageLike,
  bucket: string
): StorageBucketHandle {
  if (isR2Bucket(bucket) && r2StorageEnabled()) {
    return new R2BucketHandle(bucket);
  }
  return storage.from(bucket) as StorageBucketHandle;
}
