import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { serializePublicMenuSettings } from "../lib/menu/publicMenuSettings.ts";
import { updateOwnerMenuSettings } from "../lib/owner/menuSettingsMutation.ts";
import { buildOwnerMenuDataFromRows } from "../lib/owner/menuDataCore.ts";
import { buildRelationalSupabasePublicMenu } from "../lib/menu/publicMenuCore.ts";
import {
  publicMenuSettingsFallbackFromUiConfigRows,
  publicMenuSettingsFromUiConfigRows
} from "../lib/owner/publicMenuSettingsFallback.ts";

const restaurantId = "11111111-1111-4111-8111-111111111111";
const menuId = "22222222-2222-4222-8222-222222222222";

const savedSettings = serializePublicMenuSettings({
  defaultLocale: "fr-CA",
  supportedLocales: ["fr-CA", "en-CA", "es-ES", "it-IT", "ar"],
  baseCurrency: "CAD",
  defaultCurrency: "USD",
  supportedCurrencies: ["CAD", "USD", "EUR", "GBP"],
  publicMenuStyle: "trouvable",
  timezone: "America/Toronto",
  defaultThemeMode: "dark",
  allowThemeToggle: true,
  allowCurrencySelector: true,
  allowLanguageSelector: true,
  taxIncluded: true,
  priceDisplayMode: "auto"
});

const publishedSettings = serializePublicMenuSettings({
  ...savedSettings,
  supportedLocales: ["fr-CA", "en-CA"],
  defaultLocale: "en-CA",
  supportedCurrencies: ["CAD", "USD"],
  baseCurrency: "CAD",
  defaultCurrency: "USD"
});

function ownerRows(settings = savedSettings) {
  return {
    restaurantRows: [
      {
        id: restaurantId,
        name: "Cafe Vistaire",
        slug: "cafe-vistaire",
        location: "Montreal",
        cuisine_type: "Cuisine de saison"
      }
    ],
    menuRows: [
      {
        id: menuId,
        restaurant_id: restaurantId,
        slug: "principal",
        status: "published",
        is_primary: true
      }
    ],
    categoryRows: [],
    dishRows: [],
    uiConfigRows: [
      {
        id: "22223333-3333-4333-8333-333333333333",
        restaurant_id: restaurantId,
        status: "published",
        updated_at: "2026-07-01T12:00:00.000Z",
        config_json: {
          publicMenuSettings: publishedSettings
        }
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        restaurant_id: restaurantId,
        status: "draft",
        updated_at: "2026-07-02T12:00:00.000Z",
        config_json: {
          publicMenuSettings: settings
        }
      }
    ]
  };
}

function reloadOwnerSettings(settings = savedSettings) {
  const result = buildOwnerMenuDataFromRows({
    restaurantId,
    ...ownerRows(settings)
  });

  assert.equal(result.ok, true);
  return result.menu.settings;
}

function draftPublicMenuSettings(state) {
  const draft = state.uiConfigRows.find((row) => row.status === "draft");
  assert.ok(draft, "Expected a draft menu_ui_configs row");
  return draft.config_json.publicMenuSettings;
}

function uiConfigFallbackClient(state) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.ok(table === "menus" || table === "menu_ui_configs");

      if (table === "menus") {
        return {
          update(row) {
            calls.push({ table, action: "update", row });
            return {
              eq(column, value) {
                calls.push({ table, action: "eq", column, value });
                return {
                  eq(column2, value2) {
                    calls.push({ table, action: "eq", column: column2, value: value2 });
                    return {
                      select(columns) {
                        calls.push({ table, action: "select", columns });
                        return {
                          async single() {
                            return {
                              data: null,
                              error: {
                                code: "PGRST204",
                                message:
                                  "Could not find the 'settings_json' column of 'menus' in the schema cache"
                              }
                            };
                          }
                        };
                      }
                    };
                  }
                };
              }
            };
          },
          select(columns) {
            calls.push({ table, action: "select", columns });
            return {
              eq(column, value) {
                calls.push({ table, action: "eq", column, value });
                return {
                  eq(column2, value2) {
                    calls.push({ table, action: "eq", column: column2, value: value2 });
                    return {
                      async single() {
                        return {
                          data: null,
                          error: {
                            code: "PGRST204",
                            message:
                              "Could not find the 'metadata' column of 'menus' in the schema cache"
                          }
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }

      return {
        insert(row) {
          calls.push({ table, action: "insert", row });
          state.uiConfigRows = [
            {
              id: "44444444-4444-4444-8444-444444444444",
              restaurant_id: restaurantId,
              status: row.status,
              updated_at: row.updated_at,
              config_json: row.config_json
            }
          ];
          return {
            select(columns) {
              calls.push({ table, action: "select", columns });
              return {
                async single() {
                  return {
                    data: state.uiConfigRows[0],
                    error: null
                  };
                }
              };
            }
          };
        },
        update(row) {
          calls.push({ table, action: "update", row });
          return {
            eq(column, value) {
              calls.push({ table, action: "eq", column, value });
              state.uiConfigRows = state.uiConfigRows.map((config) =>
                config.id === value ? { ...config, ...row } : config
              );
              return {
                select(columns) {
                  calls.push({ table, action: "select", columns });
                  return {
                    async single() {
                      return {
                        data: state.uiConfigRows.find((config) => config.id === value),
                        error: null
                      };
                    }
                  };
                }
              };
            }
          };
        },
        select(columns) {
          calls.push({ table, action: "select", columns });
          return {
            eq(column, value) {
              calls.push({ table, action: "eq", column, value });
              return {
                eq(column2, value2) {
                  calls.push({ table, action: "eq", column: column2, value: value2 });
                  return {
                    async maybeSingle() {
                      return {
                        data:
                          state.uiConfigRows.find(
                            (config) =>
                              config.restaurant_id === value && config.status === value2
                          ) ?? null,
                        error: null
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };
}

test("saved supportedLocales survive owner reload from menu_ui_configs fallback", () => {
  const settings = reloadOwnerSettings();

  assert.deepEqual(settings.supportedLocales, [
    "fr-CA",
    "en-CA",
    "es-ES",
    "it-IT",
    "ar"
  ]);
  assert.equal(settings.defaultLocale, "fr-CA");
});

test("owner and public menu_ui_configs settings use the same effective draft settings", () => {
  const rows = ownerRows().uiConfigRows;
  const ownerSettings = publicMenuSettingsFromUiConfigRows(rows, restaurantId);
  const publicSettings = publicMenuSettingsFromUiConfigRows(rows, restaurantId);

  assert.deepEqual(ownerSettings?.supportedLocales, [
    "fr-CA",
    "en-CA",
    "es-ES",
    "it-IT",
    "ar"
  ]);
  assert.deepEqual(publicSettings?.supportedLocales, ownerSettings?.supportedLocales);
  assert.equal(ownerSettings?.defaultCurrency, "USD");
  assert.equal(publicSettings?.defaultLocale, ownerSettings?.defaultLocale);
});

test("public menu_ui_configs fallback reads draft-only saved settings for the public route", () => {
  const draftOnlyRows = ownerRows().uiConfigRows.filter(
    (row) => row.status === "draft"
  );

  const publicSettings = publicMenuSettingsFromUiConfigRows(
    draftOnlyRows,
    restaurantId
  );

  assert.deepEqual(publicSettings?.supportedLocales, [
    "fr-CA",
    "en-CA",
    "es-ES",
    "it-IT",
    "ar"
  ]);
  assert.deepEqual(publicSettings?.supportedCurrencies, ["CAD", "USD", "EUR", "GBP"]);
});

test("saved supportedCurrencies survive owner reload from menu_ui_configs fallback", () => {
  const settings = reloadOwnerSettings();

  assert.deepEqual(settings.supportedCurrencies, ["CAD", "USD", "EUR", "GBP"]);
  assert.equal(settings.baseCurrency, "CAD");
  assert.equal(settings.defaultCurrency, "USD");
});

test("adding a new language after owner reload preserves old languages", async () => {
  const state = ownerRows();
  const client = uiConfigFallbackClient(state);
  const reloaded = reloadOwnerSettings(draftPublicMenuSettings(state));
  const nextSettings = serializePublicMenuSettings({
    ...reloaded,
    supportedLocales: [...reloaded.supportedLocales, "de-DE"]
  });

  const saved = await updateOwnerMenuSettings({
    client,
    restaurantId,
    settings: nextSettings
  });

  assert.equal(saved.ok, true);
  assert.deepEqual(
    [...saved.settings.supportedLocales].sort(),
    ["fr-CA", "en-CA", "es-ES", "it-IT", "ar", "de-DE"].sort()
  );

  const afterReload = reloadOwnerSettings(
    draftPublicMenuSettings(state)
  );
  assert.deepEqual(
    [...afterReload.supportedLocales].sort(),
    [...saved.settings.supportedLocales].sort()
  );
});

test("adding a new currency after owner reload preserves old currencies", async () => {
  const state = ownerRows();
  const client = uiConfigFallbackClient(state);
  const reloaded = reloadOwnerSettings(draftPublicMenuSettings(state));
  const nextSettings = serializePublicMenuSettings({
    ...reloaded,
    supportedCurrencies: [...reloaded.supportedCurrencies, "JPY"]
  });

  const saved = await updateOwnerMenuSettings({
    client,
    restaurantId,
    settings: nextSettings
  });

  assert.equal(saved.ok, true);
  assert.deepEqual(saved.settings.supportedCurrencies, [
    "CAD",
    "USD",
    "EUR",
    "GBP",
    "JPY"
  ]);

  const afterReload = reloadOwnerSettings(
    draftPublicMenuSettings(state)
  );
  assert.deepEqual(afterReload.supportedCurrencies, saved.settings.supportedCurrencies);
});

test("owner API fallback save preserves locales and currencies across two refreshes", async () => {
  const state = ownerRows();
  const client = uiConfigFallbackClient(state);
  const firstReload = reloadOwnerSettings(draftPublicMenuSettings(state));
  const firstSave = serializePublicMenuSettings({
    ...firstReload,
    supportedLocales: [...firstReload.supportedLocales, "de-DE"],
    supportedCurrencies: [...firstReload.supportedCurrencies, "JPY"]
  });

  const firstSaved = await updateOwnerMenuSettings({
    client,
    restaurantId,
    settings: firstSave
  });

  assert.equal(firstSaved.ok, true);

  const secondReload = reloadOwnerSettings(draftPublicMenuSettings(state));
  const secondSave = serializePublicMenuSettings({
    ...secondReload,
    supportedLocales: [...secondReload.supportedLocales, "pt-BR"],
    supportedCurrencies: [...secondReload.supportedCurrencies, "CHF"]
  });

  const secondSaved = await updateOwnerMenuSettings({
    client,
    restaurantId,
    settings: secondSave
  });

  assert.equal(secondSaved.ok, true);

  const finalReload = reloadOwnerSettings(draftPublicMenuSettings(state));
  assert.deepEqual(
    [...finalReload.supportedLocales].sort(),
    ["fr-CA", "en-CA", "es-ES", "it-IT", "ar", "de-DE", "pt-BR"].sort()
  );
  assert.deepEqual(finalReload.supportedCurrencies, [
    "CAD",
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "CHF"
  ]);
});

test("public fallback does not expose a draft when published settings are absent", () => {
  const draftOnlyRows = ownerRows().uiConfigRows.filter(
    (row) => row.status === "draft"
  );

  assert.equal(
    publicMenuSettingsFallbackFromUiConfigRows(draftOnlyRows, restaurantId, {
      includeDraft: false
    }),
    null
  );
  assert.ok(
    publicMenuSettingsFallbackFromUiConfigRows(draftOnlyRows, restaurantId, {
      includeDraft: true
    })
  );
});

test("fallback prioritizes published settings and only uses the newest draft when opted in", () => {
  const rows = [
    {
      id: "published",
      restaurant_id: restaurantId,
      status: "published",
      updated_at: "2026-07-01T12:00:00.000Z",
      config_json: { publicMenuSettings: { publicMenuStyle: "trouvable" } }
    },
    {
      id: "newer-draft",
      restaurant_id: restaurantId,
      status: "draft",
      updated_at: "2026-07-03T12:00:00.000Z",
      config_json: { publicMenuSettings: { publicMenuStyle: "maison-elyse" } }
    },
    {
      id: "older-draft",
      restaurant_id: restaurantId,
      status: "draft",
      updated_at: "2026-07-02T12:00:00.000Z",
      config_json: { publicMenuSettings: { publicMenuStyle: "unique" } }
    }
  ];

  assert.equal(
    publicMenuSettingsFallbackFromUiConfigRows(rows, restaurantId, {
      includeDraft: false
    })?.settings.publicMenuStyle,
    "trouvable"
  );
  assert.equal(
    publicMenuSettingsFallbackFromUiConfigRows(rows, restaurantId, {
      includeDraft: true
    })?.settings.publicMenuStyle,
    "maison-elyse"
  );
});

test("fallback isolates rows by restaurant", () => {
  const rows = [
    {
      id: "other-restaurant",
      restaurant_id: "other-restaurant",
      status: "published",
      updated_at: "2026-07-03T12:00:00.000Z",
      config_json: { publicMenuSettings: { publicMenuStyle: "maison-elyse" } }
    },
    {
      id: "target-restaurant",
      restaurant_id: restaurantId,
      status: "published",
      updated_at: "2026-07-01T12:00:00.000Z",
      config_json: { publicMenuSettings: { publicMenuStyle: "trouvable" } }
    }
  ];

  assert.equal(
    publicMenuSettingsFallbackFromUiConfigRows(rows, restaurantId, {
      includeDraft: false
    })?.settings.publicMenuStyle,
    "trouvable"
  );
});

test("owner and public builders expose identical settings for the same ui_config rows", () => {
  const rows = ownerRows();
  const ownerResult = buildOwnerMenuDataFromRows({
    restaurantId,
    ...rows
  });
  const publicMenu = buildRelationalSupabasePublicMenu({
    slug: "cafe-vistaire",
    restaurantRow: rows.restaurantRows[0],
    menuRow: rows.menuRows[0],
    categoryRows: rows.categoryRows,
    dishRows: rows.dishRows,
    legacyPublicMenuSettings: publicMenuSettingsFromUiConfigRows(
      rows.uiConfigRows,
      restaurantId
    )
  });

  assert.equal(ownerResult.ok, true);
  assert.deepEqual(publicMenu.settings, ownerResult.menu.settings);
});

test("getOwnerMenuData is wired to read menu_ui_configs publicMenuSettings", async () => {
  const source = await readFile("lib/owner/menuData.ts", "utf8");

  assert.match(source, /readSupabaseRowsByFilters<PublicMenuRow>\(\{[\s\S]*table: "menu_ui_configs"/);
  assert.match(source, /filters: \{ restaurant_id: restaurantId \}/);
  assert.match(source, /buildOwnerMenuDataFromRows/);
  assert.match(source, /uiConfigRows/);
});
