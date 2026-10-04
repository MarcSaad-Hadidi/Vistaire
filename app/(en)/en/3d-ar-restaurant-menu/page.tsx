import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireMenu3dArRestaurantPreview } from "@/components/vistaire-preview/VistaireMenu3dArRestaurantPreview";
import { VistaireSeoProductionSections } from "@/components/vistaire-preview/VistaireSeoProductionSections";
import { buildSeoPageMetadata } from "@/lib/seo";
import { buildSeoPillarJsonLd } from "@/lib/seoPillarJsonLd";
import { getSeoPage } from "@/lib/seoPages";

const page = getSeoPage("menu-3d-ar-restaurant", "en");

export const metadata: Metadata = buildSeoPageMetadata(page);

export default function ThreeDArRestaurantMenuRouteEn() {
  return (
    <>
      <JsonLd data={buildSeoPillarJsonLd(page)} />
      <VistaireMenu3dArRestaurantPreview
        h1={page.h1}
        locale="en"
        seoAppendix={<VistaireSeoProductionSections page={page} />}
      />
    </>
  );
}
