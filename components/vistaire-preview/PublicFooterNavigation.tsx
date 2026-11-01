import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getPublicFooterNavigation } from "@/lib/publicFooterNavigation";
import styles from "./PublicFooterNavigation.module.css";

export function PublicFooterNavigation({ locale = "fr" }: { locale?: Locale }) {
  return (
    <nav
      className={styles.directory}
      aria-label={locale === "en" ? "Vistaire pages" : "Les pages Vistaire"}
      data-footer-navigation
    >
      {getPublicFooterNavigation(locale).map((group) => (
        <section className={styles.column} key={group.id} aria-label={group.title}>
          <h3>{group.title}</h3>
          <ul>
            {group.links.map((item) => (
              <li key={item.href}>
                <Link href={item.href} prefetch={false}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
