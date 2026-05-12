import "server-only";

import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export type DataSourceStatus = "supabase" | "fallback";

export type DataReadResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; error: string; rows: [] };

export type AnyRow = Record<string, unknown>;

function logServerDataError(scope: string, error: unknown) {
  if (process.env.NODE_ENV === "production") {
    console.error(`[Vistaire data] ${scope}`);
    return;
  }
  console.warn(`[Vistaire data] ${scope}`, error);
}

export async function readSupabaseRows<T extends AnyRow>(
  table: string,
  limit = 500
): Promise<DataReadResult<T>> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return { ok: false, error: admin.reason, rows: [] };
  }

  const { data, error } = await admin.client.from(table).select("*").limit(limit);

  if (error) {
    logServerDataError(`read ${table}`, error.message);
    return { ok: false, error: error.message, rows: [] };
  }

  return { ok: true, rows: (data ?? []) as T[] };
}

export async function getSupabaseTableColumns(table: string): Promise<Set<string>> {
  const result = await readSupabaseRows(table, 1);
  if (!result.ok || result.rows.length === 0) return new Set();
  return new Set(Object.keys(result.rows[0] ?? {}));
}

export function pickColumn(
  columns: Set<string>,
  candidates: string[]
): string | null {
  return candidates.find((candidate) => columns.has(candidate)) ?? null;
}

export function getString(
  row: AnyRow,
  candidates: string[],
  fallback = ""
): string {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

export function getNullableString(
  row: AnyRow,
  candidates: string[]
): string | null {
  const value = getString(row, candidates, "");
  return value || null;
}

export function getNumber(
  row: AnyRow,
  candidates: string[],
  fallback = 0
): number {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

export function getBoolean(
  row: AnyRow,
  candidates: string[],
  fallback = false
): boolean {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
  }
  return fallback;
}

export function getDateLabel(row: AnyRow, candidates: string[]): string {
  const raw = getString(row, candidates, "");
  if (!raw) return "Aucune activité";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("fr-CA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function filterRowsByRestaurantId<T extends AnyRow>(
  rows: T[],
  restaurantId: string
): T[] {
  if (!restaurantId) return rows;
  const idColumns = [
    "restaurant_id",
    "restaurantId",
    "restaurant_uuid",
    "restaurant"
  ];

  return rows.filter((row) =>
    idColumns.some((key) => String(row[key] ?? "") === restaurantId)
  );
}

export function hasUsableRows(result: DataReadResult<AnyRow>): boolean {
  return result.ok && result.rows.length > 0;
}
