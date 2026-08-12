export type AdminAssistantQuotaResult =
  | Readonly<{ state: "allowed"; remaining: number; resetAt: string }>
  | Readonly<{ state: "denied"; remaining: 0; resetAt: string }>
  | Readonly<{ state: "unavailable" }>
  | Readonly<{ state: "error" }>;

type QuotaRpcRow = Readonly<{
  allowed: unknown;
  remaining: unknown;
  reset_at: unknown;
}>;

type QuotaTransport = (input: {
  restaurantId: string;
}) => Promise<Readonly<{ data: unknown; error: unknown }>>;

function parseQuotaRow(input: unknown): AdminAssistantQuotaResult | null {
  const candidate = Array.isArray(input) ? input[0] : input;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const row = candidate as QuotaRpcRow;
  if (
    typeof row.allowed !== "boolean" ||
    typeof row.remaining !== "number" ||
    !Number.isInteger(row.remaining) ||
    row.remaining < 0 ||
    typeof row.reset_at !== "string" ||
    !Number.isFinite(Date.parse(row.reset_at))
  ) {
    return null;
  }
  if (!row.allowed && row.remaining !== 0) return null;
  return row.allowed
    ? { state: "allowed", remaining: row.remaining, resetAt: row.reset_at }
    : { state: "denied", remaining: 0, resetAt: row.reset_at };
}

export async function consumeAdminAssistantQuotaWithDependencies(
  input: { restaurantId: string },
  dependencies: { transport: QuotaTransport }
): Promise<AdminAssistantQuotaResult> {
  if (!input.restaurantId.trim()) return { state: "error" };
  try {
    const result = await dependencies.transport({
      restaurantId: input.restaurantId
    });
    if (result.error) return { state: "error" };
    return parseQuotaRow(result.data) ?? { state: "error" };
  } catch {
    return { state: "error" };
  }
}

export async function consumeAdminAssistantQuota(input: {
  restaurantId: string;
}): Promise<AdminAssistantQuotaResult> {
  const { getSupabaseAdminClient } = await import("../../../utils/supabase/admin.ts");
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return { state: "unavailable" };
  return consumeAdminAssistantQuotaWithDependencies(input, {
    transport: async ({ restaurantId }) =>
      admin.client.rpc("consume_admin_assistant_quota", {
        p_restaurant_id: restaurantId
      })
  });
}
