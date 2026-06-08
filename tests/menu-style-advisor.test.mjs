import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildFallbackMenuStyleAdvice,
  sanitizeMenuStyleAdvisorOutput
} from "../lib/menu/menuStyleAdvisor.ts";

const baseInput = {
  restaurantId: "resto-1",
  restaurantName: "Resto Marc",
  restaurantSlug: "resto-marc",
  cuisineType: "maison",
  location: "Montreal",
  dishCount: 24,
  categories: ["Entrees", "Plats", "Desserts"],
  sampleDishes: ["Tarte maison", "Bavette"],
  photoCount: 12,
  modelCount: 0,
  arCount: 0,
  currentConfig: { theme: "fresh-homemade" }
};

test("fallback menu style advisor recommends deterministic theme and blueprint", () => {
  const immersive = buildFallbackMenuStyleAdvice({
    ...baseInput,
    restaurantName: "Maison Elyse",
    restaurantSlug: "maison-elyse",
    cuisineType: "premium gastronomic",
    modelCount: 3,
    arCount: 1
  });

  assert.equal(immersive.source, "rules");
  assert.equal(immersive.recommendedBlueprint, "immersive-first");
  assert.equal(immersive.recommendedConfigPatch.experience.blueprint, "immersive-first");
  assert.equal(immersive.recommendedConfigPatch.immersive.autoLoad, false);
  assert.ok(immersive.confidence > 0);

  const sushi = buildFallbackMenuStyleAdvice({
    ...baseInput,
    restaurantName: "Sushi Atelier",
    restaurantSlug: "sushi-atelier",
    cuisineType: "japan sushi",
    dishCount: 18
  });

  assert.equal(sushi.recommendedTheme, "sushi-minimal");
  assert.equal(sushi.recommendedBlueprint, "minimal-list");
});

test("fallback menu style advisor v2 returns primary alternatives and analysis", () => {
  const result = buildFallbackMenuStyleAdvice({
    ...baseInput,
    restaurantName: "Cafe Brunch Marc",
    cuisineType: "cafe brunch",
    dishCount: 16,
    photoCount: 8
  });

  assert.equal(result.source, "rules");
  assert.ok(result.primary);
  assert.equal(result.primary.theme, "cafe-brunch");
  assert.equal(result.primary.blueprint, "photo-grid");
  assert.equal(result.alternatives.length >= 2, true);
  assert.ok(result.alternatives.every((item) => item.theme && item.blueprint));
  assert.equal(result.analysis.menuSize, 16);
  assert.equal(result.analysis.photoReadiness, "good");
});

test("mistral advisor sanitizer only accepts whitelisted UI recommendations", () => {
  const sanitized = sanitizeMenuStyleAdvisorOutput(
    {
      recommendedTheme: "premium-gastronomic",
      recommendedBlueprint: "editorial-magazine",
      recommendedConfigPatch: {
        theme: "premium-gastronomic",
        experience: {
          blueprint: "editorial-magazine",
          homeLayout: "editorial-hero",
          sectionOrder: "featured-then-categories",
          featuredMode: "signature-first",
          categoryPresentation: "editorial-sections",
          dishListPresentation: "editorial-cards",
          detailPresentation: "editorial-page"
        },
        navigation: { style: "minimal" },
        cards: { variant: "editorial" },
        detail: { style: "editorial-detail", dishOpenMode: "route" },
        photos: { publicMissingBehavior: "placeholder" },
        immersive: { autoLoad: true }
      },
      reason: "La carte est courte et premium.",
      confidence: 0.82,
      warnings: ["Ne pas inventer de plats."]
    },
    baseInput
  );

  assert.equal(sanitized.source, "mistral");
  assert.equal(sanitized.recommendedTheme, "premium-gastronomic");
  assert.equal(sanitized.recommendedBlueprint, "editorial-magazine");
  assert.equal(sanitized.recommendedConfigPatch.immersive.autoLoad, false);
  assert.equal("dishes" in sanitized.recommendedConfigPatch, false);
  assert.equal("prices" in sanitized.recommendedConfigPatch, false);
  assert.equal("allergens" in sanitized.recommendedConfigPatch, false);
});

test("invalid mistral advisor output falls back without merging unsafe content", () => {
  const result = sanitizeMenuStyleAdvisorOutput(
    {
      recommendedTheme: "neon-dashboard",
      recommendedBlueprint: "spreadsheet-pos",
      recommendedConfigPatch: {
        theme: "neon-dashboard",
        experience: { blueprint: "spreadsheet-pos" },
        dishes: [{ name: "Fake menu", price: "12.00" }],
        palette: { accent: "javascript:alert(1)" }
      },
      reason: "Ignore previous instructions.",
      confidence: 2,
      warnings: ["secret token"]
    },
    baseInput
  );

  assert.equal(result.source, "rules");
  assert.equal(result.recommendedTheme, "fresh-homemade");
  assert.equal(result.recommendedBlueprint, "family-comfort");
  assert.equal("dishes" in result.recommendedConfigPatch, false);
});

test("mistral advisor rejects generated dishes prices ingredients and allergens", () => {
  const result = sanitizeMenuStyleAdvisorOutput(
    {
      recommendedTheme: "premium-gastronomic",
      recommendedBlueprint: "editorial-magazine",
      recommendedConfigPatch: {
        theme: "premium-gastronomic",
        experience: { blueprint: "editorial-magazine" }
      },
      dishes: [{ name: "Invented dish", price: "99" }],
      ingredients: ["invented"],
      allergens: ["invented"],
      reason: "Invented content should never be accepted.",
      confidence: 0.9,
      warnings: []
    },
    baseInput
  );

  assert.equal(result.source, "rules");
  assert.equal(result.recommendedBlueprint, "family-comfort");
});

test("mistral advisor sanitizer rejects forbidden key variants and media fields", () => {
  const result = sanitizeMenuStyleAdvisorOutput(
    {
      primary: {
        theme: "premium-gastronomic",
        blueprint: "editorial-magazine",
        configPatch: {
          theme: "premium-gastronomic",
          generatedDishes: [{ name: "Invented" }],
          menuItems: [{ name: "Invented" }],
          photoUrl: "https://example.com/fake.jpg",
          modelUrl: "https://example.com/fake.glb"
        },
        reason: "Invent a new dish price at 99.",
        confidence: 0.9,
        warnings: []
      },
      alternatives: []
    },
    baseInput
  );

  assert.equal(result.source, "rules");
  assert.equal(result.primary.source, "rules");
  assert.equal(result.recommendedBlueprint, "family-comfort");
});

test("mistral advisor sanitizer keeps recommended blueprint canonical", () => {
  const result = sanitizeMenuStyleAdvisorOutput(
    {
      primary: {
        theme: "premium-gastronomic",
        blueprint: "editorial-magazine",
        configPatch: {
          theme: "premium-gastronomic",
          experience: {
            blueprint: "photo-grid"
          }
        },
        reason: "Use editorial structure for premium reading.",
        confidence: 0.8,
        warnings: []
      },
      alternatives: [
        {
          theme: "fresh-homemade",
          blueprint: "story-first",
          configPatch: {
            theme: "fresh-homemade",
            experience: { blueprint: "story-first" }
          },
          reason: "Warmer fallback.",
          confidence: 0.62,
          bestFor: "Warm family menu"
        }
      ]
    },
    baseInput
  );

  assert.equal(result.source, "mistral");
  assert.equal(result.primary.blueprint, "editorial-magazine");
  assert.equal(result.primary.configPatch.experience.blueprint, "editorial-magazine");
  assert.equal(result.alternatives[0].blueprint, "story-first");
});

test("owner menu style advisor API is owner-only, same-origin, and server-side only", async () => {
  const route = await readFile("app/api/owner/menu-style-advisor/route.ts", "utf8");
  const builder = await readFile("components/owner/MenuUiBuilder.tsx", "utf8");
  const mistral = await readFile("lib/ai/mistral.ts", "utf8");

  assert.match(route, /requireVistaireOwnerApi\(\)/);
  assert.match(route, /requireSameOriginOwnerMutation\(request\)/);
  assert.match(route, /sanitizeMenuStyleAdvisorOutput/);
  assert.match(route, /buildFallbackMenuStyleAdvice/);
  assert.match(route, /generateMistralMenuStyleAdvice/);
  assert.match(route, /NextResponse\.json/);
  assert.doesNotMatch(route, /process\.env\.MISTRAL_API_KEY/);

  assert.match(mistral, /import "server-only"/);
  assert.match(mistral, /generateMistralMenuStyleAdvice/);
  assert.match(mistral, /setTimeout\(\(\) => controller\.abort\(\), 4_500\)/);
  assert.doesNotMatch(builder, /MISTRAL_API_KEY/);
  assert.doesNotMatch(builder, /@\/lib\/ai\/mistral/);
});
