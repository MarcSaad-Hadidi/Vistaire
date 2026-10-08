"use client";

import Image from "next/image";
import shared from "./shared.module.css";
import { PhoneFrame, Reveal } from "./ForhimsMotion";
import { DISH, ScreenDishSheet, ScreenPopular, ScreenPublished } from "./ForhimsPhones";
import s from "./ForhimsShop.module.css";

const TILES = [
  { src: DISH.homard, alt: "Homard bleu, bisque au fenouil" },
  { src: DISH.ravioles, alt: "Ravioles de chèvre au miel" },
  { src: DISH.risotto, alt: "Risotto aux cèpes" },
  { src: DISH.tartare, alt: "Tartare de saumon" },
  { src: DISH.souffle, alt: "Soufflé au chocolat grand cru" },
  { src: DISH.pave, alt: "Pavé de bœuf maturé" }
];

function Split({
  text,
  phone,
  flip = false
}: {
  text: string;
  phone: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className={`${s.split} ${flip ? s.flip : ""}`}>
      <Reveal>
        <p className={`${shared.headline} ${s.splitText}`}>{text}</p>
      </Reveal>
      <Reveal delay={120}>{phone}</Reveal>
    </div>
  );
}

export function ForhimsShop() {
  return (
    <section className={s.section} aria-label="La carte Vistaire">
      {/* Product collage */}
      <div className={s.collage} aria-hidden="true">
        {TILES.map((t) => (
          <div key={t.src} className={s.tile}>
            <Image src={t.src} alt="" fill sizes="400px" className={s.tileImg} />
          </div>
        ))}
      </div>

      <Split
        text="Découvrez tous nos plats signatures, mis en valeur comme ils le méritent."
        phone={
          <PhoneFrame>
            <ScreenPopular />
          </PhoneFrame>
        }
      />
      <Split
        flip
        text="Mettez votre carte à jour en quelques secondes, depuis vos outils."
        phone={
          <PhoneFrame>
            <ScreenDishSheet />
          </PhoneFrame>
        }
      />
      <Split
        text="Gérez plats, prix, disponibilités et langues au même endroit."
        phone={
          <PhoneFrame dark>
            <ScreenPublished />
          </PhoneFrame>
        }
      />
    </section>
  );
}
