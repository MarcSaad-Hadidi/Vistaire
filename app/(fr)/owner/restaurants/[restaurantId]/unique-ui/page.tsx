import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerUniqueMenuDesignPanel } from "@/components/owner/OwnerUniqueMenuDesignPanel";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getUniqueMenuDesignSnapshot } from "@/lib/owner/uniqueMenuDesignStore";

export const dynamic = "force-dynamic";

export default async function OwnerUniqueMenuUiPage({
  params
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const data = await getOwnerRestaurantDashboardData(restaurantId);
  if (!data.restaurant) {
    notFound();
  }

  const snapshot = await getUniqueMenuDesignSnapshot(data.restaurant.id);
  const designStudioHref = `/owner/menu-builder?restaurantId=${encodeURIComponent(data.restaurant.id)}&restaurantSlug=${encodeURIComponent(data.restaurant.slug)}`;

  return (
    <main className={styles.page}>
      <section className={styles.restaurantHeader}>
        <div>
          <p className={styles.eyebrow}>Espace owner · UI unique</p>
          <h1>{data.restaurant.name}</h1>
          <p>
            Cycle de vie serveur du design unique. Les clients publics ne voient
            jamais ces diagnostics.
          </p>
        </div>
        <div className={styles.restaurantHeaderActions}>
          <Link
            className={styles.btn}
            href={`/owner/restaurants/${encodeURIComponent(data.restaurant.id)}`}
            prefetch={false}
          >
            Retour dashboard
          </Link>
          <Link className={styles.btn} href={designStudioHref} prefetch={false}>
            Design Studio
          </Link>
        </div>
      </section>

      {!snapshot.ok ? (
        <p className={styles.qrStatus} role="alert">
          {snapshot.error}
        </p>
      ) : (
        <OwnerUniqueMenuDesignPanel
          restaurantId={data.restaurant.id}
          restaurantName={data.restaurant.name}
          restaurantSlug={data.restaurant.slug}
          publicMenuHref={data.restaurant.publicMenuUrl}
          designStudioHref={designStudioHref}
          initialDesign={snapshot.uniqueDesign}
          initialRenderers={snapshot.availableRenderers}
          style={snapshot.style}
        />
      )}
    </main>
  );
}
