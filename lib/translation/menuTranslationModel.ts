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

export function objectInput(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
  const expectedFieldHashes = fieldHashesFor(entity.fields);
  const storedFieldHashes = objectInput(row?.field_hashes);
  const content = objectInput(row?.content);
  const manualOverrides = objectInput(row?.manual_overrides);

  return Object.entries(entity.fields).reduce((total, [field, value]) => {
    if (isEmptyTranslationValue(value)) return total;
    if (isManualOverride(manualOverrides, field)) return total;
    if (
      storedFieldHashes[field] === expectedFieldHashes[field] &&
      hasTranslatedValue(content, field)
    ) {
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

  const sourceHash = sourceHashFor(entity.fields);
  const estimatedCharacters = estimateChangedCharacters(entity, row);
  if (row.source_hash !== sourceHash || estimatedCharacters > 0) {
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
