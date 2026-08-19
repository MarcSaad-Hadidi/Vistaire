import { notFound } from "next/navigation";
import { Owner3dArAssetDetail } from "@/components/owner/Owner3dArPipeline";
import { ModuleHeader } from "@/components/owner/OwnerUi";
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
  version: string;
};

export default async function Owner3dArVersionPage({
  params
}: {
  params: Promise<RouteParams>;
}) {
  const { restaurantSlug, menuSlug, dishSlug, version } = await params;
  const owner = await getVistaireOwnerAuthorization();
  if (!owner.ok || !ownerCanAccess3dRestaurant(owner, restaurantSlug)) notFound();

  const asset = getOwner3dPipelineAsset({
    restaurantSlug,
    menuSlug,
    dishSlug,
    version
  });
  const versions = getOwner3dPipelineVersions({ restaurantSlug, menuSlug, dishSlug });

  if (!asset) notFound();

  return (
    <>
      <ModuleHeader
        title={`${asset.dishName} · ${asset.version}`}
        description="Version pipeline : source analysis, candidate report, visual quality, device QA, CDN et publish status. Les actions restent non exécutées depuis l'UI."
      />

      <Owner3dArAssetDetail asset={asset} versions={versions} />
    </>
  );
}
