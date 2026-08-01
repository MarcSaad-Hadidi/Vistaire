import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export%20default%20undefined",
        shortCircuit: true
      };
    }
    if (specifier.startsWith("@/")) {
      const baseUrl = new URL(specifier.slice(2), projectRootUrl);
      for (const extension of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
      const baseUrl = new URL(specifier, context.parentURL);
      for (const extension of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
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

const {
  canonicalLandingDishPhotoId,
  dedupeLandingDishPhotos,
  findLandingDishByIdentity,
  landingDishIdentityMatches,
  landingPhotoForDish,
  resolveLandingDishPhoto
} = await import("../lib/landing/landingDishIdentity.ts");
const { buildCurrentPublicMenuPreview } = await import(
  "../lib/landing/publicMenuPreview.ts"
);

const EXPERIENCES = [
  {
    id: "maison-elyse",
    dishId: "maison-dish",
    slug: "maison-featured"
  },
  {
    id: "trouvable",
    dishId: "trouvable-dish",
    slug: "trouvable-featured"
  },
  {
    id: "sauge-noire",
    dishId: "sauge-dish",
    slug: "sauge-featured"
  }
];

function canonicalPhoto(id, version = "v1") {
  return version
    ? `/api/public/menu-dishes/${id}/photo?v=${version}`
    : `/api/public/menu-dishes/${id}/photo`;
}

function dish(overrides = {}) {
  return {
    id: "dish-id",
    slug: "dish-slug",
    name: "Source dish name",
    description: "Source description",
    categoryId: "plats",
    category: "Plats",
    categorySlug: "plats",
    categoryDescription: "Source category description",
    priceLabel: "$20",
    priceCents: 2000,
    priceCurrency: "CAD",
    baseCurrency: "CAD",
    displayPriceMode: "auto",
    imageUrl: "",
    thumbnailUrl: "",
    posterUrl: "",
    hasPhoto: false,
    photoStatus: "missing",
    hasImmersive: false,
    has3d: false,
    hasAr: false,
    hasIosAr: false,
    hasAndroidAr: false,
    model3dUrl: "",
    webModel3dUrl: "",
    webModel3dBytes: 0,
    arModel3dUrl: "",
    arModel3dBytes: 0,
    usdzUrl: "",
    arUsdzUrl: "",
    arUsdzBytes: 0,
    modelStatus: "missing",
    available: true,
    ingredients: [],
    allergens: [],
    options: [],
    houseNote: "",
    tags: [],
    ...overrides
  };
}

function fallbackFor(experience) {
  return {
    id: experience.dishId,
    slug: experience.slug,
    image: canonicalPhoto(experience.dishId, `${experience.id}-fallback`)
  };
}

test("all three landing experiences accept only their selected dish photo", () => {
  for (const experience of EXPERIENCES) {
    const fallback = fallbackFor(experience);
    const selected = dish({ id: experience.dishId, slug: experience.slug });

    assert.deepEqual(
      resolveLandingDishPhoto(
        {
          ...selected,
          imageUrl: canonicalPhoto(experience.dishId, `${experience.id}-live`)
        },
        fallback,
        [selected]
      ),
      {
        source: "imageUrl",
        url: canonicalPhoto(experience.dishId, `${experience.id}-live`)
      },
      `${experience.id}: versioned own canonical photo`
    );
    assert.deepEqual(
      resolveLandingDishPhoto(
        { ...selected, imageUrl: canonicalPhoto(experience.dishId, "") },
        fallback,
        [selected]
      ),
      { source: "imageUrl", url: canonicalPhoto(experience.dishId, "") },
      `${experience.id}: unversioned own canonical photo`
    );

    const replacement = dish({
      id: `${experience.id}-replacement`,
      slug: `${experience.slug}-replacement`,
      imageUrl: `/images/${experience.id}-replacement.jpg`
    });
    assert.deepEqual(
      resolveLandingDishPhoto(replacement, fallback, [replacement]),
      { source: "imageUrl", url: `/images/${experience.id}-replacement.jpg` },
      `${experience.id}: replacement keeps its own photo`
    );
    assert.equal(
      resolveLandingDishPhoto(
        { ...replacement, imageUrl: "", thumbnailUrl: "", posterUrl: "" },
        fallback,
        [replacement]
      ),
      null,
      `${experience.id}: replacement without a photo has no cross-dish fallback`
    );
    assert.equal(
      resolveLandingDishPhoto(
        { ...replacement, imageUrl: canonicalPhoto(experience.dishId) },
        fallback,
        [replacement]
      ),
      null,
      `${experience.id}: wrong canonical id is rejected`
    );
    assert.equal(
      resolveLandingDishPhoto(
        { ...replacement, id: "", slug: "wrong-slug", imageUrl: "" },
        fallback,
        [{ ...replacement, id: "", slug: "wrong-slug", imageUrl: "" }]
      ),
      null,
      `${experience.id}: wrong slug is rejected when id is unavailable`
    );
  }
});

test("landing identity uses id first and only accepts an unambiguous slug fallback", () => {
  const idMatch = dish({ id: "preferred-id", slug: "different-slug" });
  const slugMatch = dish({ id: "other-id", slug: "preferred-slug" });
  const duplicateSlug = dish({ id: "duplicate-id", slug: "preferred-slug" });

  assert.equal(
    findLandingDishByIdentity([idMatch, slugMatch], {
      id: "preferred-id",
      slug: "preferred-slug"
    }),
    idMatch
  );
  assert.equal(
    findLandingDishByIdentity([slugMatch], {
      id: "deleted-id",
      slug: "preferred-slug"
    }),
    slugMatch
  );
  assert.equal(
    findLandingDishByIdentity([slugMatch, duplicateSlug], {
      id: "deleted-id",
      slug: "preferred-slug"
    }),
    null
  );
  assert.equal(
    landingDishIdentityMatches(
      { ...slugMatch, id: "replacement-id" },
      { id: "preferred-id", slug: "preferred-slug" },
      [{ ...slugMatch, id: "replacement-id" }]
    ),
    false
  );
  assert.equal(
    landingDishIdentityMatches(
      { ...slugMatch, id: "" },
      { id: "preferred-id", slug: "preferred-slug" },
      []
    ),
    true
  );
  assert.equal(
    landingDishIdentityMatches(
      { ...slugMatch, id: "" },
      { id: "preferred-id", slug: "preferred-slug" },
      [{ ...slugMatch, id: "" }, duplicateSlug]
    ),
    false
  );
});

test("canonical photo identity rejects another dish while preserving own fallback fields", () => {
  assert.equal(
    canonicalLandingDishPhotoId(canonicalPhoto("dish-1", "hash")),
    "dish-1"
  );
  assert.equal(canonicalLandingDishPhotoId("/images/shared.jpg"), null);

  const ownThumbnail = dish({
    id: "dish-2",
    imageUrl: canonicalPhoto("dish-1"),
    thumbnailUrl: canonicalPhoto("dish-2")
  });
  assert.deepEqual(landingPhotoForDish(ownThumbnail), {
    source: "thumbnailUrl",
    url: canonicalPhoto("dish-2")
  });

  const sharedPhotoA = dish({ id: "restaurant-a-dish", imageUrl: "/images/shared.jpg" });
  const sharedPhotoB = dish({ id: "restaurant-b-dish", imageUrl: "/images/shared.jpg" });
  assert.equal(landingPhotoForDish(sharedPhotoA)?.url, landingPhotoForDish(sharedPhotoB)?.url);
  assert.notEqual(sharedPhotoA.id, sharedPhotoB.id);
  assert.equal(
    resolveLandingDishPhoto(
      { ...sharedPhotoB, imageUrl: "" },
      { id: sharedPhotoA.id, slug: sharedPhotoA.slug, image: canonicalPhoto(sharedPhotoA.id) },
      [sharedPhotoB]
    ),
    null
  );

  const deduped = dedupeLandingDishPhotos([
    {
      id: "restaurant-a",
      featuredDish: { image: "/images/shared.jpg", imageSource: "imageUrl" }
    },
    {
      id: "restaurant-b",
      featuredDish: { image: "/images/shared.jpg", imageSource: "imageUrl" }
    }
  ]);
  assert.equal(deduped[0].featuredDish.image, "/images/shared.jpg");
  assert.equal(deduped[1].featuredDish.image, "");
  assert.equal(deduped[1].featuredDish.imageSource, "unavailable");
});

test("public preview keeps replacement metadata and its matching image together", () => {
  const original = dish({
    id: "original-id",
    slug: "featured-slug",
    name: "Original dish",
    available: false,
    imageUrl: canonicalPhoto("original-id")
  });
  const replacement = dish({
    id: "replacement-id",
    slug: "featured-slug",
    name: "Replacement dish",
    description: "Replacement description",
    imageUrl: "/images/replacement.jpg"
  });
  const menu = {
    restaurantId: "restaurant-1",
    menuId: "menu-1",
    slug: "trouvable",
    name: "Trouvable",
    location: "Montreal",
    cuisineType: "Bistro",
    googleReview: { enabled: false, googleReviewUrl: "" },
    source: "supabase",
    settings: {
      defaultLocale: "fr-CA",
      supportedLocales: ["fr-CA"],
      baseCurrency: "CAD",
      defaultCurrency: "CAD",
      supportedCurrencies: ["CAD"],
      publicMenuStyle: "trouvable",
      timezone: "America/Toronto",
      defaultThemeMode: "dark",
      allowThemeToggle: true,
      allowCurrencySelector: true,
      allowLanguageSelector: true,
      taxIncluded: true,
      priceDisplayMode: "auto"
    },
    dishes: [original, replacement]
  };

  const current = buildCurrentPublicMenuPreview({
    locale: "fr",
    menu,
    preferredDishId: "original-id",
    preferredDishSlug: "featured-slug",
    theme: "trouvable"
  });
  assert.equal(current.featuredDish?.id, "replacement-id");
  assert.equal(current.preview.featuredDish?.id, "replacement-id");
  assert.equal(current.preview.featuredDish?.slug, "featured-slug");
  assert.equal(current.preview.featuredDish?.name, "Replacement dish");
  assert.equal(current.preview.featuredDish?.shortDescription, "Replacement description");
  assert.equal(current.preview.featuredDish?.image, "/images/replacement.jpg");

  const noPhoto = buildCurrentPublicMenuPreview({
    locale: "fr",
    menu: { ...menu, dishes: [original, { ...replacement, imageUrl: "" }] },
    preferredDishId: "original-id",
    preferredDishSlug: "featured-slug",
    theme: "trouvable"
  });
  assert.equal(noPhoto.featuredDish?.id, "replacement-id");
  assert.equal(noPhoto.preview.featuredDish?.image, null);
});
