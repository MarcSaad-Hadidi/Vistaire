import type { Metadata } from "next";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import { DemoExperienceShell } from "@/components/menu/DemoExperienceShell";
import { DemoSimulationProvider } from "@/components/menu/DemoSimulationContext";
import { Header } from "@/components/Header";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Menu client exemple — Maison Élyse",
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
    title: "Menu client exemple — Maison Élyse | Vistaire",
    description:
      "Restaurant exemple de présentation Vistaire avec menu client, fiches plats et vues immersives.",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Menu client exemple — Maison Élyse | Vistaire",
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
    <>
      <Header />
      <main className="min-h-screen bg-[#080706] pt-[4.5rem] sm:pt-20">
        <SmoothScrollProvider>
          <DemoSimulationProvider>
            <DemoExperienceShell>{children}</DemoExperienceShell>
          </DemoSimulationProvider>
        </SmoothScrollProvider>
      </main>
    </>
  );
}
