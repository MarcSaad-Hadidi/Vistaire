"use client";

import { Plus_Jakarta_Sans } from "next/font/google";
import shared from "./shared.module.css";
import { ForhimsNav } from "./ForhimsNav";
import { ForhimsHero } from "./ForhimsHero";
import { ForhimsPinned } from "./ForhimsPinned";
import { ForhimsStatement } from "./ForhimsStatement";
import { ForhimsIndex } from "./ForhimsIndex";
import { ForhimsCommunity } from "./ForhimsCommunity";
import { ForhimsPrograms } from "./ForhimsPrograms";
import { ForhimsShop } from "./ForhimsShop";
import { ForhimsClosing } from "./ForhimsClosing";
import { ForhimsFaq } from "./ForhimsFaq";
import { ForhimsFooter } from "./ForhimsFooter";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-forhims"
});

export function ForhimsConcept() {
  return (
    <div className={`${shared.page} ${font.variable}`}>
      <ForhimsNav />
      <main>
        <ForhimsHero />
        <ForhimsPinned />
        <ForhimsStatement from="#6fa8e0" to="#141a24">
          Une carte d’exception n’est que le début. Le QR code n’est pas le problème — c’est ce que
          vos convives découvrent après le scan. Des fiches plats visuelles, de la 3D sur vos
          signatures, et une carte qui donne envie, comme il se doit.
        </ForhimsStatement>
        <ForhimsIndex />
        <ForhimsCommunity />
        <ForhimsStatement from="#7fd0a8" to="#2b3fd6">
          La carte devrait être simple — pas un PDF. C’est pourquoi nous avons créé les Expériences.
          Le plaisir commence dès le scan, et l’hésitation n’a plus sa place. À vous de jouer.
        </ForhimsStatement>
        <ForhimsPrograms />
        <ForhimsStatement from="#7fd0b8" to="#1c2b26">
          Découvrir une carte d’exception n’a jamais été aussi simple. Sans application, sans
          mauvaise surprise. Des entrées aux desserts, tout ce qu’il faut pour que la carte donne
          enfin envie.
        </ForhimsStatement>
        <ForhimsShop />
        <ForhimsClosing />
        <ForhimsFaq />
      </main>
      <ForhimsFooter />
    </div>
  );
}
