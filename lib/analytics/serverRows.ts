import "server-only";

import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export type DataSourceStatus = "real" | "partial" | "empty" | "preview";

export type DataReadResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; error: string; rows: [] };

export type AnyRow = Record<string, unknown>;

export type PeriodReadResult<T> = DataReadResult<T> & {
  truncated: boolean;
};

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

export async function readSupabaseRowsByColumn<T extends AnyRow>(
  table: string,
  column: string,
  value: string,
  limit = 500
): Promise<DataReadResult<T>> {
  if (!value.trim()) {
    return { ok: false, error: "A scoped data read requires an identifier.", rows: [] };
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return { ok: false, error: admin.reason, rows: [] };
  }

  const { data, error } = await admin.client
    .from(table)
    .select("*")
    .eq(column, value)
    .limit(limit);

  if (error) {
    logServerDataError(`read scoped ${table}`, error.message);
    return { ok: false, error: error.message, rows: [] };
  }

  return { ok: true, rows: (data ?? []) as T[] };
}

export async function readSupabaseRowsByFilters<T extends AnyRow>(args: {
  table: string;
  columns: string;
  filters: Record<string, string>;
  limit: number;
  orderBy: string;
}): Promise<DataReadResult<T>> {
  const { table, columns, filters, limit, orderBy } = args;
  if (Object.values(filters).some((value) => !value.trim())) return { ok: false, error: "Scoped reads require identifiers.", rows: [] };
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return { ok: false, error: admin.reason, rows: [] };
  let query = admin.client.from(table).select(columns);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { data, error } = await query.order(orderBy, { ascending: true }).limit(limit);
  if (error) return { ok: false, error: error.message, rows: [] };
  return { ok: true, rows: (data ?? []) as unknown as T[] };
}

/**
 * Reads one restaurant's event stream in a bounded, deterministic window.
 * The explicit order and pagination avoid the arbitrary first 1,000 rows
 * returned by PostgREST when a restaurant has a busy service.
 */
export async function readAnalyticsEventsForPeriod<T extends AnyRow>(args: {
  restaurantId: string;
  fromIso: string;
  toIso: string;
  menuId?: string;
  pageSize?: number;
  maxRows?: number;
}): Promise<PeriodReadResult<T>> {
  const { restaurantId, fromIso, toIso } = args;
  const pageSize = Math.max(1, Math.min(args.pageSize ?? 1_000, 1_000));
  const maxRows = Math.max(pageSize, args.maxRows ?? 10_000);
  if (!restaurantId.trim()) {
    return {
      ok: false,
      error: "A scoped data read requires an identifier.",
      rows: [],
      truncated: false
    };
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return { ok: false, error: admin.reason, rows: [], truncated: false };
  }

  const rows: T[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    let query = admin.client
      .from("analytics_events")
      .select("id,restaurant_id,menu_id,dish_id,session_id,event_name,source,dish_slug,category_slug,search_query,filter_name,cta_name,created_at")
      .eq("restaurant_id", restaurantId)
      .eq("source", "production")
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (args.menuId) query = query.eq("menu_id", args.menuId);
    const { data, error } = await query.range(offset, offset + pageSize - 1);

    if (error) {
      logServerDataError("read analytics_events period", error.message);
      return { ok: false, error: error.message, rows: [], truncated: false };
    }

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) {
      return { ok: true, rows, truncated: false };
    }
  }

  return { ok: true, rows, truncated: true };
}

export async function readRestaurantDailyAnalyticsForPeriod<T extends AnyRow>(args: {
  restaurantId: string;
  fromDay: string;
  toDay: string;
}): Promise<DataReadResult<T>> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return { ok: false, error: admin.reason, rows: [] };
  const { data, error } = await admin.client
    .from("restaurant_daily_analytics")
    .select("*")
    .eq("restaurant_id", args.restaurantId)
    .gte("day", args.fromDay)
    .lt("day", args.toDay)
    .order("day", { ascending: true });
  if (error) {
    logServerDataError("read restaurant_daily_analytics period", error.message);
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
