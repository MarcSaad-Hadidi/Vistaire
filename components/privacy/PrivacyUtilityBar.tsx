"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { shouldShowPrivacyControls } from "@/lib/privacy/privacyRoutes";
import styles from "./PrivacyConsent.module.css";
import { PrivacySettingsButton } from "./PrivacySettingsButton";

export function PrivacyUtilityBar({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  if (!shouldShowPrivacyControls(pathname)) return null;

  const privacyHref =
    locale === "en" ? "/en/privacy-policy" : "/politique-de-confidentialite";
  const termsHref =
    locale === "en" ? "/en/terms-of-use" : "/conditions-utilisation";

  return (
    <nav
      aria-label={locale === "en" ? "Legal and privacy" : "Légal et confidentialité"}
      className={styles.utilityBar}
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
