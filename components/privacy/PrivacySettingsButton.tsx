"use client";

import type { Locale } from "@/lib/i18n";
import { usePrivacyConsent } from "./PrivacyConsentProvider";

export function PrivacySettingsButton({
  className,
  locale
}: {
  className?: string;
  locale: Locale;
}) {
  const { openPreferences } = usePrivacyConsent();

  return (
    <button className={className} onClick={openPreferences} type="button">
      {locale === "en" ? "Privacy settings" : "Préférences de confidentialité"}
    </button>
  );
}
