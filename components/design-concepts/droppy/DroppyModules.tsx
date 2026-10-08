"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./DroppyModules.module.css";
import {
  DroppyReveal,
  DroppyWordReveal,
  DroppyMarquee,
  DroppyFloat
} from "./DroppyMotion";

/* ---------------- "Just add Droplets" → module grid ---------------- */

type Module = { icon: string; name: string; desc: string; signature?: boolean };

const MODULES: Module[] = [
  { icon: "◈", name: "Fiches plats", desc: "Nom, prix, récit, allergènes.", signature: true },
  { icon: "✦", name: "Photos premium", desc: "Vos plats sublimés.", signature: true },
  { icon: "◎", name: "3D / AR", desc: "Sur vos plats signatures.", signature: true },
  { icon: "❖", name: "Allergènes", desc: "Structurés et limpides." },
  { icon: "⬔", name: "Accords", desc: "Mets et vins suggérés." },
  { icon: "⬣", name: "Multilingue", desc: "Français et anglais." },
  { icon: "◐", name: "Disponibilités", desc: "À jour instantanément." },
  { icon: "◑", name: "Signaux", desc: "Ce que regardent vos clients." },
  { icon: "⬢", name: "QR unique", desc: "Un code, toute la carte." },
  { icon: "◆", name: "Multi-établissements", desc: "Vos adresses, une gestion." },
  { icon: "●", name: "Sans application", desc: "Dans le navigateur." },
  { icon: "▲", name: "Mise à jour instantanée", desc: "Sans réimpression." },
  { icon: "■", name: "Récits de plats", desc: "L’histoire de l’assiette." },
  { icon: "✚", name: "Plats du moment", desc: "Mettez en avant l’éphémère.", signature: true },
  { icon: "◈", name: "Carte des vins", desc: "Votre cave, valorisée." },
  { icon: "✦", name: "Menus dégustation", desc: "Vos formules, clairement." },
  { icon: "◎", name: "Desserts", desc: "La touche finale.", signature: true },
  { icon: "❖", name: "Boissons", desc: "Carte complète." },
  { icon: "⬔", name: "Petit-déjeuner", desc: "Un autre rythme." },
  { icon: "⬣", name: "Brunch", desc: "Le week-end." },
  { icon: "◐", name: "Terrasse", desc: "La carte d’été." },
  { icon: "◑", name: "Traiteur", desc: "Vos événements." },
  { icon: "⬢", name: "À emporter", desc: "Clair, même à distance." },
  { icon: "◆", name: "Groupes", desc: "Les grandes tablées." }
];

function DropletsGrid() {
  const [signaturesOnly, setSignaturesOnly] = useState(false);
  const visible = signaturesOnly ? MODULES.filter((m) => m.signature) : MODULES;
  return (
    <section id="outils" className={`${shared.section} ${styles.droplets}`} aria-label="Modules de la carte">
      <div className={shared.wrap}>
        <DroppyReveal>
          <h2 className={styles.dropletsTitle}>
            Composez votre carte
            <button
              type="button"
              role="switch"
              aria-checked={signaturesOnly}
              aria-label="Afficher uniquement les modules signatures"
              className={`${styles.toggle} ${signaturesOnly ? styles.toggleOn : ""}`}
              onClick={() => setSignaturesOnly((v) => !v)}
            >
              <span className={styles.toggleKnob} aria-hidden="true" />
            </button>
          </h2>
          <p className={styles.dropletsSub}>
            Des fiches prêtes, pensées comme de vraies pages. Activez{" "}
            <span className={styles.inlinePill}>ce que vous voulez</span>, masquez{" "}
            <span className={styles.inlinePill}>le reste</span>. Quand vous voulez.{" "}
            <Link href="/demo" className={styles.inlineLink}>
              Voir la démo <span aria-hidden="true">↗</span>
            </Link>
          </p>
        </DroppyReveal>
      </div>
      <DroppyReveal className={styles.gridScroll}>
        <div className={styles.grid} role="list" aria-label="Modules disponibles">
          {visible.map((m) => (
            <div key={m.name} className={styles.moduleCard} role="listitem">
              <span className={styles.moduleIcon} aria-hidden="true">{m.icon}</span>
              <p className={styles.moduleName}>{m.name}</p>
              <p className={styles.moduleDesc}>{m.desc}</p>
            </div>
          ))}
        </div>
      </DroppyReveal>
    </section>
  );
}

/* ---------------- Sync section ---------------- */

function Sync() {
  return (
    <section className={`${shared.section} ${styles.sync}`} aria-label="Synchronisation">
      <div className={shared.wrap}>
        <DroppyWordReveal
          text="Tout se met à jour instantanément."
          sub="Qu’allez-vous changer en premier ?"
        />
        <DroppyReveal>
          <p className={styles.syncBody}>
            Plats, prix, visuels et disponibilités : modifié une fois, à jour
            partout. Sans réimpression, sans délai.
          </p>
          <p className={styles.syncBody}>
            Suivez les <span className={styles.chip}>◐ Disponibilités</span> et
            voyez quand <span className={styles.chip}>⬣ Multilingue</span> touche
            vos clients anglophones, directement depuis votre navigateur. Ajoutez
            un plat, il apparaît dans la carte.
          </p>
          <div className={styles.syncPillRow}>
            <span className={styles.syncPill}>
              <span aria-hidden="true">●</span> Sans application à installer{" "}
              <span aria-hidden="true">▾</span>
            </span>
          </div>
        </DroppyReveal>
      </div>
      <DroppyReveal className={styles.syncPhotoWrap}>
        <div className={`${shared.duotone} ${styles.syncPhoto}`}>
          <Image
            src="/images/demo/dishes/maison-elyse-n1.png"
            alt="Salle de restaurant"
            fill
            sizes="(max-width: 1400px) 100vw, 1400px"
          />
        </div>
      </DroppyReveal>
    </section>
  );
}

/* ---------------- Black "design" section ---------------- */

function NotchBlack() {
  return (
    <section className={styles.notchBlack} data-nav-dark={false} aria-label="Plats signatures">
      <div className={shared.wrap}>
        <DroppyReveal>
          <h2 className={styles.notchBlackTitle}>Sublimez vos plats signatures.</h2>
          <p className={styles.notchBlackSub}>
            La 3D, les grands visuels, les récits : l’exception pour l’exceptionnel.
          </p>
        </DroppyReveal>
        <div className={styles.notchFloats}>
          <DroppyFloat className={styles.notchFloatCard}>
            <Image
              src="/images/demo/dishes/homard-bleu-bisque-fenouil.png"
              alt=""
              width={64}
              height={64}
              className={styles.notchThumb}
            />
            <div>
              <p>Homard bleu</p>
              <span>3D · Bisque de fenouil</span>
            </div>
          </DroppyFloat>
          <DroppyFloat className={styles.notchFloatCard} style={{ animationDelay: "-2.2s" }}>
            <Image
              src="/images/demo/dishes/souffle-chocolat-grand-cru.png"
              alt=""
              width={64}
              height={64}
              className={styles.notchThumb}
            />
            <div>
              <p>Soufflé au chocolat</p>
              <span>Grand cru · Récit</span>
            </div>
          </DroppyFloat>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Customize word-reveal + demo card ---------------- */

function Customize() {
  return (
    <section className={`${shared.section} ${styles.customize}`} data-nav-dark aria-label="Personnalisation">
      <div className={shared.wrap}>
        <DroppyReveal className={styles.customBadgeWrap}>
          <div className={styles.customBadge} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="#fff">
              <path d="M12 2C12 2 5 10.2 5 15a7 7 0 0 0 14 0C19 10.2 12 2 12 2Z" />
              <circle cx="9.4" cy="14.6" r="1.7" fill="#1200ff" />
              <circle cx="14.6" cy="14.6" r="1.7" fill="#1200ff" />
            </svg>
          </div>
        </DroppyReveal>
        <DroppyWordReveal
          text="Personnalisez votre carte, faites-en vraiment la vôtre. Ajoutez vos plats, réordonnez-les, mettez vos signatures en avant."
          sub="Qu’allez-vous mettre en avant ?"
        />
        <DroppyReveal className={styles.demoCardWrap}>
          <div className={styles.demoCard}>
            <div className={`${shared.duotone} ${styles.demoArt}`} aria-hidden="true">
              <Image
                src="/images/demo/dishes/tartare-saumon-label-rouge.png"
                alt=""
                fill
                sizes="(max-width: 1180px) 100vw, 1180px"
              />
            </div>
            <div className={styles.composer} role="img" aria-label="Composeur de carte : glissez vos plats">
              <div className={styles.composerRow}>
                {[
                  "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
                  "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
                  "/images/demo/dishes/souffle-chocolat-grand-cru.png",
                  "/images/demo/dishes/tarte-citron-basilic-pourpre.png"
                ].map((src) => (
                  <Image key={src} src={src} alt="" width={46} height={46} className={styles.composerChip} />
                ))}
                <span className={styles.composerCancel} aria-hidden="true">✕</span>
                <span className={styles.composerOk} aria-hidden="true">✓</span>
              </div>
              <p className={styles.composerHint}>Glissez vos plats, validez.</p>
            </div>
          </div>
        </DroppyReveal>
      </div>
    </section>
  );
}

/* ---------------- Language marquee ---------------- */

const LANGS = [
  { flag: "🇫🇷", hello: "Bonjour, Vistaire !", lang: "Français" },
  { flag: "🇬🇧", hello: "Hello, Vistaire!", lang: "English" }
];

function LanguageMarquee() {
  return (
    <section className={`${shared.section} ${styles.lang}`} data-nav-dark aria-label="Langues">
      <div className={shared.wrap}>
        <DroppyReveal>
          <h2 className={styles.langTitle}>
            Vistaire parle votre langue.{" "}
            <span className={styles.langDim}>Deux langues, entièrement traduites.</span>
          </h2>
        </DroppyReveal>
      </div>
      <DroppyMarquee label="Langues disponibles" duration="26s">
        {LANGS.map((l) => (
          <span key={l.lang} className={styles.langPill}>
            <span aria-hidden="true" className={styles.langFlag}>{l.flag}</span>
            <strong>{l.hello}</strong>
            <span className={styles.langName}>{l.lang}</span>
          </span>
        ))}
      </DroppyMarquee>
    </section>
  );
}

export function DroppyDroplets() {
  return <DropletsGrid />;
}

export function DroppyModules() {
  return (
    <>
      <Sync />
      <NotchBlack />
      <Customize />
      <LanguageMarquee />
    </>
  );
}
