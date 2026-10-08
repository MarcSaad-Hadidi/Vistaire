import { TigerHeader } from "./TigerHeader";
import { TigerHero } from "./TigerHero";
import { TigerManifesto } from "./TigerManifesto";
import {
  TigerDishes,
  TigerExperiences,
  TigerOwner,
  TigerValue
} from "./TigerSections";
import { TigerFinalCta } from "./TigerFinalCta";
import { TigerFooter } from "./TigerFooter";
import { FloatingActions } from "./TigerMotion";
import shared from "./shared.module.css";

/**
 * Vistaire homepage concept in the eathungrytiger.com design language.
 * Warm saturated palette, monumental uppercase type, full-bleed
 * color-block chapters, tilted sticker labels, pill CTAs, grain.
 * French copy from LANDING_COPY.fr. Not indexed (robots noindex).
 */
export function HungryTigerConcept() {
  return (
    <div className={shared.scope} lang="fr">
      <div className={shared.grain} aria-hidden="true" />
      <TigerHeader />
      <main>
        <TigerHero />
        <TigerManifesto />
        <TigerExperiences />
        <TigerDishes />
        <TigerValue />
        <TigerOwner />
        <TigerFinalCta />
      </main>
      <TigerFooter />
      <FloatingActions />
    </div>
  );
}
