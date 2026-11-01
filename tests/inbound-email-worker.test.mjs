import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker from "../workers/inbound-email/index.ts";
import { inboundEventId, validateInboundPayload } from "../lib/inboundEmail.ts";

const env = {
  VISTAIRE_FORWARD_TO: "inbox@example.net",
  VISTAIRE_INBOUND_EMAIL_URL: "https://www.vistaire.ca/api/inbound-email",
  VISTAIRE_INBOUND_EMAIL_SECRET: "test-secret-with-at-least-32-characters"
};

function message(headers = {}, overrides = {}) {
  return {
    from: "alice@example.net",
    to: "contact@vistaire.ca",
    rawSize: 1200,
    headers: new Headers({
      "Message-ID": "<new-thread@example.net>",
      From: "Alice <alice@example.net>",
      Subject: "Une nouvelle carte",
      Date: "Mon, 05 Oct 2026 12:00:00 +0000",
      ...headers
    }),
    async forward(destination) { assert.equal(destination, env.VISTAIRE_FORWARD_TO); return { messageId: "forwarded" }; },
    ...overrides
  };
}

async function handle(email, settings = env) {
  const pending = [];
  await worker.email(email, settings, { waitUntil(promise) { pending.push(promise); } });
  await Promise.all(pending);
}

test("first conversation forwards first, signs exact metadata bytes and deduplicates retries", async (t) => {
  let forwarded = false;
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(forwarded, true);
    calls.push({ url, options });
    return new Response(null, { status: 204 });
  });
  const email = message({}, { async forward() { forwarded = true; return { messageId: "forwarded" }; } });
  await handle(email);
  await handle(email);
  assert.equal(calls.length, 2);
  const { options } = calls[0];
  const payload = validateInboundPayload(JSON.parse(options.body));
  assert.ok(payload);
  assert.equal(payload.eventId, await inboundEventId(payload));
  assert.equal(payload.eventId, JSON.parse(calls[1].options.body).eventId);
  assert.equal(payload.from, "alice@example.net");
  assert.equal(payload.headerFrom, "Alice <alice@example.net>");
  assert.equal(options.redirect, "error");
  assert.equal(options.headers["X-Vistaire-Signature"], createHmac("sha256", env.VISTAIRE_INBOUND_EMAIL_SECRET)
    .update(`${options.headers["X-Vistaire-Timestamp"]}.${options.body}`, "utf8").digest("hex"));
  assert.ok(Buffer.byteLength(options.body, "utf8") <= 16 * 1024);
  assert.equal(Object.hasOwn(payload, "raw"), false);
  await handle(message({ "Message-ID": "", Date: "" }));
  await handle(message({ "Message-ID": "", Date: "" }));
  assert.equal(JSON.parse(calls[2].options.body).eventId, JSON.parse(calls[3].options.body).eventId);
  assert.notEqual(payload.eventId, JSON.parse(calls[2].options.body).eventId);
  await handle(email, { ...env, VISTAIRE_INBOUND_EMAIL_SECRET: ` ${env.VISTAIRE_INBOUND_EMAIL_SECRET}\n` });
  const trimmed = calls[4].options;
  assert.equal(trimmed.headers["X-Vistaire-Signature"], createHmac("sha256", env.VISTAIRE_INBOUND_EMAIL_SECRET)
    .update(`${trimmed.headers["X-Vistaire-Timestamp"]}.${trimmed.body}`, "utf8").digest("hex"));
});

test("replies, automated mail, bounce, lists, self and ambiguous sender only forward", async (t) => {
  let forwards = 0;
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Must not notify"); });
  for (const [headers, overrides] of [
    [{ "In-Reply-To": "<previous@example.net>" }, {}],
    [{ References: "<previous@example.net>" }, {}],
    [{ "Auto-Submitted": "auto-replied" }, {}],
    [{ "Auto-Submitted": "auto-generated" }, {}],
    [{ Precedence: "bulk" }, {}],
    [{ "List-Id": "menu.example.net" }, {}],
    [{ "X-Auto-Response-Suppress": "All" }, {}],
    [{ "Content-Type": "multipart/report; report-type=delivery-status" }, {}],
    [{}, { from: "" }],
    [{ From: "MAILER-DAEMON@example.net" }, { from: "MAILER-DAEMON@example.net" }],
    [{ From: "contact@vistaire.ca" }, { from: "contact@vistaire.ca" }],
    [{ From: "other@example.net" }, {}]
  ]) {
    await handle(message(headers, { ...overrides, async forward() { forwards++; return { messageId: "forwarded" }; } }));
  }
  assert.equal(forwards, 12);
  assert.equal(fetch.mock.callCount(), 0);
});

test("forwarding failures propagate before any webhook; missing config or invalid metadata cannot undo forwarding", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Must not notify"); });
  const failure = new Error("SMTP delivery failure");
  await assert.rejects(handle(message({}, { async forward() { throw failure; } })), failure);
  await handle(message(), { ...env, VISTAIRE_INBOUND_EMAIL_SECRET: "" });
  await handle(message(), { ...env, VISTAIRE_INBOUND_EMAIL_URL: "http://example.net/api/inbound-email" });
  await handle(message({ Subject: "x".repeat(20_000) }));
  await handle(message({}, { headers: { get() { throw new Error("bad header parser"); } } }));
  assert.equal(fetch.mock.callCount(), 0);
});

test("network, 429, 5xx and 5-second timeout retry at most three times after forward; 4xx stops", async (t) => {
  const delays = [];
  const nativeTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, "setTimeout", (callback, delay, ...args) => {
    delays.push(delay);
    return nativeTimeout(callback, 0, ...args);
  });
  const logs = t.mock.method(console, "warn", () => {});
  for (const scenario of ["network", 429, 503, "timeout", 400]) {
    let forwarded = false;
    const calls = [];
    const fetch = t.mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(forwarded, true);
      calls.push(options.body);
      if (scenario === "network") throw new Error("secret sender details");
      if (scenario === "timeout") return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("timeout sender details")), { once: true });
      });
      return new Response(null, { status: scenario });
    });
    await handle(message({}, { async forward() { forwarded = true; return { messageId: "forwarded" }; } }));
    assert.equal(calls.length, scenario === 400 ? 1 : 3);
    assert.equal(new Set(calls).size, 1);
    fetch.mock.restore();
  }
  assert.ok(delays.includes(5000));
  assert.ok(delays.every((delay) => [5000, 250, 500].includes(delay)));
  assert.ok(logs.mock.calls.every(({ arguments: args }) => args.length === 1 && !String(args[0]).includes("sender")));
});
