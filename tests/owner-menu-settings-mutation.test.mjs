import test from "node:test";
import assert from "node:assert/strict";

import {
  isMissingMenuSettingsJsonColumn,
  updateOwnerMenuSettings
} from "../lib/owner/menuSettingsMutation.ts";

const RESTAURANT_ID = "22222222-2222-4222-8222-222222222222";
const MENU_ID = "33333333-3333-4333-8333-333333333333";

function menuSettingsClient({ primaryError = null, metadata = { photoPolicy: "ready" } } = {}) {
  const calls = [];

  return {
    calls,
    from(table) {
      assert.equal(table, "menus");
      return {
        update(row) {
          calls.push({ action: "update", row });
          return {
            eq(column, value) {
              calls.push({ action: "eq", column, value });
              return {
                eq(column2, value2) {
                  calls.push({ action: "eq", column: column2, value: value2 });
                  return {
                    select(columns) {
                      calls.push({ action: "select", columns });
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
                  calls.push({ action: "select", columns });
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
          calls.push({ action: "select", columns });
          return {
            eq(column, value) {
              calls.push({ action: "eq", column, value });
              return {
                eq(column2, value2) {
                  calls.push({ action: "eq", column: column2, value: value2 });
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
