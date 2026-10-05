import {
  INBOUND_MAX_BODY_BYTES,
  inboundEventId,
  inboundSkipReason,
  normalizeInboundMessageId,
  validateInboundPayload
} from "../../lib/inboundEmail.ts";
import type { InboundEmailPayload } from "../../lib/inboundEmail.ts";

type Env = {
  VISTAIRE_FORWARD_TO: string;
  VISTAIRE_INBOUND_EMAIL_URL?: string;
  VISTAIRE_INBOUND_EMAIL_SECRET?: string;
};

// Structural subset of Cloudflare's Email Routing interface; no sending binding.
type IncomingEmail = {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly rawSize: number;
  forward(destination: string): Promise<{ messageId: string }>;
};

async function notify(message: IncomingEmail, env: Env): Promise<void> {
  const secret = env.VISTAIRE_INBOUND_EMAIL_SECRET?.trim();
  const url = new URL(env.VISTAIRE_INBOUND_EMAIL_URL ?? "");
  if (!secret || secret.length < 32 || url.protocol !== "https:" || url.username || url.password || url.pathname !== "/api/inbound-email") {
    console.warn("inbound-email: invalid webhook configuration");
    return;
  }
  const header = (name: string) => (message.headers.get(name) ?? "").replace(/\r\n[ \t]+/g, " ").trim();
  const metadata = {
    messageId: normalizeInboundMessageId(header("Message-ID")),
    from: message.from,
    to: message.to,
    subject: header("Subject"),
    date: header("Date"),
    rawSize: message.rawSize,
    headerFrom: header("From"),
    returnPath: header("Return-Path"),
    contentType: header("Content-Type"),
    inReplyTo: header("In-Reply-To"),
    references: header("References"),
    autoSubmitted: header("Auto-Submitted"),
    precedence: header("Precedence"),
    listId: header("List-Id"),
    xAutoResponseSuppress: header("X-Auto-Response-Suppress")
  };
  const payload: InboundEmailPayload = {
    version: 1,
    ...metadata,
    eventId: "0".repeat(64),
    receivedAt: new Date().toISOString()
  };
  if (!validateInboundPayload(payload) || inboundSkipReason(payload)) return;
  payload.eventId = await inboundEventId(metadata);
  // Serialize once: the signature and every retry use these exact UTF-8 bytes.
  const body = JSON.stringify(payload);
  const encoder = new TextEncoder();
  if (encoder.encode(body).byteLength > INBOUND_MAX_BODY_BYTES) return;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
  // ponytail: bounded best effort, not durable delivery; use a queue only if missed confirmations become unacceptable.
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let retry = true;
    try {
      const response = await fetch(url.href, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Vistaire-Timestamp": timestamp,
          "X-Vistaire-Signature": hex
        },
        body
      });
      // Never read/log a server response body, which may contain sensitive data.
      void response.body?.cancel().catch(() => {});
      if (response.ok) return;
      retry = response.status === 429 || (response.status >= 500 && response.status <= 599);
    } catch {
      // Network/timeout errors are retriable; log no exception message or metadata.
    } finally {
      clearTimeout(timeout);
    }
    if (!retry || attempt === 2) {
      console.warn("inbound-email: webhook delivery failed");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
}

const worker = {
  async email(message: IncomingEmail, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<void> {
    // EmailSendResult contains messageId on success; Cloudflare throws failures.
    // Do not catch this: forwarding failure must remain visible to the SMTP flow.
    await message.forward(env.VISTAIRE_FORWARD_TO);
    try {
      ctx.waitUntil(notify(message, env).catch(() => {
        console.warn("inbound-email: notification unavailable");
      }));
    } catch {
      console.warn("inbound-email: notification unavailable");
    }
  }
};

export default worker;
