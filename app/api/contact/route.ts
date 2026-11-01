import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { NextResponse, type NextRequest } from "next/server";
import { getSiteUrl } from "@/lib/seo";
import { normalizeLocale } from "@/lib/i18n";
import { CONTACT_EMAIL, renderContactEmails, type ContactEmailData } from "@/lib/contactEmails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactField = "name" | "email" | "restaurant" | "message";

type ContactRequest = ContactEmailData & {
  company?: string;
  submissionId: string;
  submittedAt: string;
};

const CONTACT_SENDER = `Vistaire <${CONTACT_EMAIL}>`;
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
const unsafeEmailPattern = /[\p{Cc}<>,;:"()\\]/u;
const submissionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  data.locale = normalizeLocale(source.locale);

  if (source.submissionId === undefined && source.submittedAt === undefined) {
    data.submissionId = randomUUID();
    data.submittedAt = new Date().toISOString();
  } else {
    if (
      typeof source.submissionId !== "string" ||
      !submissionIdPattern.test(source.submissionId) ||
      typeof source.submittedAt !== "string" ||
      !Number.isFinite(Date.parse(source.submittedAt)) ||
      new Date(source.submittedAt).toISOString() !== source.submittedAt
    ) {
      return { ok: false, error: "Veuillez verifier les champs du formulaire." };
    }
    data.submissionId = source.submissionId.toLowerCase();
    data.submittedAt = source.submittedAt;
  }

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
    !emailPattern.test(data.email) ||
    unsafeEmailPattern.test(data.email)
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

const SAFE_RESEND_ERROR_NAMES = new Set([
  "validation_error", "missing_api_key", "restricted_api_key", "invalid_api_key",
  "invalid_idempotency_key", "invalid_idempotent_request", "concurrent_idempotent_requests",
  "invalid_from_address", "invalid_access", "missing_required_field", "rate_limit_exceeded",
  "daily_quota_exceeded", "monthly_quota_exceeded", "application_error", "internal_server_error"
]);

function logResendFailure(error: unknown) {
  const failure = error && typeof error === "object"
    ? error as Record<string, unknown>
    : {};
  console.error("Resend contact emails failed", {
    name: typeof failure.name === "string" && SAFE_RESEND_ERROR_NAMES.has(failure.name)
      ? failure.name : "provider_error",
    statusCode: typeof failure.statusCode === "number" &&
      Number.isInteger(failure.statusCode) && failure.statusCode >= 100 && failure.statusCode <= 599
      ? failure.statusCode : null
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

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return json(
      {
        ok: false,
        error: "Le formulaire est temporairement indisponible."
      },
      { status: 503 }
    );
  }

  try {
    const emails = renderContactEmails(data, data.submittedAt);
    const client = new Resend(apiKey);
    const { data: accepted, error } = await client.batch.send(
      [
        {
          from: CONTACT_SENDER,
          to: [CONTACT_EMAIL],
          replyTo: [data.email],
          ...emails.internal
        },
        {
          from: CONTACT_SENDER,
          to: [data.email],
          replyTo: [CONTACT_EMAIL],
          ...emails.confirmation
        }
      ],
      {
        batchValidation: "strict",
        idempotencyKey: `contact/${data.submissionId}`
      }
    );

    // Acceptance of both messages is required; delivery is asynchronous at Resend.
    const batchErrors: unknown = accepted?.errors;
    if (
      error ||
      !Array.isArray(accepted?.data) ||
      accepted.data.length !== 2 ||
      !accepted.data.every((email) => email && typeof email.id === "string" && email.id.trim()) ||
      accepted.data[0].id === accepted.data[1].id ||
      (Array.isArray(batchErrors) && batchErrors.length > 0)
    ) {
      throw error;
    }

    return json({ ok: true }, { status: 202 });
  } catch (error) {
    logResendFailure(error);
    return json(
      {
        ok: false,
        error: "La demande n'a pas pu etre envoyee."
      },
      { status: 500 }
    );
  }
}
