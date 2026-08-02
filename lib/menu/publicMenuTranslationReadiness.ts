import {
  fieldHashMatchesFields,
  objectInput,
  sourceHashMatchesFields,
  sourceHashCompatibleWithManualOverrides,
  stringInput,
  translationValueIsSourceIdentical,
  type MenuTranslationFields
} from "../translation/menuTranslationModel.ts";
import {
  canonicalDishDerivedTags,
  canonicalDishTranslationFields,
  menuTranslationFieldsFromNames
} from "../translation/menuTranslationFields.ts";
import type {
  PublicMenu,
  PublicMenuDish,
  PublicMenuTranslationStatus
} from "./publicMenuCore.ts";
import type { PublicMenuSettings } from "./publicMenuSettings.ts";
import { publicMenuUiCopyReadiness } from "../translation/publicMenuUiCopyTranslation.ts";

type AnyRow = Record<string, unknown>;

export type PublicMenuTranslationRows = {
  menuRows: AnyRow[];
  categoryRows: AnyRow[];
  dishRows: AnyRow[];
};

function listInput(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => stringInput(item)).filter(Boolean)
    : [];
}

function missingTranslatedFieldReason(
  content: Record<string, unknown>,
  field: string,
  sourceValue: MenuTranslationFields[string],
  manualOverride = false
): string {
  if (Array.isArray(sourceValue)) {
    const sourceCount = sourceValue.map((item) => item.trim()).filter(Boolean).length;
    if (sourceCount === 0) return "";
    const translatedCount = listInput(content[field]).length;
    if (manualOverride && translatedCount > 0) return "";
    return translatedCount >= sourceCount
      ? ""
      : `missing translated content (${translatedCount}/${sourceCount})`;
  }
  if (!sourceValue.trim()) return "";
  const translatedValue = stringInput(content[field]);
  if (!translatedValue) return "missing translated content";

  // Prose that is byte-for-byte identical to the source is still the source
  // copy. Dish names intentionally are not part of the public translation
  // fields, while descriptions must not silently fall back to French.
  if (translationValueIsSourceIdentical(field, sourceValue, translatedValue)) {
    return "source language content";
  }

  return "";
}

function derivedDishTags(dish: PublicMenuDish): string[] {
  return canonicalDishDerivedTags(dish);
}

function rowHasUsablePublicTranslationStatus(row: AnyRow): boolean {
  const status = stringInput(row.translation_status);
  return status === "up_to_date";
}

export function storedTranslationFieldMatches(
  row: AnyRow | undefined,
  fields: MenuTranslationFields,
  field: string,
  sourceValue: MenuTranslationFields[string],
  legacyDerivedTags: readonly string[] = []
): boolean {
  return !storedTranslationFieldFailure(
    row,
    fields,
    field,
    sourceValue,
    legacyDerivedTags
  );
}

function storedTranslationFieldFailure(
  row: AnyRow | undefined,
  fields: MenuTranslationFields,
  field: string,
  sourceValue: MenuTranslationFields[string],
  legacyDerivedTags: readonly string[] = []
): string {
  if (!row) return "missing row";
  if (!rowHasUsablePublicTranslationStatus(row)) {
    return `row status ${stringInput(row.translation_status) || "missing"}`;
  }

  const content = objectInput(row.content);
  const manualOverrides = objectInput(row.manual_overrides);
  const overrideValue = manualOverrides[field];
  if (
    overrideValue !== undefined &&
    overrideValue !== true &&
    overrideValue !== false
  ) {
    return "invalid manual override";
  }
  const contentReason = missingTranslatedFieldReason(
    content,
    field,
    sourceValue,
    manualOverrides[field] === true
  );
  // A manual override is authoritative only when it still contains usable
  // content. This lets an owner intentionally keep French copy, while empty
  // overrides continue to fail closed.
  if (contentReason && !(manualOverrides[field] === true && contentReason === "source language content")) {
    return contentReason;
  }

  const inferredEntityType =
    "menuName" in fields ? "menu" : "name" in fields ? "category" : "dish";
  const sourceHashReady =
    sourceHashMatchesFields(fields, row, inferredEntityType, legacyDerivedTags) ||
    sourceHashCompatibleWithManualOverrides(
      fields,
      row,
      inferredEntityType,
      legacyDerivedTags
    );
  if (manualOverrides[field] === true && !contentReason.startsWith("missing")) {
    return "";
  }
  if (!sourceHashReady) {
    return "source hash mismatch";
  }

  if (manualOverrides[field] === true) return "";

  if (
    fieldHashMatchesFields(
      fields,
      row,
      field,
      inferredEntityType,
      legacyDerivedTags
    )
  ) return "";
  return "field hash mismatch";
}

export function publicMenuDishTranslationFields(
  dish: PublicMenuDish
): MenuTranslationFields {
  return canonicalDishTranslationFields({
    description: dish.description,
    ingredients: dish.ingredients,
    allergens: dish.allergens,
    options: dish.options,
    houseNote: dish.houseNote,
    tags: dish.tags,
    isSignature: dish.isSignature,
    isRecommended: dish.isRecommended
  });
}

export function publicMenuTranslationMenuFields(
  menu: PublicMenu
): MenuTranslationFields {
  return menuTranslationFieldsFromNames({
    menuName: menu.menuName
  });
}

export function publicMenuCategoryTranslationSources(menu: PublicMenu): Array<{
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

export function storedTranslationRowMatchesFields(
  row: AnyRow | undefined,
  fields: MenuTranslationFields,
  legacyDerivedTags: readonly string[] = []
): boolean {
  const entries = Object.entries(fields);
  if (entries.length === 0) return true;

  return entries.every(
    ([field, sourceValue]) =>
      storedTranslationFieldMatches(
        row,
        fields,
        field,
        sourceValue,
        legacyDerivedTags
      )
  );
}

function rowsByLocale(rows: AnyRow[]): Map<string, AnyRow[]> {
  const byLocale = new Map<string, AnyRow[]>();
  for (const row of rows) {
    const locale = stringInput(row.locale);
    if (!locale) continue;
    byLocale.set(locale, [...(byLocale.get(locale) ?? []), row]);
  }
  return byLocale;
}

function rowsById(rows: AnyRow[], idField: string): Map<string, AnyRow> {
  return new Map(
    rows
      .map((row) => [stringInput(row[idField]), row] as const)
      .filter(([id]) => Boolean(id))
  );
}

function statusForRows(args: {
  locale: string;
  menu: PublicMenu;
  menuRow?: AnyRow;
  menuFields: MenuTranslationFields;
  categoryRowsById: Map<string, AnyRow>;
  categoryFieldsById: Map<string, MenuTranslationFields>;
  dishRowsById: Map<string, AnyRow>;
  dishes: PublicMenuDish[];
}): PublicMenuTranslationStatus {
  const rows = [
    ...(Object.keys(args.menuFields).length > 0 ? [args.menuRow] : []),
    ...args.categoryRowsById.values(),
    ...args.dishRowsById.values()
  ].filter(Boolean) as AnyRow[];

  const errorRow = rows.find((row) => row.translation_status === "error");
  if (errorRow) {
    return { locale: args.locale, status: "error", reason: "translation row error" };
  }
  const inProgressRow = rows.find((row) => row.translation_status === "in_progress");
  if (inProgressRow) {
    return {
      locale: args.locale,
      status: "in_progress",
      reason: "translation row in progress"
    };
  }
  const pendingRow = rows.find((row) => row.translation_status === "pending");
  if (pendingRow) {
    return { locale: args.locale, status: "pending", reason: "translation row pending" };
  }

  for (const [field, sourceValue] of Object.entries(args.menuFields)) {
    const reason = storedTranslationFieldFailure(
      args.menuRow,
      args.menuFields,
      field,
      sourceValue
    );
    if (!reason) continue;
    return {
      locale: args.locale,
      status: args.menuRow ? "stale" : "missing",
      reason,
      entityType: "menu",
      field
    };
  }

  for (const [categoryId, fields] of args.categoryFieldsById.entries()) {
    const row = args.categoryRowsById.get(categoryId);
    for (const [field, sourceValue] of Object.entries(fields)) {
      const reason = storedTranslationFieldFailure(
        row,
        fields,
        field,
        sourceValue
      );
      if (!reason) continue;
      return {
        locale: args.locale,
        status: row ? "stale" : "missing",
        reason,
        entityType: "category",
        entityId: categoryId,
        entityLabel: stringInput(fields.name),
        field
      };
    }
  }

  for (const dish of args.dishes) {
    const row = args.dishRowsById.get(dish.id);
    const fields = publicMenuDishTranslationFields(dish);
    const legacyDerivedTags = derivedDishTags(dish);
    for (const [field, sourceValue] of Object.entries(fields)) {
      const reason = storedTranslationFieldFailure(
        row,
        fields,
        field,
        sourceValue,
        legacyDerivedTags
      );
      if (!reason) continue;

      // Signature/recommended labels are derived presentation tags. The
      // translation generator hashes the original metadata tags, while the
      // public dish model removes those two labels after deriving booleans.
      // Keep a current, complete translation usable when only that derived
      // tag hash differs.
      if (
        field === "tags" &&
        legacyDerivedTags.length > 0 &&
        row &&
        stringInput(row.translation_status) === "up_to_date" &&
        stringInput(row.source_hash) &&
        reason === "field hash mismatch" &&
        listInput(objectInput(row.content).tags).length >= listInput(sourceValue).length
      ) {
        continue;
      }

      return {
        locale: args.locale,
        status: row ? "stale" : "missing",
        reason,
        entityType: "dish",
        entityId: dish.id,
        entityLabel: dish.name,
        field
      };
    }
  }

  const uiCopyReadiness = publicMenuUiCopyReadiness(
    {
      defaultLocale: args.menu.settings.defaultLocale,
      publicMenuStyle: args.menu.settings.publicMenuStyle
    },
    args.locale,
    args.menu.localizedUiCopy
  );
  if (!uiCopyReadiness.isReady) {
    return {
      locale: args.locale,
      status: uiCopyReadiness.dynamicSource === "none" ? "missing" : "stale",
      reason: uiCopyReadiness.missingKeys.length
        ? `missing UI copy (${uiCopyReadiness.missingKeys.join(", ")})`
        : "incomplete UI copy",
      entityType: "menu",
      field: "uiCopy"
    };
  }

  return { locale: args.locale, status: "up_to_date" };
}

export function publicMenuTranslationStatusesForRows(
  menu: PublicMenu,
  rows: PublicMenuTranslationRows
): PublicMenuTranslationStatus[] {
  const menuFields = publicMenuTranslationMenuFields(menu);
  const categoryFieldsById = new Map(
    publicMenuCategoryTranslationSources(menu).map((category) => [
      category.id,
      category.fields
    ])
  );
  const menuRowsByLocale = rowsByLocale(rows.menuRows);
  const categoryRowsByLocale = rowsByLocale(rows.categoryRows);
  const dishRowsByLocale = rowsByLocale(rows.dishRows);

  return menu.settings.supportedLocales.map((locale) => {
    if (locale === menu.settings.defaultLocale) {
      return { locale, status: "source" };
    }
    return statusForRows({
      locale,
      menu,
      menuRow: menuRowsByLocale.get(locale)?.[0],
      menuFields,
      categoryRowsById: rowsById(categoryRowsByLocale.get(locale) ?? [], "category_id"),
      categoryFieldsById,
      dishRowsById: rowsById(dishRowsByLocale.get(locale) ?? [], "dish_id"),
      dishes: menu.dishes
    });
  });
}

export function filterPublicMenuSettingsForReadyTranslations(
  settings: PublicMenuSettings,
  statuses: PublicMenuTranslationStatus[]
): PublicMenuSettings {
  const readyLocales = new Set(
    statuses
      .filter((item) => item.status === "source" || item.status === "up_to_date")
      .map((item) => item.locale)
  );
  const supportedLocales = settings.supportedLocales.filter((locale) =>
    readyLocales.has(locale)
  );

  return {
    ...settings,
    supportedLocales:
      supportedLocales.length > 0 ? supportedLocales : [settings.defaultLocale],
    defaultLocale: supportedLocales.includes(settings.defaultLocale)
      ? settings.defaultLocale
      : supportedLocales[0] ?? settings.defaultLocale
  };
}
