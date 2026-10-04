import { VistaireLanding } from "@/components/landing/VistaireLanding";
import type { Locale } from "@/lib/i18n";

export function VistairePreviewLanding({
  locale = "fr",
}: {
  locale?: Locale;
}) {
  return <VistaireLanding locale={locale} />;
}
