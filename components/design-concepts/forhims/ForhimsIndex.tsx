"use client";

import shared from "./shared.module.css";
import { Reveal } from "./ForhimsMotion";
import s from "./ForhimsIndex.module.css";

const TILES: Array<{ word: string; icon: React.ReactNode; tint: string }> = [
  {
    word: "Carte",
    tint: "#eef4f2",
    icon: (
      <svg width="72" height="72" viewBox="0 0 72 72" fill="#101418" aria-hidden="true">
        <rect x="8" y="14" width="56" height="44" rx="10" />
        <rect x="16" y="24" width="40" height="5" rx="2.5" fill="#eef4f2" />
        <rect x="16" y="34" width="28" height="5" rx="2.5" fill="#eef4f2" />
        <circle cx="52" cy="46" r="6" fill="#eef4f2" />
      </svg>
    )
  },
  {
    word: "Expériences",
    tint: "#eef4f2",
    icon: (
      <svg width="72" height="72" viewBox="0 0 72 72" fill="#101418" aria-hidden="true">
        <path d="M14 20a6 6 0 0 1 6-6h32a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H32l-10 8v-8h-2a6 6 0 0 1-6-6V20z" />
        <circle cx="28" cy="31" r="3.4" fill="#eef4f2" />
        <circle cx="38" cy="31" r="3.4" fill="#eef4f2" />
        <circle cx="48" cy="31" r="3.4" fill="#eef4f2" />
      </svg>
    )
  },
  {
    word: "Outils",
    tint: "#e8f1ee",
    icon: (
      <svg width="72" height="72" viewBox="0 0 72 72" fill="#101418" aria-hidden="true">
        <path d="M36 8c-8 0-13 5-13 12v8l-7 12a4 4 0 0 0 3.5 6h33a4 4 0 0 0 3.5-6l-7-12v-8c0-7-5-12-13-12z" />
        <rect x="31" y="50" width="10" height="12" rx="5" />
      </svg>
    )
  }
];

/** Dusty-pink "Tout dans la carte." + cream 3D index, like the reference. */
export function ForhimsIndex() {
  return (
    <>
      <section className={s.pink}>
        <Reveal>
          <h2 className={`${shared.headline} ${s.pinkTitle}`}>Tout dans la carte.</h2>
        </Reveal>
      </section>
      <section className={s.index}>
        <div className={s.words} aria-hidden="true">
          {TILES.map((t) => (
            <span key={t.word} className={`${shared.headline} ${s.fadedWord}`}>
              {t.word}
            </span>
          ))}
        </div>
        <div className={s.tiles}>
          {TILES.map((t, i) => (
            <Reveal key={t.word} delay={i * 120}>
              <div className={s.tile} style={{ background: `linear-gradient(160deg, #ffffff, ${t.tint})` }}>
                {t.icon}
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <h2 className={`${shared.headline} ${s.bestTitle}`}>
            Tout ce qu’il faut
            <br />
            pour donner envie.
          </h2>
        </Reveal>
      </section>
    </>
  );
}
