import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { landingCacheTag } from "@/lib/cache/publicCachePolicy";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
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

export type PublicMutationIdentity = Readonly<{
  restaurantId: string;
  restaurantSlug: string;
  restaurantKey: string;
  featuredExperienceId: RestaurantExperienceId | null;
  dishSlug: string;
}>;

export type PublicMutationRevalidationCallbacks = Readonly<{
  revalidateTag: (
    tag: string,
    profile: RevalidationTagProfile
  ) => void | Promise<void>;
  revalidatePath: (path: string) => void | Promise<void>;
}>;

export type PublicMutationInvalidationOptions = Readonly<{
  callbacks?: Partial<PublicMutationRevalidationCallbacks>;
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

function getString(row: Record<string, unknown> | null | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function resolvePublicMutationIdentity(args: {
  client: SupabaseClient;
  restaurantId: string;
  dishSlug?: string;
}): Promise<PublicMutationIdentity | null> {
  const restaurantId = args.restaurantId.trim();
  if (!restaurantId) return null;

  const restaurant = await args.client
    .from("restaurants")
    .select("slug,name")
    .eq("id", restaurantId)
    .maybeSingle();
  if (restaurant.error || !restaurant.data) return null;

  const restaurantSlug = slugifyRestaurantSlug(
    getString(restaurant.data, "slug") || getString(restaurant.data, "name")
  );
  if (!restaurantSlug) return null;

  return Object.freeze({
    restaurantId,
    restaurantSlug,
    restaurantKey: restaurantSlug,
    featuredExperienceId: isRestaurantExperienceId(restaurantSlug)
      ? restaurantSlug
      : null,
    dishSlug: slugifyRestaurantSlug(args.dishSlug ?? "")
  });
}

type RevalidationOperation = Readonly<{
  kind: "tag" | "path";
  run: () => void | Promise<void>;
}>;

function revalidatePublicMenuPath(restaurantSlug: string): void {
  revalidatePath(`/menu/${restaurantSlug}`);
}

function revalidatePublicDishPath(
  restaurantSlug: string,
  dishSlug: string
): void {
  revalidatePath(`/menu/${restaurantSlug}/dishes/${dishSlug}`);
}

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
    run: () =>
      options.callbacks?.revalidatePath
        ? schedulePath(`/menu/${identity.restaurantSlug}`)
        : revalidatePublicMenuPath(identity.restaurantSlug)
  });
  if (identity.dishSlug) {
    operations.push({
      kind: "path",
      run: () =>
        options.callbacks?.revalidatePath
          ? schedulePath(
              `/menu/${identity.restaurantSlug}/dishes/${identity.dishSlug}`
            )
          : revalidatePublicDishPath(
              identity.restaurantSlug,
              identity.dishSlug
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

  return Object.freeze({
    attempted: operations.length,
    queuedCallReturned,
    enqueueErrors: Object.freeze(enqueueErrors)
  });
}

export async function revalidateOwnerMenuMutationPaths(args: {
  client: SupabaseClient;
  restaurantId: string;
  dishSlug?: string;
}) {
  const identity = await resolvePublicMutationIdentity(args);
  return invalidateCommittedPublicMutation(identity);
}
