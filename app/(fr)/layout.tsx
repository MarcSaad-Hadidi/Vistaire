import "../globals.css";
import "@/components/vistaire-preview/public-theme.css";
import { PUBLIC_THEME_BOOTSTRAP } from "@/lib/publicTheme";
import type React from "react";
import { VistaireDocumentShell } from "@/components/layout/VistaireDocumentShell";
import { buildRootMetadata, ROOT_VIEWPORT } from "@/lib/rootDocument";

export const metadata = buildRootMetadata("fr");
export const viewport = ROOT_VIEWPORT;

export default function FrenchRootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr-CA" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: PUBLIC_THEME_BOOTSTRAP }} /></head>
      <body>
        <VistaireDocumentShell locale="fr">{children}</VistaireDocumentShell>
      </body>
    </html>
  );
}
