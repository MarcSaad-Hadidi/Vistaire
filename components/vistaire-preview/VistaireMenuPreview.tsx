"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, type MouseEvent } from "react";
import restaurantBackground from "@/Framer/PhotoRestoComplet2.png";
import menuVisual from "@/Framer/pageCarte.png";
import type { DishModelViewerProps } from "@/components/dish/DishModelViewer";
import type { Locale } from "@/lib/i18n";
import type { Allergen, Dish } from "@/lib/demoMenuData";
import {
  getAllDishes,
  getCategories,
  getDishCardImageObjectPosition,
  getDishDetailImageObjectPosition,
  getRestaurant
} from "@/lib/demoMenuData";
import {
  applyMenuFilters,
  defaultMenuFilterState,
  dishHasImmersiveAsset,
  dishMatchesSearch,
  hasActiveFilters,
  MENU_ALL_CATEGORY_SLUG,
  type MenuFilterState
} from "@/lib/menuQuery";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import styles from "./VistaireMenuPreview.module.css";

type ToggleFilterKey = keyof Pick<
  MenuFilterState,
  "signatureOnly" | "recommendedOnly" | "availableOnly" | "with3dOnly"
>;

const LazyDishModelViewer = dynamic<DishModelViewerProps>(
  () =>
    import("@/components/dish/DishModelViewer").then(
      (mod) => mod.DishModelViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className={styles.phoneModelLoading} role="status" aria-live="polite">
        Préparation de la vue immersive...
      </div>
    )
  }
);

const filterChips: { key: ToggleFilterKey; label: string }[] = [
  { key: "signatureOnly", label: "Signature" },
  { key: "recommendedOnly", label: "Recommandé" },
  { key: "availableOnly", label: "Disponibles" },
  { key: "with3dOnly", label: "Vue 3D" }
];

const allergenOptions: { value: Allergen | ""; label: string }[] = [
  { value: "", label: "Tous les plats" },
  { value: "gluten", label: "Sans gluten" },
  { value: "dairy", label: "Sans lactose / laitiers" },
  { value: "nuts", label: "Sans fruits à coque" },
  { value: "shellfish", label: "Sans crustacés" },
  { value: "eggs", label: "Sans œufs" },
  { value: "sesame", label: "Sans sésame" },
  { value: "soy", label: "Sans soja" },
  { value: "fish", label: "Sans poisson" }
];

const allergenLabels: Record<Allergen, string> = {
  gluten: "Gluten",
  dairy: "Produits laitiers",
  nuts: "Fruits à coque",
  shellfish: "Crustacés",
  eggs: "Oeufs",
  sesame: "Sésame",
  soy: "Soja",
  fish: "Poisson"
};

function formatPreviewPrice(price: number) {
  return `$${price}`;
}

function getDishBadges(dish: Dish, locale: Locale) {
  const badges: string[] = [];

  if (dish.isSignature) badges.push("Signature");
  if (dish.isRecommended) badges.push(locale === "en" ? "Recommended" : "Recommandé");
  if (dishHasImmersiveAsset(dish)) badges.push("3D");
  if (!dish.isAvailable) badges.push(locale === "en" ? "Unavailable" : "Indisponible");

  return badges;
}

function getDishPreviewAriaLabel(
  dish: Dish,
  badges: string[],
  locale: Locale
) {
  const badgeText = badges.length > 0 ? ` · ${badges.join(", ")}` : "";
  const availability =
    locale === "en"
      ? dish.isAvailable
        ? "available"
        : "unavailable"
      : dish.isAvailable
        ? "disponible"
        : "indisponible";
  const detailCta =
    locale === "en" ? "View the dish page." : "Voir la fiche plat.";

  return `${dish.name}, ${formatPreviewPrice(dish.price)}, ${dish.shortDescription} · ${availability}${badgeText}. ${detailCta}`;
}

export function VistaireMenuPreview({
  locale = "fr",
  routeMode = "preview"
}: {
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const restaurant = getRestaurant(locale);
  const categories = getCategories(locale);
  const dishes = getAllDishes(locale);
  const ui =
    locale === "en"
      ? {
          sectionLabel: "Maison Élyse sample digital menu",
          visualLabel: "Digital menu",
          visualAlt: "Vistaire digital menu presented on a restaurant table",
          visualTitleA: "DIGITAL",
          visualTitleB: "MENU",
          exitPhone: "Leave phone preview",
          backToMenu: "Back to menu",
          photoAltPrefix: "Dish photo:",
          fallbackCategory: "Menu",
          badgesLabel: "Dish badges",
          ingredients: "Ingredients",
          allergens: "Allergens",
          allergenFallback: "Confirm with the restaurant team.",
          chefNote: "Chef note",
          modelKicker: "Selective 3D / AR",
          modelAvailable: "Immersive preview available",
          modelUnavailable: "3D view coming soon for this dish",
          modelAvailableBody: "Open the 3D view directly inside this phone preview.",
          modelUnavailableBody:
            "This dish keeps its premium page here; 3D can be added only when a model is available.",
          modelButton: "View in 3D",
          modelFallback: "3D / AR coming soon for this dish.",
          phoneToggle: "Show phone preview of the menu",
          phoneToggleLabel: "Phone preview",
          badge: "Vistaire menu experience",
          fictive: "Fictional restaurant · Premium client menu",
          all: "All",
          signatures: "Signatures",
          searchLabel: "Search the menu",
          searchPlaceholder: "Search a dish, an ingredient...",
          filtersLabel: "Quick filters",
          allergenLabel: "Filter by dietary preference",
          reset: "Reset",
          empty: "No dish in this selection.",
          emptyAction: "View the full menu",
          footnote:
            "Dishes, prices and information are fictional and used to present the Vistaire experience.",
          resultSingle: "Maison Élyse selection · 1 creation shown",
          resultPlural: (count: number) =>
            `Maison Élyse selection · ${count} creations shown`,
          filterChips: [
            { key: "signatureOnly" as const, label: "Signature" },
            { key: "recommendedOnly" as const, label: "Recommended" },
            { key: "availableOnly" as const, label: "Available" },
            { key: "with3dOnly" as const, label: "3D view" }
          ],
          allergenOptions: [
            { value: "" as const, label: "All dishes" },
            { value: "gluten" as const, label: "Gluten-free" },
            { value: "dairy" as const, label: "Dairy-free" },
            { value: "nuts" as const, label: "Nut-free" },
            { value: "shellfish" as const, label: "Shellfish-free" },
            { value: "eggs" as const, label: "Egg-free" },
            { value: "sesame" as const, label: "Sesame-free" },
            { value: "soy" as const, label: "Soy-free" },
            { value: "fish" as const, label: "Fish-free" }
          ],
          allergenLabels: {
            gluten: "Gluten",
            dairy: "Dairy",
            nuts: "Nuts",
            shellfish: "Shellfish",
            eggs: "Eggs",
            sesame: "Sesame",
            soy: "Soy",
            fish: "Fish"
          } satisfies Record<Allergen, string>
        }
      : {
          sectionLabel: "Carte digitale preview Maison Élyse",
          visualLabel: "Carte digitale",
          visualAlt: "Carte digitale Vistaire présentée sur une table de restaurant",
          visualTitleA: "CARTE",
          visualTitleB: "DIGITALE",
          exitPhone: "Quitter l'aperçu téléphone",
          backToMenu: "Retour à la carte",
          photoAltPrefix: "Photo du plat :",
          fallbackCategory: "Carte",
          badgesLabel: "Badges du plat",
          ingredients: "Ingrédients",
          allergens: "Allergènes",
          allergenFallback: "À confirmer auprès du restaurant.",
          chefNote: "Note du chef",
          modelKicker: "3D / AR sélective",
          modelAvailable: "Aperçu immersif disponible",
          modelUnavailable: "Vue 3D bientôt disponible pour ce plat",
          modelAvailableBody:
            "Ouvrez la vue 3D directement dans cet aperçu téléphone.",
          modelUnavailableBody:
            "Ce plat garde sa fiche premium ici; la 3D peut être ajoutée seulement quand un modèle est disponible.",
          modelButton: "Voir en 3D",
          modelFallback: "3D / AR bientôt disponible pour ce plat.",
          phoneToggle: "Afficher l'aperçu téléphone de la carte",
          phoneToggleLabel: "Aperçu téléphone",
          badge: "Démo interactive Vistaire",
          fictive: "Restaurant fictif · Carte client premium",
          all: "Tous",
          signatures: "Signatures",
          searchLabel: "Rechercher dans la carte",
          searchPlaceholder: "Rechercher un plat, un ingrédient...",
          filtersLabel: "Filtres rapides",
          allergenLabel: "Filtrer par préférence alimentaire",
          reset: "Réinitialiser",
          empty: "Aucun plat dans cette sélection.",
          emptyAction: "Voir toute la carte",
          footnote:
            "Les plats, prix et informations sont fictifs et servent à présenter l'expérience Vistaire.",
          resultSingle: "Sélection Maison Élyse · 1 création affichée",
          resultPlural: (count: number) =>
            `Sélection Maison Élyse · ${count} créations affichées`,
          filterChips,
          allergenOptions,
          allergenLabels
        };
  const localizedCategoryTabs = [
    { label: ui.all, slug: MENU_ALL_CATEGORY_SLUG },
    ...categories.map((category) => ({
      label:
        category.slug === "plats-signatures" ? ui.signatures : category.name,
      slug: category.slug
    }))
  ];
  const phonePanelRef = useRef<HTMLElement | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(
    MENU_ALL_CATEGORY_SLUG
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isPhonePreview, setIsPhonePreview] = useState(false);
  const [phoneDishSlug, setPhoneDishSlug] = useState<string | null>(null);
  const [phoneShowModel, setPhoneShowModel] = useState(false);
  const [filters, setFilters] = useState<MenuFilterState>(() =>
    defaultMenuFilterState()
  );

  const visibleDishes = useMemo(() => {
    const categoryDishes =
      activeCategory === MENU_ALL_CATEGORY_SLUG
        ? dishes
        : dishes.filter((dish) => dish.categorySlug === activeCategory);

    const searchedDishes = categoryDishes.filter((dish) =>
      dishMatchesSearch(dish, searchQuery)
    );

    return applyMenuFilters(searchedDishes, filters);
  }, [activeCategory, dishes, filters, searchQuery]);

  const selectedPhoneDish = useMemo(
    () => dishes.find((dish) => dish.slug === phoneDishSlug) ?? null,
    [dishes, phoneDishSlug]
  );

  const resetFilters = () => {
    setActiveCategory(MENU_ALL_CATEGORY_SLUG);
    setSearchQuery("");
    setFilters(defaultMenuFilterState());
    setPhoneDishSlug(null);
    setPhoneShowModel(false);
  };

  const toggleFilter = (key: ToggleFilterKey) => {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  };

  const changeAllergen = (value: string) => {
    setFilters((current) => ({
      ...current,
      excludeAllergen: value === "" ? null : (value as Allergen)
    }));
  };

  const hasSelection =
    activeCategory !== MENU_ALL_CATEGORY_SLUG ||
    searchQuery.trim().length > 0 ||
    hasActiveFilters(filters);

  const resultLabel =
    visibleDishes.length === 1
      ? ui.resultSingle
      : ui.resultPlural(visibleDishes.length);

  const openPhoneDish =
    (dish: Dish) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isPhonePreview) return;

      event.preventDefault();
      setPhoneDishSlug(dish.slug);
      setPhoneShowModel(false);
      requestAnimationFrame(() => {
        phonePanelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
    };

  const closePhoneDish = () => {
    setPhoneDishSlug(null);
    setPhoneShowModel(false);
    requestAnimationFrame(() => {
      phonePanelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const closePhonePreview = () => {
    setPhoneDishSlug(null);
    setPhoneShowModel(false);
    setIsPhonePreview(false);
  };

  return (
    <main className={styles.page}>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        priority
        quality={100}
        sizes="100vw"
        src={restaurantBackground}
        unoptimized
      />

      <section
        aria-label={ui.sectionLabel}
        className={styles.hero}
      >
        <div
          className={`${styles.previewFrame} ${
            isPhonePreview ? styles.previewFramePhone : ""
          }`}
          id="carte"
        >
          <article className={styles.visualPanel} aria-label={ui.visualLabel}>
            <Image
              alt={ui.visualAlt}
              className={styles.visualImage}
              fill
              priority
              quality={100}
              sizes="(max-width: 920px) calc(100vw - 36px), 532px"
              src={menuVisual}
              unoptimized
            />
            <div aria-hidden="true" className={styles.visualShade} />
            <div className={styles.visualCopy}>
              <h1>
                <span>{ui.visualTitleA}</span>
                <span>{ui.visualTitleB}</span>
              </h1>
            </div>
          </article>

          <div
            className={`${styles.menuStage} ${
              isPhonePreview ? styles.menuStagePhone : ""
            }`}
          >
            {isPhonePreview ? (
              <button
                aria-label={ui.exitPhone}
                aria-pressed={isPhonePreview}
                className={styles.phoneExitToggle}
                onClick={closePhonePreview}
                type="button"
              >
                {ui.exitPhone}
              </button>
            ) : null}

            <section
              aria-labelledby={
                selectedPhoneDish
                  ? "phone-dish-detail-heading"
                  : "menu-preview-heading"
              }
              className={`${styles.menuPanel} ${
                isPhonePreview ? styles.menuPanelPhone : ""
              }`}
              ref={phonePanelRef}
            >
            {isPhonePreview && selectedPhoneDish ? (
              <article className={styles.phoneDetail}>
                <button
                  className={styles.phoneBackButton}
                  onClick={closePhoneDish}
                  type="button"
                >
                  {ui.backToMenu}
                </button>

                {selectedPhoneDish.image ? (
                  <div className={styles.phoneDetailImage}>
                    <Image
                      alt={`${ui.photoAltPrefix} ${selectedPhoneDish.name}`}
                      fill
                      priority
                      quality={100}
                      sizes="400px"
                      src={selectedPhoneDish.image}
                      style={{
                        objectPosition:
                          getDishDetailImageObjectPosition(selectedPhoneDish)
                      }}
                      unoptimized
                    />
                  </div>
                ) : null}

                <div className={styles.phoneDetailHeader}>
                  <p className={styles.phoneDetailKicker}>
                    {categories.find(
                      (category) =>
                        category.slug === selectedPhoneDish.categorySlug
                    )?.name ?? ui.fallbackCategory}
                  </p>
                  <h2 id="phone-dish-detail-heading">
                    {selectedPhoneDish.name}
                  </h2>
                  <p className={styles.phoneDetailPrice}>
                    {formatPreviewPrice(selectedPhoneDish.price)}
                  </p>
                  <p className={styles.phoneDetailShort}>
                    {selectedPhoneDish.shortDescription}
                  </p>
                </div>

                <div
                  className={styles.phoneDetailBadges}
                  aria-label={ui.badgesLabel}
                >
                  {getDishBadges(selectedPhoneDish, locale).map((badge) => (
                    <span
                      className={
                        badge === "Indisponible" || badge === "Unavailable"
                          ? styles.dishUnavailable
                          : styles.dishBadge
                      }
                      key={`${selectedPhoneDish.id}-${badge}`}
                    >
                      {badge}
                    </span>
                  ))}
                </div>

                <p className={styles.phoneDetailDescription}>
                  {selectedPhoneDish.description}
                </p>

                <div className={styles.phoneDetailGrid}>
                  <section>
                    <h3>{ui.ingredients}</h3>
                    <ul>
                      {selectedPhoneDish.ingredients.slice(0, 5).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3>{ui.allergens}</h3>
                    {selectedPhoneDish.allergens.length > 0 ? (
                      <ul>
                        {selectedPhoneDish.allergens.map((allergen) => (
                          <li key={allergen}>{ui.allergenLabels[allergen]}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{ui.allergenFallback}</p>
                    )}
                  </section>
                </div>

                <section className={styles.phoneChefNote}>
                  <h3>{ui.chefNote}</h3>
                  <p>{selectedPhoneDish.chefRecommendation}</p>
                </section>

                <section
                  className={styles.phoneModelPanel}
                  aria-labelledby="phone-dish-model-heading"
                >
                  <div className={styles.phoneModelIntro}>
                    <p className={styles.phoneDetailKicker}>
                      {ui.modelKicker}
                    </p>
                    <h3 id="phone-dish-model-heading">
                      {dishHasImmersiveAsset(selectedPhoneDish)
                        ? ui.modelAvailable
                        : ui.modelUnavailable}
                    </h3>
                    <p>
                      {dishHasImmersiveAsset(selectedPhoneDish)
                        ? ui.modelAvailableBody
                        : ui.modelUnavailableBody}
                    </p>
                  </div>

                  {dishHasImmersiveAsset(selectedPhoneDish) ? (
                    <>
                      <button
                        aria-controls="phone-dish-model-viewer"
                        aria-expanded={phoneShowModel}
                        className={styles.phoneModelButton}
                        onClick={() => setPhoneShowModel(true)}
                        type="button"
                      >
                        {ui.modelButton}
                      </button>
                      {phoneShowModel ? (
                        <div
                          className={styles.phoneModelViewer}
                          id="phone-dish-model-viewer"
                        >
                          <LazyDishModelViewer
                            dish={selectedPhoneDish}
                            minimalChrome
                            onReturnToDish={() => setPhoneShowModel(false)}
                          />
                        </div>
                      ) : (
                        <div
                          className={styles.phoneModelPreview}
                          id="phone-dish-model-viewer"
                          aria-hidden="true"
                        >
                          3D
                        </div>
                      )}
                    </>
                  ) : (
                    <p className={styles.phoneDetailModel}>
                      {ui.modelFallback}
                    </p>
                  )}
                </section>
              </article>
            ) : (
              <>
            <div aria-hidden="true" className={styles.menuOrnament}>
              <span />
              <span />
            </div>

            <div className={styles.menuIntro}>
              <div className={styles.menuTitleRow}>
                <h2 id="menu-preview-heading">{restaurant.name}</h2>
                <div className={styles.menuTitleActions}>
                  {!isPhonePreview ? (
                    <button
                      aria-label={ui.phoneToggle}
                      aria-pressed={isPhonePreview}
                      className={styles.viewToggle}
                      onClick={() => setIsPhonePreview(true)}
                      type="button"
                    >
                      {ui.phoneToggleLabel}
                    </button>
                  ) : null}
                  <p className={styles.demoBadge}>{ui.badge}</p>
                </div>
              </div>
              <p className={styles.fictiveLine}>
                {ui.fictive}
              </p>
            </div>

            <div
              aria-label={locale === "en" ? "Menu categories" : "Catégories de la carte"}
              className={styles.categoryTabs}
              role="group"
            >
              {localizedCategoryTabs.map((category) => {
                const isActive = activeCategory === category.slug;

                return (
                  <button
                    aria-pressed={isActive}
                    className={isActive ? styles.isActive : undefined}
                    key={category.slug}
                    onClick={() => setActiveCategory(category.slug)}
                    type="button"
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>

            <div className={styles.menuTools}>
              <label className={styles.searchBox}>
                <span className={styles.srOnly}>{ui.searchLabel}</span>
                <input
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={ui.searchPlaceholder}
                  type="search"
                  value={searchQuery}
                />
              </label>

              <div
                aria-label={ui.filtersLabel}
                className={styles.filterPills}
                role="group"
              >
                {ui.filterChips.map((filter) => {
                  const isActive = filters[filter.key];

                  return (
                    <button
                      aria-pressed={isActive}
                      className={isActive ? styles.isActive : undefined}
                      key={filter.key}
                      onClick={() => toggleFilter(filter.key)}
                      type="button"
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              <div className={styles.filterSelectRow}>
                <label className={styles.srOnly} htmlFor="preview-allergen">
                  {ui.allergenLabel}
                </label>
                <select
                  id="preview-allergen"
                  onChange={(event) => changeAllergen(event.target.value)}
                  value={filters.excludeAllergen ?? ""}
                >
                  {ui.allergenOptions.map((option) => (
                    <option key={option.value || "none"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <p aria-live="polite" className={styles.resultStatus}>
                  {resultLabel}
                </p>

                {hasSelection ? (
                  <button
                    className={styles.resetButton}
                    onClick={resetFilters}
                    type="button"
                  >
                    {ui.reset}
                  </button>
                ) : null}
              </div>
            </div>

            <div className={styles.dishList} id="menu-preview-results">
              {visibleDishes.length > 0 ? (
                visibleDishes.map((dish) => {
                  const dishBadges = getDishBadges(dish, locale);

                  return (
                    <Link
                      aria-label={getDishPreviewAriaLabel(dish, dishBadges, locale)}
                      className={styles.dishRow}
                      href={`${routes.menu}/dishes/${dish.slug}`}
                      key={dish.id}
                      onClick={openPhoneDish(dish)}
                      prefetch={false}
                    >
                      <span className={styles.dishThumb}>
                        {dish.image ? (
                          <Image
                            alt={dish.name}
                            fill
                            quality={100}
                            sizes="(max-width: 520px) 86px, 96px"
                            src={dish.image}
                            style={{
                              objectPosition:
                                getDishCardImageObjectPosition(dish)
                            }}
                            unoptimized
                          />
                        ) : (
                          <span className={styles.dishThumbFallback}>
                            {restaurant.logoMonogram}
                          </span>
                        )}
                      </span>
                      <span className={styles.dishCopy}>
                        <span className={styles.dishName}>{dish.name}</span>
                        <span className={styles.dishDescription}>
                          {dish.shortDescription}
                        </span>
                        {dishBadges.length > 0 ? (
                          <span
                            aria-label={`Badges : ${dishBadges.join(", ")}`}
                            className={styles.dishMeta}
                          >
                            {dishBadges.map((badge) => (
                              <span
                                className={
                                  badge === "Indisponible" || badge === "Unavailable"
                                    ? styles.dishUnavailable
                                    : styles.dishBadge
                                }
                                key={`${dish.id}-${badge}`}
                              >
                                {badge}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.dishPrice}>
                        {formatPreviewPrice(dish.price)}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className={styles.emptyState} role="status">
                  <p>{ui.empty}</p>
                  <button onClick={resetFilters} type="button">
                    {ui.emptyAction}
                  </button>
                </div>
              )}
            </div>

            <p className={styles.demoFootnote}>
              {ui.footnote}
            </p>
              </>
            )}
            </section>
          </div>
        </div>

        <PreviewNav
          activeSection="menu"
          currentPath={routes.menu}
          locale={locale}
          routeMode={routeMode}
        />
      </section>

      <PreviewFooter
        currentPath={routes.menu}
        locale={locale}
        routeMode={routeMode}
        width="wide"
      />
    </main>
  );
}
