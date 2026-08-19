import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Owner3dArPipelineCenter } from "@/components/owner/Owner3dArPipeline";
import { ModuleHeader } from "@/components/owner/OwnerUi";
import { getVistaireOwnerAuthorization } from "@/lib/auth/owner";
import {
  filterOwner3dPipelineOverviewForOwner,
  getOwner3dPipelineOverview
} from "@/lib/owner/threeDArPipeline";

export const dynamic = "force-dynamic";

export default async function Owner3dArPipelinePage() {
  const owner = await getVistaireOwnerAuthorization();
  const overview = owner.ok
    ? filterOwner3dPipelineOverviewForOwner(getOwner3dPipelineOverview(), owner)
    : getOwner3dPipelineOverview();

  return (
    <>
      <ModuleHeader
        title="3D / AR Pipeline Operations Center"
        description="Pilotez les versions immersives par restaurant, menu et plat : preuves, quality gates, QA appareil, CDN et publication. Aucun GLB/USDZ n'est chargé avant une intention explicite."
        actions={
          <>
            <Link className={styles.btn} href="/owner/plats" prefetch={false}>
              Plats à sublimer
            </Link>
            <Link className={styles.btn} href="/owner/medias" prefetch={false}>
              Sources média
            </Link>
          </>
        }
      />

      <Owner3dArPipelineCenter overview={overview} />

      <p className={styles.sourceTag}>
        L&apos;upload source écrit uniquement en staging privé quand le storage est
        configuré. Les autres actions affichent encore les commandes et
        confirmations attendues sans approve, publish ou rollback depuis l&apos;UI.
      </p>
    </>
  );
}
