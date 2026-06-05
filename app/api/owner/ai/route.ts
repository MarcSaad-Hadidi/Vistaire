import { NextResponse } from "next/server";
import { requireVistaireOwnerApi } from "@/lib/auth/ownerApi";
import { getOwnerDashboardData } from "@/lib/owner/data";
import { buildOwnerAiPriorities } from "@/lib/owner/ai/rules";
import type { OwnerAiResult } from "@/lib/owner/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner copilot. Context is rebuilt server-side from the authenticated owner's
 * dashboard data — no client-provided payload is trusted, and no private
 * contact data is ever included. The copilot proposes only; it never mutates,
 * publishes, or changes a QR token.
 */
export async function POST() {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const data = await getOwnerDashboardData({ includeAiRecommendations: true });
  const priorities = buildOwnerAiPriorities(data.restaurants);

  const result: OwnerAiResult = {
    priorities,
    recommendations: data.recommendations,
    prioritySource: "rules",
    recommendationSource: data.recommendationSource,
    note:
      data.recommendationSource === "mistral"
        ? "Priorités déterministes + recommandations enrichies par Mistral."
        : "Priorités déterministes (copilote rules). Mistral indisponible ou non configuré."
  };

  return NextResponse.json({ ok: true, result });
}
