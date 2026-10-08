"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { Reveal } from "./Reveal";
import styles from "./DesignAir.module.css";

const copy = LANDING_COPY.fr;

type Moment = "midi" | "soir" | "nuit";

const MOMENTS: { id: Moment; label: string }[] = [
  { id: "midi", label: "Midi" },
  { id: "soir", label: "Soir" },
  { id: "nuit", label: "Nuit" }
];

const TRIO_CARDS = [
  {
    title: "Découvrir",
    body: "Comprenez ce que vos clients consultent vraiment sur votre carte.",
    image: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    alt: "Pavé de bœuf dressé dans une assiette gastronomique"
  },
  {
    title: "Personnaliser",
    body: "Une carte fidèle à l'identité, au menu et au niveau de service du lieu.",
    image: "/images/demo/dishes/risotto-cepes-parmesan.png",
    alt: "Risotto aux cèpes présenté avec soin"
  },
  {
    title: "Piloter",
    body: "Plats, prix, disponibilités : ajustez votre carte en un instant.",
    image: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    alt: "Tartare de saumon dressé avec précision"
  }
] as const;

const MARQUEE_ITEMS = [
  "Bistronomique",
  "Gastronomique",
  "Brasserie",
  "Bistro",
  "Table d'hôte",
  "Cave à manger",
  "Restaurant de quartier",
  "Cuisine d'auteur"
];

const KINETIC_LINE = "Le QR code n'est pas le problème.";

const TABS = ["Carte visuelle", "Fiches plats", "Outils restaurateur"] as const;

function Header() {
  return (
    <header className={styles.header}>
      <nav aria-label="Navigation principale" className={styles.headerInner}>
        <div className={styles.headerLinks}>
          <Link href="#fonctionnalites">Fonctionnalités</Link>
          <Link href="#experiences">Expériences</Link>
          <Link href="#rendez-vous">Tarifs</Link>
        </div>
        <Link href="/design-air" className={styles.logo} aria-label="Vistaire — accueil du concept">
          Vistaire
        </Link>
        <div className={styles.headerRight}>
          <Link href="/demo" className={styles.loginLink}>
            Se connecter
          </Link>
          <Link href="/prendre-rendez-vous" className={styles.ctaPill}>
            Prendre rendez-vous
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Hero({ moment, setMoment }: { moment: Moment; setMoment: (m: Moment) => void }) {
  return (
    <section className={styles.hero} aria-labelledby="design-air-hero-title">
      <Reveal>
        <p className={styles.eyebrow}>{copy.hero.eyebrow}</p>
      </Reveal>
      <Reveal delay={90}>
        <h1 id="design-air-hero-title" className={styles.heroTitle}>
          {copy.hero.title}
        </h1>
      </Reveal>
      <Reveal delay={180}>
        <p className={styles.heroSubtitle}>{copy.hero.body}</p>
      </Reveal>
      <Reveal delay={260}>
        <div className={styles.heroCtas}>
          <Link href="/prendre-rendez-vous" className={styles.ctaPillLarge}>
            Prendre rendez-vous
          </Link>
          <div className={styles.momentWrap} role="group" aria-label="Ambiance du moment">
            <span className={styles.momentLabel}>Ambiance</span>
            <div className={styles.momentPill}>
              {MOMENTS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`${styles.momentOption} ${moment === m.id ? styles.momentActive : ""}`}
                  aria-pressed={moment === m.id}
                  onClick={() => setMoment(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
      <div className={styles.trioGrid}>
        {TRIO_CARDS.map((card, i) => (
          <Reveal key={card.title} delay={i * 110}>
            <article className={styles.glassCard}>
              <div className={styles.cardMedia}>
                <Image
                  src={card.image}
                  alt={card.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className={styles.cardImage}
                />
              </div>
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Marquee() {
  return (
    <div className={styles.marquee} aria-label="Types de restaurants">
      <div className={styles.marqueeTrack}>
        {[0, 1, 2].map((copyIndex) => (
          <div key={copyIndex} className={styles.marqueeSet} aria-hidden={copyIndex > 0}>
            {MARQUEE_ITEMS.map((item) => (
              <span key={item} className={styles.marqueeItem}>
                {item}
                <span className={styles.marqueeDot} aria-hidden="true">
                  •
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Kinetic() {
  return (
    <section className={styles.section} aria-label="Manifeste">
      <div className={styles.kineticMarquee} aria-label="Le QR code n'est pas le problème.">
        <div className={styles.kineticTrack}>
          {[0, 1, 2].map((copyIndex) => (
            <span key={copyIndex} className={styles.kineticLine} aria-hidden={copyIndex > 0}>
              {KINETIC_LINE}
            </span>
          ))}
        </div>
      </div>
      <Reveal delay={200}>
        <p className={styles.kineticFollow}>
          Ce qui compte, c&apos;est ce que le client découvre après le scan.
        </p>
      </Reveal>
    </section>
  );
}

function Experiences() {
  return (
    <section id="experiences" className={styles.section} aria-labelledby="design-air-experiences-title">
      <Reveal>
        <p className={styles.eyebrow}>{copy.experiences.eyebrow}</p>
        <h2 id="design-air-experiences-title" className={styles.sectionTitle}>
          {copy.experiences.title}
        </h2>
        <p className={styles.sectionBody}>{copy.experiences.body}</p>
      </Reveal>
      <Reveal delay={120}>
        <div className={styles.experienceChips}>
          <span className={styles.experienceChip}>Sauge Noire</span>
          <span className={styles.experienceChip}>Maison Élysée</span>
          <Link href="/demo" className={styles.ghostPill}>
            {copy.experiences.cta}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function TabPanel() {
  const [active, setActive] = useState<(typeof TABS)[number]>("Carte visuelle");
  const dishes = copy.dishes.items;
  const owner = copy.owner.items;

  return (
    <section className={styles.section} aria-labelledby="design-air-tabs-title">
      <Reveal>
        <p className={styles.eyebrow}>{copy.dishes.eyebrow}</p>
        <h2 id="design-air-tabs-title" className={styles.sectionTitle}>
          {copy.dishes.title}
        </h2>
        <p className={styles.sectionBody}>{copy.dishes.body}</p>
      </Reveal>
      <Reveal delay={100}>
        <div className={styles.tabList} role="tablist" aria-label="Vues de la carte">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active === tab}
              className={`${styles.tab} ${active === tab ? styles.tabActive : ""}`}
              onClick={() => setActive(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </Reveal>
      <div className={styles.tabPanel} role="tabpanel">
        {active === "Carte visuelle" && (
          <article className={`${styles.glassCard} ${styles.tabCard}`}>
            <div className={styles.tabMedia}>
              <Image
                src={dishes[2].image}
                alt={dishes[2].alt}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className={styles.cardImage}
              />
            </div>
            <div>
              <h3>{dishes[2].title}</h3>
              <p>{dishes[2].body}</p>
            </div>
          </article>
        )}
        {active === "Fiches plats" && (
          <article className={`${styles.glassCard} ${styles.tabCard}`}>
            <div className={styles.tabMedia}>
              <Image
                src={dishes[0].image}
                alt={dishes[0].alt}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className={styles.cardImage}
              />
            </div>
            <div>
              <h3>{dishes[0].title}</h3>
              <p>{dishes[0].body}</p>
            </div>
          </article>
        )}
        {active === "Outils restaurateur" && (
          <article className={`${styles.glassCard} ${styles.tabCardOwner}`}>
            <div>
              <h3>{copy.owner.title}</h3>
              <p>{copy.owner.body}</p>
            </div>
            <ul className={styles.ownerList}>
              {owner.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </li>
              ))}
              <li>
                <strong>{dishes[1].title}</strong>
                <span>{dishes[1].body}</span>
              </li>
            </ul>
          </article>
        )}
      </div>
    </section>
  );
}

function Features() {
  const blocks = [
    ...copy.value.items.map((text) => ({ title: text, body: "" })),
    { title: copy.owner.items[0].title, body: copy.owner.items[0].body }
  ];
  return (
    <section
      id="fonctionnalites"
      className={styles.section}
      aria-labelledby="design-air-features-title"
    >
      <Reveal>
        <p className={styles.eyebrow}>{copy.value.eyebrow}</p>
        <h2 id="design-air-features-title" className={styles.sectionTitle}>
          {copy.value.title}
        </h2>
        <p className={styles.sectionBody}>{copy.value.body}</p>
      </Reveal>
      <div className={styles.featuresGrid}>
        {blocks.map((block, i) => (
          <Reveal key={block.title} delay={(i % 3) * 90}>
            <article className={styles.featureCard}>
              <h3>{block.title}</h3>
              {block.body && <p>{block.body}</p>}
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Cream() {
  return (
    <section className={styles.cream} aria-labelledby="design-air-cream-title">
      <Reveal>
        <article className={styles.creamCard}>
          <p className={styles.creamEyebrow}>Une question ?</p>
          <h2 id="design-air-cream-title">Parlons de votre restaurant.</h2>
          <p>
            Un échange de quelques minutes pour imaginer la carte digitale qui
            ressemble à votre établissement.
          </p>
          <Link href="/prendre-rendez-vous" className={styles.ctaPillDark}>
            Prendre rendez-vous
          </Link>
        </article>
      </Reveal>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="rendez-vous" className={styles.section} aria-labelledby="design-air-final-title">
      <Reveal>
        <h2 id="design-air-final-title" className={styles.sectionTitle}>
          {copy.finalCta.title}
        </h2>
        <p className={styles.sectionBody}>{copy.finalCta.body}</p>
      </Reveal>
      <Reveal delay={120}>
        <Link href="/prendre-rendez-vous" className={styles.ctaPillLarge}>
          {copy.finalCta.cta}
        </Link>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <Link href="/design-air" className={styles.logo} aria-label="Vistaire">
        Vistaire
      </Link>
      <nav aria-label="Pied de page" className={styles.footerLinks}>
        <Link href="/demo">Démo</Link>
        <Link href="/prendre-rendez-vous">Prendre rendez-vous</Link>
        <Link href="/contact">Contact</Link>
      </nav>
      <p className={styles.footerNote}>© 2026 Vistaire — Concept de test.</p>
    </footer>
  );
}

export function DesignAirPage() {
  const [moment, setMoment] = useState<Moment>("midi");

  return (
    <div className={styles.page} data-moment={moment}>
      <div className={styles.sky} aria-hidden="true">
        <div className={styles.skyGlow} />
      </div>
      <div className={styles.content}>
        <Header />
        <main>
          <Hero moment={moment} setMoment={setMoment} />
          <Marquee />
          <Kinetic />
          <Experiences />
          <TabPanel />
          <Features />
          <Cream />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </div>
  );
}
