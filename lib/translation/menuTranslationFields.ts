import { capitalizeListItems } from "../menu/listText.ts";
import {
  stringInput,
  stringListInput,
  type MenuTranslationFields
} from "./menuTranslationModel.ts";

function textInput(value: unknown): string {
  return stringInput(value);
}

export type DishTranslationFieldInput = {
  description?: unknown;
  ingredients?: unknown;
  allergens?: unknown;
  options?: unknown;
  houseNote?: unknown;
  tags?: unknown;
  isSignature?: unknown;
  isRecommended?: unknown;
};

function booleanInput(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "available";
}

function normalizedTagKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function stableStringList(value: unknown, capitalize = false): string[] {
  const values = stringListInput(value);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of values) {
    const cleaned = (capitalize ? capitalizeListItems([item])[0] : item).trim();
    const key = normalizedTagKey(cleaned);
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

/**
 * Canonical source fields shared by owner generation, public readiness, and
 * the translation backfill. Dish names are identity and deliberately absent.
 */
export function canonicalDishTranslationFields(
  input: DishTranslationFieldInput
): MenuTranslationFields {
  const fields: MenuTranslationFields = {};
  const description = textInput(input.description);
  const ingredients = stableStringList(input.ingredients, true);
  const allergens = stableStringList(input.allergens);
  const options = stableStringList(input.options, true);
  const houseNote = textInput(input.houseNote);
  const isSignature = booleanInput(input.isSignature);
  const isRecommended = booleanInput(input.isRecommended);
  const derived = new Set<string>();
  if (isSignature) derived.add("signature");
  if (isRecommended) {
    derived.add("recommande");
    derived.add("recommended");
  }
  const tags = stableStringList(input.tags).filter(
    (tag) => !derived.has(normalizedTagKey(tag))
  );

  if (description) fields.description = description;
  if (ingredients.length > 0) fields.ingredients = ingredients;
  if (allergens.length > 0) fields.allergens = allergens;
  if (options.length > 0) fields.options = options;
  if (houseNote) fields.houseNote = houseNote;
  if (tags.length > 0) fields.tags = tags;
  return fields;
}

export function canonicalDishDerivedTags(input: Pick<
  DishTranslationFieldInput,
  "isSignature" | "isRecommended"
>): string[] {
  return [
    ...(booleanInput(input.isSignature) ? ["Signature"] : []),
    ...(booleanInput(input.isRecommended) ? ["Recommande"] : [])
  ];
}

export function menuTranslationFieldsFromNames(args: {
  restaurantName?: unknown;
  menuName?: unknown;
}): MenuTranslationFields {
  const fields: MenuTranslationFields = {};
  const menuName = textInput(args.menuName);

  // Restaurant names are brand/source identity and must never be translated.
  if (menuName) fields.menuName = menuName;

  return fields;
}
