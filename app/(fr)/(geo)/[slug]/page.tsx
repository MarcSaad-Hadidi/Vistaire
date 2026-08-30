import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { SeoGeoAeoPage } from "@/components/seo/SeoGeoAeoPage";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo";
import { buildSeoGeoAeoJsonLd } from "@/lib/seoGeoJsonLd";
import { getSeoGeoPage } from "@/lib/seoGeoPages";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoGeoPage(slug);

  if (!page) {
    return {
      title: "Page introuvable | Vistaire",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  return {
    title: {
      absolute: page.metadataTitle
    },
    description: page.metadataDescription,
    alternates: buildPageAlternates(page.path),
    openGraph: {
      url: absoluteUrl(page.path),
      title: page.metadataTitle,
      description: page.metadataDescription,
      locale: LOCALE_OPEN_GRAPH.fr,
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
}

export default async function SeoGeoAeoRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = getSeoGeoPage(slug);

  if (!page) {
    notFound();
  }

  return (
    <>
      <JsonLd data={buildSeoGeoAeoJsonLd(page)} />
      <SeoGeoAeoPage page={page} />
    </>
  );
}
