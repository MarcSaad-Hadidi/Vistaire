"use client";

import { useState } from "react";
import shared from "./shared.module.css";
import { Reveal } from "./ForhimsMotion";
import s from "./ForhimsFaq.module.css";

const FAQS = [
  {
    q: "Qu’est-ce que Vistaire ?",
    a: "Vistaire transforme votre QR code en une carte mobile claire, visuelle et fidèle à l’identité de votre restaurant — sans application à télécharger."
  },
  {
    q: "Faut-il télécharger une application ?",
    a: "Non. La carte s’ouvre directement dans le navigateur après le scan du QR code, sur tous les téléphones."
  },
  {
    q: "Puis-je mettre à jour mes plats moi-même ?",
    a: "Oui. Plats, prix, visuels, disponibilités, allergènes et langues se gèrent depuis les outils restaurateur, et la carte se met à jour instantanément."
  },
  {
    q: "La 3D est-elle disponible pour tous les plats ?",
    a: "Non — la 3D / AR est sélective : elle est réservée aux plats signatures, là où elle apporte un vrai plus."
  },
  {
    q: "Comment commencer ?",
    a: "Prenez rendez-vous : nous créons avec vous une carte à l’image de votre restaurant, avec des photos premium fournies par votre maison."
  }
];

export function ForhimsFaq() {
  const [open, setOpen] = useState(0);
  return (
    <section className={s.section} aria-label="Questions fréquentes">
      <div className={s.grid}>
        <Reveal>
          <h2 className={`${shared.headline} ${s.title}`}>
            Questions
            <br />
            fréquentes
          </h2>
        </Reveal>
        <div className={s.list}>
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 60}>
                <div className={s.item}>
                  <button
                    className={s.question}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                  >
                    <span>{f.q}</span>
                    <span className={`${s.chevron} ${isOpen ? s.chevronOpen : ""}`} aria-hidden="true">
                      ⌄
                    </span>
                  </button>
                  <div
                    className={s.answerWrap}
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className={s.answerInner}>
                      <p className={s.answer}>{f.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
