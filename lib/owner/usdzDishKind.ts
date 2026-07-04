export type UsdzDishKind =
  | "burger"
  | "pizza"
  | "plate"
  | "bowl"
  | "dessert"
  | "drink"
  | "platter"
  | "fallback";

export type UsdzDishKindPreset = "auto" | UsdzDishKind;

export const USDZ_DISH_KIND_OPTIONS: Array<{
  value: UsdzDishKindPreset;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "burger", label: "Burger / Sandwich" },
  { value: "pizza", label: "Pizza" },
  { value: "plate", label: "Assiette / Plat principal" },
  { value: "bowl", label: "Bol / Soupe" },
  { value: "dessert", label: "Dessert" },
  { value: "drink", label: "Boisson / Verre" },
  { value: "platter", label: "Plateau / Sharing" },
  { value: "fallback", label: "Fallback / Generique" }
];

type DishKindRule = {
  kind: UsdzDishKind;
  pattern: RegExp;
  rawPattern?: RegExp;
};

const CATEGORY_RULES: DishKindRule[] = [
  { kind: "platter", pattern: /\b(plateau|planche|sharing|share|sushi|mezze|tapas|charcuterie|assortiment)\b/ },
  { kind: "pizza", pattern: /\b(pizza|pizzas|pizzetta|flatbread|focaccia)\b/ },
  { kind: "bowl", pattern: /\b(bol|bowl|bowls|soupe|soupes|soup|ramen|poke|salade|salad|poutine)\b/ },
  { kind: "dessert", pattern: /\b(dessert|desserts|gateau|cake|cheesecake|tarte|mousse|creme|glace|ice cream)\b/ },
  {
    kind: "drink",
    pattern: /\b(drink|drinks|boisson|boissons|cocktail|cocktails|verre|vin|wine|cafe|tea|jus|juice|latte)\b/,
    rawPattern: /(?:^|[^a-zA-Z\u00c0-\u024f])th\u00e9(?:$|[^a-zA-Z\u00c0-\u024f])/u
  },
  { kind: "burger", pattern: /\b(burger|burgers|sandwich|sandwiches|smash|panini|taco|wrap)\b/ },
  { kind: "plate", pattern: /\b(plate|plates|assiette|plat|plats|main|mains|principal|entree|steak|poisson|fish|poulet|chicken|pasta|pates|risotto|ravioli|lasagne|ribs|grill|grille)\b/ }
];

const NAME_RULES = CATEGORY_RULES;

function normalizeDishText(value: string | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function rawDishText(value: string | undefined): string {
  return (value || "").toLowerCase();
}

function matchDishKind(value: string | undefined, rules: DishKindRule[]): UsdzDishKind | null {
  const raw = rawDishText(value);
  const normalized = normalizeDishText(value);
  if (!raw && !normalized) return null;
  return (
    rules.find((rule) => rule.rawPattern?.test(raw))?.kind ??
    rules.find((rule) => rule.pattern.test(normalized))?.kind ??
    null
  );
}

export function inferUsdzDishKind({
  dishName,
  category
}: {
  dishName?: string;
  category?: string;
}): UsdzDishKind {
  return (
    matchDishKind(category, CATEGORY_RULES) ??
    matchDishKind(dishName, NAME_RULES) ??
    "fallback"
  );
}

export function resolveUsdzDishKindPreset({
  selectedPreset,
  dishName,
  category
}: {
  selectedPreset?: UsdzDishKindPreset;
  dishName?: string;
  category?: string;
}): UsdzDishKind {
  if (selectedPreset && selectedPreset !== "auto") return selectedPreset;
  return inferUsdzDishKind({ dishName, category });
}
