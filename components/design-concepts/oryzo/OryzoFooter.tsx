"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./OryzoFooter.module.css";

/**
 * Footer — mirrors oryzo.ai's closing grid: dotted share card,
 * newsletter row, contact columns, satire-style disclaimer (adapted).
 */
export function OryzoFooter(): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <footer id="contact" className={styles.footer}>
      <div className={styles.grid}>
        <div className={styles.col}>
          <div className={styles.shareCard}>
            <p className={styles.shareTop}>
              CONÇU PAR VISTAIRE
              <br />
              AVEC SOIN <span aria-hidden="true">♥</span>
            </p>
            <p className={styles.shareMid}>
              PARTAGEZ AVEC VOS AMIS RESTAURATEURS
            </p>
            <button type="button" className={styles.copyPill} onClick={copyUrl}>
              {copied ? "COPIÉ !" : "COPIER L'URL"}
            </button>
          </div>
          <div className={styles.legal}>
            <span>MENTIONS LÉGALES</span>
            <span>CONFIDENTIALITÉ</span>
          </div>
        </div>

        <div className={styles.col}>
          <p className={styles.newsLabel}>RESTEZ INFORMÉ :</p>
          <Link href="/prendre-rendez-vous" className={styles.newsRow}>
            <span className={styles.newsInput}>VOTRE COURRIEL</span>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path
                d="M4 12h15m0 0l-6-6m6 6l-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <div className={styles.contact}>
            <p className={styles.contactLabel}>NOUS ÉCRIRE :</p>
            <a href="mailto:bonjour@vistaire.ca" className={styles.contactLink}>
              BONJOUR@VISTAIRE.CA
            </a>
          </div>
          <div className={styles.socials}>
            <span>X</span>
            <span>INSTAGRAM</span>
            <a
              href="https://www.linkedin.com/in/marcsaad-hadidi/"
              target="_blank"
              rel="noreferrer"
              className={styles.contactLink}
            >
              LINKEDIN
            </a>
          </div>
        </div>

        <div className={styles.col}>
          <p className={styles.disclaimer}>
            PAGE CONCEPT — EXPLORATION DESIGN RÉALISÉE D&rsquo;APRÈS ORYZO.AI.
            CETTE PAGE N&rsquo;EST PAS INDEXÉE ET NE REPRÉSENTE PAS LE SITE
            OFFICIEL DE VISTAIRE.
          </p>
        </div>
      </div>
    </footer>
  );
}
