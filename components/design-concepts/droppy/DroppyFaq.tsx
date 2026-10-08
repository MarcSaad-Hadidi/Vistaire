"use client";

import { useState } from "react";
import shared from "./shared.module.css";
import styles from "./DroppyFaq.module.css";
import { DroppyReveal } from "./DroppyMotion";

const FAQS = [
  {
    q: "Qu’est-ce que Vistaire ?",
    a: "Une carte digitale premium pour restaurants : vos clients scannent un QR code et découvrent une carte mobile claire, visuelle, fidèle à votre identité. Sans application."
  },
  {
    q: "Faut-il installer une application ?",
    a: "Non. La carte s’ouvre dans le navigateur du téléphone, en un scan. Rien à télécharger, ni pour vos clients ni pour vous."
  },
  {
    q: "Comment mettre ma carte à jour ?",
    a: "Plats, prix, visuels, disponibilités : vous modifiez une fois, la carte est à jour partout, instantanément. Sans réimpression."
  },
  {
    q: "La 3D est-elle sur tous les plats ?",
    a: "Non, et c’est volontaire : la 3D et la réalité augmentée sont réservées à vos plats signatures, là où elles donnent vraiment envie."
  },
  {
    q: "Quelles langues sont prises en charge ?",
    a: "Le français et l’anglais, entièrement traduits et prêts à publier. D’autres langues sont possibles sur demande."
  },
  {
    q: "Comment sont gérés les allergènes ?",
    a: "Ils sont structurés et affichés clairement sur chaque fiche plat, à un toucher. Limpide pour le client, simple pour vous."
  },
  {
    q: "Puis-je essayer avant de me décider ?",
    a: "Oui : la démo est gratuite et sans engagement. Parcourez de vraies cartes, touchez les fiches, jugez sur pièce."
  },
  {
    q: "Que deviennent mes données ?",
    a: "Votre contenu reste le vôtre. Les signaux de consultation sont anonymes : ce que regardent vos clients, jamais qui ils sont."
  },
  {
    q: "Plusieurs établissements ?",
    a: "Oui. Gérez les cartes de vos différentes adresses depuis la même interface, chacune avec son identité."
  },
  {
    q: "Et si je change de carte ?",
    a: "Votre carte évolue avec vous : nouveaux plats, nouveaux prix, nouvelles photos — tout se met à jour sans repartir de zéro."
  }
];

/**
 * FAQ — alternating zigzag white pills, each with a "+" expander.
 */
export function DroppyFaq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className={`${shared.section} ${styles.faq}`} data-nav-dark aria-label="Questions fréquentes">
      <div className={shared.wrap}>
        <DroppyReveal>
          <h2 className={shared.title}>
            Questions
            <br />
            fréquentes
          </h2>
        </DroppyReveal>
        <div className={styles.list}>
          {FAQS.map((item, i) => {
            const right = i % 2 === 1;
            const isOpen = open === i;
            return (
              <DroppyReveal
                key={item.q}
                className={`${styles.row} ${right ? styles.rowRight : styles.rowLeft}`}
                delay={60}
              >
                <div className={styles.item}>
                  <button
                    type="button"
                    className={styles.pill}
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    {item.q}
                  </button>
                  <button
                    type="button"
                    className={styles.plus}
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? `Réduire : ${item.q}` : `Afficher : ${item.q}`}
                  >
                    <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen ? <p className={styles.answer}>{item.a}</p> : null}
                </div>
              </DroppyReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
