import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  revalidatePublicMenuCache,
  type PublicMenuRevalidationResult
} from "@/lib/menu/publicMenuCache";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import { invalidatePublicDishAssetMetadataCache } from "@/lib/publicDishAssetRedirect";

export type MenuMutationRevalidationFailure =
  | "asset-metadata-invalidation"
  | "restaurant-cache"
  | "restaurant-lookup"
  | "slug-cache"
  | "path-revalidation";

export type MenuMutationRevalidationResult = {
  ok: boolean;
  retryRequired: boolean;
  restaurantSlug: string | null;
  invalidatedAssetMetadataEntries: number;
  invalidatedPaths: string[];
  failures: MenuMutationRevalidationFailure[];
};

export type MenuMutationRetrySignal = {
  kind: "menu-revalidation-retry-required";
  restaurantId: string;
  dishId?: string;
};

type MenuMutationRetrySink = (
  signal: MenuMutationRetrySignal
) => void | Promise<void>;

function allowlistedRetrySignal(input: unknown): MenuMutationRetrySignal | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (record.kind !== "menu-revalidation-retry-required") return null;
  const restaurantId =
    typeof record.restaurantId === "string" ? record.restaurantId.trim() : "";
  if (!restaurantId) return null;
  const payload: MenuMutationRetrySignal = {
    kind: "menu-revalidation-retry-required",
    restaurantId
  };
  const dishId =
    typeof record.dishId === "string" ? record.dishId.trim() : "";
  if (dishId) payload.dishId = dishId;
  return Object.freeze(payload);
}

const structuredRetryLogSink: MenuMutationRetrySink = (signal) => {
  const payload: MenuMutationRetrySignal = {
    kind: signal.kind,
    restaurantId: signal.restaurantId
  };
  if (signal.dishId) payload.dishId = signal.dishId;
  console.error(JSON.stringify(payload));
};

/**
 * Publishes a non-secret, machine-readable post-commit retry event. A broken
 * observability subscriber must never change the result of the committed
 * mutation, so every sink exception is contained here.
 */
export async function emitMenuMutationRetrySignal(
  signal: unknown,
  sink?: MenuMutationRetrySink
): Promise<boolean> {
  const safeSignal = allowlistedRetrySignal(signal);
  if (!safeSignal) return false;
  try {
    await (sink ?? structuredRetryLogSink)(safeSignal);
    return true;
  } catch {
    return false;
  }
}

type MenuMutationRevalidationDependencies = {
  revalidateMenuCache?: (
    scope: { slug?: string; restaurantId?: string }
  ) => Promise<PublicMenuRevalidationResult>;
  invalidateAssetMetadata?: (scope: {
    restaurantId: string;
    dishId?: string;
  }) => number;
  revalidatePath?: (path: string) => Promise<void> | void;
  signalRetry?: MenuMutationRetrySink;
};

function getString(
  row: Record<string, unknown> | null | undefined,
  key: string
): string {
  const value = row?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function recordFailure(
  failures: MenuMutationRevalidationFailure[],
  failure: MenuMutationRevalidationFailure
): void {
  if (!failures.includes(failure)) failures.push(failure);
}

/**
 * Invalidates by restaurant id before the fallible slug lookup. A committed
 * mutation therefore has a reliable cache path even if the lookup needed for
 * friendly page paths is temporarily unavailable. Failures are returned as a
 * retry signal and never reinterpret the committed database mutation.
 */
export async function revalidateOwnerMenuMutationPaths(
  args: {
    client: SupabaseClient;
    restaurantId: string;
    dishId?: string;
    dishSlug?: string;
  },
  dependencies: MenuMutationRevalidationDependencies = {}
): Promise<MenuMutationRevalidationResult> {
  const failures: MenuMutationRevalidationFailure[] = [];
  const invalidatedPaths: string[] = [];
  const finish = async (
    result: MenuMutationRevalidationResult
  ): Promise<MenuMutationRevalidationResult> => {
    if (result.retryRequired) {
      const signal: MenuMutationRetrySignal = {
        kind: "menu-revalidation-retry-required",
        restaurantId: args.restaurantId,
        ...(args.dishId ? { dishId: args.dishId } : {})
      };
      await emitMenuMutationRetrySignal(signal, dependencies.signalRetry);
    }
    return result;
  };
  const invalidateAssetMetadata =
    dependencies.invalidateAssetMetadata ??
    invalidatePublicDishAssetMetadataCache;
  let invalidatedAssetMetadataEntries = 0;
  try {
    invalidatedAssetMetadataEntries = invalidateAssetMetadata({
      restaurantId: args.restaurantId,
      ...(args.dishId ? { dishId: args.dishId } : {})
    });
  } catch {
    recordFailure(failures, "asset-metadata-invalidation");
  }

  const revalidateMenuCache =
    dependencies.revalidateMenuCache ?? revalidatePublicMenuCache;
  try {
    const restaurantInvalidation = await revalidateMenuCache({
      restaurantId: args.restaurantId
    });
    if (!restaurantInvalidation.ok) {
      recordFailure(failures, "restaurant-cache");
    }
  } catch {
    recordFailure(failures, "restaurant-cache");
  }

  let restaurant: {
    data: Record<string, unknown> | null;
    error: unknown;
  };
  try {
    restaurant = await args.client
      .from("restaurants")
      .select("slug,name")
      .eq("id", args.restaurantId)
      .maybeSingle();
  } catch {
    restaurant = { data: null, error: new Error("lookup failed") };
  }
  if (restaurant.error || !restaurant.data) {
    recordFailure(failures, "restaurant-lookup");
    return finish({
      ok: false,
      retryRequired: true,
      restaurantSlug: null,
      invalidatedAssetMetadataEntries,
      invalidatedPaths,
      failures
    });
  }

  const restaurantSlug = slugifyRestaurantSlug(
    getString(restaurant.data, "slug") || getString(restaurant.data, "name")
  );
  if (!restaurantSlug) {
    recordFailure(failures, "restaurant-lookup");
    return finish({
      ok: false,
      retryRequired: true,
      restaurantSlug: null,
      invalidatedAssetMetadataEntries,
      invalidatedPaths,
      failures
    });
  }

  try {
    const slugInvalidation = await revalidateMenuCache({
      slug: restaurantSlug,
      restaurantId: args.restaurantId
    });
    if (!slugInvalidation.ok) recordFailure(failures, "slug-cache");
  } catch {
    recordFailure(failures, "slug-cache");
  }

  const revalidatePath =
    dependencies.revalidatePath ??
    (await import("next/cache")).revalidatePath;
  const paths = [`/menu/${restaurantSlug}`];
  const dishSlug = slugifyRestaurantSlug(args.dishSlug ?? "");
  if (dishSlug) {
    paths.push(`/menu/${restaurantSlug}/dishes/${dishSlug}`);
  }
  for (const path of paths) {
    try {
      await revalidatePath(path);
      invalidatedPaths.push(path);
    } catch {
      recordFailure(failures, "path-revalidation");
    }
  }

  return finish({
    ok: failures.length === 0,
    retryRequired: failures.length > 0,
    restaurantSlug,
    invalidatedAssetMetadataEntries,
    invalidatedPaths,
    failures
  });
}
