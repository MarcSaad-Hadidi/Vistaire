"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { Locale } from "@/lib/i18n";
import {
  PRIVACY_CONSENT_CHANGED_EVENT,
  PRIVACY_CONSENT_STORAGE_KEY,
  VISTAIRE_ANALYTICS_SESSION_KEY,
  parsePrivacyConsent,
  readPrivacyConsent,
  writePrivacyConsent,
  type PrivacyConsent
} from "@/lib/privacy/consent";
import { PrivacyConsentBanner } from "./PrivacyConsentBanner";

type PrivacyConsentContextValue = {
  analyticsAllowed: boolean;
  consent: PrivacyConsent | null;
  hydrated: boolean;
  closePreferences: () => void;
  openPreferences: () => void;
  saveAnalyticsConsent: (analytics: boolean) => void;
};

const PrivacyConsentContext = createContext<PrivacyConsentContextValue | null>(
  null
);

export function PrivacyConsentProvider({
  children,
  locale
}: {
  children: ReactNode;
  locale: Locale;
}) {
  const [consent, setConsent] = useState<PrivacyConsent | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    setConsent(readPrivacyConsent());
    setHydrated(true);

    const syncFromStorage = (event: StorageEvent) => {
      if (event.key !== PRIVACY_CONSENT_STORAGE_KEY) return;
      const nextConsent = parsePrivacyConsent(event.newValue);
      if (nextConsent?.analytics !== true) {
        window.sessionStorage.removeItem(VISTAIRE_ANALYTICS_SESSION_KEY);
      }
      setConsent(nextConsent);
    };
    const syncFromCustomEvent = (event: Event) => {
      const nextConsent = (event as CustomEvent<PrivacyConsent>).detail;
      if (nextConsent) setConsent(nextConsent);
    };

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(
      PRIVACY_CONSENT_CHANGED_EVENT,
      syncFromCustomEvent as EventListener
    );

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(
        PRIVACY_CONSENT_CHANGED_EVENT,
        syncFromCustomEvent as EventListener
      );
    };
  }, []);

  const value = useMemo<PrivacyConsentContextValue>(
    () => ({
      analyticsAllowed: consent?.analytics === true,
      consent,
      hydrated,
      closePreferences: () => setPreferencesOpen(false),
      openPreferences: () => setPreferencesOpen(true),
      saveAnalyticsConsent: (analytics: boolean) => {
        const persisted = writePrivacyConsent(analytics);
        setConsent(
          persisted ?? {
            version: 1,
            analytics: false
          }
        );
        setPreferencesOpen(false);
      }
    }),
    [consent, hydrated]
  );

  return (
    <PrivacyConsentContext.Provider value={value}>
      {children}
      {hydrated && (consent === null || preferencesOpen) ? (
        <PrivacyConsentBanner
          consent={consent}
          locale={locale}
          onClose={() => setPreferencesOpen(false)}
          onSave={value.saveAnalyticsConsent}
          preferencesOpen={preferencesOpen}
        />
      ) : null}
    </PrivacyConsentContext.Provider>
  );
}

export function usePrivacyConsent() {
  const context = useContext(PrivacyConsentContext);
  if (!context) {
    throw new Error("usePrivacyConsent must be used inside PrivacyConsentProvider");
  }
  return context;
}
