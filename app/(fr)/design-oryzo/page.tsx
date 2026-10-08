import type { Metadata } from "next";
import { OryzoHeader } from "@/components/design-concepts/oryzo/OryzoHeader";
import { OryzoHero } from "@/components/design-concepts/oryzo/OryzoHero";
import { OryzoManifesto } from "@/components/design-concepts/oryzo/OryzoManifesto";
import { OryzoDishes } from "@/components/design-concepts/oryzo/OryzoDishes";
import { OryzoExperiences } from "@/components/design-concepts/oryzo/OryzoExperiences";
import { OryzoHorizontal } from "@/components/design-concepts/oryzo/OryzoHorizontal";
import { OryzoSpecTable } from "@/components/design-concepts/oryzo/OryzoSpecTable";
import { OryzoTestimonials } from "@/components/design-concepts/oryzo/OryzoTestimonials";
import { OryzoOwner } from "@/components/design-concepts/oryzo/OryzoOwner";
import { OryzoFinalCta } from "@/components/design-concepts/oryzo/OryzoFinalCta";
import { OryzoFooter } from "@/components/design-concepts/oryzo/OryzoFooter";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Vistaire — Concept Oryzo",
  description:
    "Concept de page d’accueil Vistaire inspiré d’oryzo.ai — exploration design, page non indexée.",
  robots: {
    index: false,
    follow: false
  }
};

/**
 * Concept Oryzo — French Vistaire homepage design test inspired by oryzo.ai.
 * New files only; nothing existing is modified.
 */
export default function DesignOryzoPage(): React.JSX.Element {
  return (
    <div className={styles.page}>
      <OryzoHeader />
      <main className={styles.main}>
        <OryzoHero />
        <OryzoManifesto />
        <OryzoDishes />
        <OryzoExperiences />
        <OryzoHorizontal />
        <OryzoSpecTable />
        <OryzoTestimonials />
        <OryzoOwner />
        <OryzoFinalCta />
      </main>
      <OryzoFooter />
    </div>
  );
}
