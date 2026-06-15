"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleReviewCard } from "@/components/menu/GoogleReviewCard";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
import type { Locale } from "@/lib/i18n";
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

const PhonePreviewDishDetail = dynamic(
  () =>
    import("@/components/menu/MaisonElyseDishDetail").then(
      (mod) => mod.MaisonElyseDishDetail
    ),
  {
    ssr: false,
    loading: () => (
      <div className={styles.detailLoading} role="status" aria-live="polite">
        Chargement de la fiche...
      </div>
    )
  }
);

const ALLOWED_3D_CDN_ORIGINS = (process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "")
  .split(/[,\s]+/)
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

type MaisonElyseQrMenuProps = {
  menu: PublicMenu;
  context?: string;
  query?: PublicMenuContextQuery;
  displayMode?: "public" | "phone-preview";
  locale?: Locale;
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
const FILTER_OPTIONS: Array<{ id: FilterId; labels: Record<Locale, string> }> = [
  { id: "signature", labels: { fr: "Signature", en: "Signature" } },
  { id: "recommended", labels: { fr: "Recommandés", en: "Recommended" } },
  { id: "immersive", labels: { fr: "3D / AR", en: "3D / AR" } },
  { id: "available", labels: { fr: "Disponibles", en: "Available" } },
  { id: "gluten-free", labels: { fr: "Sans gluten", en: "Gluten-free" } },
  { id: "dairy-free", labels: { fr: "Sans lactose", en: "Dairy-free" } },
  { id: "nut-free", labels: { fr: "Sans fruits à coque", en: "Nut-free" } },
  { id: "shellfish-free", labels: { fr: "Sans crustacés", en: "Shellfish-free" } },
  { id: "egg-free", labels: { fr: "Sans œufs", en: "Egg-free" } },
  { id: "sesame-free", labels: { fr: "Sans sésame", en: "Sesame-free" } },
  { id: "soy-free", labels: { fr: "Sans soja", en: "Soy-free" } },
  { id: "fish-free", labels: { fr: "Sans poisson", en: "Fish-free" } }
];

const MENU_COPY: Record<
  Locale,
  {
    activeFilterPrefix: string;
    allMenu: string;
    apply: string;
    bottomFilter: string;
    bottomMenu: string;
    chefSuggestion: string;
    close: string;
    collectionBody: string;
    collectionKicker: string;
    collectionTitle: string;
    dishDetails: string;
    emptySelection: string;
    filterDialogLabel: string;
    filterFallback: string;
    filterGroupLabel: string;
    heroBody: string;
    heroKicker: string;
    heroTitle: string;
    menuDialogLabel: string;
    menuToggleAria: string;
    navAria: string;
    preferences: string;
    recommendedBadge: string;
    reset: string;
    resetFilters: string;
    sections: string;
    sheetNavigation: string;
    tonightTitle: string;
    unavailableBadge: string;
    viewFullMenu: string;
  }
> = {
  fr: {
    activeFilterPrefix: "Filtre actif",
    allMenu: "Toute la carte",
    apply: "Appliquer",
    bottomFilter: "Filtrer",
    bottomMenu: "La carte",
    chefSuggestion: "Suggestion du chef",
    close: "Fermer",
    collectionBody:
      "Une sélection de créations servies par section, pensées pour être explorées directement à table.",
    collectionKicker: "LA COLLECTION",
    collectionTitle: "LA CARTE",
    dishDetails: "Voir la fiche plat.",
    emptySelection: "Aucun plat dans cette sélection",
    filterDialogLabel: "Filtrer la carte",
    filterFallback: "Filtre",
    filterGroupLabel: "Filtres",
    heroBody:
      "Découvrez les entrées, plats signatures, desserts et cocktails de la maison, pensés pour être explorés directement à table.",
    heroKicker: "Carte à table",
    heroTitle: "Bienvenue chez Maison Élyse",
    menuDialogLabel: "La carte",
    menuToggleAria: "Ouvrir la navigation de la carte",
    navAria: "Navigation carte et filtres",
    preferences: "Préférences",
    recommendedBadge: "Recommandé",
    reset: "Réinitialiser",
    resetFilters: "Réinitialiser les filtres",
    sections: "Sections",
    sheetNavigation: "Navigation",
    tonightTitle: "À découvrir ce soir",
    unavailableBadge: "Indisponible",
    viewFullMenu: "Voir toute la carte"
  },
  en: {
    activeFilterPrefix: "Active filter",
    allMenu: "Full menu",
    apply: "Apply",
    bottomFilter: "Filter",
    bottomMenu: "Menu",
    chefSuggestion: "Chef's suggestion",
    close: "Close",
    collectionBody:
      "A section-by-section selection of house creations designed to be explored at the table.",
    collectionKicker: "THE COLLECTION",
    collectionTitle: "THE MENU",
    dishDetails: "View dish details.",
    emptySelection: "No dish in this selection",
    filterDialogLabel: "Filter the menu",
    filterFallback: "Filter",
    filterGroupLabel: "Filters",
    heroBody:
      "Explore the house starters, signature dishes, desserts and cocktails directly at the table.",
    heroKicker: "Table menu",
    heroTitle: "Welcome to Maison Élyse",
    menuDialogLabel: "Menu",
    menuToggleAria: "Open menu navigation",
    navAria: "Menu and filter navigation",
    preferences: "Preferences",
    recommendedBadge: "Recommended",
    reset: "Reset",
    resetFilters: "Reset filters",
    sections: "Sections",
    sheetNavigation: "Navigation",
    tonightTitle: "To discover tonight",
    unavailableBadge: "Unavailable",
    viewFullMenu: "View the full menu"
  }
};

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

function displayCategoryLabel(label: string, locale: Locale = "fr"): string {
  const normalized = normalizeText(label);

  if (normalized.includes("signature") || normalized.includes("plat")) {
    return locale === "en" ? "Signature dishes" : "Plats signatures";
  }
  if (normalized.includes("entree") || normalized.includes("starter")) {
    return locale === "en" ? "Starters" : "Entrées";
  }
  if (normalized.includes("dessert")) return "Desserts";
  if (normalized.includes("cocktail") || normalized.includes("drink")) {
    return "Cocktails";
  }
  if (normalized.includes("boisson")) return locale === "en" ? "Drinks" : "Boissons";

  return label;
}

function categoryAnchorId(label: string, locale: Locale = "fr"): string {
  return tokenize(displayCategoryLabel(label, locale)).join("-");
}

function sectionDomId(label: string, locale: Locale = "fr"): string {
  return `section-${categoryAnchorId(label, locale)}`;
}

function categoryEditorial(label: string, locale: Locale = "fr"): {
  kicker: string;
  title: string;
  description: string;
} {
  const displayLabel = displayCategoryLabel(label, locale);
  const normalized = normalizeText(displayLabel);

  if (normalized.includes("entree") || normalized.includes("starter")) {
    return locale === "en"
      ? {
          kicker: "TO START",
          title: "Starters",
          description: "The first house plates: precise, generous and seasonal."
        }
      : {
          kicker: "POUR COMMENCER",
          title: "Entrées",
          description: "Les premières assiettes de la maison, précises et généreuses."
        };
  }

  if (normalized.includes("signature") || normalized.includes("plat")) {
    return locale === "en"
      ? {
          kicker: "SIGNATURE",
          title: "Signature dishes",
          description: "The emblematic Maison Élyse creations."
        }
      : {
          kicker: "LA SIGNATURE",
          title: "Plats signatures",
          description: "Les créations emblématiques de Maison Élyse."
        };
  }

  if (normalized.includes("dessert")) {
    return locale === "en"
      ? {
          kicker: "SWEET FINISH",
          title: "Desserts",
          description: "A final pastry note: fresh, delicate and elegant."
        }
      : {
          kicker: "LA DOUCEUR",
          title: "Desserts",
          description: "Une dernière note pâtissière, fraîche et élégante."
        };
  }

  if (
    normalized.includes("cocktail") ||
    normalized.includes("boisson") ||
    normalized.includes("drink")
  ) {
    return locale === "en"
      ? {
          kicker: "THE BAR",
          title: displayLabel,
          description: "Cocktails and drinks designed to pair with the menu."
        }
      : {
          kicker: "LE BAR",
          title: displayLabel,
          description: "Cocktails et boissons pensés pour accompagner la carte."
        };
  }

  return {
    kicker: "Maison Élyse",
    title: displayLabel,
    description: locale === "en" ? "The selection of the moment." : "La sélection du moment."
  };
}

function getFilterLabel(filter: FilterId, locale: Locale = "fr"): string {
  if (filter === "all") return MENU_COPY[locale].allMenu;
  return (
    FILTER_OPTIONS.find((option) => option.id === filter)?.labels[locale] ??
    MENU_COPY[locale].filterFallback
  );
}

function getScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function categoryRank(label: string): number {
  const normalized = normalizeText(label);
  if (normalized.includes("entree") || normalized.includes("starter")) return 0;
  if (
    normalized.includes("signature") ||
    normalized.includes("plat") ||
    normalized.includes("main")
  ) {
    return 1;
  }
  if (normalized.includes("dessert")) return 2;
  if (
    normalized.includes("cocktail") ||
    normalized.includes("boisson") ||
    normalized.includes("drink")
  ) {
    return 3;
  }
  return 99;
}

function categorySort(a: PublicMenuCategory, b: PublicMenuCategory): number {
  return categoryRank(a.label) - categoryRank(b.label);
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

function dishBadges(dish: PublicMenuDish, locale: Locale): string[] {
  const copy = MENU_COPY[locale];
  const badges: string[] = [];
  if (isSignatureDish(dish)) badges.push("Signature");
  if (isRecommendedDish(dish)) badges.push(copy.recommendedBadge);
  if (hasReal3d(dish)) badges.push("3D");
  if (hasRealAr(dish)) badges.push("AR");
  if (!dish.available) badges.push(copy.unavailableBadge);
  return badges.slice(0, 4);
}

function CategoryCard({
  category,
  imageUrl,
  locale,
  onSelect
}: {
  category: PublicMenuCategory;
  imageUrl: string;
  locale: Locale;
  onSelect: () => void;
}) {
  const label = displayCategoryLabel(category.label, locale);
  const editorial = categoryEditorial(category.label, locale);

  return (
    <button
      className={styles.categoryCard}
      data-testid={`maison-section-${categoryAnchorId(category.label, locale)}`}
      onClick={onSelect}
      style={
        imageUrl
          ? ({ "--category-image": `url("${imageUrl}")` } as CSSProperties)
          : undefined
      }
      type="button"
    >
      <strong>{label}</strong>
      <small>{editorial.description}</small>
    </button>
  );
}

function DishCard({
  dish,
  locale,
  menu,
  onSelectDish,
  query
}: {
  dish: PublicMenuDish;
  locale: Locale;
  menu: PublicMenu;
  onSelectDish?: (dish: PublicMenuDish) => void;
  query?: PublicMenuContextQuery;
}) {
  const badges = dishBadges(dish, locale);
  const href = buildPublicDishPath(menu.slug, dish.slug, query);
  const ariaLabel = `${dish.name}. ${dish.priceLabel || ""} ${
    MENU_COPY[locale].dishDetails
  }`;
  const content = (
    <>
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
    </>
  );

  return (
    <li className={styles.dishItem}>
      {onSelectDish ? (
        <button
          aria-label={ariaLabel}
          className={styles.dishCard}
          data-dish-card="true"
          onClick={() => onSelectDish(dish)}
          type="button"
        >
          {content}
        </button>
      ) : (
        <Link
          aria-label={ariaLabel}
          className={styles.dishCard}
          data-dish-card="true"
          href={href}
          prefetch={false}
        >
          {content}
        </Link>
      )}
    </li>
  );
}

function DishSection({
  dishes,
  locale,
  menu,
  onSelectDish,
  query,
  title
}: {
  dishes: PublicMenuDish[];
  locale: Locale;
  menu: PublicMenu;
  onSelectDish?: (dish: PublicMenuDish) => void;
  query?: PublicMenuContextQuery;
  title: string;
}) {
  const sectionId = sectionDomId(title, locale);
  const headingId = `${sectionId}-heading`;
  const editorial = categoryEditorial(title, locale);

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
          <DishCard
            dish={dish}
            key={dish.id}
            locale={locale}
            menu={menu}
            onSelectDish={onSelectDish}
            query={query}
          />
        ))}
      </ul>
    </section>
  );
}

export function MaisonElyseQrMenu({
  displayMode = "public",
  locale = "fr",
  menu,
  query,
  showGoogleReview = true,
  startFullMenu = false
}: MaisonElyseQrMenuProps) {
  const copy = MENU_COPY[locale];
  const filterOptions = useMemo(
    () =>
      FILTER_OPTIONS.map((option) => ({
        id: option.id,
        label: option.labels[locale]
      })),
    [locale]
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(() =>
    startFullMenu ? ALL_CATEGORY_ID : null
  );
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [activeSheet, setActiveSheet] = useState<SheetId>(null);
  const [activeDish, setActiveDish] = useState<PublicMenuDish | null>(null);
  const [pendingSectionLabel, setPendingSectionLabel] = useState<string | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  const menuScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const phonePreviewScrollParentRef = useRef<HTMLElement | null>(null);
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
      ? copy.allMenu
      : activeCategory
        ? displayCategoryLabel(activeCategory, locale)
        : copy.sections;
  const hasActiveFilter = activeFilter !== "all";

  useEffect(() => {
    if (activeCategory !== ALL_CATEGORY_ID || !pendingSectionLabel) return;

    const frameId = window.requestAnimationFrame(() => {
      const sectionId = sectionDomId(pendingSectionLabel, locale);
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
  }, [activeCategory, displayMode, locale, pendingSectionLabel]);

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

      const firstDish = scrollArea.querySelector<HTMLElement>('[data-dish-card="true"]');
      if (!firstDish) return;

      const scrollAreaRect = scrollArea.getBoundingClientRect();
      const firstDishRect = firstDish.getBoundingClientRect();
      const firstDishOverflow = firstDishRect.bottom - scrollAreaRect.bottom;
      if (firstDishOverflow <= 0) return;

      const collectionLabel = Array.from(scrollArea.querySelectorAll<HTMLElement>("p")).find(
        (element) => element.textContent?.trim() === copy.collectionKicker
      );
      const maxScrollKeepingCollection = collectionLabel
        ? Math.max(0, collectionLabel.getBoundingClientRect().top - scrollAreaRect.top)
        : Number.POSITIVE_INFINITY;

      scrollArea.scrollTop = Math.min(Math.ceil(firstDishOverflow + 2), maxScrollKeepingCollection);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeCategory,
    copy.collectionKicker,
    displayMode,
    pendingSectionLabel,
    visibleDishes.length
  ]);

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

  function scrollPhonePreviewToTop() {
    const scrollParent = phonePreviewScrollParentRef.current;
    if (!scrollParent) return;

    requestAnimationFrame(() => {
      scrollParent.scrollTo({
        top: 0,
        behavior: "auto"
      });
    });
  }

  function openDishInPhonePreview(dish: PublicMenuDish) {
    if (displayMode !== "phone-preview") return;

    phonePreviewScrollParentRef.current =
      menuScrollAreaRef.current?.closest<HTMLElement>("[data-phone-mockup-scroll]") ??
      menuRef.current?.closest<HTMLElement>("[data-phone-mockup-scroll]") ??
      null;
    setActiveSheet(null);
    setActiveDish(dish);
    scrollPhonePreviewToTop();
  }

  function closeDishInPhonePreview() {
    setActiveDish(null);
    scrollPhonePreviewToTop();
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
  const phonePreviewDishSelect =
    displayMode === "phone-preview" ? openDishInPhonePreview : undefined;

  if (displayMode === "phone-preview" && activeDish) {
    return (
      <PhonePreviewDishDetail
        dish={activeDish}
        displayMode="phone-preview"
        locale={locale}
        menu={menu}
        onBackToMenu={closeDishInPhonePreview}
        query={query}
      />
    );
  }

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
            <p className={styles.kicker}>{copy.heroKicker}</p>
            <h1 id="maison-elyse-heading">{copy.heroTitle}</h1>
            <p>{copy.heroBody}</p>
          </div>
        </section>
      ) : null}

      <section className={styles.sections} ref={menuRef} aria-label={copy.sections}>
        {!activeCategory ? (
          <>
            <div className={styles.categoryGrid}>
              {categories.map((category) => (
                <CategoryCard
                  category={category}
                  imageUrl={categoryImages.get(category.label) ?? ""}
                  key={category.id}
                  locale={locale}
                  onSelect={() => openCategoryInFullMenu(category.label)}
                />
              ))}
            </div>

            {featuredDishes.length > 0 ? (
              <section className={styles.featured} aria-labelledby="featured-heading">
                <div className={styles.featuredHeader}>
                  <div>
                    <p className={styles.kicker}>{copy.chefSuggestion}</p>
                    <h2 id="featured-heading">{copy.tonightTitle}</h2>
                  </div>
                  <button type="button" onClick={showAll}>
                    {copy.viewFullMenu}
                  </button>
                </div>
                <ul className={styles.previewList}>
                  {featuredDishes.map((dish) => (
                    <DishCard
                      dish={dish}
                      key={dish.id}
                      locale={locale}
                      menu={menu}
                      onSelectDish={phonePreviewDishSelect}
                      query={query}
                    />
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
                    aria-label={copy.menuToggleAria}
                    type="button"
                    onClick={() => setActiveSheet("menu")}
                  >
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.menuCoverCopy}>
                  <p className={styles.kicker}>{copy.collectionKicker}</p>
                  <h2 id="active-category-heading">{copy.collectionTitle}</h2>
                  <span aria-hidden="true" />
                  <p>{copy.collectionBody}</p>
                </div>
              </div>

              {hasActiveFilter ? (
                <div className={styles.activeFilterNotice} role="status">
                  <span>
                    {copy.activeFilterPrefix} : {getFilterLabel(activeFilter, locale)}
                  </span>
                  <button type="button" onClick={resetFilters}>
                    {copy.reset}
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
                        locale={locale}
                        menu={menu}
                        onSelectDish={phonePreviewDishSelect}
                        query={query}
                        title={section.label}
                      />
                    ))}
                  </div>
                ) : (
                  <DishSection
                    dishes={visibleDishes}
                    locale={locale}
                    menu={menu}
                    onSelectDish={phonePreviewDishSelect}
                    query={query}
                    title={activeCategoryLabel}
                  />
                )
              ) : (
                <div className={styles.empty} role="status">
                  <p>{copy.emptySelection}</p>
                  <button type="button" onClick={showAll}>
                    {copy.viewFullMenu}
                  </button>
                </div>
              )}
            </div>

            <nav className={styles.bottomBar} aria-label={copy.navAria}>
              <button
                aria-expanded={activeSheet === "menu"}
                type="button"
                onClick={() =>
                  setActiveSheet((currentSheet) =>
                    currentSheet === "menu" ? null : "menu"
                  )
                }
              >
                {copy.bottomMenu}
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
                {copy.bottomFilter}
              </button>
            </nav>

            {activeSheet ? (
              <div
                className={styles.sheetBackdrop}
                onClick={() => setActiveSheet(null)}
              >
                <section
                  aria-label={
                    activeSheet === "menu" ? copy.menuDialogLabel : copy.filterDialogLabel
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
                        {activeSheet === "menu" ? copy.sheetNavigation : copy.preferences}
                      </p>
                      <h3>
                        {activeSheet === "menu" ? copy.menuDialogLabel : copy.filterDialogLabel}
                      </h3>
                    </div>
                    <button type="button" onClick={() => setActiveSheet(null)}>
                      {copy.close}
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
                        <span>{copy.allMenu}</span>
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
                            <span>{displayCategoryLabel(category.label, locale)}</span>
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
                          {copy.resetFilters}
                        </button>
                      ) : null}
                      <div
                        className={styles.filterGrid}
                        role="group"
                        aria-label={copy.filterGroupLabel}
                      >
                        {filterOptions.map((filter) => (
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
                        {copy.apply}
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
