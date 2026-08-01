import { VistaireLanding } from "@/components/landing/VistaireLanding";
import type { Locale } from "@/lib/i18n";
import type { VistaireRouteMode } from "./VistairePreviewChrome";

export function VistairePreviewLanding({
  locale = "fr",
  routeMode = "production"
}: {
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  return <VistaireLanding locale={locale} routeMode={routeMode} />;
}
