import type { MenuUiConfig } from "./menuUiConfig.ts";
import type { PublicMenu } from "./publicMenuCore.ts";
import type { PublicMenuStyle } from "./publicMenuSettings.ts";
import type { UniqueMenuDesign } from "./uniqueMenuDesign.ts";
import {
  getUniqueMenuRendererForDesign,
  type UniqueMenuRendererEntry
} from "./uniqueMenuRendererRegistry.ts";
import {
  getPublicMenuExperienceStyle,
  isMaisonElysePublicMenu,
  isTrouvablePublicMenu
} from "./trouvableMenuExperience.ts";

export type PublicMenuExperienceKind =
  | "maison-elyse"
  | "trouvable"
  | "unique-registered"
  | "generic";

export type ResolvedPublicMenuExperience = {
  kind: PublicMenuExperienceKind;
  style: PublicMenuStyle | null;
  uniqueDesign: UniqueMenuDesign | null;
  rendererKey: string | null;
  rendererVersion: number | null;
  useGenericFallback: boolean;
  ownerDiagnostic?: string;
  renderer: UniqueMenuRendererEntry | null;
};

type RouteMenuInput = Pick<
  PublicMenu,
  "slug" | "name" | "settings" | "publicMenuStyleExplicit"
>;

/**
 * Single source of truth for public menu + dish detail renderer selection.
 * Never route unique UIs by restaurant slug.
 */
export function resolvePublicMenuExperience(
  menu: RouteMenuInput,
  config: MenuUiConfig
): ResolvedPublicMenuExperience {
  if (isMaisonElysePublicMenu(menu)) {
    return {
      kind: "maison-elyse",
      style: "maison-elyse",
      uniqueDesign: null,
      rendererKey: null,
      rendererVersion: null,
      useGenericFallback: false,
      renderer: null
    };
  }

  if (isTrouvablePublicMenu(menu)) {
    return {
      kind: "trouvable",
      style: "trouvable",
      uniqueDesign: null,
      rendererKey: null,
      rendererVersion: null,
      useGenericFallback: false,
      renderer: null
    };
  }

  const style = getPublicMenuExperienceStyle(menu);
  if (style === "unique") {
    const design = config.uniqueDesign;
    const key = design?.rendererKey ?? null;
    const bound =
      design?.status === "published"
        ? getUniqueMenuRendererForDesign(design.designId, key)
        : null;

    if (bound) {
      const resolved: ResolvedPublicMenuExperience = {
        kind: "unique-registered",
        style: "unique",
        uniqueDesign: design,
        rendererKey: key,
        rendererVersion: design?.rendererVersion ?? bound.version,
        useGenericFallback: false,
        renderer: bound
      };
      // Defensive: never render unique-registered without a concrete renderer.
      if (!resolved.renderer) {
        return {
          kind: "generic",
          style: "unique",
          uniqueDesign: design,
          rendererKey: key,
          rendererVersion: design?.rendererVersion ?? null,
          useGenericFallback: true,
          ownerDiagnostic:
            "unique-registered resolved without renderer; falling back to generic.",
          renderer: null
        };
      }
      return resolved;
    }

    return {
      kind: "generic",
      style: "unique",
      uniqueDesign: design,
      rendererKey: key,
      rendererVersion: design?.rendererVersion ?? null,
      useGenericFallback: true,
      ownerDiagnostic:
        design?.status === "published" && key
          ? "Published unique design references an unbound or incomplete renderer."
          : undefined,
      renderer: null
    };
  }

  return {
    kind: "generic",
    style,
    uniqueDesign: null,
    rendererKey: null,
    rendererVersion: null,
    useGenericFallback: true,
    renderer: null
  };
}
