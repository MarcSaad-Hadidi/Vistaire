import {
  PRIVACY_CONSENT_STORAGE_KEY,
  PRIVACY_CONSENT_VERSION
} from "../../lib/privacy/consent.ts";

const rejectedConsent = JSON.stringify({
  version: PRIVACY_CONSENT_VERSION,
  analytics: false
});

const acceptedConsent = JSON.stringify({
  version: PRIVACY_CONSENT_VERSION,
  analytics: true
});

export function privacyRejectedStorageState(baseURL: string) {
  return consentStorageState(baseURL, rejectedConsent);
}

/** For specs that assert analytics events: the visitor has opted in. */
export function privacyAcceptedStorageState(baseURL: string) {
  return consentStorageState(baseURL, acceptedConsent);
}

function consentStorageState(baseURL: string, value: string) {
  return {
    cookies: [],
    origins: [
      {
        origin: new URL(baseURL).origin,
        localStorage: [
          {
            name: PRIVACY_CONSENT_STORAGE_KEY,
            value
          }
        ]
      }
    ]
  };
}

export function privacyEmptyStorageState() {
  return { cookies: [], origins: [] };
}
