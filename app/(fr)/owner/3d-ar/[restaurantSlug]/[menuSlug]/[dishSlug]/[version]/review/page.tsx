import { notFound } from "next/navigation";
import { Owner3dVisualReviewPanel } from "@/components/owner/Owner3dVisualReviewPanel";
import { ModuleHeader } from "@/components/owner/OwnerUi";
import { getVistaireOwnerAuthorization } from "@/lib/auth/owner";
import { ownerCanAccess3dRestaurant } from "@/lib/auth/owner3dAccess";
import { getOwner3dVisualReview } from "@/lib/owner/threeDVisualReviewServer";

export const dynamic = "force-dynamic";

type RouteParams = {
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
  version: string;
};

export default async function Owner3dArVisualReviewPage({
  params
}: {
  params: Promise<RouteParams>;
}) {
  const { restaurantSlug, menuSlug, dishSlug, version } = await params;
  const owner = await getVistaireOwnerAuthorization();
  if (!owner.ok || !ownerCanAccess3dRestaurant(owner, restaurantSlug)) notFound();

  const review = getOwner3dVisualReview({
    restaurantSlug,
    menuSlug,
    dishSlug,
    version
  });

  if (!review) notFound();

  return (
    <>
      <ModuleHeader
        title={`${review.dishName} visual review`}
        description="Compare source and selected candidate, inspect rendered evidence, then approve or reject visual quality without finalizing or publishing."
      />

      <Owner3dVisualReviewPanel review={review} />
    </>
  );
}
