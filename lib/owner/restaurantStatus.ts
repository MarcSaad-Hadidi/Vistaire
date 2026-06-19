import type { OwnerRestaurantStatus } from "@/lib/owner/types";

type SupabaseUpdateError = {
  code?: string;
  message?: string;
};

type SupabaseRestaurantStatusClient = {
  from(table: string): {
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
  };
};

type SupabaseAdminResult =
  | { ok: true; client: SupabaseRestaurantStatusClient }
  | { ok: false; reason: string };

type RestaurantStatusAction = "archive" | "restore";

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
