import test from "node:test";
import assert from "node:assert/strict";

test("hasPublicMenu3d only accepts safe web or ar-lite model URLs", async (t) => {
  const previousOrigins = process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS;
  process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS = " https://models.example///,https://other.example https://bad.example/path http://insecure.example ";
  t.after(() => {
    if (previousOrigins === undefined) delete process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS;
    else process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS = previousOrigins;
  });
  const { hasPublicMenu3d, hasPublicMenuAr } = await import("../lib/dish3dManifest.ts");

  const baseDish = {
    id: "dish-1",
    slug: "dish-1",
    name: "Dish",
    description: "",
    category: "main",
    priceLabel: "",
    available: true,
    imageUrl: "",
    thumbnailUrl: "",
    tags: [],
    allergens: [],
    ingredients: [],
    houseNote: "",
    model3dUrl: "",
    webModel3dUrl: "",
    arModel3dUrl: "",
    usdzUrl: "",
    arUsdzUrl: "",
    has3d: false,
    hasAr: false,
    hasImmersive: false,
    hasIosAr: false,
    hasAndroidAr: false,
    hasPhoto: false
  };

  assert.equal(
    hasPublicMenu3d({
      ...baseDish,
      webModel3dUrl: "/models/demo/dish.glb"
    }),
    true
  );

  assert.equal(hasPublicMenu3d(baseDish), false);

  assert.equal(
    hasPublicMenu3d({
      ...baseDish,
      webModel3dUrl: "https://evil.example/dish.glb"
    }),
    false
  );

  const usdzOnlyDish = { ...baseDish, arUsdzUrl: "/models/demo/ar-lite/dish.usdz" };
  assert.equal(hasPublicMenu3d(usdzOnlyDish), false, "a USDZ alone is not a web 3D model");
  assert.equal(hasPublicMenuAr(usdzOnlyDish), true, "a safe Quick Look USDZ enables AR");
  assert.equal(hasPublicMenuAr({ ...baseDish, arUsdzUrl: "https://evil.example/dish.usdz" }), false);
  assert.equal(hasPublicMenuAr(baseDish), false);

  assert.equal(hasPublicMenu3d({ ...baseDish, webModel3dUrl: "https://models.example/dish.glb" }), true);
  assert.equal(hasPublicMenuAr({ ...baseDish, arUsdzUrl: "https://other.example/dish.usdz" }), true);
  assert.equal(hasPublicMenu3d({ ...baseDish, webModel3dUrl: "https://bad.example/dish.glb" }), false);
  assert.equal(hasPublicMenu3d({ ...baseDish, webModel3dUrl: "http://insecure.example/dish.glb" }), false);
  process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS = "https://late.example";
  assert.equal(hasPublicMenu3d({ ...baseDish, webModel3dUrl: "https://models.example/dish.glb" }), true);
  assert.equal(hasPublicMenu3d({ ...baseDish, webModel3dUrl: "https://late.example/dish.glb" }), false);
});

test("dish card 3D badge stays decorative and non-interactive", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("components/menu/DishCard3dBadge.tsx", "utf8");
  const css = await readFile("components/menu/DishCard3dBadge.module.css", "utf8");

  assert.match(source, /DishCard3dBadge/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /focusable="false"/);
  assert.match(source, />3D</);
  assert.doesNotMatch(source, /<button/);
  assert.doesNotMatch(source, /tabIndex/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /position:\s*absolute/);
});

test("public menu renderers mount the shared 3D badge on dish visuals", async () => {
  const { readFile } = await import("node:fs/promises");
  const [trouvable, maison, renderer] = await Promise.all([
    readFile("components/menu/TrouvablePremiumMenuExperience.tsx", "utf8"),
    readFile("components/menu/MaisonElyseQrMenu.tsx", "utf8"),
    readFile("components/menu/PublicMenuRenderer.tsx", "utf8")
  ]);

  assert.match(trouvable, /DishCard3dBadge/);
  assert.match(trouvable, /hasPublicMenu3d\(dish\)/);
  assert.match(trouvable, /dishPriceRow/);
  assert.doesNotMatch(trouvable, /cardDetailsTrigger/);
  assert.doesNotMatch(maison, /DishCard3dBadge/);
  assert.doesNotMatch(renderer, /DishCard3dBadge/);
});
