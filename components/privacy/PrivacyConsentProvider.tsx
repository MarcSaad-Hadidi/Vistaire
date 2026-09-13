"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode
} from "react";
import type { Locale } from "@/lib/i18n";
import {
  PRIVACY_CONSENT_CHANGED_EVENT,
  PRIVACY_CONSENT_STORAGE_KEY,
  clearVistaireAnalyticsSession,
  parsePrivacyConsent,
  readPrivacyConsentRaw,
  writePrivacyConsent,
  type PrivacyConsent
} from "@/lib/privacy/consent";
import { PrivacyConsentBanner } from "./PrivacyConsentBanner";
import { PrivacySettingsActionsProvider } from "./PrivacySettingsButton";

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

function subscribeToPrivacyConsent(onStoreChange: () => void) {
  const syncFromStorage = (event: StorageEvent) => {
    if (event.key !== PRIVACY_CONSENT_STORAGE_KEY) return;
    if (parsePrivacyConsent(event.newValue)?.analytics !== true) {
      clearVistaireAnalyticsSession();
    }
    onStoreChange();
  };
  const syncFromCustomEvent = () => onStoreChange();

  window.addEventListener("storage", syncFromStorage);
  window.addEventListener(PRIVACY_CONSENT_CHANGED_EVENT, syncFromCustomEvent);

  return () => {
    window.removeEventListener("storage", syncFromStorage);
    window.removeEventListener(PRIVACY_CONSENT_CHANGED_EVENT, syncFromCustomEvent);
  };
}

function subscribeToHydration() {
  return () => undefined;
}

function getHydratedSnapshot() {
  return true;
}

function getServerHydratedSnapshot() {
  return false;
}

function getServerConsentSnapshot() {
  return null;
}

export function PrivacyConsentProvider({
  children,
  locale
}: {
  children: ReactNode;
  locale: Locale;
}) {
  const rawConsent = useSyncExternalStore(
    subscribeToPrivacyConsent,
    readPrivacyConsentRaw,
    getServerConsentSnapshot
  );
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot
  );
  const consent = useMemo(() => parsePrivacyConsent(rawConsent), [rawConsent]);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const value = useMemo<PrivacyConsentContextValue>(
    () => ({
      analyticsAllowed: consent?.analytics === true,
      consent,
      hydrated,
      closePreferences: () => setPreferencesOpen(false),
      openPreferences: () => setPreferencesOpen(true),
      saveAnalyticsConsent: (analytics: boolean) => {
        const persisted = writePrivacyConsent(analytics);
        if (!persisted) return;
        setPreferencesOpen(false);
      }
    }),
    [consent, hydrated]
  );

  return (
    <PrivacySettingsActionsProvider openPreferences={value.openPreferences}>
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
    </PrivacySettingsActionsProvider>
  );
}

export function usePrivacyConsent() {
  const context = useContext(PrivacyConsentContext);
  if (!context) {
    throw new Error("usePrivacyConsent must be used inside PrivacyConsentProvider");
  }
  return context;
}
