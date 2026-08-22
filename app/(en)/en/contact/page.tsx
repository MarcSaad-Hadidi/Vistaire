import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireContactPreview } from "@/components/vistaire-preview/VistaireContactPreview";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildContactPageJsonLd
} from "@/lib/seo";

const canonicalPath = "/en/contact";
const title = "Contact Vistaire";
const description =
  "Contact Vistaire to create a premium digital menu for a high-end restaurant.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    url: absoluteUrl(canonicalPath),
    title,
    description:
      "Talk to Vistaire about your menu, dish pages and mobile experience.",
    locale: LOCALE_OPEN_GRAPH.en,
    type: "website"
  },
  twitter: {
    card: "summary",
    title,
    description:
      "Talk to Vistaire about your menu, dish pages and mobile experience."
  }
};

export default function ContactPageEn() {
  return (
    <>
      <JsonLd
        data={[
          buildContactPageJsonLd({
            path: canonicalPath,
            name: title,
            description,
            locale: "en"
          }),
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/en" },
            { name: "Contact", path: canonicalPath }
          ])
        ]}
      />
      <VistaireContactPreview locale="en" routeMode="production" />
    </>
  );
}
