"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useRef, useState } from "react";
import { GoogleReviewCard } from "@/components/menu/GoogleReviewCard";
import {
  buildPublicDishPath,
  getPublicMenuCategoryGroups,
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuCategory,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import styles from "./MaisonElyseQrMenu.module.css";

type MaisonElyseQrMenuProps = {
  menu: PublicMenu;
  context?: string;
  query?: PublicMenuContextQuery;
};

type FilterId =
  | "all"
  | "recommended"
  | "signature"
  | "immersive"
  | "available"
  | "gluten-free"
  | "dairy-free"
  | "nut-free"
  | "shellfish-free"
  | "egg-free"
  | "sesame-free"
  | "soy-free"
  | "fish-free";

type DietaryFilterId = Extract<
  FilterId,
  | "gluten-free"
  | "dairy-free"
  | "nut-free"
  | "shellfish-free"
  | "egg-free"
  | "sesame-free"
  | "soy-free"
  | "fish-free"
>;

const ALL_CATEGORY_ID = "all";
const ENTRY_PREVIEW_EXCLUDED_DISH_SLUGS = new Set(["homard-bisque"]);
const QUICK_FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "recommended", label: "Recommandés" },
  { id: "immersive", label: "3D / AR" },
  { id: "available", label: "Disponibles" }
];

const PREFERENCE_FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "signature", label: "Signature" },
  { id: "recommended", label: "Recommandés" },
  { id: "immersive", label: "3D / AR" },
  { id: "available", label: "Disponibles uniquement" },
  { id: "gluten-free", label: "Sans gluten" },
  { id: "dairy-free", label: "Sans lactose" },
  { id: "nut-free", label: "Sans fruits à coque" },
  { id: "shellfish-free", label: "Sans crustacés" },
  { id: "egg-free", label: "Sans œufs" },
  { id: "sesame-free", label: "Sans sésame" },
  { id: "soy-free", label: "Sans soja" },
  { id: "fish-free", label: "Sans poisson" }
];

const CATEGORY_ORDER = new Map([
  ["Entrées", 0],
  ["Plats", 1],
  ["Signatures", 1],
  ["Plats signatures", 1],
  ["Desserts", 2],
  ["Cocktails", 3],
  ["Boissons", 4]
]);

const ALLERGEN_FILTER_TERMS: Record<DietaryFilterId, string[]> = {
  "gluten-free": ["gluten", "wheat", "ble"],
  "dairy-free": [
    "dairy",
    "lait",
    "lactose",
    "milk",
    "cream",
    "creme",
    "cheese",
    "fromage",
    "beurre",
    "butter"
  ],
  "nut-free": ["nut", "nuts", "noix", "amande", "amandes", "noisette", "pistache"],
  "shellfish-free": ["shellfish", "crustace", "crustaces", "homard", "crevette", "crabe"],
  "egg-free": ["egg", "eggs", "oeuf", "oeufs"],
  "sesame-free": ["sesame"],
  "soy-free": ["soy", "soja"],
  "fish-free": ["fish", "poisson", "thon", "saumon", "bar", "cabillaud"]
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function displayCategoryLabel(label: string): string {
  return normalizeText(label).includes("signature") ? "Plats signatures" : label;
}

function categorySort(a: PublicMenuCategory, b: PublicMenuCategory): number {
  const aLabel = displayCategoryLabel(a.label);
  const bLabel = displayCategoryLabel(b.label);
  return (CATEGORY_ORDER.get(aLabel) ?? 99) - (CATEGORY_ORDER.get(bLabel) ?? 99);
}

function hasReal3d(dish: PublicMenuDish): boolean {
  return Boolean(dish.webModel3dUrl || dish.model3dUrl || dish.arModel3dUrl);
}

function hasRealAr(dish: PublicMenuDish): boolean {
  return Boolean(dish.arModel3dUrl || dish.arUsdzUrl || dish.usdzUrl);
}

function isSignatureDish(dish: PublicMenuDish): boolean {
  return (
    normalizeText(dish.category).includes("signature") ||
    dish.tags.some((tag) => normalizeText(tag).includes("signature"))
  );
}

function isRecommendedDish(dish: PublicMenuDish): boolean {
  return dish.tags.some((tag) => {
    const normalized = normalizeText(tag);
    return normalized.includes("recommande") || normalized.includes("recommended");
  });
}

function canAppearInEntryPreview(dish: PublicMenuDish): boolean {
  return !ENTRY_PREVIEW_EXCLUDED_DISH_SLUGS.has(dish.slug);
}

function isDietaryFilter(filter: FilterId): filter is DietaryFilterId {
  return filter.endsWith("-free");
}

function dishMatchesFilter(dish: PublicMenuDish, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "recommended") return isRecommendedDish(dish);
  if (filter === "signature") return isSignatureDish(dish);
  if (filter === "immersive") return hasReal3d(dish) || hasRealAr(dish);
  if (filter === "available") return dish.available;
  if (isDietaryFilter(filter)) {
    const allergenTokens = new Set(dish.allergens.flatMap(tokenize));
    return !ALLERGEN_FILTER_TERMS[filter].some((term) =>
      allergenTokens.has(normalizeText(term))
    );
  }
  return true;
}

function shortDescription(dish: PublicMenuDish): string {
  if (!dish.description) return "";
  if (dish.description.length <= 132) return dish.description;
  return `${dish.description.slice(0, 129).trim()}...`;
}

function dishBadges(dish: PublicMenuDish): string[] {
  const badges: string[] = [];
  if (isSignatureDish(dish)) badges.push("Signature");
  if (isRecommendedDish(dish)) badges.push("Recommandé");
  if (hasReal3d(dish)) badges.push("3D");
  if (hasRealAr(dish)) badges.push("AR");
  if (!dish.available) badges.push("Indisponible");
  return badges.slice(0, 4);
}

function formatDishCount(count: number): string {
  return `${count} ${count > 1 ? "plats disponibles" : "plat disponible"}`;
}

function CategoryCard({
  category,
  imageUrl,
  onSelect
}: {
  category: PublicMenuCategory;
  imageUrl: string;
  onSelect: () => void;
}) {
  const label = displayCategoryLabel(category.label);

  return (
    <button
      className={styles.categoryCard}
      onClick={onSelect}
      style={
        imageUrl
          ? ({ "--category-image": `url("${imageUrl}")` } as CSSProperties)
          : undefined
      }
      type="button"
    >
      <span className={styles.categoryCount}>{formatDishCount(category.count)}</span>
      <strong>{label}</strong>
      <small>{category.description}</small>
    </button>
  );
}

function DishCard({
  dish,
  menu,
  query
}: {
  dish: PublicMenuDish;
  menu: PublicMenu;
  query?: PublicMenuContextQuery;
}) {
  const badges = dishBadges(dish);
  const href = buildPublicDishPath(menu.slug, dish.slug, query);

  return (
    <li className={styles.dishItem}>
      <Link
        aria-label={`${dish.name}. ${dish.priceLabel || ""} Voir la fiche plat.`}
        className={styles.dishCard}
        href={href}
        prefetch={false}
      >
        <span className={styles.dishImage} aria-hidden="true">
          {dish.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" src={dish.thumbnailUrl || dish.imageUrl} alt="" />
          ) : (
            <span>{menu.name.slice(0, 1)}</span>
          )}
        </span>
        <span className={styles.dishCopy}>
          <span className={styles.dishTopline}>
            <span className={styles.dishName}>{dish.name}</span>
            {dish.priceLabel ? <strong>{dish.priceLabel}</strong> : null}
          </span>
          {dish.description ? (
            <span className={styles.dishDescription}>{shortDescription(dish)}</span>
          ) : null}
          {badges.length > 0 ? (
            <span className={styles.badges} aria-label={`Badges: ${badges.join(", ")}`}>
              {badges.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

function DishSection({
  dishes,
  menu,
  query,
  title
}: {
  dishes: PublicMenuDish[];
  menu: PublicMenu;
  query?: PublicMenuContextQuery;
  title: string;
}) {
  const sectionId = `section-${normalizeText(title)}`;

  return (
    <section className={styles.dishSection} aria-labelledby={sectionId}>
      <div className={styles.dishSectionHeader}>
        <h3 id={sectionId}>{displayCategoryLabel(title)}</h3>
        <span>{formatDishCount(dishes.length)}</span>
      </div>
      <ul className={styles.dishList}>
        {dishes.map((dish) => (
          <DishCard dish={dish} key={dish.id} menu={menu} query={query} />
        ))}
      </ul>
    </section>
  );
}

export function MaisonElyseQrMenu({
  menu,
  context = "",
  query
}: MaisonElyseQrMenuProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [showDetailFilters, setShowDetailFilters] = useState(false);
  const menuRef = useRef<HTMLElement | null>(null);
  const groups = useMemo(() => getPublicMenuCategoryGroups(menu.dishes), [menu.dishes]);
  const categories = useMemo(
    () => getVisiblePublicMenuCategories(menu.dishes).sort(categorySort),
    [menu.dishes]
  );
  const featuredDishes = useMemo(
    () =>
      menu.dishes
        .filter(canAppearInEntryPreview)
        .filter((dish) => isSignatureDish(dish) || isRecommendedDish(dish))
        .slice(0, 3),
    [menu.dishes]
  );
  const baseDishes = useMemo(() => {
    if (!activeCategory) return [];
    if (activeCategory === ALL_CATEGORY_ID) return menu.dishes;
    return groups.get(activeCategory) ?? [];
  }, [activeCategory, groups, menu.dishes]);
  const visibleDishes = useMemo(
    () => baseDishes.filter((dish) => dishMatchesFilter(dish, activeFilter)),
    [activeFilter, baseDishes]
  );
  const visibleDishSections = useMemo(() => {
    if (activeCategory !== ALL_CATEGORY_ID) return [];

    return categories
      .map((category) => {
        const dishes = (groups.get(category.label) ?? []).filter((dish) =>
          dishMatchesFilter(dish, activeFilter)
        );

        return {
          id: category.id,
          label: category.label,
          dishes
        };
      })
      .filter((section) => section.dishes.length > 0);
  }, [activeCategory, activeFilter, categories, groups]);
  const activeCategoryLabel =
    activeCategory === ALL_CATEGORY_ID
      ? "Toute la carte"
      : activeCategory
        ? displayCategoryLabel(activeCategory)
        : "Sections";
  const hasActiveFilter = activeFilter !== "all";
  const hasPreferenceFilterActive = PREFERENCE_FILTERS.some(
    (filter) => filter.id !== "all" && filter.id === activeFilter
  );
  const shouldShowPreferenceFilters =
    showDetailFilters || hasPreferenceFilterActive;
  const currentDishCount = visibleDishes.length;

  function scrollToMenu() {
    requestAnimationFrame(() => {
      menuRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start"
      });
    });
  }

  function selectCategory(categoryId: string | null) {
    setActiveCategory(categoryId);
    setActiveFilter("all");
    setShowDetailFilters(false);
    scrollToMenu();
  }

  function showAll() {
    selectCategory(ALL_CATEGORY_ID);
  }

  function resetFilters() {
    setActiveFilter("all");
  }

  function toggleQuickFilter(filterId: FilterId) {
    setActiveFilter((currentFilter) =>
      currentFilter === filterId ? "all" : filterId
    );
  }

  const categoryImages = new Map(
    categories.map((category) => {
      const categoryDishes = groups.get(category.label) ?? [];
      const previewDish =
        categoryDishes.find(
          (dish) => canAppearInEntryPreview(dish) && dish.imageUrl
        ) ?? categoryDishes.find((dish) => dish.imageUrl);

      return [
        category.label,
        previewDish?.thumbnailUrl || previewDish?.imageUrl || ""
      ];
    })
  );

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="maison-elyse-heading">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Carte à table</p>
          <h1 id="maison-elyse-heading">Bienvenue chez Maison Élyse</h1>
          <p>
            Découvrez les entrées, plats signatures, desserts et cocktails de la
            maison, pensés pour être explorés directement à table.
          </p>
          {context ? <span className={styles.context}>{context}</span> : null}
        </div>
      </section>

      <section className={styles.sections} ref={menuRef} aria-label="Sections de la carte">
        {!activeCategory ? (
          <>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>Choisir une section</p>
                <h2>La carte Maison Élyse</h2>
              </div>
            </div>

            <div className={styles.categoryGrid}>
              {categories.map((category) => (
                <CategoryCard
                  category={category}
                  imageUrl={categoryImages.get(category.label) ?? ""}
                  key={category.id}
                  onSelect={() => selectCategory(category.label)}
                />
              ))}
            </div>

            {featuredDishes.length > 0 ? (
              <section className={styles.featured} aria-labelledby="featured-heading">
                <div className={styles.featuredHeader}>
                  <div>
                    <p className={styles.kicker}>Suggestion du chef</p>
                    <h2 id="featured-heading">À découvrir ce soir</h2>
                  </div>
                  <button type="button" onClick={showAll}>
                    Voir toute la carte
                  </button>
                </div>
                <ul className={styles.previewList}>
                  {featuredDishes.map((dish) => (
                    <DishCard dish={dish} key={dish.id} menu={menu} query={query} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <section className={styles.menuPanel} aria-labelledby="active-category-heading">
            <div className={styles.menuCompactHeader}>
              <button type="button" onClick={() => selectCategory(null)}>
                ← Sections
              </button>
              <div>
                <p className={styles.kicker}>Carte</p>
                <h2 id="active-category-heading">{activeCategoryLabel}</h2>
              </div>
              <span aria-live="polite">{formatDishCount(currentDishCount)}</span>
            </div>

            <div
              className={styles.categoryPills}
              role="group"
              aria-label="Navigation des sections"
            >
              <button
                aria-pressed={activeCategory === ALL_CATEGORY_ID}
                className={activeCategory === ALL_CATEGORY_ID ? styles.isActive : undefined}
                type="button"
                onClick={showAll}
              >
                Toutes
              </button>
              {categories.map((category) => (
                <button
                  aria-pressed={activeCategory === category.label}
                  className={
                    activeCategory === category.label ? styles.isActive : undefined
                  }
                  key={category.id}
                  type="button"
                  onClick={() => selectCategory(category.label)}
                >
                  {displayCategoryLabel(category.label)}
                </button>
              ))}
            </div>

            <div
              className={styles.filterShell}
              aria-label="Filtres de la carte"
            >
              <div className={styles.quickFilterBar}>
                <span>Affiner</span>
                <div className={styles.filters} role="group" aria-label="Filtres rapides">
                  {QUICK_FILTERS.map((filter) => (
                    <button
                      aria-pressed={activeFilter === filter.id}
                      className={activeFilter === filter.id ? styles.isActive : undefined}
                      key={filter.id}
                      onClick={() => toggleQuickFilter(filter.id)}
                      type="button"
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <button
                  aria-expanded={shouldShowPreferenceFilters}
                  className={`${styles.moreFiltersButton} ${
                    hasPreferenceFilterActive ? styles.isActive : ""
                  }`}
                  onClick={() => setShowDetailFilters((isVisible) => !isVisible)}
                  type="button"
                >
                  Préférences
                </button>
              </div>

              {shouldShowPreferenceFilters ? (
                <div className={styles.preferencePanel}>
                  <div className={styles.preferenceHeader}>
                    <div>
                      <p className={styles.kicker}>Filtres alimentaires</p>
                      <h3>Préférences</h3>
                    </div>
                    {hasActiveFilter ? (
                      <button type="button" onClick={resetFilters}>
                        Réinitialiser
                      </button>
                    ) : null}
                  </div>
                  <div
                    className={styles.detailFilters}
                    role="group"
                    aria-label="Filtres alimentaires"
                  >
                    {PREFERENCE_FILTERS.map((filter) => (
                      <button
                        aria-pressed={activeFilter === filter.id}
                        className={activeFilter === filter.id ? styles.isActive : undefined}
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id)}
                        type="button"
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  <button
                    className={styles.applyFiltersButton}
                    onClick={() => setShowDetailFilters(false)}
                    type="button"
                  >
                    Appliquer
                  </button>
                </div>
              ) : null}
            </div>

            {hasActiveFilter ? (
              <button
                className={styles.resetButton}
                type="button"
                onClick={resetFilters}
              >
                Réinitialiser
              </button>
            ) : null}

            {visibleDishes.length > 0 ? (
              activeCategory === ALL_CATEGORY_ID ? (
                <div className={styles.sectionedDishList}>
                  {visibleDishSections.map((section) => (
                    <DishSection
                      dishes={section.dishes}
                      key={section.id}
                      menu={menu}
                      query={query}
                      title={section.label}
                    />
                  ))}
                </div>
              ) : (
                <ul className={styles.dishList}>
                  {visibleDishes.map((dish) => (
                    <DishCard dish={dish} key={dish.id} menu={menu} query={query} />
                  ))}
                </ul>
              )
            ) : (
              <div className={styles.empty} role="status">
                <p>Aucun plat dans cette sélection</p>
                <button type="button" onClick={showAll}>
                  Voir toute la carte
                </button>
              </div>
            )}
          </section>
        )}
      </section>

      <GoogleReviewCard
        googleReview={menu.googleReview}
        restaurantId={menu.restaurantId}
        restaurantName={menu.name}
        source={menu.source}
      />
    </main>
  );
}
