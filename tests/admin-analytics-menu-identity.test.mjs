import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const RESTAURANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MENU_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RESTAURANT_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MENU_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

test("production menu events require a relational menu identity", async () => {
  const { validateAnalyticsEvent } = await import("../lib/analytics/validationCore.mjs");

  const result = validateAnalyticsEvent({
    eventName: "cta_clicked",
    restaurantId: RESTAURANT_A,
    sessionId: "session-a",
    source: "production",
    ctaName: "google_review"
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /menu/i);
});

test("two relational public menus keep their own identity across menu interactions", async () => {
  const sent = [];
  const storage = new Map();
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  globalThis.window = {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 2,
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    }
  };
  globalThis.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return { ok: true };
  };

  try {
    const {
      getPublicMenuAnalyticsContext,
      trackPublicMenuEvent
    } = await import("../lib/analytics/client.ts");
    const menus = [
      { source: "supabase", restaurantId: RESTAURANT_A, menuId: MENU_A },
      { source: "supabase", restaurantId: RESTAURANT_B, menuId: MENU_B }
    ];
    for (const menu of menus) {
      trackPublicMenuEvent(menu, { eventName: "menu_opened" });
      trackPublicMenuEvent(menu, { eventName: "category_viewed", categorySlug: "plats" });
      trackPublicMenuEvent(menu, { eventName: "search_used", searchQuery: "dessert" });
      trackPublicMenuEvent(menu, { eventName: "dish_opened", dishSlug: "plat-signature" });
      trackPublicMenuEvent(menu, { eventName: "cta_clicked", ctaName: "google_review" });
      trackPublicMenuEvent(menu, { eventName: "dish_3d_clicked", dishSlug: "plat-signature" });
      trackPublicMenuEvent(menu, { eventName: "dish_ar_clicked", dishSlug: "plat-signature" });
    }

    assert.equal(sent.length, 14);
    assert.deepEqual(
      sent.map(({ restaurantId, menuId }) => ({ restaurantId, menuId })),
      [
        ...Array.from({ length: 7 }, () => ({ restaurantId: RESTAURANT_A, menuId: MENU_A })),
        ...Array.from({ length: 7 }, () => ({ restaurantId: RESTAURANT_B, menuId: MENU_B }))
      ]
    );
    assert.equal(sent.every((event) => event.source === "production"), true);
    assert.equal(
      sent.every((event) => event.metadata?.instrumentationVersion === "admin-vnext-observed-v1"),
      true
    );

    assert.deepEqual(
      getPublicMenuAnalyticsContext({ ...menus[0], locale: "fr" }),
      getPublicMenuAnalyticsContext({ ...menus[0], locale: "en" })
    );
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test("analytics validation rejects malformed menu ids and unknown fields", async () => {
  const { validateAnalyticsEvent } = await import("../lib/analytics/validationCore.mjs");

  const malformedMenu = validateAnalyticsEvent({
    eventName: "menu_opened",
    restaurantId: RESTAURANT_A,
    menuId: "not-a-uuid",
    sessionId: "session-a",
    source: "production"
  });
  assert.equal(malformedMenu.ok, false);
  assert.match(malformedMenu.error, /menu/i);

  const extraField = validateAnalyticsEvent({
    eventName: "menu_opened",
    restaurantId: RESTAURANT_A,
    menuId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sessionId: "session-a",
    source: "production",
    token: "should-not-be-accepted"
  });
  assert.equal(extraField.ok, false);
  assert.match(extraField.error, /field|payload|unknown/i);
});

test("restaurant-scoped demo events may omit menu identity explicitly", async () => {
  const { validateAnalyticsEvent } = await import("../lib/analytics/validationCore.mjs");

  const result = validateAnalyticsEvent({
    eventName: "dashboard_demo_opened",
    restaurantId: RESTAURANT_A,
    sessionId: "session-a",
    source: "demo"
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.menuId, undefined);
});

test("menu-scoped events require their event-specific fields", async () => {
  const { validateAnalyticsEvent } = await import("../lib/analytics/validationCore.mjs");

  const cases = [
    ["dish_opened", "dish"],
    ["dish_3d_clicked", "dish"],
    ["dish_ar_clicked", "dish"],
    ["category_viewed", "category"],
    ["search_used", "search"],
    ["filter_used", "filter"],
    ["cta_clicked", "cta"]
  ];

  for (const [eventName, field] of cases) {
    const result = validateAnalyticsEvent({
      eventName,
      restaurantId: RESTAURANT_A,
      menuId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      sessionId: "session-a",
      source: "production"
    });
    assert.equal(result.ok, false, `${eventName} should require ${field}`);
    assert.match(result.error, new RegExp(field, "i"));
  }
});

test("server context validation accepts only the restaurant/menu relationship", async () => {
  const { validateAnalyticsContext } = await import("../lib/analytics/validationCore.mjs");
  const menuA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const menuB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const payload = {
    eventName: "menu_opened",
    restaurantId: RESTAURANT_A,
    menuId: menuA,
    sessionId: "session-a",
    source: "production"
  };

  assert.equal(
    await validateAnalyticsContext(payload, {
      restaurantExists: async (id) => id === RESTAURANT_A,
      menuBelongsToRestaurant: async (menuId, restaurantId) =>
        menuId === menuA && restaurantId === RESTAURANT_A
    }),
    true
  );
  assert.equal(
    await validateAnalyticsContext({ ...payload, menuId: menuB }, {
      restaurantExists: async (id) => id === RESTAURANT_A,
      menuBelongsToRestaurant: async () => false
    }),
    false
  );
  assert.equal(
    await validateAnalyticsContext(
      {
        eventName: "dashboard_demo_opened",
        restaurantId: RESTAURANT_A,
        sessionId: "session-a",
        source: "demo"
      },
      {
        restaurantExists: async (id) => id === RESTAURANT_A,
        menuBelongsToRestaurant: async () => false
      }
    ),
    true
  );
});

test("event validation rejects sensitive metadata and malformed duration payloads", async () => {
  const { validateAnalyticsEvent } = await import("../lib/analytics/validationCore.mjs");
  const base = {
    eventName: "session_duration",
    restaurantId: RESTAURANT_A,
    menuId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sessionId: "session-a",
    source: "production"
  };

  assert.equal(
    validateAnalyticsEvent({ ...base, metadata: { durationMs: 1000, instrumentationVersion: "admin-vnext-observed-v1", email: "person@example.com" } }).ok,
    false
  );
  assert.equal(validateAnalyticsEvent({ ...base, metadata: { durationMs: -1, instrumentationVersion: "admin-vnext-observed-v1" } }).ok, false);
  assert.equal(validateAnalyticsEvent({ ...base, metadata: { durationMs: 1000, instrumentationVersion: "admin-vnext-observed-v1" } }).ok, true);
});

test("analytics route bounds JSON and validates relational context before insertion", async () => {
  const route = await readFile("app/api/analytics/events/route.ts", "utf8");
  assert.match(route, /readBoundedJsonBody\(request, MAX_BODY_BYTES\)/);
  assert.match(route, /validateAnalyticsEventContext\(validation\.payload\)/);
  assert.ok(
    route.indexOf("validateAnalyticsEventContext(validation.payload)") <
      route.indexOf("insertAnalyticsEvent(validation.payload")
  );
  assert.match(route, /status:\s*context\.status/);
});

test("demo analytics bypass is restricted to the configured demo identity", async () => {
  const { isConfiguredDemoAnalyticsPayload } = await import("../lib/analytics/validation.ts");
  const demoPayload = {
    eventName: "menu_opened",
    restaurantId: "11111111-1111-1111-1111-111111111111",
    menuId: "22222222-2222-2222-2222-222222222222",
    sessionId: "session-demo",
    source: "demo"
  };

  assert.equal(isConfiguredDemoAnalyticsPayload(demoPayload), true);
  assert.equal(
    isConfiguredDemoAnalyticsPayload({
      ...demoPayload,
      restaurantId: RESTAURANT_A,
      menuId: MENU_A
    }),
    false
  );
  assert.equal(
    isConfiguredDemoAnalyticsPayload({ ...demoPayload, source: "production" }),
    false
  );

  const route = await readFile("app/api/analytics/events/route.ts", "utf8");
  assert.match(
    route,
    /if \(!isConfiguredDemoAnalyticsPayload\(validation\.payload\)\) \{\s*const context = await validateAnalyticsEventContext\(validation\.payload\)/
  );
});

test("public menu review tracking forwards the relational menu id", async () => {
  const [tracking, client, card, renderer, trouvable, dish] = await Promise.all([
    readFile("components/menu/googleReviewTracking.ts", "utf8"),
    readFile("lib/analytics/client.ts", "utf8"),
    readFile("components/menu/GoogleReviewCard.tsx", "utf8"),
    readFile("components/menu/PublicMenuRenderer.tsx", "utf8"),
    readFile("components/menu/TrouvablePremiumMenuExperience.tsx", "utf8"),
    readFile("components/menu/TrouvableDishDetailExperience.tsx", "utf8")
  ]);

  assert.match(tracking, /menuId\?: string/);
  assert.match(tracking, /menuId,/);
  assert.match(client, /source === "production" && !menuId/);
  assert.match(card, /menuId,\s*source/);
  assert.match(renderer, /menuId=\{menu\.menuId\}/);
  assert.match(trouvable, /menuId=\{menu\.menuId\}/);
  assert.match(dish, /menuId=\{menu\.menuId\}/);
});
