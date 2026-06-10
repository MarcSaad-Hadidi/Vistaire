"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import {
  type PublicMenu,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import type { DishModelViewerProps } from "@/components/dish/DishModelViewer";
import type { MenuUiConfig } from "@/lib/menu/menuUiConfig";
import { buildPublicMenuPath } from "@/lib/owner/menuUrlCore";
import styles from "./PublicDishDetailExperience.module.css";

type PublicDishDetailExperienceProps = {
  menu: PublicMenu;
  dish: PublicMenuDish;
  config?: MenuUiConfig;
  context?: string;
  query?: PublicMenuContextQuery;
  mode?: "public" | "builder-preview";
  onBack?: () => void;
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
  if (hasPublic3d(dish)) badges.add("3D");
  if (hasPublicAr(dish)) badges.add("AR");
  if (!dish.available) badges.add("Indisponible");
  return Array.from(badges).slice(0, 4);
}

function DetailList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function detailStyleVars(config: MenuUiConfig | undefined): CSSProperties {
  return {
    "--detail-bg": config?.palette.background ?? "#FFFDF6",
    "--detail-surface": config?.palette.surface ?? "#FFFFFF",
    "--detail-text": config?.palette.text ?? "#17324D",
    "--detail-muted": config?.palette.muted ?? "#5F6F7A",
    "--detail-accent": config?.palette.accent ?? "#F6C453",
    "--detail-accent-2": config?.palette.accent2 ?? "#E85D3F",
    "--detail-border": config?.palette.border ?? "#DDEAF3",
    "--detail-fresh": config?.palette.accent3 ?? "#2FA866"
  } as CSSProperties;
}

function cleanDisplayText(value: string): string {
  return value
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

function hasPublic3d(dish: PublicMenuDish): boolean {
  return Boolean(dish.webModel3dUrl || dish.model3dUrl || dish.arModel3dUrl);
}

function hasPublicAr(dish: PublicMenuDish): boolean {
  return Boolean(dish.arModel3dUrl || dish.arUsdzUrl || dish.usdzUrl);
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

export function PublicDishDetailExperience({
  menu,
  dish,
  config,
  context = "",
  query,
  mode = "public",
  onBack
}: PublicDishDetailExperienceProps) {
  const [showModelViewer, setShowModelViewer] = useState(false);
  const menuHref = buildPublicMenuPath(menu.slug, query);
  const restaurantDisplayName = cleanDisplayText(menu.name);
  const badges = dishBadges(dish);
  const has3d = hasPublic3d(dish);
  const hasAr = hasPublicAr(dish);
  const showPublicModelActions = mode === "public" && (has3d || hasAr);
  const showBuilderModelStatus =
    mode === "builder-preview" && (has3d || hasAr);
  const publicModelButtonLabel = showModelViewer
    ? has3d
      ? "Masquer la 3D"
      : "Masquer l'aperçu"
    : has3d
      ? "Voir en 3D"
      : "Ouvrir l'aperçu AR";

  return (
    <main
      className={`${styles.page} ${
        mode === "builder-preview" ? styles.builderPreview : ""
      }`}
      data-theme={config?.theme}
      data-blueprint={config?.experience.blueprint}
      style={detailStyleVars(config)}
    >
      <div className={styles.shell}>
        <nav className={styles.topNav} aria-label="Navigation fiche plat">
          {onBack ? (
            <button type="button" onClick={onBack}>
              Retour au menu
            </button>
          ) : (
            <Link href={menuHref} prefetch={false}>
              Retour au menu
            </Link>
          )}
          <span className={styles.navRestaurantName}>{restaurantDisplayName}</span>
        </nav>

        <article className={styles.card}>
          <div
            aria-label={
              dish.imageUrl ? `Image du plat ${dish.name}` : undefined
            }
            className={styles.visual}
            role={dish.imageUrl ? "img" : undefined}
            style={
              dish.imageUrl
                ? { backgroundImage: `url("${dish.imageUrl}")` }
                : undefined
            }
          >
            {!dish.imageUrl ? (
              <div className={styles.imageFallback}>
                <span>{restaurantDisplayName.slice(0, 1)}</span>
                <p>Image du plat à venir</p>
              </div>
            ) : null}
          </div>

          <section className={styles.content} aria-label="Fiche plat">
            <div className={styles.heading}>
              <p className={styles.kicker}>{restaurantDisplayName}</p>
              <h1>{dish.name}</h1>
              <p className={styles.description}>{dish.description}</p>
              {context ? <span className={styles.context}>{context}</span> : null}
            </div>

            {badges.length > 0 ? (
              <div className={styles.badges} aria-label="Badges du plat">
                {badges.map((badge) => (
                  <span key={badge}>{badge}</span>
                ))}
              </div>
            ) : null}

            <dl className={styles.factGrid}>
              <div>
                <dt>Catégorie</dt>
                <dd>{dish.category}</dd>
              </div>
              {dish.priceLabel ? (
                <div>
                  <dt>Prix</dt>
                  <dd>{dish.priceLabel}</dd>
                </div>
              ) : null}
              <div>
                <dt>Disponibilité</dt>
                <dd>{dish.available ? "Disponible" : "Indisponible"}</dd>
              </div>
            </dl>

            {mode === "builder-preview" ? (
              <dl className={styles.factGrid} aria-label="Statut owner preview">
                <div>
                  <dt>Photo</dt>
                  <dd>{dish.hasPhoto ? "Prete" : "A faire owner"}</dd>
                </div>
                <div>
                  <dt>3D</dt>
                  <dd>{has3d ? "Disponible" : "Non disponible"}</dd>
                </div>
                <div>
                  <dt>AR</dt>
                  <dd>{hasAr ? "Disponible" : "Non disponible"}</dd>
                </div>
              </dl>
            ) : null}

            <div className={styles.detailSections}>
              {dish.ingredients.length > 0 ? (
                <section>
                  <h2>Ingrédients</h2>
                  <DetailList items={dish.ingredients} />
                </section>
              ) : null}

              {dish.allergens.length > 0 ? (
                <section>
                  <h2>Allergènes</h2>
                  <DetailList items={dish.allergens} />
                </section>
              ) : null}

              {dish.options.length > 0 ? (
                <section>
                  <h2>Options</h2>
                  <DetailList items={dish.options} />
                </section>
              ) : null}

              {dish.houseNote ? (
                <section className={styles.houseNote}>
                  <h2>Note maison</h2>
                  <p>{dish.houseNote}</p>
                </section>
              ) : null}
            </div>

            {showPublicModelActions || showBuilderModelStatus ? (
              <section
                className={`${styles.modelPanel} ${
                  showModelViewer ? styles.modelPanelOpen : ""
                }`}
              >
                <div className={styles.modelPanelHeader}>
                  <div className={styles.modelPanelCopy}>
                    <h2>Aperçu 3D / AR</h2>
                    {mode === "public" ? (
                      <strong className={styles.modelPanelTitle}>
                        Aperçu immersif
                      </strong>
                    ) : null}
                    {mode === "public" ? (
                      <p>
                        {hasAr
                          ? "La 3D se lance ici. L'option AR place le plat devant vous depuis un téléphone compatible."
                          : "La vue 3D se lance ici après votre action."}
                      </p>
                    ) : null}
                    {mode === "builder-preview" ? (
                      <p>Preview statut seulement dans le builder.</p>
                    ) : null}
                  </div>
                  <div className={styles.modelActions}>
                    {mode === "public" ? (
                      <button
                        type="button"
                        className={styles.modelActionButton}
                        aria-controls="public-dish-model-viewer"
                        aria-expanded={showModelViewer}
                        onClick={() =>
                          setShowModelViewer((isVisible) => !isVisible)
                        }
                      >
                        {publicModelButtonLabel}
                      </button>
                    ) : (
                      <>
                        {has3d ? (
                          <span className={styles.modelStatusChip}>
                            3D disponible
                          </span>
                        ) : null}
                        {hasAr ? (
                          <span className={styles.modelStatusChip}>
                            AR disponible
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                {mode === "public" ? (
                  showModelViewer ? (
                    <div
                      className={styles.inlineModelViewer}
                      id="public-dish-model-viewer"
                    >
                      <LazyDishModelViewer
                        dish={modelViewerDishFromPublicDish(dish)}
                        minimalChrome
                        quietChrome
                        onReturnToDish={() => setShowModelViewer(false)}
                      />
                    </div>
                  ) : (
                    <div
                      className={styles.modelPreview}
                      id="public-dish-model-viewer"
                      aria-hidden="true"
                    >
                      <span>{has3d ? "3D" : "AR"}</span>
                    </div>
                  )
                ) : null}
              </section>
            ) : null}

            <div className={styles.actions}>
              {onBack ? (
                <button type="button" className={styles.primaryLink} onClick={onBack}>
                  Retour au menu
                </button>
              ) : (
                <Link className={styles.primaryLink} href={menuHref} prefetch={false}>
                  Retour au menu
                </Link>
              )}
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
