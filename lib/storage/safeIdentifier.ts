const STORAGE_SAFE_IDENTIFIER_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates a database identifier before it is interpolated as one Storage
 * path segment. This is intentionally broader than RFC UUID validation: the
 * database contains safe legacy UUID-shaped identifiers with non-RFC bits.
 * Whitespace is not trimmed so encoded/path-like input cannot be normalized
 * into an accepted identifier by accident.
 */
export function normalizeStorageSafeIdentifier(value: unknown): string | null {
  if (typeof value !== "string" || !STORAGE_SAFE_IDENTIFIER_PATTERN.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

export function isStorageSafeIdentifier(value: unknown): value is string {
  return normalizeStorageSafeIdentifier(value) !== null;
}

/** Keeps strict UUID semantics for menu dish IDs and public API routes. */
export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID_PATTERN.test(value);
}
