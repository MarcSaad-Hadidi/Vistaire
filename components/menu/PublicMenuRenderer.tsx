"use client";

import Link from "next/link";
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
const preferredCategoryLabels = ["Entrees", "Entrées", "Plats", "Desserts", "Boissons"];
const preferredCategoryOrder = new Map(
  preferredCategoryLabels.map((label, index) => [label, index])
);

function themeClass(theme: MenuUiConfig["theme"]): string {
  if (theme === "premium-gastronomic") return styles.themePremium;
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

function categoryTone(category: PublicMenuCategory): string {
  return `${styles.categoryCard} ${styles[`tone${category.tone}`]}`;
}

function shortDescription(dish: PublicMenuDish): string {
  if (!dish.description) return "";
  if (dish.description.length <= 128) return dish.description;
  return `${dish.description.slice(0, 125).trim()}...`;
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
  const [activeTab, setActiveTab] = useState<string>(
    config.defaultView === "categories" ? HOME_TAB_ID : ALL_TAB_ID
  );
  const [selectedDish, setSelectedDish] = useState<PublicMenuDish | null>(null);
  const groups = useMemo(
    () => getPublicMenuCategoryGroups(menu.dishes),
    [menu.dishes]
  );
  const categories = useMemo(
    () =>
      getVisiblePublicMenuCategories(menu.dishes).sort(
        (a, b) =>
          (preferredCategoryOrder.get(a.label) ?? 99) -
          (preferredCategoryOrder.get(b.label) ?? 99)
      ),
    [menu.dishes]
  );
  const tabs = [
    { id: ALL_TAB_ID, label: "Tout", count: menu.dishes.length },
    ...categories.map((category) => ({
      id: category.label,
      label: category.label,
      count: category.count
    }))
  ];
  const selectedDishes =
    activeTab !== HOME_TAB_ID && activeTab !== ALL_TAB_ID
      ? groups.get(activeTab) ?? []
      : [];
  const featuredDishes = menu.dishes
    .filter((dish) => dish.tags.length > 0 || dish.category === "Plats")
    .slice(0, 3);
  const welcomeTitle = config.welcomeTitle || `Bienvenue chez ${menu.name}`;
  const welcomeSubtitle = config.welcomeSubtitle || "Decouvrez notre carte";
  const heading =
    activeTab === HOME_TAB_ID
      ? "Categories"
      : activeTab === ALL_TAB_ID
        ? "Tout le menu"
        : activeTab;
  const showTabs = config.categoryNavigation !== "cards";
  const showCategoryCards =
    config.categoryNavigation !== "tabs" || activeTab === HOME_TAB_ID;

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

  function renderDishCard(dish: PublicMenuDish) {
    const badges = dishBadges(dish);
    const minimal = config.dishCardStyle === "minimal-list";
    const large = config.dishCardStyle === "photo-large";
    const showVisual = !minimal && (dish.hasPhoto || config.showPhotoPlaceholders);
    const dishCardClassName = `${styles.dishCard} ${
      minimal ? styles.dishCardMinimal : ""
    } ${large ? styles.dishCardLarge : ""} ${
      !showVisual ? styles.dishCardNoVisual : ""
    }`;
    const dishCardContent = (
      <>
        {showVisual ? (
          <DishVisual
            dish={dish}
            menu={menu}
            showPlaceholder={config.showPhotoPlaceholders}
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
          {dish.description ? (
            <span className={styles.dishDescription}>
              {shortDescription(dish)}
            </span>
          ) : null}
          <span className={styles.badges}>
            {badges.map((badge) => (
              <span key={badge} className={styles.badge}>
                {badge}
              </span>
            ))}
            {config.showPhotoPlaceholders && !dish.hasPhoto ? (
              <span className={styles.warningBadge}>Photo a faire</span>
            ) : null}
            {config.show3dBadges && dish.has3d ? (
              <span className={styles.modelBadge}>3D</span>
            ) : null}
            {config.showArBadges && dish.hasAr ? (
              <span className={styles.modelBadge}>AR</span>
            ) : null}
          </span>
        </span>
      </>
    );

    return (
      <li key={dish.id} className={styles.dishItem}>
        {mode === "public" ? (
          <Link
            aria-label={`${dish.name}. Voir la fiche plat.`}
            className={dishCardClassName}
            href={buildPublicDishPath(menu.slug, dish.slug, query)}
            prefetch={false}
          >
            {dishCardContent}
          </Link>
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

  return (
    <main
      className={`${styles.page} ${themeClass(config.theme)} ${densityClass(
        config.density
      )} ${mode === "builder-preview" ? styles.builderPreview : styles.public}`}
    >
      {config.welcomeEnabled ? (
        <section
          className={`${styles.welcome} ${
            config.motion === "none"
              ? styles.motionNone
              : config.motion === "expressive"
                ? styles.motionExpressive
                : styles.motionSoft
          }`}
          aria-label={`Bienvenue chez ${menu.name}`}
        >
          <div>
            <p>{menu.name}</p>
            <h1>{welcomeTitle}</h1>
            <span>{welcomeSubtitle}</span>
            {context ? <small>{context}</small> : null}
          </div>
          <div className={styles.welcomeActions}>
            <button type="button" onClick={showAll}>
              Voir le menu
            </button>
            <button type="button" onClick={showHome}>
              Categories
            </button>
          </div>
        </section>
      ) : null}

      <section className={styles.menuShell}>
        <div className={styles.menuIntro}>
          <div>
            <p className={styles.sectionLabel}>Menu public</p>
            <h2>{heading}</h2>
          </div>
          {activeTab !== HOME_TAB_ID ? (
            <button type="button" onClick={showHome}>
              Retour aux categories
            </button>
          ) : null}
        </div>

        {showTabs && menu.dishes.length > 0 ? (
          <div className={styles.tabs} role="tablist" aria-label="Categories du menu">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
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
                  <small>{tab.count}</small>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className={styles.menuView} aria-live="polite">
          {menu.dishes.length === 0 ? (
            <div className={styles.empty} role="status">
              <p>La carte de ce restaurant n&apos;est pas encore disponible.</p>
              <span>Aucun plat reel n&apos;est relie a ce restaurant.</span>
            </div>
          ) : activeTab === HOME_TAB_ID ? (
            <>
              {showCategoryCards ? (
                <div className={styles.categoryGrid}>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={categoryTone(category)}
                      onClick={() => setActiveTab(category.label)}
                    >
                      <span>{category.count} choix</span>
                      <strong>{category.label}</strong>
                      <small>{category.description}</small>
                    </button>
                  ))}
                </div>
              ) : null}

              <section className={styles.previewSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.sectionLabel}>A decouvrir</p>
                    <h3>Apercu maison</h3>
                  </div>
                  <button type="button" onClick={showAll}>
                    Tout voir
                  </button>
                </div>
                <ul className={styles.dishList}>
                  {(featuredDishes.length ? featuredDishes : menu.dishes.slice(0, 3)).map(
                    renderDishCard
                  )}
                </ul>
              </section>
            </>
          ) : activeTab === ALL_TAB_ID ? (
            <div className={styles.fullMenuList}>
              {categories.map((category) => {
                const dishes = groups.get(category.label) ?? [];
                return (
                  <section key={category.id} className={styles.fullMenuSection}>
                    <div className={styles.sectionHeader}>
                      <h3>{category.label}</h3>
                      <span>{dishes.length} choix</span>
                    </div>
                    <ul className={styles.dishList}>{dishes.map(renderDishCard)}</ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <section className={styles.fullMenuSection}>
              <div className={styles.sectionHeader}>
                <h3>{activeTab}</h3>
                <span>{selectedDishes.length} choix</span>
              </div>
              <ul className={styles.dishList}>{selectedDishes.map(renderDishCard)}</ul>
            </section>
          )}
        </div>
      </section>

      {selectedDish ? (
        <div
          className={`${styles.detailOverlay} ${
            config.detailStyle === "full-card" ? styles.detailFullCard : ""
          } ${config.detailStyle === "simple-card" ? styles.detailSimpleCard : ""}`}
        >
          <article className={styles.detailSheet}>
            <div className={styles.detailHero}>
              {selectedDish.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img loading="lazy" src={selectedDish.imageUrl} alt="" />
              ) : (
                <span>{menu.name.slice(0, 1)}</span>
              )}
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

              <dl className={styles.factGrid}>
                <div>
                  <dt>Photo</dt>
                  <dd>{selectedDish.hasPhoto ? "Prete" : "A faire"}</dd>
                </div>
                <div>
                  <dt>3D</dt>
                  <dd>{selectedDish.has3d ? "Disponible" : "Non disponible"}</dd>
                </div>
                <div>
                  <dt>AR</dt>
                  <dd>{selectedDish.hasAr ? "Disponible" : "Non disponible"}</dd>
                </div>
              </dl>

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
                <section className={styles.modelPanel}>
                  <p>3D / AR disponible</p>
                  <strong>
                    {disableHeavyAssets
                      ? "Preview statut seulement dans le builder."
                      : "Chargement uniquement apres une action explicite."}
                  </strong>
                  <div>
                    {selectedDish.has3d ? <button type="button">Voir en 3D</button> : null}
                    {selectedDish.hasAr ? <button type="button">Voir en AR</button> : null}
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
      ) : null}
    </main>
  );
}
