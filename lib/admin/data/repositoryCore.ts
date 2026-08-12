import type { AdminPeriodBounds, ProductionAdminMetricScope } from "./contracts.ts";
import { assertProductionAdminMetricScope } from "./contracts.ts";

export type AdminRepositoryRequest = Readonly<{
  table: "restaurants" | "menus" | "menu_categories" | "menu_dishes" | "analytics_events";
  columns: string;
  equals: Readonly<Record<string, string | boolean>>;
  range?: Readonly<{ column: string; from: string; to: string }>;
  order: readonly Readonly<{ column: string; ascending: boolean }>[];
  limit: number;
}>;
export type AdminRepositoryExecutor = (request: AdminRepositoryRequest) => Promise<{ rows: readonly Record<string, unknown>[]; error?: unknown }>;
export type AdminRepositoryError = { ok: false; code: "database" | "query" | "scope-integrity"; retryable: boolean };

const string = (row: Record<string, unknown>, key: string) => typeof row[key] === "string" ? row[key] as string : "";
const safeMetadata = (value: unknown): Readonly<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const candidate = value as Record<string, unknown>;
  return Object.fromEntries(["instrumentationVersion", "renderer", "viewport"]
    .filter((key) => candidate[key] !== undefined).map((key) => [key, candidate[key]]));
};

export function createProductionAdminRepositoryCore(execute: AdminRepositoryExecutor) {
  async function run(request: AdminRepositoryRequest) {
    try {
      const result = await execute(request);
      if (result.error) return { ok: false as const, code: "query" as const, retryable: true };
      return { ok: true as const, rows: result.rows };
    } catch {
      return { ok: false as const, code: "database" as const, retryable: true };
    }
  }

  return {
    async readRestaurant(input: { restaurantId: string }) {
      if (!input.restaurantId) return { ok: false as const, code: "scope-integrity" as const, retryable: false };
      const result = await run({
        table: "restaurants", columns: "id,name,slug",
        equals: { id: input.restaurantId },
        order: [{ column: "id", ascending: true }],
        limit: 2
      });
      if (!result.ok) return result;
      if (result.rows.some((row) => string(row, "id") !== input.restaurantId) || result.rows.length > 1) {
        return { ok: false as const, code: "scope-integrity" as const, retryable: false };
      }
      const row = result.rows[0];
      return { ok: true as const, restaurant: row ? {
        id: string(row, "id"), name: string(row, "name"), slug: string(row, "slug")
      } : null };
    },

    async readMenu(input: { restaurantId: string }) {
      if (!input.restaurantId) return { ok: false as const, code: "scope-integrity" as const, retryable: false };
      const result = await run({
        table: "menus", columns: "id,restaurant_id,slug,status,is_primary,settings_json,updated_at",
        equals: { restaurant_id: input.restaurantId },
        order: [{ column: "is_primary", ascending: false }, { column: "updated_at", ascending: false }, { column: "id", ascending: true }],
        limit: 100
      });
      if (!result.ok) return result;
      const scoped = result.rows.filter((row) => string(row, "restaurant_id") === input.restaurantId);
      if (scoped.length !== result.rows.length) return { ok: false as const, code: "scope-integrity" as const, retryable: false };
      const ordered = [...scoped].sort((a, b) => {
        const published = Number(string(b, "status") === "published") - Number(string(a, "status") === "published");
        if (published) return published;
        const primary = Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary));
        if (primary) return primary;
        const updated = string(b, "updated_at").localeCompare(string(a, "updated_at"));
        return updated || string(a, "id").localeCompare(string(b, "id"));
      });
      const row = ordered[0];
      return { ok: true as const, menu: row ? {
        id: string(row, "id"), restaurantId: string(row, "restaurant_id"), slug: string(row, "slug"),
        status: string(row, "status"), isPrimary: Boolean(row.is_primary), settingsJson: row.settings_json,
        updatedAt: string(row, "updated_at")
      } : null };
    },

    async readCatalog(scope: ProductionAdminMetricScope) {
      try { assertProductionAdminMetricScope(scope); } catch { return { ok: false as const, code: "scope-integrity" as const, retryable: false }; }
      const common = { restaurant_id: scope.restaurantId, menu_id: scope.menuId };
      const categories = await run({
        table: "menu_categories", columns: "id,restaurant_id,menu_id,slug,name,display_order,updated_at",
        equals: common, order: [{ column: "display_order", ascending: true }, { column: "id", ascending: true }], limit: 1_001
      });
      const dishes = await run({
        table: "menu_dishes", columns: "id,restaurant_id,menu_id,category_id,slug,name,available,image_url,model_3d_url,ar_model_3d_url,updated_at",
        equals: common, order: [{ column: "id", ascending: true }], limit: 1_001
      });
      if (!categories.ok || !dishes.ok) return { ok: false as const, code: "query" as const, retryable: true };
      const all = [...categories.rows, ...dishes.rows];
      if (all.some((row) => string(row, "restaurant_id") !== scope.restaurantId || string(row, "menu_id") !== scope.menuId)) {
        return { ok: false as const, code: "scope-integrity" as const, retryable: false };
      }
      return { ok: true as const, categories: categories.rows, dishes: dishes.rows };
    },

    async readEvents(input: { scope: ProductionAdminMetricScope; window: AdminPeriodBounds; maxRows: number }) {
      try { assertProductionAdminMetricScope(input.scope); } catch { return { ok: false as const, code: "scope-integrity" as const, retryable: false }; }
      if (!Number.isSafeInteger(input.maxRows) || input.maxRows < 1 || Date.parse(input.window.from) >= Date.parse(input.window.to)) {
        return { ok: false as const, code: "scope-integrity" as const, retryable: false };
      }
      const result = await run({
        table: "analytics_events",
        columns: "id,restaurant_id,menu_id,session_id,event_name,source,dish_slug,category_slug,search_query,created_at,metadata",
        equals: { restaurant_id: input.scope.restaurantId, menu_id: input.scope.menuId, source: "production" },
        range: { column: "created_at", from: input.window.from, to: input.window.to },
        order: [{ column: "created_at", ascending: true }, { column: "id", ascending: true }],
        limit: input.maxRows + 1
      });
      if (!result.ok) return result;
      const from = Date.parse(input.window.from), to = Date.parse(input.window.to);
      if (result.rows.some((row) => string(row, "restaurant_id") !== input.scope.restaurantId || string(row, "menu_id") !== input.scope.menuId || string(row, "source") !== "production" || Date.parse(string(row, "created_at")) < from || Date.parse(string(row, "created_at")) >= to)) {
        return { ok: false as const, code: "scope-integrity" as const, retryable: false };
      }
      const events = result.rows.slice(0, input.maxRows).map((row) => ({
        id: string(row, "id"), sessionId: string(row, "session_id"), eventName: string(row, "event_name"),
        dishSlug: string(row, "dish_slug") || undefined, categorySlug: string(row, "category_slug") || undefined,
        searchQuery: string(row, "search_query") || undefined, createdAt: string(row, "created_at"), metadata: safeMetadata(row.metadata)
      }));
      return { ok: true as const, events, truncated: result.rows.length > input.maxRows, observedRows: result.rows.length, rowLimit: input.maxRows };
    }
  };
}
