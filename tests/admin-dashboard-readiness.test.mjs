import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildAdminMenuReadiness } from "../lib/admin/menuReadiness.ts";

const categories = [
  { id: "starters", label: "Entrées", slug: "entrees" },
  { id: "mains", label: "Plats", slug: "plats" }
];

function dish(overrides) {
  return {
    id: "dish",
    slug: "dish",
    name: "Plat",
    category: "Plats",
    description: "Une description utile.",
    priceLabel: "18,00 $",
    priceCents: 1800,
    imageUrl: "/images/dish.jpg",
    thumbnailUrl: "/images/dish.jpg",
    hasPhoto: true,
    photoStatus: "ready",
    hasImmersive: false,
    has3d: false,
    hasAr: false,
    available: true,
    ...overrides
  };
}

const dishes = [
  dish({ id: "complete", slug: "complete" }),
  dish({
    id: "missing-price",
    slug: "missing-price",
    priceLabel: "",
    priceCents: 0,
    imageUrl: "",
    thumbnailUrl: "",
    hasPhoto: false,
    photoStatus: "missing"
  }),
  dish({
    id: "missing-description",
    slug: "missing-description",
    description: "",
    hasImmersive: true,
    has3d: true
  }),
  dish({
    id: "unavailable",
    slug: "unavailable",
    available: false,
    imageUrl: "",
    thumbnailUrl: "",
    hasPhoto: false,
    photoStatus: "missing"
  })
];

test("builds deterministic restaurant menu readiness counts and priorities", () => {
  const summary = buildAdminMenuReadiness(categories, dishes);

  assert.deepEqual(summary.counts, {
    categories: 2,
    dishes: 4,
    available: 3,
    unavailable: 1,
    missingPrice: 1,
    missingDescription: 1,
    missingPhoto: 2,
    withPhoto: 2,
    withImmersive: 1
  });
  assert.equal(summary.actions[0].kind, "missing-price");
  assert.ok(summary.score >= 0 && summary.score <= 100);
});

test("empty menus have a finite zero score and a concrete setup action", () => {
  const summary = buildAdminMenuReadiness([], []);

  assert.equal(summary.score, 0);
  assert.equal(Number.isFinite(summary.score), true);
  assert.equal(summary.counts.dishes, 0);
  assert.ok(summary.actions.length > 0);
});

test("admin dashboard stays locked without a QR session and remains noindex", async () => {
  const page = await readFile("app/admin/page.tsx", "utf8");
  const layout = await readFile("app/admin/layout.tsx", "utf8");

  assert.match(page, /requireAdminRestaurantAccess\("dashboard:read"\)/);
  assert.match(page, /Accès dashboard restaurant requis/);
  assert.match(page, /Scannez le QR admin interne de votre restaurant\./);
  assert.doesNotMatch(page, /getDemoRestaurantId|searchParams/);
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /noarchive:\s*true/);
});
