import { APPROVED_CLAIM_TYPES, isAssistantClaim, type AssistantClaim } from "./contracts.ts";

type EvidenceProjection = Readonly<{
  records: Readonly<Record<string, Readonly<{
    evidenceId: string;
    metricId: string;
    labelKey: string;
    state: unknown;
    period: string;
  }>>>;
}>;

type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

export const ADMIN_ASSISTANT_CLAIMS_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "admin_assistant_claims",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["claims"],
      properties: {
        claims: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["claimType", "evidenceIds"],
            properties: {
              claimType: { type: "string", enum: APPROVED_CLAIM_TYPES },
              evidenceIds: { type: "array", items: { type: "string" }, uniqueItems: true }
            }
          }
        }
      }
    }
  }
} as const;

const MAX_QUESTION_LENGTH = 220;
const MAX_EVIDENCE_RECORDS = 80;
const MAX_BODY_BYTES = 48_000;

function parseClaims(content: unknown, allowedEvidenceIds: ReadonlySet<string>): readonly AssistantClaim[] | null {
  if (typeof content !== "string") return null;
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const root = parsed as Record<string, unknown>;
  if (Object.keys(root).length !== 1 || !Array.isArray(root.claims)) return null;
  if (!root.claims.every(isAssistantClaim)) return null;
  const claims = root.claims as AssistantClaim[];
  if (claims.length > 8 || claims.some((claim) => claim.evidenceIds.some((id) => !allowedEvidenceIds.has(id)))) return null;
  return claims;
}

export async function generateMistralAdminClaims(
  input: { locale: "fr" | "en"; question: string; evidence: EvidenceProjection; signal?: AbortSignal },
  dependencies: { apiKey?: string; model?: string; fetchImpl?: FetchLike; timeoutMs?: number } = {}
): Promise<readonly AssistantClaim[] | null> {
  const apiKey = dependencies.apiKey ?? process.env.MISTRAL_API_KEY;
  const model = dependencies.model ?? process.env.MISTRAL_MODEL;
  if (!apiKey || !model) return null;
  const records = Object.values(input.evidence.records);
  if (records.length > MAX_EVIDENCE_RECORDS) return null;
  const allowedEvidenceIds = new Set(records.map((record) => record.evidenceId));
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  input.signal?.addEventListener("abort", relayAbort, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 4_500);
  const body = JSON.stringify({
    model,
    temperature: 0,
    max_tokens: 420,
    response_format: ADMIN_ASSISTANT_CLAIMS_RESPONSE_FORMAT,
    messages: [
      { role: "system", content: "Select only allowed claimType and evidenceIds from the supplied evidence. Return the schema response only." },
      { role: "user", content: JSON.stringify({ locale: input.locale, question: input.question.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_LENGTH), evidence: { records } }) }
    ]
  });
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    clearTimeout(timeoutId);
    input.signal?.removeEventListener("abort", relayAbort);
    return null;
  }
  try {
    const fetchImpl = dependencies.fetchImpl ?? fetch;
    const response = await fetchImpl("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body
    });
    if (!response.ok) return null;
    const payload = await response.json() as { choices?: readonly { message?: { content?: unknown } }[] };
    return parseClaims(payload.choices?.[0]?.message?.content, allowedEvidenceIds);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
    input.signal?.removeEventListener("abort", relayAbort);
  }
}
