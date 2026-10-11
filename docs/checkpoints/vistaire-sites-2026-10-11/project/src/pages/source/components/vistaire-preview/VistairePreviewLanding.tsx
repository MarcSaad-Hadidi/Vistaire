import { VistaireLanding } from "../landing/VistaireLanding.tsx";
import type { Locale } from "../../lib/i18n.ts";
import type { VistaireRouteMode } from "./VistairePreviewChrome.tsx";

export function VistairePreviewLanding({
  locale = "fr",
  routeMode = "production",
}: {
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  return <VistaireLanding locale={locale} routeMode={routeMode} />;
}
