import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { landingCacheTag } from "@/lib/cache/publicCachePolicy";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import { invalidatePublicDishAssetMetadataCache } from "@/lib/publicDishAssetRedirect";
import {
  isRestaurantExperienceId,
  type RestaurantExperienceId
} from "@/lib/restaurant-experiences/contracts";

const FEATURED_LANDING_PATHS = [
  "/",
  "/en",
  "/menu-digital-restaurant",
  "/menu-pdf-vs-menu-digital",
  "/en/digital-restaurant-menu",
  "/en/pdf-vs-digital-menu"
] as const;

type RevalidationTagProfile = { expire: 0 };

type AssetMetadataScope = {
  restaurantId: string;
  dishId?: string;
};

export type PublicMutationIdentity = Readonly<{
  restaurantId: string;
  restaurantSlug: string;
  restaurantKey: string;
  featuredExperienceId: RestaurantExperienceId | null;
  dishSlug: string;
  dishId?: string;
}>;

export type PublicMutationRevalidationCallbacks = Readonly<{
  revalidateTag: (
    tag: string,
    profile: RevalidationTagProfile
  ) => void | Promise<void>;
  revalidatePath: (path: string) => void | Promise<void>;
}>;

export type MenuMutationRetrySignal = {
  kind: "menu-revalidation-retry-required";
  restaurantId: string;
  dishId?: string;
};

type MenuMutationRetrySink = (
  signal: MenuMutationRetrySignal
) => void | Promise<void>;

export type PublicMutationInvalidationOptions = Readonly<{
  callbacks?: Partial<PublicMutationRevalidationCallbacks>;
  invalidateAssetMetadata?: (scope: AssetMetadataScope) => number;
  signalRetry?: MenuMutationRetrySink;
  emitRetrySignal?: boolean;
}>;

export type PublicMutationSchedulingError = Readonly<{
  kind: "tag" | "path";
  operationIndex: number;
  code: "enqueue_call_failed";
}>;

export type PublicMutationInvalidationReport = Readonly<{
  attempted: number;
  queuedCallReturned: number;
  enqueueErrors: readonly PublicMutationSchedulingError[];
}>;

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

type LegacyMenuCacheResult = { ok: boolean };

type MenuMutationRevalidationDependencies = {
  revalidateMenuCache?: (
    scope: { slug?: string; restaurantId?: string }
  ) => Promise<LegacyMenuCacheResult>;
  invalidateAssetMetadata?: (scope: AssetMetadataScope) => number;
  revalidateTag?: PublicMutationRevalidationCallbacks["revalidateTag"];
  revalidatePath?: PublicMutationRevalidationCallbacks["revalidatePath"];
  signalRetry?: MenuMutationRetrySink;
};

function getString(
  row: Record<string, unknown> | null | undefined,
  key: string
): string {
  const value = row?.[key];
  return typeof value === "string" ? value.trim() : "";
}

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

function retrySignal(identity: Pick<PublicMutationIdentity, "restaurantId" | "dishId">) {
  return {
    kind: "menu-revalidation-retry-required" as const,
    restaurantId: identity.restaurantId,
    ...(identity.dishId ? { dishId: identity.dishId } : {})
  };
}

export async function resolvePublicMutationIdentity(args: {
  client: SupabaseClient;
  restaurantId: string;
  dishId?: string;
  dishSlug?: string;
}): Promise<PublicMutationIdentity | null> {
  const restaurantId = args.restaurantId.trim();
  if (!restaurantId) return null;

  let restaurant: {
    data: Record<string, unknown> | null;
    error: unknown;
  };
  try {
    restaurant = await args.client
      .from("restaurants")
      .select("slug,name")
      .eq("id", restaurantId)
      .maybeSingle();
  } catch {
    return null;
  }
  if (restaurant.error || !restaurant.data) return null;

  const restaurantSlug = slugifyRestaurantSlug(
    getString(restaurant.data, "slug") || getString(restaurant.data, "name")
  );
  if (!restaurantSlug) return null;

  const dishId = args.dishId?.trim() ?? "";
  return Object.freeze({
    restaurantId,
    restaurantSlug,
    restaurantKey: restaurantSlug,
    featuredExperienceId: isRestaurantExperienceId(restaurantSlug)
      ? restaurantSlug
      : null,
    dishSlug: slugifyRestaurantSlug(args.dishSlug ?? ""),
    ...(dishId ? { dishId } : {})
  });
}

type RevalidationOperation = Readonly<{
  kind: "tag" | "path";
  run: () => void | Promise<void>;
}>;

export async function invalidateCommittedPublicMutation(
  identity: PublicMutationIdentity | null,
  options: PublicMutationInvalidationOptions = {}
): Promise<PublicMutationInvalidationReport> {
  if (!identity) {
    return Object.freeze({
      attempted: 0,
      queuedCallReturned: 0,
      enqueueErrors: Object.freeze([])
    });
  }

  let assetMetadataFailed = false;
  const invalidateAssetMetadata =
    options.invalidateAssetMetadata ?? invalidatePublicDishAssetMetadataCache;
  try {
    invalidateAssetMetadata({
      restaurantId: identity.restaurantId,
      ...(identity.dishId ? { dishId: identity.dishId } : {})
    });
  } catch {
    assetMetadataFailed = true;
  }

  const scheduleTag = options.callbacks?.revalidateTag ?? revalidateTag;
  const schedulePath = options.callbacks?.revalidatePath ?? revalidatePath;
  const operations: RevalidationOperation[] = [];

  if (identity.featuredExperienceId) {
    for (const locale of ["fr", "en"] as const) {
      const tag = landingCacheTag({
        restaurantKey: identity.restaurantKey,
        experienceId: identity.featuredExperienceId,
        locale
      });
      operations.push({
        kind: "tag",
        run: () => scheduleTag(tag, { expire: 0 })
      });
    }
  }

  operations.push({
    kind: "path",
    run: () => schedulePath(`/menu/${identity.restaurantSlug}`)
  });
  if (identity.dishSlug) {
    operations.push({
      kind: "path",
      run: () =>
        schedulePath(
          `/menu/${identity.restaurantSlug}/dishes/${identity.dishSlug}`
        )
    });
  }
  if (identity.featuredExperienceId) {
    for (const path of FEATURED_LANDING_PATHS) {
      operations.push({ kind: "path", run: () => schedulePath(path) });
    }
  }

  let queuedCallReturned = 0;
  const enqueueErrors: PublicMutationSchedulingError[] = [];
  for (const [operationIndex, operation] of operations.entries()) {
    try {
      await operation.run();
      queuedCallReturned += 1;
    } catch {
      enqueueErrors.push(
        Object.freeze({
          kind: operation.kind,
          operationIndex,
          code: "enqueue_call_failed" as const
        })
      );
    }
  }

  if (
    options.emitRetrySignal !== false &&
    (assetMetadataFailed || enqueueErrors.length > 0)
  ) {
    await emitMenuMutationRetrySignal(retrySignal(identity), options.signalRetry);
  }

  return Object.freeze({
    attempted: operations.length,
    queuedCallReturned,
    enqueueErrors: Object.freeze(enqueueErrors)
  });
}

function recordFailure(
  failures: MenuMutationRevalidationFailure[],
  failure: MenuMutationRevalidationFailure
): void {
  if (!failures.includes(failure)) failures.push(failure);
}

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
  let invalidatedAssetMetadataEntries = 0;

  const invalidateAssetMetadata =
    dependencies.invalidateAssetMetadata ?? invalidatePublicDishAssetMetadataCache;
  try {
    invalidatedAssetMetadataEntries = invalidateAssetMetadata({
      restaurantId: args.restaurantId,
      ...(args.dishId ? { dishId: args.dishId } : {})
    });
  } catch {
    recordFailure(failures, "asset-metadata-invalidation");
  }

  if (dependencies.revalidateMenuCache) {
    try {
      const byRestaurant = await dependencies.revalidateMenuCache({
        restaurantId: args.restaurantId
      });
      if (!byRestaurant.ok) recordFailure(failures, "restaurant-cache");
    } catch {
      recordFailure(failures, "restaurant-cache");
    }
  }

  const identity = await resolvePublicMutationIdentity(args);
  if (!identity) {
    recordFailure(failures, "restaurant-lookup");
    await emitMenuMutationRetrySignal(
      {
        kind: "menu-revalidation-retry-required",
        restaurantId: args.restaurantId,
        ...(args.dishId ? { dishId: args.dishId } : {})
      },
      dependencies.signalRetry
    );
    return {
      ok: false,
      retryRequired: true,
      restaurantSlug: null,
      invalidatedAssetMetadataEntries,
      invalidatedPaths,
      failures
    };
  }

  const restaurantSlug = identity.restaurantSlug;
  const dishSlug = identity.dishSlug;

  if (dependencies.revalidateMenuCache) {
    try {
      const bySlug = await dependencies.revalidateMenuCache({
        slug: restaurantSlug,
        restaurantId: args.restaurantId
      });
      if (!bySlug.ok) recordFailure(failures, "slug-cache");
    } catch {
      recordFailure(failures, "slug-cache");
    }
  }

  const menuPath = `/menu/${restaurantSlug}`;
  const dishPath = dishSlug
    ? `/menu/${restaurantSlug}/dishes/${dishSlug}`
    : "";
  const schedulePath = dependencies.revalidatePath ?? revalidatePath;
  const scheduleTag = dependencies.revalidateTag ?? revalidateTag;

  const report = await invalidateCommittedPublicMutation(identity, {
    callbacks: {
      revalidateTag: scheduleTag,
      revalidatePath: async (path) => {
        await schedulePath(path);
        if (path === menuPath || (dishPath && path === dishPath)) {
          invalidatedPaths.push(path);
        }
      }
    },
    invalidateAssetMetadata: () => 0,
    emitRetrySignal: false
  });

  if (report.enqueueErrors.some((error) => error.kind === "path")) {
    recordFailure(failures, "path-revalidation");
  }
  if (report.enqueueErrors.some((error) => error.kind === "tag")) {
    recordFailure(failures, "slug-cache");
  }

  if (failures.length > 0) {
    await emitMenuMutationRetrySignal(
      {
        kind: "menu-revalidation-retry-required",
        restaurantId: args.restaurantId,
        ...(args.dishId ? { dishId: args.dishId } : {})
      },
      dependencies.signalRetry
    );
  }

  return {
    ok: failures.length === 0,
    retryRequired: failures.length > 0,
    restaurantSlug,
    invalidatedAssetMetadataEntries,
    invalidatedPaths,
    failures
  };
}
