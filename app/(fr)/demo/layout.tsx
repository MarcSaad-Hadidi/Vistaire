import type { Metadata } from "next";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import { DemoSimulationProvider } from "@/components/menu/DemoSimulationContext";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Menu client exemple | Maison Élyse",
  description:
    "Maison Élyse est un restaurant exemple de présentation Vistaire : menu client, fiches plats, allergènes, accords et vues immersives.",
  alternates: {
    canonical: "/demo"
  },
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    url: absoluteUrl("/demo"),
    title: "Menu client exemple | Maison Élyse | Vistaire",
    description:
      "Restaurant exemple de présentation Vistaire avec menu client, fiches plats et vues immersives.",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Menu client exemple | Maison Élyse | Vistaire",
    description:
      "Restaurant exemple de présentation Vistaire avec menu client, fiches plats et vues immersives."
  }
};

export default function DemoLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SmoothScrollProvider>
      <DemoSimulationProvider>{children}</DemoSimulationProvider>
    </SmoothScrollProvider>
  );
}
