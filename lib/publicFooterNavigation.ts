import { getEditorialGuideNavigation } from "./editorialGuideRoutes.ts";
import { getLocalizedPath, LOCALE_LANGUAGE_TAG, type Locale } from "./i18n.ts";

export function getPublicFooterNavigation(locale: Locale) {
  const label = (fr: string, en: string) => locale === "en" ? en : fr;
  const page = (path: string, fr: string, en: string) => ({
    href: getLocalizedPath(path, locale),
    label: label(fr, en),
  });

  return [
    {
      id: "product",
      title: label("Produit", "Product"),
      links: [
        page("/menu-digital-restaurant", "Menu digital restaurant", "Digital restaurant menu"),
        page("/menu-qr-code-restaurant", "Menu QR code", "QR code menu"),
        page("/menu-3d-ar-restaurant", "3D et réalité augmentée", "3D and augmented reality"),
        page("/tarifs-menu-digital-restaurant", "Tarifs", "Pricing"),
        page("/apercu-restaurateur", "Aperçu restaurateur", "Restaurant preview"),
        page("/menu-digital-restaurant-haut-de-gamme", "Restaurants haut de gamme", "High-end restaurants"),
        page("/menu-digital-restaurant-gastronomique", "Tables gastronomiques", "Fine dining restaurants"),
      ],
    },
    {
      id: "menus",
      title: label("Les cartes", "The menus"),
      links: [
        page("/demo", "Toutes les expériences", "All experiences"),
        ...[
          ["maison-elyse", "Maison Élyse"],
          ["trouvable", "Trouvable"],
          ["sauge-noire", "Sauge Noire"],
        ].map(([slug, name]) => ({
          label: name,
          href: `/menu/${slug}?lang=${LOCALE_LANGUAGE_TAG[locale]}`,
        })),
      ],
    },
    {
      id: "guides",
      title: "Guides",
      links: getEditorialGuideNavigation(locale),
    },
    {
      id: "solutions",
      title: label("Besoins", "Solutions"),
      links: [
        page("/menu-pdf-vs-menu-digital", "PDF vs menu digital", "PDF vs digital menu"),
        page("/menu-qr-sans-pdf", "QR sans PDF", "QR without PDF"),
        page("/menu-digital-sans-application", "Sans application", "No app required"),
        page("/remplacer-menu-pdf-restaurant", "Remplacer un menu PDF", "Replace a PDF menu"),
        page("/alternative-menu-pdf-restaurant", "Alternative au PDF", "PDF alternative"),
        page("/fiche-plat-digitale-restaurant", "Fiches plats", "Dish pages"),
        page("/menu-restaurant-photos", "Photos et plats", "Menu photography"),
        page("/menu-restaurant-allergenes", "Allergènes", "Allergens"),
      ],
    },
    {
      id: "local",
      title: "Local",
      links: [
        page("/menu-digital-restaurant-montreal", "Montréal", "Montreal"),
        page("/menu-digital-restaurant-laval", "Laval", "Laval"),
        page("/menu-digital-restaurant-brossard", "Brossard", "Brossard"),
      ],
    },
    {
      id: "company",
      title: label("L’entreprise", "Company"),
      links: [
        page("/", "Accueil", "Home"),
        page("/a-propos", "À propos", "About"),
        page("/contact", "Nous contacter", "Contact us"),
        page("/prendre-rendez-vous", "Prendre rendez-vous", "Book a call"),
      ],
    },
  ];
}
