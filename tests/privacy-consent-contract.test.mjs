import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const consentPath = new URL("../lib/privacy/consent.ts", import.meta.url);
const providerPath = new URL(
  "../components/privacy/PrivacyConsentProvider.tsx",
  import.meta.url
);
const clarityPath = new URL(
  "../components/analytics/MicrosoftClarityScript.tsx",
  import.meta.url
);
const analyticsClientPath = new URL("../lib/analytics/client.ts", import.meta.url);
const shellPath = new URL(
  "../components/layout/VistaireDocumentShell.tsx",
  import.meta.url
);
const footerPath = new URL(
  "../components/vistaire-preview/VistairePreviewChrome.tsx",
  import.meta.url
);
const contactFormPath = new URL(
  "../components/vistaire-preview/VistaireContactForm.tsx",
  import.meta.url
);
const privacyFrPath = new URL(
  "../app/(fr)/politique-de-confidentialite/page.tsx",
  import.meta.url
);
const privacyEnPath = new URL(
  "../app/(en)/en/privacy-policy/page.tsx",
  import.meta.url
);
const termsFrPath = new URL(
  "../app/(fr)/conditions-utilisation/page.tsx",
  import.meta.url
);
const termsEnPath = new URL(
  "../app/(en)/en/terms-of-use/page.tsx",
  import.meta.url
);

async function readSource(path) {
  return readFile(path, "utf8").catch(() => "");
}

test("privacy consent defaults to no analytics until an explicit valid choice exists", async () => {
  const consent = await import("../lib/privacy/consent.ts");

  assert.equal(consent.parsePrivacyConsent(null), null);
  assert.equal(consent.parsePrivacyConsent(""), null);
  assert.equal(consent.parsePrivacyConsent("not-json"), null);
  assert.equal(
    consent.parsePrivacyConsent(JSON.stringify({ version: 1, analytics: "yes" })),
    null
  );
  assert.deepEqual(
    consent.parsePrivacyConsent(JSON.stringify({ version: 1, analytics: false })),
    { version: 1, analytics: false }
  );
  assert.deepEqual(
    consent.parsePrivacyConsent(JSON.stringify({ version: 1, analytics: true })),
    { version: 1, analytics: true }
  );
});

test("the shared document shell owns one privacy consent provider", async () => {
  const [provider, shell] = await Promise.all([
    readSource(providerPath),
    readSource(shellPath)
  ]);

  assert.match(provider, /createContext/);
  assert.match(provider, /PrivacyConsentBanner/);
  assert.equal(shell.match(/<PrivacyConsentProvider/g)?.length ?? 0, 1);
  assert.equal(shell.match(/<\/PrivacyConsentProvider>/g)?.length ?? 0, 1);
  assert.match(shell, /locale=\{locale\}/);
});

test("Microsoft Clarity is gated by explicit analytics consent and signals consent v2", async () => {
  const source = await readSource(clarityPath);

  assert.match(source, /usePrivacyConsent\(\)/);
  assert.match(source, /analyticsAllowed/);
  assert.match(source, /if\s*\(!analyticsAllowed\)\s*\{\s*return children;\s*\}/);
  assert.match(source, /["']consentv2["']/);
  assert.match(source, /analytics_Storage:\s*["']granted["']/);
  assert.match(source, /ad_Storage:\s*["']denied["']/);
  assert.match(source, /analytics_Storage:\s*["']denied["']/);
  assert.match(source, /["']consent["'],\s*false/);
});

test("Vistaire first-party menu analytics is also opt-in", async () => {
  const source = await readSource(analyticsClientPath);
  const consentCheck = source.indexOf("hasAnalyticsConsent()");
  const sessionRead = source.indexOf("getSessionId()");
  const analyticsFetch = source.indexOf('fetch("/api/analytics/events"');

  assert.match(source, /import\s+\{\s*hasAnalyticsConsent\s*\}/);
  assert.ok(consentCheck >= 0, "analytics consent check is missing");
  assert.ok(sessionRead > consentCheck, "session id must not be created before consent");
  assert.ok(analyticsFetch > consentCheck, "analytics request must not be sent before consent");
});

test("public legal and privacy controls are discoverable in both languages", async () => {
  const [footer, contactForm, privacyFr, privacyEn, termsFr, termsEn] =
    await Promise.all([
      readSource(footerPath),
      readSource(contactFormPath),
      readSource(privacyFrPath),
      readSource(privacyEnPath),
      readSource(termsFrPath),
      readSource(termsEnPath)
    ]);

  assert.match(footer, /politique-de-confidentialite/);
  assert.match(footer, /privacy-policy/);
  assert.match(footer, /conditions-utilisation/);
  assert.match(footer, /terms-of-use/);
  assert.match(footer, /PrivacySettingsButton/);
  assert.match(contactForm, /politique-de-confidentialite/);
  assert.match(contactForm, /privacy-policy/);

  for (const source of [privacyFr, privacyEn]) {
    assert.match(source, /Microsoft Clarity/);
    assert.match(source, /Brevo/);
    assert.match(source, /contact@vistaire\.ca/);
  }

  assert.match(privacyFr, /Responsable de la protection des renseignements personnels/);
  assert.match(privacyEn, /Privacy Officer/);
  assert.match(termsFr, /conditions/i);
  assert.match(termsEn, /terms/i);
});
