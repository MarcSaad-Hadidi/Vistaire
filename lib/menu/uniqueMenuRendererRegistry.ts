import type { ComponentType } from "react";
import type { MenuExchangeRates } from "../currency/formatMenuPrice.ts";
import type { Locale } from "../i18n.ts";
import type { MenuUiConfig } from "./menuUiConfig.ts";
import type {
  PublicMenu,
  PublicMenuContextQuery,
  PublicMenuDish
} from "./publicMenuCore.ts";
import { isSafeRendererKeyCandidate } from "./uniqueMenuDesign.ts";

/**
 * Compile-time allowlist of unique menu renderer keys.
 * Grow this union only when a real bespoke UI is statically imported below.
 */
export type UniqueMenuRendererKey = never;

export type UniqueMenuRendererModuleProps = {
  menu: PublicMenu;
  config: MenuUiConfig;
  context?: string;
  query?: PublicMenuContextQuery;
  locale?: Locale;
  exchangeRates?: MenuExchangeRates;
  mode?: "public" | "builder-preview" | "phone-preview";
};

export type UniqueMenuRendererEntry = {
  key: string;
  version: number;
  menu: ComponentType<UniqueMenuRendererModuleProps>;
  dishDetail: ComponentType<
    UniqueMenuRendererModuleProps & { dish: PublicMenuDish }
  >;
  capabilities?: {
    supportsMultiLocale?: boolean;
    supportsCurrencySelector?: boolean;
  };
};

/**
 * Empty static registry. Future unique UIs must be explicitly imported here.
 * Never resolve modules from DB strings, paths, or dynamic import templates.
 */
const UNIQUE_MENU_RENDERERS: Record<string, UniqueMenuRendererEntry> = {
  // Future entries only — static imports required; no template-string module loading.
};

export const REGISTERED_UNIQUE_MENU_RENDERER_KEYS = Object.freeze(
  Object.keys(UNIQUE_MENU_RENDERERS)
);

export function isRegisteredUniqueMenuRendererKey(
  value: unknown
): value is UniqueMenuRendererKey {
  if (!isSafeRendererKeyCandidate(value)) return false;
  return Object.prototype.hasOwnProperty.call(UNIQUE_MENU_RENDERERS, value);
}

export function getUniqueMenuRenderer(
  key: string | null | undefined
): UniqueMenuRendererEntry | null {
  if (!isRegisteredUniqueMenuRendererKey(key)) return null;
  return UNIQUE_MENU_RENDERERS[key] ?? null;
}

export function assertNoDynamicUniqueRendererImport(source: string): boolean {
  return !/import\s*\(\s*[`'"].*\$\{/.test(source);
}
