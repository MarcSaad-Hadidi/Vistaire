"use client";

import shared from "./shared.module.css";
import { Reveal } from "./ForhimsMotion";
import s from "./ForhimsClosing.module.css";

export function ForhimsClosing() {
  return (
    <section className={s.section}>
      <div className={s.panel}>
        <Reveal>
          <p className={`${shared.headline} ${s.text}`}>
            …pour que la carte donne enfin envie.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
