"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleReviewCard } from "@/components/menu/GoogleReviewCard";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
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

const ALLOWED_3D_CDN_ORIGINS = (process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "")
  .split(/[,\s]+/)
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

type MaisonElyseQrMenuProps = {
  menu: PublicMenu;
  context?: string;
  query?: PublicMenuContextQuery;
  displayMode?: "public" | "phone-preview";
  showGoogleReview?: boolean;
  startFullMenu?: boolean;
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

type SheetId = "menu" | "filter" | null;

const ALL_CATEGORY_ID = "all";
const ENTRY_PREVIEW_EXCLUDED_DISH_SLUGS = new Set(["homard-bisque"]);
const FILTER_OPTIONS: Array<{ id: FilterId; label: string }> = [
  { id: "signature", label: "Signature" },
  { id: "recommended", label: "Recommandés" },
  { id: "immersive", label: "3D / AR" },
  { id: "available", label: "Disponibles" },
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

function categoryAnchorId(label: string): string {
  return tokenize(displayCategoryLabel(label)).join("-");
}

function sectionDomId(label: string): string {
  return `section-${categoryAnchorId(label)}`;
}

function categoryEditorial(label: string): {
  kicker: string;
  title: string;
  description: string;
} {
  const displayLabel = displayCategoryLabel(label);
  const normalized = normalizeText(displayLabel);

  if (normalized.includes("entree")) {
    return {
      kicker: "POUR COMMENCER",
      title: "Entrées",
      description: "Les premières assiettes de la maison, précises et généreuses."
    };
  }

  if (normalized.includes("signature") || normalized.includes("plat")) {
    return {
      kicker: "LA SIGNATURE",
      title: "Plats signatures",
      description: "Les créations emblématiques de Maison Élyse."
    };
  }

  if (normalized.includes("dessert")) {
    return {
      kicker: "LA DOUCEUR",
      title: "Desserts",
      description: "Une dernière note pâtissière, fraîche et élégante."
    };
  }

  if (normalized.includes("cocktail") || normalized.includes("boisson")) {
    return {
      kicker: "LE BAR",
      title: displayLabel,
      description: "Cocktails et boissons pensés pour accompagner la carte."
    };
  }

  return {
    kicker: "Maison Élyse",
    title: displayLabel,
    description: "La sélection du moment."
  };
}

function getFilterLabel(filter: FilterId): string {
  if (filter === "all") return "Toute la carte";
  return FILTER_OPTIONS.find((option) => option.id === filter)?.label ?? "Filtre";
}

function getScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function categorySort(a: PublicMenuCategory, b: PublicMenuCategory): number {
  const aLabel = displayCategoryLabel(a.label);
  const bLabel = displayCategoryLabel(b.label);
  return (CATEGORY_ORDER.get(aLabel) ?? 99) - (CATEGORY_ORDER.get(bLabel) ?? 99);
}

function hasReal3d(dish: PublicMenuDish): boolean {
  return (
    isSafe3dAssetUrl(
      dish.webModel3dUrl || dish.model3dUrl,
      ALLOWED_3D_CDN_ORIGINS,
      "web"
    ) ||
    isSafe3dAssetUrl(dish.arModel3dUrl, ALLOWED_3D_CDN_ORIGINS, "arLite")
  );
}

function hasRealAr(dish: PublicMenuDish): boolean {
  return (
    isSafe3dAssetUrl(dish.arModel3dUrl, ALLOWED_3D_CDN_ORIGINS, "arLite") ||
    isSafe3dAssetUrl(
      dish.arUsdzUrl || dish.usdzUrl,
      ALLOWED_3D_CDN_ORIGINS,
      "iosUsdz"
    )
  );
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
      data-testid={`maison-section-${categoryAnchorId(category.label)}`}
      onClick={onSelect}
      style={
        imageUrl
          ? ({ "--category-image": `url("${imageUrl}")` } as CSSProperties)
          : undefined
      }
      type="button"
    >
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
          <span className={styles.dishName}>{dish.name}</span>
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
          {dish.priceLabel ? (
            <strong className={styles.dishPrice}>{dish.priceLabel}</strong>
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
  const sectionId = sectionDomId(title);
  const headingId = `${sectionId}-heading`;
  const editorial = categoryEditorial(title);

  return (
    <section
      className={styles.dishSection}
      id={sectionId}
      aria-labelledby={headingId}
    >
      <div className={styles.dishSectionHeader}>
        <div>
          <p className={styles.kicker}>{editorial.kicker}</p>
          <h3 id={headingId}>{editorial.title}</h3>
          <p>{editorial.description}</p>
        </div>
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
  displayMode = "public",
  menu,
  query,
  showGoogleReview = true,
  startFullMenu = false
}: MaisonElyseQrMenuProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(() =>
    startFullMenu ? ALL_CATEGORY_ID : null
  );
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [activeSheet, setActiveSheet] = useState<SheetId>(null);
  const [pendingSectionLabel, setPendingSectionLabel] = useState<string | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  const menuScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const skipNextPhonePreviewAutoScrollRef = useRef(false);
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
  const menuHeroImage = useMemo(() => {
    const coverDish =
      menu.dishes.find((dish) => canAppearInEntryPreview(dish) && dish.imageUrl) ??
      menu.dishes.find((dish) => dish.imageUrl);

    return coverDish?.imageUrl || coverDish?.thumbnailUrl || "";
  }, [menu.dishes]);
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

  useEffect(() => {
    if (activeCategory !== ALL_CATEGORY_ID || !pendingSectionLabel) return;

    const frameId = window.requestAnimationFrame(() => {
      const sectionId = sectionDomId(pendingSectionLabel);
      const section = document.getElementById(sectionId);
      const scrollArea = menuScrollAreaRef.current;

      if (displayMode === "phone-preview" && section && scrollArea?.contains(section)) {
        const scrollAreaRect = scrollArea.getBoundingClientRect();
        const sectionRect = section.getBoundingClientRect();
        scrollArea.scrollTo({
          behavior: getScrollBehavior(),
          top: Math.max(
            0,
            sectionRect.top - scrollAreaRect.top + scrollArea.scrollTop
          )
        });
      } else {
        section?.scrollIntoView({
          behavior: getScrollBehavior(),
          block: "start"
        });
      }
      setPendingSectionLabel(null);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeCategory, displayMode, pendingSectionLabel]);

  useEffect(() => {
    if (displayMode !== "phone-preview" || !activeCategory || pendingSectionLabel) {
      return;
    }

    if (skipNextPhonePreviewAutoScrollRef.current) {
      skipNextPhonePreviewAutoScrollRef.current = false;
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const scrollArea = menuScrollAreaRef.current;
      if (!scrollArea) return;

      scrollArea.scrollTop = 0;

      const firstDish = scrollArea.querySelector<HTMLElement>('a[href*="/dishes/"]');
      if (!firstDish) return;

      const scrollAreaRect = scrollArea.getBoundingClientRect();
      const firstDishRect = firstDish.getBoundingClientRect();
      const firstDishOverflow = firstDishRect.bottom - scrollAreaRect.bottom;
      if (firstDishOverflow <= 0) return;

      const collectionLabel = Array.from(scrollArea.querySelectorAll<HTMLElement>("p")).find(
        (element) => element.textContent?.trim() === "LA COLLECTION"
      );
      const maxScrollKeepingCollection = collectionLabel
        ? Math.max(0, collectionLabel.getBoundingClientRect().top - scrollAreaRect.top)
        : Number.POSITIVE_INFINITY;

      scrollArea.scrollTop = Math.min(Math.ceil(firstDishOverflow + 2), maxScrollKeepingCollection);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeCategory, displayMode, pendingSectionLabel, visibleDishes.length]);

  function scrollToMenu() {
    requestAnimationFrame(() => {
      menuRef.current?.scrollIntoView({
        behavior: getScrollBehavior(),
        block: "start"
      });
    });
  }

  function selectCategory(categoryId: string | null) {
    skipNextPhonePreviewAutoScrollRef.current = false;
    setActiveCategory(categoryId);
    setActiveFilter("all");
    setActiveSheet(null);
    setPendingSectionLabel(null);
    scrollToMenu();
  }

  function openCategoryInFullMenu(categoryLabel: string) {
    skipNextPhonePreviewAutoScrollRef.current = displayMode === "phone-preview";
    setPendingSectionLabel(categoryLabel);
    setActiveCategory(ALL_CATEGORY_ID);
    setActiveFilter("all");
    setActiveSheet(null);
  }

  function showAll() {
    selectCategory(ALL_CATEGORY_ID);
  }

  function resetFilters() {
    setActiveFilter("all");
  }

  function toggleFilter(filterId: FilterId) {
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
    <main
      className={`${styles.page} ${activeCategory ? styles.isMenuMode : ""} ${
        displayMode === "phone-preview" ? styles.phonePreview : ""
      }`}
      data-display-mode={displayMode}
    >
      {!activeCategory ? (
        <section className={styles.hero} aria-labelledby="maison-elyse-heading">
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Carte à table</p>
            <h1 id="maison-elyse-heading">Bienvenue chez Maison Élyse</h1>
            <p>
              Découvrez les entrées, plats signatures, desserts et cocktails de la
              maison, pensés pour être explorés directement à table.
            </p>
          </div>
        </section>
      ) : null}

      <section className={styles.sections} ref={menuRef} aria-label="Sections de la carte">
        {!activeCategory ? (
          <>
            <div className={styles.categoryGrid}>
              {categories.map((category) => (
                <CategoryCard
                  category={category}
                  imageUrl={categoryImages.get(category.label) ?? ""}
                  key={category.id}
                  onSelect={() => openCategoryInFullMenu(category.label)}
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
            <div className={styles.menuScrollArea} ref={menuScrollAreaRef}>
              <div
                className={styles.menuCover}
                style={
                  menuHeroImage
                    ? ({ "--menu-hero-image": `url("${menuHeroImage}")` } as CSSProperties)
                    : undefined
                }
              >
                <div className={styles.menuCoverTopbar}>
                  <span className={styles.menuRestaurantName}>Maison Élyse</span>
                  <button
                    aria-label="Ouvrir la navigation de la carte"
                    type="button"
                    onClick={() => setActiveSheet("menu")}
                  >
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.menuCoverCopy}>
                  <p className={styles.kicker}>LA COLLECTION</p>
                  <h2 id="active-category-heading">LA CARTE</h2>
                  <span aria-hidden="true" />
                  <p>
                    Une sélection de créations servies par section, pensées pour être
                    explorées directement à table.
                  </p>
                </div>
              </div>

              {hasActiveFilter ? (
                <div className={styles.activeFilterNotice} role="status">
                  <span>Filtre actif : {getFilterLabel(activeFilter)}</span>
                  <button type="button" onClick={resetFilters}>
                    Réinitialiser
                  </button>
                </div>
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
                  <DishSection
                    dishes={visibleDishes}
                    menu={menu}
                    query={query}
                    title={activeCategoryLabel}
                  />
                )
              ) : (
                <div className={styles.empty} role="status">
                  <p>Aucun plat dans cette sélection</p>
                  <button type="button" onClick={showAll}>
                    Voir toute la carte
                  </button>
                </div>
              )}
            </div>

            <nav className={styles.bottomBar} aria-label="Navigation carte et filtres">
              <button
                aria-expanded={activeSheet === "menu"}
                type="button"
                onClick={() =>
                  setActiveSheet((currentSheet) =>
                    currentSheet === "menu" ? null : "menu"
                  )
                }
              >
                La carte
              </button>
              <button
                aria-expanded={activeSheet === "filter"}
                type="button"
                onClick={() =>
                  setActiveSheet((currentSheet) =>
                    currentSheet === "filter" ? null : "filter"
                  )
                }
              >
                Filtrer
              </button>
            </nav>

            {activeSheet ? (
              <div
                className={styles.sheetBackdrop}
                onClick={() => setActiveSheet(null)}
              >
                <section
                  aria-label={
                    activeSheet === "menu" ? "La carte" : "Filtrer la carte"
                  }
                  aria-modal="true"
                  className={styles.bottomSheet}
                  onClick={(event) => event.stopPropagation()}
                  role="dialog"
                >
                  <div className={styles.sheetHandle} aria-hidden="true" />
                  <div className={styles.sheetHeader}>
                    <div>
                      <p className={styles.kicker}>
                        {activeSheet === "menu" ? "Navigation" : "Préférences"}
                      </p>
                      <h3>{activeSheet === "menu" ? "La carte" : "Filtrer la carte"}</h3>
                    </div>
                    <button type="button" onClick={() => setActiveSheet(null)}>
                      Fermer
                    </button>
                  </div>

                  {activeSheet === "menu" ? (
                    <div className={styles.sheetList}>
                      <button
                        aria-pressed={activeCategory === ALL_CATEGORY_ID}
                        className={
                          activeCategory === ALL_CATEGORY_ID ? styles.isActive : undefined
                        }
                        type="button"
                        onClick={showAll}
                      >
                        <span>Toute la carte</span>
                      </button>
                      {categories.map((category) => {
                        return (
                          <button
                            aria-pressed={activeCategory === category.label}
                            className={
                              activeCategory === category.label
                                ? styles.isActive
                                : undefined
                            }
                            key={category.id}
                            type="button"
                            onClick={() => openCategoryInFullMenu(category.label)}
                          >
                            <span>{displayCategoryLabel(category.label)}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      {hasActiveFilter ? (
                        <button
                          className={styles.sheetReset}
                          type="button"
                          onClick={resetFilters}
                        >
                          Réinitialiser les filtres
                        </button>
                      ) : null}
                      <div className={styles.filterGrid} role="group" aria-label="Filtres">
                        {FILTER_OPTIONS.map((filter) => (
                          <button
                            aria-pressed={activeFilter === filter.id}
                            className={
                              activeFilter === filter.id ? styles.isActive : undefined
                            }
                            key={filter.id}
                            onClick={() => toggleFilter(filter.id)}
                            type="button"
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                      <button
                        className={styles.sheetApply}
                        onClick={() => setActiveSheet(null)}
                        type="button"
                      >
                        Appliquer
                      </button>
                    </>
                  )}
                </section>
              </div>
            ) : null}
          </section>
        )}
      </section>

      {showGoogleReview ? (
        <GoogleReviewCard
          googleReview={menu.googleReview}
          restaurantId={menu.restaurantId}
          restaurantName={menu.name}
          source={menu.source}
        />
      ) : null}
    </main>
  );
}
