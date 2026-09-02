"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { shouldLoadMicrosoftClarity } from "@/lib/analytics/microsoftClarityRoutes";
import type { Locale } from "@/lib/i18n";
import type { PrivacyConsent } from "@/lib/privacy/consent";
import styles from "./PrivacyConsent.module.css";

const copy = {
  fr: {
    eyebrow: "Votre vie privée",
    title: "Vos choix de confidentialité",
    description:
      "Vistaire utilise des outils d'analyse facultatifs pour comprendre l'utilisation du site et améliorer l'expérience. Ils restent désactivés tant que vous ne les acceptez pas.",
    reject: "Tout refuser",
    manage: "Gérer",
    accept: "Accepter",
    save: "Enregistrer mes choix",
    close: "Fermer",
    necessary: "Nécessaires",
    necessaryDescription:
      "Fonctions indispensables au site, à la sécurité et à la mémorisation de votre choix de confidentialité.",
    alwaysActive: "Toujours actifs",
    analytics: "Analyse",
    analyticsDescription:
      "Microsoft Clarity et l'analyse interne Vistaire. Ces outils peuvent mesurer les interactions, les pages consultées et la performance d'utilisation.",
    privacy: "Politique de confidentialité"
  },
  en: {
    eyebrow: "Your privacy",
    title: "Your privacy choices",
    description:
      "Vistaire uses optional analytics tools to understand site usage and improve the experience. They remain disabled until you accept them.",
    reject: "Reject all",
    manage: "Manage",
    accept: "Accept",
    save: "Save my choices",
    close: "Close",
    necessary: "Necessary",
    necessaryDescription:
      "Functions required for the site, security and remembering your privacy choice.",
    alwaysActive: "Always active",
    analytics: "Analytics",
    analyticsDescription:
      "Microsoft Clarity and Vistaire first-party analytics. These tools may measure interactions, viewed pages and usage performance.",
    privacy: "Privacy policy"
  }
} as const;

export function PrivacyConsentBanner({
  consent,
  locale,
  onClose,
  onSave,
  preferencesOpen
}: {
  consent: PrivacyConsent | null;
  locale: Locale;
  onClose: () => void;
  onSave: (analytics: boolean) => void;
  preferencesOpen: boolean;
}) {
  const pathname = usePathname();
  const text = copy[locale];
  const [expanded, setExpanded] = useState(preferencesOpen);
  const [analytics, setAnalytics] = useState(consent?.analytics ?? false);
  const privacyHref =
    locale === "en" ? "/en/privacy-policy" : "/politique-de-confidentialite";

  if (!shouldLoadMicrosoftClarity(pathname)) return null;

  return (
    <section
      aria-label={text.title}
      className={styles.banner}
      data-testid="privacy-consent"
    >
      <div className={styles.bannerHeader}>
        <div>
          <p className={styles.eyebrow}>{text.eyebrow}</p>
          <h2>{text.title}</h2>
        </div>
        {consent ? (
          <button
            aria-label={text.close}
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        ) : null}
      </div>

      <p className={styles.description}>{text.description}</p>

      {expanded ? (
        <div className={styles.preferences}>
          <div className={styles.preferenceRow}>
            <div>
              <strong>{text.necessary}</strong>
              <p>{text.necessaryDescription}</p>
            </div>
            <span className={styles.alwaysActive}>{text.alwaysActive}</span>
          </div>
          <label className={styles.preferenceRow}>
            <div>
              <strong>{text.analytics}</strong>
              <p>{text.analyticsDescription}</p>
            </div>
            <input
              checked={analytics}
              className={styles.toggle}
              onChange={(event) => setAnalytics(event.target.checked)}
              type="checkbox"
            />
          </label>
        </div>
      ) : null}

      <div className={styles.actions}>
        {expanded ? (
          <button
            className={styles.choiceButton}
            onClick={() => onSave(analytics)}
            type="button"
          >
            {text.save}
          </button>
        ) : (
          <>
            <button
              className={styles.choiceButton}
              onClick={() => onSave(false)}
              type="button"
            >
              {text.reject}
            </button>
            <button
              className={styles.manageButton}
              onClick={() => setExpanded(true)}
              type="button"
            >
              {text.manage}
            </button>
            <button
              className={styles.choiceButton}
              onClick={() => onSave(true)}
              type="button"
            >
              {text.accept}
            </button>
          </>
        )}
      </div>

      <Link className={styles.policyLink} href={privacyHref} prefetch={false}>
        {text.privacy}
      </Link>
    </section>
  );
}
