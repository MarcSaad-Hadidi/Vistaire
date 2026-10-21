import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
const utilityBarPath = new URL(
  "../components/privacy/PrivacyUtilityBar.tsx",
  import.meta.url
);
const previewFooterPath = new URL(
  "../components/vistaire-preview/VistairePreviewChrome.tsx",
  import.meta.url
);
const contactNoticePath = new URL(
  "../components/vistaire-preview/VistaireRendezVousPreview.tsx",
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
const playwrightConfigPath = new URL("../playwright.config.ts", import.meta.url);
const privacyFixturePath = new URL(
  "../e2e/support/privacy-consent.ts",
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

test("privacy controls stay available on sign-in while internal app routes remain excluded", async () => {
  const { shouldShowPrivacyControls } = await import(
    "../lib/privacy/privacyRoutes.ts"
  );

  assert.equal(shouldShowPrivacyControls("/"), true);
  assert.equal(shouldShowPrivacyControls("/sign-in"), true);
  assert.equal(shouldShowPrivacyControls("/sign-in/verify"), true);
  assert.equal(shouldShowPrivacyControls("/admin"), false);
  assert.equal(shouldShowPrivacyControls("/admin/restaurants"), false);
  assert.equal(shouldShowPrivacyControls("/owner"), false);
  assert.equal(shouldShowPrivacyControls("/todos/123"), false);
});

test("the shared document shell owns one privacy consent provider", async () => {
  const [provider, shell] = await Promise.all([
    readSource(providerPath),
    readSource(shellPath)
  ]);

  assert.match(provider, /createContext/);
  assert.match(provider, /PrivacyConsentBanner/);
  assert.match(provider, /useSyncExternalStore/);
  assert.match(provider, /clearVistaireAnalyticsSession/);
  assert.doesNotMatch(provider, /useEffect/);
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

test("public E2E contexts start with an explicit rejected consent state", async () => {
  const [config, fixture] = await Promise.all([
    readSource(playwrightConfigPath),
    readSource(privacyFixturePath)
  ]);
  const { PRIVACY_CONSENT_STORAGE_KEY, PRIVACY_CONSENT_VERSION } = await import(
    "../lib/privacy/consent.ts"
  );
  const { privacyRejectedStorageState, privacyEmptyStorageState } = await import(
    "../e2e/support/privacy-consent.ts"
  );
  const rejected = privacyRejectedStorageState("http://127.0.0.1:3000");
  const empty = privacyEmptyStorageState();

  assert.match(config, /storageState:\s*privacyRejectedStorageState\(baseURL\)/);
  assert.match(fixture, /PRIVACY_CONSENT_STORAGE_KEY/);
  assert.deepEqual(empty, { cookies: [], origins: [] });
  assert.deepEqual(rejected.cookies, []);
  assert.equal(rejected.origins.length, 1);
  assert.deepEqual(rejected.origins[0], {
    origin: "http://127.0.0.1:3000",
    localStorage: [
      {
        name: PRIVACY_CONSENT_STORAGE_KEY,
        value: JSON.stringify({ version: PRIVACY_CONSENT_VERSION, analytics: false })
      }
    ]
  });
});

test("Vistaire first-party menu analytics is also opt-in", async () => {
  const source = await readSource(analyticsClientPath);
  assert.match(source, /function collectionAllowed\(\)[\s\S]{0,240}hasAnalyticsConsent\(\)/);

  // Every session-id read and the analytics request sit in a function that bails out first without consent.
  const guardedUse = /(?:getSessionId\(|fetch\("\/api\/analytics\/events")/g;
  const uses = [...source.matchAll(guardedUse)].filter((match) => !source.slice(match.index - 9, match.index).includes("function"));
  assert.ok(uses.length >= 2, "expected session reads and the analytics request");
  for (const use of uses) {
    const header = source.lastIndexOf("\nfunction ", use.index);
    const body = source.slice(source.indexOf("{", header), use.index);
    assert.match(body, /^\{\s*if \(!collectionAllowed\(\)\) return false;/, `unguarded analytics use at ${use.index}`);
  }
});

test("public legal and privacy controls are discoverable before collection in both languages", async () => {
  const [utilityBar, contactNotice, privacyFr, privacyEn, termsFr, termsEn] =
    await Promise.all([
      readSource(utilityBarPath),
      readSource(contactNoticePath),
      readSource(privacyFrPath),
      readSource(privacyEnPath),
      readSource(termsFrPath),
      readSource(termsEnPath)
    ]);

  assert.match(utilityBar, /politique-de-confidentialite/);
  assert.match(utilityBar, /privacy-policy/);
  assert.match(utilityBar, /conditions-utilisation/);
  assert.match(utilityBar, /terms-of-use/);
  assert.match(utilityBar, /PrivacySettingsButton/);
  assert.match(utilityBar, /shouldShowPrivacyControls/);
  assert.match(contactNotice, /politique-de-confidentialite/);
  assert.match(contactNotice, /privacy-policy/);
  assert.ok(
    contactNotice.indexOf("<p className={styles.formNote}>") <
      contactNotice.indexOf("<VistaireContactForm"),
    "privacy notice must be rendered before the contact form"
  );

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

test("the preview footer places legal controls beside the copyright", async () => {
  const [previewFooter, utilityBar] = await Promise.all([
    readSource(previewFooterPath),
    readSource(utilityBarPath)
  ]);

  assert.match(previewFooter, /data-vistaire-preview-footer/);
  assert.match(
    previewFooter,
    /footerCopyright[\s\S]{0,500}<PrivacyUtilityBar[\s\S]{0,180}variant="footer"/
  );
  assert.match(utilityBar, /variant\?: "global" \| "footer"/);
  assert.match(utilityBar, /variant === "global"/);
});

test("Vercel Web Analytics only loads and sends after analytics consent", async () => {
  for (const layout of ["app/(fr)/layout.tsx", "app/(en)/layout.tsx"]) {
    assert.doesNotMatch(await readSource(layout), /@vercel\/analytics/, layout);
  }
  const shell = await readSource("components/layout/VistaireDocumentShell.tsx");
  assert.match(shell, /<PrivacyConsentProvider[\s\S]*<ConsentedVercelAnalytics[\s\S]*<\/PrivacyConsentProvider>/);
  const consented = await readSource("components/analytics/ConsentedVercelAnalytics.tsx");
  assert.match(consented, /hydrated && analyticsAllowed/);
  assert.match(consented, /beforeSend=\{[^}]*hasAnalyticsConsent\(\)/);
});

test("every analytics recipient enabled by consent is disclosed in both languages", async () => {
  const banner = await readSource("components/privacy/PrivacyConsentBanner.tsx");
  assert.equal((banner.match(/Vercel Web Analytics/g) ?? []).length >= 2, true, "banner FR and EN");
  for (const policy of ["app/(fr)/politique-de-confidentialite/page.tsx", "app/(en)/en/privacy-policy/page.tsx"]) {
    const source = await readSource(policy);
    assert.match(source, /<strong>Vercel Web Analytics<\/strong>/, policy);
    assert.match(source, /Microsoft Clarity<\/strong>[^<]*(?:et à|and to) <strong>Vercel Web Analytics<\/strong>/, policy);
  }
});
