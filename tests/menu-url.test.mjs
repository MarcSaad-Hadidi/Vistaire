import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPublicMenuPath,
  buildRestaurantDashboardPath,
  buildRestaurantMenuPath
} from "../lib/owner/menuUrlCore.ts";
import { absoluteUrl } from "../lib/seo.ts";

const siteEnv = {
  NEXT_PUBLIC_SITE_URL: "https://www.vistaire.ca/"
};

test("builds public menu paths from restaurant slugs", () => {
  assert.equal(buildRestaurantMenuPath("Maison Elyse"), "/demo?restaurant=maison-elyse");
  assert.equal(buildRestaurantMenuPath("  le comptoir d'été  "), "/demo?restaurant=le-comptoir-d-ete");
  assert.equal(buildRestaurantMenuPath(""), "/demo");
});

test("builds absolute menu URLs from configured site origin only", () => {
  assert.equal(
    absoluteUrl(buildRestaurantMenuPath("Maison Elyse"), siteEnv),
    "https://www.vistaire.ca/demo?restaurant=maison-elyse"
  );
  assert.equal(
    absoluteUrl(buildRestaurantMenuPath("Maison Elyse"), {
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000"
    }),
    "http://localhost:3000/demo?restaurant=maison-elyse"
  );
});

test("builds restaurant dashboard preview paths separately from owner cockpit", () => {
  assert.equal(
    buildRestaurantDashboardPath("restaurant-id"),
    "/owner/restaurants?restaurantId=restaurant-id"
  );
  assert.equal(buildRestaurantDashboardPath(""), "/owner");
});

test("builds Resto Marc public menu paths from restaurant names", () => {
  assert.equal(buildPublicMenuPath("Resto Marc"), "/menu/resto-marc");
  assert.equal(
    buildPublicMenuPath("Resto Marc", { table: "12", zone: "terrasse" }),
    "/menu/resto-marc?table=12&zone=terrasse"
  );
});
