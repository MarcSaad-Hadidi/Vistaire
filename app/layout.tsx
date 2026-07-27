import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { WebMcpProvider } from "@/components/agent/WebMcpProvider";
import { JsonLd } from "@/components/JsonLd";
import {
  LOCALE_LANGUAGE_TAG,
  localeFromHeaderValue,
  VISTAIRE_LOCALE_HEADER
} from "@/lib/i18n";
import {
  DEFAULT_SITE_DESCRIPTION,
  SITE_NAME,
  buildOrganizationJsonLd,
  buildProfessionalServiceJsonLd,
  buildWebsiteJsonLd,
  getSiteUrl
} from "@/lib/seo";
import {
  SAUGE_NOIRE_ROUTE_THEME,
  VISTAIRE_ROUTE_THEME_HEADER
} from "@/lib/vistaireRouteTheme";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Vistaire | Menu digital premium pour restaurants",
    template: `%s | ${SITE_NAME}`
  },
  description: DEFAULT_SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1
  },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    siteName: SITE_NAME,
    title: "Vistaire | Menu digital premium pour restaurants",
    description: DEFAULT_SITE_DESCRIPTION
  },
  twitter: {
    card: "summary",
    title: "Vistaire | Menu digital premium pour restaurants",
    description: DEFAULT_SITE_DESCRIPTION
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#080706"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const locale = localeFromHeaderValue(headerList.get(VISTAIRE_LOCALE_HEADER));
  const documentLanguage = LOCALE_LANGUAGE_TAG[locale];
  const routeTheme =
    headerList.get(VISTAIRE_ROUTE_THEME_HEADER) === SAUGE_NOIRE_ROUTE_THEME
      ? SAUGE_NOIRE_ROUTE_THEME
      : undefined;

  return (
    <html
      lang={documentLanguage}
      data-scroll-behavior="smooth"
      data-vistaire-route-theme={routeTheme}
    >
      <body data-vistaire-route-theme={routeTheme}>
        <a className="skip-link" href="#contenu">
          {locale === "en" ? "Skip to content" : "Aller au contenu"}
        </a>
        <JsonLd
          data={[
            buildOrganizationJsonLd(),
            buildProfessionalServiceJsonLd(),
            buildWebsiteJsonLd(undefined, locale)
          ]}
        />
        <WebMcpProvider />
        <div id="contenu">{children}</div>
      </body>
    </html>
  );
}
