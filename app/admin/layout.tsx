import type { Metadata } from "next";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Espace restaurateur (démo) | MenuAlive",
  description:
    "Aperçu du pilotage menu, plats et médias — démonstration sans persistance."
};

export default function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
    </>
  );
}
