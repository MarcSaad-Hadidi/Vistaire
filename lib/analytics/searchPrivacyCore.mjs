const CONTROL_AND_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const PII_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?\d[\s().-]*){7,}\d/,
  /\b(?:https?:\/\/|www\.)\S+/i,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
  /\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/i,
  /\b\d{1,5}\s+(?:rue|avenue|av\.?|boulevard|bd\.?|street|st\.?|road|rd\.?)\b/i,
  /\[(?:email|telephone|phone|address|ip|url|pii)\]/i,
  /\b(?:token|secret|password|authorization|cookie)\b/i
];
const PROMPT_UNSAFE = /(?:ignore|oublie|forget).{0,30}(?:instruction|previous|précédent)|system\s*prompt|developer\s*message/i;

export function classifyAnalyticsSearchTerm(input) {
  if (typeof input !== "string") return { kind: "rejected", reason: "invalid" };
  const term = input.normalize("NFKC").replace(CONTROL_AND_BIDI, "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!term) return { kind: "rejected", reason: "empty" };
  if (PII_PATTERNS.some((pattern) => pattern.test(term))) return { kind: "rejected", reason: "pii" };
  return { kind: "safe", term, promptUnsafe: PROMPT_UNSAFE.test(term) };
}
