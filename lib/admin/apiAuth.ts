import "server-only";

import { NextResponse } from "next/server";
import {
  requireAdminRestaurantAccess,
  type AdminCapability,
  type AdminRestaurantAccessResult
} from "@/lib/admin/access";

type GrantedAdminApiAccess = Extract<AdminRestaurantAccessResult, { ok: true }>;

export type AdminApiAuthorization =
  | GrantedAdminApiAccess
  | { ok: false; response: NextResponse };

export async function requireAdminApiAccess(
  capability: AdminCapability
): Promise<AdminApiAuthorization> {
  const access = await requireAdminRestaurantAccess(capability);
  if (access.ok) return access;

  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, error: "Admin access required." },
      {
        status: access.reason === "capability" ? 403 : 401,
        headers: { "Cache-Control": "no-store" }
      }
    )
  };
}
