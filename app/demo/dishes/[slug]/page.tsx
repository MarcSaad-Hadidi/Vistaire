import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { VistaireDishDetailPreview } from "@/components/vistaire-preview/VistaireDishDetailPreview";
import {
  getAllDishes,
  getCategoryBySlug,
  getDishBySlug,
  getRestaurant
} from "@/lib/demoMenuData";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl, buildBreadcrumbJsonLd } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams(): { slug: string }[] {
  return getAllDishes().map((dish) => ({ slug: dish.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const dish = getDishBySlug(slug);
  const restaurant = getRestaurant();
  if (!dish) {
    return {
      title: "Plat introuvable | Menu client exemple",
      robots: {
        index: false,
        follow: false
      }
    };
  }
  const canonicalPath = `/demo/dishes/${dish.slug}`;
  const title = `${dish.name} | fiche plat de démonstration`;
  const pageTitle = `${title} | Vistaire`;
  const description = `Fiche plat exemple Vistaire pour ${restaurant.name}, restaurant de présentation : ${dish.shortDescription}`;
  const imageUrl = dish.image ? absoluteUrl(dish.image) : undefined;

  return {
    title: {
      absolute: pageTitle
    },
    description,
    alternates: buildPageAlternates(canonicalPath),
    robots: {
      index: false,
      follow: true
    },
    openGraph: {
      url: absoluteUrl(canonicalPath),
      title: pageTitle,
      description,
      locale: LOCALE_OPEN_GRAPH.fr,
      type: "website",
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: `${dish.name} | fiche plat exemple Vistaire`
            }
          ]
        : undefined
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: pageTitle,
      description,
      images: imageUrl ? [imageUrl] : undefined
    }
  };
}

export default async function DishPage({ params }: PageProps) {
  const { slug } = await params;
  const dish = getDishBySlug(slug);
  if (!dish) {
    notFound();
  }
  const restaurant = getRestaurant();
  const categoryName =
    getCategoryBySlug(dish.categorySlug)?.name ?? "Création Maison Élyse";

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Menu client exemple", path: "/demo" },
          { name: dish.name, path: `/demo/dishes/${dish.slug}` }
        ])}
      />
      <VistaireDishDetailPreview
        categoryName={categoryName}
        dish={dish}
        restaurant={restaurant}
        routeMode="production"
      />
    </>
  );
}
