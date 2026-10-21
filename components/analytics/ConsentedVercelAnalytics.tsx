"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";
import { hasAnalyticsConsent } from "@/lib/privacy/consent";

// Vercel Web Analytics reports every page view, so it waits for analytics consent like Clarity.
// beforeSend re-checks consent because a loaded script keeps reporting after a withdrawal.
export function ConsentedVercelAnalytics() {
  const { analyticsAllowed, hydrated } = usePrivacyConsent();
  return hydrated && analyticsAllowed ? <Analytics beforeSend={(event) => (hasAnalyticsConsent() ? event : null)} /> : null;
}
