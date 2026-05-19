import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { DishDetail } from "@/components/dish/DishDetail";
import {
  getAllDishes,
  getDishBySlug,
  getRestaurant
} from "@/lib/demoMenuData";
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
      title: "Plat introuvable — Menu client exemple",
      robots: {
        index: false,
        follow: false
      }
    };
  }
  const canonicalPath = `/demo/dishes/${dish.slug}`;
  const title = `${dish.name} — fiche plat de démonstration`;
  const pageTitle = `${title} | Vistaire`;
  const description = `Fiche plat exemple Vistaire pour ${restaurant.name}, restaurant de présentation : ${dish.shortDescription}`;
  const imageUrl = dish.image ? absoluteUrl(dish.image) : undefined;

  return {
    title: {
      absolute: pageTitle
    },
    description,
    alternates: {
      canonical: canonicalPath
    },
    robots: {
      index: dish.isAvailable,
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
              alt: `${dish.name} — fiche plat exemple Vistaire`
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

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Menu client exemple", path: "/demo" },
          { name: dish.name, path: `/demo/dishes/${dish.slug}` }
        ])}
      />
      <DishDetail dish={dish} />
    </>
  );
}
