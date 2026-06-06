"use client";

import { useMemo, useState } from "react";
import type { OwnerRestaurant } from "@/lib/owner/types";
import styles from "./MenuUiBuilder.module.css";

type MenuBuilderRestaurant = Pick<
  OwnerRestaurant,
  "id" | "name" | "slug" | "publicMenuPath" | "publicMenuUrl"
>;

type MenuUiBuilderProps = {
  restaurants: MenuBuilderRestaurant[];
  source: "supabase" | "fallback";
  note: string;
};

type ThemeId =
  | "fresh-homemade"
  | "premium-gastronomic"
  | "street-casual"
  | "cafe-brunch"
  | "minimal-clean";

type Density = "compact" | "comfortable" | "expressive";

type WelcomeMotion = "none" | "soft" | "expressive";

type CategoryNavigation = "tabs" | "cards" | "tabs-cards";

type DishCardStyle = "compact" | "photo-compact" | "photo-large" | "minimal-list";

type DetailStyle = "bottom-sheet" | "full-card" | "simple-card";

type BuilderDish = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  hasPhoto: boolean;
  has3d: boolean;
  hasAr: boolean;
  tags: string[];
};

type BuilderCategory = {
  name: string;
  dishes: BuilderDish[];
};

type WelcomeCopy = {
  title: string;
  subtitle: string;
};

const THEME_OPTIONS: Array<{
  id: ThemeId;
  name: string;
  description: string;
  className: string;
}> = [
  {
    id: "fresh-homemade",
    name: "Fresh Homemade",
    description: "Clair, coloré, maison. Parfait pour Resto Marc.",
    className: styles.themeFresh
  },
  {
    id: "premium-gastronomic",
    name: "Premium Gastronomic",
    description: "Sombre, élégant, gastronomique. Plus proche de Maison Élyse.",
    className: styles.themePremium
  },
  {
    id: "street-casual",
    name: "Street Casual",
    description: "Punchy, rapide, comptoir, prix très visibles.",
    className: styles.themeStreet
  },
  {
    id: "cafe-brunch",
    name: "Café Brunch",
    description: "Chaud, doux, lumineux, café et brunch.",
    className: styles.themeCafe
  },
  {
    id: "minimal-clean",
    name: "Minimal Clean",
    description: "Sobre, propre, très simple, neutre.",
    className: styles.themeMinimal
  }
];

const CATEGORY_META: Record<
  string,
  { icon: string; description: string; tone: string }
> = {
  Entrées: {
    icon: "🥗",
    description: "Pour commencer doucement",
    tone: styles.categoryBlue
  },
  Plats: {
    icon: "🍛",
    description: "Nos assiettes maison",
    tone: styles.categoryGreen
  },
  Desserts: {
    icon: "🍰",
    description: "Une touche sucrée",
    tone: styles.categoryYellow
  },
  Boissons: {
    icon: "🥤",
    description: "Frais et simple",
    tone: styles.categoryRed
  }
};

const DEFAULT_MENU = `Entrées
Salade fraîche maison | 8.99 | Légumes croquants, vinaigrette légère et herbes fraîches.
Soupe du jour | 7.49 | Soupe maison préparée avec les ingrédients du moment.

Plats
Bol de riz au poulet et légumes | 17.99 | Riz chaud servi avec morceaux de poulet grillé, légumes sautés, sauce maison légère et garniture fraîche.
Sandwich poulet grillé | 14.99 | Pain moelleux, poulet grillé, légumes frais et sauce maison.
Pâtes sauce maison | 15.99 | Pâtes servies avec une sauce tomate maison, herbes et parmesan.

Desserts
Gâteau au chocolat | 6.99 | Gâteau moelleux au chocolat, servi en portion généreuse.
Coupe de fruits frais | 5.99 | Mélange de fruits frais coupés, léger et rafraîchissant.

Boissons
Limonade maison | 4.49 | Limonade fraîche, citronnée et légèrement sucrée.
Thé glacé | 4.49 | Thé glacé maison servi bien frais.`;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function formatPrice(value: string): string {
  const parsed = Number(value.replace(",", ".").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return value || "Prix à confirmer";
  }

  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD"
  }).format(parsed);
}

function parseMenu(raw: string): BuilderCategory[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const categories: BuilderCategory[] = [];
  let current: BuilderCategory | null = null;

  for (const line of lines) {
    if (!line.includes("|")) {
      current = { name: line, dishes: [] };
      categories.push(current);
      continue;
    }

    if (!current) {
      current = { name: "Carte", dishes: [] };
      categories.push(current);
    }

    const [rawName = "", rawPrice = "", rawDescription = ""] = line
      .split("|")
      .map((item) => item.trim());

    if (!rawName) continue;

    const id = slugify(`${current.name}-${rawName}`);
    const lowerName = rawName.toLowerCase();

    current.dishes.push({
      id,
      name: rawName,
      category: current.name,
      description: rawDescription,
      price: rawPrice,
      hasPhoto:
        lowerName.includes("bol") ||
        lowerName.includes("gâteau") ||
        lowerName.includes("salade"),
      has3d: lowerName.includes("bol"),
      hasAr: lowerName.includes("bol"),
      tags: lowerName.includes("bol") ? ["Maison", "Signature"] : ["Maison"]
    });
  }

  return categories.filter((category) => category.dishes.length > 0);
}

function flattenDishes(categories: BuilderCategory[]): BuilderDish[] {
  return categories.flatMap((category) => category.dishes);
}

function preferRestaurant(restaurants: MenuBuilderRestaurant[]): string {
  const restoMarc = restaurants.find(
    (restaurant) =>
      restaurant.slug === "resto-marc" ||
      restaurant.name.toLowerCase().includes("resto marc")
  );

  return restoMarc?.id ?? restaurants[0]?.id ?? "";
}

function buildWelcomeCopy(
  restaurant: MenuBuilderRestaurant | undefined
): WelcomeCopy {
  const name = restaurant?.name.trim() || "Restaurant";

  return {
    title: `Bienvenue chez ${name}`,
    subtitle:
      restaurant?.slug === "resto-marc"
        ? "Cuisine maison fraîche et généreuse"
        : "Découvrez notre carte"
  };
}

function getDishIcon(dish: BuilderDish): string {
  if (dish.category === "Desserts") return "🍰";
  if (dish.category === "Boissons") return "🥤";
  return "🍽️";
}

export function MenuUiBuilder({
  restaurants,
  source,
  note
}: MenuUiBuilderProps) {
  const initialRestaurantId = preferRestaurant(restaurants);
  const initialRestaurant =
    restaurants.find((restaurant) => restaurant.id === initialRestaurantId) ??
    restaurants[0];
  const initialWelcomeCopy = buildWelcomeCopy(initialRestaurant);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(
    () => initialRestaurantId
  );
  const [themeId, setThemeId] = useState<ThemeId>("fresh-homemade");
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeTitle, setWelcomeTitle] = useState(
    () => initialWelcomeCopy.title
  );
  const [welcomeSubtitle, setWelcomeSubtitle] = useState(
    () => initialWelcomeCopy.subtitle
  );
  const [motion, setMotion] = useState<WelcomeMotion>("soft");
  const [categoryNavigation, setCategoryNavigation] =
    useState<CategoryNavigation>("tabs-cards");
  const [dishCardStyle, setDishCardStyle] =
    useState<DishCardStyle>("photo-compact");
  const [detailStyle, setDetailStyle] = useState<DetailStyle>("bottom-sheet");
  const [density, setDensity] = useState<Density>("comfortable");
  const [showPhotoPlaceholders, setShowPhotoPlaceholders] = useState(true);
  const [show3dBadges, setShow3dBadges] = useState(true);
  const [showArBadges, setShowArBadges] = useState(true);
  const [rawMenu, setRawMenu] = useState(DEFAULT_MENU);
  const [activeTab, setActiveTab] = useState("Tout");
  const [selectedDish, setSelectedDish] = useState<BuilderDish | null>(null);
  const [saveStatus, setSaveStatus] = useState("Draft local non sauvegardé");

  const selectedRestaurant = useMemo(
    () =>
      restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ??
      restaurants[0],
    [restaurants, selectedRestaurantId]
  );

  const categories = useMemo(() => parseMenu(rawMenu), [rawMenu]);
  const dishes = useMemo(() => flattenDishes(categories), [categories]);

  const selectedTheme = THEME_OPTIONS.find((theme) => theme.id === themeId)!;
  const categoryNames = categories.map((category) => category.name);
  const tabs = ["Tout", "Catégories", ...categoryNames];
  const publicMenuPath = selectedRestaurant?.publicMenuPath ?? "/menu/resto-marc";
  const publicMenuUrl = selectedRestaurant?.publicMenuUrl ?? publicMenuPath;

  const activeCategory = categories.find((category) => category.name === activeTab);

  const qualityChecks = [
    {
      label: selectedRestaurant
        ? `Restaurant sélectionné : ${selectedRestaurant.name}`
        : "Aucun restaurant sélectionné",
      ok: Boolean(selectedRestaurant),
      blocker: true
    },
    {
      label: `${categories.length} catégorie(s) détectée(s)`,
      ok: categories.length > 0,
      blocker: true
    },
    {
      label: `${dishes.length} plat(s) dans le draft`,
      ok: dishes.length > 0,
      blocker: true
    },
    {
      label: `${dishes.filter((dish) => dish.hasPhoto).length}/${dishes.length} plat(s) avec photo`,
      ok: dishes.some((dish) => dish.hasPhoto),
      blocker: false
    },
    {
      label: `${dishes.filter((dish) => dish.has3d).length}/${dishes.length} plat(s) avec 3D`,
      ok: true,
      blocker: false
    },
    {
      label: "Aucun GLB/USDZ chargé automatiquement dans le builder",
      ok: true,
      blocker: true
    },
    {
      label: `Menu public prévu : ${publicMenuPath}`,
      ok: publicMenuPath.startsWith("/menu/") || publicMenuPath === "/demo",
      blocker: true
    }
  ];

  const densityClass =
    density === "compact"
      ? styles.densityCompact
      : density === "expressive"
        ? styles.densityExpressive
        : styles.densityComfortable;

  if (restaurants.length === 0) {
    return (
      <section className={styles.emptyBuilder}>
        <p className={styles.eyebrow}>Menu Builder</p>
        <h3>Aucun restaurant disponible</h3>
        <p>
          Créez d’abord un restaurant dans le owner dashboard pour générer une
          expérience menu.
        </p>
      </section>
    );
  }

  function resetWelcomeForRestaurant() {
    const copy = buildWelcomeCopy(selectedRestaurant);
    setWelcomeTitle(copy.title);
    setWelcomeSubtitle(copy.subtitle);
  }

  function renderDishCard(dish: BuilderDish) {
    const shouldShowVisual =
      dishCardStyle !== "minimal-list" && (dish.hasPhoto || showPhotoPlaceholders);

    return (
      <button
        key={dish.id}
        type="button"
        className={`${styles.dishCard} ${
          dishCardStyle === "photo-large" ? styles.dishCardLarge : ""
        } ${dishCardStyle === "minimal-list" ? styles.dishCardMinimal : ""} ${
          !shouldShowVisual ? styles.dishCardNoVisual : ""
        }`}
        onClick={() => setSelectedDish(dish)}
      >
        {shouldShowVisual ? (
          <div className={styles.dishVisual} aria-hidden="true">
            {dish.hasPhoto ? <span>{getDishIcon(dish)}</span> : <span>Photo</span>}
          </div>
        ) : null}

        <div className={styles.dishCardBody}>
          <div className={styles.dishCardTopline}>
            <h4>{dish.name}</h4>
            <strong>{formatPrice(dish.price)}</strong>
          </div>
          <p>{dish.description}</p>
          <div className={styles.badgeRow}>
            {dish.tags.map((tag) => (
              <span key={tag} className={styles.menuBadge}>
                {tag}
              </span>
            ))}
            {showPhotoPlaceholders && !dish.hasPhoto ? (
              <span className={styles.warningBadge}>Photo à faire</span>
            ) : null}
            {show3dBadges && dish.has3d ? (
              <span className={styles.modelBadge}>3D</span>
            ) : null}
            {showArBadges && dish.hasAr ? (
              <span className={styles.modelBadge}>AR</span>
            ) : null}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className={styles.builderShell}>
      <aside className={styles.controls}>
        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Source</p>
              <h3>Restaurant</h3>
            </div>
            <span className={styles.sourceBadge}>{source}</span>
          </div>

          <label className={styles.field}>
            Restaurant
            <select
              value={selectedRestaurantId}
              onChange={(event) => {
                const nextRestaurant =
                  restaurants.find(
                    (restaurant) => restaurant.id === event.target.value
                  ) ?? restaurants[0];
                const nextWelcomeCopy = buildWelcomeCopy(nextRestaurant);

                setSelectedRestaurantId(event.target.value);
                setWelcomeTitle(nextWelcomeCopy.title);
                setWelcomeSubtitle(nextWelcomeCopy.subtitle);
                setActiveTab("Tout");
                setSelectedDish(null);
                setSaveStatus("Draft local non sauvegardé");
              }}
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name} · {restaurant.slug}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.infoBox}>
            <span>Menu public</span>
            <strong>{publicMenuPath}</strong>
            <small>{note}</small>
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Theme</p>
              <h3>Style UI</h3>
            </div>
          </div>

          <div className={styles.themeGrid}>
            {THEME_OPTIONS.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`${styles.themeButton} ${
                  theme.id === themeId ? styles.themeButtonActive : ""
                }`}
                onClick={() => {
                  setThemeId(theme.id);
                  setSaveStatus("Draft local non sauvegardé");
                }}
              >
                <strong>{theme.name}</strong>
                <span>{theme.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Accueil</p>
              <h3>Welcome</h3>
            </div>
          </div>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={welcomeEnabled}
              onChange={(event) => {
                setWelcomeEnabled(event.target.checked);
                setSaveStatus("Draft local non sauvegardé");
              }}
            />
            Afficher l’accueil animé
          </label>

          <label className={styles.field}>
            Titre
            <input
              value={welcomeTitle}
              onChange={(event) => {
                setWelcomeTitle(event.target.value);
                setSaveStatus("Draft local non sauvegardé");
              }}
            />
          </label>

          <label className={styles.field}>
            Sous-titre
            <input
              value={welcomeSubtitle}
              onChange={(event) => {
                setWelcomeSubtitle(event.target.value);
                setSaveStatus("Draft local non sauvegardé");
              }}
            />
          </label>

          <label className={styles.field}>
            Motion
            <select
              value={motion}
              onChange={(event) => {
                setMotion(event.target.value as WelcomeMotion);
                setSaveStatus("Draft local non sauvegardé");
              }}
            >
              <option value="none">Aucune</option>
              <option value="soft">Soft</option>
              <option value="expressive">Expressive</option>
            </select>
          </label>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              resetWelcomeForRestaurant();
              setSaveStatus("Draft local non sauvegardé");
            }}
          >
            Réinitialiser avec le nom du resto
          </button>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Menu</p>
              <h3>Navigation & cards</h3>
            </div>
          </div>

          <div className={styles.optionGrid}>
            <label className={styles.field}>
              Navigation
              <select
                value={categoryNavigation}
                onChange={(event) => {
                  setCategoryNavigation(event.target.value as CategoryNavigation);
                  setActiveTab("Tout");
                  setSelectedDish(null);
                  setSaveStatus("Draft local non sauvegardé");
                }}
              >
                <option value="tabs">Tabs sticky</option>
                <option value="cards">Cards catégories</option>
                <option value="tabs-cards">Tabs + cards</option>
              </select>
            </label>

            <label className={styles.field}>
              Cards plats
              <select
                value={dishCardStyle}
                onChange={(event) => {
                  setDishCardStyle(event.target.value as DishCardStyle);
                  setSaveStatus("Draft local non sauvegardé");
                }}
              >
                <option value="compact">Compact</option>
                <option value="photo-compact">Photo compact</option>
                <option value="photo-large">Photo large</option>
                <option value="minimal-list">Minimal list</option>
              </select>
            </label>

            <label className={styles.field}>
              Fiche détail
              <select
                value={detailStyle}
                onChange={(event) => {
                  setDetailStyle(event.target.value as DetailStyle);
                  setSelectedDish(null);
                  setSaveStatus("Draft local non sauvegardé");
                }}
              >
                <option value="bottom-sheet">Bottom sheet</option>
                <option value="full-card">Full card</option>
                <option value="simple-card">Simple card</option>
              </select>
            </label>

            <label className={styles.field}>
              Densité
              <select
                value={density}
                onChange={(event) => {
                  setDensity(event.target.value as Density);
                  setSaveStatus("Draft local non sauvegardé");
                }}
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="expressive">Expressive</option>
              </select>
            </label>
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Assets</p>
              <h3>Photos + 3D / AR</h3>
            </div>
          </div>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={showPhotoPlaceholders}
              onChange={(event) => {
                setShowPhotoPlaceholders(event.target.checked);
                setSaveStatus("Draft local non sauvegardé");
              }}
            />
            Afficher photos/placeholders
          </label>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={show3dBadges}
              onChange={(event) => {
                setShow3dBadges(event.target.checked);
                setSaveStatus("Draft local non sauvegardé");
              }}
            />
            Afficher badges 3D si disponible
          </label>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={showArBadges}
              onChange={(event) => {
                setShowArBadges(event.target.checked);
                setSaveStatus("Draft local non sauvegardé");
              }}
            />
            Afficher badges AR si disponible
          </label>

          <p className={styles.helpText}>
            Aucun modèle GLB/USDZ n’est chargé dans le builder : le preview montre
            seulement le statut et les CTA.
          </p>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Données</p>
              <h3>Menu draft</h3>
            </div>
          </div>

          <textarea
            className={styles.menuTextarea}
            value={rawMenu}
            onChange={(event) => {
              setRawMenu(event.target.value);
              setActiveTab("Tout");
              setSelectedDish(null);
              setSaveStatus("Draft local non sauvegardé");
            }}
          />

          <p className={styles.helpText}>
            Format interne rapide : catégorie puis lignes “Nom | Prix |
            Description”. Ces données restent owner-entered.
          </p>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Quality</p>
              <h3>Checklist</h3>
            </div>
          </div>

          <div className={styles.qualityList}>
            {qualityChecks.map((check) => (
              <div
                key={check.label}
                className={`${styles.qualityItem} ${
                  check.ok
                    ? styles.qualityOk
                    : check.blocker
                      ? styles.qualityBad
                      : styles.qualityWarn
                }`}
              >
                <span>{check.ok ? "✓" : check.blocker ? "!" : "•"}</span>
                <p>{check.label}</p>
              </div>
            ))}
          </div>

          <div className={styles.actionGrid}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setSaveStatus("Config UI prête pour publication")}
            >
              Sauvegarder config UI
            </button>
            <a
              className={styles.secondaryButton}
              href={publicMenuUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir preview publique
            </a>
          </div>
          <p className={styles.saveStatus}>{saveStatus}</p>
        </section>
      </aside>

      <section className={styles.previewPane}>
        <div className={styles.previewHeader}>
          <div>
            <p className={styles.eyebrow}>Preview client</p>
            <h3>{selectedRestaurant?.name ?? "Menu public"}</h3>
          </div>
          <span className={styles.previewUrl}>{publicMenuPath}</span>
        </div>

        <div className={styles.phoneShell}>
          <div
            className={`${styles.phoneScreen} ${selectedTheme.className} ${densityClass}`}
          >
            {welcomeEnabled ? (
              <header
                className={`${styles.menuWelcome} ${
                  motion === "none"
                    ? styles.motionNone
                    : motion === "expressive"
                      ? styles.motionExpressive
                      : styles.motionSoft
                }`}
              >
                <p>{selectedRestaurant?.name ?? "Restaurant"}</p>
                <h2>{welcomeTitle || `Bienvenue chez ${selectedRestaurant?.name}`}</h2>
                <span>{welcomeSubtitle}</span>
              </header>
            ) : null}

            {categoryNavigation !== "cards" ? (
              <nav className={styles.menuTabs} aria-label="Navigation menu preview">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={tab === activeTab ? styles.tabActive : ""}
                    onClick={() => {
                      setActiveTab(tab);
                      setSelectedDish(null);
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            ) : null}

            <main className={styles.menuPreviewBody}>
              {activeTab === "Catégories" ? (
                <div className={styles.categoryGrid}>
                  {categories.map((category) => {
                    const meta = CATEGORY_META[category.name] ?? {
                      icon: "🍽️",
                      description: "Découvrir",
                      tone: styles.categoryBlue
                    };

                    return (
                      <button
                        key={category.name}
                        type="button"
                        className={`${styles.categoryCard} ${meta.tone}`}
                        onClick={() => setActiveTab(category.name)}
                      >
                        <small>{category.dishes.length} choix</small>
                        <strong>
                          {meta.icon} {category.name}
                        </strong>
                        <span>{meta.description}</span>
                      </button>
                    );
                  })}
                </div>
              ) : activeCategory ? (
                <section className={styles.menuSection}>
                  <div className={styles.menuSectionHeader}>
                    <h3>{activeCategory.name}</h3>
                    <button type="button" onClick={() => setActiveTab("Tout")}>
                      Tout voir
                    </button>
                  </div>
                  <div className={styles.dishList}>
                    {activeCategory.dishes.map(renderDishCard)}
                  </div>
                </section>
              ) : (
                <div className={styles.allSections}>
                  {categoryNavigation !== "tabs" ? (
                    <div className={styles.compactCategoryRail}>
                      {categories.map((category) => {
                        const meta = CATEGORY_META[category.name] ?? {
                          icon: "🍽️",
                          description: "Découvrir",
                          tone: styles.categoryBlue
                        };

                        return (
                          <button
                            key={category.name}
                            type="button"
                            className={`${styles.compactCategory} ${meta.tone}`}
                            onClick={() => setActiveTab(category.name)}
                          >
                            <span>{meta.icon}</span>
                            <strong>{category.name}</strong>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {categories.map((category) => (
                    <section key={category.name} className={styles.menuSection}>
                      <div className={styles.menuSectionHeader}>
                        <h3>{category.name}</h3>
                        <button
                          type="button"
                          onClick={() => setActiveTab(category.name)}
                        >
                          Voir
                        </button>
                      </div>
                      <div className={styles.dishList}>
                        {category.dishes.map(renderDishCard)}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </main>

            {selectedDish ? (
              <div
                className={`${styles.detailOverlay} ${
                  detailStyle === "full-card" ? styles.detailFullCard : ""
                } ${detailStyle === "simple-card" ? styles.detailSimpleCard : ""}`}
              >
                <article className={styles.detailSheet}>
                  <div className={styles.detailHero}>
                    <span>{selectedDish.hasPhoto ? getDishIcon(selectedDish) : "Photo"}</span>
                  </div>
                  <div className={styles.detailBody}>
                    <div className={styles.detailTop}>
                      <div>
                        <p className={styles.detailCategory}>
                          {selectedDish.category}
                        </p>
                        <h3>{selectedDish.name}</h3>
                      </div>
                      <button
                        type="button"
                        className={styles.closeButton}
                        onClick={() => setSelectedDish(null)}
                        aria-label="Fermer le détail"
                      >
                        ×
                      </button>
                    </div>

                    <strong className={styles.detailPrice}>
                      {formatPrice(selectedDish.price)}
                    </strong>
                    <p className={styles.detailDescription}>
                      {selectedDish.description}
                    </p>

                    <div className={styles.badgeRow}>
                      {selectedDish.tags.map((tag) => (
                        <span key={tag} className={styles.menuBadge}>
                          {tag}
                        </span>
                      ))}
                      {selectedDish.hasPhoto ? (
                        <span className={styles.photoBadge}>Photo OK</span>
                      ) : (
                        <span className={styles.warningBadge}>Photo à faire</span>
                      )}
                      {show3dBadges && selectedDish.has3d ? (
                        <span className={styles.modelBadge}>3D disponible</span>
                      ) : null}
                      {showArBadges && selectedDish.hasAr ? (
                        <span className={styles.modelBadge}>AR disponible</span>
                      ) : null}
                    </div>

                    {selectedDish.has3d || selectedDish.hasAr ? (
                      <div className={styles.modelPanel}>
                        <p>Preview 3D / AR</p>
                        <strong>Chargement seulement après clic utilisateur.</strong>
                        <button type="button">Voir en 3D</button>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => setSelectedDish(null)}
                    >
                      Retour au menu
                    </button>
                  </div>
                </article>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
