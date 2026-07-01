import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPublicDishPath,
  buildSupabasePublicMenu,
  getGoogleReviewCta,
  getPublicMenuDishBySlug,
  getPublicMenuCategoryGroups,
  getVisiblePublicMenuCategories,
  isFreshHomemadeMenu
} from "../lib/menu/publicMenuCore.ts";

const restoMarcId = "33333333-3333-4333-8333-333333333333";
const maisonElyseId = "11111111-1111-1111-1111-111111111111";

const restoMarc = {
  id: restoMarcId,
  name: "Resto Marc",
  slug: "resto-marc",
  location: "Montreal",
  cuisine_type: "Cuisine maison"
};

test("builds a Resto Marc public menu from Supabase-like rows", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restoMarc, [
    {
      id: "salade",
      restaurant_id: restoMarcId,
      name: "Salade fraiche maison",
      description: "Legumes croquants.",
      category_name: "Entrees",
      price: 8.99,
      sort_order: 1,
      available: true
    },
    {
      id: "bol-riz",
      restaurant_id: restoMarcId,
      name: "Bol de riz au poulet et legumes",
      description:
        "Riz chaud servi avec morceaux de poulet grille, legumes sautes, sauce maison legere et garniture fraiche.",
      category_name: "Plats",
      price: 17.99,
      sort_order: 2,
      available: true
    },
    {
      id: "maison-elyse-dish",
      restaurant_id: maisonElyseId,
      restaurant_slug: "resto-marc",
      name: "Plat Maison Elyse a ne pas afficher",
      category_name: "Plats",
      price: 99,
      sort_order: 1
    }
  ]);

  assert.equal(menu.slug, "resto-marc");
  assert.equal(menu.name, "Resto Marc");
  assert.equal(menu.source, "supabase");
  assert.equal(menu.settings.defaultLocale, "fr-CA");
  assert.equal(menu.settings.baseCurrency, "CAD");
  assert.deepEqual(menu.googleReview, {
    enabled: false,
    googleReviewUrl: ""
  });
  assert.equal(menu.dishes.length, 2);
  assert.equal(menu.dishes[0].name, "Salade fraiche maison");
  assert.equal(menu.dishes[0].priceCents, 899);
  assert.equal(menu.dishes[0].priceCurrency, "CAD");
  assert.equal(menu.dishes[0].baseCurrency, "CAD");
  assert.equal(menu.dishes[1].name, "Bol de riz au poulet et legumes");
  assert.equal(menu.dishes[1].priceLabel, "17,99\u00a0$");
});

test("maps Google Review config only when the restaurant has a Google review URL", () => {
  const menu = buildSupabasePublicMenu(
    "resto-marc",
    {
      ...restoMarc,
      google_review_enabled: true,
      google_review_url: "https://search.google.com/local/writereview?placeid=abc123",
      google_rating: "4.8",
      google_review_count: "128"
    },
    []
  );

  assert.deepEqual(menu.googleReview, {
    enabled: true,
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=abc123",
    googleRating: 4.8,
    googleReviewCount: 128
  });
  assert.deepEqual(getGoogleReviewCta(menu.googleReview), {
    href: "https://search.google.com/local/writereview?placeid=abc123",
    googleRating: 4.8,
    googleReviewCount: 128
  });
});

test("Google Review CTA accepts Google short review links", () => {
  assert.deepEqual(
    getGoogleReviewCta({
      enabled: true,
      googleReviewUrl: "https://g.page/r/CYEXAMPLE/review"
    }),
    {
      href: "https://g.page/r/CYEXAMPLE/review"
    }
  );
});

test("Google Review CTA is absent when disabled, missing, non-review, credentialed, or non-HTTPS", () => {
  const validUrl = "https://search.google.com/local/writereview?placeid=abc123";

  assert.equal(getGoogleReviewCta(undefined), null);
  assert.equal(
    getGoogleReviewCta({ enabled: false, googleReviewUrl: validUrl }),
    null
  );

  for (const googleReviewUrl of [
    "",
    "/reviews",
    "//search.google.com/local/writereview?placeid=abc123",
    "http://search.google.com/local/writereview?placeid=abc123",
    "javascript:alert(1)",
    "https://user:pass@search.google.com/local/writereview?placeid=abc123",
    "https://localhost/local/writereview",
    "https://127.0.0.1/local/writereview",
    "https://example.com/review",
    "https://maps.google.com/?cid=123",
    "https://search.google.com/",
    "https://search.google.com/local/writereview",
    "https://search.google.com/local/writereview?placeid="
  ]) {
    const menu = buildSupabasePublicMenu(
      "resto-marc",
      {
        ...restoMarc,
        google_review_enabled: true,
        google_review_url: googleReviewUrl
      },
      []
    );

    assert.equal(
      getGoogleReviewCta(menu.googleReview),
      null,
      `${googleReviewUrl} should not render`
    );
  }
});

test("keeps a real restaurant with no dishes as an empty public menu", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restoMarc, [
    {
      id: "maison-elyse-dish",
      restaurant_id: maisonElyseId,
      restaurant_slug: "resto-marc",
      name: "Plat Maison Elyse a ne pas afficher",
      category_name: "Plats",
      price: 99,
      sort_order: 1
    }
  ]);

  assert.equal(menu.slug, "resto-marc");
  assert.equal(menu.source, "supabase");
  assert.deepEqual(menu.dishes, []);
});

test("falls back to slug-only dish rows when a restaurant id exists but dish ids are absent", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restoMarc, [
    {
      id: "bol-riz",
      restaurant_slug: "resto-marc",
      name: "Bol de riz au poulet et legumes",
      category_name: "Plats",
      price: 17.99,
      sort_order: 1
    }
  ]);

  assert.equal(menu.dishes.length, 1);
  assert.equal(menu.dishes[0].name, "Bol de riz au poulet et legumes");
});

test("can fall back to restaurant_slug when the restaurant row has no id", () => {
  const menu = buildSupabasePublicMenu("resto-marc", { ...restoMarc, id: "" }, [
    {
      id: "bol-riz",
      restaurant_slug: "resto-marc",
      name: "Bol de riz au poulet et legumes",
      category_name: "Plats",
      price: 17.99,
      sort_order: 1
    }
  ]);

  assert.equal(menu.dishes.length, 1);
  assert.equal(menu.dishes[0].name, "Bol de riz au poulet et legumes");
});

test("groups Resto Marc dishes into visible category cards without empty categories", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restoMarc, [
    {
      id: "bol-riz",
      restaurant_id: restoMarcId,
      name: "Bol de riz au poulet et legumes",
      category_name: "Plats",
      price: 17.99,
      sort_order: 1
    },
    {
      id: "limonade",
      restaurant_id: restoMarcId,
      name: "Limonade maison",
      category_name: "Boissons",
      price: 4.49,
      sort_order: 2
    }
  ]);

  const groups = getPublicMenuCategoryGroups(menu.dishes);
  const categories = getVisiblePublicMenuCategories(menu.dishes);

  assert.deepEqual(
    categories.map((category) => category.label),
    ["Plats", "Boissons"]
  );
  assert.equal(groups.get("Plats")?.[0]?.name, "Bol de riz au poulet et legumes");
  assert.equal(groups.has("Entrees"), false);
  assert.equal(isFreshHomemadeMenu(menu), true);
});

test("uses unique category ids for unknown public menu categories", () => {
  const menu = buildSupabasePublicMenu("maison-elyse", { ...restoMarc, slug: "maison-elyse" }, [
    {
      id: "signature",
      restaurant_id: restoMarcId,
      name: "Assiette signature",
      category_name: "Carte signature",
      price: 24
    },
    {
      id: "dessert-maison",
      restaurant_id: restoMarcId,
      name: "Dessert maison",
      category_name: "Carte dessert",
      price: 12
    }
  ]);

  const categories = getVisiblePublicMenuCategories(menu.dishes);

  assert.deepEqual(
    categories.map((category) => category.id),
    ["carte-signature", "carte-dessert"]
  );
});

test("maps detail-ready fields and finds only Resto Marc dishes by slug", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restoMarc, [
    {
      id: "bol-id",
      slug: "bol-de-riz-au-poulet-et-legumes",
      restaurant_id: restoMarcId,
      name: "Bol de riz au poulet et legumes",
      description:
        "Riz chaud servi avec morceaux de poulet grille, legumes sautes, sauce maison legere et garniture fraiche.",
      category_name: "Plats",
      price: 17.99,
      image_url: "/images/resto-marc/bol-riz.jpg",
      ingredients: ["Riz chaud", "Poulet grille"],
      allergens: "sesame, soja",
      options: ["Extra sauce maison"],
      house_note: "Maison",
      tags: ["Maison", "Populaire"],
      sort_order: 1
    },
    {
      id: "maison-elyse-bol",
      slug: "bol-de-riz-au-poulet-et-legumes",
      restaurant_id: maisonElyseId,
      restaurant_slug: "resto-marc",
      name: "Bol Maison Elyse a ne pas afficher",
      category_name: "Plats",
      price: 99,
      sort_order: 2
    }
  ]);

  assert.equal(menu.dishes.length, 1);

  const dish = getPublicMenuDishBySlug(
    menu,
    "bol-de-riz-au-poulet-et-legumes"
  );

  assert.ok(dish);
  assert.equal(dish.name, "Bol de riz au poulet et legumes");
  assert.equal(dish.slug, "bol-de-riz-au-poulet-et-legumes");
  assert.equal(dish.category, "Plats");
  assert.equal(dish.priceLabel, "17,99\u00a0$");
  assert.equal(dish.imageUrl, "/images/resto-marc/bol-riz.jpg");
  assert.deepEqual(dish.ingredients, ["Riz chaud", "Poulet grille"]);
  assert.deepEqual(dish.allergens, ["sesame", "soja"]);
  assert.deepEqual(dish.options, ["Extra sauce maison"]);
  assert.equal(dish.houseNote, "Maison");
  assert.deepEqual(dish.tags, ["Maison", "Populaire"]);
  assert.equal(dish.available, true);
  assert.equal(getPublicMenuDishBySlug(menu, "introuvable"), null);
});

test("maps real photo and 3D/AR fields without inventing missing assets", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restoMarc, [
    {
      id: "bol-id",
      restaurant_id: restoMarcId,
      name: "Bol de riz",
      category_name: "Plats",
      price: 17.99,
      photo_url: "https://cdn.example.test/bol.jpg",
      thumbnail_url: "/images/resto-marc/bol-thumb.jpg",
      web_model_3d_url: "/models/restaurants/resto-marc/bol/v1/web/bol.glb",
      web_model_3d_bytes: 1_572_864,
      ar_model_3d_url: "/models/restaurants/resto-marc/bol/v1/ar-lite/bol.glb",
      ar_model_3d_bytes: 983_040,
      ar_usdz_url: "/models/restaurants/resto-marc/bol/v1/ios/bol.usdz",
      ar_usdz_bytes: 2_621_440
    },
    {
      id: "soupe-id",
      restaurant_id: restoMarcId,
      name: "Soupe du jour",
      category_name: "Entrees",
      price: 7.49,
      photo_url: "ftp://unsafe.example/soupe.jpg",
      model3d_url: ""
    }
  ]);

  const [bol, soupe] = menu.dishes;

  assert.equal(bol.hasPhoto, true);
  assert.equal(bol.photoStatus, "ready");
  assert.equal(bol.imageUrl, "https://cdn.example.test/bol.jpg");
  assert.equal(bol.thumbnailUrl, "/images/resto-marc/bol-thumb.jpg");
  assert.equal(bol.has3d, true);
  assert.equal(bol.hasAr, true);
  assert.equal(bol.hasIosAr, true);
  assert.equal(bol.hasAndroidAr, true);
  assert.equal(bol.webModel3dUrl, "/models/restaurants/resto-marc/bol/v1/web/bol.glb");
  assert.equal(bol.webModel3dBytes, 1_572_864);
  assert.equal(bol.arModel3dUrl, "/models/restaurants/resto-marc/bol/v1/ar-lite/bol.glb");
  assert.equal(bol.arModel3dBytes, 983_040);
  assert.equal(bol.arUsdzUrl, "/models/restaurants/resto-marc/bol/v1/ios/bol.usdz");
  assert.equal(bol.arUsdzBytes, 2_621_440);
  assert.equal(bol.modelStatus, "ready");

  assert.equal(soupe.hasPhoto, false);
  assert.equal(soupe.photoStatus, "missing");
  assert.equal(soupe.imageUrl, "");
  assert.equal(soupe.has3d, false);
  assert.equal(soupe.hasAr, false);
  assert.equal(soupe.modelStatus, "missing");
});

test("builds public dish links without dropping QR table context", () => {
  assert.equal(
    buildPublicDishPath("resto-marc", "bol-de-riz", {
      table: "12",
      zone: "terrasse"
    }),
    "/menu/resto-marc/dishes/bol-de-riz?table=12&zone=terrasse"
  );
  assert.equal(
    buildPublicDishPath("resto-marc", "bol-de-riz", {
      table: "",
      zone: " ".repeat(30)
    }),
    "/menu/resto-marc/dishes/bol-de-riz"
  );
  assert.equal(
    buildPublicDishPath("resto-marc", "bol-de-riz", {
      lang: "en",
      table: "12"
    }),
    "/menu/resto-marc/dishes/bol-de-riz?lang=en&table=12"
  );
  assert.equal(
    buildPublicDishPath("resto-marc", "bol-de-riz", {
      lang: "de"
    }),
    "/menu/resto-marc/dishes/bol-de-riz?lang=fr"
  );
  assert.equal(
    buildPublicDishPath("resto-marc", "bol-de-riz", {
      lang: "en",
      table: "12",
      zone: "terrasse",
      view: "carte"
    }),
    "/menu/resto-marc/dishes/bol-de-riz?lang=en&table=12&zone=terrasse&view=carte"
  );
});
