import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { CONTACT_EMAIL, renderInboundAcknowledgement } from "@/lib/contactEmails";
import {
  INBOUND_MAX_BODY_BYTES, inboundEventId, inboundSkipReason,
  normalizeInboundMessageId, sanitizeInboundSubject, validateInboundPayload
} from "@/lib/inboundEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function boundedBody(request: Request): Promise<Buffer | null> {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return Buffer.concat(chunks, size);
      size += value.byteLength;
      if (size > INBOUND_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const secret = process.env.VISTAIRE_INBOUND_EMAIL_SECRET?.trim();
  if (!secret || secret.length < 32) return Response.json({ ok: false }, { status: 503 });

  const timestamp = request.headers.get("x-vistaire-timestamp") ?? "";
  const signature = request.headers.get("x-vistaire-signature") ?? "";
  const seconds = Number(timestamp);
  if (
    !/^\d{1,12}$/.test(timestamp) || !Number.isSafeInteger(seconds) ||
    Math.abs(Math.floor(Date.now() / 1000) - seconds) > 300 || !/^[0-9a-f]{64}$/i.test(signature)
  ) return Response.json({ ok: false }, { status: 401 });

  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > INBOUND_MAX_BODY_BYTES) {
    return Response.json({ ok: false }, { status: 413 });
  }

  let rawBody: Buffer | null;
  try {
    rawBody = await boundedBody(request);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (!rawBody) return Response.json({ ok: false }, { status: 413 });

  const expectedSignature = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest();
  if (!timingSafeEqual(expectedSignature, Buffer.from(signature, "hex"))) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const data = validateInboundPayload(payload);
  if (!data || await inboundEventId(data) !== data.eventId) return Response.json({ ok: false }, { status: 400 });
  const skipReason = inboundSkipReason(data);
  if (skipReason) return Response.json({ ok: true, skipped: skipReason });

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return Response.json({ ok: false }, { status: 503 });
  const messageId = normalizeInboundMessageId(data.messageId);
  try {
    const { data: accepted, error } = await new Resend(apiKey).emails.send({
      from: `Vistaire <${CONTACT_EMAIL}>`,
      to: [data.from.trim()],
      replyTo: [CONTACT_EMAIL],
      subject: `Re: ${sanitizeInboundSubject(data.subject)}`,
      ...renderInboundAcknowledgement(),
      headers: {
        "Auto-Submitted": "auto-replied",
        "X-Auto-Response-Suppress": "All",
        ...(messageId ? { "In-Reply-To": messageId, References: messageId } : {})
      }
    }, { idempotencyKey: `inbound/${data.eventId}` });
    // Resend acceptance is asynchronous delivery, and its deduplication window is 24 hours.
    if (error || !accepted || typeof accepted.id !== "string" || !accepted.id.trim()) throw new Error("provider_error");
    return Response.json({ ok: true }, { status: 202 });
  } catch {
    console.error("Vistaire inbound acknowledgement failed");
    return Response.json({ ok: false }, { status: 503 });
  }
}
