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
        description="Inspectez un GLB localement, generez un candidat optimise, puis comparez source et sortie sans stockage Vistaire."
      />
      <ModelLabClient />
    </>
  );
}
