"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent
} from "react";
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
import { GoogleReviewCard } from "./GoogleReviewCard";
import styles from "./TrouvablePremiumMenuExperience.module.css";

type TrouvablePremiumMenuExperienceProps = {
  menu: PublicMenu;
  config: MenuUiConfig;
  context?: string;
  query?: PublicMenuContextQuery;
};

type QuickFilterId =
  | "all"
  | "veg"
  | "nonVeg"
  | "available"
  | "immersive"
  | "recommended";
type ViewMode = "list" | "grid";
type WaiterTopic = "allergen" | "recommendation" | "selection";
type ActiveSheet = "dish" | "selection" | "waiter" | "review" | null;
type CategoryIconKind = "pizza" | "leaf" | "cake" | "burger" | "fish" | "spark";
type SwipeStart = {
  x: number;
  y: number;
  pointerId: number;
} | null;
type SelectionItem = {
  dish: PublicMenuDish;
  quantity: number;
};

const ALL_CATEGORY_ID = "all";
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
const SPICY_TERMS = [
  "chili",
  "epice",
  "epicee",
  "epices",
  "jalapeno",
  "piment",
  "piquant",
  "spicy",
  "sriracha"
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatBadgeLabel(value: string): string {
  const label = value.trim();
  const normalized = normalizeText(label);
  if (normalized === "recommande" || normalized === "recommended") return "Recommandé";
  if (normalized === "popular") return "Populaire";
  return label;
}

function categoryIconKind(label: string): CategoryIconKind {
  const normalized = normalizeText(label);
  if (normalized.includes("pizza")) return "pizza";
  if (
    normalized.includes("salad") ||
    normalized.includes("salade") ||
    normalized.includes("veg")
  ) {
    return "leaf";
  }
  if (
    normalized.includes("cake") ||
    normalized.includes("dessert") ||
    normalized.includes("gateau")
  ) {
    return "cake";
  }
  if (normalized.includes("burger")) return "burger";
  if (
    normalized.includes("fish") ||
    normalized.includes("poisson") ||
    normalized.includes("sea") ||
    normalized.includes("mer")
  ) {
    return "fish";
  }
  return "spark";
}

function displayCategoryLabel(label: string): string {
  return label.length > 12 ? `${label.slice(0, 10).trim()}...` : label;
}

function CategoryIcon({ kind }: { kind: CategoryIconKind }) {
  if (kind === "pizza") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M9 39 39 9c-9-4-24 2-30 30Z" />
        <path d="M18 30a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm8-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      </svg>
    );
  }

  if (kind === "leaf") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M38 10C24 10 12 19 10 34c15 2 25-8 28-24Z" />
        <path d="M12 34c8-9 14-13 26-24" />
      </svg>
    );
  }

  if (kind === "cake") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M10 22h28v16H10z" />
        <path d="M14 16h20v6H14zM16 16c0-5 6-5 6 0m4 0c0-5 6-5 6 0" />
      </svg>
    );
  }

  if (kind === "burger") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M10 21c2-7 8-10 14-10s12 3 14 10H10Zm0 6h28M12 34h24" />
        <path d="M15 21h2m7 0h2m7 0h2" />
      </svg>
    );
  }

  if (kind === "fish") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M8 24c9-10 22-10 30 0-8 10-21 10-30 0Z" />
        <path d="M38 24 44 14v20l-6-10ZM16 24h.1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 8v32M8 24h32M14 14l20 20M34 14 14 34" />
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

function isVegDish(dish: PublicMenuDish): boolean {
  return dishHasAnyTerm(dish, VEG_TERMS) && !isNonVegDish(dish);
}

function isNonVegDish(dish: PublicMenuDish): boolean {
  return dishHasAnyTerm(dish, MEAT_TERMS);
}

function isSpicyDish(dish: PublicMenuDish): boolean {
  return dishHasAnyTerm(dish, SPICY_TERMS);
}

function dishMetaLine(dish: PublicMenuDish): string {
  const calorieTag = dish.tags.find((tag) =>
    /\b\d{2,4}\s*(cal|calorie|calories|kcal)\b/i.test(tag)
  );
  if (calorieTag) return calorieTag;
  if (dish.ingredients.length > 0) {
    return `${dish.ingredients.length} ingrédients`;
  }
  return dish.available ? dish.category : "Indisponible";
}

function dishBadges(dish: PublicMenuDish): string[] {
  const badges = new Set<string>();
  for (const tag of dish.tags) {
    if (tag.trim()) badges.add(formatBadgeLabel(tag));
  }
  if (
    normalizeText(`${dish.name} ${dish.description} ${dish.houseNote}`).includes(
      "maison"
    )
  ) {
    badges.add("Maison");
  }
  if (!dish.available) badges.add("Indisponible");
  if (dish.has3d) badges.add("4D");
  if (dish.hasAr) badges.add("AR");
  return Array.from(badges).slice(0, 5);
}

function isRecommendedDish(dish: PublicMenuDish): boolean {
  const text = searchableDishText(dish);
  return ["signature", "populaire", "popular", "recommande", "recommended"].some(
    (term) => text.includes(term)
  );
}

function parseDishPrice(dish: PublicMenuDish): number | null {
  const normalized = dish.priceLabel
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD"
  }).format(value);
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

function buildMenuHref(
  menu: PublicMenu,
  query: PublicMenuContextQuery | undefined,
  lang: "fr" | "en"
): string {
  const params = new URLSearchParams();
  params.set("lang", lang);
  const table = query?.table?.toString().trim();
  const zone = query?.zone?.toString().trim();
  const view = query?.view?.toString().trim();
  if (table) params.set("table", table.slice(0, 24));
  if (zone) params.set("zone", zone.slice(0, 24));
  if (view) params.set("view", view.slice(0, 24));
  return `/menu/${encodeURIComponent(menu.slug)}?${params.toString()}`;
}

function quickFilterMatches(dish: PublicMenuDish, filter: QuickFilterId): boolean {
  if (filter === "all") return true;
  if (filter === "veg") return isVegDish(dish);
  if (filter === "nonVeg") return isNonVegDish(dish);
  if (filter === "available") return dish.available;
  if (filter === "immersive") return dish.has3d || dish.hasAr || dish.hasImmersive;
  if (filter === "recommended") return isRecommendedDish(dish);
  return true;
}

function DishVisual({ dish, menu }: { dish: PublicMenuDish; menu: PublicMenu }) {
  if (dish.imageUrl) {
    return (
      <span className={styles.dishVisual}>
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

export function TrouvablePremiumMenuExperience({
  menu,
  config,
  context = "",
  query
}: TrouvablePremiumMenuExperienceProps) {
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY_ID);
  const [quickFilter, setQuickFilter] = useState<QuickFilterId>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedDish, setSelectedDish] = useState<PublicMenuDish | null>(null);
  const [selection, setSelection] = useState<Map<string, SelectionItem>>(
    () => new Map()
  );
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [waiterTopic, setWaiterTopic] = useState<WaiterTopic>("recommendation");
  const [tableNumber, setTableNumber] = useState(query?.table?.slice(0, 24) ?? "");
  const [localMessage, setLocalMessage] = useState("");
  const [waiterMessage, setWaiterMessage] = useState("");
  const sheetRef = useRef<HTMLElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectionButtonRef = useRef<HTMLButtonElement | null>(null);
  const waiterButtonRef = useRef<HTMLButtonElement | null>(null);
  const categorySwipeRef = useRef<SwipeStart>(null);
  const dishSwipeRef = useRef<SwipeStart>(null);

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
  const quickFilters = useMemo(
    () =>
      [
        { id: "all" as const, label: "Tout", visible: true },
        { id: "veg" as const, label: "Veg", visible: hasVegData },
        { id: "nonVeg" as const, label: "Non", visible: hasNonVegData },
        { id: "available" as const, label: "Dispo", visible: true },
        { id: "immersive" as const, label: "3D / AR", visible: hasImmersiveData },
        {
          id: "recommended" as const,
          label: "Signature",
          visible: hasRecommendedData
        }
      ].filter((filter) => filter.visible),
    [hasImmersiveData, hasNonVegData, hasRecommendedData, hasVegData]
  );

  const filteredDishes = useMemo(() => {
    const searchQuery = normalizeText(search.trim());
    return menu.dishes.filter((dish) => {
      if (!quickFilterMatches(dish, quickFilter)) return false;
      if (!searchQuery) return true;
      return searchableDishText(dish).includes(searchQuery);
    });
  }, [menu.dishes, quickFilter, search]);
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
              label: "Tout",
              description: "Toute la carte",
              tone: "yellow" as const,
              count: filteredDishes.length
            }
          ],
    [categories, filteredDishes.length]
  );
  const defaultCategory = categories[0]?.label ?? ALL_CATEGORY_ID;
  const activeCategoryIsAvailable =
    activeCategory === ALL_CATEGORY_ID ||
    filteredCategories.some((category) => category.label === activeCategory);
  const resolvedActiveCategory =
    activeCategory === ALL_CATEGORY_ID && defaultCategory !== ALL_CATEGORY_ID
      ? defaultCategory
      : activeCategoryIsAvailable
        ? activeCategory
        : defaultCategory;
  const activeCategoryTitle =
    resolvedActiveCategory === ALL_CATEGORY_ID ? "La carte" : resolvedActiveCategory;
  const visibleDishes =
    resolvedActiveCategory === ALL_CATEGORY_ID
      ? filteredDishes
      : filteredGroups.get(resolvedActiveCategory) ?? [];
  const selectionItems = useMemo(() => Array.from(selection.values()), [selection]);
  const selectionCount = selectionItems.reduce(
    (total, item) => total + item.quantity,
    0
  );
  const selectionTotal = selectionItems.reduce((total, item) => {
    const price = parseDishPrice(item.dish);
    return price === null ? total : total + price * item.quantity;
  }, 0);
  const hasPricedSelection =
    selectionItems.length > 0 &&
    selectionItems.every((item) => parseDishPrice(item.dish) !== null);
  const googleReviewCta = getGoogleReviewCta(menu.googleReview);
  const reviewRestaurantName = menu.name.trim() || "Trouvable";
  const currentLang = query?.lang === "en" ? "en" : "fr";
  const nextLang = currentLang === "en" ? "fr" : "en";
  const viewLabel = viewMode === "grid" ? "grille" : "liste";

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
    restoreFocus();
  }, [restoreFocus]);

  useEffect(() => {
    if (!activeSheet) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = getFocusableElements(sheetRef.current);
    (focusable[0] ?? sheetRef.current)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeActiveSheet();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = getFocusableElements(sheetRef.current);
      if (elements.length === 0) {
        event.preventDefault();
        sheetRef.current?.focus();
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
  }, [activeSheet, closeActiveSheet]);

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
    setLocalMessage(`${dish.name} ajouté à votre sélection.`);
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
    setLocalMessage("");
    openSheet("review");
  }

  function prepareWaiterRequest() {
    const tableCopy = tableNumber.trim() ? `Table ${tableNumber.trim()}` : "Table à confirmer";
    const message = `${tableCopy} - demande prête localement.`;
    setWaiterMessage(message);
    setLocalMessage(message);
  }

  function clearFilters() {
    setQuickFilter("all");
    setSearch("");
    setActiveCategory(categories[0]?.label ?? ALL_CATEGORY_ID);
  }

  function selectAdjacentCategory(direction: 1 | -1) {
    if (categoryOptions.length === 0) return;
    const currentIndex = Math.max(
      0,
      categoryOptions.findIndex((category) => category.label === resolvedActiveCategory)
    );
    const nextIndex =
      (currentIndex + direction + categoryOptions.length) % categoryOptions.length;
    setActiveCategory(categoryOptions[nextIndex]?.label ?? ALL_CATEGORY_ID);
  }

  function handleCategoryPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") return;
    categorySwipeRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId
    };
  }

  function handleCategoryPointerUp(event: PointerEvent<HTMLElement>) {
    const start = categorySwipeRef.current;
    categorySwipeRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 46 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    selectAdjacentCategory(deltaX < 0 ? 1 : -1);
  }

  function openDishDetail(dish: PublicMenuDish) {
    setSelectedDish(dish);
    openSheet("dish");
  }

  function selectAdjacentDish(direction: 1 | -1) {
    if (!selectedDish || visibleDishes.length < 2) return;
    const currentIndex = visibleDishes.findIndex((dish) => dish.id === selectedDish.id);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + visibleDishes.length) % visibleDishes.length;
    setSelectedDish(visibleDishes[nextIndex] ?? selectedDish);
  }

  function handleDishPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") return;
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
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 46 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    selectAdjacentDish(deltaX < 0 ? 1 : -1);
  }

  function renderDishCard(dish: PublicMenuDish, index: number) {
    const href = buildPublicDishPath(menu.slug, dish.slug, query);
    const badges = dishBadges(dish);
    const isFeatured = index === 0;
    const isSpicy = isSpicyDish(dish);

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
                {isSpicy ? (
                  <span className={styles.spicyMark} aria-label="Plat épicé" />
                ) : null}
              </span>
              <small>{dishMetaLine(dish)}</small>
              {dish.priceLabel ? (
                <span className={styles.dishPrice}>{dish.priceLabel}</span>
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
              Détails
            </Link>
            <button
              type="button"
              disabled={!dish.available}
              onClick={() => addDish(dish)}
            >
              {dish.available ? "Ajouter" : "Indispo"}
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
        <section ref={sheetRef} className={styles.sheet} tabIndex={-1}>
          <header className={styles.sheetHeader}>
            <div>
              <p>Sélection locale</p>
              <h2 id="trouvable-selection-title">Votre sélection</h2>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Fermer la sélection"
              onClick={closeActiveSheet}
            >
              x
            </button>
          </header>

          {selectionItems.length === 0 ? (
            <div className={styles.emptyState} role="status">
              <p>Votre sélection est vide.</p>
              <span>Ajoutez un plat pour préparer une demande au serveur.</span>
            </div>
          ) : (
            <>
              <ul className={styles.selectionList}>
                {selectionItems.map((item) => (
                  <li key={item.dish.id}>
                    <div>
                      <strong>{item.dish.name}</strong>
                      <span>{item.dish.priceLabel || "Prix à confirmer"}</span>
                    </div>
                    <div className={styles.quantityControls}>
                      <button
                        type="button"
                        aria-label={`Diminuer la quantité de ${item.dish.name}`}
                        onClick={() => updateQuantity(item.dish.id, -1)}
                      >
                        -
                      </button>
                      <output
                        aria-label={`Quantité de ${item.dish.name}`}
                        aria-live="polite"
                      >
                        {item.quantity}
                      </output>
                      <button
                        type="button"
                        aria-label={`Augmenter la quantité de ${item.dish.name}`}
                        onClick={() => updateQuantity(item.dish.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className={styles.totalRow}>
                <span>Total estimé</span>
                <strong>
                  {hasPricedSelection ? formatCurrency(selectionTotal) : "À confirmer"}
                </strong>
              </div>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => openWaiter("selection")}
              >
                Demander au serveur
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
              <p>Service à table</p>
              <h2 id="trouvable-waiter-title">Demander au serveur</h2>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Fermer la demande serveur"
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
            <legend>Objet de la demande</legend>
            {[
              ["allergen", "Question allergène"],
              ["recommendation", "Demander une recommandation"],
              ["selection", "Demander ma sélection"]
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
            Préparer la demande
          </button>
          {waiterMessage ? (
            <p className={styles.sheetStatus} role="status" aria-atomic="true">
              {waiterMessage}
            </p>
          ) : null}
          <p className={styles.localHint}>
            Aucune commande n&apos;est envoyée automatiquement. Montrez cette demande à
            l&apos;équipe.
          </p>
        </section>
      </div>
    );
  }

  function renderReviewSheet() {
    if (activeSheet !== "review" || !selectedDish) return null;

    return (
      <div
        className={`${styles.overlay} ${styles.reviewOverlay}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trouvable-review-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeActiveSheet();
        }}
      >
        <section ref={sheetRef} className={styles.reviewSheet} tabIndex={-1}>
          <button
            type="button"
            className={styles.reviewClose}
            aria-label="Fermer l'avis"
            onClick={closeActiveSheet}
          >
            x
          </button>
          <div className={styles.reviewDishGhost} aria-hidden="true">
            {selectedDish.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={selectedDish.imageUrl} />
            ) : null}
          </div>
          <div className={styles.reviewPanel}>
            <h2 id="trouvable-review-title">Votre expérience compte</h2>
            <p className={styles.reviewIntro}>
              Partagez votre expérience chez {reviewRestaurantName}. Votre avis Google
              aide l&apos;équipe à mieux comprendre chaque visite et à se faire découvrir.
            </p>
            {googleReviewCta ? (
              <a
                className={styles.reviewPostButton}
                data-google-review-action="true"
                href={googleReviewCta.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setLocalMessage("Google Review ouvert dans un nouvel onglet.");
                }}
              >
                Laisser un avis Google
              </a>
            ) : (
              <button className={styles.reviewPostButton} type="button" disabled>
                Laisser un avis Google
              </button>
            )}
            {!googleReviewCta ? (
              <p className={styles.reviewNote}>
                Lien Google Review non configuré pour ce restaurant.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  function renderDishDetailSheet() {
    if (activeSheet !== "dish" || !selectedDish) return null;

    const href = buildPublicDishPath(menu.slug, selectedDish.slug, query);
    const badges = dishBadges(selectedDish);

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
          <nav className={styles.detailNav} aria-label="Navigation du plat">
            <button
              type="button"
              className={styles.detailBack}
              aria-label="Retour au menu"
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
                aria-label="Plat précédent"
                onClick={() => selectAdjacentDish(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className={`${styles.dishArrow} ${styles.dishArrowRight}`}
                aria-label="Plat suivant"
                onClick={() => selectAdjacentDish(1)}
              >
                ›
              </button>
            </>
          ) : null}
          <div className={styles.detailVisual}>
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
                aria-label="Fermer le détail"
                onClick={closeActiveSheet}
              >
                x
              </button>
            </header>
            {selectedDish.priceLabel ? (
              <strong className={styles.detailPrice}>{selectedDish.priceLabel}</strong>
            ) : null}
            <button type="button" className={styles.moreDetailsButton}>
              <span aria-hidden="true">i</span>
              More details
            </button>
            {selectedDish.description ? <p>{selectedDish.description}</p> : null}
            {badges.length > 0 ? (
              <div className={styles.badges}>
                {badges.map((badge) => (
                  <span key={badge}>{badge}</span>
                ))}
              </div>
            ) : null}
            {selectedDish.ingredients.length > 0 ? (
              <section className={styles.detailList}>
                <h3>Ingrédients</h3>
                <ul>
                  {selectedDish.ingredients.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {selectedDish.allergens.length > 0 ? (
              <section className={styles.detailList}>
                <h3>Allergènes</h3>
                <ul>
                  {selectedDish.allergens.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {selectedDish.options.length > 0 ? (
              <section className={styles.detailList}>
                <h3>Options</h3>
                <ul>
                  {selectedDish.options.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {selectedDish.houseNote ? (
              <section className={styles.houseNote}>
                <h3>Note maison</h3>
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
                Ajouter à ma sélection
              </button>
              <button type="button" onClick={() => openWaiter("recommendation")}>
                Demander au serveur
              </button>
              {selectedDish.has3d ? (
                <Link href={href} prefetch={false}>
                  VOIR EN 3D
                </Link>
              ) : null}
              {selectedDish.hasAr ? (
                <Link href={href} prefetch={false}>
                  Voir devant moi
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.reviewTrigger}
              aria-haspopup="dialog"
              onClick={openReviewSheet}
            >
              <span aria-hidden="true">★</span>
              TAP TO REVIEW
            </button>
          </div>
        </article>
      </div>
    );
  }

  return (
    <main
      className={styles.page}
      data-blueprint={config.experience.blueprint}
      data-theme={config.theme}
    >
      <header className={styles.topBar}>
        <div className={styles.brandBlock}>
          <strong>Vistaire</strong>
          <small>{context || "Menu à table"}</small>
        </div>
        <div className={styles.topActions}>
          <button type="button" aria-label="Devise du menu, dollars canadiens">
            $
          </button>
          {query?.table ? <span className={styles.tableChip}>Table {query.table}</span> : null}
          <Link href={buildMenuHref(menu, query, nextLang)} prefetch={false}>
            {currentLang.toUpperCase()}
          </Link>
          <button type="button" aria-label="Mode sombre actif" aria-pressed="true">
            ◐
          </button>
          <button
            ref={selectionButtonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={activeSheet === "selection"}
            onClick={() => openSheet("selection")}
          >
            Sélection {selectionCount > 0 ? selectionCount : ""}
          </button>
          <button
            ref={waiterButtonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={activeSheet === "waiter"}
            onClick={() => openWaiter("recommendation")}
          >
            Serveur
          </button>
        </div>
      </header>

      <section className={styles.hero} aria-label={`Menu ${menu.name}`}>
        <div>
          <p>Good Afternoon</p>
          <h1>{menu.name}</h1>
          <span>Cuisine maison, accents chaleureux et service à table.</span>
        </div>
        <button type="button" onClick={() => setActiveCategory(ALL_CATEGORY_ID)}>
          Voir la carte
        </button>
      </section>

      <section
        className={styles.menuPanel}
        aria-label="Carte Trouvable"
        onPointerDown={handleCategoryPointerDown}
        onPointerUp={handleCategoryPointerUp}
        onPointerCancel={() => {
          categorySwipeRef.current = null;
        }}
      >
        <div className={styles.categoryHeader}>
          <span>CATEGORIES</span>
          <span>Swipe List ↔</span>
        </div>
        <nav className={styles.categoryRail} aria-label="Categories">
          <button
            type="button"
            aria-current={resolvedActiveCategory === ALL_CATEGORY_ID}
            onClick={() => setActiveCategory(ALL_CATEGORY_ID)}
          >
            <CategoryIcon kind="spark" />
            <span>Tout</span>
            <small>{filteredDishes.length}</small>
          </button>
          {categoryOptions.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-current={resolvedActiveCategory === category.label}
              onClick={() => setActiveCategory(category.label)}
            >
              <CategoryIcon kind={categoryIconKind(category.label)} />
              <span>{displayCategoryLabel(category.label)}</span>
              <small>{category.count}</small>
            </button>
          ))}
        </nav>

        <h2 className={styles.sectionTitle}>{activeCategoryTitle}</h2>

        <div className={styles.tools}>
          <label className={styles.searchField}>
            <span>Recherche</span>
            <input
              ref={searchInputRef}
              id="trouvable-menu-search"
              type="search"
              autoComplete="off"
              aria-controls="trouvable-dish-results"
              placeholder="Rechercher un plat, ingrédient, tag..."
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
                Effacer
              </button>
            ) : null}
          </label>
          <div className={styles.quickFilters} aria-label="Filtres rapides">
            {quickFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={quickFilter === filter.id}
                aria-label={
                  filter.id === "all"
                    ? "Afficher tous les plats"
                    : filter.id === "veg"
                      ? "Filtrer les plats végétariens détectés"
                      : filter.id === "nonVeg"
                        ? "Filtrer les plats non végétariens détectés"
                        : filter.id === "available"
                          ? "Filtrer les plats disponibles"
                          : filter.id === "immersive"
                            ? "Filtrer les plats avec expérience 3D ou AR"
                            : "Filtrer les plats signatures ou recommandés"
                }
                onClick={() => setQuickFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className={styles.viewToggle} aria-label="Mode d'affichage">
            <button
              type="button"
              aria-pressed={viewMode === "list"}
              aria-label="Afficher en liste"
              onClick={() => setViewMode("list")}
            >
              ☷
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "grid"}
              aria-label="Afficher en grille"
              onClick={() => setViewMode("grid")}
            >
              ▦
            </button>
          </div>
          <p className={styles.resultStatus} aria-live="polite">
            Vue {viewLabel}, {visibleDishes.length} plat
            {visibleDishes.length > 1 ? "s" : ""} affiché
            {visibleDishes.length > 1 ? "s" : ""}
          </p>
        </div>

        {visibleDishes.length === 0 ? (
          <div className={styles.emptyState} role="status">
            <p>Aucun plat ne correspond.</p>
            <span>Essayez une autre recherche ou retirez un filtre.</span>
            <button type="button" onClick={clearFilters}>
              Reinitialiser
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
      </section>

      <div className={styles.statusRegion} aria-live="polite">
        {localMessage}
      </div>

      <GoogleReviewCard
        googleReview={menu.googleReview}
        restaurantId={menu.restaurantId}
        restaurantName={menu.name}
        showNote={false}
        source={menu.source}
      />

      {renderDishDetailSheet()}
      {renderSelectionSheet()}
      {renderWaiterSheet()}
      {renderReviewSheet()}
    </main>
  );
}
