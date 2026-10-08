"use client";

import Link from "next/link";
import shared from "./shared.module.css";
import s from "./ForhimsNav.module.css";

export function ForhimsNav() {
  return (
    <header className={s.nav}>
      <Link href="/design-forhims" className={s.wordmark} aria-label="Vistaire — concept Forhims">
        VISTAIRE
      </Link>
      <Link href="/prendre-rendez-vous" className={`${shared.pill} ${shared.pillWhite} ${s.cta}`}>
        Prendre rendez-vous
      </Link>
    </header>
  );
}
