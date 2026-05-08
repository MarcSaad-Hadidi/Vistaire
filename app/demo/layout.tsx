import type { Metadata } from "next";
import { DemoExperienceShell } from "@/components/menu/DemoExperienceShell";
import { DemoSimulationProvider } from "@/components/menu/DemoSimulationContext";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Maison Élyse — Menu digital | MenuAlive",
  description:
    "Menu interactif après scan QR : cartes, allergènes, signatures du chef et aperçu 3D — démo Montréal."
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
        <DemoSimulationProvider>
          <DemoExperienceShell>{children}</DemoExperienceShell>
        </DemoSimulationProvider>
      </main>
    </>
  );
}
