import {
  PRIVACY_CONSENT_STORAGE_KEY,
  PRIVACY_CONSENT_VERSION
} from "../../lib/privacy/consent.ts";

const rejectedConsent = JSON.stringify({
  version: PRIVACY_CONSENT_VERSION,
  analytics: false
});

export function privacyRejectedStorageState(baseURL: string) {
  return {
    cookies: [],
    origins: [
      {
        origin: new URL(baseURL).origin,
        localStorage: [
          {
            name: PRIVACY_CONSENT_STORAGE_KEY,
            value: rejectedConsent
          }
        ]
      }
    ]
  };
}

export function privacyEmptyStorageState() {
  return { cookies: [], origins: [] };
}
