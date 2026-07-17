import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateSupabaseProjectIdentity } from "./projectIdentity";

type SupabaseAdminClientResult =
  | { ok: true; client: SupabaseClient }
  | { ok: false; reason: string };

export function getSupabaseAdminClient(): SupabaseAdminClientResult {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      reason:
        "Supabase server credentials are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    };
  }

  const projectIdentity = validateSupabaseProjectIdentity({
    supabaseUrl,
    expectedProjectRef: process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF
  });
  if (!projectIdentity.ok) {
    return { ok: false, reason: projectIdentity.reason };
  }

  return {
    ok: true,
    client: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          "X-Client-Info": "vistaire-owner-analytics"
        }
      }
    })
  };
}
