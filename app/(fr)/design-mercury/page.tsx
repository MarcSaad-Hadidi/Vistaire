import type { Metadata } from "next";
import { MercuryConcept } from "@/components/design-concepts/mercury/MercuryConcept";

export const metadata: Metadata = {
  title: "Vistaire — Concept Mercury",
  description:
    "Concept de page d'accueil Vistaire inspiré de mercury.com — version de test non indexée.",
  robots: {
    index: false,
    follow: false
  }
};

export default function DesignMercury() {
  return <MercuryConcept />;
}
