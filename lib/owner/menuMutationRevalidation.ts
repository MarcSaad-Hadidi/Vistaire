import "server-only";

import { channel } from "node:diagnostics_channel";
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
  schemaVersion: 1;
  source: "owner-menu-mutation" | "admin-availability";
  restaurantId: string;
  dishId?: string;
  failures: readonly (
    | MenuMutationRevalidationFailure
    | "post-commit-revalidation"
  )[];
};

export const MENU_MUTATION_RETRY_CHANNEL_NAME =
  "vistaire.menu-mutation-revalidation.retry.v1";
const menuMutationRetryChannel = channel(MENU_MUTATION_RETRY_CHANNEL_NAME);

type MenuMutationRetrySink = (
  signal: MenuMutationRetrySignal
) => void | Promise<void>;

/**
 * Publishes a non-secret, machine-readable post-commit retry event. A broken
 * observability subscriber must never change the result of the committed
 * mutation, so every sink exception is contained here.
 */
export function emitMenuMutationRetrySignal(
  signal: MenuMutationRetrySignal,
  sink?: MenuMutationRetrySink
): boolean {
  const safeSignal = Object.freeze({
    ...signal,
    failures: Object.freeze([...signal.failures])
  });
  try {
    const pending = (
      sink ?? ((event) => menuMutationRetryChannel.publish(event))
    )(safeSignal);
    if (pending) {
      void Promise.resolve(pending).catch(() => {});
    }
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
  const finish = (
    result: MenuMutationRevalidationResult
  ): MenuMutationRevalidationResult => {
    if (result.retryRequired) {
      const signal: MenuMutationRetrySignal = {
        kind: "menu-revalidation-retry-required",
        schemaVersion: 1,
        source: "owner-menu-mutation",
        restaurantId: args.restaurantId,
        ...(args.dishId ? { dishId: args.dishId } : {}),
        failures: [...result.failures]
      };
      emitMenuMutationRetrySignal(signal, dependencies.signalRetry);
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
