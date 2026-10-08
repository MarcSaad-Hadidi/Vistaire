import { Nunito } from "next/font/google";
import shared from "./shared.module.css";
import { DroppyNavbar } from "./DroppyNavbar";
import { DroppyHero } from "./DroppyHero";
import { DroppyShowcase } from "./DroppyShowcase";
import {
  FloatingPlayer,
  ThereWhenNeeded,
  Highlights,
  OnePrice,
  Testimonials,
  ExtensionsInAction
} from "./DroppyCarousels";
import { DroppyDroplets, DroppyModules } from "./DroppyModules";
import { DroppyPurchase } from "./DroppyPurchase";
import { DroppyFaq } from "./DroppyFaq";
import { DroppyClosing } from "./DroppyClosing";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
  variable: "--droppy-nunito"
});

/**
 * Vistaire homepage concept — pixel-faithful copy of getdroppy.app,
 * content swapped for Vistaire. Test page, not indexed.
 */
export function DroppyConcept() {
  return (
    <div id="top" className={`${shared.root} ${nunito.variable}`} style={{ fontFamily: "var(--droppy-nunito), var(--droppy-font)" }}>
      <DroppyNavbar />
      <main>
        <DroppyHero />
        <DroppyShowcase />
        <FloatingPlayer />
        <ThereWhenNeeded />
        <Highlights />
        <OnePrice />
        <Testimonials />
        <DroppyDroplets />
        <ExtensionsInAction />
        <DroppyModules />
        <DroppyPurchase />
        <DroppyFaq />
        <DroppyClosing />
      </main>
    </div>
  );
}
