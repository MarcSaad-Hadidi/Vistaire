import { NextResponse, type NextRequest } from "next/server";
import { generateMistralPublicFaqAnswer, isMistralConfigured } from "@/lib/ai/mistral";
import { readBoundedJsonBody } from "@/lib/admin/requestBody";
import { buildFaqMessages, faqMessage, validateFaqModelOutput, type FaqPublicResponse } from "@/lib/faq-rag/answer";
import { loadKnowledgeBase, selectFaqContext } from "@/lib/faq-rag/knowledge";
import { consumeFaqQuota } from "@/lib/faq-rag/quota";
import type { Locale } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_048;
const MIN_QUESTION_LENGTH = 5;
const MAX_QUESTION_LENGTH = 300;
const MAX_IN_FLIGHT_PER_INSTANCE = 8;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

let inFlight = 0;

function faqJson(body: FaqPublicResponse, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE_HEADERS, ...headers } });
}

function isSameOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = request.headers.get("origin");
  if (!origin) return fetchSite === "same-origin";
  try {
    const parsed = new URL(origin);
    // CSRF guard only (scripts can forge headers; the quota is the abuse control).
    return parsed.origin === request.nextUrl.origin || parsed.host === request.headers.get("host");
  } catch {
    return false;
  }
}

// Vercel sets x-vercel-forwarded-for itself; elsewhere (local next start) x-forwarded-for is best effort.
// IPv6 is keyed per /64 so one allocation cannot rotate through unlimited quota keys.
function clientNetwork(request: NextRequest): string {
  const header = process.env.VERCEL ? "x-vercel-forwarded-for" : "x-forwarded-for";
  const ip = request.headers.get(header)?.split(",")[0]?.trim().slice(0, 80) || "unknown";
  return ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip;
}

function parseFaqRequest(value: unknown): { question: string; locale: Locale } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "question" && key !== "locale")) return null;
  if (typeof body.question !== "string") return null;
  if (body.locale !== undefined && body.locale !== "fr" && body.locale !== "en") return null;

  const question = body.question.replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
  if (question.length < MIN_QUESTION_LENGTH || question.length > MAX_QUESTION_LENGTH) return null;
  return { question, locale: body.locale === "en" ? "en" : "fr" };
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return faqJson(faqMessage("invalid", "fr"), 403);
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) {
    return faqJson(faqMessage("invalid", "fr"), 415);
  }

  const body = await readBoundedJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return faqJson(faqMessage("invalid", "fr"), body.reason === "too-large" ? 413 : 400);
  const input = parseFaqRequest(body.value);
  if (!input) return faqJson(faqMessage("invalid", "fr"), 400);

  const kb = loadKnowledgeBase();
  const context = selectFaqContext(input.question, kb, input.locale);
  if (context.kind !== "model") return faqJson(faqMessage(context.kind, context.locale));

  if (!isMistralConfigured() || inFlight >= MAX_IN_FLIGHT_PER_INSTANCE) {
    return faqJson(faqMessage("unavailable", context.locale), 503);
  }

  inFlight += 1;
  try {
    const quota = await consumeFaqQuota(clientNetwork(request));
    if (quota === "rate_limited") {
      return faqJson(faqMessage("rate_limited", context.locale), 429, { "Retry-After": "60" });
    }
    if (quota !== "allowed") return faqJson(faqMessage("unavailable", context.locale), 503);

    const raw = await generateMistralPublicFaqAnswer(
      buildFaqMessages(input.question, context.locale, context.passages)
    );
    if (raw === null) return faqJson(faqMessage("unavailable", context.locale), 503);

    const { rejection, ...result } = validateFaqModelOutput(raw, {
      passages: context.passages,
      locale: context.locale,
      kb
    });
    if (rejection) console.warn("[Vistaire FAQ] answer rejected", rejection);
    return faqJson(result);
  } finally {
    inFlight -= 1;
  }
}
