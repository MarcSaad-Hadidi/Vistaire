import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./VistaireLegalPage.module.css";

export function VistaireLegalPage({
  children,
  intro,
  languageHref,
  languageLabel,
  locale,
  title,
  updatedLabel
}: {
  children: ReactNode;
  intro: string;
  languageHref: string;
  languageLabel: string;
  locale: Locale;
  title: string;
  updatedLabel: string;
}) {
  const homeHref = locale === "en" ? "/en" : "/";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href={homeHref} prefetch={false}>
          Vistaire
        </Link>
        <nav aria-label={locale === "en" ? "Legal page navigation" : "Navigation légale"}>
          <Link href={homeHref} prefetch={false}>
            {locale === "en" ? "Home" : "Accueil"}
          </Link>
          <Link href={languageHref} prefetch={false}>
            {languageLabel}
          </Link>
        </nav>
      </header>

      <article className={styles.article}>
        <p className={styles.eyebrow}>{locale === "en" ? "Vistaire · Legal" : "Vistaire · Légal"}</p>
        <h1>{title}</h1>
        <p className={styles.intro}>{intro}</p>
        <p className={styles.updated}>{updatedLabel}</p>
        <div className={styles.content}>{children}</div>
      </article>
    </main>
  );
}
