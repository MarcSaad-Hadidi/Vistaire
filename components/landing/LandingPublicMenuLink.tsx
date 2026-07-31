import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";

export type LandingPublicMenuHref = `/menu/${string}`;

const newTabLabels: Record<Locale, string> = {
  fr: "Sâ€™ouvre dans un nouvel onglet.",
  en: "Opens in a new tab."
};

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
  newTabLabelClassName: string;
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
      <span className={newTabLabelClassName}> {newTabLabels[locale]}</span>
    </Link>
  );
}
