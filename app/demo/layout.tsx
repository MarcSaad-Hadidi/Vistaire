import type { Metadata } from "next";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import { DemoExperienceShell } from "@/components/menu/DemoExperienceShell";
import { DemoSimulationProvider } from "@/components/menu/DemoSimulationContext";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Maison Élyse — Menu client exemple | Vistaire",
  description:
    "Restaurant exemple de présentation : une carte Vistaire complète avec plats, allergènes, accords et vues immersives."
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
