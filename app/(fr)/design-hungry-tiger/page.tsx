import type { Metadata } from "next";
import { HungryTigerConcept } from "@/components/design-concepts/hungry-tiger/HungryTigerConcept";

export const metadata: Metadata = {
  title: "Vistaire — Concept Hungry Tiger",
  description:
    "Concept de page d'accueil Vistaire dans le langage visuel d'eathungrytiger.com. Page de test non indexée.",
  robots: { index: false, follow: false }
};

export default function DesignHungryTigerPage() {
  return <HungryTigerConcept />;
}
