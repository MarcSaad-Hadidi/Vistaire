import "server-only";

import { getSupabaseAdminClient } from "../../../utils/supabase/admin";
import type { AdminPeriodBounds, ProductionAdminMetricScope } from "./contracts.ts";
import { createProductionAdminRepositoryCore, type AdminRepositoryRequest } from "./repositoryCore.ts";

type Query = PromiseLike<{ data: unknown; error: unknown }> & {
  eq(column: string, value: string | boolean): Query;
  gte(column: string, value: string): Query;
  lt(column: string, value: string): Query;
  order(column: string, options: { ascending: boolean }): Query;
  limit(value: number): Query;
};

async function execute(request: AdminRepositoryRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return { rows: [], error: new Error("configuration") };
  let query = admin.client.from(request.table).select(request.columns) as unknown as Query;
  for (const [column, value] of Object.entries(request.equals)) query = query.eq(column, value);
  if (request.range) query = query.gte(request.range.column, request.range.from).lt(request.range.column, request.range.to);
  for (const order of request.order) query = query.order(order.column, { ascending: order.ascending });
  const { data, error } = await query.limit(request.limit);
  return { rows: Array.isArray(data) ? data as Record<string, unknown>[] : [], error };
}

const repository = createProductionAdminRepositoryCore(execute);

export function readProductionAdminRestaurant(input: { restaurantId: string }) { return repository.readRestaurant(input); }
export function readProductionAdminMenu(input: { restaurantId: string }) { return repository.readMenu(input); }
export function readProductionAdminCatalog(scope: ProductionAdminMetricScope) { return repository.readCatalog(scope); }
export function readProductionAdminEvents(input: { scope: ProductionAdminMetricScope; window: AdminPeriodBounds; maxRows: number }) { return repository.readEvents(input); }
