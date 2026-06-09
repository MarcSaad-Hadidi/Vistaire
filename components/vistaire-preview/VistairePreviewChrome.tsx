import Link from "next/link";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  getVistaireSocialProfiles
} from "@/lib/seo";
import { PRICING_PAGE } from "@/lib/pricingPage";
import styles from "./VistairePreviewChrome.module.css";

type PreviewNavItem = {
  active: boolean;
  href: string;
  label: string;
};

type PreviewNavSection = "home" | "menu" | "about" | "contact";
type PreviewChromeWidth = "standard" | "wide";
export type VistaireRouteMode = "preview" | "production";

type VistaireChromeRoutes = {
  about: string;
  appointment: string;
  contact: string;
  dish: string;
  home: string;
  menu: string;
  menu3dAr: string;
  menuDigital: string;
  menuQrCode: string;
  pdfVsDigital: string;
  pricing: string;
  restaurateurDashboard: string;
};

export function getVistaireChromeRoutes(
  mode: VistaireRouteMode = "preview"
): VistaireChromeRoutes {
  if (mode === "production") {
    return {
      about: "/a-propos",
      appointment: "/prendre-rendez-vous",
      contact: "/contact",
      dish: "/demo/dishes/homard-bisque",
      home: "/",
      menu: "/demo",
      menu3dAr: "/menu-3d-ar-restaurant",
      menuDigital: "/menu-digital-restaurant",
      menuQrCode: "/menu-qr-code-restaurant",
      pdfVsDigital: "/menu-pdf-vs-menu-digital",
      pricing: PRICING_PAGE.path,
      restaurateurDashboard: "/apercu-restaurateur"
    };
  }

  return {
    about: "/vistaire-preview/a-propos",
    appointment: "/vistaire-preview/prendre-rendez-vous",
    contact: "/vistaire-preview/contact",
    dish: "/vistaire-preview/demo/dishes/homard-bisque",
    home: "/vistaire-preview",
    menu: "/vistaire-preview/demo",
    menu3dAr: "/vistaire-preview/menu-3d-ar-restaurant",
    menuDigital: "/vistaire-preview/menu-digital-restaurant",
    menuQrCode: "/vistaire-preview/menu-qr-code-restaurant",
    pdfVsDigital: "/vistaire-preview/pdf-vs-menu-digital",
    pricing: PRICING_PAGE.path,
    restaurateurDashboard: "/apercu-restaurateur"
  };
}

const navLabels = {
  home: "Accueil",
  menu: "Carte",
  about: "À propos",
  contact: "Contact"
} as const;

const footerProduct = [
  { label: "Carte digitale", href: "/vistaire-preview/demo" },
  { label: "Fiches plats", href: "/vistaire-preview/demo/dishes/homard-bisque" },
  { label: "3D / AR sélective", href: "/vistaire-preview/menu-3d-ar-restaurant" }
] as const;

const footerResources = [
  {
    label: "Menu digital restaurant",
    href: "/vistaire-preview/menu-digital-restaurant"
  },
  {
    label: "Menu QR code restaurant",
    href: "/vistaire-preview/menu-qr-code-restaurant"
  },
  { label: "PDF vs menu digital", href: "/vistaire-preview/pdf-vs-menu-digital" },
  { label: "Restaurants haut de gamme", href: "/vistaire-preview/a-propos" }
] as const;

function getPreviewNav(
  routes: VistaireChromeRoutes,
  activeSection?: PreviewNavSection,
  contactHref = "#contact-preview"
): PreviewNavItem[] {
  return [
    {
      label: navLabels.home,
      href: activeSection === "home" ? "#accueil" : routes.home,
      active: activeSection === "home"
    },
    {
      label: navLabels.menu,
      href: activeSection === "menu" ? "#carte" : routes.menu,
      active: activeSection === "menu"
    },
    {
      label: navLabels.about,
      href:
        activeSection === "about"
          ? "#a-propos"
          : routes.about,
      active: activeSection === "about"
    },
    {
      label: navLabels.contact,
      href:
        activeSection === "contact" ? contactHref : routes.contact,
      active: activeSection === "contact"
    }
  ];
}

export function PreviewNav({
  activeSection,
  contactHref,
  routeMode = "preview"
}: {
  activeSection?: PreviewNavSection;
  contactHref?: string;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode);

  return (
    <nav aria-label="Navigation preview" className={styles.previewNav}>
      <Link
        aria-label="Vistaire - accueil"
        className={styles.navBrand}
        href={routes.home}
        prefetch={false}
      >
        <span className={styles.navBrandName}>Vistaire</span>
        <span className={styles.navBrandSubline}>Carte digitale premium</span>
      </Link>

      <div className={styles.navLinks}>
        {getPreviewNav(routes, activeSection, contactHref).map((item) => {
          const isCurrentPage = item.active && item.href.startsWith("#");

          return (
            <Link
              aria-current={isCurrentPage ? "page" : undefined}
              className={
                item.active
                  ? `${styles.navLink} ${styles.navActive}`
                  : styles.navLink
              }
              href={item.href}
              key={item.label}
              prefetch={false}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <Link className={styles.navCta} href={routes.appointment} prefetch={false}>
        Prendre rendez-vous
      </Link>
    </nav>
  );
}

export function PreviewFooter({
  routeMode = "preview",
  width = "standard"
}: {
  routeMode?: VistaireRouteMode;
  width?: PreviewChromeWidth;
}) {
  const routes = getVistaireChromeRoutes(routeMode);
  const productLinks =
    routeMode === "preview"
      ? footerProduct
      : [
          { label: "Carte digitale", href: routes.menu },
          { label: "Fiches plats", href: routes.dish },
          { label: "3D / AR sélective", href: routes.menu3dAr },
          { label: "Aperçu restaurateur", href: routes.restaurateurDashboard }
        ];
  const resourceLinks =
    routeMode === "preview"
      ? footerResources
      : [
          { label: "Tarifs", href: routes.pricing },
          { label: "Menu digital restaurant", href: routes.menuDigital },
          { label: "Menu QR code restaurant", href: routes.menuQrCode },
          { label: "PDF vs menu digital", href: routes.pdfVsDigital },
          { label: "Restaurants haut de gamme", href: routes.about }
        ];
  const socialProfiles = getVistaireSocialProfiles();

  return (
    <footer
      className={`${styles.previewFooter} ${
        width === "wide" ? styles.previewFooterWide : ""
      }`}
      id="contact"
    >
      <section className={styles.footerBrand} aria-label="Vistaire">
        <h2>Vistaire</h2>
        <p className={styles.footerTagline}>
          Carte digitale premium pour restaurants haut de gamme.
        </p>
        <p className={styles.footerDescription}>
          Une expérience mobile pensée pour présenter les plats, remplacer les
          menus PDF et valoriser la carte d&apos;un restaurant.
        </p>
      </section>

      <section className={styles.footerColumn} aria-label="Produit">
        <h2>Produit</h2>
        <nav className={styles.footerLinkList} aria-label="Produit Vistaire">
          {productLinks.map((item) => (
            <Link href={item.href} key={item.label} prefetch={false}>
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      <section
        className={`${styles.footerColumn} ${styles.footerColumnWide}`}
        aria-label="Ressources"
      >
        <h2>Ressources</h2>
        <nav
          className={`${styles.footerLinkList} ${styles.footerLinkListBalanced}`}
          aria-label="Guides Vistaire"
        >
          {resourceLinks.map((item) => (
            <Link href={item.href} key={item.label} prefetch={false}>
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className={styles.footerColumn} aria-label="Contact">
        <h2>Contact</h2>
        <p className={styles.footerPlace}>Montréal, Québec, Canada</p>
        <a className={styles.footerEmail} href="mailto:contact@vistaire.ca">
          contact@vistaire.ca
        </a>
        <a className={styles.footerEmail} href={`tel:${CONTACT_PHONE_TEL}`}>
          {CONTACT_PHONE_DISPLAY}
        </a>
        <Link
          className={styles.footerCta}
          href={routes.appointment}
          prefetch={false}
        >
          Prendre rendez-vous
        </Link>
        {socialProfiles.length > 0 ? (
          <nav
            aria-label="Profils publics Vistaire"
            className={styles.footerSocialLinks}
          >
            {socialProfiles.map((profile) => (
              <a
                href={profile.url}
                key={profile.url}
                rel="me noopener noreferrer"
                target="_blank"
              >
                {profile.label}
              </a>
            ))}
          </nav>
        ) : null}
      </section>

      <div className={styles.footerBottom}>
        <p className={styles.footerCopyright}>
          © 2026 Vistaire. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
