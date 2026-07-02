import "server-only";

import {
  fieldHashesFor,
  objectInput,
  sourceHashFor,
  stringInput,
  type MenuTranslationFields
} from "@/lib/translation/menuTranslationModel";
import { menuTranslationFieldsFromNames } from "@/lib/translation/menuTranslationFields";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import type { PublicMenu, PublicMenuDish } from "./publicMenuCore";
import { normalizePublicMenuLocalePreference } from "./publicMenuSettings";

type AnyRow = Record<string, unknown>;

function listInput(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => stringInput(item)).filter(Boolean)
    : [];
}

function dishFields(dish: PublicMenuDish): MenuTranslationFields {
  return {
    name: dish.name,
    ...(dish.description ? { description: dish.description } : {}),
    ...(dish.ingredients.length > 0 ? { ingredients: dish.ingredients } : {}),
    ...(dish.allergens.length > 0 ? { allergens: dish.allergens } : {}),
    ...(dish.options.length > 0 ? { options: dish.options } : {}),
    ...(dish.houseNote ? { houseNote: dish.houseNote } : {}),
    ...(dish.tags.length > 0 ? { tags: dish.tags } : {})
  };
}

function menuFields(menu: PublicMenu): MenuTranslationFields {
  return menuTranslationFieldsFromNames({
    menuName: menu.menuName
  });
}

function categorySources(menu: PublicMenu): Array<{
  id: string;
  fields: MenuTranslationFields;
}> {
  const byId = new Map<string, { id: string; fields: MenuTranslationFields }>();
  for (const dish of menu.dishes) {
    const id = dish.categoryId || dish.category;
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      fields: {
        name: dish.category,
        ...(dish.categoryDescription ? { description: dish.categoryDescription } : {})
      }
    });
  }
  return Array.from(byId.values());
}

function getTranslatedString(args: {
  field: string;
  source: string;
  sourceFields: MenuTranslationFields;
  row?: AnyRow;
}): string {
  if (!args.source.trim()) return args.source;
  const content = objectInput(args.row?.content);
  const fieldHashes = objectInput(args.row?.field_hashes);
  const expectedHashes = fieldHashesFor(args.sourceFields);
  if (
    args.row?.translation_status !== "up_to_date" ||
    args.row?.source_hash !== sourceHashFor(args.sourceFields) ||
    fieldHashes[args.field] !== expectedHashes[args.field]
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
}): string[] {
  if (args.source.length === 0) return args.source;
  const content = objectInput(args.row?.content);
  const fieldHashes = objectInput(args.row?.field_hashes);
  const expectedHashes = fieldHashesFor(args.sourceFields);
  if (
    args.row?.translation_status !== "up_to_date" ||
    args.row?.source_hash !== sourceHashFor(args.sourceFields) ||
    fieldHashes[args.field] !== expectedHashes[args.field]
  ) {
    return args.source;
  }
  const translated = listInput(content[args.field]);
  return translated.length > 0 ? translated : args.source;
}

function rowMatchesSource(row: AnyRow | undefined, fields: MenuTranslationFields): boolean {
  if (!row || row.translation_status !== "up_to_date") return false;
  return row.source_hash === sourceHashFor(fields);
}

function translationStatus(args: {
  locale: string;
  menuRow?: AnyRow;
  menuFields: MenuTranslationFields;
  categoryRowsById: Map<string, AnyRow>;
  categoryFieldsById: Map<string, MenuTranslationFields>;
  dishRowsById: Map<string, AnyRow>;
  dishes: PublicMenuDish[];
}): NonNullable<PublicMenu["translationStatus"]> {
  const hasMenuFields = Object.keys(args.menuFields).length > 0;
  const rows = [
    ...(hasMenuFields ? [args.menuRow] : []),
    ...args.categoryRowsById.values(),
    ...args.dishRowsById.values()
  ].filter(Boolean) as AnyRow[];

  if (rows.some((row) => row.translation_status === "error")) {
    return { locale: args.locale, status: "error" };
  }
  if (rows.some((row) => row.translation_status === "in_progress")) {
    return { locale: args.locale, status: "in_progress" };
  }
  if (rows.some((row) => row.translation_status === "pending")) {
    return { locale: args.locale, status: "pending" };
  }

  if (hasMenuFields && !rowMatchesSource(args.menuRow, args.menuFields)) {
    return { locale: args.locale, status: args.menuRow ? "stale" : "missing" };
  }

  for (const [categoryId, fields] of args.categoryFieldsById.entries()) {
    const row = args.categoryRowsById.get(categoryId);
    if (!rowMatchesSource(row, fields)) {
      return { locale: args.locale, status: row ? "stale" : "missing" };
    }
  }

  for (const dish of args.dishes) {
    const row = args.dishRowsById.get(dish.id);
    if (!rowMatchesSource(row, dishFields(dish))) {
      return { locale: args.locale, status: row ? "stale" : "missing" };
    }
  }

  return { locale: args.locale, status: "up_to_date" };
}

export async function applyStoredPublicMenuTranslations(
  menu: PublicMenu,
  requestedLocale: unknown
): Promise<PublicMenu> {
  const activeLocale = normalizePublicMenuLocalePreference(requestedLocale, menu.settings);
  if (menu.source !== "supabase" || !menu.menuId) {
    return {
      ...menu,
      activeLocale,
      translationStatus: {
        locale: activeLocale,
        status: activeLocale === menu.settings.defaultLocale ? "source" : "missing"
      }
    };
  }
  if (activeLocale === menu.settings.defaultLocale) {
    return {
      ...menu,
      activeLocale,
      translationStatus: { locale: activeLocale, status: "source" }
    };
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return {
      ...menu,
      activeLocale,
      translationStatus: { locale: activeLocale, status: "missing" }
    };
  }

  const [menuRows, categoryRows, dishRows] = await Promise.all([
    admin.client
      .from("menu_translations")
      .select("locale,translation_status,source_hash,field_hashes,content")
      .eq("menu_id", menu.menuId)
      .eq("locale", activeLocale),
    admin.client
      .from("menu_category_translations")
      .select("category_id,locale,translation_status,source_hash,field_hashes,content")
      .eq("menu_id", menu.menuId)
      .eq("locale", activeLocale),
    admin.client
      .from("menu_dish_translations")
      .select("dish_id,locale,translation_status,source_hash,field_hashes,content")
      .eq("menu_id", menu.menuId)
      .eq("locale", activeLocale)
  ]);

  if (menuRows.error || categoryRows.error || dishRows.error) {
    return {
      ...menu,
      activeLocale,
      translationStatus: { locale: activeLocale, status: "missing" }
    };
  }

  const menuRow = ((menuRows.data ?? []) as AnyRow[])[0];
  const categoryRowsById = new Map(
    ((categoryRows.data ?? []) as AnyRow[]).map((row) => [stringInput(row.category_id), row])
  );
  const dishRowsById = new Map(
    ((dishRows.data ?? []) as AnyRow[]).map((row) => [stringInput(row.dish_id), row])
  );
  const categoryFieldsById = new Map(
    categorySources(menu).map((category) => [category.id, category.fields])
  );

  const translatedMenuFields = menuFields(menu);
  const translatedMenuName = menu.menuName
    ? getTranslatedString({
        field: "menuName",
        source: menu.menuName,
        sourceFields: translatedMenuFields,
        row: menuRow
      })
    : menu.menuName;

  const translatedDishes = menu.dishes.map((dish) => {
    const sourceFields = dishFields(dish);
    const dishRow = dishRowsById.get(dish.id);
    const categoryId = dish.categoryId || dish.category;
    const categoryFields = categoryFieldsById.get(categoryId);
    const categoryRow = categoryRowsById.get(categoryId);
    return {
      ...dish,
      name: getTranslatedString({
        field: "name",
        source: dish.name,
        sourceFields,
        row: dishRow
      }),
      description: getTranslatedString({
        field: "description",
        source: dish.description,
        sourceFields,
        row: dishRow
      }),
      category:
        categoryFields && categoryRow
          ? getTranslatedString({
              field: "name",
              source: dish.category,
              sourceFields: categoryFields,
              row: categoryRow
            })
          : dish.category,
      categoryDescription:
        categoryFields && categoryRow
          ? getTranslatedString({
              field: "description",
              source: dish.categoryDescription ?? "",
              sourceFields: categoryFields,
              row: categoryRow
            })
          : dish.categoryDescription,
      ingredients: getTranslatedList({
        field: "ingredients",
        source: dish.ingredients,
        sourceFields,
        row: dishRow
      }),
      allergens: getTranslatedList({
        field: "allergens",
        source: dish.allergens,
        sourceFields,
        row: dishRow
      }),
      options: getTranslatedList({
        field: "options",
        source: dish.options,
        sourceFields,
        row: dishRow
      }),
      houseNote: getTranslatedString({
        field: "houseNote",
        source: dish.houseNote,
        sourceFields,
        row: dishRow
      }),
      tags: getTranslatedList({
        field: "tags",
        source: dish.tags,
        sourceFields,
        row: dishRow
      })
    };
  });

  return {
    ...menu,
    activeLocale,
    name: menu.name,
    menuName: translatedMenuName,
    dishes: translatedDishes,
    translationStatus: translationStatus({
      locale: activeLocale,
      menuRow,
      menuFields: translatedMenuFields,
      categoryRowsById,
      categoryFieldsById,
      dishRowsById,
      dishes: menu.dishes
    })
  };
}
