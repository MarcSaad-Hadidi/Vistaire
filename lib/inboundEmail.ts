// Portable metadata contract shared by the Email Worker and the Node endpoint.
export type InboundEmailPayload = {
  version: 1;
  eventId: string;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  rawSize: number;
  headerFrom: string;
  returnPath: string;
  contentType: string;
  inReplyTo: string;
  references: string;
  autoSubmitted: string;
  precedence: string;
  listId: string;
  xAutoResponseSuppress: string;
  receivedAt: string;
};

export const INBOUND_MAX_BODY_BYTES = 16 * 1024;
export const INBOUND_FIELD_LIMITS = {
  eventId: 64, messageId: 998, from: 254, to: 254, subject: 2000, date: 512,
  headerFrom: 1024, returnPath: 512, contentType: 512, inReplyTo: 1024,
  references: 4096, autoSubmitted: 256, precedence: 256, listId: 1024,
  xAutoResponseSuppress: 256, receivedAt: 32
} as const;

const CONTROL = /[\p{Cc}\u2028\u2029]/u;
const MAILBOX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

function mailbox(value: string) {
  if (value.length > 254 || !MAILBOX.test(value)) return "";
  const [local] = value.split("@");
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return "";
  return value.toLowerCase();
}

function headerMailbox(value: string) {
  const bracketed = value.match(/^[^<>]*<([^<>]+)>\s*$/);
  return mailbox((bracketed?.[1] ?? value).trim());
}

function isVistaire(value: string) {
  const domain = value.split("@")[1] ?? "";
  return domain === "vistaire.ca" || domain.endsWith(".vistaire.ca");
}

export function normalizeInboundMessageId(value: string): string {
  const match = value.trim().match(/^<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+)@([a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?)>$/);
  if (!match || value.length > INBOUND_FIELD_LIMITS.messageId) return "";
  const [, local, domain] = match;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..") || domain.includes("..")) return "";
  return `<${local}@${domain.toLowerCase()}>`;
}

export async function inboundEventId(metadata: Omit<InboundEmailPayload, "version" | "eventId" | "receivedAt">): Promise<string> {
  const messageId = normalizeInboundMessageId(metadata.messageId);
  const sender = metadata.from.trim().toLowerCase();
  const recipient = metadata.to.trim().toLowerCase();
  // ponytail: metadata fallback can collide for identical header/size tuples; persistent dedupe if that ceiling matters.
  const identity = messageId
    ? [sender, recipient, messageId]
    : [sender, recipient, metadata.date.trim(), metadata.subject.trim(), metadata.rawSize, metadata.headerFrom.trim()];
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(identity)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function inboundSkipReason(data: InboundEmailPayload): string | null {
  if (data.to.trim().toLowerCase() !== "contact@vistaire.ca") return "recipient";
  const sender = mailbox(data.from.trim());
  if (!sender || data.returnPath.trim() === "<>") return "sender";
  const headerSender = headerMailbox(data.headerFrom);
  // Conservative acknowledgements: custom bounce paths and forwarded senders may intentionally differ.
  if (!headerSender || headerSender !== sender) return "sender-mismatch";
  if (data.inReplyTo.trim() || data.references.trim()) return "reply";
  const autoSubmitted = data.autoSubmitted.trim().toLowerCase().split(";")[0].trim();
  if (autoSubmitted && autoSubmitted !== "no") return "automated";
  if (/^(bulk|list|junk)(?:\s|;|$)/i.test(data.precedence.trim()) || data.listId.trim()) return "list";
  if (data.xAutoResponseSuppress.split(/[\s,;]+/).some((token) => /^(all|autoreply|oof)$/i.test(token))) return "suppressed";
  if (/^(?:message\/(?:delivery-status|disposition-notification|global-delivery-status)|multipart\/report)(?:\s|;|$)/i.test(data.contentType.trim())) return "report";
  if (/^(?:mailer-daemon|postmaster|noreply|no-reply)(?:\+[^@]*)?@/i.test(sender)) return "automated-sender";
  if (isVistaire(sender) || isVistaire(headerSender)) return "self";
  return null;
}

export function sanitizeInboundSubject(value: string): string {
  const clean = value.replace(/[\p{Cc}\u2028\u2029]+/gu, " ").trim();
  // ponytail: MIME encoded words use a generic subject; decode only if original wording becomes required.
  return (/=\?[^?\s]+\?[bq]\?/i.test(clean) ? "" : clean.slice(0, 200).trim()) || "Votre message à Vistaire / Your message to Vistaire";
}

export function validateInboundPayload(value: unknown): InboundEmailPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const expectedKeys = [...Object.keys(INBOUND_FIELD_LIMITS), "version", "rawSize"];
  if (Object.keys(data).length !== expectedKeys.length || Object.keys(data).some((key) => !expectedKeys.includes(key))) return null;
  if (data.version !== 1 || !Number.isSafeInteger(data.rawSize) || (data.rawSize as number) < 0 || (data.rawSize as number) > 25 * 1024 * 1024) return null;
  for (const [field, limit] of Object.entries(INBOUND_FIELD_LIMITS)) {
    const fieldValue = data[field];
    if (typeof fieldValue !== "string" || fieldValue.length > limit) return null;
    // Subject is display data and is scrubbed before becoming an outgoing header.
    if (field !== "subject" && CONTROL.test(fieldValue)) return null;
  }
  if (!/^[0-9a-f]{64}$/.test(data.eventId as string)) return null;
  const receivedAt = data.receivedAt as string;
  if (!Number.isFinite(Date.parse(receivedAt)) || new Date(receivedAt).toISOString() !== receivedAt) return null;
  return data as InboundEmailPayload;
}
