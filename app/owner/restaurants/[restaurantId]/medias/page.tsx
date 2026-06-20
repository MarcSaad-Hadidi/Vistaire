import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerDishModelVisualCompare } from "@/components/owner/OwnerDishModelVisualCompare";
import { OwnerDishModelUploader } from "@/components/owner/OwnerDishModelUploader";
import { OwnerDishPhotoUploader } from "@/components/owner/OwnerDishPhotoUploader";
import {
  Badge,
  EmptyState,
  ModuleHeader,
  Panel,
  StatGroup,
  StatTile
} from "@/components/owner/OwnerUi";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getOwnerMenuData } from "@/lib/owner/menuData";
import {
  buildOwnerPreparationSummary,
  ownerRestaurantRoute
} from "@/lib/owner/restaurantPreparation";
import type { PublicMenuDish } from "@/lib/menu/publicMenuCore";

export const dynamic = "force-dynamic";

type MediaFilter =
  | "all"
  | "photos-missing"
  | "photos-ready"
  | "models-ready"
  | "review";

const FILTERS: Array<{ id: MediaFilter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "photos-missing", label: "Photos manquantes" },
  { id: "photos-ready", label: "Photos prêtes" },
  { id: "models-ready", label: "Médias 3D prêts" },
  { id: "review", label: "À vérifier" }
];

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
): string {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

function normalizeFilter(value: string): MediaFilter {
  return FILTERS.some((filter) => filter.id === value)
    ? (value as MediaFilter)
    : "all";
}

function needsReview(dish: PublicMenuDish): boolean {
  return (
    !dish.hasPhoto ||
    dish.modelStatus === "web_ready_usdz_pending" ||
    dish.modelStatus === "pending_manual_usdz" ||
    dish.modelStatus === "usdz_conversion_failed"
  );
}

function filterDishes(dishes: PublicMenuDish[], filter: MediaFilter) {
  if (filter === "photos-missing") return dishes.filter((dish) => !dish.hasPhoto);
  if (filter === "photos-ready") return dishes.filter((dish) => dish.hasPhoto);
  if (filter === "models-ready") return dishes.filter((dish) => dish.hasImmersive);
  if (filter === "review") return dishes.filter(needsReview);
  return dishes;
}

function mediaBasePath(restaurantId: string, fallback?: string): string {
  return fallback || `restaurants/${restaurantId}/photos/`;
}

export default async function OwnerRestaurantMediasPage({
  params,
  searchParams
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { restaurantId } = await params;
  const query = await searchParams;
  const activeFilter = normalizeFilter(getSearchParam(query, "filter"));
  const dashboard = await getOwnerRestaurantDashboardData(restaurantId);
  if (!dashboard.restaurant) notFound();

  const restaurant = dashboard.restaurant;
  const menuData = await getOwnerMenuData(restaurant.id);
  const dishes = menuData.ok ? menuData.dishes : [];
  const visibleDishes = filterDishes(dishes, activeFilter);
  const visualDishes = dishes.filter((dish) => dish.webModel3dUrl && dish.arUsdzUrl);
  const summary = buildOwnerPreparationSummary(restaurant, dishes);

  return (
    <>
      <ModuleHeader
        title={`Médias — ${restaurant.name}`}
        description="Centralisez les photos de plats, les GLB, les modèles 3D et les statuts AR liés à la carte."
        actions={
          <>
            <Link className={styles.btn} href={ownerRestaurantRoute(restaurant)} prefetch={false}>
              Vue d’ensemble
            </Link>
            <Link
              className={styles.btn}
              href={ownerRestaurantRoute(restaurant, "3d")}
              prefetch={false}
            >
              Workflow 3D / AR
            </Link>
            <Link
              className={styles.btn}
              href={ownerRestaurantRoute(restaurant, "preview")}
              prefetch={false}
            >
              Aperçu client
            </Link>
          </>
        }
      />

      <StatGroup title="Photos & modèles">
        <StatTile label="Photos prêtes" value={summary.photoDishCount} primary />
        <StatTile label="Photos manquantes" value={summary.missingPhotoCount} />
        <StatTile label="GLB web" value={summary.webModelCount} />
        <StatTile label="AR / USDZ" value={summary.arModelCount} />
      </StatGroup>

      <Panel
        title="Chemin média du restaurant"
        action={<Badge tone="muted">{restaurant.slug}</Badge>}
      >
        <div className={styles.urlPreview}>
          <p className={styles.metricLabel}>Storage/CDN</p>
          <p className={`${styles.bodyText} ${styles.breakText}`}>
            {mediaBasePath(restaurant.id, restaurant.mediaBasePath)}
          </p>
          <p className={styles.sourceNote}>
            Les photos et modèles restent dans Supabase Storage ou le CDN. Aucun
            fichier GLB/USDZ/vidéo n’est ajouté au dépôt par cette route.
          </p>
        </div>
      </Panel>

      <Panel
        title="Pipeline GLB -> USDZ"
        action={
          <Link
            className={`${styles.btnPrimary} ${styles.btn}`}
            href={ownerRestaurantRoute(restaurant, "3d")}
            prefetch={false}
          >
            Ouvrir 3D / AR
          </Link>
        }
      >
        <div className={styles.urlPreview}>
          <p className={styles.metricLabel}>Conversion & comparaison</p>
          <p className={styles.bodyText}>
            Upload GLB par plat, génération USDZ Quick Look, liens publics GLB/USDZ
            et comparaison visuelle sans chargement 3D avant clic.
          </p>
        </div>
      </Panel>

      <Panel
        title="Plats et médias"
        action={
          <div className={styles.filtersRow}>
            {FILTERS.map((filter) => (
              <Link
                key={filter.id}
                className={`${styles.btn} ${styles.btnSmall} ${
                  activeFilter === filter.id ? styles.btnPrimary : ""
                }`}
                href={`${ownerRestaurantRoute(restaurant, "medias")}?filter=${filter.id}`}
                prefetch={false}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        }
      >
        {!menuData.ok ? (
          <EmptyState>{menuData.error}</EmptyState>
        ) : dishes.length === 0 ? (
          <EmptyState>Aucun plat chargé pour ce restaurant.</EmptyState>
        ) : visibleDishes.length === 0 ? (
          <EmptyState>Aucun plat dans ce filtre.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Plat</th>
                  <th>Photo</th>
                  <th>GLB</th>
                  <th>AR</th>
                  <th>Qualité média</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDishes.map((dish) => (
                  <tr key={dish.id}>
                    <td>
                      <strong className={styles.cellMain}>{dish.name}</strong>
                      <span className={styles.cellSub}>{dish.category}</span>
                    </td>
                    <td>
                      <Badge tone={dish.hasPhoto ? "ready" : "warn"}>
                        {dish.hasPhoto ? "Photo prête" : dish.photoStatus}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={dish.webModel3dUrl ? "ready" : "muted"}>
                        {dish.webModel3dUrl ? "GLB prêt" : "Aucun GLB"}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={dish.arUsdzUrl || dish.arModel3dUrl ? "ready" : "muted"}>
                        {dish.arUsdzUrl || dish.arModel3dUrl ? "AR prêt" : "AR absent"}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={needsReview(dish) ? "warn" : "ready"}>
                        {needsReview(dish) ? "À vérifier" : "Prêt"}
                      </Badge>
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <OwnerDishPhotoUploader
                          restaurantId={restaurant.id}
                          dishId={dish.id}
                          dishName={dish.name}
                          initialImageUrl={dish.imageUrl}
                        />
                        <OwnerDishModelUploader
                          restaurantId={restaurant.id}
                          dishId={dish.id}
                          initialStatus={dish.modelStatus}
                          initialWebModel3dUrl={dish.webModel3dUrl}
                          initialWebModel3dBytes={dish.webModel3dBytes}
                          initialArUsdzUrl={dish.arUsdzUrl}
                          initialArUsdzBytes={dish.arUsdzBytes}
                          initialPreparedGlbJobId={dish.preparedGlbJobId}
                          initialPreparedGlbStoragePath={dish.preparedGlbStoragePath}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {visualDishes.length > 0 ? (
        <Panel title="Comparaison visuelle GLB / USDZ">
          <div className={styles.modelCompareStack}>
            {visualDishes.map((dish) => (
              <OwnerDishModelVisualCompare
                key={dish.id}
                dishName={dish.name}
                webModel3dUrl={dish.webModel3dUrl}
                webModel3dBytes={dish.webModel3dBytes}
                arPreviewModelUrl={dish.arModel3dUrl || dish.webModel3dUrl}
                arUsdzUrl={dish.arUsdzUrl}
                arUsdzBytes={dish.arUsdzBytes}
              />
            ))}
          </div>
        </Panel>
      ) : null}

    </>
  );
}
