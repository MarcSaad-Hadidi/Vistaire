"use client";

import { PublicDishImage } from "@/components/public-menu/PublicDishImage";
import type { PdfComparePreviewData } from "@/lib/pdfComparePreviewData";
import styles from "./ComparisonPreviewMenu.module.css";

export type ComparisonPreviewTheme =
  | "maison-elyse"
  | "trouvable"
  | "sauge-noire";

function dishesForCategory(
  preview: PdfComparePreviewData,
  category: PdfComparePreviewData["categoryCards"][number]
) {
  return preview.vistaireDishes.filter(
    (dish) =>
      dish.categoryId === category.id ||
      dish.categorySlug === category.slug ||
      dish.categoryName === category.name
  );
}

export function ComparisonPreviewMenu({
  preview,
  theme
}: {
  preview: PdfComparePreviewData;
  theme: ComparisonPreviewTheme;
}) {
  const sectionLabel =
    theme === "maison-elyse"
      ? "La carte"
      : theme === "trouvable"
        ? "La carte du moment"
        : "Herbier de la carte";

  return (
    <div
      className={styles.menu}
      data-comparison-preview=""
      data-display-mode="comparison-preview"
      data-menu-slug={preview.restaurant.menuSlug}
      data-preview-theme={theme}
    >
      <header className={styles.header}>
        <span className={styles.monogram}>
          {preview.restaurant.logoMonogram}
        </span>
        <div>
          <p>{sectionLabel}</p>
          <h3>{preview.restaurant.name}</h3>
          {preview.restaurant.tagline ? (
            <span>{preview.restaurant.tagline}</span>
          ) : null}
        </div>
      </header>

      <div className={styles.sections}>
        {preview.categoryCards.map((category, categoryIndex) => {
          const dishes = dishesForCategory(preview, category);
          return (
            <section
              className={styles.section}
              data-comparison-category={category.slug}
              key={category.id}
            >
              <header className={styles.sectionHeader}>
                <span>{String(categoryIndex + 1).padStart(2, "0")}</span>
                <div>
                  <h4>{category.name}</h4>
                  {category.description ? <p>{category.description}</p> : null}
                </div>
              </header>
              <div className={styles.dishes}>
                {dishes.map((dish) => (
                  <article
                    className={styles.dish}
                    data-comparison-dish={dish.slug}
                    data-dish-id={dish.id}
                    key={dish.id ?? dish.slug}
                  >
                    <span className={styles.dishImage}>
                      <PublicDishImage
                        alt={dish.imageAlt}
                        objectPosition={dish.imageObjectPosition}
                        quality={90}
                        sizes="96px"
                        src={dish.image}
                      />
                    </span>
                    <span className={styles.dishCopy}>
                      <strong>{dish.name}</strong>
                      {dish.shortDescription ? (
                        <small>{dish.shortDescription}</small>
                      ) : null}
                    </span>
                    <span className={styles.price}>{dish.price}</span>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <footer className={styles.footer}>
        <span>{preview.restaurant.name}</span>
        <span>Vistaire</span>
      </footer>
    </div>
  );
}
