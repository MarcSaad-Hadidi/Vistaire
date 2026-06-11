import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MaisonElyseQrMenu } from "@/components/menu/MaisonElyseQrMenu";
import { PublicMenuRenderer } from "@/components/menu/PublicMenuRenderer";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { menuUiConfigForRestaurant } from "@/lib/menu/menuUiConfig";
import { getPublishedMenuUiConfigForRestaurant } from "@/lib/owner/menuUiConfigStore";

export const dynamic = "force-dynamic";

type MenuPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string; view?: string; zone?: string }>;
};

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function PublicMenuPage({
  params,
  searchParams
}: MenuPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const menu = await getPublicMenuBySlug(slug);

  if (!menu) {
    notFound();
  }

  const context = [
    query.table ? `Table ${query.table}` : "",
    query.zone ? `Zone ${query.zone}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const fallbackConfig = menuUiConfigForRestaurant({
    name: menu.name,
    slug: menu.slug
  });
  const configRecord = await getPublishedMenuUiConfigForRestaurant(
    menu.restaurantId,
    fallbackConfig
  );

  if (menu.slug === "maison-elyse") {
    return (
      <MaisonElyseQrMenu
        menu={menu}
        context={context}
        query={query}
        startFullMenu={query.view === "carte"}
      />
    );
  }

  return (
    <PublicMenuRenderer
      menu={menu}
      config={configRecord.config}
      context={context}
      query={query}
      mode="public"
      disableHeavyAssets={false}
    />
  );
}
