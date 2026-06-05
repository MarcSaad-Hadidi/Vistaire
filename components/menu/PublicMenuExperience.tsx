"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPublicMenuCategoryGroups,
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuCategory,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import styles from "./PublicMenuExperience.module.css";

type PublicMenuExperienceProps = {
  menu: PublicMenu;
  context?: string;
};

function dishBadge(dish: PublicMenuDish): string | null {
  const haystack = `${dish.name} ${dish.description}`.toLowerCase();
  if (
    haystack.includes("maison") ||
    dish.name.toLowerCase().includes("bol de riz au poulet")
  ) {
    return "Maison";
  }
  return null;
}

function categoryTone(category: PublicMenuCategory): string {
  return `${styles.categoryCard} ${styles[`tone${category.tone}`]}`;
}

export function PublicMenuExperience({ menu, context = "" }: PublicMenuExperienceProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [welcomeActive, setWelcomeActive] = useState(true);
  const groups = useMemo(() => getPublicMenuCategoryGroups(menu.dishes), [menu.dishes]);
  const categories = useMemo(
    () => getVisiblePublicMenuCategories(menu.dishes),
    [menu.dishes]
  );
  const selectedDishes = selectedCategory
    ? groups.get(selectedCategory) ?? []
    : [];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timer = window.setTimeout(() => setWelcomeActive(false), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setWelcomeActive(false), 1_400);
    return () => window.clearTimeout(timer);
  }, []);

  function showMenu() {
    setWelcomeActive(false);
    document.getElementById("resto-marc-menu")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start"
    });
  }

  return (
    <main className={styles.page}>
      <section
        className={`${styles.welcome} ${welcomeActive ? styles.welcomeActive : ""}`}
        aria-label="Bienvenue chez Resto Marc"
      >
        <div className={styles.welcomeText}>
          <p className={styles.kicker}>Resto Marc</p>
          <h1>Bienvenue chez Resto Marc</h1>
          <p>Cuisine maison fraîche et généreuse</p>
          {context ? <span className={styles.context}>{context}</span> : null}
        </div>
        <button
          className={styles.quickButton}
          type="button"
          onClick={showMenu}
        >
          Voir le menu
        </button>
      </section>

      <section id="resto-marc-menu" className={styles.menuShell} aria-live="polite">
        <div className={styles.restaurantIntro}>
          <div>
            <p className={styles.sectionLabel}>Menu public</p>
            <h2>{selectedCategory ?? "Choisissez une catégorie"}</h2>
          </div>
          {selectedCategory ? (
            <button
              className={styles.backButton}
              type="button"
              onClick={() => setSelectedCategory(null)}
            >
              Retour aux catégories
            </button>
          ) : null}
        </div>

        {menu.dishes.length === 0 ? (
          <p className={styles.empty}>
            La carte de ce restaurant n&apos;est pas encore disponible.
          </p>
        ) : selectedCategory ? (
          <ul className={styles.dishList}>
            {selectedDishes.map((dish) => {
              const badge = dishBadge(dish);
              return (
                <li key={dish.id} className={styles.dishCard}>
                  <div>
                    <div className={styles.dishHeading}>
                      <h3>{dish.name}</h3>
                      {badge ? <span>{badge}</span> : null}
                    </div>
                    {dish.description ? <p>{dish.description}</p> : null}
                  </div>
                  {dish.priceLabel ? (
                    <strong className={styles.price}>{dish.priceLabel}</strong>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.categoryGrid}>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={categoryTone(category)}
                onClick={() => setSelectedCategory(category.label)}
              >
                <span className={styles.categoryCount}>
                  {category.count} choix
                </span>
                <strong>{category.label}</strong>
                <small>{category.description}</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
