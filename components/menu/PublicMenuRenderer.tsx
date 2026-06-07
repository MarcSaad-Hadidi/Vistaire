"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
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
  const dishOpenMode =
    mode === "builder-preview" ? "inline" : config.detail.dishOpenMode;
  const heading =
    activeTab === HOME_TAB_ID
      ? "Categories"
      : activeTab === ALL_TAB_ID
        ? "Tout le menu"
        : activeTab;
  const showTabs = config.navigation.style !== "cards";
  const showCategoryCards =
    config.navigation.style !== "tabs" || activeTab === HOME_TAB_ID;

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
    const cardVariant = config.cards.variant;
    const minimal = cardVariant === "minimal-list";
    const large = cardVariant === "photo-large" || cardVariant === "editorial";
    const priceForward = cardVariant === "price-forward";
    const showOwnerMissingPhotoWarning =
      mode === "builder-preview" &&
      config.photos.ownerMissingWarnings &&
      !dish.hasPhoto;
    const showMissingPhoto =
      config.photos.publicMissingBehavior === "placeholder" ||
      (mode === "builder-preview" && config.photos.ownerMissingWarnings);
    const showVisual = !minimal && (dish.hasPhoto || showMissingPhoto);
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
    }`;
    const dishCardContent = (
      <>
        {showVisual ? (
          <DishVisual
            dish={dish}
            menu={menu}
            showPlaceholder={showMissingPhoto}
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
            <span className={styles.dishDescription}>
              {description}
            </span>
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

  return (
    <main
      className={`${styles.page} ${themeClass(config.theme)} ${densityClass(
        config.density
      )} ${backgroundClass(config)} ${radiusClass(config)} ${shadowClass(
        config
      )} ${typographyClass(config)} ${
        mode === "builder-preview" ? styles.builderPreview : styles.public
      }`}
      data-theme={config.theme}
      style={menuStyleVars(config)}
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
            {config.navigation.showAll ? (
              <button type="button" onClick={showAll}>
                Voir le menu
              </button>
            ) : null}
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
                  {config.navigation.showDishCounts ? <small>{tab.count}</small> : null}
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
                      {config.navigation.showDishCounts ? (
                        <span>{category.count} choix</span>
                      ) : null}
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
          className={`${styles.detailOverlay} ${detailClass(config)}`}
        >
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
      ) : null}
    </main>
  );
}
