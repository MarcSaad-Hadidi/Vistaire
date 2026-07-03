"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent
} from "react";
import type { DishModelViewerProps } from "@/components/dish/DishModelViewer";
import type { MenuExchangeRates } from "@/lib/currency/formatMenuPrice";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
import {
  getTrouvableCategoryIconKind,
  type TrouvableCategoryIconKind
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
import { GoogleReviewCard } from "./GoogleReviewCard";
import { trackGoogleReviewClick } from "./googleReviewTracking";
import {
  TROUVABLE_CURRENCY_STORAGE_KEY,
  TROUVABLE_LOCALE_STORAGE_KEY,
  TROUVABLE_THEME_STORAGE_KEY,
  formatTrouvableDishPrice,
  formatTrouvablePriceCents,
  getTrouvableCurrencyOptions,
  getTrouvableCopy,
  getTrouvableCurrencyOption,
  getTrouvableCurrencyOptionLabel,
  getTrouvableDishConvertedPriceCents,
  getTrouvableGreetingForDate,
  getTrouvableLanguageOptions,
  getTrouvableTextDirection,
  isTrouvableLocaleSupported,
  normalizeTrouvableCurrency,
  normalizeTrouvableLocaleForSettings,
  normalizeTrouvableTheme,
  buildNavigableMenuSections,
  getAdjacentMenuSection,
  translateTrouvableCategoryLabel,
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
type SwipeStart = {
  x: number;
  y: number;
  pointerId: number;
  scrollLeft?: number;
} | null;
type SelectionItem = {
  dish: PublicMenuDish;
  quantity: number;
};
type DishModelViewerComponent = ComponentType<DishModelViewerProps>;

const ALL_CATEGORY_ID = "all";
const ALLOWED_3D_CDN_ORIGINS = (process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "")
  .split(/[,\s]+/)
  .map((entry) => entry.trim().replace(/\/+$/, ""))
  .filter(Boolean);
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
const ALLERGEN_FILTER_TERMS: Record<
  Exclude<
    QuickFilterId,
    "all" | "veg" | "nonVeg" | "available" | "immersive" | "recommended"
  >,
  string[]
> = {
  glutenFree: ["gluten", "wheat", "ble"],
  dairyFree: [
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
  nutFree: ["nut", "nuts", "noix", "amande", "amandes", "noisette", "pistache"],
  shellfishFree: ["shellfish", "crustace", "crustaces", "homard", "crevette", "crabe"],
  eggFree: ["egg", "eggs", "oeuf", "oeufs"],
  sesameFree: ["sesame"],
  soyFree: ["soy", "soya", "soja"],
  fishFree: ["fish", "poisson", "saumon", "thon"]
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatBadgeLabel(value: string, locale: TrouvableLocale): string {
  const copy = getTrouvableCopy(locale);
  const label = value.trim();
  const normalized = normalizeText(label);
  if (normalized === "recommande" || normalized === "recommended") {
    return copy.recommendation;
  }
  if (normalized === "popular" || normalized === "populaire") return copy.popular;
  return label;
}

function displayCategoryLabel(label: string, locale: TrouvableLocale): string {
  const translated = translateTrouvableCategoryLabel(label, locale);
  return translated.length > 12 ? `${translated.slice(0, 10).trim()}...` : translated;
}

function CategoryIcon({ kind }: { kind: TrouvableCategoryIconKind }) {
  if (kind === "all") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M12 12h10v10H12zm14 0h10v10H26zM12 26h10v10H12zm14 0h10v10H26z" />
      </svg>
    );
  }

  if (kind === "classic") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M13 18c6-7 16-8 22-2 5 5 5 13 0 18-6 6-16 5-22-2" />
        <path d="M18 22h12M18 28h14" />
      </svg>
    );
  }

  if (kind === "starter") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M11 30c4-9 22-9 26 0H11Z" />
        <path d="M14 25c3-5 17-5 20 0M24 14v7M18 17l3 4M30 17l-3 4" />
      </svg>
    );
  }

  if (kind === "flame") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 39c-7 0-12-5-12-12 0-6 4-10 8-14 0 5 4 7 4 11 3-4 4-8 3-14 6 5 9 10 9 17 0 7-5 12-12 12Z" />
        <path d="M24 34c-3 0-5-2-5-5 0-2 1-4 4-7 1 3 4 4 4 7 0 3-1 5-3 5Z" />
      </svg>
    );
  }

  if (kind === "travel") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 39c7-7 11-13 11-19a11 11 0 0 0-22 0c0 6 4 12 11 19Z" />
        <path d="M24 24a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      </svg>
    );
  }

  if (kind === "pasta") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M13 34c4-7 18-7 22 0H13Z" />
        <path d="M17 27c2-4 4-4 6 0s4 4 6 0 4-4 6 0M17 14v13M23 14v13M29 14v13M35 14v13" />
      </svg>
    );
  }

  if (kind === "morning") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M13 29a11 11 0 0 1 22 0" />
        <path d="M24 10v6M12 18l4 4M36 18l-4 4M9 34h30" />
      </svg>
    );
  }

  if (kind === "dessert") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M11 24h26l-4 14H15l-4-14Z" />
        <path d="M15 24c1-6 6-9 9-9s8 3 9 9M20 15l4-5 4 5" />
      </svg>
    );
  }

  if (kind === "fresh") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M38 10C24 10 12 19 10 34c15 2 25-8 28-24Z" />
        <path d="M12 34c8-9 14-13 26-24" />
      </svg>
    );
  }

  if (kind === "drinks") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M16 10h16l-3 14a5 5 0 0 1-10 0L16 10Z" />
        <path d="M24 29v9M18 38h12M18 17h12" />
      </svg>
    );
  }

  if (kind === "chef") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M15 21c-3-5 2-10 7-7 3-5 10-3 10 3 5-1 8 5 4 9H15Z" />
        <path d="M16 26h20v10H16zM20 31h8" />
      </svg>
    );
  }

  if (kind === "cloche") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M11 32c2-10 8-16 13-16s11 6 13 16H11Z" />
        <path d="M9 36h30M24 12v4" />
      </svg>
    );
  }

  if (kind === "garden") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 38V18" />
        <path d="M24 26c-8 0-12-5-12-11 8 0 12 5 12 11Zm0 4c8 0 12-5 12-11-8 0-12 5-12 11Z" />
      </svg>
    );
  }

  if (kind === "cellar") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M18 12h12l-2 8v15a6 6 0 0 1-12 0V20l2-8Z" />
        <path d="M17 25h12M20 17h8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M12 28c5-8 19-8 24 0M14 35h20M24 13v8" />
    </svg>
  );
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

function dishHasAllergenTerm(dish: PublicMenuDish, terms: string[]): boolean {
  const allergenText = normalizeText(dish.allergens.join(" "));
  return terms.some((term) => allergenText.includes(normalizeText(term)));
}

function isVegDish(dish: PublicMenuDish): boolean {
  return dishHasAnyTerm(dish, VEG_TERMS) && !isNonVegDish(dish);
}

function isNonVegDish(dish: PublicMenuDish): boolean {
  return dishHasAnyTerm(dish, MEAT_TERMS);
}

function dishMetaLine(dish: PublicMenuDish, locale: TrouvableLocale): string {
  const copy = getTrouvableCopy(locale);
  const calorieTag = dish.tags.find((tag) =>
    /\b\d{2,4}\s*(cal|calorie|calories|kcal)\b/i.test(tag)
  );
  if (calorieTag) return calorieTag;
  if (dish.ingredients.length > 0) {
    return copy.ingredientsCount(dish.ingredients.length);
  }
  return dish.available
    ? translateTrouvableCategoryLabel(dish.category, locale)
    : copy.soldOut;
}

function dishBadges(dish: PublicMenuDish, locale: TrouvableLocale): string[] {
  const copy = getTrouvableCopy(locale);
  const badges = new Set<string>();
  for (const tag of dish.tags) {
    if (tag.trim()) badges.add(formatBadgeLabel(tag, locale));
  }
  if (
    normalizeText(`${dish.name} ${dish.description} ${dish.houseNote}`).includes(
      "maison"
    )
  ) {
    badges.add("Maison");
  }
  if (!dish.available) badges.add(copy.soldOut);
  if (dish.has3d) badges.add("3D");
  if (dish.hasAr) badges.add("AR");
  return Array.from(badges).slice(0, 5);
}

function isRecommendedDish(dish: PublicMenuDish): boolean {
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

function quickFilterMatches(dish: PublicMenuDish, filter: QuickFilterId): boolean {
  if (filter === "all") return true;
  if (filter === "veg") return isVegDish(dish);
  if (filter === "nonVeg") return isNonVegDish(dish);
  if (filter === "available") return dish.available;
  if (filter === "immersive") return dish.has3d || dish.hasAr || dish.hasImmersive;
  if (filter === "recommended") return isRecommendedDish(dish);
  if (filter in ALLERGEN_FILTER_TERMS) {
    return !dishHasAllergenTerm(
      dish,
      ALLERGEN_FILTER_TERMS[
        filter as keyof typeof ALLERGEN_FILTER_TERMS
      ]
    );
  }
  return true;
}

function hasPublic3d(dish: PublicMenuDish): boolean {
  return (
    isSafe3dAssetUrl(
      dish.webModel3dUrl || dish.model3dUrl,
      ALLOWED_3D_CDN_ORIGINS,
      "web"
    ) ||
    isSafe3dAssetUrl(dish.arModel3dUrl, ALLOWED_3D_CDN_ORIGINS, "arLite")
  );
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
          alt={`Photo de ${dish.name}`}
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

export function TrouvablePremiumMenuExperience({
  menu,
  config,
  context = "",
  exchangeRates,
  query,
  typographyClassName = ""
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
    normalizeTrouvableLocaleForSettings(query?.lang, menu.settings)
  );
  const [selectedCurrency, setSelectedCurrency] =
    useState<TrouvableCurrency>(() =>
      normalizeTrouvableCurrency(undefined, menu.settings)
    );
  const [selectedTheme, setSelectedTheme] = useState<TrouvableTheme>(() =>
    normalizeTrouvableTheme(undefined, menu.settings)
  );
  const [greeting, setGreeting] = useState("");
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
  const categoryRailRef = useRef<HTMLElement | null>(null);
  const categorySwipeRef = useRef<SwipeStart>(null);
  const dishSwipeRef = useRef<SwipeStart>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const copy = getTrouvableCopy(selectedLocale, menu.localizedUiCopy);
  const textDirection = getTrouvableTextDirection(selectedLocale);
  const currencyOption = getTrouvableCurrencyOption(selectedCurrency);
  const currencyOptions = useMemo(
    () => getTrouvableCurrencyOptions(menu.settings),
    [menu.settings]
  );
  const languageOptions = useMemo(
    () => getTrouvableLanguageOptions(menu.settings, selectedLocale),
    [menu.settings, selectedLocale]
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

  const categories = useMemo(
    () => getVisiblePublicMenuCategories(menu.dishes),
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
    () => menu.dishes.some((dish) => dish.allergens.length > 0),
    [menu.dishes]
  );
  const quickFilters = useMemo(
    () =>
      [
        { id: "all" as const, label: copy.all, visible: true },
        { id: "veg" as const, label: copy.veg, visible: hasVegData },
        { id: "nonVeg" as const, label: copy.nonVeg, visible: hasNonVegData },
        { id: "available" as const, label: copy.available, visible: true },
        { id: "immersive" as const, label: "3D / AR", visible: hasImmersiveData },
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
    () => getVisiblePublicMenuCategories(filteredDishes),
    [filteredDishes]
  );
  const categoryOptions = useMemo(
    () =>
      categories.length > 0
        ? categories
        : [
            {
              id: ALL_CATEGORY_ID,
              label: copy.all,
              description: copy.activeCategoryAll,
              tone: "yellow" as const,
              count: filteredDishes.length
            }
          ],
    [categories, copy, filteredDishes.length]
  );
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
      : translateTrouvableCategoryLabel(
          resolvedCategory?.label ?? resolvedActiveCategory,
          selectedLocale
        );
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
  const greetingText = greeting || copy.greeting.afternoon;
  const viewLabel = viewMode === "grid" ? copy.viewGrid : copy.viewList;

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
    setActiveSheet(null);
    setSelectedDish(null);
    setDishSubSheet(null);
    setShowDetailModelViewer(false);
    setShowArBrowserHelp(false);
    restoreFocus();
  }, [restoreFocus]);

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
        ? normalizeTrouvableLocaleForSettings(query.lang, menu.settings)
        : null;
      const storedLocale = window.localStorage.getItem(TROUVABLE_LOCALE_STORAGE_KEY);
      const storedCurrency = window.localStorage.getItem(
        TROUVABLE_CURRENCY_STORAGE_KEY
      );
      const storedTheme = window.localStorage.getItem(TROUVABLE_THEME_STORAGE_KEY);
      const defaultLocale = normalizeTrouvableLocaleForSettings(
        undefined,
        menu.settings
      );
      const activeServerLocale = normalizeTrouvableLocaleForSettings(
        menu.activeLocale,
        menu.settings
      );
      const normalizedStoredLocale = storedLocale
        ? normalizeTrouvableLocaleForSettings(storedLocale, menu.settings)
        : null;

      if (
        !queryLocale &&
        normalizedStoredLocale &&
        normalizedStoredLocale !== defaultLocale &&
        normalizedStoredLocale !== activeServerLocale &&
        isTrouvableLocaleSupported(normalizedStoredLocale, menu.settings)
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
  }, [menu.activeLocale, menu.settings, query?.lang, replaceLocaleInUrl]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    window.localStorage.setItem(TROUVABLE_LOCALE_STORAGE_KEY, selectedLocale);
    window.localStorage.setItem(TROUVABLE_CURRENCY_STORAGE_KEY, selectedCurrency);
    window.localStorage.setItem(TROUVABLE_THEME_STORAGE_KEY, selectedTheme);
  }, [preferencesLoaded, selectedCurrency, selectedLocale, selectedTheme]);

  useEffect(() => {
    function syncGreeting() {
      setGreeting(
        getTrouvableGreetingForDate(
          selectedLocale,
          menu.settings.timezone,
          new Date()
        )
      );
    }

    syncGreeting();
    const intervalId = window.setInterval(syncGreeting, 60_000);
    return () => window.clearInterval(intervalId);
  }, [menu.settings.timezone, selectedLocale]);

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
    if (!activeSheet) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const activeDialog =
      activeSheet === "dish" && dishSubSheet ? subSheetRef.current : sheetRef.current;
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
        activeSheet === "dish" && dishSubSheet ? subSheetRef.current : sheetRef.current;
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
          setShowArBrowserHelp(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ModelViewerComponent, modelViewerLoadFailed, showDetailModelViewer]);

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
    if (!isTrouvableLocaleSupported(nextLocale, menu.settings)) return;
    setSelectedLocale(nextLocale);
    window.localStorage.setItem(TROUVABLE_LOCALE_STORAGE_KEY, nextLocale);
    replaceLocaleInUrl(nextLocale);
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
      ? `Table ${tableNumber.trim()}`
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

  function handleCategoryPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") return;
    categorySwipeRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      scrollLeft: event.currentTarget.scrollLeft
    };
  }

  function handleCategoryPointerUp(event: PointerEvent<HTMLElement>) {
    const start = categorySwipeRef.current;
    categorySwipeRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    if (
      start.scrollLeft !== undefined &&
      Math.abs(event.currentTarget.scrollLeft - start.scrollLeft) > 4
    ) {
      return;
    }
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 46 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    selectAdjacentCategory(deltaX < 0 ? 1 : -1);
  }

  function openDishDetail(dish: PublicMenuDish) {
    setDishSubSheet(null);
    setShowDetailModelViewer(false);
    setShowArBrowserHelp(false);
    setSelectedDish(dish);
    openSheet("dish");
  }

  function selectAdjacentDish(direction: 1 | -1) {
    if (!selectedDish || visibleDishes.length < 2) return;
    const currentIndex = visibleDishes.findIndex((dish) => dish.id === selectedDish.id);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + visibleDishes.length) % visibleDishes.length;
    setDishSubSheet(null);
    setShowDetailModelViewer(false);
    setShowArBrowserHelp(false);
    setSelectedDish(visibleDishes[nextIndex] ?? selectedDish);
  }

  function handleDishPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") return;
    if (dishSubSheet || isDishSwipeGuardedTarget(event.target, event.currentTarget)) {
      return;
    }
    dishSwipeRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId
    };
  }

  function handleDishPointerUp(event: PointerEvent<HTMLElement>) {
    const start = dishSwipeRef.current;
    dishSwipeRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    if (dishSubSheet || isDishSwipeGuardedTarget(event.target, event.currentTarget)) {
      return;
    }
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 46 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    selectAdjacentDish(deltaX < 0 ? 1 : -1);
  }

  function renderDishCard(dish: PublicMenuDish, index: number) {
    const href = buildPublicDishPath(menu.slug, dish.slug, localizedQuery);
    const badges = dishBadges(dish, selectedLocale);
    const isFeatured = index === 0;
    const priceLabel = formatTrouvableDishPrice(
      dish,
      selectedCurrency,
      selectedLocale,
      exchangeRates
    );

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
              <small>{dishMetaLine(dish, selectedLocale)}</small>
              {priceLabel ? (
                <span className={styles.dishPrice}>{priceLabel}</span>
              ) : null}
              <span className={styles.badges}>
                {badges.map((badge) => (
                  <span key={badge}>{badge}</span>
                ))}
              </span>
            </span>
          </button>
          <div className={styles.cardActions}>
            <Link href={href} prefetch={false}>
              {copy.details}
            </Link>
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
    if (activeSheet !== "selection") return null;

    return (
      <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-selection-title"
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
    if (activeSheet !== "waiter") return null;

    return (
      <div
        className={styles.overlay}
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
            Table
            <input
              id="trouvable-waiter-table"
              inputMode="numeric"
              maxLength={24}
              name="table"
              placeholder="Ex. 12"
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
    if (activeSheet !== "currency" || !canChangeCurrency) return null;

    return (
      <div
        className={styles.overlay}
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
    if (activeSheet !== "filters") return null;

    return (
      <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-filters-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeActiveSheet();
        }}
      >
        <section ref={sheetRef} className={styles.sheet} tabIndex={-1}>
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
    if (activeSheet !== "language" || !canChangeLanguage) return null;

    const sheetLanguageOptions = languageOptions;

    return (
      <div
        className={styles.overlay}
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
                onClick={() => selectLocale(option.locale)}
              >
                <span>{option.locale.toUpperCase()}</span>
                <small>{option.label}</small>
              </button>
            ))}
          </div>
          <p className={styles.localHint}>{copy.languageCopy}</p>
        </section>
      </div>
    );
  }

  function renderReviewSheet() {
    if (
      activeSheet !== "review" &&
      activeSheet !== "experienceReview" &&
      !(activeSheet === "dish" && dishSubSheet === "review")
    ) {
      return null;
    }

    const isExperienceReview = activeSheet === "experienceReview";
    const isDishStackReview = activeSheet === "dish" && dishSubSheet === "review";
    const reviewDish = isExperienceReview ? null : selectedDish;
    const closeReview = isDishStackReview ? closeDishSubSheet : closeActiveSheet;
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
        className={`${styles.overlay} ${styles.reviewOverlay} ${
          isDishStackReview ? styles.stackedOverlay : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-review-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeReview();
        }}
        data-no-dish-swipe="true"
      >
        <section
          ref={isDishStackReview ? subSheetRef : sheetRef}
          className={styles.reviewSheet}
          tabIndex={-1}
        >
          <button
            type="button"
            className={styles.reviewClose}
            aria-label={copy.reviewClose}
            onClick={closeReview}
          >
            x
          </button>
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
    if (activeSheet !== "dish" || dishSubSheet !== "details" || !selectedDish) {
      return null;
    }

    const visibleTags = selectedDish.tags.filter(Boolean);

    return (
      <div
        className={`${styles.overlay} ${styles.stackedOverlay}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-dish-details-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDishSubSheet();
        }}
        data-no-dish-swipe="true"
      >
        <section
          ref={subSheetRef}
          id={`trouvable-dish-more-details-${selectedDish.slug}`}
          className={`${styles.sheet} ${styles.detailsSubSheet}`}
          tabIndex={-1}
        >
          <header className={styles.sheetHeader}>
            <div>
              <p>{selectedDish.name}</p>
              <h2 id="trouvable-dish-details-title">{copy.moreDetails}</h2>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={copy.closeDetail}
              onClick={closeDishSubSheet}
            >
              x
            </button>
          </header>
          {selectedDish.description ? (
            <p className={styles.moreDetailsText}>{selectedDish.description}</p>
          ) : null}
          {visibleTags.length > 0 ? (
            <section className={styles.detailList}>
              <h3>{copy.tags}</h3>
              <ul>
                {visibleTags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {selectedDish.ingredients.length > 0 ? (
            <section className={styles.detailList}>
              <h3>{copy.ingredients}</h3>
              <ul>
                {selectedDish.ingredients.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {selectedDish.allergens.length > 0 ? (
            <section className={styles.detailList}>
              <h3>{copy.allergens}</h3>
              <ul>
                {selectedDish.allergens.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {selectedDish.options.length > 0 ? (
            <section className={styles.detailList}>
              <h3>{copy.options}</h3>
              <ul>
                {selectedDish.options.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {selectedDish.houseNote ? (
            <section className={styles.houseNote}>
              <h3>{copy.houseNote}</h3>
              <p>{selectedDish.houseNote}</p>
            </section>
          ) : null}
        </section>
      </div>
    );
  }

  function renderDishDetailSheet() {
    if (activeSheet !== "dish" || !selectedDish) return null;

    const badges = dishBadges(selectedDish, selectedLocale);
    const hasModel = hasPublic3d(selectedDish);
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

    return (
      <div
        className={`${styles.overlay} ${styles.dishOverlay}`}
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
              {copy.moreDetails}
            </button>
            {badges.length > 0 ? (
              <div className={styles.badges}>
                {badges.map((badge) => (
                  <span key={badge}>{badge}</span>
                ))}
              </div>
            ) : null}
            {selectedDish.ingredients.length > 0 ? (
              <section className={styles.detailList}>
                <h3>{copy.ingredients}</h3>
                <ul>
                  {selectedDish.ingredients.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {selectedDish.allergens.length > 0 ? (
              <section className={styles.detailList}>
                <h3>{copy.allergens}</h3>
                <ul>
                  {selectedDish.allergens.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {selectedDish.options.length > 0 ? (
              <section className={styles.detailList}>
                <h3>{copy.options}</h3>
                <ul>
                  {selectedDish.options.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {selectedDish.houseNote ? (
              <section className={styles.houseNote}>
                <h3>{copy.houseNote}</h3>
                <p>{selectedDish.houseNote}</p>
              </section>
            ) : null}
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
                    setShowArBrowserHelp(false);
                    setShowDetailModelViewer((isVisible) => !isVisible);
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
                      minimalChrome
                      quietChrome
                      onReturnToDish={() => {
                        setShowDetailModelViewer(false);
                        setShowArBrowserHelp(false);
                      }}
                      onArFallbackNeeded={() => setShowArBrowserHelp(true)}
                      onArFallbackCleared={() => setShowArBrowserHelp(false)}
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
                {showArBrowserHelp || modelViewerLoadFailed ? (
                  <p className={styles.arBrowserHelp}>
                    {copy.arBrowserHelp}{" "}
                    <Link href={browserDishHref} target="_blank" rel="noopener noreferrer">
                      {copy.arBrowserLink}
                    </Link>
                  </p>
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

  return (
    <main
      className={`${styles.page} ${typographyClassName}`.trim()}
      lang={selectedLocale}
      data-text-direction={textDirection}
      data-blueprint={config.experience.blueprint}
      data-theme={config.theme}
      data-user-theme={selectedTheme}
    >
      <header className={styles.topBar}>
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
          {query?.table ? <span className={styles.tableChip}>Table {query.table}</span> : null}
          <button
            type="button"
            className={styles.headerControl}
            aria-haspopup="dialog"
            aria-expanded={activeSheet === "language"}
            aria-label={`${copy.languageAria}: ${selectedLocale.toUpperCase()}`}
            disabled={!canChangeLanguage}
            onClick={() => {
              if (canChangeLanguage) openSheet("language");
            }}
          >
            {selectedLocale.toUpperCase()}
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

      <section className={styles.hero} aria-label={`Menu ${menu.name}`}>
        <HeroBotanicalOrnament />
        <div className={styles.heroText} dir={textDirection}>
          <p>{greetingText}</p>
          <h1>{menu.name}</h1>
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
        <div className={styles.categoryHeader}>
          <span>{copy.categories}</span>
          <span className={styles.swipeHint}>{copy.swipeList}</span>
        </div>
        <nav
          ref={categoryRailRef}
          className={styles.categoryRail}
          aria-label={copy.categoryAria}
          onPointerDown={handleCategoryPointerDown}
          onPointerUp={handleCategoryPointerUp}
          onPointerCancel={() => {
            categorySwipeRef.current = null;
          }}
        >
          <button
            type="button"
            aria-current={resolvedActiveCategory === ALL_CATEGORY_ID}
            onClick={() => setActiveCategory(ALL_CATEGORY_ID)}
          >
            <CategoryIcon kind="all" />
            <span>{copy.all}</span>
            <small>{filteredDishes.length}</small>
          </button>
          {categoryOptions.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-current={resolvedActiveCategory === category.id}
              onClick={() =>
                setActiveCategory((current) =>
                  current === category.id ? ALL_CATEGORY_ID : category.id
                )
              }
            >
              <CategoryIcon kind={getTrouvableCategoryIconKind(category.label)} />
              <span>{displayCategoryLabel(category.label, selectedLocale)}</span>
              <small>{category.count}</small>
            </button>
          ))}
        </nav>

        <h2
          key={`title-${resolvedActiveCategory}`}
          className={`${styles.sectionTitle} ${styles.sectionBodyEnter}`}
          dir={textDirection}
        >
          {activeCategoryTitle}
        </h2>

        <div className={styles.tools}>
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
      </section>

      <div className={styles.statusRegion} aria-live="polite">
        {localMessage}
      </div>

      <GoogleReviewCard
        googleReview={menu.googleReview}
        locale={selectedLocale}
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
