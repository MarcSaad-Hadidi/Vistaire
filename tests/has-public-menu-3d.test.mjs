import test from "node:test";
import assert from "node:assert/strict";

test("hasPublicMenu3d only accepts safe web or ar-lite model URLs", async () => {
  const { hasPublicMenu3d } = await import("../lib/menu/hasPublicMenu3d.ts");

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
});

test("dish card 3D badge stays decorative and non-interactive", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile("components/menu/DishCard3dBadge.tsx", "utf8")
  );
  const css = await import("node:fs/promises").then(({ readFile }) =>
    readFile("components/menu/DishCard3dBadge.module.css", "utf8")
  );

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
  assert.doesNotMatch(maison, /DishCard3dBadge/);
  assert.doesNotMatch(renderer, /DishCard3dBadge/);
});
