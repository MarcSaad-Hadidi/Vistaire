"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import restaurantBackground from "@/Framer/PhotoRestoComplet2.png";
import type { Allergen, Dish, Restaurant } from "@/lib/demoMenuData";
import { getDishDetailImageObjectPosition } from "@/lib/demoMenuData";
import { formatPrice } from "@/lib/formatPrice";
import type { Locale } from "@/lib/i18n";
import { dishHasImmersiveAsset } from "@/lib/menuQuery";
import type { DishModelViewerProps } from "@/components/dish/DishModelViewer";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import styles from "./VistaireDishDetailPreview.module.css";

type VistaireDishDetailPreviewProps = {
  categoryName: string;
  dish: Dish;
  locale?: Locale;
  restaurant: Restaurant;
  routeMode?: VistaireRouteMode;
};

type DetailBadge = {
  label: string;
  tone?: "alert";
};

type ModelPanelVariant = "desktop" | "mobile";

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

const LazyDishModelViewer = dynamic<DishModelViewerProps>(
  () =>
    import("@/components/dish/DishModelViewer").then(
      (mod) => mod.DishModelViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className={styles.modelLoading} role="status" aria-live="polite">
        Préparation de la vue immersive...
      </div>
    )
  }
);

function getDishBadges(dish: Dish, locale: Locale): DetailBadge[] {
  const badges: DetailBadge[] = [];

  if (dish.isSignature) badges.push({ label: "Signature" });
  if (dish.isRecommended) {
    badges.push({ label: locale === "en" ? "Recommended" : "Recommandé" });
  }
  if (dishHasImmersiveAsset(dish)) badges.push({ label: "3D" });
  if (!dish.isAvailable) {
    badges.push({
      label: locale === "en" ? "Unavailable" : "Indisponible",
      tone: "alert"
    });
  }

  return badges;
}

function getArAvailabilityCopy(dish: Dish, locale: Locale): string {
  if (locale === "en") {
    if (dish.arUsdzUrl?.trim()) {
      return "On compatible iPhones, the AR option opens from the 3D view when the browser allows it.";
    }
    if (dish.arModel3dUrl?.trim()) {
      return "The 3D view uses a model optimized for devices compatible with augmented reality.";
    }
    if (dishHasImmersiveAsset(dish)) {
      return "The 3D view is available here. Augmented reality is enabled only for compatible dishes and devices.";
    }
    return "Vistaire can add 3D/AR selectively depending on the creation, without weighing down the whole menu.";
  }

  if (dish.arUsdzUrl?.trim()) {
    return "Sur iPhone compatible, l'option AR s'ouvre depuis la vue 3D lorsque le navigateur le permet.";
  }
  if (dish.arModel3dUrl?.trim()) {
    return "La vue 3D utilise un modèle optimisé pour les appareils compatibles avec la réalité augmentée.";
  }
  if (dishHasImmersiveAsset(dish)) {
    return "La vue 3D est disponible ici. La réalité augmentée est activée seulement sur les plats et appareils compatibles.";
  }
  return "Vistaire peut intégrer la 3D/AR de façon sélective selon les créations, sans alourdir toute la carte.";
}

export function VistaireDishDetailPreview({
  categoryName,
  dish,
  locale = "fr",
  restaurant,
  routeMode = "preview"
}: VistaireDishDetailPreviewProps) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const currentPath = `${routes.menu}/dishes/${dish.slug}`;
  const ui =
    locale === "en"
      ? {
          badge: "Vistaire menu experience",
          visualLabel: "Visual presentation",
          unavailable: "Temporarily unavailable",
          contentLabel: "Dish page",
          badgeListLabel: "Dish badges",
          ingredients: "Main ingredients",
          ingredientFallback: "Detailed composition to confirm with the team.",
          allergens: "Allergens",
          allergenFallback: "Allergen information to confirm with the restaurant.",
          chefNote: "Chef note",
          options: "Options",
          sides: "Sides",
          modelKicker: "Selective 3D / AR",
          modelAvailable: "Immersive preview available",
          modelUnavailable: "3D view coming soon for this dish",
          modelButton: "View in 3D",
          fallback3d: "3D preview is not available for this creation.",
          back: "Back to menu",
          explore: "Explore Vistaire",
          note:
            "This dish information is fictional and used to present the Vistaire experience."
        }
      : {
          badge: "Démo interactive Vistaire",
          visualLabel: "Présentation visuelle",
          unavailable: "Momentanément indisponible",
          contentLabel: "Fiche plat",
          badgeListLabel: "Badges du plat",
          ingredients: "Ingrédients principaux",
          ingredientFallback:
            "Composition détaillée à confirmer auprès de l'équipe.",
          allergens: "Allergènes",
          allergenFallback:
            "Informations allergènes à confirmer auprès du restaurant.",
          chefNote: "Note du chef",
          options: "Options",
          sides: "Accompagnements",
          modelKicker: "3D / AR sélective",
          modelAvailable: "Aperçu immersif disponible",
          modelUnavailable: "Vue 3D bientôt disponible pour ce plat",
          modelButton: "Voir en 3D",
          fallback3d: "Aperçu 3D non disponible sur cette création.",
          back: "Retour à la carte",
          explore: "Explorer Vistaire",
          note:
            "Les informations de ce plat sont fictives et servent à présenter l'expérience Vistaire."
        };
  const localizedAllergenLabels: Record<Allergen, string> =
    locale === "en"
      ? {
          gluten: "Gluten",
          dairy: "Dairy",
          nuts: "Nuts",
          shellfish: "Shellfish",
          eggs: "Eggs",
          sesame: "Sesame",
          soy: "Soy",
          fish: "Fish"
        }
      : allergenLabels;
  const [activeModelPanel, setActiveModelPanel] =
    useState<ModelPanelVariant | null>(null);
  const has3d = dishHasImmersiveAsset(dish);
  const hasImmersiveAsset = has3d;
  const badges = useMemo(() => getDishBadges(dish, locale), [dish, locale]);
  const objectPosition = getDishDetailImageObjectPosition(dish);
  const primaryIngredients = dish.ingredients.slice(0, 6);
  const renderModelPanel = (
    panelId: string,
    className: string,
    panelVariant: ModelPanelVariant
  ) => {
    const isActivePanel = activeModelPanel === panelVariant;

    return (
      <section
        className={`${styles.modelPanel} ${className}`}
        aria-labelledby={`${panelId}-heading`}
      >
        <div className={styles.modelIntro}>
          <p className={styles.kicker}>{ui.modelKicker}</p>
          <h2 id={`${panelId}-heading`}>
            {has3d ? ui.modelAvailable : ui.modelUnavailable}
          </h2>
          <p>{getArAvailabilityCopy(dish, locale)}</p>
        </div>

        {has3d ? (
          <>
            <button
              aria-controls={`${panelId}-viewer`}
              aria-expanded={isActivePanel}
              className={styles.modelButton}
              onClick={() => setActiveModelPanel(panelVariant)}
              type="button"
            >
              {ui.modelButton}
            </button>
            {isActivePanel ? (
              <div className={styles.modelViewer} id={`${panelId}-viewer`}>
                <LazyDishModelViewer
                  dish={dish}
                  minimalChrome
                  onReturnToDish={() => setActiveModelPanel(null)}
                />
              </div>
            ) : (
              <div
                className={styles.modelPreview}
                id={`${panelId}-viewer`}
                aria-hidden="true"
              >
                {hasImmersiveAsset ? "3D" : "AR"}
              </div>
            )}
          </>
        ) : (
          <div className={styles.fallback3d}>
            <span aria-hidden="true">{restaurant.logoMonogram}</span>
            <p>{ui.fallback3d}</p>
          </div>
        )}
      </section>
    );
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
        aria-labelledby="dish-detail-preview-heading"
        className={styles.hero}
      >
        <article className={styles.previewFrame} id="carte">
          <div className={styles.topBar}>
            <p className={styles.demoBadge}>{ui.badge}</p>
          </div>

          <div className={styles.dishLayout}>
            <section className={styles.visualColumn} aria-label={ui.visualLabel}>
              <div className={styles.heroImage}>
                {dish.image ? (
                  <Image
                    alt={`${locale === "en" ? "Dish photo:" : "Photo du plat :"} ${dish.name}`}
                    className={styles.dishImage}
                    fill
                    priority
                    quality={100}
                    sizes="(max-width: 920px) calc(100vw - 36px), 560px"
                    src={dish.image}
                    style={{ objectPosition }}
                    unoptimized
                  />
                ) : (
                  <div className={styles.imageFallback}>
                    {restaurant.logoMonogram}
                  </div>
                )}
                {!dish.isAvailable ? (
                  <p className={styles.unavailableOverlay}>
                    {ui.unavailable}
                  </p>
                ) : null}
              </div>
              {renderModelPanel(
                "preview-dish-model-desktop",
                styles.desktopModelPanel,
                "desktop"
              )}
            </section>

            <section className={styles.contentColumn} aria-label={ui.contentLabel}>
              <div className={styles.headingBlock}>
                <p className={styles.restaurantName}>{restaurant.name}</p>
                <p className={styles.category}>{categoryName}</p>
                <h1 id="dish-detail-preview-heading">{dish.name}</h1>
                <p className={styles.price}>
                  {formatPrice(
                    dish.price,
                    restaurant.currency,
                    locale === "en" ? "en-CA" : "fr-CA"
                  )}
                </p>
                <p className={styles.shortDescription}>
                  {dish.shortDescription}
                </p>
              </div>

              {badges.length > 0 ? (
                <div className={styles.badgeList} aria-label={ui.badgeListLabel}>
                  {badges.map((badge) => (
                    <span
                      className={
                        badge.tone === "alert"
                          ? styles.badgeAlert
                          : styles.badge
                      }
                      key={badge.label}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              ) : null}

              <p className={styles.description}>{dish.description}</p>

              <div className={styles.infoGrid}>
                <section aria-labelledby="ingredients-heading">
                  <h2 id="ingredients-heading">{ui.ingredients}</h2>
                  {primaryIngredients.length > 0 ? (
                    <ul>
                      {primaryIngredients.map((ingredient) => (
                        <li key={ingredient}>{ingredient}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{ui.ingredientFallback}</p>
                  )}
                </section>

                <section aria-labelledby="allergens-heading">
                  <h2 id="allergens-heading">{ui.allergens}</h2>
                  {dish.allergens.length > 0 ? (
                    <ul>
                      {dish.allergens.map((allergen) => (
                        <li key={allergen}>{localizedAllergenLabels[allergen]}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{ui.allergenFallback}</p>
                  )}
                </section>
              </div>

              <section className={styles.chefNote} aria-labelledby="chef-heading">
                <h2 id="chef-heading">{ui.chefNote}</h2>
                <p>{dish.chefRecommendation}</p>
              </section>

              {dish.options.length > 0 || dish.sides.length > 0 ? (
                <div className={styles.optionsGrid}>
                  {dish.options.length > 0 ? (
                    <section aria-labelledby="options-heading">
                      <h2 id="options-heading">{ui.options}</h2>
                      <ul>
                        {dish.options.map((option) => (
                          <li key={option}>{option}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {dish.sides.length > 0 ? (
                    <section aria-labelledby="sides-heading">
                      <h2 id="sides-heading">{ui.sides}</h2>
                      <ul>
                        {dish.sides.map((side) => (
                          <li key={side}>{side}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              ) : null}

              {renderModelPanel(
                "preview-dish-model-mobile",
                styles.mobileModelPanel,
                "mobile"
              )}

              <div className={styles.actionRow}>
                <Link
                  className={styles.primaryLink}
                  href={routes.menu}
                  prefetch={false}
                >
                  {ui.back}
                </Link>
                <Link
                  className={styles.secondaryLink}
                  href={routes.home}
                  prefetch={false}
                >
                  {ui.explore}
                </Link>
              </div>

              <p className={styles.demoNote}>
                {ui.note}
              </p>
            </section>

          </div>
        </article>

        <PreviewNav
          activeSection="menu"
          currentPath={currentPath}
          locale={locale}
          routeMode={routeMode}
        />
      </section>

      <PreviewFooter
        currentPath={currentPath}
        locale={locale}
        routeMode={routeMode}
        width="wide"
      />
    </main>
  );
}
