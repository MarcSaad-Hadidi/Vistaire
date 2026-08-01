import "server-only";

import {
  objectInput,
  stringInput,
  type MenuTranslationFields
} from "@/lib/translation/menuTranslationModel";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import type { PublicMenu, PublicMenuTranslationStatus } from "./publicMenuCore";
import { normalizePublicMenuLocalePreference } from "./publicMenuSettings";
import { buildMaisonEnglishPublicMenu } from "./publicMenuEnglishFallback";
import {
  filterPublicMenuSettingsForReadyTranslations,
  publicMenuCategoryTranslationSources,
  publicMenuDishTranslationFields,
  publicMenuTranslationMenuFields,
  publicMenuTranslationStatusesForRows,
  storedTranslationFieldMatches,
  type PublicMenuTranslationReadinessOptions,
  type PublicMenuTranslationRows
} from "./publicMenuTranslationReadiness.ts";

type AnyRow = Record<string, unknown>;

function missingTranslationStatuses(menu: PublicMenu): PublicMenuTranslationStatus[] {
  return menu.settings.supportedLocales.map((locale) => ({
    locale,
    status: locale === menu.settings.defaultLocale ? "source" : "missing"
  }));
}

function rowsForLocale(rows: AnyRow[], locale: string): AnyRow[] {
  return rows.filter((row) => stringInput(row.locale) === locale);
}

function rowById(rows: AnyRow[], idField: string): Map<string, AnyRow> {
  return new Map(
    rows
      .map((row) => [stringInput(row[idField]), row] as const)
      .filter(([id]) => Boolean(id))
  );
}

function statusForLocale(
  statuses: PublicMenuTranslationStatus[],
  locale: string
): PublicMenuTranslationStatus {
  return statuses.find((status) => status.locale === locale) ?? {
    locale,
    status: "missing"
  };
}

function listInput(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => stringInput(item)).filter(Boolean)
    : [];
}

function getTranslatedString(args: {
  field: string;
  source: string;
  sourceFields: MenuTranslationFields;
  row?: AnyRow;
  readinessOptions?: PublicMenuTranslationReadinessOptions;
}): string {
  if (!args.source.trim()) return args.source;
  const content = objectInput(args.row?.content);
  if (
    !storedTranslationFieldMatches(
      args.row,
      args.sourceFields,
      args.field,
      args.source,
      args.readinessOptions
    )
  ) {
    return args.source;
  }
  const translated = stringInput(content[args.field]);
  return translated || args.source;
}

function getTranslatedList(args: {
  field: string;
  source: string[];
  sourceFields: MenuTranslationFields;
  row?: AnyRow;
  readinessOptions?: PublicMenuTranslationReadinessOptions;
}): string[] {
  if (args.source.length === 0) return args.source;
  const content = objectInput(args.row?.content);
  if (
    !storedTranslationFieldMatches(
      args.row,
      args.sourceFields,
      args.field,
      args.source,
      args.readinessOptions
    )
  ) {
    return args.source;
  }
  const translated = listInput(content[args.field]);
  return translated.length > 0 ? translated : args.source;
}

export async function applyStoredPublicMenuTranslations(
  menu: PublicMenu,
  requestedLocale: unknown
): Promise<PublicMenu> {
  const requestedEnglish =
    typeof requestedLocale === "string" &&
    /^en(?:-|$)/i.test(requestedLocale.trim());
  const allowLegacyEnglishTranslation =
    requestedEnglish &&
    (menu.slug === "trouvable" || menu.slug === "sauge-noire");
  const readinessOptions: PublicMenuTranslationReadinessOptions =
    allowLegacyEnglishTranslation
      ? { allowUpToDateHashMismatch: true }
      : {};
  const requestedActiveLocale = normalizePublicMenuLocalePreference(
    requestedLocale,
    menu.settings
  );
  if (menu.source !== "supabase" || !menu.menuId) {
    const translationLocales = missingTranslationStatuses(menu);
    return {
      ...menu,
      activeLocale: requestedActiveLocale,
      translationLocales,
      translationStatus: statusForLocale(translationLocales, requestedActiveLocale)
    };
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    const translationLocales = missingTranslationStatuses(menu);
    const filteredSettings = filterPublicMenuSettingsForReadyTranslations(
      menu.settings,
      translationLocales
    );
    const publicSettings = filteredSettings;
    const activeLocale = normalizePublicMenuLocalePreference(
      requestedLocale,
      publicSettings
    );
    return {
      ...menu,
      settings: publicSettings,
      activeLocale,
      translationLocales,
      translationStatus: statusForLocale(translationLocales, activeLocale)
    };
  }

  const translationCandidateLocales = menu.settings.supportedLocales.filter(
    (locale) => locale !== menu.settings.defaultLocale
  );
  const [menuRows, categoryRows, dishRows] = await Promise.all([
    translationCandidateLocales.length > 0
      ? admin.client
          .from("menu_translations")
          .select(
            "locale,translation_status,source_hash,field_hashes,content,manual_overrides"
          )
          .eq("menu_id", menu.menuId)
          .in("locale", translationCandidateLocales)
      : Promise.resolve({ data: [], error: null }),
    translationCandidateLocales.length > 0
      ? admin.client
          .from("menu_category_translations")
          .select(
            "category_id,locale,translation_status,source_hash,field_hashes,content,manual_overrides"
          )
          .eq("menu_id", menu.menuId)
          .in("locale", translationCandidateLocales)
      : Promise.resolve({ data: [], error: null }),
    translationCandidateLocales.length > 0
      ? admin.client
          .from("menu_dish_translations")
          .select(
            "dish_id,locale,translation_status,source_hash,field_hashes,content,manual_overrides"
          )
          .eq("menu_id", menu.menuId)
          .in("locale", translationCandidateLocales)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (menuRows.error || categoryRows.error || dishRows.error) {
    const translationLocales = missingTranslationStatuses(menu);
    const filteredSettings = filterPublicMenuSettingsForReadyTranslations(
      menu.settings,
      translationLocales
    );
    const publicSettings = filteredSettings;
    const activeLocale = normalizePublicMenuLocalePreference(
      requestedLocale,
      publicSettings
    );
    return {
      ...menu,
      settings: publicSettings,
      activeLocale,
      translationLocales,
      translationStatus: statusForLocale(translationLocales, activeLocale)
    };
  }

  const translationRows: PublicMenuTranslationRows = {
    menuRows: (menuRows.data ?? []) as AnyRow[],
    categoryRows: (categoryRows.data ?? []) as AnyRow[],
    dishRows: (dishRows.data ?? []) as AnyRow[]
  };
  const translationLocales = publicMenuTranslationStatusesForRows(
    menu,
    translationRows,
    readinessOptions
  );

  if (
    requestedEnglish &&
    menu.slug === "maison-elyse" &&
    translationLocales.find((status) => status.locale === "en-CA")?.status !==
      "up_to_date"
  ) {
    return buildMaisonEnglishPublicMenu(menu);
  }

  const filteredSettings = filterPublicMenuSettingsForReadyTranslations(
    menu.settings,
    translationLocales
  );
  const compatibilitySupportedLocales = Array.from(
    new Set([...filteredSettings.supportedLocales, "en-CA"])
  ) as typeof filteredSettings.supportedLocales;
  const publicSettings = allowLegacyEnglishTranslation
    ? {
        ...filteredSettings,
        supportedLocales: compatibilitySupportedLocales
      }
    : filteredSettings;
  const activeLocale = allowLegacyEnglishTranslation
    ? "en-CA"
    : normalizePublicMenuLocalePreference(requestedLocale, publicSettings);
  const effectiveTranslationLocales = allowLegacyEnglishTranslation
    ? [
        ...translationLocales.filter((status) => status.locale !== "en-CA"),
        { locale: "en-CA", status: "up_to_date" as const }
      ]
    : translationLocales;

  if (activeLocale === publicSettings.defaultLocale) {
    return {
      ...menu,
      settings: publicSettings,
      activeLocale,
      translationLocales: effectiveTranslationLocales,
      translationStatus: statusForLocale(
        effectiveTranslationLocales,
        activeLocale
      )
    };
  }

  const activeMenuRows = rowsForLocale(translationRows.menuRows, activeLocale);
  const activeCategoryRows = rowsForLocale(translationRows.categoryRows, activeLocale);
  const activeDishRows = rowsForLocale(translationRows.dishRows, activeLocale);
  const menuRow = activeMenuRows[0];
  const categoryRowsById = rowById(activeCategoryRows, "category_id");
  const dishRowsById = rowById(activeDishRows, "dish_id");
  const categoryFieldsById = new Map(
    publicMenuCategoryTranslationSources(menu).map((category) => [
      category.id,
      category.fields
    ])
  );

  const translatedMenuFields = publicMenuTranslationMenuFields(menu);
  const translatedMenuName = menu.menuName
    ? getTranslatedString({
        field: "menuName",
        source: menu.menuName,
        sourceFields: translatedMenuFields,
        row: menuRow,
        readinessOptions
      })
    : menu.menuName;

  const translatedDishes = menu.dishes.map((dish) => {
    const sourceFields = publicMenuDishTranslationFields(dish);
    const dishRow = dishRowsById.get(dish.id);
    const translatableTags = Array.isArray(sourceFields.tags)
      ? sourceFields.tags
      : [];
    const categoryId = dish.categoryId || dish.category;
    const categoryFields = categoryFieldsById.get(categoryId);
    const categoryRow = categoryRowsById.get(categoryId);
    return {
      ...dish,
      name: getTranslatedString({
        field: "name",
        source: dish.name,
        sourceFields,
        row: dishRow,
        readinessOptions
      }),
      description: getTranslatedString({
        field: "description",
        source: dish.description,
        sourceFields,
        row: dishRow,
        readinessOptions
      }),
      category:
        categoryFields && categoryRow
          ? getTranslatedString({
              field: "name",
              source: dish.category,
              sourceFields: categoryFields,
              row: categoryRow,
              readinessOptions
            })
          : dish.category,
      categoryDescription:
        categoryFields && categoryRow
          ? getTranslatedString({
              field: "description",
              source: dish.categoryDescription ?? "",
              sourceFields: categoryFields,
              row: categoryRow,
              readinessOptions
            })
          : dish.categoryDescription,
      ingredients: getTranslatedList({
        field: "ingredients",
        source: dish.ingredients,
        sourceFields,
        row: dishRow,
        readinessOptions
      }),
      allergens: getTranslatedList({
        field: "allergens",
        source: dish.allergens,
        sourceFields,
        row: dishRow,
        readinessOptions
      }),
      options: getTranslatedList({
        field: "options",
        source: dish.options,
        sourceFields,
        row: dishRow,
        readinessOptions
      }),
      houseNote: getTranslatedString({
        field: "houseNote",
        source: dish.houseNote,
        sourceFields,
        row: dishRow,
        readinessOptions
      }),
      tags: getTranslatedList({
        field: "tags",
        source: translatableTags,
        sourceFields,
        row: dishRow,
        readinessOptions
      })
    };
  });

  return {
    ...menu,
    settings: publicSettings,
    activeLocale,
    name: menu.name,
    menuName: translatedMenuName,
    dishes: translatedDishes,
    translationLocales: effectiveTranslationLocales,
    translationStatus: statusForLocale(
      effectiveTranslationLocales,
      activeLocale
    )
  };
}
