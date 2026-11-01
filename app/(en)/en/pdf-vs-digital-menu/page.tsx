import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PdfMenuCinematic } from "@/components/immersive/pages/PdfMenuCinematic";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo";
import { buildSeoPillarJsonLd } from "@/lib/seoPillarJsonLd";
import { getSeoPage } from "@/lib/seoPages";

export const revalidate = 60;

const page = getSeoPage("menu-pdf-vs-menu-digital", "en");

export const metadata: Metadata = {
  title: {
    absolute: page.metadataTitle
  },
  description: page.metadataDescription,
  alternates: buildPageAlternates(page.path),
  openGraph: {
    url: absoluteUrl(page.path),
    title: page.metadataTitle,
    description: page.metadataDescription,
    locale: LOCALE_OPEN_GRAPH.en,
    type: "website",
    images: [
      {
        url: absoluteUrl(page.visualImage.src),
        alt: page.visualImage.alt
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: page.metadataTitle,
    description: page.metadataDescription,
    images: [absoluteUrl(page.visualImage.src)]
  }
};

export default function PdfVsDigitalMenuRouteEn() {
  return (
    <>
      <JsonLd data={buildSeoPillarJsonLd(page)} />
      <PdfMenuCinematic page={page} />
    </>
  );
}
