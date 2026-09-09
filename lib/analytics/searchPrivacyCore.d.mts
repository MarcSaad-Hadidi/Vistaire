export type SearchTermClassification =
  | { kind: "safe"; term: string; promptUnsafe: boolean }
  | { kind: "rejected"; reason: "invalid" | "empty" | "pii" };
export function classifyAnalyticsSearchTerm(input: unknown): SearchTermClassification;
