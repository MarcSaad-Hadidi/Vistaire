import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  OwnerRestaurantMediaManager,
  type OwnerMediaFilter
} from "@/components/owner/OwnerRestaurantMediaManager";
import {
  Badge,
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

export const dynamic = "force-dynamic";

const FILTER_IDS = new Set<OwnerMediaFilter>([
  "all",
  "photos-missing",
  "photos-ready",
  "models-ready",
  "review"
]);

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
): string {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

function normalizeFilter(value: string): OwnerMediaFilter {
  return FILTER_IDS.has(value as OwnerMediaFilter)
    ? (value as OwnerMediaFilter)
    : "all";
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
  const summary = buildOwnerPreparationSummary(restaurant, dishes);

  return (
    <>
      <ModuleHeader
        title={`Médias - ${restaurant.name}`}
        description="Centralisez les photos de plats, les GLB, les modèles 3D et les statuts AR liés à la carte."
        actions={
          <>
            <Link className={styles.btn} href={ownerRestaurantRoute(restaurant)} prefetch={false}>
              Vue d&apos;ensemble
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
        title="Chemin media du restaurant"
        action={<Badge tone="muted">{restaurant.slug}</Badge>}
      >
        <div className={styles.urlPreview}>
          <p className={styles.metricLabel}>Storage/CDN</p>
          <p className={`${styles.bodyText} ${styles.breakText}`}>
            {mediaBasePath(restaurant.id, restaurant.mediaBasePath)}
          </p>
          <p className={styles.sourceNote}>
            Les photos et modèles restent dans Supabase Storage ou le CDN. Aucun
            fichier GLB/USDZ/vidéo n&apos;est ajouté au dépôt par cette route.
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

      <OwnerRestaurantMediaManager
        restaurantId={restaurant.id}
        mediasHref={ownerRestaurantRoute(restaurant, "medias")}
        activeFilter={activeFilter}
        dishes={dishes}
        menuError={menuData.ok ? undefined : menuData.error}
      />
    </>
  );
}
