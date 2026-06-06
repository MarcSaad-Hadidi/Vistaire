"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicMenu, PublicMenuDish } from "@/lib/menu/publicMenuCore";
import styles from "./PublicDishDetailExperience.module.css";

type PublicDishDetailExperienceProps = {
  menu: PublicMenu;
  dish: PublicMenuDish;
  context?: string;
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

export function PublicDishDetailExperience({
  menu,
  dish,
  context = ""
}: PublicDishDetailExperienceProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const menuHref = `/menu/${menu.slug}`;
  const dishHref = `/menu/${menu.slug}/dishes/${dish.slug}`;
  const badges = dishBadges(dish);

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
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topNav} aria-label="Navigation fiche plat">
          <Link href={menuHref} prefetch={false}>
            Retour au menu
          </Link>
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

            <div className={styles.actions}>
              <Link className={styles.primaryLink} href={menuHref} prefetch={false}>
                Retour au menu
              </Link>
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
