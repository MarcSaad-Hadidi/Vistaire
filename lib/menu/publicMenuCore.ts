export type PublicMenuDish = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  priceLabel: string;
  imageUrl: string;
  hasPhoto: boolean;
  hasImmersive: boolean;
  available: boolean;
  ingredients: string[];
  allergens: string[];
  options: string[];
  houseNote: string;
  tags: string[];
};

export type PublicMenu = {
  slug: string;
  name: string;
  location: string;
  cuisineType: string;
  source: "supabase" | "demo";
  dishes: PublicMenuDish[];
};

export type PublicMenuCategory = {
  id: string;
  label: string;
  description: string;
  tone: "blue" | "green" | "yellow" | "red";
  count: number;
};

export type PublicMenuRow = Record<string, unknown>;

const CATEGORY_DEFINITIONS = [
  {
    id: "entrees",
    label: "Entrées",
    description: "Pour commencer doucement",
    tone: "blue"
  },
  {
    id: "plats",
    label: "Plats",
    description: "Nos assiettes maison",
    tone: "green"
  },
  {
    id: "desserts",
    label: "Desserts",
    description: "Une touche sucrée",
    tone: "yellow"
  },
  {
    id: "boissons",
    label: "Boissons",
    description: "Frais et simple",
    tone: "red"
  }
] as const;

const DEFAULT_CATEGORY = {
  id: "carte",
  label: "Carte",
  description: "La sélection du moment",
  tone: "blue"
} as const;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getString(row: PublicMenuRow, candidates: string[], fallback = ""): string {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function getNumber(row: PublicMenuRow, candidates: string[], fallback = 0): number {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function getBoolean(row: PublicMenuRow, candidates: string[]): boolean | null {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "available") return true;
      if (
        normalized === "false" ||
        normalized === "unavailable" ||
        normalized === "archived" ||
        normalized === "paused"
      ) {
        return false;
      }
    }
  }
  return null;
}

function getStringList(row: PublicMenuRow, candidates: string[]): string[] {
  for (const key of candidates) {
    const value = row[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => String(item ?? "").trim())
            .filter(Boolean);
        }
      } catch {
        // Plain comma/semicolon/newline lists are accepted below.
      }
      return trimmed
        .split(/[,;\n]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function formatPrice(row: PublicMenuRow): string {
  const value = getNumber(row, ["price", "amount", "price_cad"], 0);
  if (!value) return "";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD"
  }).format(value);
}

function categoryDefinition(category: string) {
  const normalized = slugify(category);
  return (
    CATEGORY_DEFINITIONS.find((definition) => definition.id === normalized) ??
    null
  );
}

function normalizeCategory(category: string): string {
  const definition = categoryDefinition(category);
  return definition?.label ?? (category.trim() || DEFAULT_CATEGORY.label);
}

function isDishAvailable(row: PublicMenuRow): boolean {
  const available = getBoolean(row, [
    "available",
    "is_available",
    "isAvailable",
    "enabled",
    "active",
    "status"
  ]);
  return available !== false;
}

function dishSortOrder(row: PublicMenuRow, index: number): number {
  const sortOrder = getNumber(row, ["sort_order", "sortOrder", "position"], 0);
  return sortOrder > 0 ? sortOrder : 10_000 + index;
}

function rowMatchesValue(
  row: PublicMenuRow,
  candidates: string[],
  expected: string
): boolean {
  if (!expected) return false;
  return candidates.some((key) => String(row[key] ?? "") === expected);
}

function mapDishRow(row: PublicMenuRow, index: number): PublicMenuDish {
  const name = getString(row, ["name", "dish_name", "title"], "Plat");
  const imageUrl = getString(row, [
    "image",
    "image_url",
    "imageUrl",
    "photo_url",
    "photoUrl",
    "thumbnail_url"
  ]);
  const slug = slugify(
    getString(row, ["slug", "dish_slug", "dishSlug"], name)
  );

  return {
    id: getString(row, ["id", "dish_id", "slug", "dish_slug"], `dish-${index}`),
    slug: slug || `dish-${index}`,
    name,
    description: getString(row, ["description", "desc", "summary"], ""),
    category: normalizeCategory(
      getString(
        row,
        ["category_name", "categoryName", "category", "category_slug"],
        DEFAULT_CATEGORY.label
      )
    ),
    priceLabel: formatPrice(row),
    imageUrl,
    hasPhoto: Boolean(imageUrl),
    hasImmersive: Boolean(
      getString(row, [
        "model3d_url",
        "model3dUrl",
        "web_model_3d_url",
        "webModel3dUrl",
        "ar_model_3d_url",
        "arModel3dUrl",
        "usdz_url",
        "usdzUrl"
      ])
    ),
    available: isDishAvailable(row),
    ingredients: getStringList(row, ["ingredients", "ingredient_list"]),
    allergens: getStringList(row, ["allergens", "allergenes", "allergen_list"]),
    options: getStringList(row, ["options", "option_list"]),
    houseNote: getString(row, [
      "house_note",
      "houseNote",
      "chef_note",
      "chefNote",
      "note"
    ]),
    tags: getStringList(row, ["tags", "badges", "labels"])
  };
}

export function getPublicMenuRowSlug(row: PublicMenuRow): string {
  const name = getString(row, ["name", "restaurant_name"], "");
  return getString(row, ["slug", "restaurant_slug"], slugify(name));
}

export function buildSupabasePublicMenu(
  rawSlug: string,
  restaurantRow: PublicMenuRow,
  dishRows: PublicMenuRow[]
): PublicMenu {
  const slug = getPublicMenuRowSlug(restaurantRow) || slugify(rawSlug);
  const restaurantId = getString(restaurantRow, ["id", "restaurant_id"], "");
  const rowsById = restaurantId
    ? dishRows.filter((row) =>
        rowMatchesValue(
          row,
          ["restaurant_id", "restaurantId", "restaurant_uuid", "restaurant"],
          restaurantId
        )
      )
    : [];
  const scopedRows =
    restaurantId
      ? rowsById
      : dishRows.filter((row) =>
          rowMatchesValue(row, ["restaurant_slug", "restaurantSlug"], slug)
        );

  const dishes = scopedRows
    .filter(isDishAvailable)
    .map((row, index) => ({ row, index, order: dishSortOrder(row, index) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .slice(0, 200)
    .map(({ row, index }) => mapDishRow(row, index));

  return {
    slug,
    name: getString(restaurantRow, ["name", "restaurant_name"], "Restaurant"),
    location: getString(restaurantRow, ["location", "city", "address"], ""),
    cuisineType: getString(restaurantRow, ["cuisine_type", "cuisineType"], ""),
    source: "supabase",
    dishes
  };
}

export function getPublicMenuCategoryGroups(
  dishes: PublicMenuDish[]
): Map<string, PublicMenuDish[]> {
  const insertionGroups = new Map<string, PublicMenuDish[]>();
  for (const dish of dishes) {
    const category = normalizeCategory(dish.category || DEFAULT_CATEGORY.label);
    const list = insertionGroups.get(category) ?? [];
    list.push(dish);
    insertionGroups.set(category, list);
  }

  const orderedGroups = new Map<string, PublicMenuDish[]>();
  for (const definition of CATEGORY_DEFINITIONS) {
    const dishesForCategory = insertionGroups.get(definition.label);
    if (dishesForCategory?.length) {
      orderedGroups.set(definition.label, dishesForCategory);
    }
  }
  for (const [category, dishesForCategory] of insertionGroups) {
    if (!orderedGroups.has(category) && dishesForCategory.length) {
      orderedGroups.set(category, dishesForCategory);
    }
  }
  return orderedGroups;
}

export function getVisiblePublicMenuCategories(
  dishes: PublicMenuDish[]
): PublicMenuCategory[] {
  const groups = getPublicMenuCategoryGroups(dishes);
  return Array.from(groups.entries()).map(([label, categoryDishes]) => {
    const definition = categoryDefinition(label) ?? DEFAULT_CATEGORY;
    return {
      id: definition.id,
      label,
      description: definition.description,
      tone: definition.tone,
      count: categoryDishes.length
    };
  });
}

export function getPublicMenuDishBySlug(
  menu: PublicMenu,
  rawDishSlug: string
): PublicMenuDish | null {
  const dishSlug = slugify(rawDishSlug);
  if (!dishSlug) return null;

  return (
    menu.dishes.find(
      (dish) =>
        slugify(dish.slug) === dishSlug ||
        slugify(dish.name) === dishSlug ||
        slugify(dish.id) === dishSlug
    ) ?? null
  );
}

export function isFreshHomemadeMenu(menu: PublicMenu): boolean {
  return menu.slug === "resto-marc" || slugify(menu.name) === "resto-marc";
}
