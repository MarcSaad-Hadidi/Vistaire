import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
const nextServerUrl = pathToFileURL(require.resolve("next/server")).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return { url: nextServerUrl, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return { url: new URL(`${specifier.slice(2)}.ts`, root).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
        }).outputText,
        shortCircuit: true
      };
    }
    return nextLoad(url, context);
  }
});

const { NextRequest } = await import("next/server");
const { POST } = await import("../app/api/contact/route.ts");
const payload = {
  name: "Camille <ScRiPt>alert(1)</ScRiPt>",
  email: "camille@example.com",
  restaurant: "Maison & Laurier",
  message: "Première ligne <img src=x onerror=alert(1)>\nDeuxième ligne.",
  company: "",
  submissionId: "a1111111-2222-4333-8444-555555555555",
  submittedAt: "2026-10-04T12:00:00.000Z"
};

function request(data, headers = {}) {
  return new NextRequest("https://www.vistaire.ca/api/contact", {
    method: "POST",
    headers: { origin: "https://www.vistaire.ca", "sec-fetch-site": "same-origin", ...headers },
    body: JSON.stringify(data)
  });
}

test("contact uses one strict Resend batch with safe bilingual templates and stable retries", async (t) => {
  const previousKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "re_fake_contact_test";
  t.after(() => {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  });
  globalThis.__vistaireContactRateLimit = new Map();
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url: String(url), headers: new Headers(options.headers), body: JSON.parse(options.body) });
    return Response.json({ data: [{ id: "internal-id" }, { id: "confirmation-id" }] });
  });

  for (const locale of ["fr", "en"]) {
    const data = { ...payload, locale, submissionId: locale === "fr" ? payload.submissionId : "b1111111-2222-4333-8444-555555555555" };
    assert.equal((await POST(request(data))).status, 202);
    assert.equal((await POST(request(data))).status, 202);
  }

  const legacyPayload = { ...payload, submissionId: undefined, submittedAt: undefined };
  assert.equal((await POST(request({ ...legacyPayload, locale: "unknown" }))).status, 202);

  assert.equal(calls.length, 5);
  assert.deepEqual(calls[0].body, calls[1].body);
  assert.deepEqual(calls[2].body, calls[3].body);
  for (const call of calls.slice(0, 4)) {
    assert.equal(call.url, "https://api.resend.com/emails/batch");
    assert.equal(call.headers.get("x-batch-validation"), "strict");
    assert.match(call.headers.get("idempotency-key"), /^contact\/[ab]1111111-2222-4333-8444-555555555555$/);
    assert.equal(call.body.length, 2);
    const [internal, confirmation] = call.body;
    assert.equal(internal.from, "Vistaire <contact@vistaire.ca>");
    assert.deepEqual(internal.to, ["contact@vistaire.ca"]);
    assert.deepEqual(internal.reply_to, [payload.email]);
    assert.equal(confirmation.from, internal.from);
    assert.deepEqual(confirmation.to, [payload.email]);
    assert.deepEqual(confirmation.reply_to, ["contact@vistaire.ca"]);
    assert.match(internal.subject, /Nouvelle demande/);
    assert.match(internal.text, /Maison & Laurier/);
    assert.match(internal.text, /2026-10-04T12:00:00.000Z/);
    assert.match(internal.text, /prendre-rendez-vous|en\/book-a-call/);
    assert.match(internal.text, /Deuxième ligne/);
    for (const email of call.body) {
      assert.ok(email.html.length > 100);
      assert.ok(email.text.length > 50);
      assert.doesNotMatch(email.html, /<(?:script|img)\b/i);
      assert.match(email.html, /&lt;script&gt;/i);
    }
  }
  assert.notEqual(calls[0].body[1].subject, calls[2].body[1].subject);
  assert.match(calls[0].body[0].text, /Langue de la demande : FR/);
  assert.match(calls[2].body[0].text, /Langue de la demande : EN/);
  assert.match(calls[4].headers.get("idempotency-key"), /^contact\/[0-9a-f-]{36}$/);
  assert.match(calls[4].body[0].text, /Langue de la demande : FR/);
});

test("contact rejects provider failures and unsafe input without exposing sensitive errors", async (t) => {
  const previousKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "re_fake_contact_test";
  t.after(() => {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  });
  globalThis.__vistaireContactRateLimit = new Map();
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    return Response.json({ name: "validation_error", message: "SENSITIVE re_secret camille@example.com", statusCode: 422 }, { status: 422 });
  });
  const response = await POST(request(payload));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false, error: "La demande n'a pas pu etre envoyee." });
  fetchMock.mock.mockImplementation(async () => { throw new Error("SENSITIVE re_secret camille@example.com"); });
  assert.equal((await POST(request(payload))).status, 500);
  fetchMock.mock.mockImplementation(async () => Response.json({ data: [{ id: "only-one" }] }));
  assert.equal((await POST(request(payload))).status, 500);
  fetchMock.mock.mockImplementation(async () => Response.json({ data: [{ id: "internal-id" }, { id: "confirmation-id" }], errors: [{ index: 1, message: "SENSITIVE re_secret" }] }));
  assert.equal((await POST(request(payload))).status, 500);
  assert.doesNotMatch(JSON.stringify(logs), /SENSITIVE|re_secret|camille@example.com/);

  globalThis.__vistaireContactRateLimit = new Map();
  const beforeGuards = fetchMock.mock.callCount();
  for (const email of ["a,b@example.com", "a;b@example.com", "a<b>@example.com", "a\u0000@example.com"]) {
    assert.equal((await POST(request({ ...payload, email }))).status, 400);
  }
  assert.equal((await POST(request({ ...payload, submittedAt: undefined }))).status, 400);
  assert.equal((await POST(request({ ...payload, submissionId: "unsafe-key" }))).status, 400);
  assert.equal((await POST(request({ ...payload, company: "bot" }))).status, 202);
  assert.equal((await POST(request(payload, { origin: "https://attacker.example" }))).status, 403);
  assert.equal((await POST(request(payload, { "content-length": "12001" }))).status, 400);
  delete process.env.RESEND_API_KEY;
  assert.equal((await POST(request(payload))).status, 503);
  assert.equal(fetchMock.mock.callCount(), beforeGuards);
});
