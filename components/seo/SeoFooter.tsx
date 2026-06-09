import Link from "next/link";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  getVistaireSocialProfiles
} from "@/lib/seo";
import { PRICING_PAGE } from "@/lib/pricingPage";
import { SEO_PAGES } from "@/lib/seoPages";

const experienceLinks = [
  { href: "/carte-vistaire", label: "Carte Vistaire" },
  { href: "/menu-3d-ar-restaurant", label: "Plats 3D inclus" },
  { href: "/apercu-restaurateur", label: "Aperçu restaurateur" }
] as const;

const whyLinks = [
  { href: "/menu-pdf-vs-menu-digital", label: "Remplacer un menu PDF" },
  { href: "/menu-qr-code-restaurant", label: "Rendre un QR code premium" },
  {
    href: "/menu-digital-restaurant",
    label: "Valoriser les plats signatures"
  }
] as const;

const guideLinks = [
  { href: PRICING_PAGE.path, label: "Tarifs" },
  ...SEO_PAGES.map((page) => ({
    href: page.path,
    label: page.footerLabel ?? page.eyebrow
  }))
] as const;

type FooterGroupProps = {
  title: string;
  children: React.ReactNode;
};

function FooterGroup({ title, children }: FooterGroupProps) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-champagne/75">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

type SeoFooterProps = {
  compact?: boolean;
};

export function SeoFooter({ compact = false }: SeoFooterProps) {
  const socialProfiles = getVistaireSocialProfiles();

  return (
    <footer
      className={`border-t border-white/10 bg-[#050403] text-sm text-[#b9aa94] ${
        compact ? "px-4 py-8 sm:px-6" : "px-5 py-12 sm:px-10 lg:px-16 lg:py-16"
      }`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))] lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="font-display text-2xl text-cream transition hover:text-champagne focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
            >
              Vistaire
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-[#a99984]">
              Carte digitale premium pour restaurants haut de gamme : QR code,
              fiches plats et immersion sélective.
            </p>
          </div>

          <FooterGroup title="Expérience">
            {experienceLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition hover:text-cream focus:outline-none focus-visible:text-cream focus-visible:ring-2 focus-visible:ring-champagne"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterGroup>

          <FooterGroup title="Guides">
            {guideLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition hover:text-cream focus:outline-none focus-visible:text-cream focus-visible:ring-2 focus-visible:ring-champagne"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterGroup>

          <FooterGroup title="Pourquoi Vistaire">
            {whyLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition hover:text-cream focus:outline-none focus-visible:text-cream focus-visible:ring-2 focus-visible:ring-champagne"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterGroup>

          <FooterGroup title="Contact">
            <li className="text-xs text-[#8f8170]">
              MontrÃ©al, QuÃ©bec, Canada
            </li>
            <li>
              <Link
                href="/prendre-rendez-vous"
                className="text-xs text-[#8f8170] transition hover:text-[#cdbfa9] focus:outline-none focus-visible:text-cream focus-visible:ring-2 focus-visible:ring-champagne"
              >
                Prendre rendez-vous
              </Link>
            </li>
            <li className="mt-2">
              <a
                href="mailto:contact@vistaire.ca"
                className="text-xs text-[#8f8170] transition hover:text-[#cdbfa9] focus:outline-none focus-visible:text-cream focus-visible:ring-2 focus-visible:ring-champagne"
              >
                contact@vistaire.ca
              </a>
            </li>
            <li>
              <a
                href={`tel:${CONTACT_PHONE_TEL}`}
                className="text-xs text-[#8f8170] transition hover:text-[#cdbfa9] focus:outline-none focus-visible:text-cream focus-visible:ring-2 focus-visible:ring-champagne"
              >
                {CONTACT_PHONE_DISPLAY}
              </a>
            </li>
            {socialProfiles.map((profile) => (
              <li key={profile.url}>
                <a
                  href={profile.url}
                  rel="me noopener noreferrer"
                  target="_blank"
                  className="text-xs text-[#8f8170] transition hover:text-[#cdbfa9] focus:outline-none focus-visible:text-cream focus-visible:ring-2 focus-visible:ring-champagne"
                >
                  {profile.label}
                </a>
              </li>
            ))}
          </FooterGroup>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/8 pt-6 text-xs text-[#7a6f61] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Vistaire</p>
          <p>Menu digital premium pour restaurants au Canada</p>
        </div>
      </div>
    </footer>
  );
}
