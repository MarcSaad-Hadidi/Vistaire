import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { SeoInteractiveComparison } from "@/components/landing/SeoInteractiveComparison";
import { VistairePdfVsMenuDigitalPreview } from "@/components/vistaire-preview/VistairePdfVsMenuDigitalPreview";
import { VistaireSeoProductionSections } from "@/components/vistaire-preview/VistaireSeoProductionSections";
import { buildSeoPageMetadata } from "@/lib/seo";
import { buildSeoPillarJsonLd } from "@/lib/seoPillarJsonLd";
import { getSeoPage } from "@/lib/seoPages";

export const revalidate = 60;

const page = getSeoPage("menu-pdf-vs-menu-digital", "en");

export const metadata: Metadata = buildSeoPageMetadata(page);

export default function PdfVsDigitalMenuRouteEn() {
  return (
    <>
      <JsonLd data={buildSeoPillarJsonLd(page)} />
      <VistairePdfVsMenuDigitalPreview
        h1={page.h1}
        interactiveShowcase={
          <SeoInteractiveComparison
            deviceEmphasis
            locale="en"
            interaction="slider"
          />
        }
        locale="en"
        seoAppendix={<VistaireSeoProductionSections page={page} />}
      />
    </>
  );
}
