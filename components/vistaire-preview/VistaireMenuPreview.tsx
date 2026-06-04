"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, type MouseEvent } from "react";
import restaurantBackground from "@/Framer/PhotoRestoComplet2.png";
import menuVisual from "@/Framer/pageCarte.png";
import type { DishModelViewerProps } from "@/components/dish/DishModelViewer";
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

const restaurant = getRestaurant();
const categories = getCategories();
const dishes = getAllDishes();

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

const categoryTabs = [
  { label: "Tous", slug: MENU_ALL_CATEGORY_SLUG },
  ...categories.map((category) => ({
    label:
      category.slug === "plats-signatures" ? "Signatures" : category.name,
    slug: category.slug
  }))
] as const;

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

function getDishBadges(dish: Dish) {
  const badges: string[] = [];

  if (dish.isSignature) badges.push("Signature");
  if (dish.isRecommended) badges.push("Recommandé");
  if (dishHasImmersiveAsset(dish)) badges.push("3D");
  if (!dish.isAvailable) badges.push("Indisponible");

  return badges;
}

function getDishPreviewAriaLabel(dish: Dish, badges: string[]) {
  const badgeText = badges.length > 0 ? ` · ${badges.join(", ")}` : "";
  const availability = dish.isAvailable ? "disponible" : "indisponible";

  return `${dish.name}, ${formatPreviewPrice(dish.price)}, ${dish.shortDescription} · ${availability}${badgeText}. Voir la fiche plat.`;
}

export function VistaireMenuPreview({
  routeMode = "preview"
}: {
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode);
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
  }, [activeCategory, filters, searchQuery]);

  const selectedPhoneDish = useMemo(
    () => dishes.find((dish) => dish.slug === phoneDishSlug) ?? null,
    [phoneDishSlug]
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
      ? "Sélection Maison Élyse · 1 création affichée"
      : `Sélection Maison Élyse · ${visibleDishes.length} créations affichées`;

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
        aria-label="Carte digitale preview Maison Élyse"
        className={styles.hero}
      >
        <div
          className={`${styles.previewFrame} ${
            isPhonePreview ? styles.previewFramePhone : ""
          }`}
          id="carte"
        >
          <article className={styles.visualPanel} aria-label="Carte digitale">
            <Image
              alt="Carte digitale Vistaire présentée sur une table de restaurant"
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
                <span>CARTE</span>
                <span>DIGITALE</span>
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
                aria-label="Quitter l'aperçu téléphone de la carte"
                aria-pressed={isPhonePreview}
                className={styles.phoneExitToggle}
                onClick={closePhonePreview}
                type="button"
              >
                Quitter l’aperçu téléphone
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
                  Retour à la carte
                </button>

                {selectedPhoneDish.image ? (
                  <div className={styles.phoneDetailImage}>
                    <Image
                      alt={`Photo du plat : ${selectedPhoneDish.name}`}
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
                    )?.name ?? "Carte"}
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
                  aria-label="Badges du plat"
                >
                  {getDishBadges(selectedPhoneDish).map((badge) => (
                    <span
                      className={
                        badge === "Indisponible"
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
                    <h3>Ingrédients</h3>
                    <ul>
                      {selectedPhoneDish.ingredients.slice(0, 5).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3>Allergènes</h3>
                    {selectedPhoneDish.allergens.length > 0 ? (
                      <ul>
                        {selectedPhoneDish.allergens.map((allergen) => (
                          <li key={allergen}>{allergenLabels[allergen]}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>À confirmer auprès du restaurant.</p>
                    )}
                  </section>
                </div>

                <section className={styles.phoneChefNote}>
                  <h3>Note du chef</h3>
                  <p>{selectedPhoneDish.chefRecommendation}</p>
                </section>

                <section
                  className={styles.phoneModelPanel}
                  aria-labelledby="phone-dish-model-heading"
                >
                  <div className={styles.phoneModelIntro}>
                    <p className={styles.phoneDetailKicker}>
                      3D / AR sélective
                    </p>
                    <h3 id="phone-dish-model-heading">
                      {dishHasImmersiveAsset(selectedPhoneDish)
                        ? "Aperçu immersif disponible"
                        : "Vue 3D bientôt disponible pour ce plat"}
                    </h3>
                    <p>
                      {dishHasImmersiveAsset(selectedPhoneDish)
                        ? "Ouvrez la vue 3D directement dans cet aperçu téléphone."
                        : "Ce plat garde sa fiche premium ici; la 3D peut être ajoutée seulement quand un modèle est disponible."}
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
                        Voir en 3D
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
                      3D / AR bientôt disponible pour ce plat.
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
                      aria-label="Afficher l'aperçu téléphone de la carte"
                      aria-pressed={isPhonePreview}
                      className={styles.viewToggle}
                      onClick={() => setIsPhonePreview(true)}
                      type="button"
                    >
                      Aperçu téléphone
                    </button>
                  ) : null}
                  <p className={styles.demoBadge}>Démo interactive Vistaire</p>
                </div>
              </div>
              <p className={styles.fictiveLine}>
                Restaurant fictif · Carte client premium
              </p>
            </div>

            <div
              aria-label="Catégories de la carte"
              className={styles.categoryTabs}
              role="group"
            >
              {categoryTabs.map((category) => {
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
                <span className={styles.srOnly}>Rechercher dans la carte</span>
                <input
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Rechercher un plat, un ingrédient..."
                  type="search"
                  value={searchQuery}
                />
              </label>

              <div
                aria-label="Filtres rapides"
                className={styles.filterPills}
                role="group"
              >
                {filterChips.map((filter) => {
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
                  Filtrer par préférence alimentaire
                </label>
                <select
                  id="preview-allergen"
                  onChange={(event) => changeAllergen(event.target.value)}
                  value={filters.excludeAllergen ?? ""}
                >
                  {allergenOptions.map((option) => (
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
                    Réinitialiser
                  </button>
                ) : null}
              </div>
            </div>

            <div className={styles.dishList} id="menu-preview-results">
              {visibleDishes.length > 0 ? (
                visibleDishes.map((dish) => {
                  const dishBadges = getDishBadges(dish);

                  return (
                    <Link
                      aria-label={getDishPreviewAriaLabel(dish, dishBadges)}
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
                                  badge === "Indisponible"
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
                  <p>Aucun plat dans cette sélection.</p>
                  <button onClick={resetFilters} type="button">
                    Voir toute la carte
                  </button>
                </div>
              )}
            </div>

            <p className={styles.demoFootnote}>
              Les plats, prix et informations sont fictifs et servent à
              présenter l’expérience Vistaire.
            </p>
              </>
            )}
            </section>
          </div>
        </div>

        <PreviewNav activeSection="menu" routeMode={routeMode} />
      </section>

      <PreviewFooter routeMode={routeMode} width="wide" />
    </main>
  );
}
