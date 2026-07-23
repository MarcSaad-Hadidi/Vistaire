"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type PointerEvent
} from "react";
import type {
  ArFallbackReason,
  DishModelViewerProps
} from "@/components/dish/DishModelViewer";
import {
  getPublicMenuAnalyticsContext,
  trackPublicMenuEvent
} from "@/lib/analytics/client";
import { DishCard3dBadge } from "@/components/menu/DishCard3dBadge";
import type { MenuExchangeRates } from "@/lib/currency/formatMenuPrice";
import { hasPublicMenu3d } from "@/lib/menu/hasPublicMenu3d";
import {
  matchesConfirmedFree,
  type AllergenId
} from "@/lib/menu/allergens";
import {
  getTrouvableCategoryIconKindForCategory,
  sortTrouvablePublicMenuCategories
} from "@/lib/menu/trouvableCategoryIcons";
import {
  buildPublicDishPath,
  getGoogleReviewCta,
  getPublicMenuCategoryGroups,
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import type { MenuUiConfig } from "@/lib/menu/menuUiConfig";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { useTransitionPresence } from "@/lib/useTransitionPresence";
import {
  copyTextToClipboard,
  detectArHandoffPlatform,
  type ArHandoffPlatform
} from "@/lib/menu/arBrowserHandoff";
import { TrouvableCategoryIcon } from "./TrouvableCategoryIcon";
import { GoogleReviewCard } from "./GoogleReviewCard";
import { AllergenWarning } from "./AllergenDisclosure";
import { PremiumDishDetailsSheet } from "./PremiumDishDetailsSheet";
import { PremiumDishCardOptionTags } from "./PremiumDishTags";
import { trackGoogleReviewClick } from "./googleReviewTracking";
import { useTrouvableDocumentLanguage } from "./useTrouvableDocumentLanguage";
import {
  getDishSwipeScrollTop,
  resolveDishSwipeGesture
} from "@/lib/menu/dishReviewSwipe";
import {
  TROUVABLE_CURRENCY_STORAGE_KEY,
  TROUVABLE_LOCALE_STORAGE_KEY,
  TROUVABLE_THEME_STORAGE_KEY,
  formatTrouvableDishPrice,
  formatTrouvablePriceCents,
  getTrouvableCurrencyOptions,
  getTrouvableCurrencyOption,
  getTrouvableCurrencyOptionLabel,
  getTrouvableDishConvertedPriceCents,
  getTrouvableGreetingForDate,
  formatTrouvableGreetingLead,
  getTrouvableGreetingPeriodForDate,
  getTrouvableReadyLanguageOptions,
  getTrouvableLanguageShortCode,
  getTrouvableTextDirection,
  normalizeTrouvableCurrency,
  normalizeTrouvableReadyLocaleForSettings,
  normalizeTrouvableTheme,
  resolveTrouvableCopy,
  buildNavigableMenuSections,
  getAdjacentMenuSection,
  type TrouvableCurrency,
  type TrouvableLocale,
  type TrouvableTheme
} from "./trouvableMenuControls";
import styles from "./TrouvablePremiumMenuExperience.module.css";

type TrouvablePremiumMenuExperienceProps = {
  menu: PublicMenu;
  config: MenuUiConfig;
  context?: string;
  exchangeRates: MenuExchangeRates;
  query?: PublicMenuContextQuery;
  typographyClassName?: string;
  displayMode?: "public" | "phone-preview";
};

type QuickFilterId =
  | "all"
  | "veg"
  | "nonVeg"
  | "available"
  | "immersive"
  | "recommended"
  | "glutenFree"
  | "dairyFree"
  | "nutFree"
  | "shellfishFree"
  | "eggFree"
  | "sesameFree"
  | "soyFree"
  | "fishFree";
type ViewMode = "list" | "grid";
type WaiterTopic = "allergen" | "recommendation" | "selection";
type ActiveSheet =
  | "currency"
  | "filters"
  | "language"
  | "experienceReview"
  | "dish"
  | "selection"
  | "waiter"
  | "review"
  | null;
type DishSubSheet = "details" | "review" | null;
type PointerSwipeStart = {
  x: number;
  y: number;
  pointerId: number;
};
type DishSwipeStart = PointerSwipeStart & {
  scrollTop: number;
};
type SelectionItem = {
  dish: PublicMenuDish;
  quantity: number;
};
type DishModelViewerComponent = ComponentType<DishModelViewerProps>;
type ArCopyStatus = "idle" | "copying" | "success" | "error";

const ALL_CATEGORY_ID = "all";
// Kept slightly above the CSS sheet animation duration so the exit finishes before unmount.
const SHEET_MOTION_MS = 260;
const AR_COPY_STATUS_RESET_MS = 4_000;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const MEAT_TERMS = [
  "bacon",
  "beef",
  "boeuf",
  "chicken",
  "crevette",
  "fish",
  "jambon",
  "pork",
  "poisson",
  "porc",
  "poulet",
  "sausage",
  "saucisse",
  "saumon",
  "thon",
  "turkey",
  "viande"
];
const VEG_TERMS = [
  "plant-based",
  "sans viande",
  "vegan",
  "vegane",
  "vege",
  "vegetarian",
  "vegetarien"
];
const TROUVABLE_ALLERGEN_FILTER_IDS: Record<
  Exclude<
    QuickFilterId,
    "all" | "veg" | "nonVeg" | "available" | "immersive" | "recommended"
  >,
  AllergenId
> = {
  glutenFree: "gluten",
  dairyFree: "dairy",
  nutFree: "tree_nuts",
  shellfishFree: "shellfish",
  eggFree: "eggs",
  sesameFree: "sesame",
  soyFree: "soy",
  fishFree: "fish"
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function displayCategoryLabel(label: string): string {
  return label.length > 12 ? `${label.slice(0, 10).trim()}...` : label;
}

function searchableDishText(dish: PublicMenuDish): string {
  return normalizeText(
    [
      dish.name,
      dish.description,
      dish.category,
      dish.houseNote,
      ...dish.tags,
      ...dish.ingredients,
      ...dish.allergens,
      ...dish.options
    ].join(" ")
  );
}

function dishHasAnyTerm(dish: PublicMenuDish, terms: string[]): boolean {
  const text = searchableDishText(dish);
  return terms.some((term) => text.includes(normalizeText(term)));
}

function isVegDish(dish: PublicMenuDish): boolean {
  return dishHasAnyTerm(dish, VEG_TERMS) && !isNonVegDish(dish);
}

function isNonVegDish(dish: PublicMenuDish): boolean {
  return dishHasAnyTerm(dish, MEAT_TERMS);
}

function dishMetaLine(dish: PublicMenuDish, soldOutLabel: string): string {
  return dish.available ? dish.category : soldOutLabel;
}

function isRecommendedDish(dish: PublicMenuDish): boolean {
  if (dish.isSignature || dish.isRecommended) return true;
  const text = searchableDishText(dish);
  return ["signature", "populaire", "popular", "recommande", "recommended"].some(
    (term) => text.includes(term)
  );
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0
  );
}

function isDishSwipeGuardedTarget(
  target: EventTarget | null,
  swipeRoot?: Element
): boolean {
  if (!(target instanceof Element)) return true;
  if (
    target.closest(
      [
        "model-viewer",
        "canvas",
        "button",
        "a",
        "input",
        "select",
        "textarea",
        "[data-no-dish-swipe]"
      ].join(",")
    )
  ) {
    return true;
  }

  const dialogTarget = target.closest(["dialog", "[role='dialog']"].join(","));
  if (!dialogTarget) return false;
  return !(swipeRoot && (dialogTarget === swipeRoot || dialogTarget.contains(swipeRoot)));
}

function isCategorySwipeGuardedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return Boolean(target.closest('[data-no-category-swipe="true"]'));
}

function quickFilterMatches(dish: PublicMenuDish, filter: QuickFilterId): boolean {
  if (filter === "all") return true;
  if (filter === "veg") return isVegDish(dish);
  if (filter === "nonVeg") return isNonVegDish(dish);
  if (filter === "available") return dish.available;
  if (filter === "immersive") return dish.has3d || dish.hasAr || dish.hasImmersive;
  if (filter === "recommended") return isRecommendedDish(dish);
  const allergenId = TROUVABLE_ALLERGEN_FILTER_IDS[
    filter as keyof typeof TROUVABLE_ALLERGEN_FILTER_IDS
  ];
  if (allergenId) return matchesConfirmedFree(dish, allergenId);
  return true;
}

function modelViewerDishFromPublicDish(
  dish: PublicMenuDish
): DishModelViewerProps["dish"] {
  return {
    slug: dish.slug,
    categorySlug: dish.category,
    name: dish.name,
    model3dUrl: dish.model3dUrl,
    webModel3dUrl: dish.webModel3dUrl,
    arModel3dUrl: dish.arModel3dUrl,
    arUsdzUrl: dish.arUsdzUrl || dish.usdzUrl,
    image: dish.imageUrl,
    imageObjectPosition: "center",
    imageObjectPositionDetail: "center"
  };
}

function DishVisual({ dish, menu }: { dish: PublicMenuDish; menu: PublicMenu }) {
  if (dish.imageUrl) {
    return (
      <span className={`${styles.dishVisual} ${styles.hasDishImage}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          loading="lazy"
          src={dish.thumbnailUrl || dish.imageUrl}
        />
      </span>
    );
  }

  return (
    <span className={styles.dishVisual} aria-hidden="true">
      <span>{menu.name.slice(0, 1)}</span>
    </span>
  );
}

function HeroBotanicalOrnament() {
  return (
    <svg
      className={styles.heroBotanical}
      viewBox="0 0 390 190"
      aria-hidden="true"
      focusable="false"
    >
      <g className={styles.botanicalVineLeft}>
        <path
          className={styles.botanicalStem}
          pathLength={1}
          d="M-18 137 C 34 80 78 139 128 112 C 156 97 179 104 205 121"
        />
        <path
          className={`${styles.botanicalLeaf} ${styles.leafDelay1}`}
          pathLength={1}
          d="M35 102 C 10 82 -7 82 -24 94 C -3 108 14 114 35 102 Z M16 99 L-14 95"
        />
        <path
          className={`${styles.botanicalLeaf} ${styles.leafDelay2}`}
          pathLength={1}
          d="M70 118 C 42 106 26 115 15 137 C 43 140 61 136 70 118 Z M48 125 L22 136"
        />
        <path
          className={`${styles.botanicalLeaf} ${styles.leafDelay3}`}
          pathLength={1}
          d="M102 109 C 82 84 63 80 44 91 C 60 111 79 121 102 109 Z M76 101 L50 93"
        />
        <path
          className={`${styles.botanicalLeaf} ${styles.leafDelay4}`}
          pathLength={1}
          d="M135 109 C 112 127 105 145 116 166 C 139 151 148 132 135 109 Z M126 135 L117 160"
        />
        <path
          className={`${styles.botanicalLeaf} ${styles.leafDelay5}`}
          pathLength={1}
          d="M166 111 C 147 89 130 87 114 98 C 131 116 148 123 166 111 Z M142 104 L120 99"
        />
      </g>
      <g className={styles.botanicalVineRight}>
        <path
          className={styles.botanicalStem}
          pathLength={1}
          d="M214 51 C 246 23 282 56 311 35 C 344 11 375 25 412 -4"
        />
        <path
          className={`${styles.botanicalLeaf} ${styles.leafDelay2}`}
          pathLength={1}
          d="M248 41 C 230 21 211 18 195 29 C 210 48 228 55 248 41 Z M225 36 L200 30"
        />
        <path
          className={`${styles.botanicalLeaf} ${styles.leafDelay3}`}
          pathLength={1}
          d="M281 48 C 264 69 263 88 278 104 C 298 84 301 65 281 48 Z M282 75 L279 99"
        />
        <path
          className={`${styles.botanicalLeaf} ${styles.leafDelay4}`}
          pathLength={1}
          d="M315 35 C 293 18 273 19 257 35 C 279 49 298 51 315 35 Z M289 35 L263 35"
        />
        <path
          className={`${styles.botanicalLeaf} ${styles.leafDelay5}`}
          pathLength={1}
          d="M354 24 C 337 0 317 -5 297 7 C 314 31 334 39 354 24 Z M329 16 L303 8"
        />
        <path
          className={`${styles.botanicalLeaf} ${styles.leafDelay6}`}
          pathLength={1}
          d="M383 12 C 366 34 366 55 383 70 C 402 48 402 28 383 12 Z M384 40 L383 65"
        />
      </g>
    </svg>
  );
}

function VistaireWord() {
  return (
    <strong className={styles.vistaireWord} aria-label="Vistaire">
      <span aria-hidden="true">Vista</span>
      <span className={styles.vistaireLeafI} aria-hidden="true">
        ı
      </span>
      <span aria-hidden="true">re</span>
    </strong>
  );
}

function BackToTopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12.5 12 5l7 7.5M12 6v13" />
    </svg>
  );
}

function BrowserHandoffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M3.5 8h17M7 6h.01M10 6h.01M13 6h.01" />
      <path d="m8 14 2.2 2.2L16 10.4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="11" height="12" rx="1.8" />
      <path d="M16 8V5.8A1.8 1.8 0 0 0 14.2 4H5.8A1.8 1.8 0 0 0 4 5.8v10.4A1.8 1.8 0 0 0 5.8 18H8" />
    </svg>
  );
}

export function TrouvablePremiumMenuExperience({
  menu,
  config,
  context = "",
  exchangeRates,
  query,
  typographyClassName = "",
  displayMode = "public"
}: TrouvablePremiumMenuExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY_ID);
  const [activeFilters, setActiveFilters] = useState<QuickFilterId[]>([]);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedDish, setSelectedDish] = useState<PublicMenuDish | null>(null);
  const [dishSubSheet, setDishSubSheet] = useState<DishSubSheet>(null);
  const [showDetailModelViewer, setShowDetailModelViewer] = useState(false);
  const [showArBrowserHelp, setShowArBrowserHelp] = useState(false);
  const [arHandoffPlatform] = useState<ArHandoffPlatform>(() => {
    if (typeof navigator === "undefined") return "other";
    const navigatorWithData = navigator as Navigator & {
      userAgentData?: { platform?: string };
    };
    return detectArHandoffPlatform({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      userAgentDataPlatform: navigatorWithData.userAgentData?.platform
    });
  });
  const [arCopyStatus, setArCopyStatus] = useState<ArCopyStatus>("idle");
  const [manualDishUrl, setManualDishUrl] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [selection, setSelection] = useState<Map<string, SelectionItem>>(
    () => new Map()
  );
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [waiterTopic, setWaiterTopic] = useState<WaiterTopic>("recommendation");
  const [tableNumber, setTableNumber] = useState(query?.table?.slice(0, 24) ?? "");
  const [localMessage, setLocalMessage] = useState("");
  const [waiterMessage, setWaiterMessage] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [selectedLocale, setSelectedLocale] = useState<TrouvableLocale>(() =>
    normalizeTrouvableReadyLocaleForSettings(
      query?.lang,
      menu.settings,
      menu.localizedUiCopy
    )
  );
  const [selectedCurrency, setSelectedCurrency] =
    useState<TrouvableCurrency>(() =>
      normalizeTrouvableCurrency(undefined, menu.settings)
    );
  const [selectedTheme, setSelectedTheme] = useState<TrouvableTheme>(() =>
    normalizeTrouvableTheme(undefined, menu.settings)
  );
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [ModelViewerComponent, setModelViewerComponent] =
    useState<DishModelViewerComponent | null>(null);
  const [modelViewerLoadFailed, setModelViewerLoadFailed] = useState(false);
  const sheetRef = useRef<HTMLElement | null>(null);
  const subSheetRef = useRef<HTMLElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectionButtonRef = useRef<HTMLButtonElement | null>(null);
  const waiterButtonRef = useRef<HTMLButtonElement | null>(null);
  const topBarRef = useRef<HTMLElement | null>(null);
  const toolsSentinelRef = useRef<HTMLDivElement | null>(null);
  const backToTopSentinelRef = useRef<HTMLDivElement | null>(null);
  const pageTopRef = useRef<HTMLElement | null>(null);
  const manualDishUrlRef = useRef<HTMLInputElement | null>(null);
  const arCopyResetTimeoutRef = useRef<number | null>(null);
  const categoryRailRef = useRef<HTMLElement | null>(null);
  const [toolsPinned, setToolsPinned] = useState(false);
  const menuCategorySwipeRef = useRef<PointerSwipeStart | null>(null);
  const dishSwipeRef = useRef<DishSwipeStart | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const sheetPresence = useTransitionPresence(activeSheet, {
    durationMs: SHEET_MOTION_MS,
    disabled: prefersReducedMotion
  });
  const renderedSheet = sheetPresence.value;
  const sheetMotionState = sheetPresence.state;
  const subSheetSource = activeSheet === "dish" ? dishSubSheet : null;
  const subSheetPresence = useTransitionPresence(subSheetSource, {
    durationMs: SHEET_MOTION_MS,
    disabled: prefersReducedMotion
  });
  const renderedSubSheet = subSheetPresence.value;
  const subSheetMotionState = subSheetPresence.state;
  const { copy, resolution: copyResolution } = resolveTrouvableCopy(
    selectedLocale,
    menu.localizedUiCopy
  );
  const textDirection = getTrouvableTextDirection(selectedLocale);
  useTrouvableDocumentLanguage(
    selectedLocale,
    textDirection,
    displayMode === "public"
  );
  const greetingPeriod = getTrouvableGreetingPeriodForDate(
    new Date(),
    menu.settings.timezone
  );
  const greetingText = useSyncExternalStore(
    (onStoreChange) => {
      const intervalId = window.setInterval(onStoreChange, 60_000);
      return () => window.clearInterval(intervalId);
    },
    () =>
      getTrouvableGreetingForDate(
        selectedLocale,
        menu.settings.timezone,
        new Date(),
        menu.localizedUiCopy
      ),
    () => copy.greeting[greetingPeriod]
  );
  const greetingLead = formatTrouvableGreetingLead(
    greetingText,
    selectedLocale,
    greetingPeriod
  );
  const currencyOption = getTrouvableCurrencyOption(selectedCurrency);
  const currencyOptions = useMemo(
    () => getTrouvableCurrencyOptions(menu.settings),
    [menu.settings]
  );
  const languageOptions = useMemo(
    () =>
      getTrouvableReadyLanguageOptions(
        menu.settings,
        selectedLocale,
        menu.localizedUiCopy
      ),
    [menu.localizedUiCopy, menu.settings, selectedLocale]
  );
  const canChangeCurrency =
    menu.settings.allowCurrencySelector && currencyOptions.length > 1;
  const canChangeLanguage =
    menu.settings.allowLanguageSelector && languageOptions.length > 1;
  const canChangeTheme = menu.settings.allowThemeToggle;
  const localizedQuery = useMemo<PublicMenuContextQuery>(
    () => ({
      ...(query ?? {}),
      lang: selectedLocale
    }),
    [query, selectedLocale]
  );

  useEffect(
    () => () => {
      if (arCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(arCopyResetTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (arCopyStatus !== "error" || !manualDishUrl) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const input = manualDishUrlRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.select();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [arCopyStatus, manualDishUrl]);

  useEffect(() => {
    if (displayMode !== "public") return;
    trackPublicMenuEvent(menu, { eventName: "menu_opened" });
  }, [displayMode, menu]);

  useEffect(() => {
    if (displayMode !== "public") return undefined;
    const query = search.trim();
    if (query.length < 2) return undefined;
    const timeoutId = window.setTimeout(() => {
      trackPublicMenuEvent(menu, {
        eventName: "search_used",
        searchQuery: query
      });
    }, 700);
    return () => window.clearTimeout(timeoutId);
  }, [displayMode, menu, search]);

  const categories = useMemo(
    () => sortTrouvablePublicMenuCategories(getVisiblePublicMenuCategories(menu.dishes)),
    [menu.dishes]
  );
  const hasVegData = useMemo(() => menu.dishes.some(isVegDish), [menu.dishes]);
  const hasNonVegData = useMemo(
    () => menu.dishes.some(isNonVegDish),
    [menu.dishes]
  );
  const hasImmersiveData = useMemo(
    () => menu.dishes.some((dish) => dish.has3d || dish.hasAr || dish.hasImmersive),
    [menu.dishes]
  );
  const hasRecommendedData = useMemo(
    () => menu.dishes.some(isRecommendedDish),
    [menu.dishes]
  );
  const hasAllergenData = useMemo(
    () =>
      menu.dishes.some(
        (dish) =>
          dish.allergens.length > 0 ||
          (dish.allergenDeclarations?.length ?? 0) > 0
      ),
    [menu.dishes]
  );
  const quickFilters = useMemo(
    () =>
      [
        { id: "all" as const, label: copy.all, visible: true },
        { id: "veg" as const, label: copy.veg, visible: hasVegData },
        { id: "nonVeg" as const, label: copy.nonVeg, visible: hasNonVegData },
        { id: "available" as const, label: copy.available, visible: true },
        { id: "immersive" as const, label: copy.immersiveFilterLabel, visible: hasImmersiveData },
        {
          id: "recommended" as const,
          label: copy.signature,
          visible: hasRecommendedData
        },
        { id: "glutenFree" as const, label: copy.glutenFree, visible: hasAllergenData },
        { id: "dairyFree" as const, label: copy.dairyFree, visible: hasAllergenData },
        { id: "nutFree" as const, label: copy.nutFree, visible: hasAllergenData },
        {
          id: "shellfishFree" as const,
          label: copy.shellfishFree,
          visible: hasAllergenData
        },
        { id: "eggFree" as const, label: copy.eggFree, visible: hasAllergenData },
        { id: "sesameFree" as const, label: copy.sesameFree, visible: hasAllergenData },
        { id: "soyFree" as const, label: copy.soyFree, visible: hasAllergenData },
        { id: "fishFree" as const, label: copy.fishFree, visible: hasAllergenData }
      ].filter((filter) => filter.visible),
    [
      copy,
      hasAllergenData,
      hasImmersiveData,
      hasNonVegData,
      hasRecommendedData,
      hasVegData
    ]
  );
  const activeFilterLabels = useMemo(
    () =>
      quickFilters
        .filter(
          (filter) => filter.id !== "all" && activeFilters.includes(filter.id)
        )
        .map((filter) => filter.label),
    [activeFilters, quickFilters]
  );
  const filterButtonLabel =
    activeFilterLabels.length === 0
      ? copy.filterButton
      : activeFilterLabels.length === 1
        ? activeFilterLabels[0]
        : copy.activeFilters(activeFilterLabels.length);
  const hasActiveFilter = activeFilterLabels.length > 0;

  const filteredDishes = useMemo(() => {
    const searchQuery = normalizeText(search.trim());
    return menu.dishes.filter((dish) => {
      if (
        activeFilters.length > 0 &&
        !activeFilters.every((filter) => quickFilterMatches(dish, filter))
      ) {
        return false;
      }
      if (!searchQuery) return true;
      return searchableDishText(dish).includes(searchQuery);
    });
  }, [activeFilters, menu.dishes, search]);
  const filteredGroups = useMemo(
    () => getPublicMenuCategoryGroups(filteredDishes),
    [filteredDishes]
  );
  const filteredCategories = useMemo(
    () => sortTrouvablePublicMenuCategories(getVisiblePublicMenuCategories(filteredDishes)),
    [filteredDishes]
  );
  const categoryOptions = useMemo(() => categories, [categories]);
  const navigableSections = useMemo(
    () =>
      buildNavigableMenuSections(
        ALL_CATEGORY_ID,
        categories.map((category) => category.id)
      ),
    [categories]
  );
  const fallbackCategory = filteredCategories[0]?.id ?? ALL_CATEGORY_ID;
  const activeCategoryIsAvailable =
    activeCategory === ALL_CATEGORY_ID ||
    filteredCategories.some((category) => category.id === activeCategory);
  const resolvedActiveCategory =
    activeCategory === ALL_CATEGORY_ID
      ? ALL_CATEGORY_ID
      : activeCategoryIsAvailable
        ? activeCategory
        : fallbackCategory;
  const resolvedCategory = filteredCategories.find(
    (category) => category.id === resolvedActiveCategory
  );
  const activeCategoryTitle =
    resolvedActiveCategory === ALL_CATEGORY_ID
      ? copy.activeCategoryAll
      : resolvedCategory?.label ?? resolvedActiveCategory;
  const visibleDishes =
    resolvedActiveCategory === ALL_CATEGORY_ID
      ? filteredDishes
      : filteredGroups.get(resolvedActiveCategory) ?? [];
  const selectionItems = useMemo(() => Array.from(selection.values()), [selection]);
  const selectionCount = selectionItems.reduce(
    (total, item) => total + item.quantity,
    0
  );
  const selectionTotalCents = selectionItems.reduce((total, item) => {
    const priceCents = getTrouvableDishConvertedPriceCents(
      item.dish,
      selectedCurrency,
      exchangeRates
    );
    return priceCents === null ? total : total + priceCents * item.quantity;
  }, 0);
  const hasPricedSelection =
    selectionItems.length > 0 &&
    selectionItems.every((item) =>
      getTrouvableDishConvertedPriceCents(
        item.dish,
        selectedCurrency,
        exchangeRates
      ) !== null
    );
  const googleReviewCta = getGoogleReviewCta(menu.googleReview);
  const viewLabel = viewMode === "grid" ? copy.viewGrid : copy.viewList;

  const resetArHandoffState = useCallback(() => {
    if (arCopyResetTimeoutRef.current !== null) {
      window.clearTimeout(arCopyResetTimeoutRef.current);
      arCopyResetTimeoutRef.current = null;
    }
    setShowArBrowserHelp(false);
    setArCopyStatus("idle");
    setManualDishUrl("");
  }, []);

  function selectManualDishUrl() {
    const input = manualDishUrlRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.select();
  }

  const handleBackToTop = useCallback(() => {
    const phonePreviewScroller =
      displayMode === "phone-preview"
        ? pageTopRef.current?.closest('[data-display-mode="phone-preview"]')?.parentElement
        : null;

    if (phonePreviewScroller instanceof HTMLElement) {
      phonePreviewScroller.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth"
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth"
      });
    }
    window.requestAnimationFrame(() => {
      pageTopRef.current?.focus({ preventScroll: true });
    });
  }, [displayMode, prefersReducedMotion]);

  const restoreFocus = useCallback(() => {
    window.setTimeout(() => {
      const previous = lastFocusRef.current;
      if (previous?.isConnected) {
        previous.focus();
        return;
      }
      selectionButtonRef.current?.focus();
      waiterButtonRef.current?.focus();
    }, 0);
  }, []);

  const openSheet = useCallback(
    (sheet: Exclude<ActiveSheet, null>) => {
      if (!activeSheet && document.activeElement instanceof HTMLElement) {
        lastFocusRef.current = document.activeElement;
      }
      setActiveSheet(sheet);
    },
    [activeSheet]
  );

  const closeActiveSheet = useCallback(() => {
    // Only flip the logical state here. Dish/sub-sheet data stays mounted through the
    // closing animation and is cleared once the sheet has fully left the DOM (see effect below).
    setActiveSheet(null);
    resetArHandoffState();
    restoreFocus();
  }, [resetArHandoffState, restoreFocus]);

  const closeDishSubSheet = useCallback(() => {
    setDishSubSheet(null);
  }, []);

  const replaceLocaleInUrl = useCallback(
    (nextLocale: TrouvableLocale) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("lang", nextLocale);
      const queryString = params.toString();
      const nextPath = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(nextPath, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      const queryLocale = query?.lang?.toString().trim()
        ? normalizeTrouvableReadyLocaleForSettings(
            query.lang,
            menu.settings,
            menu.localizedUiCopy
          )
        : null;
      const defaultLocale = normalizeTrouvableReadyLocaleForSettings(
        undefined,
        menu.settings,
        menu.localizedUiCopy
      );
      if (displayMode !== "public") {
        setSelectedLocale(queryLocale ?? defaultLocale);
        setSelectedCurrency(normalizeTrouvableCurrency(undefined, menu.settings));
        setSelectedTheme(normalizeTrouvableTheme(undefined, menu.settings));
        setPreferencesLoaded(true);
        return;
      }
      const storedLocale = window.localStorage.getItem(TROUVABLE_LOCALE_STORAGE_KEY);
      const storedCurrency = window.localStorage.getItem(
        TROUVABLE_CURRENCY_STORAGE_KEY
      );
      const storedTheme = window.localStorage.getItem(TROUVABLE_THEME_STORAGE_KEY);
      const activeServerLocale = normalizeTrouvableReadyLocaleForSettings(
        menu.activeLocale,
        menu.settings,
        menu.localizedUiCopy
      );
      const normalizedStoredLocale = storedLocale
        ? normalizeTrouvableReadyLocaleForSettings(
            storedLocale,
            menu.settings,
            menu.localizedUiCopy
          )
        : null;

      if (
        !queryLocale &&
        normalizedStoredLocale &&
        normalizedStoredLocale !== defaultLocale &&
        normalizedStoredLocale !== activeServerLocale
      ) {
        replaceLocaleInUrl(normalizedStoredLocale);
        return;
      }

      setSelectedLocale(
        queryLocale ??
          normalizedStoredLocale ??
          defaultLocale
      );
      setSelectedCurrency(normalizeTrouvableCurrency(storedCurrency, menu.settings));
      setSelectedTheme(normalizeTrouvableTheme(storedTheme, menu.settings));
      if (queryLocale) {
        window.localStorage.setItem(TROUVABLE_LOCALE_STORAGE_KEY, queryLocale);
      }
      setPreferencesLoaded(true);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [
    displayMode,
    menu.activeLocale,
    menu.localizedUiCopy,
    menu.settings,
    query?.lang,
    replaceLocaleInUrl
  ]);

  useEffect(() => {
    if (displayMode !== "public" || !preferencesLoaded) return;
    window.localStorage.setItem(TROUVABLE_LOCALE_STORAGE_KEY, selectedLocale);
    window.localStorage.setItem(TROUVABLE_CURRENCY_STORAGE_KEY, selectedCurrency);
    window.localStorage.setItem(TROUVABLE_THEME_STORAGE_KEY, selectedTheme);
  }, [displayMode, preferencesLoaded, selectedCurrency, selectedLocale, selectedTheme]);

  useEffect(() => {
    const rail = categoryRailRef.current;
    if (!rail) return;

    const scrollBehavior = prefersReducedMotion ? "auto" : "smooth";

    if (resolvedActiveCategory === ALL_CATEGORY_ID) {
      rail.scrollTo({ left: 0, behavior: scrollBehavior });
      return;
    }

    const activeButton = rail.querySelector('button[aria-current="true"]');
    if (!(activeButton instanceof HTMLElement)) return;

    activeButton.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: scrollBehavior
    });
  }, [prefersReducedMotion, resolvedActiveCategory]);

  useEffect(() => {
    const topBar = topBarRef.current;
    const page = topBar?.closest(`.${styles.page}`);
    if (!topBar || !(page instanceof HTMLElement)) return;

    const syncStickyToolsTop = () => {
      page.style.setProperty(
        "--trouvable-sticky-tools-top",
        `${Math.ceil(topBar.getBoundingClientRect().height)}px`
      );
    };

    syncStickyToolsTop();
    window.addEventListener("resize", syncStickyToolsTop);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(syncStickyToolsTop);
    resizeObserver?.observe(topBar);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncStickyToolsTop);
    };
  }, []);

  useEffect(() => {
    const sentinel = toolsSentinelRef.current;
    const page = sentinel?.closest(`.${styles.page}`);
    if (!sentinel || !(page instanceof HTMLElement)) return;

    const readTopInset = () => {
      const raw = getComputedStyle(page)
        .getPropertyValue("--trouvable-sticky-tools-top")
        .trim();
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : 72;
    };

    if (!("IntersectionObserver" in window)) {
      return;
    }

    let observer: IntersectionObserver | null = null;

    const bindObserver = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          const topInset = readTopInset();
          setToolsPinned(
            !entry.isIntersecting && entry.boundingClientRect.top < topInset
          );
        },
        {
          root: null,
          threshold: 0,
          rootMargin: `-${readTopInset()}px 0px 0px 0px`
        }
      );
      observer.observe(sentinel);
    };

    bindObserver();

    const topBar = topBarRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && topBar) {
      resizeObserver = new ResizeObserver(bindObserver);
      resizeObserver.observe(topBar);
    }

    return () => {
      observer?.disconnect();
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    const sentinel = backToTopSentinelRef.current;
    if (!sentinel || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      setShowBackToTop(!entry.isIntersecting);
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!activeSheet) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const activeDialog =
      activeSheet === "dish" && dishSubSheet
        ? subSheetRef.current
        : sheetRef.current;
    const focusable = getFocusableElements(activeDialog);
    (focusable[0] ?? activeDialog)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (activeSheet === "dish" && dishSubSheet) {
          closeDishSubSheet();
          return;
        }
        closeActiveSheet();
        return;
      }
      if (event.key !== "Tab") return;

      const trapRoot =
        activeSheet === "dish" && dishSubSheet
          ? subSheetRef.current
          : sheetRef.current;
      const elements = getFocusableElements(trapRoot);
      if (elements.length === 0) {
        event.preventDefault();
        trapRoot?.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSheet, closeActiveSheet, closeDishSubSheet, dishSubSheet]);

  useEffect(() => {
    if (
      !showDetailModelViewer ||
      ModelViewerComponent ||
      modelViewerLoadFailed
    ) {
      return;
    }

    let cancelled = false;
    import("@/components/dish/DishModelViewer")
      .then((mod) => {
        if (!cancelled) {
          setModelViewerComponent(() => mod.DishModelViewer);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelViewerLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ModelViewerComponent, modelViewerLoadFailed, showDetailModelViewer]);

  // Once the sheet layer has fully closed (past its exit animation), drop the dish-scoped
  // state so a reopened sheet starts clean and the model viewer never lingers.
  const [prevRenderedSheet, setPrevRenderedSheet] = useState(renderedSheet);
  if (renderedSheet !== prevRenderedSheet) {
    setPrevRenderedSheet(renderedSheet);
    if (renderedSheet === null) {
      setSelectedDish(null);
      setDishSubSheet(null);
      setShowDetailModelViewer(false);
    }
  }

  function addDish(dish: PublicMenuDish) {
    if (!dish.available) return;
    setSelection((current) => {
      const next = new Map(current);
      const existing = next.get(dish.id);
      next.set(dish.id, {
        dish,
        quantity: existing ? existing.quantity + 1 : 1
      });
      return next;
    });
    setLocalMessage(`${dish.name} · ${copy.selection}`);
  }

  function updateQuantity(dishId: string, delta: number) {
    setSelection((current) => {
      const next = new Map(current);
      const existing = next.get(dishId);
      if (!existing) return next;
      const quantity = existing.quantity + delta;
      if (quantity <= 0) {
        next.delete(dishId);
      } else {
        next.set(dishId, { ...existing, quantity });
      }
      return next;
    });
  }

  function openWaiter(topic: WaiterTopic) {
    setWaiterTopic(topic);
    setWaiterMessage("");
    setLocalMessage("");
    openSheet("waiter");
  }

  function openReviewSheet() {
    setReviewRating(0);
    setReviewText("");
    setLocalMessage("");
    if (activeSheet === "dish" && selectedDish) {
      setDishSubSheet("review");
      return;
    }
    openSheet("review");
  }

  function openRestaurantReviewSheet() {
    resetArHandoffState();
    setSelectedDish(null);
    setReviewRating(0);
    setReviewText("");
    setLocalMessage("");
    openSheet("experienceReview");
  }

  function selectCurrency(nextCurrency: TrouvableCurrency) {
    if (!menu.settings.supportedCurrencies.includes(nextCurrency)) return;
    setSelectedCurrency(nextCurrency);
    setLocalMessage("");
    closeActiveSheet();
  }

  function selectLocale(nextLocale: TrouvableLocale) {
    const readyLocale = normalizeTrouvableReadyLocaleForSettings(
      nextLocale,
      menu.settings,
      menu.localizedUiCopy
    );
    if (readyLocale !== nextLocale) return;
    setSelectedLocale(readyLocale);
    if (displayMode === "public") {
      window.localStorage.setItem(TROUVABLE_LOCALE_STORAGE_KEY, readyLocale);
      replaceLocaleInUrl(readyLocale);
    }
    setLocalMessage("");
    closeActiveSheet();
  }

  function toggleTheme() {
    if (!canChangeTheme) return;
    setSelectedTheme((current) => (current === "dark" ? "light" : "dark"));
    setLocalMessage("");
  }

  function prepareWaiterRequest() {
    const tableCopy = tableNumber.trim()
      ? `${copy.tableLabel} ${tableNumber.trim()}`
      : copy.tableToConfirm;
    const message = copy.waiterReady(tableCopy);
    setWaiterMessage(message);
    setLocalMessage(message);
  }

  function clearFilters() {
    setActiveFilters([]);
    setSearch("");
    setActiveCategory(ALL_CATEGORY_ID);
  }

  function isQuickFilterActive(filterId: QuickFilterId) {
    return filterId === "all"
      ? activeFilters.length === 0
      : activeFilters.includes(filterId);
  }

  function quickFilterDescription(filterId: QuickFilterId) {
    if (filterId === "all") return copy.filterAllAria;
    if (filterId === "veg") return copy.filterVegAria;
  if (filterId === "nonVeg") return copy.filterNonVegAria;
  if (filterId === "available") return copy.filterAvailableAria;
  if (filterId === "immersive") return copy.filterImmersiveAria;
  if (filterId === "glutenFree") return copy.glutenFree;
  if (filterId === "dairyFree") return copy.dairyFree;
  if (filterId === "nutFree") return copy.nutFree;
  if (filterId === "shellfishFree") return copy.shellfishFree;
  if (filterId === "eggFree") return copy.eggFree;
  if (filterId === "sesameFree") return copy.sesameFree;
  if (filterId === "soyFree") return copy.soyFree;
  if (filterId === "fishFree") return copy.fishFree;
  return copy.filterRecommendedAria;
}

  function toggleQuickFilter(filterId: QuickFilterId) {
    if (displayMode === "public") {
      trackPublicMenuEvent(menu, {
        eventName: "filter_used",
        filterName: filterId
      });
    }
    if (filterId === "all") {
      setActiveFilters([]);
      return;
    }

    setActiveFilters((current) => {
      if (current.includes(filterId)) {
        return current.filter((id) => id !== filterId);
      }

      const compatibleFilters = current.filter((id) => {
        if (filterId === "veg") return id !== "nonVeg";
        if (filterId === "nonVeg") return id !== "veg";
        return true;
      });

      return [...compatibleFilters, filterId];
    });
  }

  function selectAdjacentCategory(direction: 1 | -1) {
    const nextSection = getAdjacentMenuSection(
      navigableSections,
      resolvedActiveCategory,
      direction
    );
    if (!nextSection) return;
    setActiveCategory(nextSection);
  }

  function handleMenuCategoryPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") return;
    if (isCategorySwipeGuardedTarget(event.target)) return;
    menuCategorySwipeRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId
    };
  }

  function handleMenuCategoryPointerUp(event: PointerEvent<HTMLElement>) {
    const start = menuCategorySwipeRef.current;
    menuCategorySwipeRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    event.preventDefault();
    selectAdjacentCategory(deltaX < 0 ? 1 : -1);
  }

  function openDishDetail(dish: PublicMenuDish) {
    setDishSubSheet(null);
    setShowDetailModelViewer(false);
    resetArHandoffState();
    setSelectedDish(dish);
    if (displayMode === "public") {
      trackPublicMenuEvent(menu, {
        eventName: "dish_opened",
        dishSlug: dish.slug,
        categorySlug: dish.categorySlug
      });
    }
    openSheet("dish");
  }

  function selectAdjacentDish(direction: 1 | -1) {
    if (!selectedDish || visibleDishes.length < 2) return;
    const currentIndex = visibleDishes.findIndex((dish) => dish.id === selectedDish.id);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + visibleDishes.length) % visibleDishes.length;
    setDishSubSheet(null);
    setShowDetailModelViewer(false);
    resetArHandoffState();
    setSelectedDish(visibleDishes[nextIndex] ?? selectedDish);
  }

  function handleDishPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") return;
    if (
      dishSubSheet ||
      showDetailModelViewer ||
      isDishSwipeGuardedTarget(event.target, event.currentTarget)
    ) {
      return;
    }
    dishSwipeRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      scrollTop: getDishSwipeScrollTop(event.currentTarget)
    };
  }

  function handleDishPointerUp(event: PointerEvent<HTMLElement>) {
    const start = dishSwipeRef.current;
    dishSwipeRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    if (
      dishSubSheet ||
      showDetailModelViewer ||
      isDishSwipeGuardedTarget(event.target, event.currentTarget)
    ) {
      return;
    }
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const scrollDelta =
      getDishSwipeScrollTop(event.currentTarget) - start.scrollTop;
    const gesture = resolveDishSwipeGesture(deltaX, deltaY, scrollDelta);
    if (gesture === "reviewOpen") {
      openReviewSheet();
      return;
    }
    if (gesture === "next" || gesture === "previous") {
      selectAdjacentDish(gesture === "next" ? 1 : -1);
    }
  }

  function renderDishCard(dish: PublicMenuDish, index: number) {
    const isFeatured = index === 0;
    const priceLabel = formatTrouvableDishPrice(
      dish,
      selectedCurrency,
      selectedLocale,
      exchangeRates
    );
    const show3dBadge = hasPublicMenu3d(dish);

    return (
      <li key={dish.id} className={styles.dishItem}>
        <article
          className={`${styles.dishCard} ${isFeatured ? styles.dishCardFeatured : ""}`}
        >
          <button
            type="button"
            className={styles.dishSummary}
            aria-haspopup="dialog"
            onClick={() => openDishDetail(dish)}
          >
            <DishVisual dish={dish} menu={menu} />
            <span className={styles.dishCopy}>
              <span className={styles.dishTopline}>
                <strong>{dish.name}</strong>
              </span>
              <small>{dishMetaLine(dish, copy.soldOut)}</small>
              {priceLabel || show3dBadge ? (
                <span className={styles.dishPriceRow}>
                  {priceLabel ? (
                    <span className={styles.dishPrice}>{priceLabel}</span>
                  ) : (
                    <span className={styles.dishPriceSpacer} aria-hidden="true" />
                  )}
                  {show3dBadge ? (
                    <DishCard3dBadge className={styles.dishCard3dBadge} />
                  ) : null}
                </span>
              ) : null}
            </span>
          </button>
          <div className={styles.cardActions}>
            <button
              type="button"
              disabled={!dish.available}
              onClick={() => addDish(dish)}
            >
              {dish.available ? copy.add : copy.soldOut}
            </button>
          </div>
        </article>
      </li>
    );
  }

  function renderSelectionSheet() {
    if (renderedSheet !== "selection") return null;

    return (
      <div
        className={styles.overlay}
        data-sheet-state={sheetMotionState}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-selection-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeActiveSheet();
        }}
      >
        <section ref={sheetRef} className={styles.sheet} tabIndex={-1}>
          <header className={styles.sheetHeader}>
            <div>
              <p>{copy.selectionKicker}</p>
              <h2 id="trouvable-selection-title">{copy.selectionTitle}</h2>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={copy.closeSelection}
              onClick={closeActiveSheet}
            >
              x
            </button>
          </header>

          {selectionItems.length === 0 ? (
            <div className={styles.emptyState} role="status">
              <p>{copy.emptySelectionTitle}</p>
              <span>{copy.emptySelectionBody}</span>
            </div>
          ) : (
            <>
              <ul className={styles.selectionList}>
                {selectionItems.map((item) => (
                  <li key={item.dish.id}>
                    <div>
                      <strong>{item.dish.name}</strong>
                      <span>
                        {formatTrouvableDishPrice(
                          item.dish,
                          selectedCurrency,
                          selectedLocale,
                          exchangeRates
                        ) || copy.priceToConfirm}
                      </span>
                    </div>
                    <div className={styles.quantityControls}>
                      <button
                        type="button"
                        aria-label={copy.quantityDecrease(item.dish.name)}
                        onClick={() => updateQuantity(item.dish.id, -1)}
                      >
                        -
                      </button>
                      <output
                        aria-label={copy.quantityLabel(item.dish.name)}
                        aria-live="polite"
                      >
                        {item.quantity}
                      </output>
                      <button
                        type="button"
                        aria-label={copy.quantityIncrease(item.dish.name)}
                        onClick={() => updateQuantity(item.dish.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className={styles.totalRow}>
                <span>{copy.estimatedTotal}</span>
                <strong>
                  {hasPricedSelection
                    ? formatTrouvablePriceCents(
                        selectionTotalCents,
                        selectedCurrency,
                        selectedLocale
                      )
                    : copy.toConfirm}
                </strong>
              </div>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => openWaiter("selection")}
              >
                {copy.askWaiter}
              </button>
            </>
          )}
        </section>
      </div>
    );
  }

  function renderWaiterSheet() {
    if (renderedSheet !== "waiter") return null;

    return (
      <div
        className={styles.overlay}
        data-sheet-state={sheetMotionState}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-waiter-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeActiveSheet();
        }}
      >
        <section ref={sheetRef} className={styles.sheet} tabIndex={-1}>
          <header className={styles.sheetHeader}>
            <div>
              <p>{copy.waiterKicker}</p>
              <h2 id="trouvable-waiter-title">{copy.waiterTitle}</h2>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={copy.closeWaiter}
              onClick={closeActiveSheet}
            >
              x
            </button>
          </header>
          <label className={styles.fieldLabel}>
            {copy.tableLabel}
            <input
              id="trouvable-waiter-table"
              inputMode="numeric"
              maxLength={24}
              name="table"
              placeholder={copy.tablePlaceholder}
              value={tableNumber}
              onChange={(event) => setTableNumber(event.target.value)}
            />
          </label>
          <fieldset className={styles.topicGroup}>
            <legend>{copy.waiterTopic}</legend>
            {[
              ["allergen", copy.waiterTopics.allergen],
              ["recommendation", copy.waiterTopics.recommendation],
              ["selection", copy.waiterTopics.selection]
            ].map(([id, label]) => (
              <label key={id}>
                <input
                  checked={waiterTopic === id}
                  name="waiter-topic"
                  type="radio"
                  value={id}
                  onChange={() => setWaiterTopic(id as WaiterTopic)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={prepareWaiterRequest}
          >
            {copy.prepareRequest}
          </button>
          {waiterMessage ? (
            <p className={styles.sheetStatus} role="status" aria-atomic="true">
              {waiterMessage}
            </p>
          ) : null}
          <p className={styles.localHint}>
            {copy.localOrderHint}
          </p>
        </section>
      </div>
    );
  }

  function renderCurrencySheet() {
    if (renderedSheet !== "currency" || !canChangeCurrency) return null;

    return (
      <div
        className={styles.overlay}
        data-sheet-state={sheetMotionState}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-currency-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeActiveSheet();
        }}
      >
        <section ref={sheetRef} className={styles.sheet} tabIndex={-1}>
          <header className={styles.sheetHeader}>
            <div>
              <p>{copy.currencyKicker}</p>
              <h2 id="trouvable-currency-title">{copy.currencyTitle}</h2>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={copy.close}
              onClick={closeActiveSheet}
            >
              x
            </button>
          </header>
          <div className={styles.choiceList}>
            {currencyOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                className={styles.choiceButton}
                aria-pressed={selectedCurrency === option.code}
                onClick={() => selectCurrency(option.code)}
              >
                <span>{option.code}</span>
                <small>
                  {option.symbol} · {getTrouvableCurrencyOptionLabel(option, selectedLocale)}
                </small>
              </button>
            ))}
          </div>
          <p className={styles.localHint}>{copy.currencyCopy}</p>
        </section>
      </div>
    );
  }

  function renderFiltersSheet() {
    if (renderedSheet !== "filters") return null;

    return (
      <div
        className={styles.overlay}
        data-sheet-state={sheetMotionState}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-filters-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeActiveSheet();
        }}
      >
        <section
          ref={sheetRef}
          className={`${styles.sheet} ${styles.filterSheet}`}
          tabIndex={-1}
        >
          <header className={styles.sheetHeader}>
            <div>
              <p>{copy.filterKicker}</p>
              <h2 id="trouvable-filters-title">{copy.filterTitle}</h2>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={copy.closeFilters}
              onClick={closeActiveSheet}
            >
              x
            </button>
          </header>
          {hasActiveFilter ? (
            <button
              type="button"
              className={styles.sheetReset}
              onClick={() => setActiveFilters([])}
            >
              {copy.resetFilters}
            </button>
          ) : null}
          <div
            className={styles.filterGrid}
            role="group"
            aria-label={copy.filterGroupLabel}
          >
            {quickFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={isQuickFilterActive(filter.id) ? styles.isActive : undefined}
                aria-pressed={isQuickFilterActive(filter.id)}
                aria-label={quickFilterDescription(filter.id)}
                onClick={() => toggleQuickFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.sheetApply}
            onClick={closeActiveSheet}
          >
            {copy.filterApply}
          </button>
        </section>
      </div>
    );
  }

  function renderLanguageSheet() {
    if (renderedSheet !== "language" || !canChangeLanguage) return null;

    const sheetLanguageOptions = languageOptions;

    return (
      <div
        className={styles.overlay}
        data-sheet-state={sheetMotionState}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-language-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeActiveSheet();
        }}
      >
        <section ref={sheetRef} className={styles.sheet} tabIndex={-1}>
          <header className={styles.sheetHeader}>
            <div>
              <p>{copy.languageKicker}</p>
              <h2 id="trouvable-language-title">{copy.languageTitle}</h2>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={copy.closeLanguage}
              onClick={closeActiveSheet}
            >
              x
            </button>
          </header>
          <div className={styles.choiceList}>
            {sheetLanguageOptions.map((option) => (
              <button
                key={option.locale}
                type="button"
                className={styles.choiceButton}
                aria-pressed={selectedLocale === option.locale}
                aria-label={`${option.nativeName}, ${option.region}, ${option.code}`}
                onClick={() => selectLocale(option.locale)}
              >
                <span>{option.shortCode}</span>
                <small dir="auto">
                  {option.nativeName} · {option.region}
                </small>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderReviewSheet() {
    const showAsPrimaryReview =
      renderedSheet === "review" || renderedSheet === "experienceReview";
    const showAsStackReview =
      renderedSheet === "dish" && renderedSubSheet === "review";
    if (!showAsPrimaryReview && !showAsStackReview) {
      return null;
    }

    // Active (live) intent, used to route the close handler while the sheet is still open.
    const isDishStackReviewActive = activeSheet === "dish" && dishSubSheet === "review";
    // Rendered intent, used for markup/refs so the sub-sheet keeps its identity while closing.
    const isDishStackReview = showAsStackReview;
    const reviewMotionState = showAsStackReview
      ? subSheetMotionState
      : sheetMotionState;
    const isExperienceReview = renderedSheet === "experienceReview";
    const reviewDish = isExperienceReview ? null : selectedDish;
    const closeReview = isDishStackReviewActive ? closeDishSubSheet : closeActiveSheet;
    const reviewTitle = isExperienceReview
      ? copy.reviewExperienceTitle
      : copy.reviewTitle;
    const reviewPlaceholder = isExperienceReview
      ? copy.reviewExperiencePlaceholder
      : copy.reviewPlaceholder;
    const reviewStarsLabel = isExperienceReview
      ? copy.reviewExperienceStars
      : copy.reviewStars;

    return (
      <div
        className={`${styles.overlay} ${styles.reviewOverlay} ${styles.stackedOverlay}`}
        data-sheet-state={reviewMotionState}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-review-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeReview();
        }}
        data-no-dish-swipe="true"
      >
        <section
          ref={isDishStackReview ? subSheetRef : sheetRef}
          className={styles.reviewSheet}
          tabIndex={-1}
        >
          <div className={styles.reviewDishGhost} aria-hidden="true">
            {reviewDish?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={reviewDish.imageUrl} />
            ) : reviewDish ? (
              <span>{reviewDish.name.slice(0, 1)}</span>
            ) : (
              <span>{menu.name.slice(0, 1)}</span>
            )}
          </div>
          <div className={styles.reviewPanel}>
            <h2 id="trouvable-review-title">{reviewTitle}</h2>
            <div className={styles.reviewStars} aria-label={reviewStarsLabel}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  aria-label={`${rating} ${reviewStarsLabel}`}
                  aria-pressed={reviewRating >= rating}
                  onClick={() => setReviewRating(rating)}
                >
                  ★
                </button>
              ))}
            </div>
            <label className={styles.reviewTextarea}>
              <span>{copy.reviewComment}</span>
              <textarea
                maxLength={300}
                placeholder={reviewPlaceholder}
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
              />
            </label>
            {googleReviewCta ? (
              <a
                className={styles.reviewPostButton}
                data-google-review-action="true"
                href={googleReviewCta.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackGoogleReviewClick({
                    dishSlug: reviewDish?.slug,
                    menuId: menu.menuId,
                    restaurantId: menu.restaurantId,
                    source: menu.source
                  });
                  setLocalMessage(copy.reviewOpened);
                }}
              >
                {copy.reviewPost}
              </a>
            ) : (
              <button className={styles.reviewPostButton} type="button" disabled>
                {copy.reviewPost}
              </button>
            )}
            {!googleReviewCta ? (
              <p className={styles.reviewNote}>
                {copy.reviewMissing}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  function renderDishDetailsSubSheet() {
    const detailsDish =
      renderedSheet === "dish" && renderedSubSheet === "details"
        ? selectedDish
        : null;

    if (!detailsDish) return null;

    return (
      <PremiumDishDetailsSheet
        dish={detailsDish}
        copy={copy}
        locale={selectedLocale}
        sheetId={`trouvable-dish-more-details-${detailsDish.slug}`}
        titleId="trouvable-dish-details-title"
        onClose={closeDishSubSheet}
        panelRef={subSheetRef}
        userTheme={selectedTheme}
        dataState={subSheetMotionState}
      />
    );
  }

  function renderDishDetailSheet() {
    if (renderedSheet !== "dish" || !selectedDish) return null;

    const hasModel = hasPublicMenu3d(selectedDish);
    const detailPrice = formatTrouvableDishPrice(
      selectedDish,
      selectedCurrency,
      selectedLocale,
      exchangeRates
    );
    const moreDetailsId = `trouvable-dish-more-details-${selectedDish.slug}`;
    const browserDishHref = buildPublicDishPath(
      menu.slug,
      selectedDish.slug,
      localizedQuery
    );
    const platformCopy = copy.arBrowserFallback[arHandoffPlatform];
    const arBrowserFallbackTitleId = `trouvable-ar-browser-fallback-${selectedDish.slug}`;
    const manualDishUrlId = `trouvable-ar-manual-url-${selectedDish.slug}`;

    async function copyDishUrl() {
      if (arCopyStatus === "copying") return;
      if (arCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(arCopyResetTimeoutRef.current);
        arCopyResetTimeoutRef.current = null;
      }

      const absoluteDishUrl = new URL(
        browserDishHref,
        window.location.origin
      ).toString();
      setArCopyStatus("copying");
      const copied = await copyTextToClipboard(absoluteDishUrl);

      if (copied) {
        setManualDishUrl("");
        setArCopyStatus("success");
        arCopyResetTimeoutRef.current = window.setTimeout(() => {
          arCopyResetTimeoutRef.current = null;
          setArCopyStatus("idle");
        }, AR_COPY_STATUS_RESET_MS);
        return;
      }

      setManualDishUrl(absoluteDishUrl);
      setArCopyStatus("error");
    }

    return (
      <div
        className={`${styles.overlay} ${styles.dishOverlay}`}
        data-sheet-state={sheetMotionState}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-dish-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeActiveSheet();
        }}
      >
        <article
          ref={sheetRef}
          className={`${styles.sheet} ${styles.detailSheet}`}
          tabIndex={-1}
          onPointerDown={handleDishPointerDown}
          onPointerUp={handleDishPointerUp}
          onPointerCancel={() => {
            dishSwipeRef.current = null;
          }}
        >
          <nav className={styles.detailNav} aria-label={copy.backToMenu}>
            <button
              type="button"
              className={styles.detailBack}
              aria-label={copy.backToMenu}
              onClick={closeActiveSheet}
            >
              ←
            </button>
            <span>TROUVABLE</span>
          </nav>
          {visibleDishes.length > 1 ? (
            <>
              <button
                type="button"
                className={`${styles.dishArrow} ${styles.dishArrowLeft}`}
                aria-label={copy.previousDish}
                onClick={() => selectAdjacentDish(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className={`${styles.dishArrow} ${styles.dishArrowRight}`}
                aria-label={copy.nextDish}
                onClick={() => selectAdjacentDish(1)}
              >
                ›
              </button>
            </>
          ) : null}
          <div
            className={`${styles.detailVisual} ${
              selectedDish.imageUrl ? styles.hasDishImage : ""
            }`}
          >
            {selectedDish.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" loading="lazy" src={selectedDish.imageUrl} />
            ) : (
              <span>{menu.name.slice(0, 1)}</span>
            )}
          </div>
          <div className={styles.detailBody}>
            <header className={styles.sheetHeader}>
              <div>
                <p>{selectedDish.category}</p>
                <h2 id="trouvable-dish-title">{selectedDish.name}</h2>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={copy.closeDetail}
                onClick={closeActiveSheet}
              >
                x
              </button>
            </header>
            {detailPrice ? (
              <strong className={styles.detailPrice}>{detailPrice}</strong>
            ) : null}
            <button
              type="button"
              className={styles.moreDetailsButton}
              aria-expanded={dishSubSheet === "details"}
              aria-controls={moreDetailsId}
              onClick={() => {
                setDishSubSheet("details");
              }}
            >
              <span aria-hidden="true">i</span>
              {copy.viewDetails}
            </button>
            <div className={styles.detailOptionTags} data-no-dish-swipe="true">
              <PremiumDishCardOptionTags
                items={selectedDish.options}
                label={copy.cardOptionsLabel}
                variant="detail"
              />
            </div>
            <div className={styles.detailActions}>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={!selectedDish.available}
                onClick={() => addDish(selectedDish)}
              >
                {copy.addToSelection}
              </button>
              <button type="button" onClick={() => openWaiter("recommendation")}>
                {copy.askWaiter}
              </button>
              {hasModel ? (
                <button
                  type="button"
                  className={styles.modelCta}
                  aria-controls="trouvable-sheet-model"
                  aria-expanded={showDetailModelViewer}
                  onClick={() => {
                    resetArHandoffState();
                    setShowDetailModelViewer((isVisible) => {
                      if (displayMode === "public" && !isVisible && selectedDish) {
                        trackPublicMenuEvent(menu, {
                          eventName: "dish_3d_clicked",
                          dishSlug: selectedDish.slug,
                          categorySlug: selectedDish.categorySlug
                        });
                      }
                      return !isVisible;
                    });
                  }}
                >
                  {copy.threeD}
                </button>
              ) : null}
            </div>
            {showDetailModelViewer ? (
              <>
                <div
                  className={styles.inlineModelViewer}
                  id="trouvable-sheet-model"
                  data-no-dish-swipe="true"
                >
                  {ModelViewerComponent ? (
                    <ModelViewerComponent
                      dish={modelViewerDishFromPublicDish(selectedDish)}
                      analyticsContext={getPublicMenuAnalyticsContext(menu) ?? undefined}
                      minimalChrome
                      quietChrome
                      copy={{
                        loadingTitle: copy.modelPreparing,
                        ...copy.modelViewer,
                        modelAlt: copy.modelAlt
                      }}
                      onReturnToDish={() => {
                        setShowDetailModelViewer(false);
                        resetArHandoffState();
                      }}
                      onArFallbackNeeded={(reason: ArFallbackReason) => {
                        if (reason === "missing-ios-usdz") {
                          resetArHandoffState();
                          return;
                        }
                        setShowArBrowserHelp(true);
                      }}
                      onArFallbackCleared={resetArHandoffState}
                    />
                  ) : modelViewerLoadFailed ? (
                    <div className={styles.modelLoading} role="status">
                      {copy.modelUnavailable}
                    </div>
                  ) : (
                    <div className={styles.modelLoading} role="status">
                      {copy.modelPreparing}
                    </div>
                  )}
                </div>
                {showArBrowserHelp ? (
                  <aside
                    className={styles.arBrowserFallback}
                    aria-labelledby={arBrowserFallbackTitleId}
                    dir="auto"
                  >
                    <span className={styles.arBrowserFallbackIcon} aria-hidden="true">
                      <BrowserHandoffIcon />
                    </span>
                    <div className={styles.arBrowserFallbackContent}>
                      <h3 id={arBrowserFallbackTitleId}>{platformCopy.title}</h3>
                      <p>{platformCopy.body}</p>
                    </div>
                    <button
                      type="button"
                      className={styles.arCopyButton}
                      onClick={() => void copyDishUrl()}
                      disabled={arCopyStatus === "copying"}
                    >
                      <CopyIcon />
                      {platformCopy.action}
                    </button>
                    {arCopyStatus === "success" ? (
                      <p className={styles.arCopyStatus} role="status" aria-live="polite">
                        {platformCopy.success}
                      </p>
                    ) : null}
                    {arCopyStatus === "error" ? (
                      <div className={styles.arManualCopy}>
                        <p
                          className={styles.arCopyStatus}
                          role="alert"
                          aria-live="assertive"
                        >
                          {copy.arBrowserFallback.copyError}
                        </p>
                        <label htmlFor={manualDishUrlId}>
                          {copy.arBrowserFallback.manualCopyLabel}
                        </label>
                        <input
                          ref={manualDishUrlRef}
                          id={manualDishUrlId}
                          type="url"
                          readOnly
                          value={manualDishUrl}
                          onFocus={(event) => event.currentTarget.select()}
                        />
                        <button
                          type="button"
                          className={styles.arSelectLinkButton}
                          onClick={selectManualDishUrl}
                        >
                          {copy.arBrowserFallback.selectLink}
                        </button>
                      </div>
                    ) : null}
                  </aside>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              className={styles.reviewTrigger}
              aria-haspopup="dialog"
              onClick={openReviewSheet}
            >
              <span aria-hidden="true">★</span>
              {copy.review}
            </button>
          </div>
        </article>
      </div>
    );
  }

  const canShowBackToTop =
    showBackToTop &&
    activeSheet === null &&
    renderedSheet === null &&
    !showDetailModelViewer;

  return (
    <main
      ref={pageTopRef}
      tabIndex={-1}
      className={`${styles.page} ${typographyClassName} ${
        displayMode === "phone-preview" ? styles.phonePreview : ""
      }`.trim()}
      lang={selectedLocale}
      data-display-mode={displayMode}
      data-text-direction={textDirection}
      data-blueprint={config.experience.blueprint}
      data-copy-built-in-locale={copyResolution.builtInLocale}
      data-copy-dynamic-source={copyResolution.dynamicSource}
      data-copy-neutral-fallback={copyResolution.usedNeutralFallback ? "true" : "false"}
      data-copy-complete={copyResolution.uiCopyComplete ? "true" : "false"}
      data-locale-public-ready={
        copyResolution.uiCopyComplete && !copyResolution.usedNeutralFallback
          ? "true"
          : "false"
      }
      data-menu-translation-status={menu.translationStatus?.status ?? ""}
      onSubmit={
        displayMode === "phone-preview"
          ? (event) => event.preventDefault()
          : undefined
      }
      data-menu-ready-locales={menu.settings.supportedLocales.join(",")}
      data-menu-blocked-locales={
        menu.translationLocales
          ?.filter(
            (item) => item.status !== "source" && item.status !== "up_to_date"
          )
          .map((item) => `${item.locale}:${item.status}`)
          .join(",") ?? ""
      }
      data-menu-blocked-locale-reasons={
        menu.translationLocales
          ?.filter(
            (item) => item.status !== "source" && item.status !== "up_to_date"
          )
          .map((item) =>
            [
              item.locale,
              item.status,
              item.entityType,
              item.entityLabel ?? item.entityId,
              item.field,
              item.reason
            ]
              .filter(Boolean)
              .join(":")
          )
          .join("|") ?? ""
      }
      data-copy-missing-keys={copyResolution.missingKeys.length}
      data-copy-ignored-keys={copyResolution.ignoredKeys.length}
      data-theme={config.theme}
      data-user-theme={selectedTheme}
      style={
        {
          "--menu-bg": config.palette.background,
          "--menu-surface": config.palette.surface,
          "--menu-text": config.palette.text,
          "--menu-muted": config.palette.muted,
          "--menu-accent": config.palette.accent,
          "--menu-accent-2": config.palette.accent2,
          "--menu-accent-3": config.palette.accent3,
          "--menu-border": config.palette.border,
          "--menu-success": config.palette.success,
          "--menu-warning": config.palette.warning,
          "--menu-danger": config.palette.danger
        } as CSSProperties
      }
    >
      <div
        ref={backToTopSentinelRef}
        className={styles.backToTopSentinel}
        aria-hidden="true"
      />
      <AllergenWarning locale={selectedLocale} />
      <header ref={topBarRef} className={styles.topBar}>
        <div className={styles.brandBlock}>
          <VistaireWord />
          <small>{context || copy.menuContextFallback}</small>
        </div>
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.headerControl}
            aria-haspopup="dialog"
            aria-expanded={activeSheet === "currency"}
            aria-label={`${copy.currencyAria}: ${selectedCurrency}`}
            disabled={!canChangeCurrency}
            onClick={() => {
              if (canChangeCurrency) openSheet("currency");
            }}
          >
            {currencyOption.code}
          </button>
          {query?.table ? (
            <span className={styles.tableChip}>
              {copy.tableLabel} {query.table}
            </span>
          ) : null}
          <button
            type="button"
            className={styles.headerControl}
            aria-haspopup="dialog"
            aria-expanded={activeSheet === "language"}
            aria-label={`${copy.languageAria}: ${getTrouvableLanguageShortCode(selectedLocale)}`}
            disabled={!canChangeLanguage}
            onClick={() => {
              if (canChangeLanguage) openSheet("language");
            }}
          >
            {getTrouvableLanguageShortCode(selectedLocale)}
          </button>
          <button
            type="button"
            aria-label={
              selectedTheme === "dark" ? copy.themeLightAria : copy.themeDarkAria
            }
            aria-pressed={selectedTheme === "dark"}
            disabled={!canChangeTheme}
            onClick={toggleTheme}
          >
            {selectedTheme === "dark" ? "◐" : "☀"}
          </button>
          <button
            ref={selectionButtonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={activeSheet === "selection"}
            onClick={() => openSheet("selection")}
          >
            {copy.selection} {selectionCount > 0 ? selectionCount : ""}
          </button>
          <button
            ref={waiterButtonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={activeSheet === "waiter"}
            onClick={() => openWaiter("recommendation")}
          >
            {copy.server}
          </button>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="trouvable-hero-title">
        <HeroBotanicalOrnament />
        <div className={styles.heroText} dir={textDirection}>
          <p>{greetingLead}</p>
          <h1 id="trouvable-hero-title">{menu.name}</h1>
          <span>{copy.heroBlurb}</span>
        </div>
        <button type="button" onClick={() => setActiveCategory(ALL_CATEGORY_ID)}>
          {copy.heroAction}
        </button>
      </section>

      <section
        className={styles.menuPanel}
        aria-label={copy.menuAria}
      >
        <div className={styles.categoryHeader} data-no-category-swipe="true">
          <span>{copy.categories}</span>
          <span className={styles.swipeHint} aria-label={copy.swipeAria}>
            <span>{copy.swipeLabel}</span>
            <span aria-hidden="true">↔</span>
          </span>
        </div>
        <nav
          ref={categoryRailRef}
          className={styles.categoryRail}
          aria-label={copy.categoryAria}
          data-no-category-swipe="true"
        >
          {categoryOptions.map((category) => (
            <button
              key={category.id}
              type="button"
              {...(resolvedActiveCategory === category.id
                ? { "aria-current": true as const }
                : {})}
              onClick={() =>
                setActiveCategory(
                  resolvedActiveCategory === category.id
                    ? ALL_CATEGORY_ID
                    : category.id
                )
              }
            >
              <TrouvableCategoryIcon
                kind={getTrouvableCategoryIconKindForCategory(category)}
              />
              <span>{displayCategoryLabel(category.label)}</span>
              <small>{category.count}</small>
            </button>
          ))}
        </nav>

        <div
          className={styles.categorySwipeSurface}
          data-category-swipe-surface=""
          onPointerDownCapture={handleMenuCategoryPointerDown}
          onPointerUpCapture={handleMenuCategoryPointerUp}
          onPointerCancelCapture={() => {
            menuCategorySwipeRef.current = null;
          }}
        >
          <h2
            key={`title-${resolvedActiveCategory}`}
            className={`${styles.sectionTitle} ${styles.sectionBodyEnter}`}
            dir={textDirection}
          >
            {activeCategoryTitle}
          </h2>

        <div
          ref={toolsSentinelRef}
          className={styles.toolsSentinel}
          aria-hidden="true"
        />
        <div
          className={styles.tools}
          data-pinned={toolsPinned ? "true" : "false"}
          data-no-category-swipe="true"
        >
          <label className={styles.searchField}>
            <span>{copy.searchLabel}</span>
            <input
              ref={searchInputRef}
              id="trouvable-menu-search"
              type="search"
              autoComplete="off"
              aria-controls="trouvable-dish-results"
              placeholder={copy.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  searchInputRef.current?.focus();
                }}
              >
                {copy.clearSearch}
              </button>
            ) : null}
          </label>
          <button
            type="button"
            className={styles.filterTrigger}
            aria-haspopup="dialog"
            aria-expanded={activeSheet === "filters"}
            aria-label={`${copy.filtersAria}: ${filterButtonLabel}`}
            onClick={() => openSheet("filters")}
          >
            <span className={styles.filterGlyph} aria-hidden="true">
              <span />
            </span>
            <span>{filterButtonLabel}</span>
            {activeFilterLabels.length === 1 ? (
              <small aria-hidden="true">{copy.activeFilterPrefix}</small>
            ) : null}
          </button>
          <div className={styles.viewToggle} aria-label={copy.viewModeAria}>
            <button
              type="button"
              aria-pressed={viewMode === "list"}
              aria-label={copy.listAria}
              onClick={() => setViewMode("list")}
            >
              ☷
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "grid"}
              aria-label={copy.gridAria}
              onClick={() => setViewMode("grid")}
            >
              ▦
            </button>
          </div>
          <p className={styles.resultStatus} aria-live="polite">
            {copy.resultStatus(viewLabel, visibleDishes.length)}
          </p>
        </div>

        <div
          key={resolvedActiveCategory}
          className={`${styles.sectionBody} ${styles.sectionBodyEnter}`}
        >
          {visibleDishes.length === 0 ? (
            <div className={styles.emptyState} role="status">
              <p>{copy.noResultsTitle}</p>
              <span>{copy.noResultsBody}</span>
              <button type="button" onClick={clearFilters}>
                {copy.reset}
              </button>
            </div>
          ) : (
            <ul
              id="trouvable-dish-results"
              className={`${styles.dishList} ${
                viewMode === "grid" ? styles.dishGrid : ""
              }`}
            >
              {visibleDishes.map((dish, index) => renderDishCard(dish, index))}
            </ul>
          )}
        </div>
        </div>
      </section>

      <div className={styles.statusRegion} aria-live="polite">
        {localMessage}
      </div>

      <button
        type="button"
        className={styles.backToTop}
        data-visible={canShowBackToTop ? "true" : "false"}
        aria-label={copy.backToTop}
        title={copy.backToTop}
        aria-hidden={!canShowBackToTop}
        tabIndex={canShowBackToTop ? 0 : -1}
        onClick={handleBackToTop}
      >
        <BackToTopIcon />
        <span>{copy.backToTop}</span>
      </button>

      <GoogleReviewCard
        googleReview={menu.googleReview}
        locale={selectedLocale}
        localizedUiCopy={menu.localizedUiCopy}
        menuId={menu.menuId}
        onReviewRequest={openRestaurantReviewSheet}
        restaurantId={menu.restaurantId}
        restaurantName={menu.name}
        showNote={false}
        source={menu.source}
      />

      {renderDishDetailSheet()}
      {renderDishDetailsSubSheet()}
      {renderSelectionSheet()}
      {renderWaiterSheet()}
      {renderCurrencySheet()}
      {renderFiltersSheet()}
      {renderLanguageSheet()}
      {renderReviewSheet()}
    </main>
  );
}
