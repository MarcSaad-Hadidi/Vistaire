import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createRestaurantRecord,
  validateCreateRestaurantInput
} from "../lib/owner/restaurantCreation.ts";

const validInput = {
  name: "Le Comptoir d'ete",
  slug: "Le Comptoir d'ete",
  location: "Montreal",
  cuisineType: "Cuisine de saison",
  status: "setup_needed",
  contactName: "Camille",
  contactEmail: "camille@example.com",
  contactPhone: "+1 514 555 0123",
  notes: " ".repeat(20) + "Ouverture terrasse"
};

const persistedId = "11111111-2222-4333-8444-555555555555";

function insertClient({
  data = null,
  error = null,
  updateError = null,
  onInsert = () => {},
  onUpdate = () => {}
} = {}) {
  return {
    from(table) {
      assert.equal(table, "restaurants");
      return {
        insert(row) {
          onInsert(row);
          return {
            select(columns) {
              assert.equal(columns, "*");
              return {
                async single() {
                  return { data, error };
                }
              };
            }
          };
        },
        update(row) {
          return {
            async eq(column, value) {
              onUpdate({ row, column, value });
              return { data: null, error: updateError };
            }
          };
        }
      };
    }
  };
}

function creationClient({
  restaurantData,
  restaurantError = null,
  restaurantUpdateError = null,
  dishError = null,
  onRestaurantInsert = () => {},
  onRestaurantUpdate = () => {},
  onDishInsert = () => {}
} = {}) {
  return {
    from(table) {
      if (table === "restaurants") {
        return {
          insert(row) {
            onRestaurantInsert(row);
            return {
              select(columns) {
                assert.equal(columns, "*");
                return {
                  async single() {
                    return { data: restaurantData, error: restaurantError };
                  }
                };
              }
            };
          },
          update(row) {
            return {
              async eq(column, value) {
                onRestaurantUpdate({ row, column, value });
                return { data: null, error: restaurantUpdateError };
              }
            };
          }
        };
      }

      if (table === "menu_dishes") {
        return {
          async insert(rows) {
            onDishInsert(rows);
            return { data: null, error: dishError };
          }
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }
  };
}

test("validates restaurant creation input with normalized slug and setup fallback", () => {
  const result = validateCreateRestaurantInput({
    ...validInput,
    slug: "",
    status: "unexpected",
    googleReviewUrl: "https://g.page/r/CYEXAMPLE/review",
    notes: "x".repeat(900)
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.slug, "le-comptoir-d-ete");
  assert.equal(result.value.status, "setup_needed");
  assert.equal(result.value.googleReviewUrl, "https://g.page/r/CYEXAMPLE/review");
  assert.equal(result.value.notes.length, 800);
});

test("rejects missing restaurant name, invalid contact email, and invalid Google Reviews links", () => {
  assert.deepEqual(validateCreateRestaurantInput({ ...validInput, name: " " }), {
    ok: false,
    error: "Nom du restaurant requis."
  });
  assert.deepEqual(
    validateCreateRestaurantInput({ ...validInput, contactEmail: "not-an-email" }),
    {
      ok: false,
      error: "Email contact invalide."
    }
  );
  assert.deepEqual(
    validateCreateRestaurantInput({
      ...validInput,
      googleReviewUrl: "https://example.com/review"
    }),
    {
      ok: false,
      error: "Lien Google Reviews invalide."
    }
  );
});

test("restaurant creation validates dish photo URLs before persistence", () => {
  const baseWorkflowInput = {
    ...validInput,
    sections: [{ name: "Plats", description: "", order: 1 }],
    dishes: [
      {
        name: "Bar de ligne",
        section: "Plats",
        price: 14.99,
        description: "Fenouil confit, beurre blanc citronne.",
        available: true,
        photoStatus: "planned"
      }
    ]
  };

  for (const imageUrl of [
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "http://cdn.example.com/photo.jpg",
    "//evil.com/photo.jpg",
    "/restaurants\\photo.jpg",
    "https://cdn.example.com\\photo.jpg",
    "https://user:pass@cdn.example.com/photo.jpg"
  ]) {
    const result = validateCreateRestaurantInput({
      ...baseWorkflowInput,
      dishes: [{ ...baseWorkflowInput.dishes[0], imageUrl }]
    });

    assert.deepEqual(
      result,
      {
        ok: false,
        error: "URL photo invalide. Utilisez une URL https ou un chemin interne."
      },
      imageUrl
    );
  }

  for (const imageUrl of [
    "https://cdn.example.com/photo.jpg",
    "/restaurants/demo/photos/photo.jpg"
  ]) {
    const result = validateCreateRestaurantInput({
      ...baseWorkflowInput,
      dishes: [{ ...baseWorkflowInput.dishes[0], imageUrl }]
    });

    assert.equal(result.ok, true, imageUrl);
    assert.equal(result.value.dishes[0].imageUrl, imageUrl);
  }
});

test("restaurant creation refuses to fake production success without Supabase", async () => {
  const result = await createRestaurantRecord(validInput, {
    admin: {
      ok: false,
      reason:
        "Supabase server credentials are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    },
    getColumns: async () => new Set()
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /Supabase/);
});

test("restaurant creation returns a clear duplicate slug error", async () => {
  const result = await createRestaurantRecord(validInput, {
    admin: {
      ok: true,
      client: insertClient({
        error: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "restaurants_slug_key"'
        }
      })
    },
    getColumns: async () => new Set(["name", "slug", "contact_email"])
  });

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Ce slug public existe deja. Choisissez un slug unique."
  });
});

test("restaurant creation treats a successful insert without UUID id as invalid", async () => {
  const result = await createRestaurantRecord(validInput, {
    admin: {
      ok: true,
      client: insertClient({
        data: {
          slug: "le-comptoir-d-ete",
          name: "Le Comptoir d'ete"
        }
      })
    },
    getColumns: async () => new Set()
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /identifiant Supabase/);
});

test("restaurant creation returns persisted Supabase restaurant links", async () => {
  let insertedRow;
  let mediaUpdate;
  const result = await createRestaurantRecord(
    {
      ...validInput,
      googleReviewUrl:
        "https://search.google.com/local/writereview?placeid=abc123"
    },
    {
    admin: {
      ok: true,
      client: insertClient({
        onInsert(row) {
          insertedRow = row;
        },
        onUpdate(update) {
          mediaUpdate = update;
        },
        data: {
          id: persistedId,
          name: "Le Comptoir d'ete",
          slug: "le-comptoir-d-ete",
          location: "Montreal",
          cuisine_type: "Cuisine de saison",
          status: "setup_needed",
          contact_name: "Camille",
          contact_email: "camille@example.com",
          contact_phone: "+1 514 555 0123",
          google_review_enabled: true,
          google_review_url:
            "https://search.google.com/local/writereview?placeid=abc123",
          notes: "Ouverture terrasse",
          created_at: "2026-06-05T12:00:00.000Z"
        }
      })
    },
    getColumns: async () =>
      new Set([
        "name",
        "slug",
        "location",
        "cuisine_type",
        "status",
        "contact_name",
        "contact_email",
        "contact_phone",
        "google_review_enabled",
        "google_review_url",
        "notes",
        "media_base_path"
      ])
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.persisted, true);
  assert.equal(result.dataSource, "supabase");
  assert.equal(result.restaurant.id, persistedId);
  assert.equal(result.restaurant.slug, "le-comptoir-d-ete");
  assert.match(result.restaurant.menuUrl, /\/menu\/le-comptoir-d-ete$/);
  assert.equal(
    result.restaurant.dashboardHref,
    `/owner/restaurants/${persistedId}`
  );
  assert.equal(result.restaurant.qrStatus, "generable");
  assert.equal(insertedRow.slug, "le-comptoir-d-ete");
  assert.equal(insertedRow.contact_email, "camille@example.com");
  assert.equal(insertedRow.google_review_enabled, true);
  assert.equal(
    insertedRow.google_review_url,
    "https://search.google.com/local/writereview?placeid=abc123"
  );
  assert.equal(result.restaurantPersisted, true);
  assert.equal(result.sectionsPersisted, true);
  assert.equal(result.dishesPersisted, true);
  assert.equal(result.persistedDishCount, 0);
  assert.equal(result.mediaBasePath, `restaurants/${persistedId}/photos/`);
  assert.equal(result.mediaBasePathPersisted, true);
  assert.equal(mediaUpdate.column, "id");
  assert.equal(mediaUpdate.value, persistedId);
  assert.deepEqual(mediaUpdate.row, {
    media_base_path: `restaurants/${persistedId}/photos/`
  });
  assert.equal(
    result.qrCodesHref,
    `/owner/restaurants/${persistedId}/qr`
  );
  assert.deepEqual(result.warnings, []);
});

test("restaurant creation persists menu dishes without creation-only 3D or AR fields", async () => {
  let insertedDishes = [];
  const result = await createRestaurantRecord(
    {
      ...validInput,
      menuLanguages: ["fr", "en"],
      sections: [
        { name: "Entrees", description: "Ouvertures de saison", order: 1 },
        { name: "Plats", description: "Assiettes signatures", order: 2 }
      ],
      dishes: [
        {
          name: "Betteraves roties",
          section: "Entrees",
          price: 18,
          description: "Creme crue, vinaigrette aux agrumes.",
          ingredients: ["betterave"],
          allergens: ["lait"],
          tags: ["Maison"],
          options: [],
          chefNote: "",
          available: true,
          photoStatus: "planned"
        },
        {
          name: "Bar de ligne",
          section: "Plats",
          price: 34,
          description: "Fenouil confit, beurre blanc citronne.",
          imageUrl: "/restaurants/le-comptoir/photos/bar.jpg",
          ingredients: ["bar", "fenouil", "citron"],
          allergens: ["poisson", "lait"],
          tags: ["Signature"],
          options: ["Sans lactose sur demande"],
          chefNote: "Servir bien chaud.",
          available: true,
          photoStatus: "ready"
        }
      ]
    },
    {
      admin: {
        ok: true,
        client: creationClient({
          onDishInsert(rows) {
            insertedDishes = rows;
          },
          restaurantData: {
            id: persistedId,
            name: "Le Comptoir d'ete",
            slug: "le-comptoir-d-ete",
            location: "Montreal",
            cuisine_type: "Cuisine de saison",
            status: "setup_needed",
            contact_name: "Camille",
            contact_email: "camille@example.com",
            contact_phone: "+1 514 555 0123"
          }
        })
      },
      getColumns: async (table) =>
        table === "menu_dishes"
          ? new Set([
              "restaurant_id",
              "restaurant_slug",
              "name",
              "description",
              "category_name",
              "price",
              "available",
              "sort_order",
              "image_url",
              "ingredients",
              "allergens",
              "options",
              "house_note",
              "tags",
              "photo_status"
            ])
          : new Set([
              "name",
              "slug",
              "location",
              "cuisine_type",
              "status",
              "contact_name",
              "contact_email",
              "contact_phone",
              "media_base_path"
            ])
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.restaurantPersisted, true);
  assert.equal(result.sectionsPersisted, true);
  assert.equal(result.dishesPersisted, true);
  assert.equal(result.persistedDishCount, 2);
  assert.equal(result.mediaBasePath, `restaurants/${persistedId}/photos/`);
  assert.equal(result.mediaBasePathPersisted, true);
  assert.equal(
    result.qrCodesHref,
    `/owner/restaurants/${persistedId}/qr`
  );
  assert.deepEqual(result.warnings, [
    "Les sections sont persistees comme categories de plats; leurs descriptions restent dans le draft owner."
  ]);
  assert.equal(insertedDishes.length, 2);
  assert.equal(insertedDishes[0].restaurant_id, persistedId);
  assert.equal(insertedDishes[0].restaurant_slug, "le-comptoir-d-ete");
  assert.equal(insertedDishes[0].category_name, "Entrees");
  assert.equal(insertedDishes[1].category_name, "Plats");
  assert.equal(insertedDishes[1].image_url, "/restaurants/le-comptoir/photos/bar.jpg");
  assert.deepEqual(insertedDishes[1].ingredients, ["bar", "fenouil", "citron"]);
  assert.deepEqual(insertedDishes[1].tags, ["Signature"]);
  assert.equal(insertedDishes[1].house_note, "Servir bien chaud.");
  for (const dish of insertedDishes) {
    for (const key of Object.keys(dish)) {
      assert.doesNotMatch(key, /3d|immersive|model|usdz|glb|ar_url|has_ar/i);
    }
  }
});

test("restaurant creation keeps rich menu dish fallback columns when column discovery is empty", async () => {
  let insertedDishes = [];
  const result = await createRestaurantRecord(
    {
      ...validInput,
      sections: [{ name: "Plats", description: "", order: 1 }],
      dishes: [
        {
          name: "Bar de ligne",
          section: "Plats",
          price: 14.99,
          description: "Fenouil confit, beurre blanc citronne.",
          imageUrl: "https://cdn.example.com/bar.jpg",
          ingredients: ["bar", "fenouil", "citron"],
          allergens: ["poisson", "lait"],
          tags: ["Signature"],
          options: ["Sans lactose sur demande"],
          chefNote: "Servir bien chaud.",
          available: true,
          photoStatus: "ready"
        }
      ]
    },
    {
      admin: {
        ok: true,
        client: creationClient({
          onDishInsert(rows) {
            insertedDishes = rows;
          },
          restaurantData: {
            id: persistedId,
            name: "Le Comptoir d'ete",
            slug: "le-comptoir-d-ete",
            status: "setup_needed",
            contact_email: "camille@example.com"
          }
        })
      },
      getColumns: async (table) =>
        table === "menu_dishes" ? new Set() : new Set(["media_base_path"])
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.dishesPersisted, true);
  assert.equal(result.mediaBasePathPersisted, true);
  assert.equal(insertedDishes.length, 1);
  assert.deepEqual(insertedDishes[0], {
    restaurant_id: persistedId,
    restaurant_slug: "le-comptoir-d-ete",
    name: "Bar de ligne",
    description: "Fenouil confit, beurre blanc citronne.",
    category_name: "Plats",
    price: 14.99,
    available: true,
    sort_order: 1,
    image_url: "https://cdn.example.com/bar.jpg",
    thumbnail_url: "https://cdn.example.com/bar.jpg",
    ingredients: ["bar", "fenouil", "citron"],
    allergens: ["poisson", "lait"],
    options: ["Sans lactose sur demande"],
    house_note: "Servir bien chaud.",
    tags: ["Signature"],
    photo_status: "ready"
  });
  for (const key of Object.keys(insertedDishes[0])) {
    assert.doesNotMatch(key, /3d|immersive|model|usdz|glb|ar_url|has_ar/i);
  }
});

test("restaurant creation warns when media base path has no compatible restaurants column", async () => {
  const result = await createRestaurantRecord(validInput, {
    admin: {
      ok: true,
      client: insertClient({
        data: {
          id: persistedId,
          name: "Le Comptoir d'ete",
          slug: "le-comptoir-d-ete",
          status: "setup_needed",
          contact_email: "camille@example.com"
        }
      })
    },
    getColumns: async () => new Set(["name", "slug", "contact_email"])
  });

  assert.equal(result.ok, true);
  assert.equal(result.mediaBasePath, `restaurants/${persistedId}/photos/`);
  assert.equal(result.mediaBasePathPersisted, false);
  assert.match(
    result.warnings.join("\n"),
    /Chemin media calcule mais non sauvegarde dans restaurants/
  );
});

test("restaurant creation warns when sections have no persisted dish row", async () => {
  const result = await createRestaurantRecord(
    {
      ...validInput,
      sections: [
        { name: "Entrees", description: "Ouvertures de saison", order: 1 },
        { name: "Plats", description: "Assiettes signatures", order: 2 }
      ],
      dishes: [
        {
          name: "Bar de ligne",
          section: "Plats",
          price: 34,
          description: "Fenouil confit, beurre blanc citronne.",
          ingredients: ["bar", "fenouil", "citron"],
          allergens: ["poisson", "lait"],
          tags: ["Signature"],
          options: [],
          available: true,
          photoStatus: "planned"
        }
      ]
    },
    {
      admin: {
        ok: true,
        client: creationClient({
          restaurantData: {
            id: persistedId,
            name: "Le Comptoir d'ete",
            slug: "le-comptoir-d-ete",
            status: "setup_needed",
            contact_email: "camille@example.com"
          }
        })
      },
      getColumns: async (table) =>
        table === "menu_dishes"
          ? new Set([
              "restaurant_id",
              "restaurant_slug",
              "name",
              "description",
              "category_name",
              "price",
              "available",
              "sort_order"
            ])
          : new Set()
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.restaurantPersisted, true);
  assert.equal(result.dishesPersisted, true);
  assert.equal(result.sectionsPersisted, false);
  assert.equal(result.persistedDishCount, 1);
  assert.match(result.warnings.join("\n"), /sections sans plat n'ont pas de ligne persistante/i);
  assert.match(result.warnings.join("\n"), /Entrees/);
});

test("restaurant creation reports menu dish persistence warnings without faking dish success", async () => {
  const result = await createRestaurantRecord(
    {
      ...validInput,
      sections: [{ name: "Entrees", description: "", order: 1 }],
      dishes: [
        {
          name: "Betteraves roties",
          section: "Entrees",
          price: 18,
          description: "Creme crue, vinaigrette aux agrumes.",
          ingredients: ["betterave"],
          allergens: ["lait"],
          tags: ["Maison"],
          options: [],
          available: true,
          photoStatus: "planned"
        }
      ]
    },
    {
      admin: {
        ok: true,
        client: creationClient({
          restaurantData: {
            id: persistedId,
            name: "Le Comptoir d'ete",
            slug: "le-comptoir-d-ete",
            status: "setup_needed",
            contact_email: "camille@example.com"
          },
          dishError: {
            message: "relation menu_dishes does not exist"
          }
        })
      },
      getColumns: async () => new Set()
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.restaurantPersisted, true);
  assert.equal(result.sectionsPersisted, false);
  assert.equal(result.dishesPersisted, false);
  assert.equal(result.persistedDishCount, 0);
  assert.match(result.warnings.join("\n"), /plats n'ont pas pu etre persistes/i);
});

test("restaurant POST route is guarded and exposes persistence metadata", async () => {
  const source = await readFile("app/api/restaurants/route.ts", "utf8");

  assert.match(source, /requireVistaireOwnerApi/);
  assert.match(source, /requireSameOriginOwnerMutation\(request\)/);
  assert.match(source, /persisted: created\.persisted/);
  assert.match(source, /dataSource: created\.dataSource/);
  assert.match(source, /restaurantPersisted: created\.restaurantPersisted/);
  assert.match(source, /sectionsPersisted: created\.sectionsPersisted/);
  assert.match(source, /dishesPersisted: created\.dishesPersisted/);
  assert.match(source, /persistedDishCount: created\.persistedDishCount/);
  assert.match(source, /mediaBasePath: created\.mediaBasePath/);
  assert.match(source, /mediaBasePathPersisted: created\.mediaBasePathPersisted/);
  assert.match(source, /qrCodesHref: created\.qrCodesHref/);
  assert.match(source, /warnings: created\.warnings/);
  assert.match(source, /status: created\.status/);
});

test("restaurant creation wizard lets owners choose menu languages locally", async () => {
  const source = await readFile("components/owner/RestaurantCreateForm.tsx", "utf8");

  assert.match(source, /menuLanguageOptions/);
  assert.match(source, /Langues du menu/);
  assert.match(source, /formatMenuLanguages\(menuLanguages\)/);
  assert.match(source, /Gardez au moins une langue pour le menu\./);
  assert.match(source, /Lien Google Reviews/);
  assert.match(source, /googleReviewUrl/);
  assert.match(source, /Lien Google Reviews invalide\./);
});

test("restaurant creation wizard keeps structure before dishes and style after dishes", async () => {
  const source = await readFile("components/owner/RestaurantCreateForm.tsx", "utf8");

  assert.match(source, /type StepId = "profile" \| "menu" \| "dishes" \| "appearance" \| "review"/);
  assert.match(source, /id: "profile"/);
  assert.match(source, /id: "menu"/);
  assert.match(source, /id: "dishes"/);
  assert.match(source, /id: "appearance"/);
  assert.match(source, /id: "review"/);
  assert.match(source, /function MenuAppearanceStep/);
  assert.match(source, /menuPhoneFrame/);
  assert.match(source, /OwnerMenuLivePreview/);
  assert.match(source, /publicMenuSettings=\{publicMenuSettings\}/);
  assert.match(source, /appearance=\{appearance\}/);
  const livePreview = await readFile("components/owner/OwnerMenuLivePreview.tsx", "utf8");
  assert.match(livePreview, /MaisonElyseQrMenu/);
  assert.match(livePreview, /TrouvablePremiumMenuExperience/);
  assert.match(livePreview, /displayMode="phone-preview"/);
  const stepsBlock = source.slice(source.indexOf("const steps:"), source.indexOf("const statusOptions:"));
  assert.ok(stepsBlock.indexOf('id: "menu"') < stepsBlock.indexOf('id: "dishes"'));
  assert.ok(stepsBlock.indexOf('id: "dishes"') < stepsBlock.indexOf('id: "appearance"'));
  assert.doesNotMatch(source, /id: "media"/);
  assert.doesNotMatch(source, /id: "qr"/);
  assert.doesNotMatch(source, /MediaStep/);
  assert.doesNotMatch(source, /QrStep/);
  assert.doesNotMatch(source, /mediaQuality/);
  assert.doesNotMatch(source, /qrGenerated|qrTested/);
  assert.doesNotMatch(source, /immersiveCandidate|3D|AR/);
  assert.match(source, /Description courte/);
  assert.match(source, /Ingredients principaux/);
  assert.match(source, /allerg[eè]nes/i);
  assert.match(source, /Badges/);
  assert.match(source, /Options/);
  assert.match(source, /Note du chef/);
  assert.match(source, /Disponibilite/);
  assert.match(source, /Statut photo/);
  assert.match(source, /Dossier media prevu/);
  assert.match(source, /sectionsWithoutDish/);
  assert.match(source, /Sans plat/);
  assert.match(source, /sections:/);
  assert.match(source, /dishes:/);
  assert.match(source, /menuLanguages:/);
  assert.match(source, /qrCodesHref/);
  const ownerStyles = await readFile("components/owner/OwnerCockpit.module.css", "utf8");
  assert.match(ownerStyles, /@media \(max-width: 720px\)[\s\S]*\.menuPhoneFrame[\s\S]*border: 0/);
  assert.match(ownerStyles, /@media \(max-width: 720px\)[\s\S]*\.menuPhoneNotch,[\s\S]*\.menuPhoneTopbar[\s\S]*display: none/);
  assert.match(ownerStyles, /@media \(max-width: 720px\)[\s\S]*\.menuPhoneScreen[\s\S]*height: auto[\s\S]*overflow-y: visible/);
});

test("restaurant creation wizard keeps price decimals and targeted post-create links", async () => {
  const form = await readFile("components/owner/RestaurantCreateForm.tsx", "utf8");
  const page = await readFile("app/(fr)/owner/restaurants/create/page.tsx", "utf8");
  const formatted = new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(14.99);

  assert.match(form, /parsePriceToCents/);
  assert.match(form, /formatPriceCentsForMenu/);
  assert.match(form, /displayPriceMode/);
  assert.match(form, /inputMode="decimal"/);
  assert.match(form, /Affichage prix/);
  assert.match(formatted, /14[,.]99/);
  assert.doesNotMatch(formatted, /^15/);
  assert.match(form, /Le resultat final confirme ce qui a ete persiste\./);
  assert.match(form, /Plats sauvegardes/);
  assert.match(form, /Plats non sauvegardes/);
  assert.match(form, /Sections non confirmees/);
  assert.match(form, /Chemin media prevu/);
  assert.match(form, /Chemin media reference/);
  assert.match(form, /\/owner\/medias\?restaurantId=/);
  assert.match(form, /Voir les photos a ajouter/);
  assert.match(page, /Creation Supabase avec rapport de persistance/);
  assert.doesNotMatch(page, /Profil \+ menu persistants/);
});

test("owner e2e bypass can cover restaurant API during browser QA", async () => {
  const source = await readFile("proxy.ts", "utf8");

  assert.match(source, /\/api\/restaurants/);
  assert.match(source, /startsWith\("\/api\/restaurants"\)/);
});

test("restaurants migration guarantees UUID id, unique slug, and RLS", async () => {
  const sql = await readFile("supabase/migrations/0007_restaurants.sql", "utf8");

  assert.match(sql, /create table if not exists public\.restaurants/i);
  assert.match(sql, /id uuid primary key default gen_random_uuid\(\)/i);
  assert.match(sql, /restaurants_slug_key/i);
  assert.match(sql, /on public\.restaurants \(slug\)/i);
  assert.match(sql, /alter table public\.restaurants enable row level security/i);
  assert.match(sql, /revoke all on table public\.restaurants from anon, authenticated/i);
});

test("restaurants migration supports optional Google Reviews links", async () => {
  const sql = await readFile(
    "supabase/migrations/0009_restaurant_google_reviews.sql",
    "utf8"
  );

  assert.match(sql, /add column if not exists google_review_enabled boolean/i);
  assert.match(sql, /add column if not exists google_review_url text/i);
});
