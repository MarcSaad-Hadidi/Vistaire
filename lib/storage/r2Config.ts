
/**
 * Configuration centralisée du backend R2 pour la migration Supabase Storage -> Cloudflare R2.
 *
 * Buckets migrés (miroirs à l'identique des buckets Supabase, mêmes noms, mêmes clés) :
 * - `vistaire-media` -> https://cdn.vistaire.ca
 * - `vistaire-3d`     -> https://3d.vistaire.ca
 *
 * Activation : R2_STORAGE_ENABLED=true (+ variables R2_S3_* pour les écritures via S3).
 * Les buckets non listés ici (ex: buckets QA/sources configurés par env) restent sur Supabase.
 */

export const R2_MEDIA_BUCKET = "vistaire-media";
export const R2_3D_BUCKET = "vistaire-3d";

const R2_BUCKETS = new Set<string>([R2_MEDIA_BUCKET, R2_3D_BUCKET]);

const DEFAULT_PUBLIC_BASE_URLS: Record<string, string> = {
  [R2_MEDIA_BUCKET]: "https://cdn.vistaire.ca",
  [R2_3D_BUCKET]: "https://3d.vistaire.ca"
};

export function r2StorageEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.R2_STORAGE_ENABLED === "true";
}

/** True si ce bucket fait partie des buckets migrés vers R2 (indépendamment du flag d'activation). */
export function isR2Bucket(bucket: string): boolean {
  return R2_BUCKETS.has(bucket);
}

/** True si les opérations sur ce bucket doivent passer par R2 (bucket migré ET migration activée). */
export function shouldUseR2ForBucket(
  bucket: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return r2StorageEnabled(env) && isR2Bucket(bucket);
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

export function r2PublicBaseUrl(
  bucket: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (!isR2Bucket(bucket)) return null;
  const raw =
    bucket === R2_MEDIA_BUCKET
      ? env.R2_PUBLIC_MEDIA_BASE_URL
      : env.R2_PUBLIC_3D_BASE_URL;
  const base = stripTrailingSlashes(
    (raw ?? "").trim() || DEFAULT_PUBLIC_BASE_URLS[bucket] || ""
  );
  return base ? base : null;
}

/**
 * Construit l'URL publique d'un objet R2. Chaque segment de clé est encodé
 * individuellement (les clés contiennent des espaces, accents et parenthèses).
 */
export function r2PublicAssetUrl(
  bucket: string,
  storagePath: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const base = r2PublicBaseUrl(bucket, env);
  if (!base) return null;
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/${encodedPath}`;
}

/**
 * Vérifie qu'une URL est exactement celle attendue pour (bucket, storagePath).
 * Protège les redirects publics contre toute URL forgée (même rôle que
 * isExpectedSignedStorageUrl pour les signed URLs Supabase).
 */
export function isExpectedR2PublicAssetUrl(args: {
  publicUrl: string;
  bucket: string;
  storagePath: string;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const expected = r2PublicAssetUrl(args.bucket, args.storagePath, args.env);
  return Boolean(expected) && args.publicUrl === expected;
}

/**
 * Encodage strict d'un segment de clé, identique à celui du SDK S3 pour les
 * URLs pré-signées : seuls A-Za-z0-9 - _ . ~ restent non encodés
 * (encodeURIComponent seul laisse passer ! ' ( ) *).
 */
function encodeR2KeySegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Vérification anti-forgery pour les URLs de lecture pré-signées R2.
 * Le SDK S3 signe en virtual-hosted style : l'hôte vaut
 * `<bucket>.<endpoint R2_S3_ENDPOINT>`, le chemin est la clé encodée,
 * et la query porte la signature SigV4 (vérifié avec
 * @aws-sdk/s3-request-presigner : GetObjectCommand + getSignedUrl).
 */
export function isExpectedR2PresignedAssetUrl(args: {
  presignedUrl: string;
  bucket: string;
  storagePath: string;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = args.env ?? process.env;
  const endpoint = env.R2_S3_ENDPOINT?.trim();
  if (!endpoint || !isR2Bucket(args.bucket)) return false;
  let url: URL;
  let endpointHost: string;
  try {
    url = new URL(args.presignedUrl);
    endpointHost = new URL(endpoint).host;
  } catch {
    return false;
  }
  if (
    url.protocol !== "https:" || url.username || url.password || url.hash ||
    url.host !== `${args.bucket}.${endpointHost}`
  ) return false;
  const encodedPath = args.storagePath
    .split("/")
    .map((segment) => encodeR2KeySegment(segment))
    .join("/");
  if (url.pathname !== `/${encodedPath}`) return false;
  return (
    url.searchParams.get("X-Amz-Algorithm") === "AWS4-HMAC-SHA256" &&
    Boolean(url.searchParams.get("X-Amz-Signature")) &&
    r2PresignedUrlExpiresAt(args.presignedUrl) !== null
  );
}

/**
 * Contrôle d'existence d'un objet public R2 (HEAD). Utilisé pour les assets
 * legacy non versionnés, en remplacement du storage.info() Supabase.
 */
export async function r2PublicObjectExists(
  bucket: string,
  storagePath: string,
  env: NodeJS.ProcessEnv = process.env,
  timeoutMs = 5000
): Promise<boolean> {
  const url = r2PublicAssetUrl(bucket, storagePath, env);
  if (!url) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal
    });
    return response.status === 200;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Read the actual SigV4 expiry rather than estimating when the SDK signed. */
export function r2PresignedUrlExpiresAt(value: string): number | null {
  try {
    const query = new URL(value).searchParams;
    const date = query.get("X-Amz-Date") ?? "";
    const ttl = query.get("X-Amz-Expires") ?? "";
    const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(date);
    if (!match || !/^\d+$/.test(ttl) || Number(ttl) < 1 || Number(ttl) > 604800) return null;
    const signedAt = Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`);
    if (!Number.isFinite(signedAt) || new Date(signedAt).toISOString().replace(/[-:]/g, "").replace(".000", "") !== date) return null;
    return signedAt + Number(ttl) * 1_000;
  } catch {
    return null;
  }
}
