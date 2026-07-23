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
  settingsJson = null,
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
                      if (primaryError && columns.includes("settings_json")) {
                        return { data: null, error: primaryError };
                      }
                      return {
                        data: {
                          id: MENU_ID,
                          ...(settingsJson ? { settings_json: settingsJson } : {}),
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
                      if (primaryError && columns.includes("settings_json")) {
                        return { data: null, error: primaryError };
                      }
                      if (metadataSelectError) {
                        return { data: null, error: metadataSelectError };
                      }
                      return {
                        data: {
                          id: MENU_ID,
                          ...(settingsJson ? { settings_json: settingsJson } : {}),
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

test("owner menu settings preserve localized UI copy stored in settings_json", async () => {
  const localizedUiCopy = {
    el: {
      filterButton: "\u03a6\u03af\u03bb\u03c4\u03c1\u03bf",
      threeD: "\u03a0\u03a1\u039f\u0392\u039f\u039b\u0397 \u03a3\u0395 3D"
    }
  };
  const client = menuSettingsClient({
    settingsJson: {
      ...settings,
      localizedUiCopy
    }
  });

  const result = await updateOwnerMenuSettings({
    client,
    restaurantId: RESTAURANT_ID,
    settings
  });

  assert.equal(result.ok, true);
  assert.equal(result.storage, "settings_json");

  const settingsWrite = client.calls.find(
    (call) => call.action === "update" && Object.hasOwn(call.row, "settings_json")
  );
  assert.ok(settingsWrite);
  assert.deepEqual(settingsWrite.row.settings_json.localizedUiCopy, localizedUiCopy);
});

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

test("owner menu settings preserve localized UI copy stored with metadata settings", async () => {
  const localizedUiCopy = {
    el: {
      filterButton: "\u03a6\u03af\u03bb\u03c4\u03c1\u03bf"
    }
  };
  const client = menuSettingsClient({
    primaryError: {
      code: "42703",
      message: 'column menus.settings_json does not exist'
    },
    metadata: {
      publicMenuSettings: {
        ...settings,
        localizedUiCopy
      }
    }
  });

  const result = await updateOwnerMenuSettings({
    client,
    restaurantId: RESTAURANT_ID,
    settings
  });

  assert.equal(result.ok, true);
  assert.equal(result.storage, "metadata");

  const metadataWrite = client.calls.find(
    (call) => call.action === "update" && Object.hasOwn(call.row, "metadata")
  );
  assert.ok(metadataWrite);
  assert.deepEqual(
    metadataWrite.row.metadata.publicMenuSettings.localizedUiCopy,
    localizedUiCopy
  );
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
    },
    uiConfig: {
      id: "44444444-4444-4444-8444-444444444444",
      theme: "fresh-homemade",
      config_json: {
        menuLanguages: ["fr", "en"],
        publicMenuSettings: {
          ...settings,
          localizedUiCopy: {
            el: {
              filterButton: "\u03a6\u03af\u03bb\u03c4\u03c1\u03bf"
            }
          }
        }
      },
      status: "draft"
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
  const writtenSettings = { ...uiConfigWrite.row.config_json.publicMenuSettings };
  delete writtenSettings.localizedUiCopy;
  assert.deepEqual(writtenSettings, result.settings);
  assert.deepEqual(uiConfigWrite.row.config_json.publicMenuSettings.localizedUiCopy, {
    el: {
      filterButton: "\u03a6\u03af\u03bb\u03c4\u03c1\u03bf"
    }
  });
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

test("switching settings to unique provisions server uniqueDesign in menu_ui_configs", async () => {
  const client = menuSettingsClient();
  let rpcPayload = null;
  client.rpc = async (fn, params) => {
    assert.equal(fn, "mutate_owner_public_menu_settings_atomic");
    rpcPayload = params;
    return {
      data: {
        ok: true,
        menuId: MENU_ID,
        settings: params.p_settings,
        uniqueDesign: params.p_unique_design ?? {
          mode: "unique",
          designId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          status: "pending",
          rendererKey: null,
          rendererVersion: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      },
      error: null
    };
  };
  const uniqueSettings = {
    ...settings,
    publicMenuStyle: "unique"
  };

  const result = await updateOwnerMenuSettings({
    client,
    restaurantId: RESTAURANT_ID,
    settings: uniqueSettings
  });

  assert.equal(result.ok, true);
  assert.equal(result.storage, "settings_json");
  assert.ok(rpcPayload);
  assert.equal(rpcPayload.p_restaurant_id, RESTAURANT_ID);
  assert.equal(rpcPayload.p_settings.publicMenuStyle, "unique");
  assert.equal(rpcPayload.p_unique_design?.mode, "unique");
  assert.equal(rpcPayload.p_unique_design?.status, "pending");
  assert.equal(rpcPayload.p_unique_design?.rendererKey, null);
  assert.match(
    rpcPayload.p_unique_design?.designId ?? "",
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});

test("leaving unique without RPC fails closed before partial writes", async () => {
  const client = menuSettingsClient({
    settingsJson: {
      ...settings,
      publicMenuStyle: "unique"
    }
  });
  const result = await updateOwnerMenuSettings({
    client,
    restaurantId: RESTAURANT_ID,
    settings
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(
    client.calls.some(
      (call) => call.table === "menus" && call.action === "update"
    ),
    false
  );
});

test("entering unique without RPC fails closed before partial writes", async () => {
  const client = menuSettingsClient();
  const result = await updateOwnerMenuSettings({
    client,
    restaurantId: RESTAURANT_ID,
    settings: {
      ...settings,
      publicMenuStyle: "unique"
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(
    client.calls.some(
      (call) => call.table === "menus" && call.action === "update"
    ),
    false
  );
});
