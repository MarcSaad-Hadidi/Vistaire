export const PUBLIC_CACHE_SAFETY_MAX_DEPTH = 16;
export const PUBLIC_CACHE_SAFETY_DEFAULT_MAX_NODES = 10_000;
export const PUBLIC_CACHE_SAFETY_MAX_NODES = 200_000;

export type PublicCacheSafetyReason =
  | "credential-field"
  | "private-url"
  | "cycle"
  | "depth-limit"
  | "node-limit"
  | "non-serializable";

export class PublicCacheSafetyError extends Error {
  readonly path: string;
  readonly reason: PublicCacheSafetyReason;

  constructor(path: string, reason: PublicCacheSafetyReason) {
    super(`Public cache candidate rejected at ${path} (${reason}).`);
    this.name = "PublicCacheSafetyError";
    this.path = path;
    this.reason = reason;
  }
}

type PublicCacheSafetyOptions = {
  maxDepth?: number;
  maxNodes?: number;
};

const CREDENTIAL_FIELD_KEYS = new Set([
  "admin",
  "accesstoken",
  "apikey",
  "apisecret",
  "auth",
  "authorization",
  "awsaccesskeyid",
  "cookie",
  "clientsecret",
  "expires",
  "expiresat",
  "idtoken",
  "owner",
  "password",
  "privatekey",
  "refreshtoken",
  "secret",
  "servicekey",
  "servicerole",
  "servicerolekey",
  "session",
  "signature",
  "signedurl",
  "storagepath",
  "supabasekey",
  "supabaseservicerolekey",
  "token",
  "xamzalgorithm",
  "xamzcredential",
  "xamzdate",
  "xamzexpires",
  "xamzsecuritytoken",
  "xamzsignature",
  "xamzsignedheaders"
]);

const CREDENTIAL_QUERY_KEYS = new Set([
  "apikey",
  "accesstoken",
  "awsaccesskeyid",
  "authorization",
  "clientsecret",
  "expires",
  "signature",
  "refreshtoken",
  "servicekey",
  "servicerolekey",
  "token",
  "xamzalgorithm",
  "xamzcredential",
  "xamzdate",
  "xamzexpires",
  "xamzsecuritytoken",
  "xamzsignature",
  "xamzsignedheaders"
]);

const STRUCTURAL_KEY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$-]{0,39}$/;

function normalizedKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function structuralPath(parent: string, key: string): string {
  if (STRUCTURAL_KEY_PATTERN.test(key)) return `${parent}.${key}`;
  return `${parent}["<field>"]`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function looksLikeUrl(value: string): boolean {
  const browserNormalized = value.replace(/\\/g, "/");
  return (
    /^(?:https?:)?\/\//i.test(browserNormalized) ||
    /^(?:\/|\?|data:|blob:|file:|javascript:|vbscript:)/i.test(
      browserNormalized
    ) ||
    /^[^\s?#]+[/?#][^\s]*$/.test(browserNormalized)
  );
}

function queryHasCredential(parsed: URL): boolean {
  return [...parsed.searchParams.keys()].some((key) =>
    CREDENTIAL_QUERY_KEYS.has(normalizedKey(key))
  );
}

function nestedQueryHasPrivateCapability(parsed: URL, depth: number): boolean {
  for (const value of parsed.searchParams.values()) {
    const decoded = safeDecode(value.trim());
    if (decoded !== value || looksLikeUrl(decoded)) {
      if (depth >= 3) return true;
      if (privateUrlReason(decoded, depth + 1)) return true;
    }
  }
  return false;
}

function privateUrlReason(value: string, depth = 0): boolean {
  const trimmed = value.trim();
  if (!trimmed || !looksLikeUrl(trimmed)) return false;
  const browserNormalized = trimmed.replace(/\\/g, "/");

  let parsed: URL;
  try {
    parsed = new URL(browserNormalized, "https://public-cache.invalid");
  } catch {
    return true;
  }

  const decodedPath = safeDecode(parsed.pathname).toLowerCase();
  return Boolean(
    ["data:", "blob:", "file:", "javascript:", "vbscript:"].includes(
      parsed.protocol.toLowerCase()
    ) ||
      parsed.username ||
      parsed.password ||
      decodedPath.includes("/storage/v1/object/sign/") ||
      queryHasCredential(parsed) ||
      nestedQueryHasPrivateCapability(parsed, depth)
  );
}

export function isPrivateCapabilityUrl(value: unknown): boolean {
  return typeof value === "string" && privateUrlReason(value);
}

function boundedOption(
  value: number | undefined,
  fallback: number,
  maximum: number,
  field: string
): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new TypeError(`Invalid public cache safety ${field}.`);
  }
  return value;
}

export function assertPublicCacheSafe<T>(
  candidate: T,
  options: PublicCacheSafetyOptions = {}
): T {
  const maxDepth = boundedOption(
    options.maxDepth,
    PUBLIC_CACHE_SAFETY_MAX_DEPTH,
    PUBLIC_CACHE_SAFETY_MAX_DEPTH,
    "depth limit"
  );
  const maxNodes = boundedOption(
    options.maxNodes,
    PUBLIC_CACHE_SAFETY_DEFAULT_MAX_NODES,
    PUBLIC_CACHE_SAFETY_MAX_NODES,
    "node limit"
  );
  const ancestors = new WeakSet<object>();
  let visitedNodes = 0;

  function visit(value: unknown, path: string, depth: number): void {
    visitedNodes += 1;
    if (visitedNodes > maxNodes) {
      throw new PublicCacheSafetyError(path, "node-limit");
    }
    if (depth > maxDepth) {
      throw new PublicCacheSafetyError(path, "depth-limit");
    }

    if (typeof value === "string") {
      if (privateUrlReason(value)) {
        throw new PublicCacheSafetyError(path, "private-url");
      }
      return;
    }
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new PublicCacheSafetyError(path, "non-serializable");
      }
      return;
    }
    if (typeof value !== "object") {
      throw new PublicCacheSafetyError(path, "non-serializable");
    }

    if (ancestors.has(value)) {
      throw new PublicCacheSafetyError(path, "cycle");
    }
    const prototype = Object.getPrototypeOf(value);
    if (
      !Array.isArray(value) &&
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      throw new PublicCacheSafetyError(path, "non-serializable");
    }

    ancestors.add(value);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (Array.isArray(value)) {
        const indexDescriptors = new Map<number, PropertyDescriptor>();
        for (const key of Reflect.ownKeys(descriptors)) {
          if (key === "length") continue;
          if (typeof key !== "string") {
            throw new PublicCacheSafetyError(
              `${path}["<field>"]`,
              "non-serializable"
            );
          }
          const childPath = structuralPath(path, key);
          if (privateUrlReason(key)) {
            throw new PublicCacheSafetyError(childPath, "private-url");
          }
          if (CREDENTIAL_FIELD_KEYS.has(normalizedKey(key))) {
            throw new PublicCacheSafetyError(childPath, "credential-field");
          }
          if (!/^(?:0|[1-9][0-9]*)$/.test(key)) {
            throw new PublicCacheSafetyError(childPath, "non-serializable");
          }
          const index = Number(key);
          if (!Number.isSafeInteger(index) || index >= value.length) {
            throw new PublicCacheSafetyError(childPath, "non-serializable");
          }
          const descriptor = descriptors[key];
          if (!descriptor || !("value" in descriptor)) {
            throw new PublicCacheSafetyError(childPath, "non-serializable");
          }
          indexDescriptors.set(index, descriptor);
        }
        if (value.length > maxNodes - visitedNodes) {
          throw new PublicCacheSafetyError(path, "node-limit");
        }
        for (let index = 0; index < value.length; index += 1) {
          const descriptor = indexDescriptors.get(index);
          const childPath = `${path}[${index}]`;
          if (!descriptor) {
            throw new PublicCacheSafetyError(childPath, "non-serializable");
          }
          visit(descriptor.value, childPath, depth + 1);
        }
        return;
      }

      for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key !== "string") {
          throw new PublicCacheSafetyError(`${path}["<field>"]`, "non-serializable");
        }
        const childPath = structuralPath(path, key);
        if (privateUrlReason(key)) {
          throw new PublicCacheSafetyError(childPath, "private-url");
        }
        if (CREDENTIAL_FIELD_KEYS.has(normalizedKey(key))) {
          throw new PublicCacheSafetyError(childPath, "credential-field");
        }
        const descriptor = descriptors[key];
        if (!descriptor || !("value" in descriptor)) {
          throw new PublicCacheSafetyError(childPath, "non-serializable");
        }
        visit(descriptor.value, childPath, depth + 1);
      }
    } finally {
      ancestors.delete(value);
    }
  }

  visit(candidate, "$", 0);
  return candidate;
}
