import test from "node:test";
import assert from "node:assert/strict";

import {
  MAISON_ELYSE_EDITABLE_CAPABILITIES,
  PROTECTED_DEMO_CAPABILITIES,
  STANDARD_OWNER_CAPABILITIES,
  resolveRestaurantOwnerCapabilities
} from "../lib/owner/demoCapabilitiesCore.ts";

const canonical = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "maison-elyse"
};

test("Maison Élyse is an editable demo with destructive actions denied", () => {
  assert.deepEqual(
    resolveRestaurantOwnerCapabilities(
      { id: canonical.id, slug: canonical.slug, status: "demo" },
      canonical
    ),
    MAISON_ELYSE_EDITABLE_CAPABILITIES
  );
  assert.equal(MAISON_ELYSE_EDITABLE_CAPABILITIES.canEditMenuSettings, true);
  assert.equal(MAISON_ELYSE_EDITABLE_CAPABILITIES.canManageTranslations, true);
  assert.equal(MAISON_ELYSE_EDITABLE_CAPABILITIES.canDeleteRestaurant, false);
  assert.equal(MAISON_ELYSE_EDITABLE_CAPABILITIES.canPerformDestructiveQrActions, false);
});

test("a different demo remains fully protected", () => {
  assert.deepEqual(
    resolveRestaurantOwnerCapabilities(
      { id: "99999999-9999-4999-8999-999999999999", slug: "other-demo", status: "demo" },
      canonical
    ),
    PROTECTED_DEMO_CAPABILITIES
  );
});

test("a slug alone cannot grant Maison Élyse capabilities", () => {
  assert.deepEqual(
    resolveRestaurantOwnerCapabilities(
      { id: "99999999-9999-4999-8999-999999999999", slug: "maison-elyse", status: "demo" },
      canonical
    ),
    PROTECTED_DEMO_CAPABILITIES
  );
});

test("normal client restaurants preserve existing owner capabilities", () => {
  assert.deepEqual(
    resolveRestaurantOwnerCapabilities(
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "client", status: "active" },
      canonical
    ),
    STANDARD_OWNER_CAPABILITIES
  );
});
