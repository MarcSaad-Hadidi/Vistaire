"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleReviewCard } from "@/components/menu/GoogleReviewCard";
import { trackPublicMenuEvent } from "@/lib/analytics/client";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
import {
  normalizePublicMenuLocale,
  type PublicMenuLocale
} from "@/lib/menu/publicMenuSettings";
import {
  getMaisonElyseLanguagePresentation,
  getMaisonElyseTextDirection,
  resolveMaisonElyseCopy
} from "@/lib/menu/maisonElyseLocalization";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { useTransitionPresence } from "@/lib/useTransitionPresence";
import { maisonElyseThemeStyle } from "@/lib/menu/maisonElyseTheme";
import {
  ALLERGEN_FILTERS,
  matchesConfirmedFreeForFilter,
  type AllergenFilterId
} from "@/lib/menu/allergens";
import {
  buildPublicDishPath,
  getPublicMenuCategoryGroups,
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuCategory,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import type { MenuUiConfig } from "@/lib/menu/menuUiConfig";
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
  displayMode?: "public" | "phone-preview" | "comparison-preview";
  locale?: PublicMenuLocale;
  localizedMenus?:
    | Partial<Record<PublicMenuLocale, PublicMenu>>
    | Partial<Record<"fr" | "en", PublicMenu>>;
  config?: MenuUiConfig;
  showGoogleReview?: boolean;
};

type FilterId =
  | "all"
  | "recommended"
  | "signature"
  | "immersive"
  | "available"
  | AllergenFilterId;
type DietaryFilterId = AllergenFilterId;

type SheetId = "menu" | "filter" | "language" | null;

const ALL_CATEGORY_ID = "all";
// Kept slightly above the CSS sheet animation duration so the exit finishes before unmount.
const SHEET_MOTION_MS = 260;
const MENU_LOCALE_STORAGE_KEY = "vistaire:maison-elyse-menu-locale";
const BUILT_IN_LANGUAGE_FALLBACK: Array<{ id: PublicMenuLocale; label: string; shortLabel: string }> = [
  { id: "fr", label: "Français", shortLabel: "FR" },
  { id: "en", label: "English", shortLabel: "EN" }
];
type LanguageOption = (typeof BUILT_IN_LANGUAGE_FALLBACK)[number];
const ALLERGEN_FILTER_LABELS = Object.fromEntries(
  ALLERGEN_FILTERS.map((filter) => [filter.id, filter.labels])
) as unknown as Record<AllergenFilterId, Record<string, string>>;
const FILTER_OPTIONS: Array<{ id: FilterId; labels: Record<string, string> }> = [
  { id: "signature", labels: { fr: "Signature", en: "Signature" } },
  { id: "recommended", labels: { fr: "Recommandés", en: "Recommended" } },
  { id: "immersive", labels: { fr: "3D / AR", en: "3D / AR" } },
  { id: "available", labels: { fr: "Disponibles", en: "Available" } },
  ...ALLERGEN_FILTERS.map((filter) => ({
    id: filter.id as AllergenFilterId,
    labels: ALLERGEN_FILTER_LABELS[filter.id]
  }))
];
const BACK_TO_TOP_SCROLL_THRESHOLD = 520;

const MENU_COPY: Record<
  "fr" | "en",
  {
    activeFilterPrefix: string;
    allMenu: string;
    apply: string;
    backToTop: string;
    bottomFilter: string;
    bottomMenu: string;
    close: string;
    collectionBody: string;
    collectionKicker: string;
    collectionTitle: string;
    dishDetails: string;
    emptySelection: string;
    filterDialogLabel: string;
    filterFallback: string;
    filterGroupLabel: string;
    languageDialogLabel: string;
    languageToggleAria: string;
    menuDialogLabel: string;
    menuToggleAria: string;
    navAria: string;
    preferences: string;
    recommendedBadge: string;
    reset: string;
    resetFilters: string;
    sections: string;
    sheetNavigation: string;
    unavailableBadge: string;
  }
> = {
  fr: {
    activeFilterPrefix: "Filtre actif",
    allMenu: "Toute la carte",
    apply: "Appliquer",
    backToTop: "Retour en haut",
    bottomFilter: "Filtrer",
    bottomMenu: "La carte",
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
    languageDialogLabel: "Langue du menu",
    languageToggleAria: "Choisir la langue du menu",
    menuDialogLabel: "La carte",
    menuToggleAria: "Ouvrir la navigation de la carte",
    navAria: "Navigation carte et filtres",
    preferences: "Préférences",
    recommendedBadge: "Recommandé",
    reset: "Réinitialiser",
    resetFilters: "Réinitialiser les filtres",
    sections: "Sections",
    sheetNavigation: "Navigation",
    unavailableBadge: "Indisponible",
  },
  en: {
    activeFilterPrefix: "Active filter",
    allMenu: "Full menu",
    apply: "Apply",
    backToTop: "Back to top",
    bottomFilter: "Filter",
    bottomMenu: "Menu",
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
    languageDialogLabel: "Menu language",
    languageToggleAria: "Choose menu language",
    menuDialogLabel: "Menu",
    menuToggleAria: "Open menu navigation",
    navAria: "Menu and filter navigation",
    preferences: "Preferences",
    recommendedBadge: "Recommended",
    reset: "Reset",
    resetFilters: "Reset filters",
    sections: "Sections",
    sheetNavigation: "Navigation",
    unavailableBadge: "Unavailable",
  }
};

type MaisonMenuCopy = (typeof MENU_COPY)["fr"];

function localeLanguage(locale: string): string {
  try {
    return new Intl.Locale(locale).language.toLowerCase();
  } catch {
    return locale.toLowerCase().split("-")[0] ?? "fr";
  }
}

function buildMaisonMenuCopy(
  locale: PublicMenuLocale,
  localizedUiCopy?: Record<string, unknown>
): MaisonMenuCopy {
  const language = localeLanguage(locale);
  const fallback = MENU_COPY[language === "fr" ? "fr" : "en"];
  const resolved = resolveMaisonElyseCopy(locale, localizedUiCopy).copy;
  return {
    ...fallback,
    activeFilterPrefix: resolved.activeFilterPrefix,
    allMenu: resolved.activeCategoryAll,
    apply: resolved.filterApply,
    backToTop: resolved.backToTop,
    bottomFilter: resolved.filterButton,
    bottomMenu: resolved.activeCategoryAll,
    close: resolved.close,
    collectionBody: resolved.heroBlurb,
    collectionKicker: resolved.categories,
    collectionTitle: resolved.activeCategoryAll,
    dishDetails: resolved.viewDetails,
    emptySelection: resolved.noResultsTitle,
    filterDialogLabel: resolved.filterTitle,
    filterFallback: resolved.filterFallback,
    filterGroupLabel: resolved.filterGroupLabel,
    languageDialogLabel: resolved.languageTitle,
    languageToggleAria: resolved.languageAria,
    menuDialogLabel: resolved.menuAria,
    menuToggleAria: resolved.menuAria,
    navAria: resolved.menuAria,
    preferences: resolved.languageKicker,
    recommendedBadge: resolved.recommendation,
    reset: resolved.reset,
    resetFilters: resolved.resetFilters,
    sections: resolved.categories,
    sheetNavigation: resolved.categories,
    unavailableBadge: resolved.soldOut
  };
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function BackToTopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12.5 12 5l7 7.5M12 6v13" />
    </svg>
  );
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function displayCategoryLabel(label: string, locale: PublicMenuLocale = "fr-CA"): string {
  const normalized = normalizeText(label);
  const language = localeLanguage(locale);

  if (normalized.includes("signature") || normalized.includes("plat")) {
    return language === "en"
      ? "Signature dishes"
      : language === "fr"
        ? "Plats signatures"
        : label;
  }
  if (normalized.includes("entree") || normalized.includes("starter")) {
    return language === "en" ? "Starters" : language === "fr" ? "Entrées" : label;
  }
  if (normalized.includes("dessert")) return "Desserts";
  if (normalized.includes("cocktail") || normalized.includes("drink")) {
    return "Cocktails";
  }
  if (normalized.includes("boisson")) {
    return language === "en" ? "Drinks" : language === "fr" ? "Boissons" : label;
  }

  return label;
}

function categoryAnchorId(label: string, locale: PublicMenuLocale = "fr-CA"): string {
  return tokenize(displayCategoryLabel(label, locale)).join("-");
}

function sectionDomId(label: string, locale: PublicMenuLocale = "fr-CA"): string {
  return `section-${categoryAnchorId(label, locale)}`;
}

function categoryEditorial(label: string, locale: PublicMenuLocale = "fr-CA"): {
  kicker: string;
  title: string;
  description: string;
} {
  const displayLabel = displayCategoryLabel(label, locale);
  const normalized = normalizeText(displayLabel);

  if (normalized.includes("entree") || normalized.includes("starter")) {
    return localeLanguage(locale) === "en"
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
    return localeLanguage(locale) === "en"
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
    return localeLanguage(locale) === "en"
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
    return localeLanguage(locale) === "en"
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

function personalizeBranding<T>(value: T, restaurantName: string): T {
  if (typeof value === "string") {
    return value
      .replaceAll("Maison Élyse", restaurantName)
      .replaceAll("Maison Elyse", restaurantName) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => personalizeBranding(item, restaurantName)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        personalizeBranding(item, restaurantName)
      ])
    ) as T;
  }
  return value;
}

function getFilterLabel(filter: FilterId, locale: PublicMenuLocale = "fr-CA"): string {
  const copy = MENU_COPY[localeLanguage(locale) === "fr" ? "fr" : "en"];
  if (filter === "all") return copy.allMenu;
  return (
    FILTER_OPTIONS.find((option) => option.id === filter)?.labels[localeLanguage(locale)] ??
    copy.filterFallback
  );
}

function getScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function getStoredMenuLocale(): PublicMenuLocale | null {
  if (typeof window === "undefined") return null;

  try {
    const storedLocale = window.localStorage.getItem(MENU_LOCALE_STORAGE_KEY);
    return storedLocale ? normalizePublicMenuLocale(storedLocale) : null;
  } catch {
    return null;
  }
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
    return matchesConfirmedFreeForFilter(dish, filter);
  }
  return true;
}

function shortDescription(dish: PublicMenuDish): string {
  if (!dish.description) return "";
  if (dish.description.length <= 132) return dish.description;
  return `${dish.description.slice(0, 129).trim()}...`;
}

function dishBadges(dish: PublicMenuDish, locale: PublicMenuLocale): string[] {
  const copy = MENU_COPY[localeLanguage(locale) === "fr" ? "fr" : "en"];
  const badges: string[] = [];
  if (isSignatureDish(dish)) badges.push("Signature");
  if (isRecommendedDish(dish)) badges.push(copy.recommendedBadge);
  if (hasReal3d(dish)) badges.push("3D");
  if (hasRealAr(dish)) badges.push("AR");
  if (!dish.available) badges.push(copy.unavailableBadge);
  return badges.slice(0, 4);
}

function DishCard({
  disableNavigation = false,
  dish,
  locale,
  menu,
  onSelectDish,
  query
}: {
  disableNavigation?: boolean;
  dish: PublicMenuDish;
  locale: PublicMenuLocale;
  menu: PublicMenu;
  onSelectDish?: (dish: PublicMenuDish) => void;
  query?: PublicMenuContextQuery;
}) {
  const badges = dishBadges(dish, locale);
  const textDirection = getMaisonElyseTextDirection(locale);
  const href = buildPublicDishPath(menu.slug, dish.slug, query);
  const ariaLabel = `${dish.name}. ${dish.priceLabel || ""} ${
    MENU_COPY[localeLanguage(locale) === "fr" ? "fr" : "en"].dishDetails
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
      <span className={styles.dishCopy} dir={textDirection}>
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
    <li
      className={styles.dishItem}
      data-public-menu-dish
      data-dish-id={dish.id}
      data-category-id={dish.categorySlug ?? dish.categoryId ?? dish.category}
      data-available={dish.available}
    >
      {disableNavigation ? (
        <div
          className={styles.dishCard}
          data-dish-card="true"
          data-comparison-static-control="true"
        >
          {content}
        </div>
      ) : onSelectDish ? (
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
  disableNavigation = false,
  dishes,
  locale,
  menu,
  onSelectDish,
  query,
  title
}: {
  disableNavigation?: boolean;
  dishes: PublicMenuDish[];
  locale: PublicMenuLocale;
  menu: PublicMenu;
  onSelectDish?: (dish: PublicMenuDish) => void;
  query?: PublicMenuContextQuery;
  title: string;
}) {
  const sectionId = sectionDomId(title, locale);
  const headingId = `${sectionId}-heading`;
  const editorial = personalizeBranding(categoryEditorial(title, locale), menu.name);
  const textDirection = getMaisonElyseTextDirection(locale);

  return (
    <section
      className={styles.dishSection}
      id={sectionId}
      aria-labelledby={headingId}
    >
      <div className={styles.dishSectionHeader}>
        <div dir={textDirection}>
          <p className={styles.kicker}>{editorial.kicker}</p>
          <h3 id={headingId}>{editorial.title}</h3>
          <p>{editorial.description}</p>
        </div>
      </div>
      <ul className={styles.dishList}>
        {dishes.map((dish) => (
          <DishCard
            disableNavigation={disableNavigation}
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
  locale = "fr-CA",
  localizedMenus,
  config,
  menu,
  query,
  showGoogleReview = true
}: MaisonElyseQrMenuProps) {
  const router = useRouter();
  const propLocale = normalizePublicMenuLocale(locale);
  const queryLocale = query?.lang?.toString().trim()
    ? normalizePublicMenuLocale(query.lang)
    : null;
  const [selectedLocale, setSelectedLocale] = useState<PublicMenuLocale>(
    () => queryLocale ?? propLocale
  );
  const [shouldPersistLocaleInLinks, setShouldPersistLocaleInLinks] = useState(
    () => Boolean(queryLocale)
  );
  const activeMenu =
    (localizedMenus as Partial<Record<string, PublicMenu>> | undefined)?.[
      selectedLocale
    ] ?? menu;
  const restaurantDisplayName = activeMenu.name.trim() || "Restaurant";
  useEffect(() => {
    if (displayMode !== "public") return;
    trackPublicMenuEvent(activeMenu, { eventName: "menu_opened" });
  }, [activeMenu, displayMode]);
  const copy = useMemo(
    () =>
      personalizeBranding(
        buildMaisonMenuCopy(selectedLocale, activeMenu.localizedUiCopy),
        restaurantDisplayName
      ),
    [activeMenu.localizedUiCopy, restaurantDisplayName, selectedLocale]
  );
  const languageOptions = useMemo<LanguageOption[]>(() => {
    const statuses = new Map(
      (activeMenu.translationLocales ?? []).map((status) => [status.locale, status])
    );
    const readyLocales = activeMenu.settings.supportedLocales.filter((candidate) => {
      const status = statuses.get(candidate);
      return (
        candidate === activeMenu.settings.defaultLocale ||
        status?.status === "source" ||
        status?.status === "up_to_date"
      );
    });
    const locales = readyLocales.length
      ? readyLocales
      : [activeMenu.settings.defaultLocale];
    return locales.map((candidate) => {
      const presentation = getMaisonElyseLanguagePresentation(candidate);
      const legacy = BUILT_IN_LANGUAGE_FALLBACK.find(
        (option) => localeLanguage(option.id) === localeLanguage(candidate)
      );
      return {
        id: candidate,
        label: presentation.nativeName || legacy?.label || candidate,
        shortLabel: presentation.shortCode
      };
    });
  }, [activeMenu.settings, activeMenu.translationLocales]);
  const activeQuery = useMemo(
    () =>
      shouldPersistLocaleInLinks
        ? {
            ...(query ?? {}),
            lang: selectedLocale
          }
        : query,
    [query, selectedLocale, shouldPersistLocaleInLinks]
  );
  const filterOptions = useMemo(
    () =>
      FILTER_OPTIONS.map((option) => ({
        id: option.id,
        label:
          option.labels[localeLanguage(selectedLocale)] ??
          option.labels.fr ??
          option.labels.en ??
          ""
      })),
    [selectedLocale]
  );
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY_ID);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [activeSheet, setActiveSheet] = useState<SheetId>(null);
  const [activeDish, setActiveDish] = useState<PublicMenuDish | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [pendingSectionLabel, setPendingSectionLabel] = useState<string | null>(null);
  const isEmbeddedPreview = displayMode !== "public";
  const isComparisonPreview = displayMode === "comparison-preview";
  const menuRef = useRef<HTMLElement | null>(null);
  const menuScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const phonePreviewScrollParentRef = useRef<HTMLElement | null>(null);
  const skipNextPhonePreviewAutoScrollRef = useRef(false);
  const manualLocaleRef = useRef<PublicMenuLocale | null>(null);
  const lastSeenQueryLocaleRef = useRef<PublicMenuLocale | null>(queryLocale);
  const getPhonePreviewScrollParent = useCallback(() => {
    const currentScrollParent = phonePreviewScrollParentRef.current;
    if (
      currentScrollParent?.isConnected &&
      (currentScrollParent.hasAttribute("data-phone-mockup-scroll") ||
        currentScrollParent.getAttribute("data-comparison-scroll-root") ===
          "digital")
    ) {
      return currentScrollParent;
    }

    const embeddedScrollSelector =
      '[data-phone-mockup-scroll], [data-comparison-scroll-root="digital"]';
    const scrollParent =
      menuScrollAreaRef.current?.closest<HTMLElement>(embeddedScrollSelector) ??
      menuRef.current?.closest<HTMLElement>(embeddedScrollSelector) ??
      null;

    phonePreviewScrollParentRef.current = scrollParent;
    return scrollParent;
  }, []);

  const getPhonePreviewScrollTarget = useCallback(() => {
    const scrollParent = getPhonePreviewScrollParent();
    if (scrollParent && scrollParent.scrollHeight > scrollParent.clientHeight) {
      return scrollParent;
    }

    return menuScrollAreaRef.current;
  }, [getPhonePreviewScrollParent]);

  const getPhonePreviewScrollTargets = useCallback(() => {
    const scrollParent = getPhonePreviewScrollParent();
    const scrollArea = menuScrollAreaRef.current;

    return Array.from(
      new Set(
        [scrollParent, scrollArea].filter(
          (target): target is HTMLElement => Boolean(target)
        )
      )
    );
  }, [getPhonePreviewScrollParent]);
  const updateBackToTopVisibility = useCallback(() => {
    if (!isEmbeddedPreview) {
      setShowBackToTop(window.scrollY > BACK_TO_TOP_SCROLL_THRESHOLD);
      return;
    }

    const scrollTargets = getPhonePreviewScrollTargets();
    const scrollOffset = scrollTargets.reduce(
      (maximum, target) => Math.max(maximum, target.scrollTop),
      0
    );
    setShowBackToTop(scrollOffset > BACK_TO_TOP_SCROLL_THRESHOLD);
  }, [getPhonePreviewScrollTargets, isEmbeddedPreview]);
  const groups = useMemo(
    () => getPublicMenuCategoryGroups(activeMenu.dishes),
    [activeMenu.dishes]
  );
  const categories = useMemo(
    () => getVisiblePublicMenuCategories(activeMenu.dishes).sort(categorySort),
    [activeMenu.dishes]
  );
  const menuHeroImage = useMemo(() => {
    const coverDish = activeMenu.dishes.find((dish) => dish.imageUrl);

    return coverDish?.imageUrl || coverDish?.thumbnailUrl || "";
  }, [activeMenu.dishes]);
  const baseDishes = useMemo(() => {
    if (activeCategory === ALL_CATEGORY_ID) return activeMenu.dishes;
    return groups.get(activeCategory) ?? [];
  }, [activeCategory, activeMenu.dishes, groups]);
  const visibleDishes = useMemo(
    () => baseDishes.filter((dish) => dishMatchesFilter(dish, activeFilter)),
    [activeFilter, baseDishes]
  );
  const visibleDishSections = useMemo(() => {
    if (activeCategory !== ALL_CATEGORY_ID) return [];

    return categories
      .map((category) => {
        const dishes = (groups.get(category.id) ?? []).filter((dish) =>
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
  const selectedCategory = categories.find(
    (category) => category.id === activeCategory
  );
  const activeCategoryLabel =
    activeCategory === ALL_CATEGORY_ID
      ? copy.allMenu
      : displayCategoryLabel(selectedCategory?.label ?? activeCategory, selectedLocale);
  const hasActiveFilter = activeFilter !== "all";

  const resetLocaleDependentUi = useCallback(() => {
    setActiveSheet(null);
    setActiveFilter("all");
    setPendingSectionLabel(null);
    setActiveDish(null);
    setActiveCategory((currentCategory) =>
      currentCategory && currentCategory !== ALL_CATEGORY_ID
        ? ALL_CATEGORY_ID
        : currentCategory
    );
  }, []);

  useEffect(() => {
    if (displayMode !== "public") return;
    const frameId = window.requestAnimationFrame(() => {
      const manualLocale = manualLocaleRef.current;
      if (manualLocale && queryLocale !== manualLocale) return;
      if (manualLocale && queryLocale === manualLocale) {
        manualLocaleRef.current = null;
      }

      if (queryLocale) {
        try {
          window.localStorage.setItem(MENU_LOCALE_STORAGE_KEY, queryLocale);
        } catch {
          // Storage can be unavailable in private browsing; the URL still carries the choice.
        }

        setShouldPersistLocaleInLinks(true);

        if (lastSeenQueryLocaleRef.current !== queryLocale) {
          lastSeenQueryLocaleRef.current = queryLocale;
          setSelectedLocale(queryLocale);
          resetLocaleDependentUi();
        }
        return;
      }

      lastSeenQueryLocaleRef.current = null;
      const storedLocale = getStoredMenuLocale();
      if (!storedLocale || storedLocale === propLocale) return;
      setSelectedLocale(storedLocale);
      setShouldPersistLocaleInLinks(true);
      resetLocaleDependentUi();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [displayMode, propLocale, queryLocale, resetLocaleDependentUi]);

  useEffect(() => {
    if (displayMode !== "public") return;
    if (queryLocale) return;
    if (selectedLocale === propLocale) return;

    const frameId = window.requestAnimationFrame(() => {
      try {
        window.localStorage.setItem(MENU_LOCALE_STORAGE_KEY, selectedLocale);
      } catch {
        // The in-memory selection is enough for this session.
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [displayMode, propLocale, queryLocale, selectedLocale]);

  useEffect(() => {
    if (activeCategory !== ALL_CATEGORY_ID || !pendingSectionLabel) return;

    const frameId = window.requestAnimationFrame(() => {
      const sectionId = sectionDomId(pendingSectionLabel, selectedLocale);
      const section = document.getElementById(sectionId);
      const scrollTarget = getPhonePreviewScrollTarget();

      if (isEmbeddedPreview && section && scrollTarget?.contains(section)) {
        const scrollTargetRect = scrollTarget.getBoundingClientRect();
        const sectionRect = section.getBoundingClientRect();
        scrollTarget.scrollTo({
          behavior: getScrollBehavior(),
          top: Math.max(
            0,
            sectionRect.top - scrollTargetRect.top + scrollTarget.scrollTop
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
  }, [activeCategory, getPhonePreviewScrollTarget, isEmbeddedPreview, pendingSectionLabel, selectedLocale]);

  useEffect(() => {
    if (displayMode !== "phone-preview" || pendingSectionLabel) {
      return;
    }

    if (skipNextPhonePreviewAutoScrollRef.current) {
      skipNextPhonePreviewAutoScrollRef.current = false;
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const scrollTarget = getPhonePreviewScrollTarget();
      if (!scrollTarget) return;

      scrollTarget.scrollTop = 0;

      const firstDish = scrollTarget.querySelector<HTMLElement>('[data-dish-card="true"]');
      if (!firstDish) return;

      const scrollTargetRect = scrollTarget.getBoundingClientRect();
      const firstDishRect = firstDish.getBoundingClientRect();
      const firstDishOverflow = firstDishRect.bottom - scrollTargetRect.bottom;
      if (firstDishOverflow <= 0) return;

      const collectionLabel = Array.from(scrollTarget.querySelectorAll<HTMLElement>("p")).find(
        (element) => element.textContent?.trim() === copy.collectionKicker
      );
      const maxScrollKeepingCollection = collectionLabel
        ? Math.max(0, collectionLabel.getBoundingClientRect().top - scrollTargetRect.top)
        : Number.POSITIVE_INFINITY;

      scrollTarget.scrollTop = Math.min(
        Math.ceil(firstDishOverflow + 2),
        maxScrollKeepingCollection
      );
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeCategory,
    copy.collectionKicker,
    displayMode,
    getPhonePreviewScrollTarget,
    pendingSectionLabel,
    visibleDishes.length
  ]);

  useEffect(() => {
    if (!isEmbeddedPreview) {
      const frameId = window.requestAnimationFrame(updateBackToTopVisibility);
      window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener("scroll", updateBackToTopVisibility);
      };
    }

    const scrollTargets = getPhonePreviewScrollTargets();
    if (scrollTargets.length === 0) return;

    const frameId = window.requestAnimationFrame(updateBackToTopVisibility);
    scrollTargets.forEach((target) =>
      target.addEventListener("scroll", updateBackToTopVisibility, { passive: true })
    );
    window.addEventListener("scroll", updateBackToTopVisibility, {
      capture: true,
      passive: true
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      scrollTargets.forEach((target) =>
        target.removeEventListener("scroll", updateBackToTopVisibility)
      );
      window.removeEventListener("scroll", updateBackToTopVisibility, true);
    };
  }, [getPhonePreviewScrollTargets, isEmbeddedPreview, updateBackToTopVisibility]);

  function scrollToMenu() {
    requestAnimationFrame(() => {
      if (isEmbeddedPreview) {
        const scrollTarget = getPhonePreviewScrollTarget();
        const menuElement = menuRef.current;
        if (scrollTarget && menuElement && scrollTarget.contains(menuElement)) {
          const scrollTargetRect = scrollTarget.getBoundingClientRect();
          const menuRect = menuElement.getBoundingClientRect();
          scrollTarget.scrollTo({
            behavior: getScrollBehavior(),
            top: Math.max(
              0,
              menuRect.top - scrollTargetRect.top + scrollTarget.scrollTop
            )
          });
          return;
        }
        return;
      }
      menuRef.current?.scrollIntoView({
        behavior: getScrollBehavior(),
        block: "start"
      });
    });
  }

  function scrollToTop() {
    if (isEmbeddedPreview) {
      getPhonePreviewScrollTargets().forEach((scrollTarget) => {
        scrollTarget.scrollTo({
          top: 0,
          behavior: getScrollBehavior()
        });
      });
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: getScrollBehavior()
    });
  }

  function selectCategory(categoryId: string) {
    skipNextPhonePreviewAutoScrollRef.current = false;
    setActiveCategory(categoryId);
    setActiveFilter("all");
    setActiveSheet(null);
    setPendingSectionLabel(null);
    scrollToMenu();
  }

  function openCategoryInFullMenu(categoryId: string) {
    const categoryLabel =
      categories.find((category) => category.id === categoryId)?.label ?? categoryId;
    skipNextPhonePreviewAutoScrollRef.current = isEmbeddedPreview;
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

  function writeLocaleToUrl(nextLocale: PublicMenuLocale) {
    if (displayMode !== "public") return;
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("lang", nextLocale);
    router.replace(
      `${currentUrl.pathname}?${currentUrl.searchParams.toString()}${currentUrl.hash}`,
      { scroll: false }
    );
  }

  function selectLanguage(nextLocale: PublicMenuLocale) {
    manualLocaleRef.current = nextLocale;
    setSelectedLocale(nextLocale);
    setShouldPersistLocaleInLinks(true);
    resetLocaleDependentUi();

    if (displayMode === "public") {
      try {
        window.localStorage.setItem(MENU_LOCALE_STORAGE_KEY, nextLocale);
      } catch {
        // The in-memory selection is enough for this session.
      }
    }

    writeLocaleToUrl(nextLocale);
  }

  function toggleLanguageSheet() {
    if (isComparisonPreview) return;
    setActiveSheet((currentSheet) =>
      currentSheet === "language" ? null : "language"
    );
  }

  function scrollPhonePreviewToTop() {
    const scrollTargets = getPhonePreviewScrollTargets();
    if (scrollTargets.length === 0) return;

    requestAnimationFrame(() => {
      scrollTargets.forEach((scrollTarget) => {
        scrollTarget.scrollTo({
          top: 0,
          behavior: "auto"
        });
      });
    });
  }

  function openDishInPhonePreview(dish: PublicMenuDish) {
    if (displayMode !== "phone-preview") return;

    phonePreviewScrollParentRef.current = getPhonePreviewScrollParent();
    setActiveSheet(null);
    setActiveDish(dish);
    scrollPhonePreviewToTop();
  }

  function closeDishInPhonePreview() {
    setActiveDish(null);
    scrollPhonePreviewToTop();
  }

  const phonePreviewDishSelect =
    displayMode === "phone-preview" ? openDishInPhonePreview : undefined;
  const currentLanguage =
    languageOptions.find((option) => option.id === selectedLocale) ??
    languageOptions[0] ?? {
      id: selectedLocale,
      label: selectedLocale,
      shortLabel: selectedLocale
    };
  const prefersReducedMotion = usePrefersReducedMotion();
  const textDirection = getMaisonElyseTextDirection(selectedLocale);
  const sheetPresence = useTransitionPresence(activeSheet, {
    durationMs: SHEET_MOTION_MS,
    disabled: prefersReducedMotion
  });
  const renderedSheet = sheetPresence.value;
  const sheetMotionState = sheetPresence.state;
  const activeSheetLabel =
    renderedSheet === "language"
      ? copy.languageDialogLabel
      : renderedSheet === "menu"
        ? copy.menuDialogLabel
        : copy.filterDialogLabel;
  const activeSheetKicker =
    renderedSheet === "menu" ? copy.sheetNavigation : copy.preferences;

  function renderLanguageToggle(className = "") {
    return (
      <button
        aria-expanded={activeSheet === "language"}
        aria-label={`${copy.languageToggleAria} (${currentLanguage.label})`}
        className={`${styles.languageToggle} ${className}`}
        disabled={isComparisonPreview}
        onClick={toggleLanguageSheet}
        type="button"
      >
        {currentLanguage.shortLabel}
      </button>
    );
  }

  function renderGoogleReviewCard() {
    if (!showGoogleReview) return null;

    return (
      <GoogleReviewCard
        googleReview={activeMenu.googleReview}
        locale={selectedLocale}
        localizedUiCopy={activeMenu.localizedUiCopy}
        menuId={activeMenu.menuId}
        restaurantId={activeMenu.restaurantId}
        restaurantName={activeMenu.name}
        source={activeMenu.source}
      />
    );
  }

  function renderBottomSheet() {
    if (!renderedSheet) return null;

    return (
      <div
        className={styles.sheetBackdrop}
        data-sheet-state={sheetMotionState}
        onClick={() => setActiveSheet(null)}
      >
        <section
          aria-label={activeSheetLabel}
          aria-modal="true"
          className={styles.bottomSheet}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className={styles.sheetHandle} aria-hidden="true" />
          <div className={styles.sheetHeader}>
            <div>
              <p className={styles.kicker}>{activeSheetKicker}</p>
              <h3>{activeSheetLabel}</h3>
            </div>
            <button type="button" onClick={() => setActiveSheet(null)}>
              {copy.close}
            </button>
          </div>

          {renderedSheet === "menu" ? (
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
                    aria-pressed={activeCategory === category.id}
                    className={
                      activeCategory === category.id
                        ? styles.isActive
                        : undefined
                    }
                    key={category.id}
                    type="button"
                    onClick={() => openCategoryInFullMenu(category.id)}
                  >
                    <span>{displayCategoryLabel(category.label, selectedLocale)}</span>
                  </button>
                );
              })}
            </div>
          ) : renderedSheet === "language" ? (
            <div className={styles.sheetList}>
              {languageOptions.map((option) => (
                <button
                  aria-pressed={selectedLocale === option.id}
                  className={
                    selectedLocale === option.id ? styles.isActive : undefined
                  }
                  key={option.id}
                  onClick={() => selectLanguage(option.id)}
                  type="button"
                >
                  <span>{option.label}</span>
                  <small>{option.shortLabel}</small>
                </button>
              ))}
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
    );
  }

  const MenuRoot = displayMode === "public" ? "main" : "div";

  if (displayMode === "phone-preview" && activeDish) {
    return (
      <PhonePreviewDishDetail
        dish={activeDish}
        displayMode="phone-preview"
        locale={selectedLocale}
        menu={activeMenu}
        config={config}
        onBackToMenu={closeDishInPhonePreview}
        query={activeQuery}
      />
    );
  }

  return (
    <MenuRoot
      className={`${styles.page} ${styles.isMenuMode} ${
        isEmbeddedPreview ? styles.phonePreview : ""
      } ${isComparisonPreview ? styles.comparisonPreview : ""}`}
      data-display-mode={displayMode}
      data-menu-ui="maison-elyse"
      data-public-menu-renderer="maison-elyse"
      lang={selectedLocale}
      dir="ltr"
      data-text-direction={textDirection}
      style={maisonElyseThemeStyle(config)}
    >
      <section className={styles.sections} ref={menuRef} aria-label={copy.sections}>
        <section className={styles.menuPanel} aria-labelledby="active-category-heading">
            <div
              className={styles.menuScrollArea}
              ref={menuScrollAreaRef}
              onScroll={displayMode === "phone-preview" ? updateBackToTopVisibility : undefined}
            >
              <div
                className={styles.menuCover}
                style={
                  menuHeroImage
                    ? ({ "--menu-hero-image": `url("${menuHeroImage}")` } as CSSProperties)
                    : undefined
                }
              >
                <div className={styles.menuCoverTopbar}>
                  <span className={styles.menuRestaurantName}>{restaurantDisplayName}</span>
                  <div className={styles.menuTopbarActions}>
                    {renderLanguageToggle()}
                    <button
                      aria-label={copy.menuToggleAria}
                      className={styles.menuButton}
                      type="button"
                      disabled={isComparisonPreview}
                      onClick={() => {
                        if (!isComparisonPreview) setActiveSheet("menu");
                      }}
                    >
                      <span aria-hidden="true" />
                      <span aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className={styles.menuCoverCopy} dir={textDirection}>
                  <p className={styles.kicker}>{copy.collectionKicker}</p>
                  <h2 id="active-category-heading">{copy.collectionTitle}</h2>
                  <span aria-hidden="true" />
                  <p>{copy.collectionBody}</p>
                </div>
              </div>

              {hasActiveFilter ? (
                <div className={styles.activeFilterNotice} role="status">
                  <span dir={textDirection}>
                    {copy.activeFilterPrefix} : {getFilterLabel(activeFilter, selectedLocale)}
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
                        disableNavigation={isComparisonPreview}
                        dishes={section.dishes}
                        key={section.id}
                        locale={selectedLocale}
                        menu={activeMenu}
                        onSelectDish={phonePreviewDishSelect}
                        query={activeQuery}
                        title={section.label}
                      />
                    ))}
                  </div>
                ) : (
                  <DishSection
                    disableNavigation={isComparisonPreview}
                    dishes={visibleDishes}
                    locale={selectedLocale}
                    menu={activeMenu}
                    onSelectDish={phonePreviewDishSelect}
                    query={activeQuery}
                    title={activeCategoryLabel}
                  />
                )
              ) : (
                <div className={styles.empty} role="status" dir={textDirection}>
                  <p>{copy.emptySelection}</p>
                  <button type="button" onClick={showAll}>
                    {copy.allMenu}
                  </button>
                </div>
              )}
              {renderGoogleReviewCard()}
            </div>

            <nav className={styles.bottomBar} aria-label={copy.navAria}>
              <button
                aria-expanded={activeSheet === "menu"}
                disabled={isComparisonPreview}
                type="button"
                onClick={() => {
                  if (isComparisonPreview) return;
                  setActiveSheet((currentSheet) =>
                    currentSheet === "menu" ? null : "menu"
                  );
                }}
              >
                {copy.bottomMenu}
              </button>
              <button
                aria-expanded={activeSheet === "filter"}
                disabled={isComparisonPreview}
                type="button"
                onClick={() => {
                  if (isComparisonPreview) return;
                  setActiveSheet((currentSheet) =>
                    currentSheet === "filter" ? null : "filter"
                  );
                }}
              >
                {copy.bottomFilter}
              </button>
            </nav>

        </section>
      </section>
      <button
        aria-hidden={!showBackToTop}
        aria-label={copy.backToTop}
        className={styles.backToTop}
        data-back-to-top="true"
        data-visible={showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
        title={copy.backToTop}
        type="button"
        onClick={scrollToTop}
      >
        <BackToTopIcon />
      </button>
      {renderBottomSheet()}
    </MenuRoot>
  );
}
