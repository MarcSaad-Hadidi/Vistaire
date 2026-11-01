import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireRendezVousPreview } from "@/components/vistaire-preview/VistaireRendezVousPreview";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { socialImages,
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildPageServiceJsonLd,
  buildWebPageJsonLd
} from "@/lib/seo";

const canonicalPath = "/en/book-a-call";
const title = "Book a call with Vistaire";
const description =
  "Plan a call with Vistaire to present your restaurant through a premium digital menu.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    images: socialImages("BOOK:panel", "en").openGraph,
    url: absoluteUrl(canonicalPath),
    title,
    description:
      "Tell us about your restaurant, your menu and the experience you want to offer.",
    locale: LOCALE_OPEN_GRAPH.en,
    type: "website"
  },
  twitter: {
    images: socialImages("BOOK:panel", "en").twitter,
    card: "summary_large_image",
    title,
    description:
      "Tell us about your restaurant, your menu and the experience you want to offer."
  }
};

export default function BookACallPageEn() {
  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            path: canonicalPath,
            name: title,
            description,
            locale: "en"
          }),
          buildPageServiceJsonLd({
            path: canonicalPath,
            name: "Vistaire call",
            serviceType: "Digital QR menu review for restaurants",
            description
          }),
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/en" },
            { name: "Book a call", path: canonicalPath }
          ])
        ]}
      />
      <VistaireRendezVousPreview locale="en" routeMode="production" />
    </>
  );
}
