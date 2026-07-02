import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicMenuSettings } from "@/lib/menu/publicMenuSettings";
import { readPublicMenuSettingsWithFallbacks } from "@/lib/owner/publicMenuSettingsFallback";
import { menuTranslationFieldsFromNames } from "@/lib/translation/menuTranslationFields";
import {
  estimateChangedCharacters,
  fieldHashesFor,
  objectInput,
  resolveEntityTranslationStatus,
  sourceHashFor,
  stringInput,
  stringListInput,
  summarizeLocaleTranslationStatus,
  type MenuTranslationFieldValue,
  type MenuTranslationFields,
  type MenuTranslationSourceEntity,
  type MenuTranslationStatusSummary,
  type StoredMenuTranslation
} from "@/lib/translation/menuTranslationModel";
import {
  getServerTranslator,
  resolveTranslationProviderStatus
} from "@/lib/translation/serverTranslator";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

type AnyRow = Record<string, unknown>;

type TranslationContext = {
  client: SupabaseClient;
  restaurant: AnyRow;
  menu: AnyRow;
  categories: AnyRow[];
  dishes: AnyRow[];
  settings: PublicMenuSettings;
  entities: MenuTranslationSourceEntity[];
};

export type OwnerMenuTranslationOverview = {
  ok: true;
  provider: ReturnType<typeof resolveTranslationProviderStatus>;
  defaultLocale: string;
  supportedLocales: string[];
  locales: MenuTranslationStatusSummary[];
};

export type OwnerMenuTranslationResult =
  | OwnerMenuTranslationOverview
  | { ok: false; status: 400 | 404 | 503; error: string };

export type GenerateMenuTranslationsResult =
  | {
      ok: true;
      locale: string;
      dryRun: boolean;
      estimatedCharacters: number;
      translatedCharacters: number;
      provider: string;
      status: MenuTranslationStatusSummary;
    }
  | { ok: false; status: 400 | 404 | 503; error: string };

function getString(row: AnyRow, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = stringInput(row[key]);
    if (value) return value;
  }
  return fallback;
}

function getObject(row: AnyRow, keys: string[]): AnyRow {
  for (const key of keys) {
    const value = objectInput(row[key]);
    if (Object.keys(value).length > 0) return value;
  }
  return {};
}

function mergeStringLists(...values: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of values) {
    for (const item of list) {
      const cleaned = item.trim();
      const key = cleaned.toLowerCase();
      if (!cleaned || seen.has(key)) continue;
      seen.add(key);
      result.push(cleaned);
    }
  }
  return result;
}

function addField(
  fields: MenuTranslationFields,
  field: string,
  value: MenuTranslationFieldValue
) {
  const hasValue = Array.isArray(value)
    ? value.some((item) => item.trim())
    : value.trim().length > 0;
  if (hasValue) fields[field] = value;
}

function dishFields(row: AnyRow): MenuTranslationFields {
  const metadata = getObject(row, ["metadata", "meta"]);
  const fields: MenuTranslationFields = {};
  addField(fields, "name", getString(row, ["name"]));
  addField(fields, "description", getString(row, ["short_description", "shortDescription", "description"]));
  addField(
    fields,
    "ingredients",
    mergeStringLists(
      stringListInput(metadata.ingredients),
      stringListInput(metadata.ingredient_list),
      stringListInput(row.ingredients)
    )
  );
  addField(
    fields,
    "allergens",
    mergeStringLists(
      stringListInput(row.allergens),
      stringListInput(metadata.allergens),
      stringListInput(metadata.allergenes),
      stringListInput(metadata.allergen_list)
    )
  );
  addField(
    fields,
    "options",
    mergeStringLists(
      stringListInput(metadata.options),
      stringListInput(metadata.option_list),
      stringListInput(metadata.extras),
      stringListInput(metadata.accompaniments)
    )
  );
  addField(
    fields,
    "houseNote",
    getString(metadata, ["chefNote", "chef_note", "houseNote", "house_note"])
  );
  addField(
    fields,
    "tags",
    mergeStringLists(
      stringListInput(metadata.tags),
      stringListInput(metadata.labels),
      stringListInput(metadata.badges)
    )
  );
  return fields;
}

function categoryFields(row: AnyRow): MenuTranslationFields {
  const fields: MenuTranslationFields = {};
  addField(fields, "name", getString(row, ["name", "label"]));
  addField(fields, "description", getString(row, ["description"]));
  return fields;
}

function menuFields(menu: AnyRow): MenuTranslationFields {
  return menuTranslationFieldsFromNames({
    menuName: getString(menu, ["name"])
  });
}

function buildEntities(ctx: Omit<TranslationContext, "entities">): MenuTranslationSourceEntity[] {
  return [
    { type: "menu" as const, id: getString(ctx.menu, ["id"]), fields: menuFields(ctx.menu) },
    ...ctx.categories.map((category) => ({
      type: "category" as const,
      id: getString(category, ["id"]),
      fields: categoryFields(category)
    })),
    ...ctx.dishes.map((dish) => ({
      type: "dish" as const,
      id: getString(dish, ["id"]),
      fields: dishFields(dish)
    }))
  ].filter((entity) => entity.id && Object.keys(entity.fields).length > 0);
}

async function getTranslationContext(
  restaurantId: string
): Promise<TranslationContext | { error: string; status: 400 | 404 | 503 }> {
  if (!restaurantId.trim()) return { status: 400, error: "Restaurant requis." };
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return { status: 503, error: admin.reason };

  const restaurantResult = await admin.client
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle();
  if (restaurantResult.error) return { status: 503, error: "Restaurant impossible a lire." };
  if (!restaurantResult.data) return { status: 404, error: "Restaurant introuvable." };

  const menuResult = await admin.client
    .from("menus")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_primary", true)
    .maybeSingle();
  if (menuResult.error) return { status: 503, error: "Menu principal impossible a lire." };
  if (!menuResult.data) return { status: 404, error: "Menu principal introuvable." };

  const menuId = getString(menuResult.data as AnyRow, ["id"]);
  const [categoriesResult, dishesResult] = await Promise.all([
    admin.client
      .from("menu_categories")
      .select("*")
      .eq("menu_id", menuId)
      .order("display_order", { ascending: true }),
    admin.client
      .from("menu_dishes")
      .select("*")
      .eq("menu_id", menuId)
  ]);
  if (categoriesResult.error || dishesResult.error) {
    return { status: 503, error: "Donnees menu impossibles a lire." };
  }

  const settings = await readPublicMenuSettingsWithFallbacks({
    client: admin.client,
    restaurantId,
    menuId,
    menuRow: menuResult.data
  });

  const partial = {
    client: admin.client,
    restaurant: restaurantResult.data as AnyRow,
    menu: menuResult.data as AnyRow,
    categories: (categoriesResult.data ?? []) as AnyRow[],
    dishes: (dishesResult.data ?? []) as AnyRow[],
    settings
  };

  return { ...partial, entities: buildEntities(partial) };
}

function tableForEntity(type: string): string {
  if (type === "category") return "menu_category_translations";
  if (type === "dish") return "menu_dish_translations";
  return "menu_translations";
}

function idColumnForEntity(type: string): string {
  if (type === "category") return "category_id";
  if (type === "dish") return "dish_id";
  return "menu_id";
}

function keyForStoredRow(type: "menu" | "category" | "dish", row: AnyRow): string {
  const id =
    type === "category"
      ? getString(row, ["category_id", "categoryId"])
      : type === "dish"
        ? getString(row, ["dish_id", "dishId"])
        : getString(row, ["menu_id", "menuId"]);
  return `${type}:${id}`;
}

type StoredTranslationsReadError = { ok: false; status: 503; error: string };
type StoredTranslationsReadResult =
  | { ok: true; rowsByKey: Map<string, StoredMenuTranslation> }
  | StoredTranslationsReadError;

function supabaseErrorMessage(error: unknown): string {
  const details = objectInput(error);
  return [
    stringInput(details.message),
    stringInput(details.details),
    stringInput(details.hint),
    stringInput(details.code)
  ]
    .filter(Boolean)
    .join(" ");
}

function translationStorageError(
  table: string,
  error: unknown
): StoredTranslationsReadError {
  const detail = supabaseErrorMessage(error);
  return {
    ok: false,
    status: 503,
    error:
      `Stockage des traductions indisponible (${table}). ` +
      "Appliquez la migration Supabase des traductions avant de generer. " +
      (detail ? `Detail Supabase: ${detail}` : "Detail Supabase indisponible.")
  };
}

async function readStoredTranslations(
  client: SupabaseClient,
  menuId: string,
  locales: string[]
): Promise<StoredTranslationsReadResult> {
  const rowsByKey = new Map<string, StoredMenuTranslation>();
  if (locales.length === 0) return { ok: true, rowsByKey };
  const [menuRows, categoryRows, dishRows] = await Promise.all([
    client.from("menu_translations").select("*").eq("menu_id", menuId).in("locale", locales),
    client.from("menu_category_translations").select("*").eq("menu_id", menuId).in("locale", locales),
    client.from("menu_dish_translations").select("*").eq("menu_id", menuId).in("locale", locales)
  ]);

  if (menuRows.error) return translationStorageError("menu_translations", menuRows.error);
  if (categoryRows.error) {
    return translationStorageError("menu_category_translations", categoryRows.error);
  }
  if (dishRows.error) return translationStorageError("menu_dish_translations", dishRows.error);

  for (const row of (menuRows.data ?? []) as AnyRow[]) {
    rowsByKey.set(keyForStoredRow("menu", row), row as StoredMenuTranslation);
  }
  for (const row of (categoryRows.data ?? []) as AnyRow[]) {
    rowsByKey.set(keyForStoredRow("category", row), row as StoredMenuTranslation);
  }
  for (const row of (dishRows.data ?? []) as AnyRow[]) {
    rowsByKey.set(keyForStoredRow("dish", row), row as StoredMenuTranslation);
  }
  return { ok: true, rowsByKey };
}

export async function getOwnerMenuTranslationOverview(
  restaurantId: string
): Promise<OwnerMenuTranslationResult> {
  const ctx = await getTranslationContext(restaurantId);
  if ("error" in ctx) return { ok: false, status: ctx.status, error: ctx.error };

  const menuId = getString(ctx.menu, ["id"]);
  const rowsByKey = await readStoredTranslations(
    ctx.client,
    menuId,
    ctx.settings.supportedLocales
  );
  if (!rowsByKey.ok) {
    return { ok: false, status: rowsByKey.status, error: rowsByKey.error };
  }
  return {
    ok: true,
    provider: resolveTranslationProviderStatus(),
    defaultLocale: ctx.settings.defaultLocale,
    supportedLocales: ctx.settings.supportedLocales,
    locales: ctx.settings.supportedLocales.map((locale) =>
      summarizeLocaleTranslationStatus({
        locale,
        defaultLocale: ctx.settings.defaultLocale,
        entities: ctx.entities,
        rowsByKey: rowsByKey.rowsByKey
      })
    )
  };
}

function flattenTranslationTasks(entity: MenuTranslationSourceEntity, row?: StoredMenuTranslation | null) {
  const storedFieldHashes = objectInput(row?.field_hashes);
  const content = objectInput(row?.content);
  const manualOverrides = objectInput(row?.manual_overrides);
  const expectedFieldHashes = fieldHashesFor(entity.fields);
  const tasks: Array<{ field: string; index?: number; text: string }> = [];

  for (const [field, value] of Object.entries(entity.fields)) {
    if (manualOverrides[field] === true) continue;
    if (
      storedFieldHashes[field] === expectedFieldHashes[field] &&
      content[field] !== undefined
    ) {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((text, index) => {
        if (text.trim()) tasks.push({ field, index, text });
      });
    } else if (value.trim()) {
      tasks.push({ field, text: value });
    }
  }

  return tasks;
}

function applyTaskTranslations(
  entity: MenuTranslationSourceEntity,
  row: StoredMenuTranslation | undefined,
  tasks: Array<{ field: string; index?: number; text: string }>,
  translations: string[]
) {
  const nextContent = { ...objectInput(row?.content) };
  tasks.forEach((task, taskIndex) => {
    if (task.index === undefined) {
      nextContent[task.field] = translations[taskIndex];
      return;
    }
    const list = Array.isArray(nextContent[task.field])
      ? [...(nextContent[task.field] as unknown[]).map((item) => stringInput(item))]
      : Array.isArray(entity.fields[task.field])
        ? [...(entity.fields[task.field] as string[])]
        : [];
    list[task.index] = translations[taskIndex];
    nextContent[task.field] = list;
  });
  return nextContent;
}

async function upsertEntityTranslation(args: {
  ctx: TranslationContext;
  entity: MenuTranslationSourceEntity;
  locale: string;
  provider: string;
  content: AnyRow;
}) {
  const menuId = getString(args.ctx.menu, ["id"]);
  const payload: AnyRow = {
    restaurant_id: getString(args.ctx.restaurant, ["id"]),
    menu_id: menuId,
    locale: args.locale,
    translation_status: "up_to_date",
    provider: args.provider,
    source_hash: sourceHashFor(args.entity.fields),
    field_hashes: fieldHashesFor(args.entity.fields),
    content: args.content,
    translated_at: new Date().toISOString(),
    error_message: null,
    updated_at: new Date().toISOString()
  };
  payload[idColumnForEntity(args.entity.type)] =
    args.entity.type === "menu" ? menuId : args.entity.id;

  const { error } = await args.ctx.client
    .from(tableForEntity(args.entity.type))
    .upsert(payload, { onConflict: `${idColumnForEntity(args.entity.type)},locale` });
  if (error) throw new Error(error.message);
}

export async function generateOwnerMenuTranslations(args: {
  restaurantId: string;
  locale: string;
  dryRun?: boolean;
}): Promise<GenerateMenuTranslationsResult> {
  const ctx = await getTranslationContext(args.restaurantId);
  if ("error" in ctx) return { ok: false, status: ctx.status, error: ctx.error };
  if (!ctx.settings.supportedLocales.includes(args.locale)) {
    return { ok: false, status: 400, error: "Langue non activee pour ce menu." };
  }
  if (args.locale === ctx.settings.defaultLocale) {
    return { ok: false, status: 400, error: "La langue par defaut utilise les champs source." };
  }

  const menuId = getString(ctx.menu, ["id"]);
  const storedRows = await readStoredTranslations(ctx.client, menuId, [args.locale]);
  if (!storedRows.ok) {
    return { ok: false, status: storedRows.status, error: storedRows.error };
  }
  const rowsByKey = storedRows.rowsByKey;
  const estimatedCharacters = ctx.entities.reduce(
    (total, entity) => total + estimateChangedCharacters(entity, rowsByKey.get(`${entity.type}:${entity.id}`)),
    0
  );
  const providerStatus = resolveTranslationProviderStatus();

  if (args.dryRun) {
    return {
      ok: true,
      locale: args.locale,
      dryRun: true,
      estimatedCharacters,
      translatedCharacters: 0,
      provider: providerStatus.provider,
      status: summarizeLocaleTranslationStatus({
        locale: args.locale,
        defaultLocale: ctx.settings.defaultLocale,
        entities: ctx.entities,
        rowsByKey
      })
    };
  }

  const translator = getServerTranslator();
  if (!translator) {
    return {
      ok: false,
      status: 503,
      error: providerStatus.reason ?? "Provider traduction non configure."
    };
  }

  const maxCharacters = Number(process.env.TRANSLATION_MAX_CHARS_PER_RUN ?? 50000);
  if (estimatedCharacters > maxCharacters) {
    return {
      ok: false,
      status: 400,
      error: `Generation limitee a ${maxCharacters} caracteres par lancement. Estimation: ${estimatedCharacters}.`
    };
  }

  const job = await ctx.client
    .from("menu_translation_jobs")
    .insert({
      restaurant_id: getString(ctx.restaurant, ["id"]),
      menu_id: menuId,
      locale: args.locale,
      status: "running",
      provider: translator.provider,
      estimated_characters: estimatedCharacters,
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (job.error || !job.data?.id) {
    const storageError = translationStorageError(
      "menu_translation_jobs",
      job.error ?? { message: "Aucun identifiant de job retourne par Supabase." }
    );
    return { ok: false, status: storageError.status, error: storageError.error };
  }

  let translatedCharacters = 0;
  try {
    for (const entity of ctx.entities) {
      const row = rowsByKey.get(`${entity.type}:${entity.id}`);
      const entityStatus = resolveEntityTranslationStatus(entity, row);
      if (entityStatus.status === "up_to_date") continue;

      const tasks = flattenTranslationTasks(entity, row);
      if (tasks.length === 0) continue;
      const texts = tasks.map((task) => task.text);
      const translations = await translator.translateTexts({
        texts,
        fromLocale: ctx.settings.defaultLocale,
        toLocale: args.locale
      });
      translatedCharacters += texts.reduce((total, text) => total + text.length, 0);
      await upsertEntityTranslation({
        ctx,
        entity,
        locale: args.locale,
        provider: translator.provider,
        content: applyTaskTranslations(entity, row, tasks, translations)
      });
    }

    await ctx.client
      .from("menu_translation_jobs")
      .update({
        status: "succeeded",
        translated_characters: translatedCharacters,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", job.data.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation traduction echouee.";
    await ctx.client
      .from("menu_translation_jobs")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", job.data.id);
    return { ok: false, status: 503, error: message };
  }

  const updatedRows = await readStoredTranslations(ctx.client, menuId, [args.locale]);
  if (!updatedRows.ok) {
    return { ok: false, status: updatedRows.status, error: updatedRows.error };
  }
  return {
    ok: true,
    locale: args.locale,
    dryRun: false,
    estimatedCharacters,
    translatedCharacters,
    provider: translator.provider,
    status: summarizeLocaleTranslationStatus({
      locale: args.locale,
      defaultLocale: ctx.settings.defaultLocale,
      entities: ctx.entities,
      rowsByKey: updatedRows.rowsByKey
    })
  };
}
