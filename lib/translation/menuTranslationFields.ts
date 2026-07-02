import type { MenuTranslationFields } from "./menuTranslationModel";

function textInput(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function menuTranslationFieldsFromNames(args: {
  restaurantName?: unknown;
  menuName?: unknown;
}): MenuTranslationFields {
  const fields: MenuTranslationFields = {};
  const restaurantName = textInput(args.restaurantName);
  const menuName = textInput(args.menuName);

  if (restaurantName) fields.restaurantName = restaurantName;
  if (menuName) fields.menuName = menuName;

  return fields;
}
