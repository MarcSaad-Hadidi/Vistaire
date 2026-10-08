import type { Metadata } from "next";
import { ForhimsConcept } from "@/components/design-concepts/forhims/ForhimsConcept";

export const metadata: Metadata = {
  title: "Vistaire — Concept Forhims",
  description:
    "Concept de page d'accueil Vistaire inspiré de app.forhims.com — version de test non indexée.",
  robots: {
    index: false,
    follow: false
  }
};

export default function DesignForhims() {
  return <ForhimsConcept />;
}
