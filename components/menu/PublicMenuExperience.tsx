"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { trackPublicMenuEvent } from "@/lib/analytics/client";
import {
  buildPublicDishPath,
  getPublicDishImageUrl,
  getPublicMenuCategoryGroups,
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuCategory,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import styles from "./PublicMenuExperience.module.css";

type PublicMenuExperienceProps = {
  menu: PublicMenu;
  context?: string;
  query?: PublicMenuContextQuery;
};

const ALL_TAB_ID = "all";
const HOME_TAB_ID = "home";
const preferredCategoryLabels = ["Entrées", "Plats", "Desserts", "Boissons"];
const preferredCategoryOrder = new Map(
  preferredCategoryLabels.map((label, index) => [label, index])
);

type MenuTab = {
  id: string;
  label: string;
  count: number;
};

function dishBadge(dish: PublicMenuDish): string | null {
  const haystack = `${dish.name} ${dish.description} ${dish.houseNote} ${dish.tags.join(" ")}`.toLowerCase();
  if (
    haystack.includes("maison") ||
    dish.name.toLowerCase().includes("bol de riz au poulet")
  ) {
    return "Maison";
  }
  return dish.tags[0] ?? null;
}

function categoryTone(category: PublicMenuCategory): string {
  return `${styles.categoryCard} ${styles[`tone${category.tone}`]}`;
}

function shortDescription(dish: PublicMenuDish): string {
  if (dish.description.length <= 118) return dish.description;
  return `${dish.description.slice(0, 115).trim()}...`;
}

function PublicDishCard({
  dish,
  menu,
  query
}: {
  dish: PublicMenuDish;
  menu: PublicMenu;
  query?: PublicMenuContextQuery;
}) {
  const badge = dishBadge(dish);
  const cardImageUrl = getPublicDishImageUrl(dish, "thumbnail");
  return (
    <li className={styles.dishCard}>
      <Link
        aria-label={`${dish.name}. Voir la fiche plat.`}
        className={styles.dishLink}
        href={buildPublicDishPath(menu.slug, dish.slug, query)}
        prefetch={false}
      >
        <span
          aria-hidden="true"
          className={styles.dishThumb}
          style={
            cardImageUrl
              ? { backgroundImage: `url("${cardImageUrl}")` }
              : undefined
          }
        >
          {!cardImageUrl ? menu.name.slice(0, 1) : null}
        </span>
        <span className={styles.dishCopy}>
          <span className={styles.dishHeading}>
            <span className={styles.dishName}>{dish.name}</span>
            {badge ? <span className={styles.badge}>{badge}</span> : null}
          </span>
          {dish.description ? (
            <span className={styles.dishDescription}>
              {shortDescription(dish)}
            </span>
          ) : null}
          {!dish.available ? (
            <span className={styles.unavailable}>Indisponible</span>
          ) : null}
        </span>
        <span className={styles.dishAside}>
          {dish.priceLabel ? (
            <strong className={styles.price}>{dish.priceLabel}</strong>
          ) : null}
          <span className={styles.cardAction}>Voir</span>
        </span>
      </Link>
    </li>
  );
}

export function PublicMenuExperience({
  menu,
  context = "",
  query
}: PublicMenuExperienceProps) {
  const [activeTab, setActiveTab] = useState<string>(HOME_TAB_ID);
  const [welcomeActive, setWelcomeActive] = useState(true);
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
  const tabs = useMemo<MenuTab[]>(
    () => [
      { id: ALL_TAB_ID, label: "Tout", count: menu.dishes.length },
      ...categories.map((category) => ({
        id: category.id,
        label: category.label,
        count: category.count
      }))
    ],
    [categories, menu.dishes.length]
  );
  const activeCategory = categories.find((category) => category.id === activeTab);
  const selectedDishes =
    activeTab !== HOME_TAB_ID && activeTab !== ALL_TAB_ID
      ? groups.get(activeTab) ?? []
      : [];
  const featuredDishes = useMemo(
    () =>
      menu.dishes
        .filter((dish) => dishBadge(dish) || dish.category === "Plats")
        .slice(0, 3),
    [menu.dishes]
  );

  useEffect(() => {
    trackPublicMenuEvent(menu, { eventName: "menu_opened" });
  }, [menu]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timer = window.setTimeout(() => setWelcomeActive(false), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setWelcomeActive(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  function scrollToMenu() {
    document.getElementById("resto-marc-menu")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start"
    });
  }

  function showMenu() {
    setActiveTab(ALL_TAB_ID);
    setWelcomeActive(false);
    scrollToMenu();
  }

  function showHome() {
    setActiveTab(HOME_TAB_ID);
    scrollToMenu();
  }

  function selectTab(tabId: string) {
    setActiveTab(tabId);
    setWelcomeActive(false);
  }

  const heading =
    activeTab === HOME_TAB_ID
      ? "Catégories"
      : activeTab === ALL_TAB_ID
        ? "Tout le menu"
        : activeCategory?.label ?? activeTab;

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
        <div className={styles.quickActions}>
          <button
            className={styles.quickButton}
            type="button"
            onClick={showMenu}
          >
            Voir le menu
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={showHome}
          >
            Catégories
          </button>
        </div>
      </section>

      <section id="resto-marc-menu" className={styles.menuShell}>
        <div className={styles.restaurantIntro}>
          <div>
            <p className={styles.sectionLabel}>Menu public</p>
            <h2>{heading}</h2>
          </div>
          {activeTab !== HOME_TAB_ID ? (
            <button
              className={styles.backButton}
              type="button"
              onClick={showHome}
            >
              Retour aux catégories
            </button>
          ) : null}
        </div>

        {menu.dishes.length > 0 ? (
          <div
            aria-label="Catégories du menu"
            className={styles.categoryTabs}
            role="tablist"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  aria-selected={isActive}
                  className={isActive ? styles.activeTab : undefined}
                  key={tab.id}
                  onClick={() => selectTab(tab.id)}
                  role="tab"
                  type="button"
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
              <span>Revenez bientôt pour découvrir les plats maison.</span>
            </div>
          ) : activeTab === HOME_TAB_ID ? (
            <>
              <div className={styles.categoryGrid}>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={categoryTone(category)}
                    onClick={() => selectTab(category.id)}
                  >
                    <span className={styles.categoryCount}>
                      {category.count} choix
                    </span>
                    <strong>{category.label}</strong>
                    <small>{category.description}</small>
                  </button>
                ))}
              </div>

              <section className={styles.previewSection}>
                <div className={styles.previewHeader}>
                  <div>
                    <p className={styles.sectionLabel}>À découvrir</p>
                    <h3>Aperçu maison</h3>
                  </div>
                  <button type="button" onClick={showMenu}>
                    Tout voir
                  </button>
                </div>
                <ul className={styles.dishList}>
                  {featuredDishes.map((dish) => (
                    <PublicDishCard
                      key={dish.id}
                      dish={dish}
                      menu={menu}
                      query={query}
                    />
                  ))}
                </ul>
              </section>
            </>
          ) : activeTab === ALL_TAB_ID ? (
            <div className={styles.fullMenuList}>
              {categories.map((category) => {
                const dishes = groups.get(category.id) ?? [];
                return (
                  <section key={category.id} className={styles.fullMenuSection}>
                    <div className={styles.fullMenuSectionHeader}>
                      <h3>{category.label}</h3>
                      <span>{dishes.length} choix</span>
                    </div>
                    <ul className={styles.dishList}>
                      {dishes.map((dish) => (
                        <PublicDishCard
                          key={dish.id}
                          dish={dish}
                          menu={menu}
                          query={query}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <section className={styles.fullMenuSection}>
              <div className={styles.fullMenuSectionHeader}>
                <h3>{activeCategory?.label ?? activeTab}</h3>
                <span>{selectedDishes.length} choix</span>
              </div>
              <ul className={styles.dishList}>
                {selectedDishes.map((dish) => (
                  <PublicDishCard
                    key={dish.id}
                    dish={dish}
                    menu={menu}
                    query={query}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
