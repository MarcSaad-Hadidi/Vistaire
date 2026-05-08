import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DishDetail } from "@/components/dish/DishDetail";
import {
  getAllDishes,
  getDishBySlug,
  getRestaurant
} from "@/lib/demoMenuData";

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
    return { title: "Plat introuvable | Maison Élyse" };
  }
  return {
    title: `${dish.name} — ${restaurant.name}`,
    description: dish.shortDescription
  };
}

export default async function DishPage({ params }: PageProps) {
  const { slug } = await params;
  const dish = getDishBySlug(slug);
  if (!dish) {
    notFound();
  }

  return <DishDetail dish={dish} />;
}
