"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
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
import { GoogleReviewCard } from "./GoogleReviewCard";
import { PublicDishDetailExperience } from "./PublicDishDetailExperience";
import styles from "./PublicMenuRenderer.module.css";

type PublicMenuRendererProps = {
  menu: PublicMenu;
  config: MenuUiConfig;
  mode: "public" | "builder-preview";
  context?: string;
  query?: PublicMenuContextQuery;
  disableHeavyAssets?: boolean;
  onDishOpen?: (dish: PublicMenuDish) => void;
};

const ALL_TAB_ID = "all";
const HOME_TAB_ID = "home";
const MENU_FILTERS = [
  { id: "all", label: "Tous les plats" },
  { id: "recommended", label: "Recommandés" },
  { id: "immersive", label: "Vue 3D / AR" },
  { id: "available", label: "Disponibles" },
  { id: "gluten-free", label: "Sans gluten" },
  { id: "dairy-free", label: "Sans lactose / laitiers" },
  { id: "nut-free", label: "Sans fruits à coque" },
  { id: "shellfish-free", label: "Sans crustacés" },
  { id: "egg-free", label: "Sans oeufs" },
  { id: "sesame-free", label: "Sans sésame" },
  { id: "soy-free", label: "Sans soja" },
  { id: "fish-free", label: "Sans poisson" }
] as const;
type MenuFilterId = (typeof MENU_FILTERS)[number]["id"];
type AllergenFilterId = Extract<
  MenuFilterId,
  | "gluten-free"
  | "dairy-free"
  | "nut-free"
  | "shellfish-free"
  | "egg-free"
  | "sesame-free"
  | "soy-free"
  | "fish-free"
>;
const preferredCategoryLabels = ["Entrees", "Entrées", "Plats", "Desserts", "Boissons"];
const preferredCategoryOrder = new Map(
  preferredCategoryLabels.map((label, index) => [label, index])
);
preferredCategoryOrder.set("Signatures", 2);
preferredCategoryOrder.set("Cocktails", 4);

const ALLERGEN_FILTER_TERMS: Record<AllergenFilterId, string[]> = {
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
  "nut-free": [
    "nut",
    "nuts",
    "noix",
    "amande",
    "amandes",
    "noisette",
    "pistache",
    "pecan"
  ],
  "shellfish-free": [
    "shellfish",
    "crustace",
    "crustaces",
    "homard",
    "crevette",
    "crabe"
  ],
  "egg-free": ["egg", "eggs", "oeuf", "oeufs"],
  "sesame-free": ["sesame"],
  "soy-free": ["soy", "soja"],
  "fish-free": ["fish", "poisson"]
};

function themeClass(theme: MenuUiConfig["theme"]): string {
  if (theme === "bbq-smokehouse") return styles.themeBbq;
  if (theme === "fast-fresh-bowls") return styles.themeBowls;
  if (theme === "mediterranean-fresh") return styles.themeMediterranean;
  if (theme === "night-market") return styles.themeNight;
  if (theme === "patisserie-sweet") return styles.themePatisserie;
  if (theme === "premium-gastronomic") return styles.themePremium;
  if (theme === "retro-diner") return styles.themeDiner;
  if (theme === "sushi-minimal") return styles.themeSushi;
  if (theme === "street-casual") return styles.themeStreet;
  if (theme === "cafe-brunch") return styles.themeCafe;
  if (theme === "minimal-clean") return styles.themeMinimal;
  return styles.themeFresh;
}

function densityClass(density: MenuUiConfig["density"]): string {
  if (density === "compact") return styles.densityCompact;
  if (density === "expressive") return styles.densityExpressive;
  return styles.densityComfortable;
}

function backgroundClass(config: MenuUiConfig): string {
  const value = config.global.backgroundStyle;
  if (value === "dark") return styles.backgroundDark;
  if (value === "editorial") return styles.backgroundEditorial;
  if (value === "gradient") return styles.backgroundGradient;
  if (value === "pattern-light") return styles.backgroundPatternLight;
  if (value === "soft-blobs") return styles.backgroundSoftBlobs;
  if (value === "texture") return styles.backgroundTexture;
  return styles.backgroundFlat;
}

function radiusClass(config: MenuUiConfig): string {
  const value = config.global.radius;
  if (value === "organic") return styles.radiusOrganic;
  if (value === "pill") return styles.radiusPill;
  if (value === "rounded") return styles.radiusRounded;
  if (value === "soft") return styles.radiusSoft;
  return styles.radiusSharp;
}

function shadowClass(config: MenuUiConfig): string {
  const value = config.global.shadow;
  if (value === "strong") return styles.shadowStrong;
  if (value === "medium") return styles.shadowMedium;
  if (value === "soft") return styles.shadowSoft;
  return styles.shadowNone;
}

function typographyClass(config: MenuUiConfig): string {
  const value = config.typography.headingStyle;
  if (value === "bold") return styles.typeBold;
  if (value === "casual") return styles.typeCasual;
  if (value === "editorial") return styles.typeEditorial;
  if (value === "minimal") return styles.typeMinimal;
  return styles.typeElegant;
}

function detailClass(config: MenuUiConfig): string {
  const value = config.detail.style;
  if (value === "compact-detail" || value === "simple-card") {
    return styles.detailSimpleCard;
  }
  if (value === "editorial-detail") return styles.detailEditorial;
  if (value === "full-page") return styles.detailFullPage;
  if (value === "modal-card" || value === "full-card") return styles.detailFullCard;
  return "";
}

function modelPanelClass(config: MenuUiConfig): string {
  const value = config.detail.modelPanelStyle;
  if (value === "large-poster") return styles.modelPanelLarge;
  if (value === "minimal-cta") return styles.modelPanelMinimal;
  if (value === "premium-panel") return styles.modelPanelPremium;
  return styles.modelPanelCompact;
}

function blueprintClass(config: MenuUiConfig): string {
  const value = config.experience.blueprint;
  if (value === "editorial-magazine") return styles.editorialLayout;
  if (value === "photo-grid") return styles.photoGridLayout;
  if (value === "fast-board") return styles.fastBoardLayout;
  if (value === "bento-showcase") return styles.bentoLayout;
  if (value === "story-first") return styles.storyLayout;
  if (value === "minimal-list") return styles.minimalLayout;
  if (value === "lounge-cocktail") return styles.loungeLayout;
  if (value === "family-comfort") return styles.familyLayout;
  if (value === "immersive-first") return styles.immersiveLayout;
  if (value === "tasting-journey") return styles.tastingLayout;
  if (value === "compact-qr") return styles.compactQrLayout;
  return styles.classicLayout;
}

function menuStyleVars(config: MenuUiConfig): CSSProperties {
  return {
    "--menu-bg": config.palette.background,
    "--menu-surface": config.palette.surface,
    "--menu-text": config.palette.text,
    "--menu-muted": config.palette.muted,
    "--menu-accent": config.palette.accent,
    "--menu-accent-2": config.palette.accent2,
    "--menu-accent-3": config.palette.accent3,
    "--menu-fresh": config.palette.accent3,
    "--menu-border": config.palette.border,
    "--menu-success": config.palette.success,
    "--menu-warning": config.palette.warning,
    "--menu-danger": config.palette.danger
  } as CSSProperties;
}

function categoryTone(category: PublicMenuCategory): string {
  return `${styles.categoryCard} ${styles[`tone${category.tone}`]}`;
}

function shortDescription(
  dish: PublicMenuDish,
  length: MenuUiConfig["cards"]["descriptionLength"]
): string {
  if (!dish.description) return "";
  if (length === "hidden") return "";
  const max = length === "short" ? 88 : length === "full" ? 280 : 128;
  if (dish.description.length <= max) return dish.description;
  return `${dish.description.slice(0, max - 3).trim()}...`;
}

function dishBadges(dish: PublicMenuDish): string[] {
  const badges = new Set<string>();
  for (const tag of dish.tags) {
    if (tag.trim()) badges.add(tag.trim());
  }
  if (
    `${dish.name} ${dish.description} ${dish.houseNote}`
      .toLowerCase()
      .includes("maison")
  ) {
    badges.add("Maison");
  }
  if (!dish.available) badges.add("Indisponible");
  return Array.from(badges).slice(0, 4);
}

function normalizeFilterText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeFilterText(value: string): string[] {
  return normalizeFilterText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function dishAllergenTokens(dish: PublicMenuDish): Set<string> {
  return new Set(dish.allergens.flatMap(tokenizeFilterText));
}

function isAllergenFilter(filter: MenuFilterId): filter is AllergenFilterId {
  return filter.endsWith("-free");
}

function dishMatchesQuickFilter(
  dish: PublicMenuDish,
  filter: MenuFilterId
): boolean {
  if (filter === "all") return true;
  const badges = dishBadges(dish).map((badge) => normalizeFilterText(badge));
  if (filter === "recommended") {
    return badges.some(
      (badge) => badge.includes("recommande") || badge.includes("recommended")
    );
  }
  if (filter === "available") return dish.available;
  if (filter === "immersive") return dish.hasImmersive || dish.has3d || dish.hasAr;
  if (isAllergenFilter(filter)) {
    const allergenTokens = dishAllergenTokens(dish);
    return !ALLERGEN_FILTER_TERMS[filter].some((term) =>
      allergenTokens.has(normalizeFilterText(term))
    );
  }
  return true;
}

function DishVisual({
  dish,
  menu,
  showPlaceholder,
  large = false
}: {
  dish: PublicMenuDish;
  menu: PublicMenu;
  showPlaceholder: boolean;
  large?: boolean;
}) {
  if (!dish.imageUrl && !showPlaceholder) return null;

  return (
    <span className={`${styles.dishVisual} ${large ? styles.dishVisualLarge : ""}`}>
      {dish.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" src={dish.thumbnailUrl || dish.imageUrl} alt="" />
      ) : (
        <span className={styles.photoPlaceholder}>{menu.name.slice(0, 1)}</span>
      )}
    </span>
  );
}

export function PublicMenuRenderer({
  menu,
  config,
  mode,
  context = "",
  query,
  disableHeavyAssets = mode === "builder-preview",
  onDishOpen
}: PublicMenuRendererProps) {
  const initialTab =
    config.experience.blueprint === "compact-qr" ||
    config.experience.blueprint === "fast-board" ||
    config.defaultView === "all"
      ? ALL_TAB_ID
      : HOME_TAB_ID;
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [selectedDish, setSelectedDish] = useState<PublicMenuDish | null>(null);
  const [menuFilter, setMenuFilter] = useState<MenuFilterId>("all");
  const categories = useMemo(
    () =>
      getVisiblePublicMenuCategories(menu.dishes).sort(
        (a, b) =>
          (preferredCategoryOrder.get(a.label) ?? 99) -
          (preferredCategoryOrder.get(b.label) ?? 99)
      ),
    [menu.dishes]
  );
  const filteredDishes = useMemo(
    () => menu.dishes.filter((dish) => dishMatchesQuickFilter(dish, menuFilter)),
    [menu.dishes, menuFilter]
  );
  const filteredCategories = useMemo(
    () =>
      getVisiblePublicMenuCategories(filteredDishes).sort(
        (a, b) =>
          (preferredCategoryOrder.get(a.label) ?? 99) -
          (preferredCategoryOrder.get(b.label) ?? 99)
      ),
    [filteredDishes]
  );
  const groups = useMemo(
    () => getPublicMenuCategoryGroups(filteredDishes),
    [filteredDishes]
  );
  const hasMenuFilter = menuFilter !== "all";
  const tabs = [
    { id: ALL_TAB_ID, label: "Tout", count: filteredDishes.length },
    ...filteredCategories.map((category) => ({
      id: category.id,
      label: category.label,
      count: category.count
    }))
  ];
  const resolvedActiveTab =
    activeTab !== HOME_TAB_ID &&
    activeTab !== ALL_TAB_ID &&
    !filteredCategories.some((category) => category.id === activeTab)
      ? ALL_TAB_ID
      : activeTab;
  const resolvedCategory = filteredCategories.find(
    (category) => category.id === resolvedActiveTab
  );
  const selectedDishes =
    resolvedActiveTab !== HOME_TAB_ID && resolvedActiveTab !== ALL_TAB_ID
      ? groups.get(resolvedActiveTab) ?? []
      : [];
  const activeCategoryList =
    resolvedActiveTab !== HOME_TAB_ID && resolvedActiveTab !== ALL_TAB_ID
      ? filteredCategories.filter((category) => category.id === resolvedActiveTab)
      : filteredCategories;
  const featuredDishes = filteredDishes
    .filter((dish) => dish.tags.length > 0 || dish.category === "Plats")
    .slice(0, 4);
  const immersiveDishes = filteredDishes
    .filter((dish) => dish.has3d || dish.hasAr)
    .slice(0, 5);
  const drinksFirstCategories = [...categories].sort((a, b) => {
    const aDrink = /boisson|drink|cocktail|bar|vin/i.test(a.label) ? 0 : 1;
    const bDrink = /boisson|drink|cocktail|bar|vin/i.test(b.label) ? 0 : 1;
    return aDrink - bDrink;
  });
  const welcomeTitle = config.welcomeTitle || `Bienvenue chez ${menu.name}`;
  const welcomeSubtitle = config.welcomeSubtitle || "Decouvrez notre carte";
  const dishOpenMode = config.detail.dishOpenMode;
  const heading =
    resolvedActiveTab === HOME_TAB_ID
      ? "Categories"
      : resolvedActiveTab === ALL_TAB_ID
        ? "Tout le menu"
        : resolvedCategory?.label ?? resolvedActiveTab;
  const showTabs = config.navigation.style !== "cards";
  const showCategoryCards =
    config.navigation.style !== "tabs" || resolvedActiveTab === HOME_TAB_ID;

  function openDish(dish: PublicMenuDish) {
    setSelectedDish(dish);
    onDishOpen?.(dish);
  }

  function showAll() {
    setActiveTab(ALL_TAB_ID);
    setSelectedDish(null);
  }

  function showHome() {
    setActiveTab(HOME_TAB_ID);
    setSelectedDish(null);
  }

  function renderDishCard(
    dish: PublicMenuDish,
    options: { className?: string; forceVisual?: boolean; priceBoard?: boolean } = {}
  ) {
    const badges = dishBadges(dish);
    const cardVariant = options.priceBoard ? "price-forward" : config.cards.variant;
    const minimal = cardVariant === "minimal-list";
    const large =
      options.forceVisual ||
      cardVariant === "photo-large" ||
      cardVariant === "editorial";
    const priceForward = cardVariant === "price-forward";
    const showOwnerMissingPhotoWarning =
      mode === "builder-preview" &&
      config.photos.ownerMissingWarnings &&
      !dish.hasPhoto;
    const showMissingPhoto =
      config.photos.publicMissingBehavior === "placeholder" ||
      (mode === "builder-preview" && config.photos.ownerMissingWarnings);
    const showVisual = !minimal && (dish.hasPhoto || showMissingPhoto || options.forceVisual);
    const description = shortDescription(dish, config.cards.descriptionLength);
    const dishHref = buildPublicDishPath(menu.slug, dish.slug, query);
    const dishCardClassName = `${styles.dishCard} ${
      minimal ? styles.dishCardMinimal : ""
    } ${large ? styles.dishCardLarge : ""} ${
      priceForward ? styles.dishCardPriceForward : ""
    } ${
      cardVariant === "editorial" ? styles.dishCardEditorial : ""
    } ${
      cardVariant === "split" ? styles.dishCardSplit : ""
    } ${
      !showVisual ? styles.dishCardNoVisual : ""
    } ${options.priceBoard ? styles.priceBoard : ""} ${options.className ?? ""}`;
    const dishCardContent = (
      <>
        {showVisual ? (
          <DishVisual
            dish={dish}
            menu={menu}
            showPlaceholder={showMissingPhoto || Boolean(options.forceVisual)}
            large={large}
          />
        ) : null}
        <span className={styles.dishCopy}>
          <span className={styles.dishTopline}>
            <span className={styles.dishName}>{dish.name}</span>
            {dish.priceLabel ? (
              <strong className={styles.price}>{dish.priceLabel}</strong>
            ) : null}
          </span>
          {description ? (
            <span className={styles.dishDescription}>{description}</span>
          ) : null}
          <span className={styles.badges}>
            {config.cards.showTags
              ? badges.map((badge) => (
                  <span key={badge} className={styles.badge}>
                    {badge}
                  </span>
                ))
              : null}
            {showOwnerMissingPhotoWarning ? (
              <span className={styles.warningBadge}>Photo a faire</span>
            ) : null}
            {config.immersive.show3dBadge && dish.has3d ? (
              <span className={styles.modelBadge}>3D</span>
            ) : null}
            {config.immersive.showArBadge && dish.hasAr ? (
              <span className={styles.modelBadge}>AR</span>
            ) : null}
          </span>
        </span>
      </>
    );

    return (
      <li key={dish.id} className={styles.dishItem}>
        {mode === "public" && dishOpenMode === "route" ? (
          <Link
            aria-label={`${dish.name}. Voir la fiche plat.`}
            className={dishCardClassName}
            href={dishHref}
            prefetch={false}
          >
            {dishCardContent}
          </Link>
        ) : mode === "public" && dishOpenMode === "hybrid" ? (
          <div className={styles.hybridDishActions}>
            <Link
              aria-label={`${dish.name}. Voir la fiche plat.`}
              className={dishCardClassName}
              href={dishHref}
              prefetch={false}
            >
              {dishCardContent}
            </Link>
            <button
              type="button"
              className={styles.inlinePreviewButton}
              onClick={() => openDish(dish)}
            >
              Apercu rapide
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={dishCardClassName}
            onClick={() => openDish(dish)}
          >
            {dishCardContent}
          </button>
        )}
      </li>
    );
  }

  function renderWelcomeSection(options: {
    compact?: boolean;
    editorial?: boolean;
    actions?: boolean;
    label?: string;
  } = {}) {
    if (!config.welcomeEnabled) return null;
    return (
      <section
        className={`${styles.welcome} ${
          options.compact ? styles.welcomeCompact : ""
        } ${options.editorial ? styles.welcomeEditorial : ""} ${
          config.motion === "none"
            ? styles.motionNone
            : config.motion === "expressive"
              ? styles.motionExpressive
              : styles.motionSoft
        }`}
        aria-label={`Bienvenue chez ${menu.name}`}
      >
        <div>
          <p>{options.label ?? menu.name}</p>
          <h1>{welcomeTitle}</h1>
          <span>{welcomeSubtitle}</span>
          {context ? <small>{context}</small> : null}
        </div>
        {options.actions ?? true ? (
          <div className={styles.welcomeActions}>
            {config.navigation.showAll ? (
              <button type="button" onClick={showAll}>
                Voir le menu
              </button>
            ) : null}
            <button type="button" onClick={showHome}>
              Categories
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  function renderCompactHeader(title = "Tout le menu") {
    return (
      <header className={styles.compactHeader}>
        <div>
          <p className={styles.sectionLabel}>{menu.name}</p>
          <h1>{title}</h1>
          {context ? <span>{context}</span> : null}
        </div>
        <small>{menu.dishes.length} choix</small>
      </header>
    );
  }

  function renderTabs() {
    if (!showTabs || menu.dishes.length === 0) return null;
    return (
      <div className={styles.tabs} role="tablist" aria-label="Categories du menu">
        {tabs.map((tab) => {
          const active = resolvedActiveTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? styles.activeTab : undefined}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedDish(null);
              }}
            >
              <span>{tab.label}</span>
              {config.navigation.showDishCounts ? <small>{tab.count}</small> : null}
            </button>
          );
        })}
      </div>
    );
  }

  function renderMenuTools() {
    if (mode !== "public" || menu.dishes.length === 0) return null;
    return (
      <div className={styles.menuTools}>
        <div className={styles.filterSelectShell}>
          <select
            aria-label="Filtrer les plats"
            className={styles.filterSelect}
            value={menuFilter}
            onChange={(event) => {
              setMenuFilter(event.target.value as MenuFilterId);
              setSelectedDish(null);
            }}
          >
            {MENU_FILTERS.map((filter) => (
              <option key={filter.id} value={filter.id}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
        <p className={styles.resultStatus} aria-live="polite">
          {filteredDishes.length} creations affichees
        </p>
        {hasMenuFilter ? (
          <button
            type="button"
            className={styles.resetFilters}
            onClick={() => {
              setMenuFilter("all");
              setActiveTab(ALL_TAB_ID);
            }}
          >
            Tout afficher
          </button>
        ) : null}
      </div>
    );
  }

  function renderCategoryCards(categoryList = filteredCategories) {
    if (!showCategoryCards) return null;
    return (
      <div className={styles.categoryGrid}>
        {categoryList.map((category) => (
          <button
            key={category.id}
            type="button"
            className={categoryTone(category)}
            onClick={() => setActiveTab(category.id)}
          >
            {config.navigation.showDishCounts ? (
              <span>{category.count} choix</span>
            ) : null}
            <strong>{category.label}</strong>
            <small>{category.description}</small>
          </button>
        ))}
      </div>
    );
  }

  function renderDishList(
    dishes: PublicMenuDish[],
    options: { className?: string; forceVisual?: boolean; priceBoard?: boolean } = {}
  ) {
    return (
      <ul className={`${styles.dishList} ${options.className ?? ""}`}>
        {dishes.map((dish) => renderDishCard(dish, options))}
      </ul>
    );
  }

  function renderFeaturedSection(
    title: string,
    label: string,
    dishes = featuredDishes.length ? featuredDishes : filteredDishes.slice(0, 3),
    options: { className?: string; forceVisual?: boolean; priceBoard?: boolean } = {}
  ) {
    if (!dishes.length) return null;
    return (
      <section className={`${styles.previewSection} ${options.className ?? ""}`}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionLabel}>{label}</p>
            <h3>{title}</h3>
          </div>
          <button type="button" onClick={showAll}>
            Tout voir
          </button>
        </div>
        {renderDishList(dishes, options)}
      </section>
    );
  }

  function renderFullMenuList(
    categoryList = filteredCategories,
    options: { className?: string; forceVisual?: boolean; priceBoard?: boolean } = {}
  ) {
    return (
      <div className={`${styles.fullMenuList} ${options.className ?? ""}`}>
        {categoryList.map((category, index) => {
          const dishes = groups.get(category.id) ?? [];
          if (!dishes.length) return null;
          return (
            <section key={category.id} className={styles.fullMenuSection}>
              <div className={styles.sectionHeader}>
                <h3>
                  {config.experience.blueprint === "tasting-journey"
                    ? `${index + 1}. ${category.label}`
                    : category.label}
                </h3>
                <span>{dishes.length} choix</span>
              </div>
              {renderDishList(dishes, options)}
            </section>
          );
        })}
      </div>
    );
  }

  function renderNoResults() {
    return (
      <div className={styles.empty} role="status">
        <p>Aucun plat dans cette selection.</p>
        <span>Essayez une autre recherche ou retirez un filtre.</span>
      </div>
    );
  }

  function renderEmptyState() {
    return (
      <div className={styles.empty} role="status">
        <p>La carte de ce restaurant n&apos;est pas encore disponible.</p>
        <span>Aucun plat reel n&apos;est relie a ce restaurant.</span>
      </div>
    );
  }

  function renderClassicActiveView() {
    if (menu.dishes.length === 0) return renderEmptyState();
    if (filteredDishes.length === 0) return renderNoResults();
    if (resolvedActiveTab === HOME_TAB_ID) {
      return (
        <>
          {renderCategoryCards()}
          {renderFeaturedSection("Apercu maison", "A decouvrir")}
        </>
      );
    }
    if (resolvedActiveTab === ALL_TAB_ID) return renderFullMenuList();
    return (
      <section className={styles.fullMenuSection}>
        <div className={styles.sectionHeader}>
          <h3>{resolvedCategory?.label ?? resolvedActiveTab}</h3>
          <span>{selectedDishes.length} choix</span>
        </div>
        {renderDishList(selectedDishes)}
      </section>
    );
  }

  function renderMenuShell(children: ReactNode, className = "") {
    return (
      <section className={`${styles.menuShell} ${className}`}>
        <div className={styles.menuIntro}>
          <div>
            <p className={styles.sectionLabel}>Menu public</p>
            <h2>{heading}</h2>
          </div>
          {resolvedActiveTab !== HOME_TAB_ID ? (
            <button type="button" onClick={showHome}>
              Retour aux categories
            </button>
          ) : null}
        </div>
        {renderMenuTools()}
        {children}
      </section>
    );
  }

  function renderClassicTabs() {
    return (
      <>
        {renderWelcomeSection()}
        {renderMenuShell(
          <>
            {renderTabs()}
            <div className={styles.menuView} aria-live="polite">
              {renderClassicActiveView()}
            </div>
          </>
        )}
      </>
    );
  }

  function renderEditorialMagazine() {
    return (
      <>
        {renderWelcomeSection({ editorial: true, label: "Selection du chef" })}
        {renderMenuShell(
          <div className={styles.editorialFlow}>
            {renderFeaturedSection("Plats signatures", "Edition maison", featuredDishes, {
              forceVisual: true
            })}
            {renderFullMenuList(categories, { className: styles.editorialSections })}
          </div>
        )}
      </>
    );
  }

  function renderPhotoGrid() {
    return (
      <>
        {renderWelcomeSection({ compact: true, label: "Carte en images" })}
        {renderMenuShell(
          <div className={styles.photoGridFlow}>
            {renderCategoryCards()}
            {renderFeaturedSection("Photos a explorer", "A decouvrir", filteredDishes.slice(0, 8), {
              className: styles.photoGridCards,
              forceVisual: true
            })}
            {renderFullMenuList(categories, { forceVisual: true })}
          </div>
        )}
      </>
    );
  }

  function renderFastBoard() {
    return (
      <>
        {renderCompactHeader("Carte rapide")}
        {renderMenuShell(
          <div className={styles.fastBoardFlow}>
            {renderTabs()}
            {renderFullMenuList(activeCategoryList, { priceBoard: true })}
          </div>,
          styles.fastShell
        )}
      </>
    );
  }

  function renderBentoShowcase() {
    return (
      <>
        {renderWelcomeSection({ compact: true, label: "Selection bento" })}
        {renderMenuShell(
          <div className={styles.bentoGrid}>
            <section className={styles.bentoCategories}>{renderCategoryCards()}</section>
            {renderFeaturedSection("A partager", "Bento maison", featuredDishes, {
              className: styles.bentoFeature,
              forceVisual: true
            })}
            <section className={styles.bentoMenu}>{renderFullMenuList()}</section>
          </div>
        )}
      </>
    );
  }

  function renderStoryFirst() {
    return (
      <>
        {renderWelcomeSection({ editorial: true, label: "Notre histoire" })}
        {renderMenuShell(
          <div className={styles.storyFlow}>
            {renderFeaturedSection("A decouvrir", "Cuisine maison", featuredDishes, {
              forceVisual: true
            })}
            {renderCategoryCards()}
            {renderFullMenuList()}
          </div>
        )}
      </>
    );
  }

  function renderMinimalList() {
    return (
      <>
        {renderCompactHeader(menu.name)}
        {renderMenuShell(
          <div className={styles.minimalFlow}>
            {renderTabs()}
            {renderFullMenuList(activeCategoryList, { className: styles.minimalLines })}
          </div>,
          styles.minimalShell
        )}
      </>
    );
  }

  function renderLoungeCocktail() {
    return (
      <>
        {renderWelcomeSection({ compact: true, label: "Lounge" })}
        {renderMenuShell(
          <div className={styles.loungeFlow}>
            {renderFeaturedSection(
              "Boissons et cocktails",
              "A boire",
              drinksFirstCategories.flatMap((category) => groups.get(category.id) ?? []).slice(0, 5),
              { priceBoard: true }
            )}
            {renderFullMenuList(drinksFirstCategories, { priceBoard: true })}
          </div>
        )}
      </>
    );
  }

  function renderFamilyComfort() {
    return (
      <>
        {renderWelcomeSection({ label: "Cuisine maison" })}
        {renderMenuShell(
          <div className={styles.familyFlow}>
            {renderCategoryCards()}
            {renderFeaturedSection("Les favoris", "Pour la table", featuredDishes, {
              forceVisual: true
            })}
            {renderFullMenuList(categories, { className: styles.comfortBlocks })}
          </div>
        )}
      </>
    );
  }

  function renderImmersiveFirst() {
    const immersiveFirstDishes = immersiveDishes.length ? immersiveDishes : featuredDishes;
    return (
      <>
        {renderWelcomeSection({ editorial: true, label: "Experience 3D / AR" })}
        {renderMenuShell(
          <div className={styles.immersiveFlow}>
            {renderFeaturedSection("Plats immersifs", "3D / AR disponible", immersiveFirstDishes, {
              className: styles.immersiveShowcase,
              forceVisual: true
            })}
            <section className={styles.modelPanel}>
              <p>3D / AR safe</p>
              <strong>Posters et CTA seulement. Aucun fichier lourd avant action explicite.</strong>
            </section>
            {renderFullMenuList()}
          </div>
        )}
      </>
    );
  }

  function renderTastingJourney() {
    return (
      <>
        {renderWelcomeSection({ editorial: true, label: "Parcours degustation" })}
        {renderMenuShell(
          <div className={styles.tastingFlow}>
            {renderFeaturedSection("Temps forts", "Parcours", featuredDishes, {
              forceVisual: true
            })}
            {renderFullMenuList(categories, { className: styles.journeySteps })}
          </div>
        )}
      </>
    );
  }

  function renderCompactQr() {
    return (
      <>
        {renderCompactHeader("Tout le menu")}
        {renderMenuShell(
          <div className={styles.compactQrFlow}>
            {renderTabs()}
            {renderFullMenuList(activeCategoryList, { className: styles.compactList })}
          </div>,
          styles.compactShell
        )}
      </>
    );
  }

  function renderSelectedDish() {
    if (!selectedDish) return null;
    return (
      <div className={`${styles.detailOverlay} ${detailClass(config)}`}>
        <article className={styles.detailSheet}>
          <div
            className={`${styles.detailHero} ${
              config.detail.photoHero === "full-bleed"
                ? styles.detailHeroFullBleed
                : config.detail.photoHero === "compact"
                  ? styles.detailHeroCompact
                  : config.detail.photoHero === "none"
                    ? styles.detailHeroNone
                    : ""
            }`}
          >
            {selectedDish.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" src={selectedDish.imageUrl} alt="" />
            ) : config.detail.photoHero !== "none" ? (
              <span>{menu.name.slice(0, 1)}</span>
            ) : null}
          </div>
          <div className={styles.detailBody}>
            <div className={styles.detailTop}>
              <div>
                <p>{selectedDish.category}</p>
                <h3>{selectedDish.name}</h3>
              </div>
              <button
                type="button"
                aria-label="Fermer le detail"
                onClick={() => setSelectedDish(null)}
              >
                x
              </button>
            </div>
            {selectedDish.priceLabel ? <strong>{selectedDish.priceLabel}</strong> : null}
            {selectedDish.description ? <p>{selectedDish.description}</p> : null}

            {selectedDish.ingredients.length > 0 ? (
              <section className={styles.detailList}>
                <h4>Ingredients</h4>
                <ul>
                  {selectedDish.ingredients.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {selectedDish.allergens.length > 0 ? (
              <section className={styles.detailList}>
                <h4>Allergenes</h4>
                <ul>
                  {selectedDish.allergens.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {selectedDish.options.length > 0 ? (
              <section className={styles.detailList}>
                <h4>Options</h4>
                <ul>
                  {selectedDish.options.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {selectedDish.houseNote ? (
              <section className={styles.houseNote}>
                <h4>Note maison</h4>
                <p>{selectedDish.houseNote}</p>
              </section>
            ) : null}

            {selectedDish.has3d || selectedDish.hasAr ? (
              <section className={`${styles.modelPanel} ${modelPanelClass(config)}`}>
                <p>3D / AR disponible</p>
                <strong>
                  {disableHeavyAssets || !config.immersive.posterUntilClick
                    ? "Preview statut seulement dans le builder."
                    : "Chargement uniquement apres une action explicite."}
                </strong>
                <div>
                  {selectedDish.has3d ? (
                    <button type="button">{config.immersive.cta3d}</button>
                  ) : null}
                  {selectedDish.hasAr ? (
                    <button type="button">{config.immersive.ctaAr}</button>
                  ) : null}
                </div>
              </section>
            ) : null}

            <button
              type="button"
              className={styles.returnButton}
              onClick={() => setSelectedDish(null)}
            >
              Retour au menu
            </button>
          </div>
        </article>
      </div>
    );
  }

  if (mode === "builder-preview" && selectedDish) {
    return (
      <PublicDishDetailExperience
        config={config}
        dish={selectedDish}
        menu={menu}
        mode="builder-preview"
        onBack={() => setSelectedDish(null)}
        query={query}
      />
    );
  }

  let blueprintContent: ReactNode;
  switch (config.experience.blueprint) {
    case "editorial-magazine":
      blueprintContent = renderEditorialMagazine();
      break;
    case "photo-grid":
      blueprintContent = renderPhotoGrid();
      break;
    case "fast-board":
      blueprintContent = renderFastBoard();
      break;
    case "bento-showcase":
      blueprintContent = renderBentoShowcase();
      break;
    case "story-first":
      blueprintContent = renderStoryFirst();
      break;
    case "minimal-list":
      blueprintContent = renderMinimalList();
      break;
    case "lounge-cocktail":
      blueprintContent = renderLoungeCocktail();
      break;
    case "family-comfort":
      blueprintContent = renderFamilyComfort();
      break;
    case "immersive-first":
      blueprintContent = renderImmersiveFirst();
      break;
    case "tasting-journey":
      blueprintContent = renderTastingJourney();
      break;
    case "compact-qr":
      blueprintContent = renderCompactQr();
      break;
    case "classic-tabs":
    default:
      blueprintContent = renderClassicTabs();
      break;
  }

  return (
    <main
      className={`${styles.page} ${themeClass(config.theme)} ${densityClass(
        config.density
      )} ${backgroundClass(config)} ${radiusClass(config)} ${shadowClass(
        config
      )} ${typographyClass(config)} ${blueprintClass(config)} ${
        mode === "builder-preview" ? styles.builderPreview : styles.public
      }`}
      data-theme={config.theme}
      data-blueprint={config.experience.blueprint}
      style={menuStyleVars(config)}
    >
      {blueprintContent}
      {mode === "public" ? (
        <GoogleReviewCard
          googleReview={menu.googleReview}
          locale={menu.settings.defaultLocale}
          localizedUiCopy={menu.localizedUiCopy}
          restaurantId={menu.restaurantId}
          restaurantName={menu.name}
          source={menu.source}
        />
      ) : null}
      {renderSelectedDish()}
    </main>
  );
}
