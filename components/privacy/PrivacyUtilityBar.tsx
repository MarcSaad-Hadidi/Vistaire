"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { shouldShowPrivacyControls } from "@/lib/privacy/privacyRoutes";
import styles from "./PrivacyConsent.module.css";
import { PrivacySettingsButton } from "./PrivacySettingsButton";

type PrivacyUtilityBarProps = {
  className?: string;
  locale: Locale;
  variant?: "global" | "footer";
};

export function PrivacyUtilityBar({
  className,
  locale,
  variant = "global"
}: PrivacyUtilityBarProps) {
  const pathname = usePathname();
  if (variant === "global" && !shouldShowPrivacyControls(pathname)) return null;

  const privacyHref =
    locale === "en" ? "/en/privacy-policy" : "/politique-de-confidentialite";
  const termsHref =
    locale === "en" ? "/en/terms-of-use" : "/conditions-utilisation";
  const navClassName = [
    variant === "global" ? styles.utilityBar : null,
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav
      aria-label={locale === "en" ? "Legal and privacy" : "Légal et confidentialité"}
      className={navClassName}
    >
      <Link href={privacyHref} prefetch={false}>
        {locale === "en" ? "Privacy policy" : "Politique de confidentialité"}
      </Link>
      <Link href={termsHref} prefetch={false}>
        {locale === "en" ? "Terms of use" : "Conditions d’utilisation"}
      </Link>
      <PrivacySettingsButton className={styles.utilityButton} locale={locale} />
    </nav>
  );
}
