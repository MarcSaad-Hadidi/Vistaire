import "server-only";

import {
  resolvePublicMenuExchangeRates as resolvePublicMenuExchangeRatesDelegate,
  resolvePublicMenuStableRenderContext as resolvePublicMenuStableRenderContextDelegate
} from "@/lib/menu/publicMenuRenderContext";
import type {
  PublicMenuRenderQuery,
  PublicMenuStableRenderContext
} from "@/lib/menu/publicMenuRenderContext";

export type {
  PublicMenuRenderContext,
  PublicMenuStableRenderContext
} from "@/lib/menu/publicMenuRenderContext";

/**
 * Narrow external-data boundary for the static landing graph. The boundary
 * scanner reads this file and permits only its exact public-menu delegate.
 */
export async function resolvePublicMenuStableRenderContext({
  query,
  slug
}: {
  query: PublicMenuRenderQuery;
  slug: string;
}): Promise<PublicMenuStableRenderContext | null> {
  return resolvePublicMenuStableRenderContextDelegate({ query, slug });
}

export function resolvePublicMenuExchangeRates(
  menu: Pick<PublicMenuStableRenderContext["menu"], "settings">
) {
  return resolvePublicMenuExchangeRatesDelegate(menu);
}
