import type { Metadata } from "next";
import { ModelLabClient } from "@/components/owner/model-lab/ModelLabClient";
import { ModuleHeader } from "@/components/owner/OwnerUi";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Model Lab - Vistaire Owner",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true
  }
};

export default function OwnerModelLabPage() {
  return (
    <>
      <ModuleHeader
        title="Model Lab"
        description="Optimisez un GLB localement, comparez le rendu avant/apres sans stockage Vistaire, puis utilisez le pipeline 3D / AR existant pour USDZ ou Quick Look."
      />
      <ModelLabClient />
    </>
  );
}
