import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const cssModuleUrl =
  "data:text/javascript," +
  encodeURIComponent("export default new Proxy({}, { get: (_, key) => String(key) });");
const linkModuleUrl =
  "data:text/javascript," +
  encodeURIComponent(
    "const reactElement = Symbol.for('react.transitional.element'); export default function Link({ children, prefetch, ...props }) { return { $$typeof: reactElement, type: 'a', key: null, props: { ...props, children }, _owner: null }; }"
  );

function resolveTypeScript(specifier, parentUrl) {
  const parentPath = fileURLToPath(parentUrl);
  const candidate = specifier.startsWith("@/")
    ? resolve(projectRoot, specifier.slice(2))
    : resolve(dirname(parentPath), specifier);
  for (const extension of ["", ".ts", ".tsx"]) {
    const path = `${candidate}${extension}`;
    if (existsSync(path)) return pathToFileURL(path).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/link") {
      return { url: linkModuleUrl, shortCircuit: true };
    }
    if (specifier.endsWith(".module.css")) {
      return { url: cssModuleUrl, shortCircuit: true };
    }
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const url = resolveTypeScript(specifier, context.parentURL);
      if (url) return { url, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts") || url.endsWith(".tsx")) {
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022
          }
        }).outputText,
        shortCircuit: true
      };
    }
    return nextLoad(url, context);
  }
});

const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { PublicMenuRenderer } = await import(
  "../components/menu/PublicMenuRenderer.tsx"
);
const { PublicDishDetailExperience } = await import(
  "../components/menu/PublicDishDetailExperience.tsx"
);
const { PublicMenuExperience } = await import(
  "../components/menu/PublicMenuExperience.tsx"
);
const { DEFAULT_MENU_UI_CONFIG } = await import("../lib/menu/menuUiConfig.ts");
const { buildSupabasePublicMenu } = await import("../lib/menu/publicMenuCore.ts");

const restaurantId = "33333333-3333-4333-8333-333333333333";
const dishId = "84226092-1b25-4174-a635-50e2b8319580";
const sourceSha256 = "a".repeat(64);
const outputSha256 = "b".repeat(64);
const photoPath = `/api/public/menu-dishes/${dishId}/photo`;

const menu = buildSupabasePublicMenu(
  "resto-marc",
  {
    id: restaurantId,
    name: "Resto Marc",
    slug: "resto-marc",
    location: "Montreal",
    cuisine_type: "Cuisine maison"
  },
  [
    {
      id: dishId,
      restaurant_id: restaurantId,
      name: "Tartare de saumon",
      category_name: "Plats",
      image_url: photoPath,
      metadata: {
        photoSha256: sourceSha256,
        photoDerivatives: {
          card: {
            schemaVersion: 2,
            recipeId: "dish-photo-v2",
            variant: "card",
            storagePath: `restaurants/${restaurantId}/photos/derivatives/${sourceSha256}/dish-photo-v2/card-${outputSha256}.webp`,
            sha256: outputSha256,
            outputSha256,
            contentType: "image/webp",
            format: "webp",
            width: 768,
            height: 512,
            bytes: 120_000,
            sourceSha256,
            generatedAt: "2026-08-13T00:00:00.000Z",
            encoder: "sharp-webp-effort-4"
          }
        }
      }
    }
  ]
);

const urls = {
  thumbnail: `${photoPath}?v=${sourceSha256}&variant=thumbnail`,
  card: `${photoPath}?v=${sourceSha256}&variant=card`,
  display: `${photoPath}?v=${sourceSha256}&variant=display`
};

function markupUrlPattern(url) {
  return new RegExp(
    url.replaceAll("?", "\\?").replaceAll("&", "&amp;")
  );
}

test("renders card media for generic photo-large cards", () => {
  const config = {
    ...DEFAULT_MENU_UI_CONFIG,
    cards: { ...DEFAULT_MENU_UI_CONFIG.cards, variant: "photo-large" }
  };
  const markup = renderToStaticMarkup(
    React.createElement(PublicMenuRenderer, { config, menu, mode: "public" })
  );

  assert.match(markup, markupUrlPattern(urls.card));
  assert.doesNotMatch(markup, markupUrlPattern(urls.thumbnail));
});

test("renders display media for a dish detail and thumbnail media for compact rows", () => {
  const detailMarkup = renderToStaticMarkup(
    React.createElement(PublicDishDetailExperience, {
      dish: menu.dishes[0],
      menu,
      mode: "public"
    })
  );
  const compactMarkup = renderToStaticMarkup(
    React.createElement(PublicMenuExperience, { menu })
  );

  assert.match(detailMarkup, markupUrlPattern(urls.display));
  assert.match(compactMarkup, markupUrlPattern(urls.thumbnail));
  assert.doesNotMatch(compactMarkup, markupUrlPattern(urls.display));
});
