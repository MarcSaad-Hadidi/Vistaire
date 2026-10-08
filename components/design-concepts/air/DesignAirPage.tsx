"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { Reveal } from "./Reveal";
import styles from "./DesignAir.module.css";

const copy = LANDING_COPY.fr;

const DISH = {
  homard: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
  ravioles: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
  souffle: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
  pave: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
  canette: "/images/demo/dishes/canette-rotie-figues-epices.png",
  tartare: "/images/demo/dishes/tartare-saumon-label-rouge.png"
} as const;

type Moment = "midi" | "soir" | "nuit";

/* ---------------- Sky ---------------- */
function Sky({ moment }: { moment: Moment }) {
  return (
    <div className={styles.sky} data-moment={moment} aria-hidden="true">
      <div className={styles.skyGlowA} />
      <div className={styles.skyGlowB} />
    </div>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------- Nav ---------------- */
function Nav() {
  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <nav className={styles.navLinks} aria-label="Navigation principale">
          <a className={styles.navLink} href="#fonctionnalites">
            Fonctionnalités <ChevronDown />
          </a>
          <a className={styles.navLink} href="#experiences">
            Expériences <ChevronDown />
          </a>
          <Link className={styles.navLink} href="/demo">
            Tarifs
          </Link>
          <Link className={styles.navLink} href="/contact">
            Contact
          </Link>
        </nav>
        <Link className={styles.wordmark} href="#haut" aria-label="Vistaire — haut de page">
          Vistaire
        </Link>
        <div className={styles.navActions}>
          <a className={styles.loginLink} href="#carte">
            Se connecter
          </a>
          <Link className={styles.pillOutline} href="/prendre-rendez-vous">
            Prendre rendez-vous
          </Link>
          <Link className={styles.pillWhite} href="/demo">
            Voir la démo
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */
function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2c.7 4.8 3.2 7.3 8 8-4.8.7-7.3 3.2-8 8-.7-4.8-3.2-7.3-8-8 4.8-.7 7.3-3.2 8-8Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M19 3c.3 2 1.3 3 3.3 3.3-2 .3-3 1.3-3.3 3.2-.3-1.9-1.3-2.9-3.2-3.2 1.9-.3 2.9-1.3 3.2-3.3Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

function Hero() {
  return (
    <section className={styles.hero} id="haut">
      <Reveal>
        <h1 className={styles.heroTitle}>{copy.hero.title}</h1>
      </Reveal>
      <Reveal delay={120}>
        <p className={styles.heroSub}>{copy.hero.body}</p>
      </Reveal>
      <Reveal delay={220}>
        <div className={styles.heroCta}>
          <Link className={styles.pillWhite} href="/demo">
            Découvrir Vistaire
          </Link>
        </div>
      </Reveal>
      <Reveal delay={320}>
        <div>
          <Link className={styles.heroSearch} href="/demo">
            <Sparkle />
            Rechercher dans la carte…
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------- Trio cards ---------------- */
const TRIO = [
  {
    title: "Découvrir",
    body: "Valorisez chaque plat avec élégance. Des visuels à la hauteur de votre cuisine, dès le premier écran.",
    image: DISH.homard,
    alt: "Homard dressé dans une assiette gastronomique"
  },
  {
    title: "Personnaliser",
    body: "Une expérience mobile sur mesure. Une navigation fluide, pensée pour le service à table et l’identité du lieu.",
    image: DISH.ravioles,
    alt: "Ravioles dressées avec soin dans une assiette sombre"
  },
  {
    title: "Piloter",
    body: "Simple pour vous, mémorable pour eux. Une carte facile à faire évoluer, sans application à télécharger.",
    image: DISH.souffle,
    alt: "Soufflé au chocolat présenté dans une vaisselle sombre"
  }
] as const;

function Trio() {
  return (
    <section className={styles.trio} id="decouvrir" aria-label="Découvrir, personnaliser, piloter">
      {TRIO.map((card, i) => (
        <Reveal key={card.title} delay={i * 120}>
          <article className={styles.glassCard}>
            <div className={styles.cardVisual}>
              <Image src={card.image} alt={card.alt} fill sizes="(max-width: 1020px) 90vw, 33vw" />
            </div>
            <h2 className={styles.trioTitle}>{card.title}</h2>
            <p className={styles.trioBody}>{card.body}</p>
          </article>
        </Reveal>
      ))}
    </section>
  );
}

/* ---------------- Bottom banner ---------------- */
function Banner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className={styles.banner} role="note">
      <span>
        <span className={styles.bannerStrong}>Nouveau : </span>
        la 3D/AR sélective sur vos plats signatures.
      </span>
      <Link className={styles.bannerLink} href="/demo">
        Découvrir →
      </Link>
      <button
        className={styles.bannerClose}
        onClick={() => setOpen(false)}
        aria-label="Fermer le bandeau"
      >
        ×
      </button>
    </div>
  );
}

/* ---------------- Moment toggle ---------------- */
function MomentToggle({
  moment,
  onChange
}: {
  moment: Moment;
  onChange: (m: Moment) => void;
}) {
  const items: { id: Moment; label: string; icon: ReactNode }[] = [
    {
      id: "midi",
      label: "Ambiance midi",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    },
    {
      id: "soir",
      label: "Ambiance soir",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 16a6 6 0 0 1 12 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M3 16h18M12 4v3M5.6 6.6l1.8 1.8M18.4 6.6l-1.8 1.8M4 20h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    },
    {
      id: "nuit",
      label: "Ambiance nuit",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )
    }
  ];
  return (
    <div className={styles.momentToggle} role="group" aria-label="Ambiance du moment">
      {items.map((item) => (
        <button
          key={item.id}
          className={styles.momentBtn}
          data-active={moment === item.id}
          onClick={() => onChange(item.id)}
          aria-label={item.label}
          aria-pressed={moment === item.id}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Marquee helper ---------------- */
function WordMarquee({
  words,
  trackClass,
  wordClass,
  label
}: {
  words: readonly string[];
  trackClass: string;
  wordClass: string;
  label: string;
}) {
  const sets = [0, 1, 2];
  return (
    <div className={styles.marquee} role="presentation" aria-label={label}>
      <div className={trackClass}>
        {sets.map((s) => (
          <div className={styles.marqueeSet} key={s} aria-hidden={s > 0}>
            {words.map((w) => (
              <span className={wordClass} key={`${s}-${w}`}>
                {w}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Logo wall ---------------- */
const WALL_ROW_1 = [
  "Gastronomique",
  "Bistronomique",
  "Brasserie",
  "Italienne",
  "Japonaise",
  "Fruits de mer"
] as const;
const WALL_ROW_2 = [
  "Végétale",
  "Pâtisserie",
  "Café de spécialité",
  "Bar à vins",
  "Traiteur",
  "Hôtel"
] as const;

function LogoWall() {
  return (
    <section className={styles.logoWall} aria-label="Types d'établissements">
      <Reveal>
        <h2 className={styles.logoWallTitle}>
          La carte des maisons qui soignent chaque détail
        </h2>
      </Reveal>
      <WordMarquee
        words={WALL_ROW_1}
        trackClass={styles.marqueeTrack}
        wordClass={styles.marqueeWord}
        label="Première rangée de types d'établissements"
      />
      <WordMarquee
        words={WALL_ROW_2}
        trackClass={styles.marqueeTrack}
        wordClass={styles.marqueeWord}
        label="Deuxième rangée de types d'établissements"
      />
    </section>
  );
}

/* ---------------- Showcase ---------------- */
function Showcase() {
  return (
    <section className={styles.showcase} aria-label="Aperçu de la carte">
      <div className={styles.container}>
        <Reveal>
          <Link className={styles.showcaseCard} href="/demo" aria-label="Voir la démo de la carte">
            <Image
              src={DISH.canette}
              alt="Canette rôtie dressée dans une assiette gastronomique"
              fill
              sizes="(max-width: 1020px) 92vw, 960px"
            />
            <span className={styles.showcasePlay} aria-hidden="true">
              <span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 4.5v15l13-7.5-13-7.5Z" />
                </svg>
              </span>
            </span>
          </Link>
        </Reveal>
        <Reveal delay={120}>
          <div className={styles.showcaseCta}>
            <Link className={styles.pillWhite} href="/demo">
              En savoir plus
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Kinetic giant type ---------------- */
function Kinetic() {
  const line = "Le QR code n'est pas le problème. Ce qui compte, c'est après le scan.";
  return (
    <section className={styles.kinetic} aria-label="Le QR code n'est pas le problème">
      <div className={styles.kineticTrack}>
        {[0, 1, 2].map((s) => (
          <div className={styles.kineticLine} key={s} aria-hidden={s > 0}>
            {line}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Product tabs ---------------- */
const TABS = [
  {
    id: "visuelle",
    label: "Carte visuelle",
    image: DISH.homard,
    alt: "Homard dressé dans une assiette gastronomique",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="9" cy="9" r="1.6" fill="currentColor" />
        <path d="m5 19 5.5-5.5 3 3L19 11l2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    id: "fiches",
    label: "Fiches plats",
    image: DISH.ravioles,
    alt: "Ravioles dressées avec soin dans une assiette sombre",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8v4.5l3 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "outils",
    label: "Outils restaurateur",
    image: DISH.souffle,
    alt: "Soufflé au chocolat présenté dans une vaisselle sombre",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="m16.5 16.5 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
] as const;

function ProductTabs() {
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("visuelle");
  const current = TABS.find((t) => t.id === active) ?? TABS[0];
  return (
    <section className={styles.productSection} id="carte" aria-label="La carte en action">
      <div className={styles.container}>
        <Reveal>
          <div className={styles.productVisual}>
            <div className={styles.productVisualInner} key={current.id}>
              <Image
                src={current.image}
                alt={current.alt}
                fill
                sizes="(max-width: 1180px) 92vw, 1100px"
              />
            </div>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className={styles.tabBar} role="tablist" aria-label="Choisir une vue de la carte">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={styles.tab}
                data-active={active === tab.id}
                onClick={() => setActive(tab.id)}
                role="tab"
                aria-selected={active === tab.id}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </Reveal>
        <Reveal>
          <h2 className={styles.sectionTitle}>
            Vistaire donne vie à votre carte, <em>à grande échelle.</em>
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className={styles.sectionSub}>
            Organisez votre carte, valorisez chaque plat et multipliez son impact
            sur tous les écrans. Au même endroit.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Feature cards ---------------- */
const FEATURES_LARGE = [
  {
    title: "Fiches plats visuelles",
    body: "Ingrédients, description, prix et allergènes réunis dans une lecture claire.",
    image: DISH.homard,
    alt: "Homard dressé dans une assiette gastronomique"
  },
  {
    title: "3D / AR sélective",
    body: "Déclenchée par intention sur les plats pertinents, avec une image de repli.",
    image: DISH.ravioles,
    alt: "Ravioles dressées avec soin dans une assiette sombre"
  },
  {
    title: "Photos premium",
    body: "Des photos qui présentent la cuisine avec justesse et cohérence.",
    image: DISH.souffle,
    alt: "Soufflé au chocolat présenté dans une vaisselle sombre"
  },
  {
    title: "Prix et allergènes plus clairs",
    body: "Prix, allergènes et informations utiles plus clairs, pour un choix serein.",
    image: DISH.pave,
    alt: "Pavé de bœuf dressé dans une assiette gastronomique"
  }
] as const;

const FEATURES_SMALL = [
  {
    title: "Navigation fluide",
    body: "Navigation fluide et intuitive, pensée pour le service à table."
  },
  {
    title: "Sans application",
    body: "Expérience mobile fluide, sans application à télécharger."
  },
  {
    title: "Mise à jour en un geste",
    body: "Mettez à jour le contenu et la disponibilité de la carte."
  }
] as const;

function Features() {
  return (
    <section id="fonctionnalites" aria-label="Fonctionnalités">
      <div className={styles.features}>
        {FEATURES_LARGE.map((f, i) => (
          <Reveal key={f.title} delay={(i % 2) * 120}>
            <article className={styles.featureCard}>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
              <div className={styles.featureVisual}>
                <Image src={f.image} alt={f.alt} fill sizes="(max-width: 1020px) 88vw, 44vw" />
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      <div className={styles.featuresSmall}>
        {FEATURES_SMALL.map((f, i) => (
          <Reveal key={f.title} delay={i * 120}>
            <article className={styles.featureCard}>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- One-plan aurora card ---------------- */
function OnePlan() {
  return (
    <section className={styles.onePlan} aria-label="Une carte pour tout">
      <Reveal>
        <div className={styles.onePlanCard}>
          <div>
            <h2 className={styles.onePlanTitle}>Une carte. Tous vos plats.</h2>
            <p className={styles.onePlanBody}>
              Une seule carte digitale pour tous vos plats, vos langues et vos
              établissements. Sans application, sans friction.
            </p>
          </div>
          <div className={styles.onePlanCta}>
            <Link className={styles.pillOutline} href="/demo">
              Essayer la démo
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------- Stack marquee ---------------- */
const STACK_WORDS = [
  "Gastronomique",
  "Bistronomique",
  "Brasserie",
  "Italienne",
  "Japonaise",
  "Fruits de mer",
  "Végétale",
  "Pâtisserie"
] as const;

function Stack() {
  const sets = [0, 1, 2];
  return (
    <section className={styles.stack} aria-label="Compatibilité">
      <Reveal>
        <h2 className={styles.stackTitle}>
          Vistaire s’intègre à votre <em>univers</em>
        </h2>
      </Reveal>
      <div className={styles.stackMarquee}>
        <div className={styles.stackTrack}>
          {sets.map((s) => (
            <div className={styles.marqueeSet} key={s} aria-hidden={s > 0}>
              {STACK_WORDS.map((w) => (
                <span className={styles.stackWord} key={`${s}-${w}`}>
                  {w}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Giant statement ---------------- */
function Giant() {
  return (
    <section className={styles.giant} id="experiences" aria-label="Découvrir">
      <Reveal>
        <h2 className={styles.giantWord}>Découvrir</h2>
      </Reveal>
      <Reveal delay={140}>
        <p className={styles.giantSub}>
          Vistaire révèle chaque plat : visuels soignés, récit, prix et
          allergènes réunis dans une lecture claire.
        </p>
      </Reveal>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */
function FinalCta() {
  return (
    <section className={styles.finalCta} aria-label="Prendre rendez-vous">
      <Reveal>
        <h2 className={styles.finalTitle}>
          Créons une carte digitale <em>à la hauteur</em> de votre restaurant.
        </h2>
      </Reveal>
      <Reveal delay={120}>
        <p className={styles.finalSub}>{copy.finalCta.body}</p>
      </Reveal>
      <Reveal delay={200}>
        <div className={styles.finalCard}>
          <h3 className={styles.finalCardTitle}>Prendre rendez-vous</h3>
          <p className={styles.finalCardBody}>
            Présentez votre cuisine avec une expérience mobile claire, premium
            et fidèle à votre identité.
          </p>
          <div className={styles.finalCardActions}>
            <Link className={styles.btnPrimary} href="/prendre-rendez-vous">
              Prendre rendez-vous
            </Link>
            <Link className={styles.btnGhost} href="/demo">
              Voir la démo
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerGrid}>
          <div>
            <div className={styles.footerBrand}>Vistaire</div>
            <p className={styles.footerTag}>
              La carte digitale premium pour restaurants haut de gamme.
            </p>
          </div>
          <div>
            <h3 className={styles.footerColTitle}>Carte</h3>
            <Link className={styles.footerLink} href="/demo">
              Expériences
            </Link>
            <Link className={styles.footerLink} href="/demo">
              Fiches plats
            </Link>
            <Link className={styles.footerLink} href="/demo">
              3D / AR
            </Link>
          </div>
          <div>
            <h3 className={styles.footerColTitle}>Vistaire</h3>
            <Link className={styles.footerLink} href="/contact">
              Contact
            </Link>
            <Link className={styles.footerLink} href="/prendre-rendez-vous">
              Prendre rendez-vous
            </Link>
            <Link className={styles.footerLink} href="/demo">
              Démo
            </Link>
          </div>
          <div>
            <h3 className={styles.footerColTitle}>Légal</h3>
            <a className={styles.footerLink} href="#haut">
              Mentions légales
            </a>
            <a className={styles.footerLink} href="#haut">
              Confidentialité
            </a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>Vistaire © 2026 — Concept design, page de test.</span>
          <div className={styles.footerSocials}>
            <a href="#haut" aria-label="Instagram">
              Instagram
            </a>
            <a href="#haut" aria-label="LinkedIn">
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Page ---------------- */
export function DesignAirPage() {
  const [moment, setMoment] = useState<Moment>("midi");
  return (
    <div className={styles.page}>
      <Sky moment={moment} />
      <Nav />
      <main>
        <Hero />
        <Trio />
        <LogoWall />
        <Showcase />
        <Kinetic />
        <ProductTabs />
        <Features />
        <OnePlan />
        <Stack />
        <Giant />
        <FinalCta />
      </main>
      <Footer />
      <MomentToggle moment={moment} onChange={setMoment} />
      <Banner />
    </div>
  );
}
