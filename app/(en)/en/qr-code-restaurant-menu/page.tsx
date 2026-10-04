import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireMenuQrCodeRestaurantPreview } from "@/components/vistaire-preview/VistaireMenuQrCodeRestaurantPreview";
import { VistaireSeoProductionSections } from "@/components/vistaire-preview/VistaireSeoProductionSections";
import { buildSeoPageMetadata } from "@/lib/seo";
import { buildSeoPillarJsonLd } from "@/lib/seoPillarJsonLd";
import { getSeoPage } from "@/lib/seoPages";

const page = getSeoPage("menu-qr-code-restaurant", "en");

export const metadata: Metadata = buildSeoPageMetadata(page);

export default function QrCodeRestaurantMenuRouteEn() {
  return (
    <>
      <JsonLd data={buildSeoPillarJsonLd(page)} />
      <VistaireMenuQrCodeRestaurantPreview
        h1={page.h1}
        locale="en"
        seoAppendix={<VistaireSeoProductionSections page={page} />}
      />
    </>
  );
}
