import "server-only";

import { createHmac } from "node:crypto";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export type FaqQuotaResult = "allowed" | "rate_limited" | "budget_exhausted" | "unavailable";

function limitFromEnv(name: string, fallback: number, max: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}

// Shared across serverless instances through one atomic Postgres function.
// Fails closed: no quota backend means no paid Mistral call.
export async function consumeFaqQuota(clientIp: string): Promise<FaqQuotaResult> {
  const admin = getSupabaseAdminClient();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!admin.ok || !secret) return "unavailable";

  // Keyed hash: the raw IP is never stored or sent to the database.
  const clientKey = createHmac("sha256", secret).update(`faq:${clientIp}`).digest("hex").slice(0, 32);

  try {
    const { data, error } = await admin.client.rpc("consume_public_faq_quota", {
      p_client_key: clientKey,
      p_burst_limit: limitFromEnv("VISTAIRE_FAQ_BURST_LIMIT", 4, 30),
      p_burst_window_seconds: 60,
      p_daily_limit: limitFromEnv("VISTAIRE_FAQ_DAILY_LIMIT", 25, 500),
      p_global_daily_limit: limitFromEnv("VISTAIRE_FAQ_GLOBAL_DAILY_LIMIT", 600, 20_000)
    });
    if (error) {
      console.error("[Vistaire FAQ] quota unavailable", error.code ?? "unknown");
      return "unavailable";
    }
    return data === "allowed" || data === "rate_limited" || data === "budget_exhausted" ? data : "unavailable";
  } catch {
    console.error("[Vistaire FAQ] quota unavailable", "exception");
    return "unavailable";
  }
}
