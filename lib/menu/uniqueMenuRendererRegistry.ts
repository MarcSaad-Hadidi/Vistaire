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
  /** Binds this static renderer to exactly one design identity. */
  designId: string;
  /** Static renderer package version (distinct from UniqueMenuDesign.version). */
  version: number;
  displayName: string;
  menu: ComponentType<UniqueMenuRendererModuleProps>;
  dishDetail: ComponentType<
    UniqueMenuRendererModuleProps & { dish: PublicMenuDish }
  >;
  capabilities?: {
    supportsMultiLocale?: boolean;
    supportsCurrencySelector?: boolean;
  };
};

export type UniqueMenuRendererPublicMeta = {
  key: string;
  designId: string;
  version: number;
  displayName: string;
  capabilities?: UniqueMenuRendererEntry["capabilities"];
};

/**
 * Empty static production registry.
 * Future unique UIs must be explicitly imported here with a fixed designId.
 * Never resolve modules from DB strings, paths, or dynamic import templates.
 */
const PRODUCTION_UNIQUE_MENU_RENDERERS: ReadonlyArray<UniqueMenuRendererEntry> =
  Object.freeze([
    // Future entries only — static imports required; no template-string module loading.
  ]);

/**
 * Test-only injectable registry. Never populated in production runtime paths.
 * Node/Playwright tests may call __setUniqueMenuRendererTestRegistry.
 */
let testRegistryOverride: ReadonlyArray<UniqueMenuRendererEntry> | null = null;

function activeRegistry(): ReadonlyArray<UniqueMenuRendererEntry> {
  return testRegistryOverride ?? PRODUCTION_UNIQUE_MENU_RENDERERS;
}

function entryIsComplete(entry: UniqueMenuRendererEntry): boolean {
  return (
    typeof entry.key === "string" &&
    isSafeRendererKeyCandidate(entry.key) &&
    typeof entry.designId === "string" &&
    entry.designId.length > 0 &&
    typeof entry.version === "number" &&
    Number.isInteger(entry.version) &&
    entry.version >= 1 &&
    typeof entry.displayName === "string" &&
    entry.displayName.trim().length > 0 &&
    typeof entry.menu === "function" &&
    typeof entry.dishDetail === "function"
  );
}

export const REGISTERED_UNIQUE_MENU_RENDERER_KEYS = Object.freeze(
  PRODUCTION_UNIQUE_MENU_RENDERERS.map((entry) => entry.key)
);

export function isRegisteredUniqueMenuRendererKey(
  value: unknown
): value is UniqueMenuRendererKey {
  if (!isSafeRendererKeyCandidate(value)) return false;
  return activeRegistry().some((entry) => entry.key === value);
}

export function getUniqueMenuRenderer(
  key: string | null | undefined
): UniqueMenuRendererEntry | null {
  if (!isSafeRendererKeyCandidate(key)) return null;
  const entry = activeRegistry().find((item) => item.key === key) ?? null;
  if (!entry || !entryIsComplete(entry)) return null;
  return entry;
}

/**
 * Accept a renderer only when key + designId match and both surfaces exist.
 */
export function getUniqueMenuRendererForDesign(
  designId: string | null | undefined,
  rendererKey: string | null | undefined
): UniqueMenuRendererEntry | null {
  if (typeof designId !== "string" || !designId.trim()) return null;
  const entry = getUniqueMenuRenderer(rendererKey);
  if (!entry) return null;
  if (entry.designId !== designId) return null;
  return entry;
}

export function getRegisteredUniqueMenuRenderersForDesign(
  designId: string | null | undefined
): UniqueMenuRendererPublicMeta[] {
  if (typeof designId !== "string" || !designId.trim()) return [];
  return activeRegistry()
    .filter((entry) => entry.designId === designId && entryIsComplete(entry))
    .map((entry) => ({
      key: entry.key,
      designId: entry.designId,
      version: entry.version,
      displayName: entry.displayName,
      ...(entry.capabilities ? { capabilities: entry.capabilities } : {})
    }));
}

/**
 * Test harness only. Pass null to restore the empty production registry.
 * Must never be called from production request handlers.
 */
export function __setUniqueMenuRendererTestRegistry(
  entries: ReadonlyArray<UniqueMenuRendererEntry> | null
): void {
  if (entries == null) {
    testRegistryOverride = null;
    return;
  }
  for (const entry of entries) {
    if (!entryIsComplete(entry)) {
      throw new Error(
        "Test unique renderer registry entry incomplete (menu + dishDetail + designId required)."
      );
    }
  }
  testRegistryOverride = Object.freeze([...entries]);
}

export function assertNoDynamicUniqueRendererImport(source: string): boolean {
  return !/import\s*\(\s*[`'"].*\$\{/.test(source);
}
