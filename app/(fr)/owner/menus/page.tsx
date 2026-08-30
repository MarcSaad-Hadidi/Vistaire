import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, EmptyState, ModuleHeader, Panel } from "@/components/owner/OwnerUi";
import { getOwnerMenuStatusData } from "@/lib/owner/data";

export const dynamic = "force-dynamic";

function menuStatus(dishCount: number, status: string): {
  label: string;
  tone: "ready" | "warn" | "danger" | "muted";
} {
  if (dishCount === 0) return { label: "Vide", tone: "danger" };
  if (status === "active") return { label: "Publié", tone: "ready" };
  if (status === "paused") return { label: "Pause", tone: "warn" };
  if (status === "demo") return { label: "Démo", tone: "muted" };
  return { label: "Prêt à publier", tone: "warn" };
}

export default async function OwnerMenusPage() {
  const data = await getOwnerMenuStatusData();

  return (
    <>
      <ModuleHeader
        title="Menus"
        description="Statut des cartes par restaurant. MVP basé sur les restaurants et le nombre de plats reliés (pas de table menus dédiée pour l'instant)."
      />

      {data.restaurants.length === 0 ? (
        <EmptyState>Aucun menu à afficher.</EmptyState>
      ) : (
        <Panel title="Cartes par restaurant">
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Statut menu</th>
                  <th>Plats</th>
                  <th>Photos</th>
                  <th>Menu public</th>
                </tr>
              </thead>
              <tbody>
                {data.restaurants.map((restaurant) => {
                  const status = menuStatus(restaurant.dishCount, restaurant.status);
                  return (
                    <tr key={restaurant.id}>
                      <td>
                        <div className={styles.cellMain}>{restaurant.name}</div>
                        <div className={styles.cellSub}>{restaurant.slug}</div>
                      </td>
                      <td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </td>
                      <td>{restaurant.dishCount}</td>
                      <td>
                        {restaurant.photoDishCount}/{restaurant.dishCount}
                      </td>
                      <td>
                        <Link
                          className={styles.inlineLink}
                          href={restaurant.clientMenuHref}
                          prefetch={false}
                        >
                          Preview
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
