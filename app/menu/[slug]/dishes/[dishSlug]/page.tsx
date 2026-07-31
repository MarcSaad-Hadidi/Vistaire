import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MaisonElyseDishDetail } from "@/components/menu/MaisonElyseDishDetail";
import { PublicDishDetailExperience } from "@/components/menu/PublicDishDetailExperience";
import { TrouvableDishDetailExperience } from "@/components/menu/TrouvableDishDetailExperience";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { getPublicMenuDishBySlug } from "@/lib/menu/publicMenuCore";
import { resolvePublicMenuRenderContext } from "@/lib/menu/publicMenuRenderContext";
import { trouvableTypographyClassName } from "../../trouvableTypography";

export const dynamic = "force-dynamic";

type PublicDishPageProps = {
  params: Promise<{ slug: string; dishSlug: string }>;
  searchParams: Promise<{
    lang?: string;
    currency?: string;
    table?: string;
    zone?: string;
    view?: string;
  }>;
};

export async function generateMetadata({
  params,
  searchParams
}: PublicDishPageProps): Promise<Metadata> {
  const { slug, dishSlug } = await params;
  const query = await searchParams;
  const hasLangParam =
    typeof query.lang === "string" && query.lang.trim().length > 0;
  const menu = await getPublicMenuBySlug(
    slug,
    hasLangParam ? query.lang : undefined
  );
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
  const renderContext = await resolvePublicMenuRenderContext({ slug, query });

  if (!renderContext) {
    notFound();
  }

  const {
    menu,
    config,
    context,
    query: menuQuery,
    locale,
    exchangeRates,
    experience
  } = renderContext;
  const dish = getPublicMenuDishBySlug(menu, dishSlug);

  if (!dish) {
    notFound();
  }

  if (experience.kind === "maison-elyse") {
    return (
      <MaisonElyseDishDetail
        dish={dish}
        locale={locale}
        menu={menu}
        query={menuQuery}
        config={config}
      />
    );
  }

  if (experience.kind === "trouvable") {
    return (
      <TrouvableDishDetailExperience
        config={config}
        context={context}
        dish={dish}
        exchangeRates={exchangeRates}
        menu={menu}
        query={menuQuery}
        typographyClassName={trouvableTypographyClassName}
      />
    );
  }

  if (experience.kind === "unique-registered" && experience.renderer) {
    const UniqueDishDetail = experience.renderer.dishDetail;

    return (
      <UniqueDishDetail
        menu={menu}
        config={config}
        context={context}
        query={menuQuery}
        locale={locale}
        exchangeRates={exchangeRates}
        dish={dish}
        mode="public"
      />
    );
  }

  return (
    <PublicDishDetailExperience
      config={config}
      context={context}
      dish={dish}
      locale={locale}
      menu={menu}
      query={menuQuery}
    />
  );
}
