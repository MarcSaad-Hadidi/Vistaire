import fs from "node:fs";

function replaceExactly(path, before, after) {
  const source = fs.readFileSync(path, "utf8");
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${path}: expected one test integration target, found ${occurrences}.`);
  }
  fs.writeFileSync(path, source.replace(before, after));
}

replaceExactly(
  "tests/landing-menu-cache-contract.test.mjs",
  `          dishes: liveMaisonContext.menu.dishes.map((dish) => ({
            ...dish,
            imageUrl: "",
            thumbnailUrl: "",
            posterUrl: "",
            hasPhoto: false,
            photoStatus: "missing"
          }))`,
  `          dishes: liveMaisonContext.menu.dishes.map((dish) => ({
            ...dish,
            cardUrl: "",
            imageUrl: "",
            thumbnailUrl: "",
            posterUrl: "",
            hasPhoto: false,
            photoStatus: "missing"
          }))`
);

replaceExactly(
  "tests/menu-content-route-invalidation.test.mjs",
  `      export function emitMenuMutationRetrySignal() { return Promise.resolve(true); }`,
  `      export function emitMenuMutationRetrySignal(signal) {
        console.error(JSON.stringify(signal));
        return Promise.resolve(true);
      }`
);

replaceExactly(
  "tests/menu-content-route-invalidation.test.mjs",
  `      assert.deepEqual(logged, [
        "Admin availability revalidation failed after commit."
      ]);`,
  `      assert.deepEqual(logged.map((message) => JSON.parse(message)), [
        {
          kind: "menu-revalidation-retry-required",
          restaurantId: RESTAURANT_ID,
          dishId: DISH_ID
        }
      ]);`
);
