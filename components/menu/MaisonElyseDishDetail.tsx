"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { DishModelViewerProps } from "@/components/dish/DishModelViewer";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
import {
  type PublicMenu,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import { buildPublicMenuPath } from "@/lib/owner/menuUrlCore";
import styles from "./MaisonElyseDishDetail.module.css";

const MODEL_VIEWER_ID = "maison-elyse-dish-model-viewer";
const ALLOWED_3D_CDN_ORIGINS = (process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "")
  .split(/[,\s]+/)
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

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

type MaisonElyseDishDetailProps = {
  menu: PublicMenu;
  dish: PublicMenuDish;
  query?: PublicMenuContextQuery;
  displayMode?: "public" | "phone-preview";
  onBackToMenu?: () => void;
};

const ALLERGEN_LABELS: Record<string, string> = {
  dairy: "Lait",
  eggs: "Oeufs",
  fish: "Poisson",
  gluten: "Gluten",
  nuts: "Fruits à coque",
  sesame: "Sésame",
  shellfish: "Crustacés",
  soy: "Soja"
};

function cleanDisplayText(value: string): string {
  return value
    .replaceAll("Ãƒâ€°", "É")
    .replaceAll("ÃƒÂ©", "é")
    .replaceAll("ÃƒÂ¨", "è")
    .replaceAll("ÃƒÂª", "ê")
    .replaceAll("ÃƒÂ´", "ô")
    .replaceAll("ÃƒÂ¢", "â")
    .replaceAll("ÃƒÂ®", "î")
    .replaceAll("ÃƒÂ¯", "ï")
    .replaceAll("ÃƒÂ§", "ç")
    .replaceAll("Ã‰", "É")
    .replaceAll("Ã©", "é")
    .replaceAll("Ã¨", "è")
    .replaceAll("Ãª", "ê")
    .replaceAll("Ã´", "ô")
    .replaceAll("Ã¢", "â")
    .replaceAll("Ã®", "î")
    .replaceAll("Ã¯", "ï")
    .replaceAll("Ã§", "ç")
    .replaceAll("Â·", "·")
    .trim();
}

function normalizeText(value: string): string {
  return cleanDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function categoryLabel(category: string): string {
  const cleaned = cleanDisplayText(category);
  const normalized = normalizeText(cleaned);

  if (normalized.includes("signature")) return "Plats signatures";
  if (normalized.includes("entree")) return "Entrées";
  if (normalized.includes("dessert")) return "Desserts";
  if (normalized.includes("cocktail") || normalized.includes("boisson")) {
    return "Cocktails";
  }
  return cleaned || "La carte";
}

function hasReal3d(dish: PublicMenuDish): boolean {
  return (
    isSafe3dAssetUrl(
      dish.webModel3dUrl || dish.model3dUrl,
      ALLOWED_3D_CDN_ORIGINS,
      "web"
    ) ||
    isSafe3dAssetUrl(dish.arModel3dUrl, ALLOWED_3D_CDN_ORIGINS, "arLite")
  );
}

function hasRealAr(dish: PublicMenuDish): boolean {
  return (
    isSafe3dAssetUrl(dish.arModel3dUrl, ALLOWED_3D_CDN_ORIGINS, "arLite") ||
    isSafe3dAssetUrl(
      dish.arUsdzUrl || dish.usdzUrl,
      ALLOWED_3D_CDN_ORIGINS,
      "iosUsdz"
    )
  );
}

function dishBadges(dish: PublicMenuDish): string[] {
  const badges: string[] = [];
  const tagText = normalizeText(dish.tags.join(" "));

  if (tagText.includes("signature")) badges.push("Signature");
  if (tagText.includes("recommande")) badges.push("Recommandé");
  if (hasReal3d(dish)) badges.push("3D");
  if (hasRealAr(dish)) badges.push("AR");
  if (!dish.available) badges.push("Indisponible");

  return Array.from(new Set(badges)).slice(0, 5);
}

function displayList(items: string[], type?: "allergens"): string[] {
  return items
    .map((item) => {
      const cleaned = cleanDisplayText(item);
      if (type === "allergens") {
        return ALLERGEN_LABELS[normalizeText(cleaned)] ?? cleaned;
      }
      return cleaned;
    })
    .filter(Boolean);
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

function buildFullMenuHref(
  menu: PublicMenu,
  query?: PublicMenuContextQuery
): string {
  const menuHref = buildPublicMenuPath(menu.slug, query);
  const [pathname, rawSearch = ""] = menuHref.split("?");
  const params = new URLSearchParams(rawSearch);
  params.set("view", "carte");

  return `${pathname}?${params.toString()}`;
}

function scrollToModelViewer(): void {
  if (typeof window === "undefined") return;

  window.requestAnimationFrame(() => {
    document.getElementById(MODEL_VIEWER_ID)?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth"
    });
  });
}

function DetailList({ items }: { items: string[] }) {
  if (!items.length) return <p>À préciser avec l&apos;équipe en salle.</p>;

  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function MaisonElyseDishDetail({
  menu,
  dish,
  query,
  displayMode = "public",
  onBackToMenu
}: MaisonElyseDishDetailProps) {
  const [showModelViewer, setShowModelViewer] = useState(false);
  const menuHref = buildFullMenuHref(menu, query);
  const restaurantName = cleanDisplayText(menu.name) || "Maison Élyse";
  const dishName = cleanDisplayText(dish.name);
  const dishDescription = cleanDisplayText(dish.description);
  const displayCategory = categoryLabel(dish.category);
  const has3d = hasReal3d(dish);
  const hasAr = hasRealAr(dish);
  const canOpenImmersive = has3d || hasAr;
  const badges = dishBadges(dish);
  const ingredients = displayList(dish.ingredients);
  const allergens = displayList(dish.allergens, "allergens");
  const options = displayList(dish.options);
  const houseNote = cleanDisplayText(dish.houseNote);
  const actionLabel = showModelViewer
    ? has3d
      ? "Masquer la 3D"
      : "Masquer l'aperçu"
    : has3d
      ? "Voir en 3D"
      : "Ouvrir l'aperçu AR";

  function toggleModelViewer() {
    setShowModelViewer((isVisible) => {
      const nextVisible = !isVisible;
      if (nextVisible) scrollToModelViewer();
      return nextVisible;
    });
  }

  return (
    <main
      className={`${styles.page} ${
        displayMode === "phone-preview" ? styles.phonePreview : ""
      }`}
    >
      <nav className={styles.topNav} aria-label="Navigation fiche plat">
        {onBackToMenu ? (
          <button type="button" onClick={onBackToMenu}>
            Retour à la carte
          </button>
        ) : (
          <Link href={menuHref} prefetch={false}>
            Retour à la carte
          </Link>
        )}
        <span>{restaurantName}</span>
      </nav>

      <article className={styles.article}>
        <div
          aria-label={dish.imageUrl ? `Image du plat ${dishName}` : undefined}
          className={styles.hero}
          role={dish.imageUrl ? "img" : undefined}
          style={
            dish.imageUrl
              ? ({ "--dish-image": `url("${dish.imageUrl}")` } as CSSProperties)
              : undefined
          }
        >
          {!dish.imageUrl ? (
            <div className={styles.imageFallback}>
              <span>{restaurantName.slice(0, 1)}</span>
              <p>Image du plat à venir</p>
            </div>
          ) : null}
        </div>

        <section className={styles.content} aria-label="Détail du plat">
          <header className={styles.heading}>
            <p className={styles.kicker}>{displayCategory}</p>
            <h1>{dishName}</h1>
            {dish.priceLabel ? (
              <p className={styles.price}>{dish.priceLabel}</p>
            ) : null}
            {dishDescription ? (
              <p className={styles.description}>{dishDescription}</p>
            ) : null}
          </header>

          {badges.length > 0 ? (
            <div className={styles.badges} aria-label="Badges du plat">
              {badges.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
          ) : null}

          {canOpenImmersive ? (
            <section
              aria-labelledby="maison-elyse-immersive-heading"
              className={`${styles.modelPanel} ${
                showModelViewer ? styles.modelPanelOpen : ""
              }`}
            >
              <div className={styles.modelPanelHeader}>
                <div>
                  <p className={styles.kicker}>Aperçu immersif</p>
                  <h2 id="maison-elyse-immersive-heading">
                    {has3d ? "Voir le plat en 3D" : "Réalité augmentée"}
                  </h2>
                  <p>
                    {hasAr
                      ? "Une fois le plat chargé, vous pouvez le placer devant vous sur un téléphone compatible."
                      : "La vue 3D se lance uniquement après votre action."}
                  </p>
                </div>
                <button
                  aria-controls={MODEL_VIEWER_ID}
                  aria-expanded={showModelViewer}
                  className={styles.primaryAction}
                  onClick={toggleModelViewer}
                  type="button"
                >
                  {actionLabel}
                </button>
              </div>

              <div className={styles.modelStage} id={MODEL_VIEWER_ID}>
                {showModelViewer ? (
                  <LazyDishModelViewer
                    dish={modelViewerDishFromPublicDish(dish)}
                    minimalChrome
                    quietChrome
                    onReturnToDish={() => setShowModelViewer(false)}
                  />
                ) : (
                  <div className={styles.modelPreview} aria-hidden="true">
                    <span>{has3d ? "3D" : "AR"}</span>
                    <small>
                      {hasAr
                        ? "Le bouton AR apparaît après le chargement du plat."
                        : "Aperçu disponible sans chargement initial."}
                    </small>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <div className={styles.detailSections}>
            <section>
              <h2>Ingrédients</h2>
              <DetailList items={ingredients} />
            </section>

            <section>
              <h2>Allergènes</h2>
              <DetailList items={allergens} />
            </section>

            <section>
              <h2>Options</h2>
              <DetailList items={options} />
            </section>

            {houseNote ? (
              <section className={styles.houseNote}>
                <h2>Note du chef</h2>
                <p>{houseNote}</p>
              </section>
            ) : null}
          </div>
        </section>
      </article>

    </main>
  );
}
