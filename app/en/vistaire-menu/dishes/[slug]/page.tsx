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
import { buildPageAlternates } from "@/lib/i18n";
import { absoluteUrl, buildBreadcrumbJsonLd } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams(): { slug: string }[] {
  return getAllDishes("en").map((dish) => ({ slug: dish.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const dish = getDishBySlug(slug, "en");
  const restaurant = getRestaurant("en");

  if (!dish) {
    return {
      title: "Dish not found | Sample client menu",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const canonicalPath = `/en/vistaire-menu/dishes/${dish.slug}`;
  const title = `${dish.name} | sample dish page`;
  const pageTitle = `${title} | Vistaire`;
  const description = `Sample Vistaire dish page for ${restaurant.name}: ${dish.shortDescription}`;
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
      type: "website",
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: `${dish.name} | sample Vistaire dish page`
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

export default async function DishPageEn({ params }: PageProps) {
  const { slug } = await params;
  const dish = getDishBySlug(slug, "en");
  if (!dish) {
    notFound();
  }
  const restaurant = getRestaurant("en");
  const categoryName =
    getCategoryBySlug(dish.categorySlug, "en")?.name ?? "Maison Élyse creation";

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/en" },
          { name: "Sample client menu", path: "/en/vistaire-menu" },
          { name: dish.name, path: `/en/vistaire-menu/dishes/${dish.slug}` }
        ])}
      />
      <VistaireDishDetailPreview
        categoryName={categoryName}
        dish={dish}
        locale="en"
        restaurant={restaurant}
        routeMode="production"
      />
    </>
  );
}
