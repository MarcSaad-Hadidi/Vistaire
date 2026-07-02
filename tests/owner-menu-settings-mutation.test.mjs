import test from "node:test";
import assert from "node:assert/strict";

import {
  isMissingMenuSettingsJsonColumn,
  updateOwnerMenuSettings
} from "../lib/owner/menuSettingsMutation.ts";

const RESTAURANT_ID = "22222222-2222-4222-8222-222222222222";
const MENU_ID = "33333333-3333-4333-8333-333333333333";

function menuSettingsClient({
  primaryError = null,
  metadata = { photoPolicy: "ready" },
  metadataSelectError = null,
  metadataUpdateError = null,
  uiConfig = {
    id: "44444444-4444-4444-8444-444444444444",
    theme: "fresh-homemade",
    config_json: { menuLanguages: ["fr", "en"] },
    status: "draft"
  }
} = {}) {
  const calls = [];

  return {
    calls,
    from(table) {
      assert.ok(table === "menus" || table === "menu_ui_configs");

      if (table === "menu_ui_configs") {
        return {
          insert(row) {
            calls.push({ table, action: "insert", row });
            return {
              select(columns) {
                calls.push({ table, action: "select", columns });
                return {
                  async single() {
                    return {
                      data: {
                        id: "55555555-5555-4555-8555-555555555555",
                        config_json: row.config_json
                      },
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
                return {
                  select(columns) {
                    calls.push({ table, action: "select", columns });
                    return {
                      async single() {
                        return {
                          data: {
                            id: uiConfig.id,
                            config_json: row.config_json
                          },
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
                        return { data: uiConfig, error: null };
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
                          if (Object.hasOwn(row, "settings_json")) {
                            return primaryError
                              ? { data: null, error: primaryError }
                              : {
                                  data: {
                                    id: MENU_ID,
                                    settings_json: row.settings_json
                                  },
                                  error: null
                                };
                          }

                          if (metadataUpdateError) {
                            return { data: null, error: metadataUpdateError };
                          }
                          return {
                            data: {
                              id: MENU_ID,
                              metadata: row.metadata
                            },
                            error: null
                          };
                        }
                      };
                    }
                  };
                },
                select(columns) {
                  calls.push({ table, action: "select", columns });
                  return {
                    async single() {
                      return {
                        data: {
                          id: MENU_ID,
                          metadata
                        },
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
                    async single() {
                      if (metadataSelectError) {
                        return { data: null, error: metadataSelectError };
                      }
                      return {
                        data: {
                          id: MENU_ID,
                          metadata
                        },
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

const settings = {
  defaultLocale: "fr-CA",
  supportedLocales: ["fr-CA", "en-CA"],
  baseCurrency: "CAD",
  defaultCurrency: "USD",
  supportedCurrencies: ["CAD", "USD"],
  publicMenuStyle: "trouvable",
  timezone: "America/Toronto",
  defaultThemeMode: "dark",
  allowThemeToggle: true,
  allowCurrencySelector: true,
  allowLanguageSelector: true,
  taxIncluded: true,
  priceDisplayMode: "auto"
};

test("owner menu settings fall back to menu metadata when settings_json is missing", async () => {
  const client = menuSettingsClient({
    primaryError: {
      code: "42703",
      message: 'column menus.settings_json does not exist'
    }
  });

  const result = await updateOwnerMenuSettings({
    client,
    restaurantId: RESTAURANT_ID,
    settings
  });

  assert.equal(result.ok, true);
  assert.equal(result.menuId, MENU_ID);
  assert.equal(result.storage, "metadata");
  assert.deepEqual(result.settings.supportedCurrencies, ["CAD", "USD"]);

  const metadataWrite = client.calls.find(
    (call) => call.action === "update" && Object.hasOwn(call.row, "metadata")
  );
  assert.ok(metadataWrite);
  assert.deepEqual(metadataWrite.row.metadata.photoPolicy, "ready");
  assert.deepEqual(metadataWrite.row.metadata.publicMenuSettings, result.settings);
});

test("owner menu settings fall back to menu_ui_configs when menus has no settings columns", async () => {
  const client = menuSettingsClient({
    primaryError: {
      code: "PGRST204",
      message: "Could not find the 'settings_json' column of 'menus' in the schema cache"
    },
    metadataSelectError: {
      code: "PGRST204",
      message: "Could not find the 'metadata' column of 'menus' in the schema cache"
    }
  });

  const result = await updateOwnerMenuSettings({
    client,
    restaurantId: RESTAURANT_ID,
    settings
  });

  assert.equal(result.ok, true);
  assert.equal(result.storage, "menu_ui_configs");
  assert.equal(result.menuId, "");
  assert.equal(result.settings.defaultCurrency, "USD");

  const uiConfigWrite = client.calls.find(
    (call) =>
      call.table === "menu_ui_configs" &&
      call.action === "update" &&
      Object.hasOwn(call.row, "config_json")
  );
  assert.ok(uiConfigWrite);
  assert.deepEqual(uiConfigWrite.row.config_json.menuLanguages, ["fr", "en"]);
  assert.deepEqual(uiConfigWrite.row.config_json.publicMenuSettings, result.settings);
});

test("settings_json error detection only catches missing-column failures", () => {
  assert.equal(
    isMissingMenuSettingsJsonColumn({
      code: "PGRST204",
      message: "Could not find the 'settings_json' column of 'menus' in the schema cache"
    }),
    true
  );
  assert.equal(
    isMissingMenuSettingsJsonColumn({
      code: "23514",
      message: 'new row violates check constraint "menus_settings_json_max_bytes"'
    }),
    false
  );
});
