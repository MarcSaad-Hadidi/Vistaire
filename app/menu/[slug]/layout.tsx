import type { Viewport } from "next";
import { SaugeNoireRouteThemeBridge } from "@/components/menu/SaugeNoireRouteThemeBridge";
import {
  SAUGE_NOIRE_PAPER,
  SAUGE_NOIRE_ROUTE_THEME
} from "@/lib/vistaireRouteTheme";

type MenuLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}>;

export const dynamic = "force-dynamic";

export async function generateViewport({
  params
}: Pick<MenuLayoutProps, "params">): Promise<Viewport> {
  const { slug } = await params;

  if (slug.toLowerCase() !== SAUGE_NOIRE_ROUTE_THEME) {
    return {};
  }

  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    themeColor: SAUGE_NOIRE_PAPER,
    colorScheme: "light"
  };
}

export default async function MenuLayout({
  children,
  params
}: MenuLayoutProps) {
  const { slug } = await params;
  const isSaugeNoire = slug.toLowerCase() === SAUGE_NOIRE_ROUTE_THEME;

  if (!isSaugeNoire) {
    return children;
  }

  return (
    <div
      data-vistaire-route-theme={SAUGE_NOIRE_ROUTE_THEME}
      style={{ display: "contents" }}
    >
      <SaugeNoireRouteThemeBridge />
      {children}
    </div>
  );
}
