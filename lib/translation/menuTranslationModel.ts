import { createHash } from "node:crypto";

export type MenuTranslationStatus =
  | "source"
  | "missing"
  | "pending"
  | "in_progress"
  | "up_to_date"
  | "stale"
  | "error";

export type MenuTranslationEntityType = "menu" | "category" | "dish";
export type MenuTranslationFieldValue = string | string[];
export type MenuTranslationFields = Record<string, MenuTranslationFieldValue>;

export type MenuTranslationSourceEntity = {
  type: MenuTranslationEntityType;
  id: string;
  fields: MenuTranslationFields;
  legacyDerivedTags?: string[];
};

export type StoredMenuTranslation = {
  locale: string;
  translation_status?: string;
  source_hash?: string;
  field_hashes?: unknown;
  content?: unknown;
  manual_overrides?: unknown;
  error_message?: string | null;
};

type TranslationHashRow = {
  source_hash?: unknown;
  field_hashes?: unknown;
  manual_overrides?: unknown;
};

export type MenuTranslationStatusSummary = {
  locale: string;
  status: MenuTranslationStatus;
  estimatedCharacters: number;
  missingEntities: number;
  staleEntities: number;
  errorEntities: number;
  error?: string;
};

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)])
  );
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function hashTranslationValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function fieldHashesFor(fields: MenuTranslationFields): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([field, value]) => [field, hashTranslationValue(value)])
  );
}

export function sourceHashFor(fields: MenuTranslationFields): string {
  return hashTranslationValue(fields);
}

/**
 * Rows written before dish names became source identity may still carry a
 * `name` field hash and an aggregate hash that includes it. Keep those rows
 * readable while requiring every current translatable field hash to match.
 */
export function sourceHashMatchesFields(
  fields: MenuTranslationFields,
  row: TranslationHashRow | undefined | null,
  entityType?: MenuTranslationEntityType,
  legacyDerivedTags: readonly string[] = []
): boolean {
  if (!row) return false;
  if (row.source_hash === sourceHashFor(fields)) return true;
  const storedFieldHashes = objectInput(row.field_hashes);
  const expectedFieldHashes = fieldHashesFor(fields);
  const currentFieldHashesMatch = Object.entries(expectedFieldHashes).every(
    ([field, hash]) => storedFieldHashes[field] === hash
  );
  // Optional source fields can be removed after a row was generated. When
  // every current field hash still matches and the stored row contains an
  // extra field hash, the aggregate hash is stale only because that field was
  // removed; treat the row as current so generation/readiness can continue.
  if (
    currentFieldHashesMatch &&
    Object.keys(storedFieldHashes).some((field) => !(field in expectedFieldHashes))
  ) {
    return true;
  }

  if (entityType !== "dish") return false;

  const nonTagFieldsMatch = Object.entries(expectedFieldHashes)
    .filter(([field]) => field !== "tags")
    .every(([field, hash]) => storedFieldHashes[field] === hash);
  if (!nonTagFieldsMatch) return false;

  const tags = fields.tags;
  if (!Array.isArray(tags)) return false;
  const tagVariants = legacyTagVariants(tags, legacyDerivedTags);
  return tagVariants.some(
    (variant) =>
      storedFieldHashes.tags === hashTranslationValue(variant) &&
      (typeof storedFieldHashes.name === "string" ||
        row.source_hash === sourceHashFor({ ...fields, tags: variant }))
  );
}

export function legacyTagVariants(
  tags: string[],
  legacyDerivedTags: readonly string[] = []
): string[][] {
  const variants: string[][] = [tags];
  const badges = legacyDerivedTags
    .map((tag) => tag.trim().toLowerCase())
    .map((tag) => tag === "signature" ? "Signature" : tag === "recommande" ? "Recommande" : "")
    .filter((tag, index, values) => tag && values.indexOf(tag) === index);
  for (const badge of badges) {
    const current = [...variants];
    for (const variant of current) {
      if (variant.some((tag) => tag.toLowerCase() === badge.toLowerCase())) continue;
      for (let index = 0; index <= variant.length; index += 1) {
        variants.push([
          ...variant.slice(0, index),
          badge,
          ...variant.slice(index)
        ]);
      }
    }
  }
  return variants;
}

function normalizedTagKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Return the positions occupied by legacy derived badges in a stored dish
 * translation. The position is recovered from the stored tag hash, so the
 * translated value may be any locale-specific spelling; no language list is
 * needed to remove it safely before adding the canonical badge.
 */
export function legacyDerivedTagIndexes(
  fields: MenuTranslationFields,
  row: TranslationHashRow | undefined | null,
  legacyDerivedTags: readonly string[] = []
): number[] {
  if (!row || !Array.isArray(fields.tags) || legacyDerivedTags.length === 0) {
    return [];
  }

  const storedFieldHashes = objectInput(row.field_hashes);
  const legacyVariant = legacyTagVariants(fields.tags, legacyDerivedTags).find(
    (variant) =>
      storedFieldHashes.tags === hashTranslationValue(variant) &&
      (typeof storedFieldHashes.name === "string" ||
        row.source_hash === sourceHashFor({ ...fields, tags: variant }))
  );
  if (!legacyVariant) return [];

  const derivedKeys = new Set(legacyDerivedTags.map(normalizedTagKey));
  return legacyVariant.reduce<number[]>((indexes, tag, index) => {
    if (derivedKeys.has(normalizedTagKey(tag))) indexes.push(index);
    return indexes;
  }, []);
}

export function fieldHashMatchesFields(
  fields: MenuTranslationFields,
  row: TranslationHashRow | undefined | null,
  field: string,
  entityType?: MenuTranslationEntityType,
  legacyDerivedTags: readonly string[] = []
): boolean {
  if (!row) return false;
  const storedFieldHashes = objectInput(row.field_hashes);
  const expectedFieldHashes = fieldHashesFor(fields);
  if (storedFieldHashes[field] === expectedFieldHashes[field]) return true;
  if (entityType !== "dish" || field !== "tags" || !Array.isArray(fields.tags)) {
    return false;
  }
  const tagVariants = legacyTagVariants(fields.tags, legacyDerivedTags);
  return tagVariants.some(
    (variant) =>
      storedFieldHashes.tags === hashTranslationValue(variant) &&
      (typeof storedFieldHashes.name === "string" ||
        row.source_hash === sourceHashFor({ ...fields, tags: variant }))
  );
}

export function objectInput(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function sourceHashCompatibleWithManualOverrides(
  fields: MenuTranslationFields,
  row: TranslationHashRow | undefined | null,
  entityType?: MenuTranslationEntityType,
  legacyDerivedTags: readonly string[] = []
): boolean {
  const manualOverrides = objectInput(row?.manual_overrides);
  if (!Object.values(manualOverrides).some((value) => value === true)) return false;
  return Object.entries(fields)
    .filter(([field]) => manualOverrides[field] !== true)
    .every(([field]) =>
      fieldHashMatchesFields(fields, row, field, entityType, legacyDerivedTags)
    );
}

export function stringInput(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function stringListInput(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => stringInput(item))
      .filter(Boolean)
      .slice(0, 80);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return stringListInput(parsed);
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 80);
    }
  }
  return [];
}

function usableStoredFieldValue(
  content: Record<string, unknown>,
  field: string,
  sourceValue: MenuTranslationFieldValue,
  manualOverride: boolean
): boolean {
  const stored = content[field];
  if (Array.isArray(sourceValue)) {
    if (!Array.isArray(stored)) return false;
    const values = stored
      .map((item) => stringInput(item))
      .filter(Boolean);
    if (values.length === 0) return false;
    return manualOverride || values.length >= sourceValue.length;
  }
  return Boolean(stringInput(stored));
}

/**
 * Legacy rows can need only hash metadata repair. This predicate is deliberately
 * strict: every current field hash must match and every stored value must remain
 * usable, while a non-empty manual override may intentionally have fewer list
 * items than the source. No content or audit columns are changed by the repair.
 */
export function translationRowCanRepairMetadata(
  entity: MenuTranslationSourceEntity,
  row: StoredMenuTranslation | null | undefined
): boolean {
  if (!row || row.translation_status === "error") return false;
  const storedFieldHashes = objectInput(row.field_hashes);
  const expectedFieldHashes = fieldHashesFor(entity.fields);
  if (
    Object.entries(expectedFieldHashes).some(
      ([field, hash]) => storedFieldHashes[field] !== hash
    )
  ) {
    return false;
  }
  const manualOverrides = objectInput(row.manual_overrides);
  if (
    Object.values(manualOverrides).some(
      (value) => value !== true && value !== false
    )
  ) {
    return false;
  }
  const content = objectInput(row.content);
  if (
    Object.entries(entity.fields).some(([field, value]) =>
      !usableStoredFieldValue(content, field, value, manualOverrides[field] === true)
    )
  ) {
    return false;
  }
  const expectedSourceHash = sourceHashFor(entity.fields);
  const storedKeys = Object.keys(storedFieldHashes).sort();
  const expectedKeys = Object.keys(expectedFieldHashes).sort();
  return (
    row.source_hash !== expectedSourceHash ||
    storedKeys.length !== expectedKeys.length ||
    storedKeys.some((field, index) => field !== expectedKeys[index])
  );
}

export function translationTextLength(value: MenuTranslationFieldValue): number {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + item.length, 0);
  }
  return value.length;
}

export function isEmptyTranslationValue(value: MenuTranslationFieldValue): boolean {
  return Array.isArray(value) ? value.length === 0 : value.length === 0;
}

function hasTranslatedValue(content: Record<string, unknown>, field: string): boolean {
  const value = content[field];
  if (Array.isArray(value)) return value.some((item) => stringInput(item));
  return Boolean(stringInput(value));
}

function isManualOverride(manualOverrides: Record<string, unknown>, field: string): boolean {
  return manualOverrides[field] === true;
}

export function estimateChangedCharacters(
  entity: MenuTranslationSourceEntity,
  row?: StoredMenuTranslation | null
): number {
  const content = objectInput(row?.content);
  const manualOverrides = objectInput(row?.manual_overrides);

  return Object.entries(entity.fields).reduce((total, [field, value]) => {
    if (isEmptyTranslationValue(value)) return total;
    if (isManualOverride(manualOverrides, field)) return total;
    if (fieldHashMatchesFields(
      entity.fields,
      row,
      field,
      entity.type,
      entity.legacyDerivedTags
    ) &&
      hasTranslatedValue(content, field)) {
      return total;
    }
    return total + translationTextLength(value);
  }, 0);
}

export function resolveEntityTranslationStatus(
  entity: MenuTranslationSourceEntity,
  row?: StoredMenuTranslation | null
): {
  status: MenuTranslationStatus;
  estimatedCharacters: number;
  error?: string;
} {
  if (!row) {
    return {
      status: "missing",
      estimatedCharacters: estimateChangedCharacters(entity, row)
    };
  }

  if (row.translation_status === "error") {
    return {
      status: "error",
      estimatedCharacters: estimateChangedCharacters(entity, row),
      error: row.error_message ?? undefined
    };
  }

  const estimatedCharacters = estimateChangedCharacters(entity, row);
  const sourceHashReady =
    sourceHashMatchesFields(
      entity.fields,
      row,
      entity.type,
      entity.legacyDerivedTags
    ) ||
    sourceHashCompatibleWithManualOverrides(
      entity.fields,
      row,
      entity.type,
      entity.legacyDerivedTags
    );
  if (!sourceHashReady || estimatedCharacters > 0) {
    return { status: "stale", estimatedCharacters };
  }

  return { status: "up_to_date", estimatedCharacters: 0 };
}

export function summarizeLocaleTranslationStatus(args: {
  locale: string;
  defaultLocale: string;
  entities: MenuTranslationSourceEntity[];
  rowsByKey: Map<string, StoredMenuTranslation>;
}): MenuTranslationStatusSummary {
  if (args.locale === args.defaultLocale) {
    return {
      locale: args.locale,
      status: "source",
      estimatedCharacters: 0,
      missingEntities: 0,
      staleEntities: 0,
      errorEntities: 0
    };
  }

  let estimatedCharacters = 0;
  let missingEntities = 0;
  let staleEntities = 0;
  let errorEntities = 0;
  let firstError = "";

  for (const entity of args.entities) {
    const row = args.rowsByKey.get(`${entity.type}:${entity.id}`);
    const status = resolveEntityTranslationStatus(entity, row);
    estimatedCharacters += status.estimatedCharacters;
    if (status.status === "missing") missingEntities += 1;
    if (status.status === "stale") staleEntities += 1;
    if (status.status === "error") {
      errorEntities += 1;
      firstError ||= status.error ?? "";
    }
  }

  const status: MenuTranslationStatus =
    errorEntities > 0
      ? "error"
      : missingEntities > 0
        ? "missing"
        : staleEntities > 0
          ? "stale"
          : "up_to_date";

  return {
    locale: args.locale,
    status,
    estimatedCharacters,
    missingEntities,
    staleEntities,
    errorEntities,
    ...(firstError ? { error: firstError } : {})
  };
}
