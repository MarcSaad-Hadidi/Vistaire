"use client";

import {
  createContext,
  useContext,
  type ReactNode
} from "react";
import type { Locale } from "@/lib/i18n";

type PrivacySettingsActionsContextValue = {
  openPreferences: () => void;
};

const PrivacySettingsActionsContext = createContext<
  PrivacySettingsActionsContextValue | null
>(null);

export function PrivacySettingsActionsProvider({
  children,
  openPreferences
}: {
  children: ReactNode;
  openPreferences: () => void;
}) {
  return (
    <PrivacySettingsActionsContext.Provider value={{ openPreferences }}>
      {children}
    </PrivacySettingsActionsContext.Provider>
  );
}

export function PrivacySettingsButton({
  className,
  locale
}: {
  className?: string;
  locale: Locale;
}) {
  const actions = useContext(PrivacySettingsActionsContext);

  if (!actions) {
    throw new Error("PrivacySettingsButton must be rendered inside its provider");
  }

  return (
    <button className={className} onClick={actions.openPreferences} type="button">
      {locale === "en" ? "Privacy settings" : "Préférences de confidentialité"}
    </button>
  );
}
