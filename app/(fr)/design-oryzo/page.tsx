import type { Metadata } from "next";
import { OryzoHeader } from "@/components/design-concepts/oryzo/OryzoHeader";
import { OryzoHero } from "@/components/design-concepts/oryzo/OryzoHero";
import { OryzoCoaster } from "@/components/design-concepts/oryzo/OryzoCoaster";
import { OryzoAi } from "@/components/design-concepts/oryzo/OryzoAi";
import { OryzoWearable } from "@/components/design-concepts/oryzo/OryzoWearable";
import { OryzoFeatures } from "@/components/design-concepts/oryzo/OryzoFeatures";
import { OryzoProduct } from "@/components/design-concepts/oryzo/OryzoProduct";
import { OryzoBadges } from "@/components/design-concepts/oryzo/OryzoBadges";
import { OryzoSota } from "@/components/design-concepts/oryzo/OryzoSota";
import { OryzoFinalCta } from "@/components/design-concepts/oryzo/OryzoFinalCta";
import { OryzoFooter } from "@/components/design-concepts/oryzo/OryzoFooter";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Vistaire — Concept Oryzo",
  description:
    "Concept de page d'accueil Vistaire fidèle à oryzo.ai — exploration design, page non indexée.",
  robots: {
    index: false,
    follow: false
  }
};

/**
 * Concept Oryzo — pixel-faithful rebuild of oryzo.ai's page structure,
 * with Vistaire content swapped in. New files only; nothing existing modified.
 */
export default function DesignOryzoPage(): React.JSX.Element {
  return (
    <div className={styles.page}>
      <OryzoHeader />
      <main className={styles.main}>
        <OryzoHero />
        <OryzoCoaster />
        <OryzoAi />
        <OryzoWearable />
        <OryzoFeatures />
        <OryzoProduct />
        <OryzoBadges />
        <OryzoSota />
        <OryzoFinalCta />
      </main>
      <OryzoFooter />
    </div>
  );
}
