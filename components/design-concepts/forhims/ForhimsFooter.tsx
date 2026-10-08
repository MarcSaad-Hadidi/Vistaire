"use client";

import Link from "next/link";
import s from "./ForhimsFooter.module.css";

export function ForhimsFooter() {
  return (
    <footer className={s.footer}>
      <div className={s.top}>
        <div className={s.wordmark}>VISTAIRE</div>
        <nav className={s.links} aria-label="Liens">
          <Link href="/" className={s.linkRow}>
            <span>vistaire.ca</span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link href="/prendre-rendez-vous" className={s.linkRow}>
            <span>Prendre rendez-vous</span>
            <span aria-hidden="true">→</span>
          </Link>
        </nav>
      </div>
      <div className={s.bottom}>
        <div className={s.legalLinks}>
          <Link href="/prendre-rendez-vous">Contact</Link>
          <Link href="/demo">Démo</Link>
        </div>
        <p className={s.legal}>
          Concept de test — page non indexée.
          <br />© 2026 Vistaire. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
