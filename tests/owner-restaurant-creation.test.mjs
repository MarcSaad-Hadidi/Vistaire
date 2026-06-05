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

function insertClient({ data = null, error = null, onInsert = () => {} } = {}) {
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
        }
      };
    }
  };
}

test("validates restaurant creation input with normalized slug and setup fallback", () => {
  const result = validateCreateRestaurantInput({
    ...validInput,
    slug: "",
    status: "unexpected",
    notes: "x".repeat(900)
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.slug, "le-comptoir-d-ete");
  assert.equal(result.value.status, "setup_needed");
  assert.equal(result.value.notes.length, 800);
});

test("rejects missing restaurant name and invalid contact email", () => {
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
  const result = await createRestaurantRecord(validInput, {
    admin: {
      ok: true,
      client: insertClient({
        onInsert(row) {
          insertedRow = row;
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
        "notes"
      ])
  });

  assert.equal(result.ok, true);
  assert.equal(result.persisted, true);
  assert.equal(result.dataSource, "supabase");
  assert.equal(result.restaurant.id, persistedId);
  assert.equal(result.restaurant.slug, "le-comptoir-d-ete");
  assert.match(result.restaurant.menuUrl, /\/menu\/le-comptoir-d-ete$/);
  assert.equal(
    result.restaurant.dashboardHref,
    `/admin?restaurantId=${persistedId}`
  );
  assert.equal(result.restaurant.qrStatus, "generable");
  assert.equal(insertedRow.slug, "le-comptoir-d-ete");
  assert.equal(insertedRow.contact_email, "camille@example.com");
});

test("restaurant POST route is guarded and exposes persistence metadata", async () => {
  const source = await readFile("app/api/restaurants/route.ts", "utf8");

  assert.match(source, /requireVistaireOwnerApi/);
  assert.match(source, /requireSameOriginOwnerMutation\(request\)/);
  assert.match(source, /persisted: created\.persisted/);
  assert.match(source, /dataSource: created\.dataSource/);
  assert.match(source, /status: created\.status/);
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
