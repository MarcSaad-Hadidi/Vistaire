import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import styles from "./AdminInsights.module.css";

export function InsightsConversionState({ locale }: { locale: AdminLocale }) {
  const fr = locale === "fr";
  return <div className={styles.conversionState} data-evidence-state="unmeasured"><div aria-hidden="true"><span/><span/><span/></div><strong>{fr ? "Funnel non mesuré" : "Funnel unmeasured"}</strong><p>{fr ? "Vistaire ne déduit ni ajout au panier, ni choix final, ni vente depuis des ouvertures de menu." : "Vistaire does not infer cart additions, final choices or sales from menu opens."}</p></div>;
}
