import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  Badge,
  EmptyState,
  ModuleHeader,
  Panel,
  StatGroup,
  StatTile
} from "@/components/owner/OwnerUi";
import {
  getOwnerMenuStatusData,
  getOwnerRestaurantDashboardData
} from "@/lib/owner/data";
import { getOwnerMenuData } from "@/lib/owner/menuData";
import type { OwnerRestaurant } from "@/lib/owner/types";

export const dynamic = "force-dynamic";

type OwnerMediasPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
): string {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

function buildMediaBasePath(restaurant: OwnerRestaurant): string {
  return restaurant.mediaBasePath || `restaurants/${restaurant.id}/photos/`;
}

function coverageLabel(photoCount: number, dishCount: number): string {
  if (dishCount <= 0) return "0%";
  const coverage = Math.round((photoCount / dishCount) * 100);
  return `${coverage}%`;
}

function GlobalMediaView({
  restaurants,
  invalidLookup
}: {
  restaurants: OwnerRestaurant[];
  invalidLookup: boolean;
}) {
  const totals = restaurants.reduce(
    (acc, restaurant) => {
      acc.photos += restaurant.photoDishCount;
      acc.missing += restaurant.incompleteDishCount;
      return acc;
    },
    { photos: 0, missing: 0 }
  );
  const missingByRestaurant = restaurants.filter(
    (restaurant) => restaurant.incompleteDishCount > 0
  );

  return (
    <>
      {invalidLookup ? (
        <div className={styles.checklist}>
          <div className={styles.checkItem}>
            <span>
              <strong>Restaurant introuvable</strong>
              <small>Restaurant introuvable, vue globale affichee.</small>
            </span>
            <span className={`${styles.badge} ${styles.badgeWarn}`}>Note</span>
          </div>
        </div>
      ) : null}

      <StatGroup title="Photos">
        <StatTile label="Photos presentes" value={totals.photos} primary />
        <StatTile label="Photos manquantes" value={totals.missing} />
        <StatTile label="Restaurants a completer" value={missingByRestaurant.length} />
      </StatGroup>

      <Panel title="Photos manquantes par restaurant">
        {missingByRestaurant.length === 0 ? (
          <EmptyState>Aucune photo manquante detectee dans les donnees disponibles.</EmptyState>
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
                    <td>
                      <Link
                        className={styles.cellMain}
                        href={`/owner/medias?restaurantId=${encodeURIComponent(restaurant.id)}`}
                      >
                        {restaurant.name}
                      </Link>
                    </td>
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
    </>
  );
}

async function TargetedMediaView({ restaurant }: { restaurant: OwnerRestaurant }) {
  const menuData = await getOwnerMenuData(restaurant.id);
  const dishes = menuData.ok ? menuData.dishes : [];
  const dishesWithoutPhoto = dishes.filter((dish) => !dish.hasPhoto);
  const dishCount = menuData.ok ? dishes.length : restaurant.dishCount;
  const photoCount = menuData.ok
    ? dishes.filter((dish) => dish.hasPhoto).length
    : restaurant.photoDishCount;
  const missingPhotoCount = menuData.ok
    ? dishesWithoutPhoto.length
    : restaurant.incompleteDishCount;
  const mediaBasePath = buildMediaBasePath(restaurant);

  return (
    <>
      <StatGroup title={`Photos - ${restaurant.name}`}>
        <StatTile label="Photos presentes" value={photoCount} primary />
        <StatTile label="Photos a ajouter" value={missingPhotoCount} />
        <StatTile label="Couverture" value={coverageLabel(photoCount, dishCount)} />
      </StatGroup>

      <Panel
        title="Chemin media du restaurant"
        action={<Badge tone="muted">{restaurant.slug}</Badge>}
      >
        <div className={styles.urlPreview}>
          <p className={styles.metricLabel}>Chemin Storage/CDN reference</p>
          <p className={`${styles.bodyText} ${styles.breakText}`}>{mediaBasePath}</p>
          <p className={styles.sourceNote}>
            Les uploads ne sont pas geres dans ce module. Ajoutez les fichiers dans
            le stockage media, puis renseignez les URL photo des plats.
          </p>
        </div>
      </Panel>

      <Panel title="Photos a ajouter">
        {!menuData.ok ? (
          <EmptyState>{menuData.error}</EmptyState>
        ) : dishesWithoutPhoto.length === 0 ? (
          <EmptyState>Tous les plats charges pour ce restaurant ont une photo detectee.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Plat</th>
                  <th>Section</th>
                  <th>Statut photo</th>
                  <th>Chemin conseille</th>
                </tr>
              </thead>
              <tbody>
                {dishesWithoutPhoto.map((dish) => (
                  <tr key={dish.id}>
                    <td>
                      <strong className={styles.cellMain}>{dish.name}</strong>
                    </td>
                    <td className={styles.cellSub}>{dish.category}</td>
                    <td>
                      <Badge tone="warn">{dish.photoStatus}</Badge>
                    </td>
                    <td className={styles.cellSub}>
                      {mediaBasePath}
                      {dish.slug}.jpg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

export default async function OwnerMediasPage({
  searchParams
}: OwnerMediasPageProps) {
  const params = await searchParams;
  const restaurantId = getSearchParam(params, "restaurantId");
  const restaurantSlug =
    getSearchParam(params, "restaurantSlug") || getSearchParam(params, "restaurant");
  const lookup = restaurantId || restaurantSlug;
  const dashboardData = lookup
    ? await getOwnerRestaurantDashboardData(lookup)
    : null;
  const data = dashboardData ?? (await getOwnerMenuStatusData());
  const targetedRestaurant = dashboardData?.restaurant ?? null;

  return (
    <>
      <ModuleHeader
        title="Medias"
        description="Suivre les photos de plats et les chemins media sans ecrire d'assets dans le depot."
      />

      {targetedRestaurant ? (
        <TargetedMediaView restaurant={targetedRestaurant} />
      ) : (
        <GlobalMediaView restaurants={data.restaurants} invalidLookup={Boolean(lookup)} />
      )}

      <p className={styles.sourceTag}>
        Note storage/CDN : les uploads d&apos;assets ne sont pas geres depuis ce
        module. Le pipeline media reste gere hors cockpit; aucun dossier public,
        fichier modele ou video n&apos;est cree ici.
      </p>
    </>
  );
}
