import type { MenuUiConfigRecord } from "./menuUiConfig.ts";
import type { ResolvedPublicMenuExperience } from "./publicMenuExperienceRoute.ts";

export type StablePublicMenuUiConfigReadiness =
  | { ready: true; source: "published" | "canonical-built-in" }
  | { ready: false; source: "unavailable" };

export type StablePublicMenuUiConfigReadState =
  | "published"
  | "not-found"
  | "unavailable";

type StablePublicMenuUiConfigInput = {
  configRecord: Pick<
    MenuUiConfigRecord,
    "dataSource" | "persisted" | "status"
  >;
  experienceKind: ResolvedPublicMenuExperience["kind"];
  readState: StablePublicMenuUiConfigReadState;
};

/**
 * Decides whether the effective public UI configuration is deterministic enough
 * to be cached by the landing preview.
 *
 * Published Supabase configs are authoritative only when the exact published
 * lookup succeeded. Maison Élyse and Trouvable are built-in experiences whose
 * public routes intentionally fall back to a deterministic code-owned config
 * when a successful lookup confirms that no published row exists; that same
 * public fallback is safe for the landing cache. Read failures and draft rows
 * are never accepted here, and unique renderers still require an explicit
 * published configuration.
 */
export function resolveStablePublicMenuUiConfigReadiness({
  configRecord,
  experienceKind,
  readState
}: StablePublicMenuUiConfigInput): StablePublicMenuUiConfigReadiness {
  const isPublished =
    readState === "published" &&
    configRecord.persisted &&
    configRecord.dataSource === "supabase" &&
    configRecord.status === "published";

  if (isPublished) {
    return { ready: true, source: "published" };
  }

  const isCanonicalBuiltIn =
    readState === "not-found" &&
    !configRecord.persisted &&
    configRecord.dataSource === "default" &&
    (experienceKind === "maison-elyse" || experienceKind === "trouvable");

  if (isCanonicalBuiltIn) {
    return { ready: true, source: "canonical-built-in" };
  }

  return { ready: false, source: "unavailable" };
}
