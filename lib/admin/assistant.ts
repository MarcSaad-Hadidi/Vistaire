import type { AdminRestaurantAccessResult } from "./accessCore.ts";
import type { AdminMetricId, AdminRange } from "./data/contracts.ts";
import {
  projectEvidenceForAudience,
  type AdminEvidenceBundle
} from "./data/evidenceRegistry.ts";
import type { AssistantAnswer, AssistantClaim } from "./assistant/contracts.ts";
import { renderAssistantClaims } from "./assistant/renderClaims.ts";
import { buildRuleBasedAssistantClaims } from "./assistant/rulesFallback.ts";
import type { AdminAssistantQuotaResult } from "./assistant/rateLimit.ts";
import { isAdminAssistantQuestionInScope } from "./recommendations.ts";
import { classifyAnalyticsSearchTerm } from "../analytics/searchPrivacyCore.mjs";

export type AdminAssistantMode = "summary" | "question";
export type AdminAssistantLocale = "fr" | "en";

type GrantedAdminAccess = Extract<AdminRestaurantAccessResult, { ok: true }>;
type BundleLoadResult =
  | Readonly<{ ok: true; bundle: AdminEvidenceBundle }>
  | Readonly<{ ok: false; error: unknown }>;

export type AdminAssistantPipelineResult = Readonly<{
  answer: AssistantAnswer;
  status:
    | "ok"
    | "blocked"
    | "insufficient"
    | "quota-denied"
    | "quota-unavailable"
    | "model-unavailable";
}>;

export type AdminAssistantDependencies = Readonly<{
  loadBundle: (access: GrantedAdminAccess, range: AdminRange) => Promise<BundleLoadResult>;
  consumeQuota: (input: { restaurantId: string }) => Promise<AdminAssistantQuotaResult>;
  generateClaims: (input: {
    locale: AdminAssistantLocale;
    question: string;
    evidence: ReturnType<typeof projectEvidenceForAudience>;
  }) => Promise<readonly AssistantClaim[] | null>;
}>;

const MAX_QUESTION_LENGTH = 220;

export type AdminAssistantIntent =
  | "overview"
  | "menu-activity"
  | "dish-performance"
  | "search-demand"
  | "category-performance"
  | "immersive-engagement"
  | "availability"
  | "conversion"
  | "mobile-quality";

const INTENT_METRICS: Readonly<Record<Exclude<AdminAssistantIntent, "overview">, readonly AdminMetricId[]>> = {
  "menu-activity": ["observed-menu-opens", "observed-sessions", "active-sessions", "average-duration", "activity-series", "time-distribution"],
  "dish-performance": ["catalog-dishes", "observed-dish-opens", "dish-ranking"],
  "search-demand": ["private-search-ranking", "searches-without-results", "filter-usage"],
  "category-performance": ["category-ranking"],
  "immersive-engagement": ["catalog-immersive-assets", "observed-immersive-intents", "observed-ar-intents", "3d-success", "ar-success"],
  availability: ["catalog-dishes"],
  conversion: ["funnel", "observed-menu-opens", "observed-dish-opens"],
  "mobile-quality": ["catalog-photos", "mobile-performance", "asset-errors"]
};

type AssistantRuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export function isAdminAssistantRuntimeEnabled(
  environment: AssistantRuntimeEnvironment = process.env
): boolean {
  return environment.VISTAIRE_ADMIN_ASSISTANT_ENABLED === "1" ||
    (environment.NODE_ENV !== "production" && environment.VISTAIRE_ADMIN_VISUAL_FIXTURE === "1");
}

export function containsLikelyPersonalData(value: string): boolean {
  const sharedClassification = classifyAnalyticsSearchTerm(value);
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phone = /(?:\+?\d[\s().-]*){8,}/;
  const address = /\b\d{1,5}\s+(?:rue|avenue|boulevard|chemin|route|place|impasse|street|road|avenue|boulevard)\b/i;
  const namedGuest = /\b(?:client|convive|guest|monsieur|madame|m|mme)\s+[\p{Lu}][\p{L}'’.\-]+(?:\s+[\p{Lu}][\p{L}'’.\-]+)?/u;
  return sharedClassification.kind === "rejected" && sharedClassification.reason === "pii" ||
    email.test(value) || phone.test(value) || address.test(value) || namedGuest.test(value);
}

function normalizeQuestion(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_LENGTH);
}

export function classifyAdminAssistantIntent(question: string): AdminAssistantIntent {
  const normalized = normalizeQuestion(question).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (/\b(?:indisponib|disponib|rupture|stock|available|unavailable)\w*/.test(normalized)) return "availability";
  if (/\b(?:recherch|search|filtr|sans resultat|no result)\w*/.test(normalized)) return "search-demand";
  if (/\b(?:categor|categorie|category|categories)\w*/.test(normalized)) return "category-performance";
  if (/\b(?:3d|ar|immers|realite augmentee|augmented reality)\w*/.test(normalized)) return "immersive-engagement";
  if (/\b(?:conversion|funnel|choix final|final choice)\w*/.test(normalized)) return "conversion";
  if (/\b(?:mobile|photo|asset|qualite|quality|chargement|loading)\w*/.test(normalized)) return "mobile-quality";
  if (/\b(?:plat|plats|dish|dishes|consult|favori|favorite|populaire|popular)\w*/.test(normalized)) return "dish-performance";
  if (/\b(?:menu|activit|session|service|ouverture|open|heure|hour|moment)\w*/.test(normalized)) return "menu-activity";
  return "overview";
}

function projectEvidenceForIntent(bundle: AdminEvidenceBundle, intent: AdminAssistantIntent) {
  const projection = projectEvidenceForAudience(bundle, "mistral");
  if (intent === "overview") return projection;
  const admitted = new Set<AdminMetricId>(INTENT_METRICS[intent]);
  return {
    records: Object.fromEntries(
      Object.entries(projection.records).filter(([, record]) => admitted.has(record.metricId))
    )
  };
}

export function validateAdminAssistantRequest(input: unknown):
  | Readonly<{
      ok: true;
      mode: AdminAssistantMode;
      locale: AdminAssistantLocale;
      range: AdminRange;
      question: string;
    }>
  | Readonly<{ ok: false; error: string }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Question invalide." };
  }
  const candidate = input as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !["mode", "locale", "range", "question"].includes(key))) {
    return { ok: false, error: "Question invalide." };
  }
  if (candidate.mode !== "summary" && candidate.mode !== "question") {
    return { ok: false, error: "Question invalide." };
  }
  if (candidate.locale !== undefined && candidate.locale !== "fr" && candidate.locale !== "en") {
    return { ok: false, error: "Langue invalide." };
  }
  if (candidate.range !== undefined && candidate.range !== "today" && candidate.range !== "7d" && candidate.range !== "30d") {
    return { ok: false, error: "Période invalide." };
  }
  const question = normalizeQuestion(candidate.question);
  if (candidate.mode === "question" && !question) {
    return { ok: false, error: "Posez une question courte sur l’activité du menu." };
  }
  return {
    ok: true,
    mode: candidate.mode,
    locale: candidate.locale === "en" ? "en" : "fr",
    range: candidate.range === "7d" || candidate.range === "30d" ? candidate.range : "today",
    question
  };
}

function ruleAnswer(
  locale: AdminAssistantLocale,
  bundle: AdminEvidenceBundle
): AssistantAnswer {
  return renderAssistantClaims({
    locale,
    bundle,
    claims: buildRuleBasedAssistantClaims(bundle),
    source: "rules"
  });
}

export async function getAdminAssistantAnswerWithDependencies(
  input: {
    access: GrantedAdminAccess;
    range: AdminRange;
    mode: AdminAssistantMode;
    locale: AdminAssistantLocale;
    question?: string;
  },
  dependencies: AdminAssistantDependencies
): Promise<AdminAssistantPipelineResult | null> {
  const loaded = await dependencies.loadBundle(input.access, input.range);
  if (!loaded.ok) return null;

  const fallback = ruleAnswer(input.locale, loaded.bundle);
  if (fallback.blocks.length === 0) {
    return { answer: fallback, status: "insufficient" };
  }

  const question = normalizeQuestion(input.question);
  if (
    input.mode === "question" &&
    (!isAdminAssistantQuestionInScope(question) || containsLikelyPersonalData(question))
  ) {
    return { answer: fallback, status: "blocked" };
  }

  const quota = await dependencies.consumeQuota({
    restaurantId: input.access.restaurantId
  });
  if (quota.state !== "allowed") {
    return {
      answer: fallback,
      status: quota.state === "denied" ? "quota-denied" : "quota-unavailable"
    };
  }

  const intent = input.mode === "question" ? classifyAdminAssistantIntent(question) : "overview";
  const claims = await dependencies.generateClaims({
    locale: input.locale,
    question: `intent:${intent}`,
    evidence: projectEvidenceForIntent(loaded.bundle, intent)
  });
  if (!claims || claims.length === 0) return { answer: fallback, status: "model-unavailable" };

  try {
    return {
      answer: renderAssistantClaims({
        locale: input.locale,
        bundle: loaded.bundle,
        claims,
        source: "mistral"
      }),
      status: "ok"
    };
  } catch {
    return { answer: fallback, status: "model-unavailable" };
  }
}

export async function getAdminAssistantAnswer(input: {
  access: GrantedAdminAccess;
  range?: AdminRange;
  mode: AdminAssistantMode;
  locale: AdminAssistantLocale;
  question?: string;
}): Promise<AdminAssistantPipelineResult | null> {
  const [data, quota, mistral] = await Promise.all([
    import("./data/loadAdminData.ts"),
    import("./assistant/rateLimit.ts"),
    import("./assistant/mistralClaims.ts")
  ]);
  return getAdminAssistantAnswerWithDependencies(
    { ...input, range: input.range ?? "today" },
    {
      loadBundle: data.loadAdminDataBundle,
      consumeQuota: quota.consumeAdminAssistantQuota,
      generateClaims: mistral.generateMistralAdminClaims
    }
  );
}
