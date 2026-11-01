import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const require = createRequire(import.meta.url);
const nextServerUrl = pathToFileURL(require.resolve("next/server")).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") return { url: nextServerUrl, shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: new URL(`${specifier.slice(2)}.ts`, root).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) return {
      format: "module",
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText,
      shortCircuit: true
    };
    return nextLoad(url, context);
  }
});

const { inboundEventId, inboundSkipReason, normalizeInboundMessageId, sanitizeInboundSubject, validateInboundPayload } = await import("../lib/inboundEmail.ts");
const { POST } = await import("../app/api/inbound-email/route.ts");
const secret = "test-inbound-secret-at-least-32-characters";
const metadata = {
  messageId: "<New.Conversation@EXAMPLE.COM>", from: "camille@example.com", to: "contact@vistaire.ca",
  subject: "Carte épatante\r\nBcc: other@example.com", date: "Mon, 5 Oct 2026 12:00:00 +0000", rawSize: 1200,
  headerFrom: "Camille <camille@example.com>", returnPath: "<camille@example.com>", contentType: "text/plain; charset=utf-8",
  inReplyTo: "", references: "", autoSubmitted: "", precedence: "", listId: "", xAutoResponseSuppress: ""
};

async function payload(overrides = {}) {
  const data = { ...metadata, ...overrides };
  return { version: 1, ...data, eventId: await inboundEventId(data), receivedAt: new Date().toISOString() };
}

function request(data, options = {}) {
  const rawBody = options.rawBody ?? JSON.stringify(data);
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return new Request("https://vistaire.ca/api/inbound-email", {
    method: "POST", headers: {
      "content-type": "application/json", "x-vistaire-timestamp": timestamp,
      "x-vistaire-signature": options.signature ?? signature, ...options.headers
    }, body: rawBody
  });
}

test("signed inbound sends one stable bilingual acknowledgement with SMTP recipient and provider idempotency", async (t) => {
  const previousSecret = process.env.VISTAIRE_INBOUND_EMAIL_SECRET;
  const previousKey = process.env.RESEND_API_KEY;
  process.env.VISTAIRE_INBOUND_EMAIL_SECRET = secret;
  process.env.RESEND_API_KEY = "re_fake_inbound_test";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.VISTAIRE_INBOUND_EMAIL_SECRET;
    else process.env.VISTAIRE_INBOUND_EMAIL_SECRET = previousSecret;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  });
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url: String(url), headers: new Headers(options.headers), body: JSON.parse(options.body) });
    return Response.json({ id: "accepted-id" });
  });
  const data = await payload();
  assert.equal((await POST(request(data))).status, 202);
  assert.equal((await POST(request({ ...data, receivedAt: "2026-10-05T12:00:00.000Z" }))).status, 202);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, calls[1].body);
  const call = calls[0];
  assert.equal(call.url, "https://api.resend.com/emails");
  assert.equal(call.headers.get("idempotency-key"), `inbound/${data.eventId}`);
  assert.deepEqual(call.body.to, [metadata.from]);
  assert.equal(call.body.from, "Vistaire <contact@vistaire.ca>");
  assert.deepEqual(call.body.reply_to, ["contact@vistaire.ca"]);
  assert.equal(call.body.headers["Auto-Submitted"], "auto-replied");
  assert.equal(call.body.headers["X-Auto-Response-Suppress"], "All");
  assert.equal(call.body.headers["In-Reply-To"], "<New.Conversation@example.com>");
  assert.equal(call.body.headers.References, "<New.Conversation@example.com>");
  assert.doesNotMatch(call.body.subject, /[\r\n\x00-\x1f\x7f]/);
  assert.ok(call.body.subject.startsWith("Re: Carte épatante"));
  assert.match(call.body.text, /Nous avons bien reçu votre message/);
  assert.match(call.body.text, /We (?:have )?received your (?:message|email)/);
  assert.ok(call.body.html.length > 100);
  assert.equal(normalizeInboundMessageId(" <Keep.Local@EXAMPLE.COM> "), "<Keep.Local@example.com>");
  assert.equal(normalizeInboundMessageId("<one@example.com> <two@example.com>"), "");
  assert.equal(normalizeInboundMessageId("<unsafe@example.com>\r\nBcc: victim"), "");
  assert.equal(await inboundEventId({ ...metadata, subject: "different", rawSize: 9999 }), data.eventId);
  assert.notEqual(await inboundEventId({ ...metadata, messageId: "" }), await inboundEventId({ ...metadata, messageId: "", rawSize: 1201 }));
  assert.ok(sanitizeInboundSubject("x".repeat(500)).length <= 200);
  const secondThread = await payload({ messageId: "<second-thread@example.com>", subject: "=?UTF-8?B?Q2FydGUgw6lwYXRhbnRl?=" });
  assert.equal((await POST(request(secondThread))).status, 202);
  assert.equal(calls.length, 3);
  assert.notEqual(calls[2].headers.get("idempotency-key"), call.headers.get("idempotency-key"));
  assert.equal(calls[2].body.subject, "Re: Votre message à Vistaire / Your message to Vistaire");
  assert.equal(calls[2].body.headers["In-Reply-To"], "<second-thread@example.com>");
});

test("inbound rejects unauthenticated/oversized/malformed requests and filters replies, loops and bounces before Resend", async (t) => {
  const previousSecret = process.env.VISTAIRE_INBOUND_EMAIL_SECRET;
  const previousKey = process.env.RESEND_API_KEY;
  process.env.VISTAIRE_INBOUND_EMAIL_SECRET = secret;
  process.env.RESEND_API_KEY = "re_fake_inbound_test";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.VISTAIRE_INBOUND_EMAIL_SECRET;
    else process.env.VISTAIRE_INBOUND_EMAIL_SECRET = previousSecret;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  });
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ id: "accepted-id" }));
  const data = await payload();
  assert.equal((await POST(request(data, { signature: "0".repeat(64) }))).status, 401);
  assert.equal((await POST(request(data, { timestamp: String(Math.floor(Date.now() / 1000) - 301) }))).status, 401);
  assert.equal((await POST(request(data, { timestamp: String(Math.floor(Date.now() / 1000) + 301) }))).status, 401);
  assert.equal((await POST(request(data, { signature: "" }))).status, 401);
  assert.equal((await POST(request(data, { rawBody: "{" }))).status, 400);
  assert.equal((await POST(request({ ...data, version: 2 }))).status, 400);
  assert.equal((await POST(request({ ...data, eventId: "a".repeat(64) }))).status, 400);
  assert.equal((await POST(request({ ...data, body: "private email content" }))).status, 400);
  assert.equal((await POST(request(data, { rawBody: "é".repeat(9000) }))).status, 413);
  assert.equal((await POST(request(data, { headers: { "content-length": "16385" } }))).status, 413);
  assert.equal(validateInboundPayload({ ...data, from: "victim@example.com\r\nBcc: other@example.com" }), null);
  assert.equal(validateInboundPayload({ ...data, rawSize: -1 }), null);
  for (const override of [
    { inReplyTo: "malformed-but-present" }, { references: "<thread@example.com>" },
    { autoSubmitted: "auto-replied" }, { autoSubmitted: "auto-generated" }, { precedence: "bulk" },
    { precedence: "list" }, { precedence: "junk" }, { listId: "newsletter.example.com" },
    { xAutoResponseSuppress: "DR, AutoReply" }, { xAutoResponseSuppress: "OOF" },
    { from: "" }, { returnPath: "<>" }, { contentType: "multipart/report; report-type=delivery-status" },
    { contentType: "message/disposition-notification" }, { from: "mailer-daemon+tag@example.com", headerFrom: "mailer-daemon+tag@example.com" },
    { from: "postmaster@example.com", headerFrom: "postmaster@example.com" }, { from: "no-reply@example.com", headerFrom: "no-reply@example.com" },
    { from: "contact@vistaire.ca", headerFrom: "contact@vistaire.ca" }, { from: "team@mail.vistaire.ca", headerFrom: "team@mail.vistaire.ca" },
    { headerFrom: "Vistaire <contact@vistaire.ca>" }, { headerFrom: "Other <other@example.com>" },
    { headerFrom: "" }, { to: "other@vistaire.ca" },
    { from: "a,b@example.com" }
  ]) {
    const skipped = await payload(override);
    assert.ok(inboundSkipReason(skipped), JSON.stringify(override));
    assert.equal((await POST(request(skipped))).status, 200, JSON.stringify(override));
  }
  assert.equal(inboundSkipReason(await payload({ from: "real-noreply-person@example.com", headerFrom: "Real <real-noreply-person@example.com>", autoSubmitted: "no" })), null);
  assert.equal(mock.mock.callCount(), 0);
  delete process.env.RESEND_API_KEY;
  assert.equal((await POST(request(data))).status, 503);
  process.env.RESEND_API_KEY = "re_fake_inbound_test";
  mock.mock.mockImplementation(async () => Response.json({ name: "validation_error", message: "SENSITIVE camille@example.com re_secret" }, { status: 422 }));
  assert.equal((await POST(request(data))).status, 503);
  mock.mock.mockImplementation(async () => { throw new Error("SENSITIVE re_secret camille@example.com"); });
  assert.equal((await POST(request(data))).status, 503);
  assert.doesNotMatch(JSON.stringify(logs), /SENSITIVE|re_secret|camille@example.com/);
  process.env.VISTAIRE_INBOUND_EMAIL_SECRET = "short";
  assert.equal((await POST(request(data))).status, 503);
});
