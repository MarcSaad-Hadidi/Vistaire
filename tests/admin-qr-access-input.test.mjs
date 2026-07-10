import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const loadInputCore = () => import("../lib/admin/qrAccessInputCore.ts");

test("extracts canonical QR tokens from raw input and same-origin q links", async () => {
  const { extractAdminQrToken } = await loadInputCore();
  const requestOrigin = "https://vistaire.ca";

  assert.equal(extractAdminQrToken("opaque_token-123", requestOrigin), "opaque_token-123");
  assert.equal(extractAdminQrToken("opaque%5Ftoken", requestOrigin), "opaque_token");
  assert.equal(extractAdminQrToken("/q/opaque_token-123", requestOrigin), "opaque_token-123");
  assert.equal(
    extractAdminQrToken("https://vistaire.ca/q/s1.body.signature", requestOrigin),
    "s1.body.signature"
  );
  assert.equal(
    extractAdminQrToken("http://localhost:3000/q/local-token", "http://localhost:3000"),
    "local-token"
  );
});

test("rejects external, malformed, unrelated, and oversized QR access input", async () => {
  const { extractAdminQrToken } = await loadInputCore();
  const requestOrigin = "https://vistaire.ca";

  for (const value of [
    "",
    "https://evil.example/q/token",
    "https://vistaire.ca/admin",
    "/owner/q/token",
    "/q/one/two",
    "/q/%2Fadmin",
    "token with spaces",
    "x".repeat(801)
  ]) {
    assert.equal(extractAdminQrToken(value, requestOrigin), null, value);
  }
});

test("production access form delegates to the existing q exchange without cookies", async () => {
  const route = await readFile("app/admin/access/route.ts", "utf8");
  const page = await readFile("app/admin/page.tsx", "utf8");

  assert.match(route, /extractAdminQrToken/);
  assert.match(route, /request\.formData\(\)/);
  assert.match(route, /encodeURIComponent\(token\)/);
  assert.match(route, /status:\s*303/);
  assert.doesNotMatch(route, /cookies\.set|vistaire_admin_access/);
  assert.match(page, /Code ou lien QR admin/);
  assert.match(page, /action="\/admin\/access"/);
  assert.match(page, /Accéder au dashboard/);
  assert.match(page, /href="\/owner\/qr-codes"/);
});
