import { useEffect } from "react";
import { VistaireAboutPreview } from "./source/components/vistaire-preview/VistaireAboutPreview.tsx";
import { VistaireContactPreview } from "./source/components/vistaire-preview/VistaireContactPreview.tsx";
import { VistaireRendezVousPreview } from "./source/components/vistaire-preview/VistaireRendezVousPreview.tsx";
import { VistairePricingPreview } from "./source/components/vistaire-preview/VistairePricingPreview.tsx";
import { VistaireRestaurateurDashboardPreview } from "./source/components/vistaire-preview/VistaireRestaurateurDashboardPreview.tsx";
import { RestaurantExperiences } from "./source/components/vistaire-preview/RestaurantExperiences.tsx";
import { VistairePreviewLanding } from "./source/components/vistaire-preview/VistairePreviewLanding.tsx";
import { VistaireMenuDigitalRestaurantPreview } from "./source/components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.tsx";
import { VistaireMenuQrCodeRestaurantPreview } from "./source/components/vistaire-preview/VistaireMenuQrCodeRestaurantPreview.tsx";
import { VistaireMenu3dArRestaurantPreview } from "./source/components/vistaire-preview/VistaireMenu3dArRestaurantPreview.tsx";
import { VistairePdfVsMenuDigitalPreview } from "./source/components/vistaire-preview/VistairePdfVsMenuDigitalPreview.tsx";
import { VistaireSeoProductionSections } from "./source/components/vistaire-preview/VistaireSeoProductionSections.tsx";
import { VistaireEditorialGuide } from "./source/components/guides/VistaireEditorialGuide.tsx";
import { SeoGeoAeoPage } from "./source/components/seo/SeoGeoAeoPage.tsx";
import { LandingComparison } from "./source/components/landing/comparison/LandingComparison.tsx";
import { getLandingExperiences } from "./source/lib/landing/menuExperiences.ts";
import { getLandingCopy } from "./source/lib/landing/landingCopy.ts";
import { getSeoPage } from "./source/lib/seoPages.ts";
import { getEditorialGuideByPath } from "./source/lib/editorialGuides.ts";
import { getSeoGeoPage } from "./source/lib/seoGeoPages.ts";
import { BILINGUAL_ROUTE_PAIRS, normalizePathname } from "./source/lib/i18n.ts";
import { MENU_QR_SVGS } from "./qrCodes.js";
import "./public-pages.css";

export const publicPagePaths = [
  ...new Set(BILINGUAL_ROUTE_PAIRS.flatMap((pair) => [pair.fr, pair.en])),
].filter((path) => path !== "/");
export function hasPublicPage(pathname) {
  return publicPagePaths.includes(normalizePathname(pathname));
}

const simpleRoutes = {
  "/a-propos": VistaireAboutPreview,
  "/en/about": VistaireAboutPreview,
  "/contact": VistaireContactPreview,
  "/en/contact": VistaireContactPreview,
  "/prendre-rendez-vous": VistaireRendezVousPreview,
  "/en/book-a-call": VistaireRendezVousPreview,
  "/tarifs-menu-digital-restaurant": VistairePricingPreview,
  "/en/pricing-digital-restaurant-menu": VistairePricingPreview,
  "/en": VistairePreviewLanding,
};
const seoRoutes = {
  "/menu-digital-restaurant": [
    "menu-digital-restaurant",
    VistaireMenuDigitalRestaurantPreview,
    "reveal",
  ],
  "/en/digital-restaurant-menu": [
    "menu-digital-restaurant",
    VistaireMenuDigitalRestaurantPreview,
    "reveal",
  ],
  "/menu-qr-code-restaurant": [
    "menu-qr-code-restaurant",
    VistaireMenuQrCodeRestaurantPreview,
  ],
  "/en/qr-code-restaurant-menu": [
    "menu-qr-code-restaurant",
    VistaireMenuQrCodeRestaurantPreview,
  ],
  "/menu-3d-ar-restaurant": [
    "menu-3d-ar-restaurant",
    VistaireMenu3dArRestaurantPreview,
  ],
  "/en/3d-ar-restaurant-menu": [
    "menu-3d-ar-restaurant",
    VistaireMenu3dArRestaurantPreview,
  ],
  "/menu-pdf-vs-menu-digital": [
    "menu-pdf-vs-menu-digital",
    VistairePdfVsMenuDigitalPreview,
    "slider",
  ],
  "/en/pdf-vs-digital-menu": [
    "menu-pdf-vs-menu-digital",
    VistairePdfVsMenuDigitalPreview,
    "slider",
  ],
};

export default function PublicPageRouter({
  pathname = window.location.pathname,
}) {
  const path = normalizePathname(pathname);
  const locale = path === "/en" || path.startsWith("/en/") ? "en" : "fr";
  const guide = getEditorialGuideByPath(path);
  const geo = getSeoGeoPage(path.split("/").at(-1), locale);
  const seo = seoRoutes[path];
  const seoData = seo ? getSeoPage(seo[0], locale) : null;
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en-CA" : "fr-CA";
    document.title =
      guide?.metadataTitle ??
      geo?.metadataTitle ??
      seoData?.metadataTitle ??
      `${locale === "en" ? "Vistaire — Premium digital restaurant menus" : "Vistaire — Carte digitale premium"}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.content =
        guide?.metadataDescription ??
        geo?.metadataDescription ??
        seoData?.metadataDescription ??
        (locale === "en"
          ? "Discover Vistaire: premium mobile menus, selected 3D dishes and personalized QR displays."
          : "Découvrez Vistaire : carte mobile premium, plats 3D sélectionnés et supports QR personnalisés.");
  }, [locale, guide, geo, seoData]);
  let content;
  const SimplePage = simpleRoutes[path];
  if (SimplePage) content = <SimplePage locale={locale} />;
  else if (path === "/demo" || path === "/en/vistaire-menu")
    content = <RestaurantExperiences currentPath={path} locale={locale} />;
  else if (path === "/apercu-restaurateur" || path === "/en/restaurant-preview")
    content = (
      <VistaireRestaurateurDashboardPreview
        locale={locale}
        demoQrSvg={MENU_QR_SVGS[locale]}
      />
    );
  else if (seo) {
    const Page = seo[1];
    content = (
      <Page
        locale={locale}
        h1={seoData.h1}
        seoAppendix={<VistaireSeoProductionSections page={seoData} />}
        interactiveShowcase={
          seo[2] ? (
            <LandingComparison
              copy={getLandingCopy(locale).comparison}
              experiences={getLandingExperiences(locale)}
              locale={locale}
              interaction={seo[2]}
            />
          ) : undefined
        }
      />
    );
  } else if (guide) content = <VistaireEditorialGuide guide={guide} />;
  else if (geo) content = <SeoGeoAeoPage page={geo} />;
  else {
    const official =
      /^\/(?:menu|admin|owner|sign-in|todos|legacy|q)(?:\/|$)/.test(path);
    content = (
      <main className="public-route-status">
        <a href="/" className="public-brand">
          Vistaire
        </a>
        <h1>
          {official
            ? locale === "en"
              ? "Continue on Vistaire"
              : "Continuer sur Vistaire"
            : locale === "en"
              ? "Page not found"
              : "Page introuvable"}
        </h1>
        <p>
          {official
            ? locale === "en"
              ? "This experience opens on the official Vistaire website."
              : "Cette expérience s’ouvre sur le site officiel Vistaire."
            : locale === "en"
              ? "Discover the Vistaire experience."
              : "Découvrez l’expérience Vistaire."}
        </p>
        <a
          className="public-gold-button"
          href={
            official
              ? `https://www.vistaire.ca${path}${window.location.search}`
              : "/"
          }
        >
          {official
            ? locale === "en"
              ? "Open Vistaire"
              : "Ouvrir Vistaire"
            : locale === "en"
              ? "Back to Vistaire"
              : "Retour à Vistaire"}{" "}
          ↗
        </a>
      </main>
    );
  }
  return <div data-public-vistaire>{content}</div>;
}
