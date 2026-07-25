import { notFound } from "next/navigation";
import { getExchangeRates } from "@/lib/currency/exchangeRates";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import {
  normalizePublicMenuLocalePreference,
  publicLocaleToShortLocale
} from "@/lib/menu/publicMenuSettings";
import { menuUiConfigForRestaurant } from "@/lib/menu/menuUiConfig";
import { resolvePublicMenuUiConfig } from "@/lib/menu/trouvableMenuExperience";
import { getUniqueMenuRendererForDesign } from "@/lib/menu/uniqueMenuRendererRegistry";
import { getPublishedMenuUiConfigForRestaurant } from "@/lib/owner/menuUiConfigStore";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getUniqueMenuDesignSnapshot } from "@/lib/owner/uniqueMenuDesignStore";

export const dynamic = "force-dynamic";

type UniqueMenuPreviewPageProps = {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{
    lang?: string;
    currency?: string;
    view?: string;
  }>;
};

/**
 * Owner-only, read-only preview for a renderer that is still pending.
 * It validates the live designId against the static registry but never
 * advances the unique-design lifecycle or changes the public route.
 */
export default async function UniqueMenuPreviewPage({
  params,
  searchParams
}: UniqueMenuPreviewPageProps) {
  const [{ restaurantId }, query] = await Promise.all([params, searchParams]);
  const dashboard = await getOwnerRestaurantDashboardData(restaurantId);
  if (!dashboard.restaurant) notFound();

  const restaurant = dashboard.restaurant;
  const menu = await getPublicMenuBySlug(restaurant.slug, query.lang);
  if (!menu) notFound();

  const snapshot = await getUniqueMenuDesignSnapshot(restaurant.id);
  if (!snapshot.ok || !snapshot.uniqueDesign) notFound();

  const rendererMeta = snapshot.availableRenderers[0];
  const renderer = rendererMeta
    ? getUniqueMenuRendererForDesign(
        snapshot.uniqueDesign.designId,
        rendererMeta.key
      )
    : null;
  if (!renderer) notFound();

  const activePublicLocale = normalizePublicMenuLocalePreference(
    query.lang,
    menu.settings
  );
  const configRecord = await getPublishedMenuUiConfigForRestaurant(
    restaurant.id,
    menuUiConfigForRestaurant({ name: menu.name, slug: menu.slug })
  );
  const config = resolvePublicMenuUiConfig(menu, configRecord.config);
  const exchangeRates = await getExchangeRates({
    baseCurrency: menu.settings.baseCurrency,
    supportedCurrencies: menu.settings.supportedCurrencies
  });
  const UniqueMenu = renderer.menu;

  return (
    <UniqueMenu
      menu={menu}
      config={config}
      exchangeRates={exchangeRates}
      query={{
        lang: activePublicLocale,
        currency: query.currency,
        view: query.view
      }}
      locale={publicLocaleToShortLocale(activePublicLocale)}
      mode="builder-preview"
    />
  );
}
