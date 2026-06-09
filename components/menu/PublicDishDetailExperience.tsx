"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import {
  buildPublicDishPath,
  type PublicMenu,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
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

function firstAssetUrl(...urls: string[]): string {
  return urls.map((url) => url.trim()).find(Boolean) ?? "";
}

function resolvePublic3dHref(dish: PublicMenuDish): string {
  return firstAssetUrl(dish.webModel3dUrl, dish.model3dUrl, dish.arModel3dUrl);
}

function resolvePublicArHref(dish: PublicMenuDish): string {
  return firstAssetUrl(dish.arUsdzUrl, dish["usdzUrl"], dish.arModel3dUrl);
}

function isQuickLookHref(href: string): boolean {
  return href.trim().toLowerCase().split(/[?#]/, 1)[0].endsWith("usdz");
}

function ModelActionLink({
  children,
  href
}: {
  children: string;
  href: string;
}) {
  const quickLook = isQuickLookHref(href);

  return (
    <a
      className={styles.modelActionLink}
      href={href}
      rel={quickLook ? "ar" : "noreferrer"}
      target={quickLook ? undefined : "_blank"}
    >
      {quickLook ? (
        // Safari Quick Look requires an image child inside rel=ar links.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          aria-hidden="true"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
        />
      ) : null}
      <span>{children}</span>
    </a>
  );
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
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const menuHref = buildPublicMenuPath(menu.slug, query);
  const dishHref = buildPublicDishPath(menu.slug, dish.slug, query);
  const badges = dishBadges(dish);
  const public3dHref = mode === "public" ? resolvePublic3dHref(dish) : "";
  const publicArHref = mode === "public" ? resolvePublicArHref(dish) : "";
  const showPublicModelActions = Boolean(public3dHref || publicArHref);
  const showBuilderModelStatus =
    mode === "builder-preview" && (dish.has3d || dish.hasAr);

  async function copyDishLink() {
    try {
      const url = new URL(dishHref, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

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
          <span>{menu.name}</span>
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
                <span>{menu.name.slice(0, 1)}</span>
                <p>Image du plat à venir</p>
              </div>
            ) : null}
          </div>

          <section className={styles.content} aria-label="Fiche plat">
            <div className={styles.heading}>
              <p className={styles.kicker}>{menu.name}</p>
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
                  <dd>{dish.has3d ? "Disponible" : "Non disponible"}</dd>
                </div>
                <div>
                  <dt>AR</dt>
                  <dd>{dish.hasAr ? "Disponible" : "Non disponible"}</dd>
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
              <section className={styles.modelPanel}>
                <h2>3D / AR</h2>
                <p>
                  {mode === "public"
                    ? "Ouverture des assets immersifs apres action explicite."
                    : "Preview statut seulement dans le builder."}
                </p>
                <div>
                  {mode === "public" ? (
                    <>
                      {public3dHref ? (
                        <ModelActionLink href={public3dHref}>Voir en 3D</ModelActionLink>
                      ) : null}
                      {publicArHref ? (
                        <ModelActionLink href={publicArHref}>Voir en AR</ModelActionLink>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {dish.has3d ? (
                        <span className={styles.modelStatusChip}>3D disponible</span>
                      ) : null}
                      {dish.hasAr ? (
                        <span className={styles.modelStatusChip}>AR disponible</span>
                      ) : null}
                    </>
                  )}
                </div>
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
              <button type="button" onClick={copyDishLink}>
                Copier le lien
              </button>
            </div>

            <p className={styles.copyState} aria-live="polite">
              {copyState === "copied"
                ? "Lien copié."
                : copyState === "error"
                  ? "Copie indisponible sur ce navigateur."
                  : ""}
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
