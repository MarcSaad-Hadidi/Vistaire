import "../globals.css";
import type React from "react";
import { VistaireDocumentShell } from "@/components/layout/VistaireDocumentShell";
import { buildRootMetadata, ROOT_VIEWPORT } from "@/lib/rootDocument";

export const metadata = buildRootMetadata("en");
export const viewport = ROOT_VIEWPORT;

export default function EnglishRootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA" data-scroll-behavior="smooth">
      <body>
        <VistaireDocumentShell locale="en">{children}</VistaireDocumentShell>
      </body>
    </html>
  );
}
