import { TigerHeader } from "./TigerHeader";
import { TigerHero } from "./TigerHero";
import { TigerPinned } from "./TigerPinned";
import {
  TigerInside,
  TigerManifesto,
  TigerTradition,
  TigerWhy,
  TigerUnlock,
  TigerCooking,
  TigerNewsletter,
  TigerFooter
} from "./TigerSections";
import { FloatingActions } from "./TigerMotion";
import shared from "./shared.module.css";

/* Composition mirroring eathungrytiger.com section order exactly:
   header → hero → pinned statement sequence → what's-inside split →
   manifesto split → tradition & creation → why the jar matters →
   unlock CTA → cooking/experiences → newsletter CTA → footer. */
export function HungryTigerConcept() {
  return (
    <div className={shared.root}>
      <TigerHeader />
      <main>
        <TigerHero />
        <TigerPinned />
        <TigerInside />
        <TigerManifesto />
        <TigerTradition />
        <TigerWhy />
        <TigerUnlock />
        <TigerCooking />
        <TigerNewsletter />
      </main>
      <TigerFooter />
      <FloatingActions />
    </div>
  );
}
