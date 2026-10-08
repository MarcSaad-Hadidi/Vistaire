import type { Metadata } from "next";
import { DesignAirPage } from "@/components/design-concepts/air/DesignAirPage";

export const metadata: Metadata = {
  title: "Vistaire — Concept Air",
  description:
    "Concept de page d'accueil Vistaire inspiré d'air.inc — version de test non indexée.",
  robots: {
    index: false,
    follow: false
  }
};

export default function DesignAir() {
  return <DesignAirPage />;
}
