import type { Metadata, Viewport } from "next";
import { JsonLd } from "@/components/JsonLd";
import {
  DEFAULT_SITE_DESCRIPTION,
  SITE_NAME,
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  getSiteUrl
} from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Vistaire — Menu digital premium pour restaurants",
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
    title: "Vistaire — Menu digital premium pour restaurants",
    description: DEFAULT_SITE_DESCRIPTION
  },
  twitter: {
    card: "summary",
    title: "Vistaire — Menu digital premium pour restaurants",
    description: DEFAULT_SITE_DESCRIPTION
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#080706"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        <JsonLd data={[buildOrganizationJsonLd(), buildWebsiteJsonLd()]} />
        {children}
      </body>
    </html>
  );
}
