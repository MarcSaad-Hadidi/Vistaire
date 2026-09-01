import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MaisonElyseQrMenu } from "@/components/menu/MaisonElyseQrMenu";
import { PublicMenuRenderer } from "@/components/menu/PublicMenuRenderer";
import { TrouvablePremiumMenuExperience } from "@/components/menu/TrouvablePremiumMenuExperience";
import { resolvePublicMenuRenderContext } from "@/lib/menu/publicMenuRenderContext";
import { trouvableTypographyClassName } from "./trouvableTypography";

export const dynamic = "force-dynamic";

type MenuPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    lang?: string;
    currency?: string;
    table?: string;
    view?: string;
    zone?: string;
  }>;
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
  const renderContext = await resolvePublicMenuRenderContext({ slug, query });

  if (!renderContext) {
    notFound();
  }

  const {
    config,
    context,
    exchangeRates,
    experience,
    locale,
    publicLocale,
    localizedMenus,
    menu,
    query: menuQuery
  } = renderContext;

  if (experience.kind === "maison-elyse") {
    return (
      <MaisonElyseQrMenu
        menu={menu}
        config={config}
        exchangeRates={exchangeRates}
        locale={publicLocale}
        localizedMenus={localizedMenus}
        context={context}
        query={menuQuery}
      />
    );
  }

  if (experience.kind === "trouvable") {
    return (
      <TrouvablePremiumMenuExperience
        menu={menu}
        config={config}
        context={context}
        exchangeRates={exchangeRates}
        query={menuQuery}
        typographyClassName={trouvableTypographyClassName}
      />
    );
  }

  if (experience.kind === "unique-registered" && experience.renderer) {
    const UniqueMenu = experience.renderer.menu;
    return (
      <UniqueMenu
        menu={menu}
        config={config}
        context={context}
        exchangeRates={exchangeRates}
        query={menuQuery}
        locale={locale}
        mode="public"
      />
    );
  }

  return (
    <PublicMenuRenderer
      menu={menu}
      config={config}
      context={context}
      query={menuQuery}
      mode="public"
      disableHeavyAssets={false}
      locale={locale}
    />
  );
}
