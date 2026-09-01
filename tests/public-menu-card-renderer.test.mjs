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
const dynamicModuleUrl =
  "data:text/javascript," +
  encodeURIComponent(
    "export default function dynamic() { return function DynamicComponent() { return null; }; }"
  );
const navigationModuleUrl =
  "data:text/javascript," +
  encodeURIComponent(
    "export function usePathname() { return '/menu/resto-marc'; } export function useRouter() { return { push() {}, replace() {} }; } export function useSearchParams() { return new URLSearchParams(); }"
  );
const imageModuleUrl =
  "data:text/javascript," +
  encodeURIComponent(
    "const reactElement = Symbol.for('react.transitional.element'); export default function Image({ fill, priority, quality, sizes, unoptimized, ...props }) { return { $$typeof: reactElement, type: 'img', key: null, props, _owner: null }; }"
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
    if (specifier === "next/dynamic") {
      return { url: dynamicModuleUrl, shortCircuit: true };
    }
    if (specifier === "next/navigation") {
      return { url: navigationModuleUrl, shortCircuit: true };
    }
    if (specifier === "next/image") {
      return { url: imageModuleUrl, shortCircuit: true };
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
const { MaisonElyseDishCard } = await import(
  "../components/menu/MaisonElyseQrMenu.tsx"
);
const { TrouvableDishVisual } = await import(
  "../components/menu/TrouvablePremiumMenuExperience.tsx"
);
const {
  SaugeNoireDishFeatureCard,
  SaugeNoireDishRow
} = await import(
  "../components/menu/unique/sauge-noire/SaugeNoireMenuPages.tsx"
);
const { LandingDishStorySection } = await import(
  "../components/landing/LandingDishStorySection.tsx"
);
const { DEFAULT_MENU_UI_CONFIG } = await import("../lib/menu/menuUiConfig.ts");
const { buildSupabasePublicMenu } = await import("../lib/menu/publicMenuCore.ts");
const { buildCurrentPublicMenuPreview } = await import(
  "../lib/landing/publicMenuPreview.ts"
);
const { getLandingCopy } = await import(
  "../lib/landing/landingCopy.ts"
);

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

const distinctUrls = {
  thumbnail: "https://images.vistaire.invalid/dishes/tartare-thumbnail.webp",
  card: "https://images.vistaire.invalid/dishes/tartare-card.webp",
  display: "https://images.vistaire.invalid/dishes/tartare-display.webp"
};

const surfaceDish = {
  ...menu.dishes[0],
  thumbnailUrl: distinctUrls.thumbnail,
  cardUrl: distinctUrls.card,
  imageUrl: distinctUrls.display
};
const surfaceMenu = { ...menu, dishes: [surfaceDish] };

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
    React.createElement(PublicMenuRenderer, {
      config,
      menu: surfaceMenu,
      mode: "public"
    })
  );

  assert.match(markup, markupUrlPattern(distinctUrls.card));
  assert.doesNotMatch(markup, markupUrlPattern(distinctUrls.thumbnail));
  assert.doesNotMatch(markup, markupUrlPattern(distinctUrls.display));
});

test("renders display media for a dish detail and thumbnail media for compact rows", () => {
  const detailMarkup = renderToStaticMarkup(
    React.createElement(PublicDishDetailExperience, {
      dish: surfaceDish,
      menu: surfaceMenu,
      mode: "public"
    })
  );
  const compactMarkup = renderToStaticMarkup(
    React.createElement(PublicMenuExperience, { menu: surfaceMenu })
  );

  assert.match(detailMarkup, markupUrlPattern(distinctUrls.display));
  assert.match(compactMarkup, markupUrlPattern(distinctUrls.thumbnail));
  assert.doesNotMatch(compactMarkup, markupUrlPattern(distinctUrls.card));
  assert.doesNotMatch(compactMarkup, markupUrlPattern(distinctUrls.display));
});

test("renders branded small and card surfaces without selecting display media", () => {
  const maisonMarkup = renderToStaticMarkup(
    React.createElement(MaisonElyseDishCard, {
      copy: {
        badgesAria: "Badges",
        dishDetails: "Détails",
        recommendation: "Recommandé",
        signature: "Signature",
        unavailableBadge: "Indisponible"
      },
      currency: "CAD",
      disableNavigation: true,
      dish: surfaceDish,
      locale: "fr-CA",
      menu: surfaceMenu
    })
  );
  const trouvableListMarkup = renderToStaticMarkup(
    React.createElement(TrouvableDishVisual, {
      dish: surfaceDish,
      menu: surfaceMenu,
      viewMode: "list"
    })
  );
  const trouvableGridMarkup = renderToStaticMarkup(
    React.createElement(TrouvableDishVisual, {
      dish: surfaceDish,
      menu: surfaceMenu,
      viewMode: "grid"
    })
  );
  const saugeRowMarkup = renderToStaticMarkup(
    React.createElement(SaugeNoireDishRow, {
      compact: false,
      currency: "CAD",
      disableNavigation: true,
      dish: surfaceDish,
      locale: "fr-CA",
      menu: surfaceMenu,
      query: {}
    })
  );
  const saugeFeaturedMarkup = renderToStaticMarkup(
    React.createElement(SaugeNoireDishFeatureCard, {
      copy: { menu: "Menu" },
      currency: "CAD",
      disableNavigation: true,
      dish: surfaceDish,
      locale: "fr-CA",
      menu: surfaceMenu,
      query: {},
      variant: "editorial"
    })
  );

  for (const markup of [maisonMarkup, trouvableListMarkup, saugeRowMarkup]) {
    assert.match(markup, markupUrlPattern(distinctUrls.thumbnail));
    assert.doesNotMatch(markup, markupUrlPattern(distinctUrls.card));
    assert.doesNotMatch(markup, markupUrlPattern(distinctUrls.display));
  }
  for (const markup of [trouvableGridMarkup, saugeFeaturedMarkup]) {
    assert.match(markup, markupUrlPattern(distinctUrls.card));
    assert.doesNotMatch(markup, markupUrlPattern(distinctUrls.thumbnail));
    assert.doesNotMatch(markup, markupUrlPattern(distinctUrls.display));
  }
});

test("renders card media in the landing dish-story component", () => {
  const { preview } = buildCurrentPublicMenuPreview({
    locale: "fr",
    menu: surfaceMenu,
    preferredDishId: surfaceDish.id,
    preferredDishSlug: surfaceDish.slug,
    theme: "maison-elyse"
  });
  const featuredDish = preview.featuredDish;
  assert.ok(featuredDish);
  const markup = renderToStaticMarkup(
    React.createElement(LandingDishStorySection, {
      copy: getLandingCopy("fr").dishes,
      experiences: [
        {
          id: "maison-elyse",
          menuSlug: "maison-elyse",
          name: "Maison Élyse",
          label: "Éditoriale et gastronomique",
          publicMenuHref: "/menu/maison-elyse",
          image: "",
          imageAlt: "",
          imagePosition: "center",
          preferredDishSlug: surfaceDish.slug,
          featuredDish: {
            id: surfaceDish.id,
            slug: surfaceDish.slug,
            name: surfaceDish.name,
            description: surfaceDish.description,
            price: surfaceDish.priceLabel,
            href: `/menu/maison-elyse/dishes/${surfaceDish.slug}`,
            image: featuredDish.image ?? "",
            imageSource: "cardUrl",
            imageAlt: surfaceDish.name,
            imagePosition: "center"
          },
          preview,
          renderPayload: null,
          hasLiveData: true
        }
      ],
      locale: "fr"
    })
  );

  assert.match(markup, markupUrlPattern(distinctUrls.card));
  assert.doesNotMatch(markup, markupUrlPattern(distinctUrls.thumbnail));
  assert.doesNotMatch(markup, markupUrlPattern(distinctUrls.display));
});
