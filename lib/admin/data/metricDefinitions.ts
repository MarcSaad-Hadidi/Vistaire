import { ADMIN_METRIC_IDS, type AdminMetricId } from "./contracts.ts";
import type { AdminRendererId, AdminSignalId } from "./instrumentation.ts";

export type AdminMetricDefinition = Readonly<{
  id: AdminMetricId;
  definitionVersion: string;
  source: "production";
  unit: "count" | "ranking" | "series" | "ratio";
  measurement: "measured" | "unmeasured";
  signal?: AdminSignalId;
  requiredRenderers: readonly AdminRendererId[];
  minimumSample: number;
  audiences: readonly ("ui" | "export" | "mistral")[];
}>;

const unmeasured = new Set<AdminMetricId>([
  "active-sessions", "average-duration", "searches-without-results", "filter-usage", "funnel",
  "3d-success", "ar-success", "mobile-performance", "asset-errors"
]);
const signals: Partial<Record<AdminMetricId, AdminSignalId>> = {
  "observed-menu-opens": "menu_opened", "observed-dish-opens": "dish_opened",
  "observed-immersive-intents": "dish_3d_clicked", "observed-ar-intents": "dish_ar_clicked",
  "private-search-ranking": "search_used"
};

export const ADMIN_METRIC_DEFINITIONS: readonly AdminMetricDefinition[] = ADMIN_METRIC_IDS.map((id) => ({
  id,
  definitionVersion: "admin-vnext-observed-v1",
  source: "production",
  unit: id.includes("ranking") ? "ranking" : id.includes("series") || id === "time-distribution" ? "series" : "count",
  measurement: unmeasured.has(id) ? "unmeasured" : "measured",
  ...(signals[id] ? { signal: signals[id] } : {}),
  requiredRenderers: signals[id] ? ["public-menu", "maison-elyse", "trouvable"] : [],
  minimumSample: id.includes("ranking") ? 3 : 0,
  audiences: ["ui", "export", "mistral"]
}));

export function getAdminMetricDefinition(id: AdminMetricId): AdminMetricDefinition {
  const definition = ADMIN_METRIC_DEFINITIONS.find((item) => item.id === id);
  if (!definition) throw new Error("Unknown admin metric.");
  return definition;
}
