"use client";

import shared from "./shared.module.css";
import { PhoneFrame, Reveal } from "./ForhimsMotion";
import { ScreenExperiences } from "./ForhimsPhones";
import s from "./ForhimsHero.module.css";

export function ForhimsHero() {
  return (
    <section className={s.hero}>
      <div className={s.panel}>
        <Reveal>
          <h1 className={`${shared.headline} ${s.title}`}>
            Donnez envie avant
            <br />
            la première bouchée.
          </h1>
        </Reveal>
        <div className={s.phoneWrap}>
          <div className={s.wash} aria-hidden="true" />
          <Reveal delay={150}>
            <PhoneFrame>
              <ScreenExperiences />
            </PhoneFrame>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
