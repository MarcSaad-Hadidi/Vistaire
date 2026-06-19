import type { OwnerRestaurantStatus } from "@/lib/owner/types";

type SupabaseUpdateError = {
  code?: string;
  message?: string;
};

type SupabaseRestaurantStatusClient = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): PromiseLike<{
          data: Record<string, unknown> | null;
          error: SupabaseUpdateError | null;
        }>;
      };
    };
    update(row: Record<string, unknown>): {
      eq(column: string, value: string): {
        select(columns: string): {
          single(): PromiseLike<{
            data: Record<string, unknown> | null;
            error: SupabaseUpdateError | null;
          }>;
        };
      };
    };
    delete(): {
      eq(column: string, value: string): PromiseLike<{
        data: Record<string, unknown>[] | null;
        error: SupabaseUpdateError | null;
      }>;
    };
  };
};

type SupabaseAdminResult =
  | { ok: true; client: SupabaseRestaurantStatusClient }
  | { ok: false; reason: string };

type RestaurantStatusAction = "archive" | "restore";

const DEMO_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ??
  "11111111-1111-1111-1111-111111111111";

type RestaurantStatusDependencies = {
  admin: SupabaseAdminResult;
};

export type UpdateRestaurantStatusResult =
  | {
      ok: true;
      restaurantId: string;
      status: OwnerRestaurantStatus;
    }
  | {
      ok: false;
      error: string;
      status: 400 | 404 | 503;
    };

export type DeleteRestaurantResult =
  | {
      ok: true;
      restaurantId: string;
      deleted: true;
    }
  | {
      ok: false;
      error: string;
      status: 400 | 403 | 404 | 503;
    };

export function validateRestaurantStatusAction(
  input: unknown
):
  | { ok: true; action: RestaurantStatusAction; status: OwnerRestaurantStatus }
  | { ok: false; error: string } {
  const action =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>).action
      : undefined;

  if (action === "archive") {
    return { ok: true, action, status: "archived" };
  }

  if (action === "restore") {
    return { ok: true, action, status: "setup_needed" };
  }

  return { ok: false, error: "Action restaurant non supportee." };
}

export async function updateRestaurantStatusRecord(
  restaurantId: string,
  action: RestaurantStatusAction,
  dependencies: RestaurantStatusDependencies
): Promise<UpdateRestaurantStatusResult> {
  const safeId = restaurantId.trim();
  if (!safeId) {
    return { ok: false, status: 400, error: "Restaurant requis." };
  }

  if (!dependencies.admin.ok) {
    return {
      ok: false,
      status: 503,
      error:
        "Archivage impossible : Supabase n'est pas configure pour persister les restaurants."
    };
  }

  const nextStatus: OwnerRestaurantStatus =
    action === "archive" ? "archived" : "setup_needed";
  const { data, error } = await dependencies.admin.client
    .from("restaurants")
    .update({ status: nextStatus })
    .eq("id", safeId)
    .select("id,status")
    .single();

  if (error) {
    return {
      ok: false,
      status: error.code === "PGRST116" ? 404 : 503,
      error:
        error.code === "PGRST116"
          ? "Restaurant introuvable."
          : "Le statut du restaurant n'a pas pu etre mis a jour dans Supabase."
    };
  }

  if (!data) {
    return { ok: false, status: 404, error: "Restaurant introuvable." };
  }

  return {
    ok: true,
    restaurantId: String(data.id ?? safeId),
    status: nextStatus
  };
}

function getString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

function isProtectedDemoRestaurant(row: Record<string, unknown>): boolean {
  const id = getString(row, "id");
  const slug = getString(row, "slug").toLowerCase();
  const status = getString(row, "status");
  return id === DEMO_RESTAURANT_ID || slug === "maison-elyse" || status === "demo";
}

async function deleteRestaurantScopedRows(args: {
  client: SupabaseRestaurantStatusClient;
  table: string;
  column: string;
  value: string;
}): Promise<SupabaseUpdateError | null> {
  const { error } = await args.client
    .from(args.table)
    .delete()
    .eq(args.column, args.value);
  return error;
}

export async function deleteRestaurantRecord(
  restaurantId: string,
  confirmation: { confirmed?: boolean; confirmName?: string },
  dependencies: RestaurantStatusDependencies
): Promise<DeleteRestaurantResult> {
  const safeId = restaurantId.trim();
  if (!safeId) {
    return { ok: false, status: 400, error: "Restaurant requis." };
  }

  if (!confirmation.confirmed || !confirmation.confirmName?.trim()) {
    return {
      ok: false,
      status: 400,
      error: "Confirmation de suppression requise."
    };
  }

  if (!dependencies.admin.ok) {
    return {
      ok: false,
      status: 503,
      error:
        "Suppression impossible : Supabase n'est pas configure pour persister les restaurants."
    };
  }

  const { data: restaurant, error: lookupError } = await dependencies.admin.client
    .from("restaurants")
    .select("id,name,slug,status")
    .eq("id", safeId)
    .single();

  if (lookupError) {
    return {
      ok: false,
      status: lookupError.code === "PGRST116" ? 404 : 503,
      error:
        lookupError.code === "PGRST116"
          ? "Restaurant introuvable."
          : "Le restaurant n'a pas pu etre verifie dans Supabase."
    };
  }

  if (!restaurant) {
    return { ok: false, status: 404, error: "Restaurant introuvable." };
  }

  if (isProtectedDemoRestaurant(restaurant)) {
    return {
      ok: false,
      status: 403,
      error: "Restaurant de demonstration protege contre la suppression."
    };
  }

  const restaurantName = getString(restaurant, "name");
  if (confirmation.confirmName.trim() !== restaurantName) {
    return {
      ok: false,
      status: 400,
      error: "Le nom de confirmation ne correspond pas au restaurant."
    };
  }

  const restaurantSlug = getString(restaurant, "slug");
  const cleanupErrors = [
    await deleteRestaurantScopedRows({
      client: dependencies.admin.client,
      table: "qr_codes",
      column: "restaurant_id",
      value: safeId
    }),
    await deleteRestaurantScopedRows({
      client: dependencies.admin.client,
      table: "menu_dishes",
      column: "restaurant_id",
      value: safeId
    }),
    restaurantSlug
      ? await deleteRestaurantScopedRows({
          client: dependencies.admin.client,
          table: "menu_dishes",
          column: "restaurant_slug",
          value: restaurantSlug
        })
      : null,
    await deleteRestaurantScopedRows({
      client: dependencies.admin.client,
      table: "menu_ui_configs",
      column: "restaurant_id",
      value: safeId
    })
  ].filter(Boolean);

  if (cleanupErrors.length > 0) {
    return {
      ok: false,
      status: 503,
      error:
        "Les donnees rattachees au restaurant n'ont pas pu etre nettoyees dans Supabase."
    };
  }

  const { error: deleteError } = await dependencies.admin.client
    .from("restaurants")
    .delete()
    .eq("id", safeId);

  if (deleteError) {
    return {
      ok: false,
      status: 503,
      error: "Le restaurant n'a pas pu etre supprime dans Supabase."
    };
  }

  return {
    ok: true,
    restaurantId: safeId,
    deleted: true
  };
}
