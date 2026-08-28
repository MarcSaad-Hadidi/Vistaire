"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import { GoogleReviewCard } from "@/components/menu/GoogleReviewCard";
import { trackPublicMenuEvent } from "@/lib/analytics/client";
import {
  isCurrencyConversionAvailable,
  type MenuExchangeRates
} from "@/lib/currency/formatMenuPrice";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
import {
  normalizePublicMenuLocale,
  type PublicMenuLocale
} from "@/lib/menu/publicMenuSettings";
import {
  getMaisonElyseCategoryEditorial,
  getMaisonElyseCategoryKind,
  getMaisonElyseCategoryLabel,
  getMaisonElyseEditorialCopy,
  getMaisonElyseLanguageOptions,
  getMaisonElyseTextDirection,
  resolveMaisonElyseCategoryDescription,
  resolveMaisonElyseCopy,
  resolveMaisonElyseLocalizedMenu,
  type MaisonElyseLanguageOption
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
  getPublicDishImageUrl,
  getPublicMenuCategoryGroups,
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuCategory,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import type { MenuUiConfig } from "@/lib/menu/menuUiConfig";
import {
  TROUVABLE_CURRENCY_STORAGE_KEY,
  formatTrouvableDishPrice,
  getTrouvableCurrencyOption,
  getTrouvableCurrencyOptionLabel,
  getTrouvableCurrencyOptions,
  normalizeTrouvableCurrency,
  type TrouvableCurrency
} from "./trouvableMenuControls";
import styles from "./MaisonElyseQrMenu.module.css";

const loadPhonePreviewDishDetail = () =>
  import("@/components/menu/MaisonElyseDishDetail").then(
    (mod) => mod.MaisonElyseDishDetail
  );

function createPhonePreviewDishDetail(loadingText: string) {
  return dynamic(loadPhonePreviewDishDetail, {
    ssr: false,
    loading: () => (
      <div className={styles.detailLoading} role="status" aria-live="polite">
        {loadingText}
      </div>
    )
  });
}

const PHONE_PREVIEW_DISH_DETAILS = {
  fr: createPhonePreviewDishDetail("Chargement de la fiche..."),
  en: createPhonePreviewDishDetail("Loading dish details..."),
  es: createPhonePreviewDishDetail("Cargando los detalles del plato..."),
  it: createPhonePreviewDishDetail("Caricamento dei dettagli del piatto..."),
  de: createPhonePreviewDishDetail("Gerichtdetails werden geladen..."),
  el: createPhonePreviewDishDetail("Φόρτωση λεπτομερειών πιάτου..."),
  ar: createPhonePreviewDishDetail("جارٍ تحميل تفاصيل الطبق...")
} as const;

const ALLOWED_3D_CDN_ORIGINS = (process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "")
  .split(/[,\s]+/)
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

type MaisonElyseQrMenuProps = {
  menu: PublicMenu;
  exchangeRates?: MenuExchangeRates;
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

type SheetId = "menu" | "filter" | "language" | "currency" | null;

const ALL_CATEGORY_ID = "all";
// Kept slightly above the CSS sheet animation duration so the exit finishes before unmount.
const SHEET_MOTION_MS = 260;
const MENU_LOCALE_STORAGE_KEY = "vistaire:maison-elyse-menu-locale";
const ALLERGEN_FILTER_LABELS = Object.fromEntries(
  ALLERGEN_FILTERS.map((filter) => [filter.id, filter.labels])
) as unknown as Record<AllergenFilterId, Record<string, string>>;
const FILTER_OPTIONS: Array<{ id: FilterId; labels: Record<string, string> }> = [
  { id: "signature", labels: {} },
  { id: "recommended", labels: {} },
  { id: "immersive", labels: {} },
  { id: "available", labels: {} },
  ...ALLERGEN_FILTERS.map((filter) => ({
    id: filter.id as AllergenFilterId,
    labels: ALLERGEN_FILTER_LABELS[filter.id]
  }))
];
const BACK_TO_TOP_SCROLL_THRESHOLD = 520;

type MaisonMenuCopy = {
  activeFilterPrefix: string;
  allMenu: string;
  apply: string;
  backToTop: string;
  badgesAria: string;
  bottomFilter: string;
  bottomMenu: string;
  close: string;
  collectionBody: string;
  collectionKicker: string;
  collectionTitle: string;
  currencyDialogLabel: string;
  currencyKicker: string;
  currencyToggleAria: string;
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
  recommendation: string;
  reset: string;
  resetFilters: string;
  signature: string;
  immersiveFilterLabel: string;
  available: string;
  sections: string;
  sheetNavigation: string;
  unavailableBadge: string;
};

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
  const resolved = resolveMaisonElyseCopy(locale, localizedUiCopy).copy;
  const editorial = getMaisonElyseEditorialCopy(locale);
  return {
    activeFilterPrefix: resolved.activeFilterPrefix,
    allMenu: editorial.allMenu,
    apply: resolved.filterApply,
    backToTop: resolved.backToTop,
    badgesAria: resolved.tags,
    bottomFilter: resolved.filterButton,
    bottomMenu: editorial.bottomMenu,
    close: resolved.close,
    collectionBody: editorial.collectionBody,
    collectionKicker: editorial.collectionKicker,
    collectionTitle: editorial.collectionTitle,
    currencyDialogLabel: resolved.currencyTitle,
    currencyKicker: resolved.currencyKicker,
    currencyToggleAria: resolved.currencyAria,
    dishDetails: resolved.viewDetails,
    emptySelection: resolved.noResultsTitle,
    filterDialogLabel: editorial.filterDialogLabel,
    filterFallback: resolved.filterFallback,
    filterGroupLabel: resolved.filterGroupLabel,
    languageDialogLabel: resolved.languageTitle,
    languageToggleAria: resolved.languageAria,
    menuDialogLabel: editorial.menuDialogLabel,
    menuToggleAria: editorial.menuToggleAria,
    navAria: editorial.navAria,
    preferences: resolved.languageKicker,
    recommendation: resolved.recommendation,
    reset: resolved.reset,
    resetFilters: resolved.resetFilters,
    signature: resolved.signature,
    immersiveFilterLabel: resolved.immersiveFilterLabel,
    available: resolved.available,
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

function displayCategoryLabel(
  category: Pick<PublicMenuCategory, "label" | "slug">,
  locale: PublicMenuLocale = "fr-CA"
): string {
  return getMaisonElyseCategoryLabel(category, locale);
}

function sectionDomId(category: Pick<PublicMenuCategory, "id" | "slug">): string {
  const stableIdentity = category.id.trim() || category.slug?.trim() || "category";
  return `section-${encodeURIComponent(stableIdentity)}`;
}

function categoryEditorial(
  category: Pick<PublicMenuCategory, "label" | "slug">,
  locale: PublicMenuLocale = "fr-CA"
): {
  kicker: string;
  title: string;
  description: string;
} {
  return getMaisonElyseCategoryEditorial(category, locale);
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

function getFilterLabel(
  filter: FilterId,
  locale: PublicMenuLocale,
  copy: MaisonMenuCopy
): string {
  if (filter === "all") return copy.allMenu;
  const localizedLabels: Partial<Record<FilterId, string>> = {
    signature: copy.signature,
    recommended: copy.recommendation,
    immersive: copy.immersiveFilterLabel,
    available: copy.available
  };
  if (localizedLabels[filter]) return localizedLabels[filter] as string;
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

function getStoredMenuCurrency(
  settings: PublicMenu["settings"]
): TrouvableCurrency | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(TROUVABLE_CURRENCY_STORAGE_KEY);
    return stored ? normalizeTrouvableCurrency(stored, settings) : null;
  } catch {
    return null;
  }
}

function categoryRank(category: Pick<PublicMenuCategory, "label" | "slug">): number {
  const categoryKind = getMaisonElyseCategoryKind(category);
  if (categoryKind === "starter") return 0;
  if (categoryKind === "signature") return 1;
  if (categoryKind === "dessert") return 2;
  if (categoryKind === "cocktail" || categoryKind === "drink") return 3;
  return 99;
}

function categorySort(a: PublicMenuCategory, b: PublicMenuCategory): number {
  return categoryRank(a) - categoryRank(b);
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
  if (dish.isSignature) return true;
  if (
    getMaisonElyseCategoryKind({
      label: dish.category,
      slug: dish.categorySlug
    }) === "signature"
  ) {
    return true;
  }
  return dish.tags.some((tag) => normalizeText(tag).includes("signature"));
}

function isRecommendedDish(dish: PublicMenuDish): boolean {
  if (dish.isRecommended) return true;
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

function dishBadges(dish: PublicMenuDish, copy: MaisonMenuCopy): string[] {
  const badges: string[] = [];
  if (isSignatureDish(dish)) badges.push(copy.signature);
  if (isRecommendedDish(dish)) badges.push(copy.recommendation);
  if (hasReal3d(dish)) badges.push("3D");
  if (hasRealAr(dish)) badges.push("AR");
  if (!dish.available) badges.push(copy.unavailableBadge);
  return Array.from(new Set(badges)).slice(0, 4);
}

export function MaisonElyseDishCard({
  copy,
  currency,
  disableNavigation = false,
  dish,
  exchangeRates,
  locale,
  menu,
  onSelectDish,
  query
}: {
  copy: MaisonMenuCopy;
  currency: TrouvableCurrency;
  disableNavigation?: boolean;
  dish: PublicMenuDish;
  exchangeRates?: MenuExchangeRates;
  locale: PublicMenuLocale;
  menu: PublicMenu;
  onSelectDish?: (dish: PublicMenuDish) => void;
  query?: PublicMenuContextQuery;
}) {
  const badges = dishBadges(dish, copy);
  const textDirection = getMaisonElyseTextDirection(locale);
  const priceLabel = formatTrouvableDishPrice(
    dish,
    currency,
    locale,
    exchangeRates
  );
  const href = buildPublicDishPath(menu.slug, dish.slug, query);
  const ariaLabel = `${dish.name}. ${priceLabel || ""} ${copy.dishDetails}`;
  const content = (
    <>
      <span className={styles.dishImage} aria-hidden="true">
        {dish.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" src={getPublicDishImageUrl(dish, "thumbnail")} alt="" />
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
          <span className={styles.badges} aria-label={`${copy.badgesAria}: ${badges.join(", ")}`}>
            {badges.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </span>
        ) : null}
        {priceLabel ? (
          <strong className={styles.dishPrice}>{priceLabel}</strong>
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
  category,
  copy,
  currency,
  descriptionDishes,
  disableNavigation = false,
  dishes,
  exchangeRates,
  locale,
  menu,
  onSelectDish,
  query
}: {
  category: PublicMenuCategory;
  copy: MaisonMenuCopy;
  currency: TrouvableCurrency;
  descriptionDishes: PublicMenuDish[];
  disableNavigation?: boolean;
  dishes: PublicMenuDish[];
  exchangeRates?: MenuExchangeRates;
  locale: PublicMenuLocale;
  menu: PublicMenu;
  onSelectDish?: (dish: PublicMenuDish) => void;
  query?: PublicMenuContextQuery;
}) {
  const sectionId = sectionDomId(category);
  const headingId = `${sectionId}-heading`;
  const editorial = personalizeBranding(
    categoryEditorial(category, locale),
    menu.name
  );
  const description = resolveMaisonElyseCategoryDescription(
    descriptionDishes,
    editorial.description
  );
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
          <p>{description}</p>
        </div>
      </div>
      <ul className={styles.dishList}>
        {dishes.map((dish) => (
          <MaisonElyseDishCard
            copy={copy}
            currency={currency}
            disableNavigation={disableNavigation}
            dish={dish}
            exchangeRates={exchangeRates}
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
  exchangeRates,
  locale = "fr-CA",
  localizedMenus,
  config,
  menu,
  query,
  showGoogleReview = true
}: MaisonElyseQrMenuProps) {
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
  const localeResolution = useMemo(
    () =>
      resolveMaisonElyseLocalizedMenu({
        fallbackLocale: propLocale,
        fallbackMenu: menu,
        localizedMenus: localizedMenus as
          | Partial<Record<PublicMenuLocale, PublicMenu>>
          | undefined,
        requestedLocale: selectedLocale
      }),
    [localizedMenus, menu, propLocale, selectedLocale]
  );
  const activeLocale = localeResolution.locale;
  const activeMenu = localeResolution.menu;
  const queryCurrency = query?.currency?.toString().trim()
    ? normalizeTrouvableCurrency(query.currency, activeMenu.settings)
    : null;
  const [selectedCurrency, setSelectedCurrency] = useState<TrouvableCurrency>(
    () => queryCurrency ?? normalizeTrouvableCurrency(undefined, menu.settings)
  );
  const [shouldPersistCurrencyInLinks, setShouldPersistCurrencyInLinks] =
    useState(() => Boolean(queryCurrency));
  const restaurantDisplayName = activeMenu.name.trim() || "Restaurant";
  const menuOpenedTrackedRef = useRef(false);
  useEffect(() => {
    if (displayMode !== "public" || menuOpenedTrackedRef.current) return;
    menuOpenedTrackedRef.current = true;
    trackPublicMenuEvent(activeMenu, { eventName: "menu_opened" });
  }, [activeMenu, displayMode]);
  const copy = useMemo(
    () =>
      personalizeBranding(
        buildMaisonMenuCopy(activeLocale, activeMenu.localizedUiCopy),
        restaurantDisplayName
      ),
    [activeLocale, activeMenu.localizedUiCopy, restaurantDisplayName]
  );
  const languageOptions = useMemo<MaisonElyseLanguageOption[]>(
    () =>
      getMaisonElyseLanguageOptions(
        activeMenu.settings,
        activeMenu.translationLocales
      ),
    [activeMenu.settings, activeMenu.translationLocales]
  );
  const currencyOptions = useMemo(
    () => getTrouvableCurrencyOptions(activeMenu.settings),
    [activeMenu.settings]
  );
  const availableCurrencyOptions = useMemo(() => {
    const pricedDishes = activeMenu.dishes.filter(
      (dish) => Number.isFinite(dish.priceCents) && dish.priceCents > 0
    );
    const currencySources =
      pricedDishes.length > 0
        ? pricedDishes
        : [
            {
              priceCurrency: activeMenu.settings.baseCurrency,
              baseCurrency: activeMenu.settings.baseCurrency
            }
          ];

    return currencyOptions.filter((option) =>
      currencySources.every((dish) =>
        isCurrencyConversionAvailable({
          sourceCurrency:
            dish.priceCurrency || activeMenu.settings.baseCurrency,
          targetCurrency: option.code,
          baseCurrency:
            exchangeRates?.base ??
            dish.baseCurrency ??
            activeMenu.settings.baseCurrency,
          rates: exchangeRates?.rates
        })
      )
    );
  }, [activeMenu.dishes, activeMenu.settings.baseCurrency, currencyOptions, exchangeRates]);
  const normalizedSelectedCurrency = normalizeTrouvableCurrency(
    selectedCurrency,
    activeMenu.settings
  );
  const defaultCurrency = normalizeTrouvableCurrency(
    undefined,
    activeMenu.settings
  );
  const activeCurrency =
    availableCurrencyOptions.find(
      (option) => option.code === normalizedSelectedCurrency
    )?.code ??
    availableCurrencyOptions.find((option) => option.code === defaultCurrency)
      ?.code ??
    availableCurrencyOptions[0]?.code ??
    defaultCurrency;
  const canChangeCurrency =
    activeMenu.settings.allowCurrencySelector &&
    availableCurrencyOptions.length > 1;
  const activeQuery = useMemo(() => {
    const nextQuery: PublicMenuContextQuery = { ...(query ?? {}) };
    if (shouldPersistLocaleInLinks) nextQuery.lang = activeLocale;
    if (shouldPersistCurrencyInLinks) nextQuery.currency = activeCurrency;
    return nextQuery;
  }, [
    activeCurrency,
    activeLocale,
    query,
    shouldPersistCurrencyInLinks,
    shouldPersistLocaleInLinks
  ]);
  const filterOptions = useMemo(
    () =>
      FILTER_OPTIONS.map((option) => ({
        id: option.id,
        label:
          option.id === "signature"
            ? copy.signature
            : option.id === "recommended"
              ? copy.recommendation
              : option.id === "immersive"
                ? copy.immersiveFilterLabel
                : option.id === "available"
                  ? copy.available
                  : option.labels[localeLanguage(activeLocale)] ??
                    option.labels.fr ??
                    option.labels.en ??
                    ""
      })),
    [activeLocale, copy]
  );
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY_ID);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [activeSheet, setActiveSheet] = useState<SheetId>(null);
  const [activeDish, setActiveDish] = useState<PublicMenuDish | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const isEmbeddedPreview = displayMode !== "public";
  const isComparisonPreview = displayMode === "comparison-preview";
  const menuRef = useRef<HTMLElement | null>(null);
  const menuScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const sheetDialogRef = useRef<HTMLElement | null>(null);
  const sheetTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveSheetRef = useRef<SheetId>(null);
  const phonePreviewScrollParentRef = useRef<HTMLElement | null>(null);
  const phonePreviewAutoScrollCompleteRef = useRef(false);
  const skipNextPhonePreviewAutoScrollRef = useRef(false);
  const manualLocaleRef = useRef<PublicMenuLocale | null>(null);
  const lastSeenQueryLocaleRef = useRef<PublicMenuLocale | null>(queryLocale);
  const sheetDialogId = useId();
  const sheetHeadingId = `${sheetDialogId}-heading`;
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
        const descriptionDishes = groups.get(category.id) ?? [];
        const dishes = descriptionDishes.filter((dish) =>
          dishMatchesFilter(dish, activeFilter)
        );

        return {
          category,
          descriptionDishes,
          dishes
        };
      })
      .filter((section) => section.dishes.length > 0);
  }, [activeCategory, activeFilter, categories, groups]);
  const selectedCategory = categories.find(
    (category) => category.id === activeCategory
  );
  const hasActiveFilter = activeFilter !== "all";

  const resetLocaleDependentUi = useCallback(() => {
    setActiveSheet(null);
    setActiveFilter("all");
    setPendingSectionId(null);
    setActiveDish(null);
    setActiveCategory((currentCategory) =>
      currentCategory && currentCategory !== ALL_CATEGORY_ID
        ? ALL_CATEGORY_ID
        : currentCategory
    );
  }, []);

  const applyExplicitLocale = useCallback(
    (nextLocale: PublicMenuLocale) => {
      const resolved = resolveMaisonElyseLocalizedMenu({
        fallbackLocale: propLocale,
        fallbackMenu: menu,
        localizedMenus: localizedMenus as
          | Partial<Record<PublicMenuLocale, PublicMenu>>
          | undefined,
        requestedLocale: nextLocale
      });
      manualLocaleRef.current = null;
      lastSeenQueryLocaleRef.current = nextLocale;
      try {
        window.localStorage.setItem(MENU_LOCALE_STORAGE_KEY, resolved.locale);
      } catch {
        // The explicit URL remains authoritative when storage is unavailable.
      }
      setShouldPersistLocaleInLinks(true);
      setSelectedLocale(resolved.locale);
      resetLocaleDependentUi();
    },
    [localizedMenus, menu, propLocale, resetLocaleDependentUi]
  );

  useEffect(() => {
    if (displayMode !== "public") return;
    const frameId = window.requestAnimationFrame(() => {
      const manualLocale = manualLocaleRef.current;
      if (
        queryLocale &&
        lastSeenQueryLocaleRef.current !== queryLocale
      ) {
        applyExplicitLocale(queryLocale);
        return;
      }

      // React can briefly retain the previous query prop after the native
      // history update. Only a newly observed explicit locale may override the choice.
      if (manualLocale) return;
      if (queryLocale) {
        try {
          window.localStorage.setItem(MENU_LOCALE_STORAGE_KEY, activeLocale);
        } catch {
          // The explicit URL remains authoritative when storage is unavailable.
        }
        return;
      }

      lastSeenQueryLocaleRef.current = null;
      const storedLocale = getStoredMenuLocale();
      if (!storedLocale) return;
      const resolvedStored = resolveMaisonElyseLocalizedMenu({
        fallbackLocale: propLocale,
        fallbackMenu: menu,
        localizedMenus: localizedMenus as
          | Partial<Record<PublicMenuLocale, PublicMenu>>
          | undefined,
        requestedLocale: storedLocale
      });
      if (resolvedStored.locale === propLocale) return;
      setSelectedLocale(resolvedStored.locale);
      setShouldPersistLocaleInLinks(true);
      resetLocaleDependentUi();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    applyExplicitLocale,
    activeLocale,
    displayMode,
    localizedMenus,
    menu,
    propLocale,
    queryLocale,
    resetLocaleDependentUi
  ]);

  useEffect(() => {
    if (displayMode !== "public" || queryCurrency) return;
    const frameId = window.requestAnimationFrame(() => {
      const storedCurrency = getStoredMenuCurrency(activeMenu.settings);
      if (!storedCurrency) return;
      const resolvedStoredCurrency =
        availableCurrencyOptions.find(
          (option) => option.code === storedCurrency
        )?.code ?? activeCurrency;
      if (resolvedStoredCurrency !== storedCurrency) {
        try {
          window.localStorage.setItem(
            TROUVABLE_CURRENCY_STORAGE_KEY,
            resolvedStoredCurrency
          );
        } catch {
          // The sanitized in-memory fallback remains authoritative for this session.
        }
      }
      if (resolvedStoredCurrency === activeCurrency) {
        if (storedCurrency !== activeCurrency) {
          setShouldPersistCurrencyInLinks(true);
        }
        return;
      }
      setSelectedCurrency(resolvedStoredCurrency);
      setShouldPersistCurrencyInLinks(true);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeCurrency,
    activeMenu.settings,
    availableCurrencyOptions,
    displayMode,
    queryCurrency
  ]);

  useEffect(() => {
    if (displayMode !== "public") return;

    const handleHistoryNavigation = () => {
      const currentUrl = new URL(window.location.href);
      const rawLocale = currentUrl.searchParams.get("lang");
      if (!rawLocale?.trim()) {
        manualLocaleRef.current = null;
        lastSeenQueryLocaleRef.current = null;
      } else {
        applyExplicitLocale(normalizePublicMenuLocale(rawLocale));
      }

      const rawCurrency = currentUrl.searchParams.get("currency");
      const requestedCurrency = rawCurrency?.trim()
        ? normalizeTrouvableCurrency(rawCurrency, activeMenu.settings)
        : getStoredMenuCurrency(activeMenu.settings);
      const resolvedCurrency = requestedCurrency
        ? availableCurrencyOptions.find(
            (option) => option.code === requestedCurrency
          )?.code ?? activeCurrency
        : activeCurrency;
      setSelectedCurrency(resolvedCurrency);
      setShouldPersistCurrencyInLinks(Boolean(requestedCurrency));
    };

    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, [
    activeCurrency,
    activeMenu.settings,
    applyExplicitLocale,
    availableCurrencyOptions,
    displayMode
  ]);

  useEffect(() => {
    if (displayMode !== "public") return;
    if (queryLocale) return;
    if (activeLocale === propLocale) return;

    const frameId = window.requestAnimationFrame(() => {
      try {
        window.localStorage.setItem(MENU_LOCALE_STORAGE_KEY, activeLocale);
      } catch {
        // The in-memory selection is enough for this session.
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeLocale, displayMode, propLocale, queryLocale]);

  useEffect(() => {
    const previousSheet = previousActiveSheetRef.current;
    previousActiveSheetRef.current = activeSheet;

    if (activeSheet) {
      const frameId = window.requestAnimationFrame(() => {
        const focusable = sheetDialogRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (previousSheet) {
      const frameId = window.requestAnimationFrame(() => {
        sheetTriggerRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(frameId);
    }
  }, [activeSheet]);

  useEffect(() => {
    if (activeCategory !== ALL_CATEGORY_ID || !pendingSectionId) return;

    const frameId = window.requestAnimationFrame(() => {
      const pendingCategory = categories.find(
        (category) => category.id === pendingSectionId
      );
      if (!pendingCategory) {
        setPendingSectionId(null);
        return;
      }
      const sectionId = sectionDomId(pendingCategory);
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
      setPendingSectionId(null);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeCategory,
    categories,
    getPhonePreviewScrollTarget,
    isEmbeddedPreview,
    pendingSectionId
  ]);

  useEffect(() => {
    if (displayMode !== "phone-preview" || pendingSectionId) {
      return;
    }

    if (skipNextPhonePreviewAutoScrollRef.current) {
      skipNextPhonePreviewAutoScrollRef.current = false;
      return;
    }

    // The first render can settle more than once while the server-provided
    // localized menu hydrates. Once the preview has been positioned, later
    // data/copy updates must not pull a user's scroll position back down.
    if (phonePreviewAutoScrollCompleteRef.current) return;

    const frameId = window.requestAnimationFrame(() => {
      const scrollTarget = getPhonePreviewScrollTarget();
      if (!scrollTarget) return;

      // Respect an interaction that happened before the deferred positioning
      // frame ran (for example while localized data was hydrating).
      if (scrollTarget.scrollTop > 0) {
        phonePreviewAutoScrollCompleteRef.current = true;
        return;
      }

      scrollTarget.scrollTop = 0;

      const firstDish = scrollTarget.querySelector<HTMLElement>('[data-dish-card="true"]');
      if (!firstDish) return;

      phonePreviewAutoScrollCompleteRef.current = true;

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
    pendingSectionId,
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
    setPendingSectionId(null);
    scrollToMenu();
  }

  function openCategoryInFullMenu(categoryId: string) {
    skipNextPhonePreviewAutoScrollRef.current = isEmbeddedPreview;
    setPendingSectionId(categoryId);
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
    window.history.replaceState(
      window.history.state,
      "",
      `${currentUrl.pathname}?${currentUrl.searchParams.toString()}${currentUrl.hash}`
    );
  }

  function writeCurrencyToUrl(nextCurrency: TrouvableCurrency) {
    if (displayMode !== "public") return;
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("currency", nextCurrency);
    window.history.replaceState(
      window.history.state,
      "",
      `${currentUrl.pathname}?${currentUrl.searchParams.toString()}${currentUrl.hash}`
    );
  }

  function selectLanguage(nextLocale: PublicMenuLocale) {
    const resolved = resolveMaisonElyseLocalizedMenu({
      fallbackLocale: propLocale,
      fallbackMenu: menu,
      localizedMenus: localizedMenus as
        | Partial<Record<PublicMenuLocale, PublicMenu>>
        | undefined,
      requestedLocale: nextLocale
    });
    manualLocaleRef.current = resolved.locale;
    setSelectedLocale(resolved.locale);
    setShouldPersistLocaleInLinks(true);
    resetLocaleDependentUi();
    if (displayMode === "phone-preview") {
      scrollPhonePreviewToTop();
    }

    if (displayMode === "public") {
      try {
        window.localStorage.setItem(MENU_LOCALE_STORAGE_KEY, resolved.locale);
      } catch {
        // The in-memory selection is enough for this session.
      }
    }

    writeLocaleToUrl(resolved.locale);
  }

  function selectCurrency(nextCurrency: TrouvableCurrency) {
    if (
      !availableCurrencyOptions.some((option) => option.code === nextCurrency)
    ) {
      return;
    }
    const normalized = normalizeTrouvableCurrency(
      nextCurrency,
      activeMenu.settings
    );
    setSelectedCurrency(normalized);
    setShouldPersistCurrencyInLinks(true);
    setActiveSheet(null);
    if (displayMode === "public") {
      try {
        window.localStorage.setItem(
          TROUVABLE_CURRENCY_STORAGE_KEY,
          normalized
        );
      } catch {
        // The in-memory selection is enough for this session.
      }
    }
    writeCurrencyToUrl(normalized);
  }

  function toggleSheet(sheet: Exclude<SheetId, null>, trigger: HTMLButtonElement) {
    if (isComparisonPreview) return;
    setActiveSheet((currentSheet) => {
      if (currentSheet === sheet) return null;
      sheetTriggerRef.current = trigger;
      return sheet;
    });
  }

  function handleSheetKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setActiveSheet(null);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function toggleLanguageSheet(trigger: HTMLButtonElement) {
    if (isComparisonPreview) return;
    toggleSheet("language", trigger);
  }

  function toggleCurrencySheet(trigger: HTMLButtonElement) {
    if (isComparisonPreview || !canChangeCurrency) return;
    toggleSheet("currency", trigger);
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
    languageOptions.find((option) => option.id === activeLocale) ??
    languageOptions[0] ?? {
      id: activeLocale,
      label: activeLocale,
      shortLabel: activeLocale
    };
  const phonePreviewLanguage = localeLanguage(activeLocale);
  const PhonePreviewDishDetail =
    PHONE_PREVIEW_DISH_DETAILS[
      phonePreviewLanguage as keyof typeof PHONE_PREVIEW_DISH_DETAILS
    ] ?? PHONE_PREVIEW_DISH_DETAILS.en;
  const currentCurrency = getTrouvableCurrencyOption(activeCurrency);
  const prefersReducedMotion = usePrefersReducedMotion();
  const textDirection = getMaisonElyseTextDirection(activeLocale);
  const sheetPresence = useTransitionPresence(activeSheet, {
    durationMs: SHEET_MOTION_MS,
    disabled: prefersReducedMotion
  });
  const renderedSheet = sheetPresence.value;
  const sheetMotionState = sheetPresence.state;
  const activeSheetLabel =
    renderedSheet === "language"
      ? copy.languageDialogLabel
      : renderedSheet === "currency"
        ? copy.currencyDialogLabel
        : renderedSheet === "menu"
          ? copy.menuDialogLabel
          : copy.filterDialogLabel;
  const activeSheetKicker =
    renderedSheet === "menu"
      ? copy.sheetNavigation
      : renderedSheet === "currency"
        ? copy.currencyKicker
        : copy.preferences;

  function renderLanguageToggle(className = "") {
    return (
      <button
        aria-controls={sheetDialogId}
        aria-expanded={activeSheet === "language"}
        aria-label={`${copy.languageToggleAria} (${currentLanguage.label})`}
        className={`${styles.languageToggle} ${className}`}
        disabled={isComparisonPreview}
        onClick={(event) => toggleLanguageSheet(event.currentTarget)}
        type="button"
      >
        {currentLanguage.shortLabel}
      </button>
    );
  }

  function renderCurrencyToggle(className = "") {
    const label = getTrouvableCurrencyOptionLabel(
      currentCurrency,
      activeLocale
    );
    return (
      <button
        aria-controls={sheetDialogId}
        aria-expanded={activeSheet === "currency"}
        aria-label={`${copy.currencyToggleAria} (${label})`}
        className={`${styles.languageToggle} ${className}`}
        disabled={isComparisonPreview || !canChangeCurrency}
        onClick={(event) => toggleCurrencySheet(event.currentTarget)}
        type="button"
      >
        {currentCurrency.code}
      </button>
    );
  }

  function renderGoogleReviewCard() {
    if (!showGoogleReview) return null;

    return (
      <GoogleReviewCard
        googleReview={activeMenu.googleReview}
        locale={activeLocale}
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
          aria-labelledby={sheetHeadingId}
          aria-modal="true"
          className={styles.bottomSheet}
          dir="ltr"
          id={sheetDialogId}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={handleSheetKeyDown}
          ref={sheetDialogRef}
          role="dialog"
        >
          <div className={styles.sheetHandle} aria-hidden="true" />
          <div className={styles.sheetHeader}>
            <div dir={textDirection}>
              <p className={styles.kicker}>{activeSheetKicker}</p>
              <h3 id={sheetHeadingId}>{activeSheetLabel}</h3>
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
                <span dir={textDirection}>{copy.allMenu}</span>
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
                    <span dir={textDirection}>
                      {displayCategoryLabel(category, activeLocale)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : renderedSheet === "currency" ? (
            <div className={styles.sheetList}>
              {availableCurrencyOptions.map((option) => (
                <button
                  aria-pressed={activeCurrency === option.code}
                  className={
                    activeCurrency === option.code ? styles.isActive : undefined
                  }
                  key={option.code}
                  onClick={() => selectCurrency(option.code)}
                  type="button"
                >
                  <span dir={textDirection}>
                    {getTrouvableCurrencyOptionLabel(option, activeLocale)}
                  </span>
                  <small>{option.code}</small>
                </button>
              ))}
            </div>
          ) : renderedSheet === "language" ? (
            <div className={styles.sheetList}>
              {languageOptions.map((option) => (
                <button
                  aria-pressed={activeLocale === option.id}
                  className={
                    activeLocale === option.id ? styles.isActive : undefined
                  }
                  key={option.id}
                  onClick={() => selectLanguage(option.id)}
                  type="button"
                >
                  <span dir="auto">{option.label}</span>
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
                dir={textDirection}
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
        locale={activeLocale}
        menu={activeMenu}
        config={config}
        currency={activeCurrency}
        exchangeRates={exchangeRates}
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
      lang={activeLocale}
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
                    {renderCurrencyToggle()}
                    {renderLanguageToggle()}
                    <button
                      aria-controls={sheetDialogId}
                      aria-expanded={activeSheet === "menu"}
                      aria-label={copy.menuToggleAria}
                      className={styles.menuButton}
                      type="button"
                      disabled={isComparisonPreview}
                      onClick={(event) => toggleSheet("menu", event.currentTarget)}
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
                    {copy.activeFilterPrefix} : {getFilterLabel(activeFilter, activeLocale, copy)}
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
                        category={section.category}
                        copy={copy}
                        currency={activeCurrency}
                        descriptionDishes={section.descriptionDishes}
                        disableNavigation={isComparisonPreview}
                        dishes={section.dishes}
                        exchangeRates={exchangeRates}
                        key={section.category.id}
                        locale={activeLocale}
                        menu={activeMenu}
                        onSelectDish={phonePreviewDishSelect}
                        query={activeQuery}
                      />
                    ))}
                  </div>
                ) : (
                  selectedCategory ? (
                    <DishSection
                      category={selectedCategory}
                      copy={copy}
                      currency={activeCurrency}
                      descriptionDishes={baseDishes}
                      disableNavigation={isComparisonPreview}
                      dishes={visibleDishes}
                      exchangeRates={exchangeRates}
                      locale={activeLocale}
                      menu={activeMenu}
                      onSelectDish={phonePreviewDishSelect}
                      query={activeQuery}
                    />
                  ) : null
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
                aria-controls={sheetDialogId}
                aria-expanded={activeSheet === "menu"}
                disabled={isComparisonPreview}
                type="button"
                onClick={(event) => toggleSheet("menu", event.currentTarget)}
              >
                {copy.bottomMenu}
              </button>
              <button
                aria-controls={sheetDialogId}
                aria-expanded={activeSheet === "filter"}
                disabled={isComparisonPreview}
                type="button"
                onClick={(event) => toggleSheet("filter", event.currentTarget)}
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
