export const PRIVACY_CONSENT_VERSION = 1 as const;
export const PRIVACY_CONSENT_STORAGE_KEY = "vistaire.privacyConsent.v1";
export const PRIVACY_CONSENT_CHANGED_EVENT = "vistaire:privacy-consent-changed";
export const VISTAIRE_ANALYTICS_SESSION_KEY = "vistaire.analytics.sessionId.v1";

export type PrivacyConsent = {
  version: typeof PRIVACY_CONSENT_VERSION;
  analytics: boolean;
};

export function parsePrivacyConsent(raw: string | null): PrivacyConsent | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PrivacyConsent> | null;
    if (
      !parsed ||
      parsed.version !== PRIVACY_CONSENT_VERSION ||
      typeof parsed.analytics !== "boolean"
    ) {
      return null;
    }

    return {
      version: PRIVACY_CONSENT_VERSION,
      analytics: parsed.analytics
    };
  } catch {
    return null;
  }
}

export function clearVistaireAnalyticsSession(): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(VISTAIRE_ANALYTICS_SESSION_KEY);
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
}

export function readPrivacyConsent(): PrivacyConsent | null {
  if (typeof window === "undefined") return null;

  try {
    return parsePrivacyConsent(
      window.localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function writePrivacyConsent(analytics: boolean): PrivacyConsent | null {
  if (typeof window === "undefined") return null;

  const consent: PrivacyConsent = {
    version: PRIVACY_CONSENT_VERSION,
    analytics
  };

  try {
    window.localStorage.setItem(
      PRIVACY_CONSENT_STORAGE_KEY,
      JSON.stringify(consent)
    );

    if (!analytics) {
      clearVistaireAnalyticsSession();
    }

    window.dispatchEvent(
      new CustomEvent(PRIVACY_CONSENT_CHANGED_EVENT, { detail: consent })
    );
    return consent;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return readPrivacyConsent()?.analytics === true;
}
