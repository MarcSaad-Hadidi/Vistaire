"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./DroppyShowcase.module.css";
import { DroppyReveal, DroppyMarquee, DroppyFloat } from "./DroppyMotion";

/* ---------------- Circular press-style badge (cuisine words, no fake logos) ---------------- */

const CUISINES = [
  "Gastronomique",
  "Bistronomique",
  "Italienne",
  "Japonaise",
  "Brasserie",
  "Bar à vin",
  "Traiteur",
  "Café de spécialité"
];

function CircularBadge({ word, id }: { word: string; id: string }) {
  return (
    <div className={styles.badge} aria-hidden="true">
      <svg viewBox="0 0 120 120" width="104" height="104">
        <defs>
          <path id={`top-${id}`} d="M 60,60 m -44,0 a 44,44 0 1,1 88,0" />
          <path id={`bot-${id}`} d="M 60,60 m -44,0 a 44,44 0 1,0 88,0" />
        </defs>
        <text className={styles.badgeArc}>
          <textPath href={`#top-${id}`} startOffset="50%" textAnchor="middle">
            {word.toUpperCase()}
          </textPath>
        </text>
        <text className={styles.badgeArc}>
          <textPath href={`#bot-${id}`} startOffset="50%" textAnchor="middle">
            VISTAIRE
          </textPath>
        </text>
        <g transform="translate(60,60)" fill="#1a1a9e" opacity="0.85">
          <path d="M0-11C0-11-6.4-3.4-6.4 1.6a6.4 6.4 0 0 0 12.8 0C6.4-3.4 0-11 0-11Z" />
        </g>
      </svg>
    </div>
  );
}

function PressMarquee() {
  return (
    <div className={styles.press}>
      <DroppyMarquee label="Types de cuisine" duration="36s">
        {CUISINES.map((c, i) => (
          <CircularBadge key={c} word={c} id={`a-${i}`} />
        ))}
      </DroppyMarquee>
    </div>
  );
}

/* ---------------- "Make it yours" interactive-style demo card ---------------- */

function DemoCard() {
  return (
    <div className={styles.demoCard}>
      <div className={`${shared.duotone} ${styles.demoArt}`} aria-hidden="true">
        <Image
          src="/images/demo/dishes/canette-rotie-figues-epices.png"
          alt=""
          fill
          sizes="(max-width: 1180px) 100vw, 1180px"
        />
      </div>
      <DroppyFloat className={styles.demoPillWrap}>
        <div className={styles.demoPill} role="img" aria-label="Aperçu d'une fiche plat Vistaire">
          <Image
            src="/images/demo/dishes/homard-bleu-bisque-fenouil.png"
            alt=""
            width={56}
            height={56}
            className={styles.demoThumb}
          />
          <div className={styles.demoMeta}>
            <p className={styles.demoName}>Homard bleu</p>
            <p className={styles.demoSub}>Bisque de fenouil</p>
            <div className={styles.demoBar} aria-hidden="true">
              <span style={{ width: "38%" }} />
            </div>
          </div>
          <div className={styles.demoControls} aria-hidden="true">
            <span>⏮</span>
            <span className={styles.demoPlay}>⏸</span>
            <span>⏭</span>
          </div>
        </div>
      </DroppyFloat>
      <div className={styles.demoText}>
        <h2>Personnalisez votre carte.</h2>
        <p>Choisissez vos plats signatures, vos visuels, vos langues.</p>
      </div>
      <Link href="#visuels" className={styles.demoFab} aria-label="Voir les visuels">
        <span aria-hidden="true">↗</span>
      </Link>
    </div>
  );
}

/* ---------------- "The upgrade" feature grid ---------------- */

type Card = {
  title: string;
  body: string;
  image?: string;
  duotone?: boolean;
  dark?: boolean;
  span?: "wide" | "tall" | "full";
};

const CARDS: Card[] = [
  {
    title: "Maintenant, sur votre carte",
    body: "Touchez un visuel et le plat remplit tout l’écran.",
    image: "/images/demo/dishes/risotto-cepes-parmesan.png",
    span: "tall"
  },
  {
    title: "Fiches visuelles",
    body: "Nom, prix, récit court, allergènes structurés.",
    image: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    duotone: true
  },
  {
    title: "3D / AR sélective",
    body: "Réservée aux plats signatures, là où elle compte.",
    image: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
    duotone: true
  },
  {
    title: "Disponibilités en direct",
    body: "Plats, prix et visuels, mis à jour instantanément.",
    image: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    duotone: true,
    span: "full"
  },
  {
    title: "Outils restaurateur",
    body: "Plats, prix, visuels, langues : tout se pilote.",
    image: "/images/demo/dishes/bar-de-ligne-artichaut-citron.png",
    duotone: true
  },
  {
    title: "Multilingue",
    body: "Le français et l’anglais, prêts à publier.",
    image: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
    duotone: true
  },
  {
    title: "Signaux de consultation",
    body: "Voyez ce que les clients regardent vraiment.",
    image: "/images/demo/dishes/elixir-bergamote-earl-grey.png",
    duotone: true,
    span: "full"
  },
  {
    title: "Sans application",
    body: "Dans le navigateur, rien à installer.",
    image: "/images/demo/dishes/negroni-vieilli-fut.png",
    duotone: true,
    span: "full"
  },
  {
    title: "Accords suggérés",
    body: "Chaque plat propose ses accords, sans quitter la fiche.",
    image: "/images/demo/dishes/maison-elyse-n1.png",
    duotone: true,
    span: "full"
  },
  {
    title: "Allergènes limpides",
    body: "Tout ce qu’il faut savoir, à un toucher.",
    image: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
    duotone: true
  },
  {
    title: "Récits de plats",
    body: "L’histoire de chaque assiette, en une lecture claire.",
    image: "/images/demo/dishes/canette-rotie-figues-epices.png",
    dark: true
  },
  {
    title: "Photos premium",
    body: "Vos plats sublimés, fidèles à l’assiette.",
    image: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
    duotone: true
  }
];

function FeatureCard({ card, index }: { card: Card; index: number }) {
  const cls = [
    styles.fcard,
    card.span === "tall" ? styles.fcardTall : "",
    card.span === "full" ? styles.fcardFull : "",
    card.dark ? styles.fcardDark : ""
  ].join(" ");
  return (
    <DroppyReveal className={cls} delay={(index % 3) * 90}>
      {card.image ? (
        card.duotone ? (
          <div className={`${shared.duotone} ${styles.fcardBg}`} aria-hidden="true">
            <Image src={card.image} alt="" fill sizes="600px" />
          </div>
        ) : (
          <div className={styles.fcardBg} aria-hidden="true">
            <Image src={card.image} alt="" fill sizes="600px" />
          </div>
        )
      ) : null}
      <div className={styles.fcardScrim} aria-hidden="true" />
      <div className={styles.fcardText}>
        <h3>{card.title}</h3>
        <p>{card.body}</p>
      </div>
    </DroppyReveal>
  );
}

function UpgradeGrid() {
  return (
    <section id="fiches" className={`${shared.section} ${styles.upgrade}`} data-nav-dark aria-label="Fonctionnalités">
      <div className={shared.wrap}>
        <DroppyReveal>
          <h2 className={shared.title}>La carte que votre restaurant mérite</h2>
          <p className={shared.sub}>
            Un PDF ne fait pas vivre votre menu. Le QR code n’est pas le
            problème — ce qui compte, c’est ce que le client découvre après le
            scan.
          </p>
        </DroppyReveal>
        <div className={styles.fgrid}>
          {CARDS.map((c, i) => (
            <FeatureCard key={c.title} card={c} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Black "go further" section ---------------- */

function Further() {
  const [paused, setPaused] = useState(false);
  return (
    <section className={styles.further} data-nav-dark={false} aria-label="Aller plus loin">
      <div className={shared.wrap}>
        <DroppyReveal>
          <h2 className={styles.furtherTitle}>
            Votre carte peut aller
            <br />
            plus loin. Bien plus loin.
          </h2>
          <p className={styles.furtherSub}>
            Ce n’est qu’une petite partie de Vistaire, il y a tellement plus.
          </p>
        </DroppyReveal>
        <DroppyFloat paused={paused} className={styles.furtherPillWrap}>
          <div className={styles.furtherPill} role="img" aria-label="Fiche plat flottante">
            <Image
              src="/images/demo/dishes/souffle-chocolat-grand-cru.png"
              alt=""
              width={72}
              height={72}
              className={styles.furtherThumb}
            />
            <div className={styles.furtherMeta}>
              <p>Soufflé au chocolat</p>
              <span>Grand cru · 3D</span>
            </div>
            <span className={styles.furtherPlay} aria-hidden="true">
              ⏸
            </span>
          </div>
        </DroppyFloat>
        <button
          type="button"
          className={styles.furtherPause}
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Reprendre l’animation" : "Mettre l’animation en pause"}
        >
          <span aria-hidden="true">{paused ? "▶" : "⏸"}</span>
        </button>
      </div>
    </section>
  );
}

export function DroppyShowcase() {
  return (
    <>
      <section className={`${shared.section} ${styles.demoSection}`} aria-label="Personnalisation">
        <div className={shared.wrap}>
          <DroppyReveal>
            <DemoCard />
          </DroppyReveal>
        </div>
      </section>
      <PressMarquee />
      <UpgradeGrid />
      <Further />
    </>
  );
}
