import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const loadUrls = () => import("../lib/owner/menuUrlCore.ts");
const loadResolution = () => import("../lib/owner/qrResolutionCore.ts");
const loadDiagnostics = () => import("../lib/owner/qrDiagnostics.ts");
const loadSupabaseProject = () => import("../utils/supabase/projectIdentity.ts");

test("the generic invalid QR destination is a concrete page, not the dynamic token route", async () => {
  const source = await readFile(
    new URL("../app/(fr)/q/invalid/page.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /QR introuvable ou désactivé/);
  assert.match(source, /index:\s*false/);
  assert.doesNotMatch(source, /searchParams|params|token/i);
});

function runServerTokenProbe(source) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      ["--conditions=react-server", "--input-type=module", "-e", source],
      { cwd: process.cwd(), encoding: "utf8" }
    )
  );
}

test("a freshly generated token keeps its exact stored hash and complete URL", async () => {
  const { buildQrRedirectPath } = await loadUrls();
  const { token, storedHash, firstCandidate } = runServerTokenProbe(`
    const { generateQrToken, hashQrTokenForStorage, qrTokenHashCandidates } =
      await import('./lib/owner/qrTokens.ts');
    const token = generateQrToken();
    console.log(JSON.stringify({
      token,
      storedHash: hashQrTokenForStorage(token),
      firstCandidate: qrTokenHashCandidates(token)[0]
    }));
  `);

  assert.equal(token.length, 32);
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(storedHash.length, 71);
  assert.match(storedHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(firstCandidate, storedHash);
  assert.equal(buildQrRedirectPath(token), `/q/${token}`);
});

test("one URL encoding round trip preserves legacy reserved token characters", async () => {
  const { buildQrRedirectPath } = await loadUrls();
  const token = "legacy+token/with_%2F-and spaces";
  const path = buildQrRedirectPath(token);

  assert.equal(path, "/q/legacy%2Btoken%2Fwith_%252F-and%20spaces");
  assert.equal(decodeURIComponent(path.slice(3)), token);
  assert.notEqual(decodeURIComponent(decodeURIComponent(path.slice(3))), token);
});

test("truncated and unknown tokens produce different hashes from the real token", async () => {
  const token = "0123456789abcdef0123456789abcdef";
  const hashes = runServerTokenProbe(`
    const { hashQrTokenForStorage } = await import('./lib/owner/qrTokens.ts');
    const token = '${token}';
    console.log(JSON.stringify({
      complete: hashQrTokenForStorage(token),
      truncated: hashQrTokenForStorage(token.slice(0, -1)),
      unknown: hashQrTokenForStorage('unknown-token')
    }));
  `);

  assert.notEqual(hashes.truncated, hashes.complete);
  assert.notEqual(hashes.unknown, hashes.complete);
});

test("legacy fallback resolves an active canonical admin QR for its restaurant", async () => {
  const { resolveLegacyQrScan } = await loadResolution();

  assert.deepEqual(
    resolveLegacyQrScan(
      {
        qrId: "qr-admin",
        restaurantId: "restaurant-a",
        status: "active",
        targetKind: "admin",
        targetPath: "/admin"
      },
      "/admin"
    ),
    {
      ok: true,
      qrId: "qr-admin",
      restaurantId: "restaurant-a",
      targetKind: "admin",
      targetPath: "/admin"
    }
  );
});

test("legacy fallback rejects truncated, unknown, inactive, incoherent, and cross-restaurant rows", async () => {
  const { resolveLegacyQrScan } = await loadResolution();
  const canonical = {
    qrId: "qr-admin",
    restaurantId: "restaurant-a",
    status: "active",
    targetKind: "admin",
    targetPath: "/admin"
  };

  assert.deepEqual(resolveLegacyQrScan({ ...canonical, status: "archived" }, "/admin"), { ok: false });
  assert.deepEqual(resolveLegacyQrScan({ ...canonical, status: "revoked" }, "/admin"), { ok: false });
  assert.deepEqual(resolveLegacyQrScan({ ...canonical, targetPath: "/menu/trouvable" }, "/menu/trouvable"), { ok: false });
  assert.deepEqual(resolveLegacyQrScan({ ...canonical, restaurantId: "" }, "/admin"), { ok: false });
  assert.deepEqual(resolveLegacyQrScan(canonical, "/admin/truncated"), { ok: false });
});

test("QR diagnostics expose only a non-reversible fingerprint and normalized context", async () => {
  const { createQrResolutionDiagnostic } = await loadDiagnostics();
  const token = "opaque-admin-token-that-must-stay-private";
  const diagnostic = createQrResolutionDiagnostic({
    token,
    requestUrl: "https://www.vistaire.ca/q/redacted",
    environment: "production",
    lookupResult: "matched",
    failureReason: "admin-session-secret-missing"
  });
  const serialized = JSON.stringify(diagnostic);

  assert.equal(diagnostic.tokenLength, token.length);
  assert.match(diagnostic.tokenFingerprint, /^[a-f0-9]{12}$/);
  assert.equal(diagnostic.host, "www.vistaire.ca");
  assert.equal(diagnostic.environment, "production");
  assert.equal(diagnostic.lookupResult, "matched");
  assert.equal(diagnostic.failureReason, "admin-session-secret-missing");
  assert.doesNotMatch(serialized, new RegExp(token));
  assert.doesNotMatch(serialized, /tokenHash|cookieValue|secretValue|supabaseKey/i);
});

test("preview and production reject an unexpected Supabase project explicitly", async () => {
  const { validateSupabaseProjectIdentity } = await loadSupabaseProject();
  const expected = "bkpewsjvxswqruwqljcy";

  assert.deepEqual(
    validateSupabaseProjectIdentity({
      supabaseUrl: `https://${expected}.supabase.co`,
      expectedProjectRef: expected
    }),
    { ok: true, projectRef: expected }
  );
  assert.deepEqual(
    validateSupabaseProjectIdentity({
      supabaseUrl: "https://wrongprojectref1234.supabase.co",
      expectedProjectRef: expected
    }),
    { ok: false, reason: "Supabase project does not match the expected deployment project." }
  );
  assert.deepEqual(
    validateSupabaseProjectIdentity({ supabaseUrl: "http://127.0.0.1:55432" }),
    { ok: true, projectRef: "127.0.0.1" }
  );
});
