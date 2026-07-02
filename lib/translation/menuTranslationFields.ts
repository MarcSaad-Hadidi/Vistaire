import type { MenuTranslationFields } from "./menuTranslationModel";

function textInput(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
