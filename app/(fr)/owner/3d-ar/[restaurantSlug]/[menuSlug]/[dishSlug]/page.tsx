import { notFound } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  Owner3dArAssetDetail,
  Owner3dArAssetWorklist
} from "@/components/owner/Owner3dArPipeline";
import { ModuleHeader, Panel } from "@/components/owner/OwnerUi";
import { getVistaireOwnerAuthorization } from "@/lib/auth/owner";
import { ownerCanAccess3dRestaurant } from "@/lib/auth/owner3dAccess";
import {
  getOwner3dPipelineAsset,
  getOwner3dPipelineVersions
} from "@/lib/owner/threeDArPipeline";

export const dynamic = "force-dynamic";

type RouteParams = {
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
};

export default async function Owner3dArDishPage({
  params
}: {
  params: Promise<RouteParams>;
}) {
  const { restaurantSlug, menuSlug, dishSlug } = await params;
  const owner = await getVistaireOwnerAuthorization();
  if (!owner.ok || !ownerCanAccess3dRestaurant(owner, restaurantSlug)) notFound();

  const asset = getOwner3dPipelineAsset({ restaurantSlug, menuSlug, dishSlug });
  const versions = getOwner3dPipelineVersions({ restaurantSlug, menuSlug, dishSlug });

  if (!asset) notFound();

  return (
    <>
      <ModuleHeader
        title={asset.dishName}
        description={`${asset.restaurantName} · ${menuSlug} · détail pipeline 3D/AR par version. Aucun modèle runtime n'est préchargé depuis cette route.`}
      />

      <Panel
        title={`${versions.length} version(s)`}
        action={<span className={styles.sourceTag}>Restaurant : {restaurantSlug}</span>}
      >
        <Owner3dArAssetWorklist assets={versions} />
      </Panel>

      <Owner3dArAssetDetail asset={asset} versions={versions} />
    </>
  );
}
