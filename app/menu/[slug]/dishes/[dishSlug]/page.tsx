import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicDishDetailExperience } from "@/components/menu/PublicDishDetailExperience";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { getPublicMenuDishBySlug } from "@/lib/menu/publicMenuCore";

export const dynamic = "force-dynamic";

type PublicDishPageProps = {
  params: Promise<{ slug: string; dishSlug: string }>;
  searchParams: Promise<{ table?: string; zone?: string }>;
};

export async function generateMetadata({
  params
}: PublicDishPageProps): Promise<Metadata> {
  const { slug, dishSlug } = await params;
  const menu = await getPublicMenuBySlug(slug);
  const dish = menu ? getPublicMenuDishBySlug(menu, dishSlug) : null;

  if (!menu || !dish) {
    return {
      title: "Plat introuvable | Menu Vistaire",
      robots: { index: false, follow: false }
    };
  }

  return {
    title: `${dish.name} | ${menu.name}`,
    description: dish.description || `${dish.name}, ${dish.category}`,
    robots: { index: false, follow: true }
  };
}

export default async function PublicDishPage({
  params,
  searchParams
}: PublicDishPageProps) {
  const { slug, dishSlug } = await params;
  const query = await searchParams;
  const menu = await getPublicMenuBySlug(slug);

  if (!menu) {
    notFound();
  }

  const dish = getPublicMenuDishBySlug(menu, dishSlug);
  if (!dish) {
    notFound();
  }

  const context = [
    query.table ? `Table ${query.table}` : "",
    query.zone ? `Zone ${query.zone}` : ""
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PublicDishDetailExperience
      context={context}
      dish={dish}
      menu={menu}
      query={query}
    />
  );
}
