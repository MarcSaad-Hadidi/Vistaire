import type { Metadata } from "next";
import { DroppyConcept } from "@/components/design-concepts/droppy/DroppyConcept";

export const metadata: Metadata = {
  title: "Vistaire — Concept Droppy",
  description:
    "Concept de page d'accueil Vistaire inspiré de getdroppy.app — version de test non indexée.",
  robots: {
    index: false,
    follow: false
  }
};

export default function DesignDroppy() {
  return <DroppyConcept />;
}
