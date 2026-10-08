"use client";

import shared from "./shared.module.css";
import { Reveal } from "./ForhimsMotion";
import s from "./ForhimsStatement.module.css";

/** Full-width statement with vertical gradient text (sky→ink), like the reference. */
export function ForhimsStatement({
  children,
  from = "#6fa8e0",
  to = "#141a24"
}: {
  children: React.ReactNode;
  from?: string;
  to?: string;
}) {
  return (
    <section className={s.section}>
      <Reveal>
        <p
          className={`${shared.headline} ${s.text}`}
          style={{ backgroundImage: `linear-gradient(180deg, ${from} 0%, ${to} 88%)` }}
        >
          {children}
        </p>
      </Reveal>
    </section>
  );
}
