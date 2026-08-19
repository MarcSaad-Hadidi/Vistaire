import "server-only";

import {
  resolvePublicMenuRenderContext as resolvePublicMenuRenderContextDelegate
} from "@/lib/menu/publicMenuRenderContext";
import type {
  PublicMenuRenderContext,
  PublicMenuRenderQuery
} from "@/lib/menu/publicMenuRenderContext";

export type { PublicMenuRenderContext } from "@/lib/menu/publicMenuRenderContext";

/**
 * Narrow external-data boundary for the static landing graph. The boundary
 * scanner reads this file and permits only its exact public-menu delegate.
 */
export async function resolvePublicMenuRenderContext({
  query,
  slug
}: {
  query: PublicMenuRenderQuery;
  slug: string;
}): Promise<PublicMenuRenderContext | null> {
  return resolvePublicMenuRenderContextDelegate({ query, slug });
}
