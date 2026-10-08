"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./DroppyCarousels.module.css";
import { DroppyReveal } from "./DroppyMotion";

/* ---------------- Generic carousel primitive ---------------- */

function useCarousel(autoplayMs = 6000) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [paused, setPaused] = useState(false);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children);
    setCount(cards.length);
    const w = (cards[0] as HTMLElement)?.offsetWidth || 1;
    const gap = 20;
    const i = Math.round(track.scrollLeft / (w + gap));
    setIndex(Math.max(0, Math.min(cards.length - 1, i)));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const go = useCallback(
    (dir: 1 | -1) => {
      const track = trackRef.current;
      if (!track) return;
      const card = track.children[0] as HTMLElement | undefined;
      const step = (card?.offsetWidth || 300) + 20;
      const max = track.scrollWidth - track.clientWidth;
      let next = track.scrollLeft + dir * step;
      if (next > max - 4) next = 0;
      if (next < 4) next = dir === -1 ? max : next;
      track.scrollTo({ left: next, behavior: "smooth" });
    },
    []
  );

  useEffect(() => {
    if (paused || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => go(1), autoplayMs);
    return () => window.clearInterval(id);
  }, [paused, go, autoplayMs]);

  return [trackRef, { index, count, paused, setPaused, go, measure }] as const;
}

function CarouselControls({
  index,
  count,
  paused,
  onTogglePause,
  onPrev,
  onNext,
  arrows = false
}: {
  index: number;
  count: number;
  paused: boolean;
  onTogglePause: () => void;
  onPrev: () => void;
  onNext: () => void;
  arrows?: boolean;
}) {
  if (arrows) {
    return (
      <div className={styles.arrows}>
        <button type="button" onClick={onPrev} aria-label="Précédent" className={styles.arrowBtn}>
          <span aria-hidden="true">‹</span>
        </button>
        <button type="button" onClick={onNext} aria-label="Suivant" className={`${styles.arrowBtn} ${styles.arrowNext}`}>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    );
  }
  return (
    <div className={styles.controls}>
      <div className={styles.dots} role="tablist" aria-label="Progression du carrousel">
        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
            aria-hidden="true"
          />
        ))}
      </div>
      <button
        type="button"
        className={styles.pauseBtn}
        onClick={onTogglePause}
        aria-label={paused ? "Reprendre le défilement" : "Mettre le défilement en pause"}
      >
        <span aria-hidden="true">{paused ? "▶" : "⏸"}</span>
      </button>
    </div>
  );
}

function SectionHead({ title, sub, light = false }: { title: React.ReactNode; sub?: string; light?: boolean }) {
  return (
    <DroppyReveal>
      <h2 className={`${shared.title} ${light ? styles.titleLight : ""}`} style={{ textAlign: "left", margin: 0, maxWidth: "none" }}>
        {title}
      </h2>
      {sub ? <p className={styles.headSub}>{sub}</p> : null}
    </DroppyReveal>
  );
}

/* ---------------- 1. Floating player carousel ---------------- */

const PLAYER_CARDS = [
  {
    image: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
    dish: "Homard bleu",
    sub: "Bisque de fenouil",
    caption: "Trois formats. Vos plats et leurs récits.",
    captionStrong: true
  },
  {
    image: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    dish: "Pavé de bœuf",
    sub: "Sauce bordelaise",
    caption: "Pavé de bœuf · Sauce bordelaise",
    captionStrong: false
  },
  {
    image: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
    dish: "Soufflé au chocolat",
    sub: "Grand cru",
    caption: "Soufflé au chocolat · Grand cru",
    captionStrong: false
  }
];

function FloatingPlayer() {
  const [trackRef, c] = useCarousel();
  return (
    <section id="visuels" className={`${shared.section} ${styles.band}`} aria-label="Fiche plat">
      <div className={shared.wrap}>
        <SectionHead
          title="Découvrez la fiche plat, où que vous soyez."
          sub="Dans la démo, dès aujourd’hui."
        />
        <div
          ref={trackRef}
          className={styles.track}
          onScroll={c.measure}
          tabIndex={0}
          aria-label="Carrousel des fiches plats"
        >
          {PLAYER_CARDS.map((card) => (
            <figure key={card.dish} className={styles.playerCard}>
              <div className={`${shared.duotone} ${styles.playerArt}`} aria-hidden="true">
                <Image src={card.image} alt="" fill sizes="600px" />
              </div>
              <div className={styles.playerPill} role="img" aria-label={`Fiche ${card.dish}`}>
                <Image src={card.image} alt="" width={44} height={44} className={styles.playerThumb} />
                <div>
                  <p>{card.dish}</p>
                  <span>{card.sub}</span>
                </div>
              </div>
              <figcaption className={card.captionStrong ? styles.captionStrong : styles.caption}>
                {card.caption}
              </figcaption>
            </figure>
          ))}
        </div>
        <CarouselControls
          index={c.index}
          count={c.count}
          paused={c.paused}
          onTogglePause={() => c.setPaused((p) => !p)}
          onPrev={() => c.go(-1)}
          onNext={() => c.go(1)}
        />
      </div>
    </section>
  );
}

/* ---------------- 2. "There when you need it" carousel ---------------- */

const NEED_CARDS = [
  {
    image: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
    title: "Vos plats signatures, en avant.",
    body: "La 3D et les visuels premium là où ils comptent vraiment."
  },
  {
    image: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    title: "Mettez à jour en un geste.",
    body: "Prix, disponibilités, visuels : modifié une fois, à jour partout."
  },
  {
    image: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
    title: "Accords et allergènes, à portée.",
    body: "Tout ce que le client doit savoir, sans quitter la fiche."
  }
];

function ThereWhenNeeded() {
  const [trackRef, c] = useCarousel(7000);
  return (
    <section className={`${shared.section} ${styles.bandTight}`} aria-label="Au bon moment">
      <div className={shared.wrap}>
        <SectionHead title={<>Vistaire est là quand <em>vous</em> en avez besoin.</>} />
        <div ref={trackRef} className={styles.track} onScroll={c.measure} tabIndex={0} aria-label="Carrousel des usages">
          {NEED_CARDS.map((card) => (
            <figure key={card.title} className={styles.needCard}>
              <div className={`${shared.duotone} ${styles.needArt}`} aria-hidden="true">
                <Image src={card.image} alt="" fill sizes="600px" />
              </div>
              <div className={styles.needNotch} aria-hidden="true" />
              <figcaption>
                <strong>{card.title}</strong> <span>{card.body}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <CarouselControls
          index={c.index}
          count={c.count}
          paused={c.paused}
          onTogglePause={() => c.setPaused((p) => !p)}
          onPrev={() => c.go(-1)}
          onNext={() => c.go(1)}
        />
      </div>
    </section>
  );
}

/* ---------------- 3. Highlights carousel (big white cards) ---------------- */

const HIGHLIGHTS = [
  {
    icon: "◈",
    tag: "Module visuel",
    title: "Le studio photo.",
    body: "Des visuels dignes de votre cuisine, cohérents sur toute la carte.",
    image: "/images/demo/dishes/bar-de-ligne-artichaut-citron.png"
  },
  {
    icon: "✦",
    tag: "Module langues",
    title: "Parlez à tous vos clients.",
    body: "Le français et l’anglais, traduits et prêts à publier.",
    image: "/images/demo/dishes/elixir-bergamote-earl-grey.png"
  },
  {
    icon: "◎",
    tag: "Module salle",
    title: "Des signaux, pas des chiffres inventés.",
    body: "Voyez ce que les clients consultent vraiment, en toute honnêteté.",
    image: "/images/demo/dishes/negroni-vieilli-fut.png"
  }
];

function Highlights() {
  const [trackRef, c] = useCarousel(8000);
  return (
    <section className={`${shared.section} ${styles.bandTight}`} aria-label="Points forts">
      <div className={shared.wrap}>
        <SectionHead title="Quelques autres points forts." />
        <div ref={trackRef} className={styles.trackWide} onScroll={c.measure} tabIndex={0} aria-label="Carrousel des points forts">
          {HIGHLIGHTS.map((h) => (
            <article key={h.title} className={styles.highlightCard}>
              <div className={styles.highlightHead}>
                <span className={styles.highlightIcon} aria-hidden="true">{h.icon}</span>
                <div>
                  <p className={styles.highlightTag}>{h.tag}</p>
                  <h3>{h.title}</h3>
                  <p className={styles.highlightBody}>{h.body}</p>
                </div>
              </div>
              <div className={`${shared.duotone} ${styles.highlightArt}`} aria-hidden="true">
                <Image src={h.image} alt="" fill sizes="900px" />
              </div>
            </article>
          ))}
        </div>
        <CarouselControls
          index={c.index}
          count={c.count}
          paused={c.paused}
          onTogglePause={() => c.setPaused((p) => !p)}
          onPrev={() => c.go(-1)}
          onNext={() => c.go(1)}
        />
      </div>
    </section>
  );
}

/* ---------------- 4. "One price" honest highlights carousel ---------------- */

const PRICE_CARDS = [
  { icon: "◈", lines: ["La démo.", "Gratuite, sans engagement."], extra: "Parcourez de vraies cartes, touchez les fiches, jugez sur pièce." },
  { icon: "✦", lines: ["Un seul interlocuteur.", "De la photo à la mise en ligne."], extra: "Nous cadrons, photographions et publions avec vous." },
  { icon: "❖", lines: ["Vos plats. Vos prix.", "Vos visuels."], extra: "Votre identité reste la vôtre, jusque dans les moindres détails." },
  { icon: "◎", lines: ["Mises à jour instantanées.", "Sans réimpression."], extra: "Un plat change ? La carte suit, immédiatement." },
  { icon: "⬔", lines: ["FR + EN inclus.", "D’autres langues sur demande."], extra: "Chaque langue est relue, pas traduite à la va-vite." },
  { icon: "⬣", lines: ["3D / AR sélective.", "Sur vos plats signatures."], extra: "L’immersion là où elle donne vraiment envie." },
  { icon: "✚", lines: ["Parlons-en.", "Chaque restaurant est différent."], extra: "Un appel suffit pour cadrer votre carte." }
];

function PriceCard({ card }: { card: (typeof PRICE_CARDS)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={styles.priceCard}>
      <span className={styles.priceIcon} aria-hidden="true">{card.icon}</span>
      <p className={styles.priceLines}>
        {card.lines[0]}
        <br />
        {card.lines[1]}
      </p>
      {open ? <p className={styles.priceExtra}>{card.extra}</p> : null}
      <button
        type="button"
        className={styles.pricePlus}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Réduire" : "En savoir plus"}
      >
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
    </article>
  );
}

function OnePrice() {
  const [trackRef, c] = useCarousel(9000);
  return (
    <section id="tarifs" className={`${shared.section} ${styles.band}`} data-nav-dark aria-label="Offre">
      <div className={shared.wrap}>
        <DroppyReveal>
          <h2 className={shared.title} style={{ textAlign: "left", margin: 0 }}>
            Une carte. <span className={shared.titleLight}>Tout est dedans.</span>
            <br />
            <span className={shared.titleLight}>Parlons de</span> votre restaurant.
          </h2>
        </DroppyReveal>
        <div ref={trackRef} className={styles.track} onScroll={c.measure} tabIndex={0} aria-label="Carrousel de l’offre">
          {PRICE_CARDS.map((card) => (
            <PriceCard key={card.lines[0]} card={card} />
          ))}
        </div>
        <CarouselControls
          index={c.index}
          count={c.count}
          paused={c.paused}
          onTogglePause={() => c.setPaused((p) => !p)}
          onPrev={() => c.go(-1)}
          onNext={() => c.go(1)}
          arrows
        />
      </div>
    </section>
  );
}

/* ---------------- 5. Testimonials (illustrative) ---------------- */

const QUOTES = [
  {
    tag: "Fiche plat",
    quote: "« Enfin une carte qui donne envie avant même de commander. »",
    note: "Reconstitution illustrative"
  },
  {
    tag: "Photo premium",
    quote: "« Les clients photographient moins la carte… et plus les plats. »",
    note: "Reconstitution illustrative"
  },
  {
    tag: "Sans application",
    quote: "« On scanne, on découvre, on choisit. Rien à installer. »",
    note: "Reconstitution illustrative"
  },
  {
    tag: "Mise à jour",
    quote: "« Un prix qui change le midi est à jour pour le service du soir. »",
    note: "Reconstitution illustrative"
  }
];

function Testimonials() {
  const [trackRef, c] = useCarousel(8000);
  return (
    <section className={`${shared.section} ${styles.bandTight}`} data-nav-dark aria-label="Témoignages">
      <div className={shared.wrap}>
        <SectionHead
          title="Ce que les clients en disent."
          sub="Des retours de salle, des usages réels."
        />
        <div ref={trackRef} className={styles.track} onScroll={c.measure} tabIndex={0} aria-label="Carrousel de témoignages">
          {QUOTES.map((q) => (
            <figure key={q.quote} className={styles.quoteCard}>
              <div className={styles.quoteHead}>
                <span className={styles.quoteAvatar} aria-hidden="true">V</span>
                <div>
                  <p className={styles.quoteName}>Client en salle</p>
                  <p className={styles.quoteHandle}>{q.note}</p>
                </div>
              </div>
              <p className={styles.quoteTag}>{q.tag}</p>
              <blockquote className={styles.quoteText}>{q.quote}</blockquote>
              <figcaption className={styles.quoteFoot}>{q.note}</figcaption>
            </figure>
          ))}
        </div>
        <CarouselControls
          index={c.index}
          count={c.count}
          paused={c.paused}
          onTogglePause={() => c.setPaused((p) => !p)}
          onPrev={() => c.go(-1)}
          onNext={() => c.go(1)}
          arrows
        />
      </div>
    </section>
  );
}

/* ---------------- 6. Extensions in action ---------------- */

const EXTENSIONS = [
  {
    icon: "◈",
    title: "Chaque plat, une page qui donne envie.",
    body: "Photo, récit court, prix, allergènes : tout y est, lisiblement.",
    image: "/images/demo/dishes/risotto-cepes-parmesan.png"
  },
  {
    icon: "✦",
    title: "Vos signatures en 3D.",
    body: "Une immersion réservée aux plats qui le méritent.",
    image: "/images/demo/dishes/homard-bleu-bisque-fenouil.png"
  },
  {
    icon: "◎",
    title: "Des allergènes limpides.",
    body: "Tout ce qu’il faut savoir, à un toucher de la fiche.",
    image: "/images/demo/dishes/tartare-saumon-label-rouge.png"
  }
];

function ExtensionsInAction() {
  const [trackRef, c] = useCarousel(8000);
  return (
    <section className={`${shared.section} ${styles.bandTight}`} aria-label="Modules en action">
      <div className={shared.wrap}>
        <SectionHead title="Vos modules en action." />
        <div ref={trackRef} className={styles.trackWide} onScroll={c.measure} tabIndex={0} aria-label="Carrousel des modules en action">
          {EXTENSIONS.map((e) => (
            <article key={e.title} className={styles.extCard}>
              <div className={styles.extHead}>
                <div className={styles.extIconRow}>
                  <span className={styles.extIcon} aria-hidden="true">{e.icon}</span>
                  <span className={styles.extTag}>Module</span>
                </div>
                <h3>{e.title}</h3>
                <p>{e.body}</p>
              </div>
              <div className={`${shared.duotone} ${styles.extArt}`} aria-hidden="true">
                <Image src={e.image} alt="" fill sizes="600px" />
              </div>
              <div className={styles.extArrow}>
                <Link href="/demo" aria-label="Voir la démo">
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
        <CarouselControls
          index={c.index}
          count={c.count}
          paused={c.paused}
          onTogglePause={() => c.setPaused((p) => !p)}
          onPrev={() => c.go(-1)}
          onNext={() => c.go(1)}
        />
      </div>
    </section>
  );
}

export {
  FloatingPlayer,
  ThereWhenNeeded,
  Highlights,
  OnePrice,
  Testimonials,
  ExtensionsInAction
};