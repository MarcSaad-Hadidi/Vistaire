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
  newTabLabelClassName
}: {
  children: ReactNode;
  className?: string;
  href: LandingPublicMenuHref;
  locale: Locale;
  newTabLabelClassName?: string;
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
      <span className={newTabLabelClassName ?? styles.srOnly}>
        {getLandingCopy(locale).experiences.newTabLabel}
      </span>
    </Link>
  );
}
