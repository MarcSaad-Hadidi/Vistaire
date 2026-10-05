import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { SeoInteractiveComparison } from "@/components/landing/SeoInteractiveComparison";
import { VistaireMenuDigitalRestaurantPreview } from "@/components/vistaire-preview/VistaireMenuDigitalRestaurantPreview";
import { VistaireSeoProductionSections } from "@/components/vistaire-preview/VistaireSeoProductionSections";
import { buildSeoPageMetadata } from "@/lib/seo";
import { buildSeoPillarJsonLd } from "@/lib/seoPillarJsonLd";
import { getSeoPage } from "@/lib/seoPages";

export const revalidate = 60;

const page = getSeoPage("menu-digital-restaurant");

export const metadata: Metadata = buildSeoPageMetadata(page);

export default function MenuDigitalRestaurantRoute() {
  return (
    <>
      <JsonLd data={buildSeoPillarJsonLd(page)} />
      <VistaireMenuDigitalRestaurantPreview
        h1={page.h1}
        interactiveShowcase={
          <SeoInteractiveComparison locale="fr" interaction="reveal" />
        }
        seoAppendix={<VistaireSeoProductionSections page={page} />}
      />
    </>
  );
}
