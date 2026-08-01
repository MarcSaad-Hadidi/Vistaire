import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { getLandingCopy } from "@/lib/landing/landingCopy";
import styles from "./VistaireLanding.module.css";

export type LandingPublicMenuHref = `/menu/${string}`;

export function LandingPublicMenuLink({
  children,
  className,
  href,
  locale,
  newTabLabelClassName,
  showArrow = true
}: {
  children: ReactNode;
  className?: string;
  href: LandingPublicMenuHref;
  locale: Locale;
  newTabLabelClassName?: string;
  showArrow?: boolean;
}) {
  return (
    <Link
      className={className}
      href={href}
      prefetch={false}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
      {showArrow ? (
        <span aria-hidden="true" className={styles.linkArrow}>
          ↗
        </span>
      ) : null}
      <span className={newTabLabelClassName ?? styles.srOnly}>
        {getLandingCopy(locale).experiences.newTabLabel}
      </span>
    </Link>
  );
}
