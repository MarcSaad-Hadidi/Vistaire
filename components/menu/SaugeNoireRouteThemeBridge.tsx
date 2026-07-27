"use client";

import { useEffect } from "react";
import { SAUGE_NOIRE_ROUTE_THEME } from "@/lib/vistaireRouteTheme";

const routeThemeAttribute = "data-vistaire-route-theme";

export function SaugeNoireRouteThemeBridge() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.setAttribute(routeThemeAttribute, SAUGE_NOIRE_ROUTE_THEME);
    body.setAttribute(routeThemeAttribute, SAUGE_NOIRE_ROUTE_THEME);

    return () => {
      root.removeAttribute(routeThemeAttribute);
      body.removeAttribute(routeThemeAttribute);
    };
  }, []);

  return null;
}
