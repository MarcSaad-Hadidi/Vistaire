import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
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

const { landingPhotoForDish } = await import(
  "../lib/landing/landingDishIdentity.ts"
);
const { projectLandingMenuUiMenu } = await import(
  "../lib/landing/landingMenuUiPreview.ts"
);
const { buildCurrentPublicMenuPreview } = await import(
  "../lib/landing/publicMenuPreview.ts"
);

function dish(overrides = {}) {
  return {
    id: "dish-id",
    slug: "dish-slug",
    name: "Dish",
    description: "Description",
    category: "Plats",
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

function menu(dishes) {
  return {
    restaurantId: "restaurant-public-id",
    menuId: "menu-public-id",
    menuName: "Menu",
    slug: "public-menu",
    name: "Public menu",
    location: "Montréal",
    cuisineType: "Québécoise",
    settings: {},
    googleReview: { enabled: false, googleReviewUrl: "" },
    source: "supabase",
    dishes
  };
}

test("landing media accepts only stable public URL forms", () => {
  const accepted = [
    "/api/public/menu-dishes/dish-id/photo",
    "/api/public/menu-dishes/dish-id/photo?v=release-7",
    "/images/landing/dish.webp",
    "https://cdn.example.test/menu/dish.webp?width=960"
  ];
  for (const imageUrl of accepted) {
    assert.deepEqual(
      landingPhotoForDish(dish({ imageUrl })),
      { source: "imageUrl", url: imageUrl },
      imageUrl
    );
  }

  const rejected = [
    "/api/public/menu-dishes/another-dish/photo?v=release-7",
    "data:image/png;base64,c3ludGhldGlj",
    "blob:https://vistaire.test/synthetic",
    "http://cdn.example.test/menu/dish.webp",
    "https://user:password@cdn.example.test/menu/dish.webp",
    "https://project.supabase.co/storage/v1/object/sign/dishes/dish.webp",
    "https://cdn.example.test/dish.webp?token=synthetic-capability",
    "https://cdn.example.test/dish.webp?SIGNATURE=synthetic-signature",
    "https://cdn.example.test/dish.webp?expires=9999999999",
    "https://cdn.example.test/dish.webp?x-amz-algorithm=AWS4-HMAC-SHA256",
    "https://cdn.example.test/dish.webp?X-Amz-Credential=synthetic",
    "https://cdn.example.test/dish.webp?x-amz-signature=synthetic",
    "https://cdn.example.test/dish.webp?X-Amz-Security-Token=synthetic"
  ];
  for (const imageUrl of rejected) {
    assert.equal(landingPhotoForDish(dish({ imageUrl })), null, imageUrl);
  }
});

test("a public ready photo replaces a signed source with its canonical route", () => {
  const id = "dish / spécial";
  const signed =
    "https://project.supabase.co/storage/v1/object/sign/dishes/live.webp?token=synthetic-capability";
  assert.deepEqual(
    landingPhotoForDish(
      dish({ id, imageUrl: signed, hasPhoto: true, photoStatus: "ready" })
    ),
    {
      source: "imageUrl",
      url: "/api/public/menu-dishes/dish%20%2F%20sp%C3%A9cial/photo"
    }
  );
  assert.deepEqual(
    landingPhotoForDish(
      dish({ imageUrl: signed, hasPhoto: false, photoStatus: "ready" })
    )?.url,
    "/api/public/menu-dishes/dish-id/photo"
  );
  assert.equal(
    landingPhotoForDish(
      dish({ imageUrl: signed, hasPhoto: false, photoStatus: "planned" })
    ),
    null
  );
  assert.equal(
    landingPhotoForDish(
      dish({ imageUrl: "data:image/png;base64,c3ludGhldGlj", hasPhoto: true, photoStatus: "ready" })
    ),
    null
  );
});

test("landing photos reuse the recursive capability boundary without changing stable fallbacks", () => {
  const privateSources = [
    "//user:synthetic-password@cdn.example.test/live.webp",
    "https://project.supabase.co/STORAGE/V1/OBJECT/SIGN/dishes/live.webp",
    "https://cdn.example.test/live.webp?X-Amz-Expires=900"
  ];
  for (const imageUrl of privateSources) {
    assert.deepEqual(
      landingPhotoForDish(
        dish({ id: "ready-dish", imageUrl, hasPhoto: true, photoStatus: "ready" })
      ),
      {
        source: "imageUrl",
        url: "/api/public/menu-dishes/ready-dish/photo"
      },
      imageUrl
    );
  }

  assert.deepEqual(
    landingPhotoForDish(
      dish({
        id: "ready-dish",
        imageUrl: "/api/public/menu-dishes/ready-dish/photo?v=release-8",
        hasPhoto: true,
        photoStatus: "ready"
      })
    ),
    {
      source: "imageUrl",
      url: "/api/public/menu-dishes/ready-dish/photo?v=release-8"
    }
  );
  assert.equal(
    landingPhotoForDish(
      dish({
        id: "ready-dish",
        imageUrl: "/api/public/menu-dishes/another-dish/photo?v=release-8",
        hasPhoto: true,
        photoStatus: "ready"
      })
    ),
    null
  );
});

test("the landing menu projection sanitizes image and thumbnail fields independently", () => {
  const signedImage =
    "https://project.supabase.co/storage/v1/object/sign/dishes/live.webp?token=synthetic-capability";
  const signedThumbnail =
    "https://cdn.example.test/thumb.webp?X-Amz-Signature=synthetic-signature";
  const projected = projectLandingMenuUiMenu(
    menu([
      dish({
        id: "safe-distinct",
        imageUrl: "/images/full.webp",
        thumbnailUrl: "https://cdn.example.test/thumb.webp"
      }),
      dish({
        id: "ready-signed",
        imageUrl: signedImage,
        thumbnailUrl: signedThumbnail,
        hasPhoto: true,
        photoStatus: "ready"
      }),
      dish({
        id: "unsafe-empty",
        imageUrl: "data:image/png;base64,c3ludGhldGlj",
        thumbnailUrl: "blob:https://vistaire.test/synthetic"
      }),
      dish({
        id: "thumbnail-fallback",
        imageUrl: "data:image/png;base64,c3ludGhldGlj",
        thumbnailUrl: "/images/fallback-thumb.webp"
      })
    ])
  );

  assert.deepEqual(
    projected.dishes.map(({ imageUrl, thumbnailUrl }) => ({ imageUrl, thumbnailUrl })),
    [
      {
        imageUrl: "/images/full.webp",
        thumbnailUrl: "https://cdn.example.test/thumb.webp"
      },
      {
        imageUrl: "/api/public/menu-dishes/ready-signed/photo",
        thumbnailUrl: "/api/public/menu-dishes/ready-signed/photo"
      },
      { imageUrl: "", thumbnailUrl: "" },
      {
        imageUrl: "/images/fallback-thumb.webp",
        thumbnailUrl: "/images/fallback-thumb.webp"
      }
    ]
  );
  const payload = JSON.stringify(projected);
  assert.doesNotMatch(payload, /storage\/v1\/object\/sign/i);
  assert.doesNotMatch(payload, /synthetic-(?:capability|signature)/i);
});

test("the complete comparison payload sanitizes featured, category and Vistaire dish media", () => {
  const signedImage =
    "https://project.supabase.co/storage/v1/object/sign/dishes/live.webp?token=synthetic-capability";
  const signedThumbnail =
    "https://cdn.example.test/thumb.webp?X-Amz-Signature=synthetic-signature";
  const sourceMenu = menu([
    dish({
      id: "ready-signed",
      slug: "ready-signed",
      categoryId: "category-1",
      categorySlug: "signatures",
      categoryDescription: "Current signatures",
      imageUrl: signedImage,
      thumbnailUrl: signedThumbnail,
      hasPhoto: true,
      photoStatus: "ready",
      isRecommended: true,
      isSignature: true
    })
  ]);
  sourceMenu.settings = {
    defaultCurrency: "CAD"
  };

  const { featuredDish, preview } = buildCurrentPublicMenuPreview({
    locale: "fr",
    menu: sourceMenu,
    preferredDishId: "ready-signed",
    preferredDishSlug: "ready-signed",
    theme: "maison-elyse"
  });
  const canonicalPhoto =
    "/api/public/menu-dishes/ready-signed/photo";

  assert.equal(featuredDish?.id, "ready-signed");
  assert.equal(preview.featuredDish?.image, canonicalPhoto);
  assert.equal(preview.categoryCards[0]?.image, canonicalPhoto);
  assert.equal(preview.vistaireDishes[0]?.image, canonicalPhoto);

  const payload = JSON.stringify(preview);
  assert.doesNotMatch(payload, /storage\/v1\/object\/sign/i);
  assert.doesNotMatch(payload, /synthetic-(?:capability|signature)/i);
});
