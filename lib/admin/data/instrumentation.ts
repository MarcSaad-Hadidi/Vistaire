import type { AdminPeriodBounds } from "./contracts.ts";

export const ADMIN_INSTRUMENTATION_VERSION = "admin-vnext-observed-v1";
export type AdminRendererId = "public-menu" | "maison-elyse" | "trouvable";
export type AdminSignalId = "menu_opened" | "category_viewed" | "dish_opened" | "dish_3d_clicked" | "dish_ar_clicked" | "search_used";
export type AdminInstrumentationCoverage = Readonly<{
  version: string;
  renderer: AdminRendererId;
  source: "production";
  coverageStartAt: string | null;
  coverageEndAt: string | null;
  proof: { kind: "verified-deployment"; deploymentId: string } | { kind: "unverified" };
  signals: Readonly<Partial<Record<AdminSignalId, "covered" | "partial" | "absent">>>;
}>;

export const ADMIN_INSTRUMENTATION_LIMITS = Object.freeze({
  sameOrigin: "enforced-v1",
  entityMembership: "enforced-v1",
  instrumentationVersion: "enforced-v1",
  rateLimit: "not-enforced-distributed",
  idempotence: "client-dedupe-only-not-durable",
  clientAuthenticity: "public-client-not-attested"
} as const);

export function coversEntirePeriod(
  coverage: AdminInstrumentationCoverage,
  bounds: AdminPeriodBounds,
  signal?: AdminSignalId
): boolean {
  if (coverage.source !== "production" || coverage.version !== ADMIN_INSTRUMENTATION_VERSION) return false;
  if (coverage.proof.kind !== "verified-deployment" || !coverage.proof.deploymentId) return false;
  if (!coverage.coverageStartAt || !coverage.coverageEndAt) return false;
  const from = Date.parse(bounds.from);
  const to = Date.parse(bounds.to);
  const start = Date.parse(coverage.coverageStartAt);
  const end = Date.parse(coverage.coverageEndAt);
  if (![from, to, start, end].every(Number.isFinite) || from >= to || start > from || end < to) return false;
  return signal ? coverage.signals[signal] === "covered" : Object.values(coverage.signals).some((value) => value === "covered");
}
