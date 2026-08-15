import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSupabasePublicMenu,
  getPublicDishImageUrl
} from "../lib/menu/publicMenuCore.ts";
import { projectLandingMenuUiMenu } from "../lib/landing/landingMenuUiPreview.ts";

const restaurantId = "33333333-3333-4333-8333-333333333333";
const dishId = "84226092-1b25-4174-a635-50e2b8319580";
const sourceSha256 = "a".repeat(64);
const outputSha256 = "b".repeat(64);

const restaurant = {
  id: restaurantId,
  name: "Resto Marc",
  slug: "resto-marc",
  location: "Montreal",
  cuisine_type: "Cuisine maison"
};

function canonicalPhotoUrl(id = dishId) {
  return `/api/public/menu-dishes/${id}/photo`;
}

function v2CardMetadata(overrides = {}) {
  return {
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
        encoder: "sharp-webp-effort-4",
        ...overrides
      }
    }
  };
}

test("maps a valid V2 card derivative to the canonical card URL while preserving display and thumbnail", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restaurant, [
    {
      id: dishId,
      restaurant_id: restaurantId,
      name: "Tartare de saumon",
      image_url: canonicalPhotoUrl(),
      metadata: v2CardMetadata()
    }
  ]);

  const [dish] = menu.dishes;
  assert.equal(
    dish.cardUrl,
    `${canonicalPhotoUrl()}?v=${sourceSha256}&variant=card`
  );
  assert.equal(
    dish.imageUrl,
    `${canonicalPhotoUrl()}?v=${sourceSha256}&variant=display`
  );
  assert.equal(
    dish.thumbnailUrl,
    `${canonicalPhotoUrl()}?v=${sourceSha256}&variant=thumbnail`
  );
});

test("keeps legacy and invalid V2 card metadata on the original image URL", () => {
  const legacyImageUrl = "/images/resto-marc/tartare.jpg";
  const menu = buildSupabasePublicMenu("resto-marc", restaurant, [
    {
      id: "legacy-dish",
      restaurant_id: restaurantId,
      name: "Photo legacy",
      image_url: legacyImageUrl,
      metadata: { photoSha256: sourceSha256 }
    },
    {
      id: dishId,
      restaurant_id: restaurantId,
      name: "Carte V2 invalide",
      image_url: canonicalPhotoUrl(),
      metadata: v2CardMetadata({ variant: "thumbnail" })
    }
  ]);

  assert.equal(menu.dishes[0].cardUrl, legacyImageUrl);
  assert.equal(menu.dishes[1].cardUrl, canonicalPhotoUrl());
});

test("rejects V2 card metadata whose storage path is not immutable recipe output", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restaurant, [
    {
      id: dishId,
      restaurant_id: restaurantId,
      name: "Carte V2 au chemin invalide",
      image_url: canonicalPhotoUrl(),
      metadata: v2CardMetadata({
        storagePath: `restaurants/${restaurantId}/photos/derivatives/${sourceSha256}/card-${outputSha256}.webp`
      })
    }
  ]);

  assert.equal(menu.dishes[0].cardUrl, canonicalPhotoUrl());
});

test("selects thumbnail for compact surfaces, card for cards, and display for details", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restaurant, [
    {
      id: dishId,
      restaurant_id: restaurantId,
      name: "Tartare de saumon",
      image_url: canonicalPhotoUrl(),
      metadata: v2CardMetadata()
    }
  ]);
  const [dish] = menu.dishes;

  assert.equal(
    getPublicDishImageUrl(dish, "thumbnail"),
    `${canonicalPhotoUrl()}?v=${sourceSha256}&variant=thumbnail`
  );
  assert.equal(
    getPublicDishImageUrl(dish, "card"),
    `${canonicalPhotoUrl()}?v=${sourceSha256}&variant=card`
  );
  assert.equal(
    getPublicDishImageUrl(dish, "display"),
    `${canonicalPhotoUrl()}?v=${sourceSha256}&variant=display`
  );
});

test("projects the card contract into shared landing menu render data", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restaurant, [
    {
      id: dishId,
      restaurant_id: restaurantId,
      name: "Tartare de saumon",
      image_url: canonicalPhotoUrl(),
      metadata: v2CardMetadata()
    }
  ]);

  assert.equal(
    projectLandingMenuUiMenu(menu).dishes[0].cardUrl,
    `${canonicalPhotoUrl()}?v=${sourceSha256}&variant=card`
  );
});
