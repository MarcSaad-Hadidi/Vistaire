import { BrevoClient, BrevoError } from "@getbrevo/brevo";
import { NextResponse, type NextRequest } from "next/server";
import { getSiteUrl } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactField = "name" | "email" | "restaurant" | "message";

type ContactRequest = Record<ContactField, string> & {
  company?: string;
};

const CONTACT_EMAIL = "contact@vistaire.ca";
const SENDER_NAME = "Vistaire";
const SOURCE_PATH = "/prendre-rendez-vous";
const MAX_BODY_LENGTH = 12_000;
const CONTACT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;
const CONTACT_RATE_LIMIT_MAX_REQUESTS = 5;
const CONTACT_RATE_LIMIT_STORE_MAX_KEYS = 500;
const contactOriginError =
  "Veuillez reessayer depuis le site Vistaire.";
const contactRateLimitError = "Trop de demandes. Réessayez plus tard.";
const FIELD_LIMITS: Record<ContactField | "company", number> = {
  name: 80,
  email: 254,
  restaurant: 120,
  message: 2_000,
  company: 120
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactValidationResult =
  | { ok: true; data: ContactRequest }
  | { ok: false; error: string };

type ContactRateLimitBucket = {
  count: number;
  resetAt: number;
};

type ContactRateLimitGlobal = typeof globalThis & {
  __vistaireContactRateLimit?: Map<string, ContactRateLimitBucket>;
};

function json(
  body: { ok: boolean; error?: string },
  init?: ResponseInit
) {
  return NextResponse.json(body, init);
}

function normalizeField(
  payload: Record<string, unknown>,
  field: ContactField | "company"
) {
  const value = payload[field];

  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;

  return value.trim().slice(0, FIELD_LIMITS[field] + 1);
}

function validateContactPayload(
  payload: unknown
): ContactValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      error: "Veuillez verifier les champs du formulaire."
    };
  }

  const source = payload as Record<string, unknown>;
  const normalized = {
    name: normalizeField(source, "name"),
    email: normalizeField(source, "email"),
    restaurant: normalizeField(source, "restaurant"),
    message: normalizeField(source, "message"),
    company: normalizeField(source, "company")
  };

  if (Object.values(normalized).some((value) => value === null)) {
    return {
      ok: false,
      error: "Veuillez verifier les champs du formulaire."
    };
  }

  const data = normalized as ContactRequest;

  if (data.company && data.company.length > FIELD_LIMITS.company) {
    return {
      ok: false,
      error: "Veuillez verifier les champs du formulaire."
    };
  }

  if (!data.name || data.name.length > FIELD_LIMITS.name) {
    return {
      ok: false,
      error: "Veuillez indiquer votre nom."
    };
  }

  if (
    !data.email ||
    data.email.length > FIELD_LIMITS.email ||
    !emailPattern.test(data.email)
  ) {
    return {
      ok: false,
      error: "Veuillez indiquer un courriel valide."
    };
  }

  if (!data.restaurant || data.restaurant.length > FIELD_LIMITS.restaurant) {
    return {
      ok: false,
      error: "Veuillez indiquer le nom du restaurant."
    };
  }

  if (
    !data.message ||
    data.message.length < 10 ||
    data.message.length > FIELD_LIMITS.message
  ) {
    return {
      ok: false,
      error: "Veuillez ajouter un message plus detaille."
    };
  }

  return { ok: true, data };
}

function parseOrigin(value: string | null): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLocalDevelopmentOrigin(origin: string) {
  if (process.env.NODE_ENV === "production") return false;

  try {
    const { hostname, protocol } = new URL(origin);
    return (
      protocol === "http:" &&
      (hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

function allowedContactOrigins(request: NextRequest) {
  const origins = new Set<string>([request.nextUrl.origin]);

  origins.add(getSiteUrl().origin);

  for (const envKey of ["VERCEL_URL", "VERCEL_BRANCH_URL"]) {
    const value = process.env[envKey]?.trim();
    if (!value) continue;
    try {
      origins.add(
        new URL(`https://${value.replace(/^https?:\/\//i, "")}`).origin
      );
    } catch {
      // Ignore malformed optional platform URLs.
    }
  }

  return origins;
}

function isAllowedContactOrigin(origin: string, request: NextRequest) {
  if (allowedContactOrigins(request).has(origin)) return true;
  return isLocalDevelopmentOrigin(origin);
}

function requireTrustedContactOrigin(request: NextRequest) {
  const origin = parseOrigin(request.headers.get("origin"));
  const refererOrigin = parseOrigin(request.headers.get("referer"));
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!origin && !refererOrigin) {
    return json({ ok: false, error: contactOriginError }, { status: 403 });
  }

  if (origin && !isAllowedContactOrigin(origin, request)) {
    return json({ ok: false, error: contactOriginError }, { status: 403 });
  }

  if (refererOrigin && !isAllowedContactOrigin(refererOrigin, request)) {
    return json({ ok: false, error: contactOriginError }, { status: 403 });
  }

  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return json({ ok: false, error: contactOriginError }, { status: 403 });
  }

  return null;
}

function hasOversizedContentLength(request: NextRequest) {
  const rawContentLength = request.headers.get("content-length");
  if (!rawContentLength) return false;

  const contentLength = Number(rawContentLength);
  return (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_LENGTH
  );
}

function getContactRateLimitStore() {
  const storeGlobal = globalThis as ContactRateLimitGlobal;
  const store =
    storeGlobal.__vistaireContactRateLimit ??
    new Map<string, ContactRateLimitBucket>();

  storeGlobal.__vistaireContactRateLimit = store;
  return store;
}

function pruneContactRateLimitStore(
  store: Map<string, ContactRateLimitBucket>,
  now: number
) {
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }

  while (store.size > CONTACT_RATE_LIMIT_STORE_MAX_KEYS) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
}

function forwardedHeaderClientIp(value: string | null) {
  const firstForwardedEntry = value?.split(",")[0]?.trim();
  const match = firstForwardedEntry?.match(/(?:^|;)\s*for="?([^;"]+)"?/i);
  return match?.[1]?.replace(/^\[|\]$/g, "").trim() || "";
}

function getClientRateLimitKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const candidate =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("true-client-ip")?.trim() ||
    forwardedHeaderClientIp(request.headers.get("forwarded")) ||
    "unknown";

  const normalized = candidate
    .replace(/[^a-zA-Z0-9:._-]/g, "")
    .slice(0, 80);

  return `contact:${normalized || "unknown"}`;
}

function consumeContactRateLimit(request: NextRequest) {
  const store = getContactRateLimitStore();
  const now = Date.now();
  const key = getClientRateLimitKey(request);

  pruneContactRateLimitStore(store, now);

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + CONTACT_RATE_LIMIT_WINDOW_MS
    });
    return null;
  }

  if (bucket.count >= CONTACT_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));

    return json(
      { ok: false, error: contactRateLimitError },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter)
        }
      }
    );
  }

  bucket.count += 1;
  return null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildTextContent(data: ContactRequest, submittedAt: string) {
  return [
    "Nouvelle demande Vistaire",
    "",
    "Cette demande vient du formulaire Vistaire.",
    "",
    `Nom: ${data.name}`,
    `Courriel: ${data.email}`,
    `Restaurant: ${data.restaurant}`,
    "Source: /prendre-rendez-vous",
    `Date/heure serveur: ${submittedAt}`,
    "",
    "Message:",
    data.message
  ].join("\n");
}

function buildHtmlContent(data: ContactRequest, submittedAt: string) {
  const rows = [
    ["Nom", data.name],
    ["Courriel", data.email],
    ["Restaurant", data.restaurant],
    ["Source", SOURCE_PATH],
    ["Date", submittedAt]
  ]
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #ece2d4;color:#6f5a41;font-size:13px;font-weight:700;">${escapeHtml(
            label
          )}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #ece2d4;color:#20160f;font-size:14px;">${escapeHtml(
            value
          )}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="margin:0;padding:0;background:#f7f1e8;color:#20160f;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
        <div style="background:#fffaf3;border:1px solid #e6d7c4;border-radius:12px;padding:24px;">
          <p style="margin:0 0 8px;color:#8b6b3f;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Vistaire</p>
          <h1 style="margin:0 0 16px;color:#20160f;font-size:24px;line-height:1.2;">Nouvelle demande Vistaire</h1>
          <p style="margin:0 0 20px;color:#6f5a41;font-size:14px;line-height:1.6;">Cette demande vient du formulaire Vistaire.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#fff;border:1px solid #ece2d4;">
            ${rows}
          </table>
          <div style="padding:16px;background:#f3eadc;border:1px solid #e6d7c4;border-radius:10px;">
            <p style="margin:0 0 8px;color:#6f5a41;font-size:13px;font-weight:700;">Message</p>
            <p style="margin:0;color:#20160f;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(
              data.message
            )}</p>
          </div>
        </div>
      </div>
    </div>`;
}

function getContactConfig() {
  const apiKey = process.env.BREVO_API_KEY?.trim();

  if (!apiKey) return null;

  return {
    apiKey,
    toEmail: process.env.BREVO_CONTACT_TO?.trim() || CONTACT_EMAIL,
    senderEmail:
      process.env.BREVO_CONTACT_SENDER_EMAIL?.trim() || CONTACT_EMAIL,
    senderName: process.env.BREVO_CONTACT_SENDER_NAME?.trim() || SENDER_NAME
  };
}

function logBrevoFailure(error: unknown) {
  if (error instanceof BrevoError) {
    console.error("Brevo contact email failed", {
      statusCode: error.statusCode,
      message: error.message
    });
    return;
  }

  console.error("Brevo contact email failed", {
    message: error instanceof Error ? error.message : "Unknown error"
  });
}

export async function POST(request: NextRequest) {
  const originError = requireTrustedContactOrigin(request);
  if (originError) return originError;

  if (hasOversizedContentLength(request)) {
    return json(
      { ok: false, error: "Veuillez verifier les champs du formulaire." },
      { status: 400 }
    );
  }

  let payload: unknown;

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) {
      return json(
        { ok: false, error: "Veuillez verifier les champs du formulaire." },
        { status: 400 }
      );
    }

    payload = JSON.parse(rawBody);
  } catch {
    return json(
      { ok: false, error: "Veuillez envoyer une demande valide." },
      { status: 400 }
    );
  }

  const validation = validateContactPayload(payload);
  if (!validation.ok) {
    return json({ ok: false, error: validation.error }, { status: 400 });
  }

  const { data } = validation;

  // Minimal in-memory quota guard. On serverless, this is per warm instance;
  // production can add a global Cloudflare/Vercel KV/Upstash limiter later.
  const rateLimitError = consumeContactRateLimit(request);
  if (rateLimitError) return rateLimitError;

  if (data.company) {
    return json({ ok: true }, { status: 202 });
  }

  const config = getContactConfig();
  if (!config) {
    return json(
      {
        ok: false,
        error: "Le formulaire est temporairement indisponible."
      },
      { status: 503 }
    );
  }

  const submittedAt = new Date().toISOString();
  const client = new BrevoClient({ apiKey: config.apiKey });

  try {
    await client.transactionalEmails.sendTransacEmail({
      sender: {
        email: config.senderEmail,
        name: config.senderName
      },
      to: [
        {
          email: config.toEmail,
          name: SENDER_NAME
        }
      ],
      subject: `Nouvelle demande Vistaire - ${data.restaurant}`,
      htmlContent: buildHtmlContent(data, submittedAt),
      textContent: buildTextContent(data, submittedAt),
      replyTo: {
        email: data.email,
        name: data.name
      }
    });

    return json({ ok: true }, { status: 202 });
  } catch (error) {
    logBrevoFailure(error);
    return json(
      {
        ok: false,
        error: "La demande n'a pas pu etre envoyee."
      },
      { status: 500 }
    );
  }
}
