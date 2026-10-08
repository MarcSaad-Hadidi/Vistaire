"use client";

import Image from "next/image";
import Link from "next/link";
import shared from "./shared.module.css";
import { PhoneFrame, Reveal } from "./ForhimsMotion";
import { DISH, ScreenService } from "./ForhimsPhones";
import s from "./ForhimsPrograms.module.css";

const CARDS = [
  { src: DISH.homard, title: "Votre carte, guidée", tag: "Vistaire" },
  { src: DISH.ravioles, title: "Découvrez la 3D", tag: "Vistaire" },
  { src: DISH.risotto, title: "Le rappel du service", tag: "Vistaire" },
  { src: DISH.tartare, title: "Les signaux de la salle", tag: "Vistaire" },
  { src: DISH.pave, title: "L’art du dressage", tag: "Vistaire" }
];

function QrPattern() {
  // Decorative QR-style motif (links to /demo); not a scannable code.
  const cells: boolean[] = [];
  let seed = 7;
  for (let i = 0; i < 81; i++) {
    seed = (seed * 16807) % 2147483647;
    cells.push(seed % 3 !== 0);
  }
  return (
    <div className={s.qr} aria-hidden="true">
      {cells.map((on, i) => (
        <i key={i} className={on ? s.qrOn : s.qrOff} />
      ))}
    </div>
  );
}

export function ForhimsPrograms() {
  return (
    <section className={s.section} aria-label="Les Expériences Vistaire">
      {/* Black download panel */}
      <div className={s.download}>
        <Reveal>
          <h2 className={`${shared.headline} ${s.downloadTitle}`}>Obtenez Vistaire.</h2>
          <p className={s.downloadBody}>
            Scannez pour voir la démo, ou prenez rendez-vous : nous créons avec vous une carte à
            l’image de votre restaurant.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <div className={s.downloadRow}>
            <Link href="/demo" className={s.qrCard} aria-label="Voir la démo Vistaire">
              <QrPattern />
              <span>Scanner pour voir la démo</span>
            </Link>
            <div className={s.downloadCtas}>
              <Link href="/demo" className={`${shared.pill} ${shared.pillWhite} ${s.storePill}`}>
                Voir la démo
              </Link>
              <Link
                href="/prendre-rendez-vous"
                className={`${shared.pill} ${shared.pillWhite} ${s.storePill}`}
              >
                Prendre rendez-vous
              </Link>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Program cards carousel */}
      <div className={s.carousel} role="list" aria-label="Programmes">
        {CARDS.map((c) => (
          <div key={c.title} className={s.card} role="listitem">
            <Image src={c.src} alt={c.title} fill sizes="340px" className={s.cardImg} />
            <div className={s.cardTag}>
              {c.tag}
              <b>Vistaire</b>
            </div>
            <div className={s.cardTitle}>{c.title}</div>
          </div>
        ))}
      </div>

      {/* White collage: Service phone + tall cards */}
      <div className={s.collage}>
        <Reveal className={s.collageCard} delay={0}>
          <div className={`${s.tallCard} ${s.tallMint}`}>
            <span className={s.tallKicker}>Rappel</span>
            <span className={s.tallTitle}>
              Un plat photographié
              <br />
              = un plat commandé
            </span>
          </div>
        </Reveal>
        <Reveal className={s.collagePhone} delay={80}>
          <PhoneFrame>
            <ScreenService />
          </PhoneFrame>
        </Reveal>
        <Reveal className={s.collageCard} delay={160}>
          <div className={s.tallCard} style={{ padding: 0, overflow: "hidden", position: "relative" }}>
            <Image
              src={DISH.souffle}
              alt="Soufflé au chocolat grand cru"
              fill
              sizes="340px"
              className={s.cardImg}
            />
          </div>
        </Reveal>
      </div>

      {/* Results split */}
      <div className={s.results}>
        <Reveal>
          <p className={s.resultsText}>
            Les Expériences ont été pensées pour sublimer votre carte. Un parcours conçu avec des
            chefs pour tirer le meilleur de chaque service.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <PhoneFrame>
            <ScreenService />
          </PhoneFrame>
        </Reveal>
      </div>
    </section>
  );
}
