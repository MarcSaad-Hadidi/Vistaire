import {
  normalizeMenuUiConfig,
  validateMenuUiConfig,
  type MenuUiConfig
} from "./menuUiConfig.ts";

export const MENU_DESIGN_CONFIG_TRANSFER_KEYS = [
  "schemaVersion",
  "theme",
  "custom",
  "palette",
  "global",
  "typography",
  "welcome",
  "navigation",
  "cards",
  "detail",
  "experience",
  "photos",
  "immersive",
  "welcomeEnabled",
  "welcomeTitle",
  "welcomeSubtitle",
  "motion",
  "defaultView",
  "categoryNavigation",
  "dishCardStyle",
  "detailStyle",
  "density",
  "showPhotoPlaceholders",
  "show3dBadges",
  "showArBadges"
] as const;

const TRANSFER_SCHEMA = "vistaire.menu-design-config.v1";
const FORBIDDEN_IMPORT_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "secret",
  "password",
  "token",
  "bearer",
  "servicerole",
  "apikey",
  "signature",
  "dish",
  "dishes",
  "item",
  "items",
  "menuitem",
  "menuitems",
  "generatedmenu",
  "generateddishes",
  "price",
  "prices",
  "ingredient",
  "ingredients",
  "allergen",
  "allergens",
  "availability",
  "photourl",
  "modelurl",
  "description"
]);
const FORBIDDEN_IMPORT_KEY_PATTERN =
  /(secret|password|token|bearer|service[_-]?role|api[_-]?key|signature)/i;
const SECRET_VALUE =
  /(sk_live_|sk_test_|service_role|bearer\s+[a-z0-9._-]{12,}|eyJ[a-z0-9_-]{12,})/i;

type TransferKey = (typeof MENU_DESIGN_CONFIG_TRANSFER_KEYS)[number];

type ImportResult =
  | { ok: true; config: MenuUiConfig }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasUnsafeImportContent(value: unknown, depth = 0): boolean {
  if (depth > 8) return true;
  if (typeof value === "string") return SECRET_VALUE.test(value);
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasUnsafeImportContent(item, depth + 1));

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (
      FORBIDDEN_IMPORT_KEYS.has(normalizedKey) ||
      FORBIDDEN_IMPORT_KEY_PATTERN.test(key)
    ) {
      return true;
    }
    if (hasUnsafeImportContent(nested, depth + 1)) return true;
  }
  return false;
}

function pickDesignConfig(input: unknown): Partial<Record<TransferKey, unknown>> {
  const record = isRecord(input) ? input : {};
  const output: Partial<Record<TransferKey, unknown>> = {};
  for (const key of MENU_DESIGN_CONFIG_TRANSFER_KEYS) {
    if (key in record) output[key] = record[key];
  }
  return output;
}

export function exportMenuDesignConfig(input: unknown): string {
  const config = normalizeMenuUiConfig(pickDesignConfig(input));
  const output = pickDesignConfig(config);
  return JSON.stringify(
    {
      schema: TRANSFER_SCHEMA,
      exportedAt: new Date().toISOString(),
      config: output
    },
    null,
    2
  );
}

export function importMenuDesignConfig(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Config JSON invalide." };
  }

  const root = isRecord(parsed) && isRecord(parsed.config) ? parsed.config : parsed;
  if (hasUnsafeImportContent(root)) {
    return { ok: false, error: "Config importee unsafe: secret or menu data key detected." };
  }

  const validated = validateMenuUiConfig(pickDesignConfig(root));
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  return { ok: true, config: validated.value };
}

export function duplicateMenuDesignConfig(input: unknown): MenuUiConfig {
  return normalizeMenuUiConfig(pickDesignConfig(input));
}
