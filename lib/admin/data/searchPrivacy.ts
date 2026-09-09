import type { AdminMetricState, AdminPeriodBounds } from "./contracts.ts";
import { classifyAnalyticsSearchTerm } from "../../analytics/searchPrivacyCore.mjs";

export type SearchTermEvidence = Readonly<{ term: string; count: number }>;
export type SearchTermComparisonEvidence = Readonly<{
  term: string;
  count: number;
  previousCount: number | null;
  changeRate: number | null;
}>;
export type AdminAnalyticsEvent = Readonly<{
  eventName?: string;
  event_name?: string;
  searchQuery?: string;
  search_query?: string;
  sessionId?: string;
  session_id?: string;
  createdAt?: string;
  created_at?: string;
}>;

export function aggregatePrivateSearchPeriod(input: {
  events: readonly AdminAnalyticsEvent[];
  bounds: AdminPeriodBounds;
  minimumDistinctSessions: 3;
  audience: "ui" | "export" | "mistral";
}): AdminMetricState<readonly SearchTermEvidence[]> {
  if (input.minimumDistinctSessions < 3) {
    throw new Error("Search privacy requires a minimum k=3 threshold.");
  }
  const from = Date.parse(input.bounds.from);
  const to = Date.parse(input.bounds.to);
  const groups = new Map<string, { count: number; sessions: Set<string> }>();
  for (const event of input.events) {
    if ((event.eventName ?? event.event_name) !== "search_used") continue;
    const createdAt = Date.parse(event.createdAt ?? event.created_at ?? "");
    if (!Number.isFinite(createdAt) || createdAt < from || createdAt >= to) continue;
    const classification = classifyAnalyticsSearchTerm(event.searchQuery ?? event.search_query);
    if (classification.kind !== "safe" || (input.audience === "mistral" && classification.promptUnsafe)) continue;
    const session = event.sessionId ?? event.session_id;
    if (!session) continue;
    const group = groups.get(classification.term) ?? { count: 0, sessions: new Set<string>() };
    group.count += 1;
    group.sessions.add(session);
    groups.set(classification.term, group);
  }
  const admitted = [...groups.entries()]
    .filter(([, group]) => group.sessions.size >= input.minimumDistinctSessions)
    .map(([term, group]) => ({ term, count: group.count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
  return admitted.length > 0
    ? { kind: "available", value: admitted }
    : { kind: "insufficient", reason: "privacy-threshold" };
}

export function comparePrivateSearchPeriods(input: {
  current: AdminMetricState<readonly SearchTermEvidence[]>;
  previous: AdminMetricState<readonly SearchTermEvidence[]>;
}): AdminMetricState<readonly SearchTermComparisonEvidence[]> {
  if (input.current.kind !== "available") return input.current;
  const previous = input.previous.kind === "available"
    ? new Map(input.previous.value.map((item) => [item.term, item.count]))
    : null;
  return {
    kind: "available",
    value: input.current.value.map((item) => {
      const previousCount = previous?.get(item.term) ?? null;
      return {
        ...item,
        previousCount,
        changeRate: previousCount === null || previousCount === 0 ? null : (item.count - previousCount) / previousCount
      };
    })
  };
}
