import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicMenuExperience } from "@/components/menu/PublicMenuExperience";
import { getPublicMenuBySlug, type PublicMenuDish } from "@/lib/menu/publicMenu";
import { isFreshHomemadeMenu } from "@/lib/menu/publicMenuCore";
import styles from "./menu.module.css";

export const dynamic = "force-dynamic";

type MenuPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string; zone?: string }>;
};

export const metadata: Metadata = {
  // Minimal V1 public menu — kept out of the index until the full menu
  // experience ships, to avoid thin/duplicate content with /demo.
  robots: { index: false, follow: false }
};

function groupByCategory(dishes: PublicMenuDish[]): Map<string, PublicMenuDish[]> {
  const groups = new Map<string, PublicMenuDish[]>();
  for (const dish of dishes) {
    const key = dish.category || "Carte";
    const list = groups.get(key) ?? [];
    list.push(dish);
    groups.set(key, list);
  }
  return groups;
}

export default async function PublicMenuPage({
  params,
  searchParams
}: MenuPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const menu = await getPublicMenuBySlug(slug);

  if (!menu) {
    notFound();
  }

  const groups = groupByCategory(menu.dishes);
  const context = [query.table ? `Table ${query.table}` : "", query.zone ? `Zone ${query.zone}` : ""]
    .filter(Boolean)
    .join(" · ");

  if (isFreshHomemadeMenu(menu)) {
    return <PublicMenuExperience menu={menu} context={context} query={query} />;
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Menu Vistaire</p>
        <h1 className={styles.title}>{menu.name}</h1>
        <p className={styles.meta}>
          {[menu.cuisineType, menu.location].filter(Boolean).join(" · ")}
          {context ? ` · ${context}` : ""}
        </p>

        {menu.dishes.length === 0 ? (
          <p className={styles.empty}>
            La carte de ce restaurant n&apos;est pas encore disponible.
          </p>
        ) : (
          Array.from(groups.entries()).map(([category, dishes]) => (
            <section key={category}>
              <h2 className={styles.categoryTitle}>{category}</h2>
              <ul className={styles.dishList}>
                {dishes.map((dish) => (
                  <li key={dish.id} className={styles.dish}>
                    <div>
                      <p className={styles.dishName}>{dish.name}</p>
                      {dish.description ? (
                        <p className={styles.dishDesc}>{dish.description}</p>
                      ) : null}
                      {dish.hasImmersive ? (
                        <div className={styles.tags}>
                          <span className={styles.tag}>3D / AR</span>
                        </div>
                      ) : null}
                    </div>
                    {dish.priceLabel ? (
                      <span className={styles.price}>{dish.priceLabel}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
