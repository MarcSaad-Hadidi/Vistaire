type AnalyticsCountResult = {
  ok: boolean;
  error?: string;
  count: number | null;
};

type AnalyticsCountQuery = PromiseLike<{
  count: number | null;
  error: { message?: string } | null;
}> & {
  eq: (column: string, value: string) => AnalyticsCountQuery;
  gte: (column: string, value: string) => AnalyticsCountQuery;
};

type AnalyticsCountClient = {
  from: (table: "analytics_events") => {
    select: (
      columns: string,
      options: { count: "exact"; head: true }
    ) => AnalyticsCountQuery;
  };
};

type UsageAuditTargetInput = {
  supabaseUrl: string;
  expectedProjectRef: string | undefined;
  auditTarget: string | undefined;
  allowProductionRead: boolean;
};

type UsageAuditTargetResult =
  | {
      ok: true;
      projectRef: string;
      hosted: boolean;
      productionRead: boolean;
    }
  | { ok: false; error: string };

export function validateSupabaseUsageAuditTarget(
  input: UsageAuditTargetInput
): UsageAuditTargetResult {
  let parsed: URL;
  let hostname: string;
  try {
    parsed = new URL(input.supabaseUrl);
    hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  } catch {
    return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL is invalid." };
  }
  const local =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    return {
      ok: false,
      error: "Supabase audit targets must use HTTPS, except local fixtures."
    };
  }
  const hosted = hostname.endsWith(".supabase.co");
  if (!hosted && !local) {
    return {
      ok: false,
      error: "Remote Supabase targets must use a verifiable <project-ref>.supabase.co host."
    };
  }
  const projectRef = hosted
    ? hostname.slice(0, -".supabase.co".length)
    : hostname;
  const expectedProjectRef = input.expectedProjectRef?.trim().toLowerCase() ?? "";
  if (hosted && !expectedProjectRef) {
    return {
      ok: false,
      error: "Expected Supabase project ref is required for hosted targets."
    };
  }
  if (expectedProjectRef && expectedProjectRef !== projectRef) {
    return {
      ok: false,
      error: "Configured project ref is different from the Supabase target."
    };
  }
  const productionRead = input.auditTarget === "production" || hosted;
  if (productionRead && !input.allowProductionRead) {
    return {
      ok: false,
      error: "Target matches the configured production project; add --allow-production-read for a read-only audit."
    };
  }
  return { ok: true, projectRef, hosted, productionRead };
}

async function countAnalytics(
  client: AnalyticsCountClient,
  options: { source?: string; fromIso?: string } = {}
): Promise<AnalyticsCountResult> {
  let query = client
    .from("analytics_events")
    .select("id", { count: "exact", head: true });
  if (options.source) query = query.eq("source", options.source);
  if (options.fromIso) query = query.gte("created_at", options.fromIso);
  const { count, error } = await query;
  if (error) return { ok: false, error: error.message, count: null };
  return { ok: true, count: count ?? 0 };
}

async function analyticsWindowCounts(
  client: AnalyticsCountClient,
  now: Date,
  source?: string
) {
  const nowMs = now.getTime();
  return {
    total: await countAnalytics(client, { source }),
    last24h: await countAnalytics(client, {
      source,
      fromIso: new Date(nowMs - 86_400_000).toISOString()
    }),
    last7d: await countAnalytics(client, {
      source,
      fromIso: new Date(nowMs - 7 * 86_400_000).toISOString()
    }),
    last30d: await countAnalytics(client, {
      source,
      fromIso: new Date(nowMs - 30 * 86_400_000).toISOString()
    })
  };
}

export async function buildAnalyticsCounts(
  client: AnalyticsCountClient,
  now: Date = new Date()
) {
  return {
    all: await analyticsWindowCounts(client, now),
    production: await analyticsWindowCounts(client, now, "production")
  };
}
