"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CARTE_VISTAIRE_CATEGORIES,
  CARTE_VISTAIRE_DISHES,
  type CarteVistaireDish
} from "@/lib/carteVistaireData";
import styles from "./CarteVistairePage.module.css";

function dishCategoryLabel(category: string) {
  return (
    CARTE_VISTAIRE_CATEGORIES.find((item) => item.slug === category)?.label ??
    "Carte"
  );
}

function getDishesForCategory(category: string) {
  if (category === "all") return CARTE_VISTAIRE_DISHES;
  return CARTE_VISTAIRE_DISHES.filter((dish) => dish.category === category);
}

function DishCard({
  dish,
  selected,
  onSelect
}: {
  dish: CarteVistaireDish;
  selected: boolean;
  onSelect: (dish: CarteVistaireDish) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.dishCard} ${selected ? styles.dishCardActive : ""}`}
      onClick={() => onSelect(dish)}
      aria-pressed={selected}
    >
      <span className={styles.dishSymbol} aria-hidden="true">
        {dish.has3d ? "3D" : "Photo"}
      </span>
      <span className={styles.dishCopy}>
        <span className={styles.dishMeta}>
          {dishCategoryLabel(dish.category)}
          {dish.has3d ? " · plat 3D inclus" : " · fiche photo premium"}
        </span>
        <span className={styles.dishName}>{dish.name}</span>
        <span className={styles.dishDescription}>{dish.shortDescription}</span>
        <span className={styles.badges}>
          {dish.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
          {dish.has3d ? <span>3D</span> : null}
        </span>
      </span>
      <strong>{dish.price}</strong>
    </button>
  );
}

function DishDetail({ dish }: { dish: CarteVistaireDish }) {
  return (
    <aside className={styles.detailPanel} aria-labelledby="carte-detail-heading">
      <p className={styles.panelKicker}>{dishCategoryLabel(dish.category)}</p>
      <h2 id="carte-detail-heading">{dish.name}</h2>
      <strong className={styles.detailPrice}>{dish.price}</strong>
      <p>{dish.description}</p>
      <div className={styles.detailGrid}>
        <section>
          <h3>Allergènes</h3>
          {dish.allergens.length ? (
            <ul>
              {dish.allergens.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>À confirmer auprès du restaurant.</p>
          )}
        </section>
        <section>
          <h3>Options</h3>
          {dish.options.length ? (
            <ul>
              {dish.options.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>Pas d’option particulière.</p>
          )}
        </section>
      </div>
      <section className={styles.modelNote}>
        <h3>{dish.has3d ? "Plat 3D inclus" : "Fallback photo premium"}</h3>
        <p>
          {dish.has3d
            ? "La 3D est présentée comme une couche visuelle validée, sans charger de fichier lourd sur cette page."
            : "Si un rendu 3D n’est pas assez fidèle, la fiche reste premium avec photo, texte, prix et allergènes."}
        </p>
      </section>
    </aside>
  );
}

export function CarteVistairePage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedDish, setSelectedDish] = useState(CARTE_VISTAIRE_DISHES[2]);

  const visibleDishes = useMemo(() => {
    return getDishesForCategory(activeCategory);
  }, [activeCategory]);

  function handleCategoryChange(category: string) {
    const nextDishes = getDishesForCategory(category);

    setActiveCategory(category);
    setSelectedDish((currentDish) => {
      const currentDishStillVisible = nextDishes.some(
        (dish) => dish.id === currentDish.id
      );

      return currentDishStillVisible
        ? currentDish
        : nextDishes[0] ?? CARTE_VISTAIRE_DISHES[0];
    });
  }

  return (
    <main className={styles.page}>
      <nav className={styles.topNav} aria-label="Navigation carte Vistaire">
        <Link href="/" className={styles.brand}>
          Vistaire
        </Link>
        <div>
          <Link href="/tarifs-menu-digital-restaurant">Tarifs</Link>
          <Link href="/prendre-rendez-vous">Parler de votre menu</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Carte mobile premium</p>
          <h1>Carte Vistaire interactive</h1>
          <p>
            Une carte digitale mobile pensée pour être lue à table : catégories
            claires, fiches plats, prix, allergènes, visuels et plats 3D inclus
            lorsque le rendu est validé.
          </p>
          <div className={styles.heroActions}>
            <Link href="/prendre-rendez-vous" className={styles.primaryCta}>
              Parler de votre menu
            </Link>
            <Link href="/tarifs-menu-digital-restaurant" className={styles.secondaryCta}>
              Voir les tarifs
            </Link>
          </div>
        </div>
        <div className={styles.phonePreview} aria-label="Carte mobile Vistaire">
          <p>Maison Élyse</p>
          <strong>Plats signatures, desserts et boissons</strong>
          <span>8 fiches · 7 plats avec 3D incluse</span>
        </div>
      </section>

      <section className={styles.menuSection} aria-labelledby="carte-menu-heading">
        <div className={styles.menuHeader}>
          <div>
            <p className={styles.kicker}>Expérience à table</p>
            <h2 id="carte-menu-heading">Explorez une carte Vistaire</h2>
          </div>
          <p>
            Les boutons ci-dessous filtrent la carte. Chaque plat ouvre une
            fiche avec les informations que le client consulte le plus souvent.
          </p>
        </div>

        <div className={styles.categoryTabs} role="group" aria-label="Catégories de la carte">
          {CARTE_VISTAIRE_CATEGORIES.map((category) => {
            const active = activeCategory === category.slug;
            return (
              <button
                key={category.slug}
                type="button"
                aria-pressed={active}
                className={active ? styles.activeTab : undefined}
                onClick={() => handleCategoryChange(category.slug)}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <div className={styles.menuGrid}>
          <div className={styles.dishList} aria-live="polite">
            {visibleDishes.map((dish) => (
              <DishCard
                key={dish.id}
                dish={dish}
                selected={selectedDish.id === dish.id}
                onSelect={setSelectedDish}
              />
            ))}
          </div>
          <DishDetail dish={selectedDish} />
        </div>
      </section>

      <section className={styles.qualitySection}>
        <h2>La 3D reste sélective et validée.</h2>
        <p>
          Vistaire met en avant les plats 3D inclus, mais ne publie pas un rendu
          qui ne respecte pas assez le plat. La fiche reste alors premium avec
          photo, description, prix et allergènes.
        </p>
      </section>

      <footer className={styles.footer}>
        <p>Vistaire · Menu digital premium avec plats 3D inclus</p>
        <Link href="/prendre-rendez-vous">Parler de votre menu</Link>
      </footer>
    </main>
  );
}
