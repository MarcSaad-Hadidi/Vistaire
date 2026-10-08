"use client";

import shared from "./shared.module.css";
import { PhoneFrame, Reveal } from "./ForhimsMotion";
import { ScreenQuestions } from "./ForhimsPhones";
import s from "./ForhimsCommunity.module.css";

export function ForhimsCommunity() {
  return (
    <section className={s.section}>
      <Reveal>
        <h2 className={`${shared.headline} ${s.title}`}>
          C’est le moment d’en parler. Découvrez les expériences et les conseils de maisons comme la
          vôtre.
        </h2>
      </Reveal>
      <Reveal delay={120}>
        <div className={s.phoneWrap}>
          <PhoneFrame>
            <ScreenQuestions />
          </PhoneFrame>
        </div>
      </Reveal>
    </section>
  );
}
