import type { ComponentType } from "react";
import type { UniqueMenuRendererModuleProps } from "@/lib/menu/uniqueMenuRendererRegistry";
import type { PublicMenuDish } from "@/lib/menu/publicMenuCore";

type SaugeNoireBookModule = {
  SaugeNoireBookMenu: ComponentType<UniqueMenuRendererModuleProps>;
};

type SaugeNoireDishModule = {
  SaugeNoireDishDetail: ComponentType<
    UniqueMenuRendererModuleProps & { dish: PublicMenuDish }
  >;
};

/**
 * The production registry stays statically named while Node's source-only
 * contract tests avoid evaluating JSX and CSS-module files outside Next.
 * Webpack/Turbopack resolves this fixed CommonJS request into the concrete
 * renderer modules for the public route.
 */
const isNodeTest =
  typeof process !== "undefined" &&
  (Boolean(process.env.NODE_TEST_CONTEXT) || process.argv.includes("--test"));

const bookModule =
  !isNodeTest
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("./SaugeNoireBookMenu") as SaugeNoireBookModule)
    : null;
const dishModule =
  !isNodeTest
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("./SaugeNoireDishDetail") as SaugeNoireDishModule)
    : null;

export const SaugeNoireBookMenu: ComponentType<UniqueMenuRendererModuleProps> =
  bookModule?.SaugeNoireBookMenu ?? (() => null);

export const SaugeNoireDishDetail: ComponentType<
  UniqueMenuRendererModuleProps & { dish: PublicMenuDish }
> = dishModule?.SaugeNoireDishDetail ?? (() => null);
