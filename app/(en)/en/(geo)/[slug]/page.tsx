import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { SeoGeoAeoPage } from "@/components/seo/SeoGeoAeoPage";
import { buildSeoPageMetadata } from "@/lib/seo";
import { buildSeoGeoAeoJsonLd } from "@/lib/seoGeoJsonLd";
import { getSeoGeoPage } from "@/lib/seoGeoPages";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoGeoPage(slug, "en");

  if (!page) {
    return {
      title: "Page not found | Vistaire",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  return buildSeoPageMetadata(page);
}

export default async function SeoGeoAeoEnglishRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = getSeoGeoPage(slug, "en");

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
