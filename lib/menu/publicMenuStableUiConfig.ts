import type { MenuUiConfigRecord } from "./menuUiConfig.ts";
import type { ResolvedPublicMenuExperience } from "./publicMenuExperienceRoute.ts";

export type StablePublicMenuUiConfigReadiness =
  | { ready: true; source: "published" | "canonical-built-in" }
  | { ready: false; source: "unavailable" };

type StablePublicMenuUiConfigInput = {
  configRecord: Pick<
    MenuUiConfigRecord,
    "dataSource" | "persisted" | "status"
  >;
  experienceKind: ResolvedPublicMenuExperience["kind"];
};

/**
 * Decides whether the effective public UI configuration is deterministic enough
 * to be cached by the landing preview.
 *
 * Published Supabase configs are always authoritative. Maison Élyse and
 * Trouvable are built-in experiences whose public routes intentionally fall
 * back to a deterministic code-owned config when no published row exists; that
 * same public fallback is safe for the landing cache. Draft rows are never
 * accepted here, and unique renderers still require an explicit published
 * configuration.
 */
export function resolveStablePublicMenuUiConfigReadiness({
  configRecord,
  experienceKind
}: StablePublicMenuUiConfigInput): StablePublicMenuUiConfigReadiness {
  const isPublished =
    configRecord.persisted &&
    configRecord.dataSource === "supabase" &&
    configRecord.status === "published";

  if (isPublished) {
    return { ready: true, source: "published" };
  }

  const isCanonicalBuiltIn =
    !configRecord.persisted &&
    configRecord.dataSource === "default" &&
    (experienceKind === "maison-elyse" || experienceKind === "trouvable");

  if (isCanonicalBuiltIn) {
    return { ready: true, source: "canonical-built-in" };
  }

  return { ready: false, source: "unavailable" };
}
