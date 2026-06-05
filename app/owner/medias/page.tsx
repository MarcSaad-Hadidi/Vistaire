import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, EmptyState, ModuleHeader, Panel, StatGroup, StatTile } from "@/components/owner/OwnerUi";
import { getOwnerMenuStatusData } from "@/lib/owner/data";

export const dynamic = "force-dynamic";

export default async function OwnerMediasPage() {
  const data = await getOwnerMenuStatusData();
  const totals = data.restaurants.reduce(
    (acc, restaurant) => {
      acc.photos += restaurant.photoDishCount;
      acc.missing += restaurant.incompleteDishCount;
      return acc;
    },
    { photos: 0, missing: 0 }
  );
  const missingByRestaurant = data.restaurants.filter(
    (restaurant) => restaurant.incompleteDishCount > 0
  );

  return (
    <>
      <ModuleHeader
        title="Médias"
        description="Repérer la qualité et les manques d'assets. Détection basée sur les colonnes photo de menu_dishes."
      />

      <StatGroup title="Photos">
        <StatTile label="Photos présentes" value={totals.photos} primary />
        <StatTile label="Photos manquantes" value={totals.missing} />
        <StatTile label="Restaurants à compléter" value={missingByRestaurant.length} />
      </StatGroup>

      <Panel title="Photos manquantes par restaurant">
        {missingByRestaurant.length === 0 ? (
          <EmptyState>Aucune photo manquante détectée dans les données disponibles.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Plats sans photo</th>
                  <th>Couverture</th>
                </tr>
              </thead>
              <tbody>
                {missingByRestaurant.map((restaurant) => (
                  <tr key={restaurant.id}>
                    <td className={styles.cellMain}>{restaurant.name}</td>
                    <td>
                      <Badge tone="warn">{restaurant.incompleteDishCount}</Badge>
                    </td>
                    <td>
                      {restaurant.photoDishCount}/{restaurant.dishCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className={styles.sourceTag}>
        Note storage/CDN : les uploads d&apos;assets ne sont pas gérés depuis ce
        module (pas d&apos;écriture dans les assets publics). Le pipeline média
        reste géré hors cockpit.
      </p>
    </>
  );
}
