"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./DroppyPurchase.module.css";
import { DroppyReveal } from "./DroppyMotion";

const PLANS = [
  {
    key: "1",
    label: "1 établissement",
    note: "Standard",
    desc: "Pour une adresse unique, de la photo à la mise en ligne."
  },
  {
    key: "2",
    label: "2 établissements",
    note: "Duo",
    desc: "Deux cartes, une seule gestion."
  },
  {
    key: "3",
    label: "3 et +",
    note: "Groupe",
    desc: "Vos adresses, un accompagnement dédié."
  }
] as const;

const RESTO_CHECKS = [
  "Fiches plats visuelles et détaillées",
  "Photos premium de vos plats",
  "3D / AR sur vos plats signatures",
  "Français et anglais inclus",
  "Mises à jour instantanées",
  "Sans application à installer"
];

const CLIENT_CHECKS = [
  "Aucune application à télécharger",
  "Carte claire et rapide sur mobile",
  "Allergènes et accords à portée",
  "Français et anglais",
  "Toujours à jour"
];

function Check({ children, light = false }: { children: string; light?: boolean }) {
  return (
    <li className={light ? styles.checkLight : styles.check}>
      <span className={light ? styles.checkBadgeLight : styles.checkBadge} aria-hidden="true">
        ✓
      </span>
      {children}
    </li>
  );
}

/**
 * #purchase — two pricing cards. No invented prices: "Sur devis" + CTA.
 */
export function DroppyPurchase() {
  const [plan, setPlan] = useState<(typeof PLANS)[number]>(PLANS[0]);

  return (
    <section id="purchase" className={`${shared.section} ${styles.purchase}`} data-nav-dark aria-label="Adopter Vistaire">
      <div className={shared.wrap}>
        <DroppyReveal>
          <h2 className={shared.title}>Adoptez Vistaire.</h2>
          <p className={shared.sub}>
            Sans abonnement compliqué, une carte qui évolue avec votre restaurant.
          </p>
          <p className={styles.fine}>
            Un accompagnement de la photo à la mise en ligne. Parlons de votre carte.
          </p>
        </DroppyReveal>

        <div className={styles.cards}>
          <DroppyReveal className={styles.cardWhite}>
            <p className={styles.cardEyebrow}>
              <span className={styles.miniBadge} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff">
                  <path d="M12 2C12 2 5 10.2 5 15a7 7 0 0 0 14 0C19 10.2 12 2 12 2Z" />
                </svg>
              </span>
              Vistaire pour votre restaurant
            </p>
            <div className={styles.segment} role="tablist" aria-label="Nombre d’établissements">
              {PLANS.map((p) => (
                <button
                  key={p.key}
                  role="tab"
                  aria-selected={plan.key === p.key}
                  type="button"
                  className={`${styles.segBtn} ${plan.key === p.key ? styles.segActive : ""}`}
                  onClick={() => setPlan(p)}
                >
                  <strong>{p.label}</strong>
                  <span>{p.note}</span>
                </button>
              ))}
            </div>
            <p className={styles.planDesc}>{plan.desc}</p>
            <p className={styles.giant}>Sur devis</p>
            <ul className={styles.checks}>
              {RESTO_CHECKS.map((c) => (
                <Check key={c}>{c}</Check>
              ))}
            </ul>
            <Link href="/prendre-rendez-vous" className={`${shared.btn} ${shared.btnBlue} ${styles.cardCta}`}>
              Prendre rendez-vous
            </Link>
          </DroppyReveal>

          <DroppyReveal className={styles.cardBlue} delay={120}>
            <p className={styles.cardEyebrowLight}>
              <span className={styles.miniBadge} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff">
                  <path d="M12 2C12 2 5 10.2 5 15a7 7 0 0 0 14 0C19 10.2 12 2 12 2Z" />
                </svg>
              </span>
              Vistaire pour vos clients
            </p>
            <p className={styles.cardBlueSub}>
              Vos clients scannent, découvrent, ont envie — sans rien installer.
            </p>
            <div className={`${shared.duotone} ${styles.cardArt}`} aria-hidden="true">
              <Image
                src="/images/demo/dishes/tarte-citron-basilic-pourpre.png"
                alt=""
                fill
                sizes="500px"
              />
            </div>
            <p className={styles.giantLight}>Gratuit</p>
            <p className={styles.cardBlueNote}>Pour vos clients, pour toujours.</p>
            <ul className={styles.checks}>
              {CLIENT_CHECKS.map((c) => (
                <Check key={c} light>{c}</Check>
              ))}
            </ul>
            <Link href="/demo" className={`${shared.btn} ${shared.btnWhite} ${styles.cardCta}`}>
              Voir la démo
            </Link>
          </DroppyReveal>
        </div>

        <DroppyReveal>
          <p className={styles.bottomNote}>
            Échangeons sur votre carte, sans engagement.
          </p>
        </DroppyReveal>
      </div>
    </section>
  );
}
