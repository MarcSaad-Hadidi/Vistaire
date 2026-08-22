import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, EmptyState, ModuleHeader, Panel, StatGroup, StatTile } from "@/components/owner/OwnerUi";
import { getOwnerMenuStatusData } from "@/lib/owner/data";

export const dynamic = "force-dynamic";

export default async function OwnerPlatsPage() {
  const data = await getOwnerMenuStatusData();
  const totals = data.restaurants.reduce(
    (acc, restaurant) => {
      acc.dishes += restaurant.dishCount;
      acc.photos += restaurant.photoDishCount;
      acc.immersive += restaurant.immersiveDishCount;
      acc.missingPhoto += restaurant.incompleteDishCount;
      return acc;
    },
    { dishes: 0, photos: 0, immersive: 0, missingPhoto: 0 }
  );

  return (
    <>
      <ModuleHeader
        title="Plats"
        description="Contrôle qualité du contenu. Les compteurs viennent de menu_dishes (et de la démo). Les filtres par plat individuel arriveront avec une vue plat dédiée."
      />

      <StatGroup title="Qualité contenu (agrégé)">
        <StatTile label="Plats total" value={totals.dishes} primary />
        <StatTile label="Avec photo" value={totals.photos} />
        <StatTile label="Sans photo" value={totals.missingPhoto} />
        <StatTile label="Avec 3D / AR" value={totals.immersive} />
      </StatGroup>

      {data.restaurants.length === 0 ? (
        <EmptyState>Aucun plat détecté.</EmptyState>
      ) : (
        <Panel title="Qualité par restaurant">
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Plats</th>
                  <th>Sans photo</th>
                  <th>3D / AR</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {data.restaurants.map((restaurant) => (
                  <tr key={restaurant.id}>
                    <td className={styles.cellMain}>{restaurant.name}</td>
                    <td>{restaurant.dishCount}</td>
                    <td>{restaurant.incompleteDishCount}</td>
                    <td>{restaurant.immersiveDishCount}</td>
                    <td>
                      {restaurant.dishCount === 0 ? (
                        <Badge tone="danger">Menu vide</Badge>
                      ) : restaurant.incompleteDishCount > 0 ? (
                        <Badge tone="warn">Photos à compléter</Badge>
                      ) : (
                        <Badge tone="ready">Complet</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
