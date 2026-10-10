import Link from "next/link";
import type { ComponentType } from "react";
import { SEO_GEO_ROUTE_PAIRS } from "@/lib/seoGeoRoutes";
import type { SeoGeoPageData } from "@/lib/seoGeoPages";
import { buildSeoGeoPublicFaq } from "@/lib/seoGeoPublicText";
import { PreviewFooter, PreviewNav } from "../vistaire-preview/VistairePreviewChrome";
import { SeoFaq } from "./SeoFaq";
import { GeoActions, geoText, type GeoExperienceProps } from "./SeoGeoExperiencePrimitives";
import {
  AllergensExperience, AppFreeExperience, DishPageExperience, MenuPhotosExperience,
  PdfAlternativeExperience, QrWithoutPdfExperience, ReplacePdfExperience,
} from "./SeoNeedExperiences";
import {
  BrossardExperience, GastronomyExperience, HighEndExperience, LavalExperience, MontrealExperience,
} from "./SeoAudienceExperiences";
import styles from "./SeoGeoExperiences.module.css";

const EXPERIENCES: Record<string, { group: string; Component: ComponentType<GeoExperienceProps> }> = {
  "/menu-qr-sans-pdf": { group: "G1", Component: QrWithoutPdfExperience },
  "/menu-digital-sans-application": { group: "G2", Component: AppFreeExperience },
  "/remplacer-menu-pdf-restaurant": { group: "G3", Component: ReplacePdfExperience },
  "/alternative-menu-pdf-restaurant": { group: "G4", Component: PdfAlternativeExperience },
  "/fiche-plat-digitale-restaurant": { group: "G5", Component: DishPageExperience },
  "/menu-restaurant-photos": { group: "G6", Component: MenuPhotosExperience },
  "/menu-restaurant-allergenes": { group: "G7", Component: AllergensExperience },
  "/menu-digital-restaurant-montreal": { group: "G8", Component: MontrealExperience },
  "/menu-digital-restaurant-laval": { group: "G9", Component: LavalExperience },
  "/menu-digital-restaurant-brossard": { group: "G10", Component: BrossardExperience },
  "/menu-digital-restaurant-haut-de-gamme": { group: "G11", Component: HighEndExperience },
  "/menu-digital-restaurant-gastronomique": { group: "G12", Component: GastronomyExperience },
};

export function SeoGeoAeoPage({ page }: { page: SeoGeoPageData }) {
  const locale = page.locale ?? "fr";
  const en = locale === "en";
  const pair = SEO_GEO_ROUTE_PAIRS.find((route) => route.fr === page.path || route.en === page.path);
  const experience = EXPERIENCES[pair?.fr ?? page.path];
  if (!experience) throw new Error(`Missing restaurant page composition: ${page.path}`);
  const { Component, group } = experience;
  const links = page.relatedLinks.filter((link, index, all) => all.findIndex((item) => item.href === link.href) === index);

  return <main className={styles.page} data-public-vistaire>
    <div className={styles.navShell}><PreviewNav currentPath={page.path} locale={locale} routeMode="production" /></div>
    <div className={styles.content}>
      <Component page={page} group={group} />
      <section className={styles.reference} aria-labelledby={`${page.slug}-faq-title`}>
        <div><p className={styles.eyebrow}>{en ? "Your questions" : "Vos questions"}</p><h2 id={`${page.slug}-faq-title`}>{en ? "Common restaurant questions" : "Questions fréquentes des restaurateurs"}</h2></div>
        <SeoFaq faqs={buildSeoGeoPublicFaq(page)} layout="stack" locale={locale} />
      </section>
      <section className={styles.finale} aria-labelledby={`${page.slug}-final-title`}>
        <p className={styles.eyebrow}>{en ? "The next chapter" : "La suite, ensemble"}</p>
        <h2 id={`${page.slug}-final-title`}>{en ? "A menu that feels like your restaurant." : "Une carte à l’image de votre restaurant."}</h2>
        <GeoActions page={page} />
        <nav className={styles.related} aria-label={en ? "Related restaurant guides" : "Guides pour votre restaurant"}>
          {links.map((link) => <Link href={link.href} key={link.href} prefetch={false}>{geoText(page, link.label)}</Link>)}
        </nav>
      </section>
    </div>
    <PreviewFooter currentPath={page.path} locale={locale} routeMode="production" width="wide" />
  </main>;
}
