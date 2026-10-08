"use client";

import Image from "next/image";
import Link from "next/link";
import { Parallax, Reveal, Sticker, WordReveal } from "./TigerMotion";
import shared from "./shared.module.css";
import styles from "./TigerSections.module.css";

/* ------------------------------------------------------------------ */
/* CE QUE LA CARTE OFFRE — split: dark panel + magenta photo panel     */
/* ------------------------------------------------------------------ */
const INSIDE_ROWS = [
  {
    img: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
    text: "Fiches plats riches, claires et visuelles"
  },
  {
    img: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
    text: "3D / AR sélective sur les plats signatures"
  },
  {
    img: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
    text: "Prix, allergènes et infos toujours à jour"
  }
];

export function TigerInside() {
  return (
    <section id="carte" className={styles.split} aria-label="Ce que la carte offre">
      <div className={styles.darkPanel}>
        <h2 className={`${shared.giantTitle} ${styles.splitTitle}`}>
          Dans
          <br />
          la carte
        </h2>
        <hr className={shared.dottedLine} aria-hidden="true" />
        <p className={shared.caps}>
          Votre carte digitale est pensée pour le service, pas pour l&rsquo;imprimante.
        </p>
        <ul className={styles.rows}>
          {INSIDE_ROWS.map((row, i) => (
            <Reveal as="li" key={row.text} delay={i * 120} className={styles.row}>
              <span className={shared.badge}>
                <Image src={row.img} alt="" width={64} height={64} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
              </span>
              <p className={shared.caps}>{row.text}</p>
            </Reveal>
          ))}
        </ul>
      </div>
      <div className={`${styles.pinkPanel} ${styles.brush}`} aria-hidden="true">
        <Parallax
          src="/images/demo/dishes/souffle-chocolat-grand-cru.png"
          alt=""
          className={styles.pinkPhoto}
          imgClassName={styles.pinkPhotoInner}
          factor={0.88}
          sizes="(max-width: 900px) 100vw, 50vw"
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* MANIFESTO — split sticky: dark scrolling text + magenta photo       */
/* ------------------------------------------------------------------ */
export function TigerManifesto() {
  return (
    <div className={styles.manifestoWrap}>
      <div className={styles.split}>
        <div className={styles.darkPanel}>
          <WordReveal
            text="UN PDF NE FAIT PAS VIVRE VOTRE MENU."
            className={`${shared.giantTitle} ${styles.manifestoTitle}`}
            dimClassName={styles.dim}
            litClassName={styles.lit}
          />
          <div className={styles.manifestoGap} aria-hidden="true" />
          <WordReveal
            text="LE QR CODE N'EST PAS LE PROBLÈME. CE QUI COMPTE, C'EST CE QUE LE CLIENT DÉCOUVRE APRÈS LE SCAN."
            className={`${shared.giantTitle} ${styles.manifestoTitle}`}
            dimClassName={styles.dim}
            litClassName={styles.lit}
          />
        </div>
        <div className={`${styles.pinkPanel} ${styles.brush} ${styles.stickyPhoto}`} aria-hidden="true">
          <Parallax
            src="/images/demo/dishes/ravioles-chevre-miel-monteregie.png"
            alt=""
            className={styles.pinkPhoto}
            imgClassName={styles.pinkPhotoInner}
            factor={0.85}
            sizes="(max-width: 900px) 100vw, 50vw"
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TRADITION & CRÉATION — mustard, scrapbook polaroids                */
/* ------------------------------------------------------------------ */
const POLAROIDS = [
  {
    img: "/images/demo/dishes/canette-rotie-figues-epices.png",
    num: "1",
    caption: "Des visuels à la hauteur des plats"
  },
  {
    img: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    num: "2",
    caption: "Une navigation pensée pour le service"
  },
  {
    img: "/images/demo/dishes/risotto-cepes-parmesan.png",
    num: "3",
    caption: "Une identité fidèle au lieu"
  }
];

export function TigerTradition() {
  return (
    <section className={styles.mustard} aria-label="Tradition et création">
      <h2 className={`${shared.giantTitle} ${styles.tradTitle}`}>
        <span className={styles.tradLit}>Tradition</span>
        <br />
        <span className={styles.tradLit}>&amp;</span>{" "}
        <span className={styles.tradDim}>Création</span>
      </h2>
      <p className={shared.caps}>
        De la cuisine à la carte, nous capturons l&rsquo;identité de chaque restaurant.
      </p>
      <div className={styles.polaroids}>
        {POLAROIDS.map((p, i) => (
          <Reveal
            key={p.num}
            className={styles.polaroid}
            rotate={i % 2 === 0 ? "-3deg" : "2.5deg"}
            delay={i * 120}
          >
            <Parallax
              src={p.img}
              alt=""
              className={styles.polaroidPhoto}
              imgClassName={styles.polaroidInner}
              factor={0.9}
              sizes="(max-width: 900px) 90vw, 30vw"
            />
            <span className={`${shared.badge} ${shared.badgeChoc} ${styles.polaroidNum}`}>
              {p.num}
            </span>
            <p className={shared.caps}>{p.caption}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* POURQUOI LA CARTE COMPTE — stickers + 3 colonnes                    */
/* ------------------------------------------------------------------ */
const WHY_COLS = [
  {
    img: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    title: "Disponibilités",
    body: "Mettez à jour le contenu et la disponibilité de la carte en un geste."
  },
  {
    img: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
    title: "Fiches plats",
    body: "Ingrédients, description, prix et allergènes réunis dans une lecture claire."
  },
  {
    img: "/images/demo/dishes/bar-de-ligne-artichaut-citron.png",
    title: "Langues",
    body: "Publiez les langues prêtes et gérez les cartes de vos établissements."
  }
];

export function TigerWhy() {
  return (
    <section id="plats" className={styles.mustard} aria-label="Pourquoi la carte compte">
      <div className={styles.whyHead}>
        <h2 className={`${shared.giantTitle} ${styles.whyTitle}`}>
          <span className={styles.stickerSlot}>
            <Sticker tilt="-15deg" delay={0}>Sans application</Sticker>
          </span>
          Pourquoi la
          <br />
          carte compte
          <span className={styles.stickerSlot}>
            <Sticker tilt="10deg" delay={100}>Toujours à jour</Sticker>
          </span>
          <span className={styles.stickerSlot}>
            <Sticker tilt="-12deg" delay={200}>100% visuel</Sticker>
          </span>
        </h2>
        <p className={shared.caps}>
          Une carte claire, rapide et fidèle à votre identité — prête à donner
          envie, à chaque scan.
        </p>
      </div>
      <div className={styles.cols}>
        {WHY_COLS.map((col, i) => (
          <Reveal as="article" key={col.title} delay={i * 120} className={styles.col}>
            <span className={`${shared.badge} ${shared.badgeChoc}`}>
              <Image src={col.img} alt="" width={64} height={64} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
            </span>
            <h3 className={shared.caps}>{col.title}</h3>
            <p className={shared.caps}>{col.body}</p>
            <Parallax
              src={col.img}
              alt=""
              className={styles.colPhoto}
              imgClassName={styles.colPhotoInner}
              factor={0.88}
              sizes="(max-width: 900px) 90vw, 28vw"
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* UNLOCK — full-screen magenta photo CTA                             */
/* ------------------------------------------------------------------ */
export function TigerUnlock() {
  return (
    <section className={`${styles.unlock} ${styles.brush}`} aria-label="Révélez votre carte">
      <Parallax
        src="/images/demo/dishes/pave-boeuf-mature-bordelaise.png"
        alt=""
        className={styles.unlockPhoto}
        imgClassName={styles.unlockPhotoInner}
        factor={0.9}
        sizes="100vw"
      />
      <div className={styles.unlockCopy}>
        <h2 className={`${shared.giantTitle} ${styles.unlockTitle}`}>
          Révélez la magie
          <br />
          de votre carte
        </h2>
        <Link href="/prendre-rendez-vous" className={shared.pill}>
          Prendre rendez-vous
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* DÉCOUVREZ LES EXPÉRIENCES — 3 mustard cards                        */
/* ------------------------------------------------------------------ */
const EXPERIENCES = [
  {
    name: "Sauge Noire",
    img: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
    blurb: "Une carte sombre et immersive, pensée pour une cuisine audacieuse."
  },
  {
    name: "Maison Élysée",
    img: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
    blurb: "Une carte lumineuse et délicate, à l'image d'une grande maison."
  },
  {
    name: "Trouvable",
    img: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
    blurb: "Une carte directe et appétissante, qui donne envie d'y goûter."
  }
];

export function TigerCooking() {
  return (
    <section id="experiences" className={`${styles.cooking} ${shared.rustBg} ${shared.grain}`} aria-label="Découvrez les expériences">
      <span className={`${shared.badge} ${styles.cookIcon}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v20M2 12h20" strokeLinecap="round" opacity="0" />
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" strokeLinecap="round" />
        </svg>
      </span>
      <h2 className={`${shared.giantTitle} ${styles.cookTitle}`}>
        Découvrez
        <br />
        les expériences
      </h2>
      <Link href="/demo" className={shared.pill}>
        Toutes les expériences
      </Link>
      <div className={styles.cards}>
        {EXPERIENCES.map((exp, i) => (
          <Reveal as="article" key={exp.name} delay={i * 120} className={styles.card}>
            <div className={styles.cardPhoto}>
              <Image src={exp.img} alt={`Expérience ${exp.name}`} fill sizes="(max-width: 900px) 90vw, 30vw" style={{ objectFit: "cover" }} />
            </div>
            <div className={styles.cardMeta}>
              <span className={styles.cardTag}>Expérience</span>
              <span className={styles.cardTag}>Démo</span>
            </div>
            <h3 className={`${shared.giantTitle} ${styles.cardTitle}`}>{exp.name}</h3>
            <p className={styles.cardBlurb}>{exp.blurb}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* CTA SPLIT — mustard + magenta photo                                */
/* ------------------------------------------------------------------ */
export function TigerNewsletter() {
  return (
    <section className={styles.split} aria-label="Prendre rendez-vous">
      <div className={styles.mustardPanel}>
        <h2 className={`${shared.giantTitle} ${styles.ctaTitle}`}>
          Prenez rendez-vous. Créons votre carte.
        </h2>
        <Link href="/prendre-rendez-vous" className={`${shared.pill} ${shared.pillChoc} ${styles.ctaBig}`}>
          Prendre rendez-vous
        </Link>
        <p className={shared.caps}>
          Discutons de votre restaurant et de ce que votre carte pourrait devenir.
        </p>
      </div>
      <div className={`${styles.pinkPanel} ${styles.brush}`} aria-hidden="true">
        <div className={styles.tiltPhoto}>
          <Image
            src="/images/demo/dishes/tarte-citron-basilic-pourpre.png"
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FOOTER — dark, giant logotype, link columns, dotted divider        */
/* ------------------------------------------------------------------ */
const FOOT_COLS: { links: { label: string; href: string }[] }[] = [
  {
    links: [
      { label: "Carte", href: "#carte" },
      { label: "Expériences", href: "#experiences" },
      { label: "Plats", href: "#plats" },
      { label: "Contact", href: "/contact" }
    ]
  },
  {
    links: [
      { label: "Prendre rendez-vous", href: "/prendre-rendez-vous" },
      { label: "Voir la démo", href: "/demo" }
    ]
  },
  {
    links: [
      { label: "Mentions légales", href: "/contact" },
      { label: "Confidentialité", href: "/contact" }
    ]
  }
];

export function TigerFooter() {
  return (
    <footer className={styles.footer} aria-label="Pied de page">
      <p className={`${shared.giantTitle} ${styles.footLogo}`} aria-label="Vistaire">
        Vistaire
      </p>
      <div className={styles.footGrid}>
        {FOOT_COLS.map((col, i) => (
          <ul key={i} className={styles.footCol}>
            {col.links.map((l) =>
              l.href.startsWith("#") ? (
                <li key={l.label}>
                  <a href={l.href} className={styles.footLink}>{l.label}</a>
                </li>
              ) : (
                <li key={l.label}>
                  <Link href={l.href} className={styles.footLink}>{l.label}</Link>
                </li>
              )
            )}
          </ul>
        ))}
        <div className={styles.footContact}>
          <p className={shared.caps}>Montréal, QC, Canada</p>
          <p className={shared.caps}>+1 514 715-2421</p>
        </div>
        <a
          href="https://www.instagram.com/"
          target="_blank"
          rel="noreferrer"
          className={styles.insta}
          aria-label="Instagram"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </a>
      </div>
      <hr className={shared.dottedLine} aria-hidden="true" />
      <div className={styles.footBar}>
        <p className={shared.caps}>2026 © Vistaire</p>
        <p className={shared.caps}>Tous droits réservés</p>
        <p className={shared.caps}>Page concept — style Hungry Tiger</p>
      </div>
    </footer>
  );
}
