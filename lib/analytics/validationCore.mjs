import { PUBLIC_MENU_LOCALE_OPTIONS } from "../menu/publicMenuSettings.ts";

const V2_EVENT_NAMES = [
  "menu_list_viewed",
  "dish_selected",
  "dish_visible",
  "dish_dwell",
  "search_results",
  "search_result_selected",
  "model_load_started",
  "model_load_succeeded",
  "model_load_failed",
  "model_interacted",
  "model_active_duration",
  "ar_outcome",
  "locale_changed"
];
const ANALYTICS_EVENT_NAMES = [
  ...V2_EVENT_NAMES,
  "session_started",
  "session_duration",
  "menu_opened",
  "category_viewed",
  "dish_opened",
  "dish_3d_clicked",
  "dish_ar_clicked",
  "search_used",
  "filter_used",
  "cta_clicked",
  "dashboard_demo_opened"
];

const EVENT_NAME_SET = new Set(ANALYTICS_EVENT_NAMES);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/i;
const MAX_METADATA_BYTES = 4_000;
const ALLOWED_KEYS = new Set([
  "sequence",
  "schemaVersion",
  "eventId",
  "eventName",
  "restaurantId",
  "menuId",
  "sessionId",
  "source",
  "dishSlug",
  "categorySlug",
  "searchQuery",
  "filterName",
  "ctaName",
  "viewport",
  "metadata"
]);
const REQUIRED_EVENT_FIELDS = new Map([
  ["category_viewed", ["categorySlug"]],
  ["dish_opened", ["dishSlug"]],
  ["dish_3d_clicked", ["dishSlug"]],
  ["dish_ar_clicked", ["dishSlug"]],
  ["filter_used", ["filterName"]],
  ["cta_clicked", ["ctaName"]]
]);

function asString(value) {
  return typeof value === "string" ? value : undefined;
}

function cleanShortText(value, maxLength) {
  const raw = asString(value);
  if (!raw) return undefined;
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function cleanSlug(value) {
  const slug = cleanShortText(value, 80);
  if (!slug || !SLUG_PATTERN.test(slug)) return undefined;
  return slug.toLowerCase();
}

const ENUMS = {
  demoMenu: ["maison-elyse", "le-trouvable", "sauge-noire"],
  queryLengthBucket: ["1-3", "4-10", "11-30", "31+"],
  locale: [...new Set(PUBLIC_MENU_LOCALE_OPTIONS.map(({ value }) => value.split("-")[0]))],
  deviceClass: ["mobile", "tablet", "desktop"],
  placement: ["table", "counter", "window", "receipt", "other"],
  campaign: ["demo", "launch", "seasonal"],
  entrySource: ["direct", "qr", "website", "social"],
  pageType: ["menu", "dish"],
  interaction: ["rotate", "zoom", "pan", "pointer"],
  outcome: ["launched", "unsupported", "failed", "presenting", "exited", "unknown", "session-started", "object-placed", "ended"],
  errorCode: ["load-failed", "timeout", "unsupported", "unknown"]
};
const NUMBERS = { durationMs: [0, 1800000], loadDurationMs: [0, 120000], resultCount: [0, 500], resultPosition: [1, 500] };
export function sanitizeAnalyticsMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  if (typeof value.qrId === "string" && UUID_PATTERN.test(value.qrId)) result.qrId = value.qrId;
  if (typeof value.modelAttemptId === "string" && UUID_PATTERN.test(value.modelAttemptId)) result.modelAttemptId = value.modelAttemptId;
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (allowed.includes(value[key])) result[key] = value[key];
  }
  for (const [key, [min, max]] of Object.entries(NUMBERS)) {
    if (Number.isInteger(value[key]) && value[key] >= min && value[key] <= max) result[key] = value[key];
  }
  return result;
}

function invalid(error) {
  return { ok: false, error };
}

export function validateAnalyticsEvent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return invalid("Invalid analytics payload.");
  }

  const candidate = input;
  const unknownKey = Object.keys(candidate).find((key) => !ALLOWED_KEYS.has(key));
  if (unknownKey) return invalid("Unknown analytics payload field.");

  const eventName = asString(candidate.eventName);
  const restaurantId = asString(candidate.restaurantId);
  const menuId = asString(candidate.menuId);
  const sessionId = asString(candidate.sessionId);
  const schemaVersion = candidate.schemaVersion ?? 1;
  if (schemaVersion !== 1 && schemaVersion !== 2) return invalid("Invalid analytics schema version.");
  if (schemaVersion === 2 && (!Number.isInteger(candidate.sequence) || candidate.sequence < 1 || candidate.sequence > 3600)) return invalid("Invalid event sequence.");
  if (schemaVersion === 2 && !UUID_PATTERN.test(candidate.eventId ?? "")) return invalid("Invalid event id.");
  const source = asString(candidate.source) ?? "demo";

  if (!eventName || !EVENT_NAME_SET.has(eventName)) {
    return invalid("Unknown analytics event.");
  }
  if (V2_EVENT_NAMES.includes(eventName) && schemaVersion !== 2) return invalid("This event requires analytics schema version 2.");
  if (!restaurantId || !UUID_PATTERN.test(restaurantId)) {
    return invalid("Invalid restaurant id.");
  }
  if (menuId !== undefined && !UUID_PATTERN.test(menuId)) {
    return invalid("Invalid menu id.");
  }
  if (!sessionId || !(UUID_PATTERN.test(sessionId) || (schemaVersion === 1 && /^session-[a-z0-9-]{1,80}$/.test(sessionId)))) return invalid("Invalid session id.");
  if (source !== "demo" && source !== "production") {
    return invalid("Invalid analytics source.");
  }
  if (eventName === "dashboard_demo_opened" && menuId) {
    return invalid("This analytics event is restaurant-scoped and cannot carry a menu id.");
  }
  if (!menuId && (source === "production" || eventName !== "dashboard_demo_opened")) {
    return invalid("Menu id is required for menu analytics.");
  }

  const dishSlug = cleanSlug(candidate.dishSlug);
  const categorySlug = cleanSlug(candidate.categorySlug);

  const filterName = cleanSlug(candidate.filterName);
  const ctaName = cleanShortText(candidate.ctaName, 80)?.match(/^[a-z0-9_-]{1,80}$/i)?.[0];
  if (candidate.metadata && Object.keys(candidate.metadata).some((key) => /email|phone|token|secret|password|address/i.test(key))) return invalid("Invalid analytics metadata.");
  const metadata = sanitizeAnalyticsMetadata(candidate.metadata);
  if (source === "demo") delete metadata.qrId;
  // v1 measured elapsed wall time; never relabel those values as v2 active time.
  if (schemaVersion === 1 && eventName === "session_duration" && Number.isInteger(candidate.metadata?.durationMs) && candidate.metadata.durationMs >= 0 && candidate.metadata.durationMs <= 86400000) metadata.durationMs = candidate.metadata.durationMs;
  if (candidate.metadata !== undefined && (!candidate.metadata || typeof candidate.metadata !== "object" || Array.isArray(candidate.metadata) || new TextEncoder().encode(JSON.stringify(candidate.metadata)).byteLength > MAX_METADATA_BYTES)) return invalid("Invalid analytics metadata.");
  if (eventName === "search_used" && !(typeof candidate.searchQuery === "string" && candidate.searchQuery.trim()) && !metadata.queryLengthBucket) return invalid("Search measurement is required.");
  if (["dish_selected", "dish_visible", "dish_dwell", "search_result_selected", "model_load_started", "model_load_succeeded", "model_load_failed", "model_interacted", "model_active_duration", "ar_outcome"].includes(eventName) && !dishSlug) return invalid("dishSlug is required.");
  const requiredMetadata = {
    search_results: "resultCount", search_result_selected: "resultPosition",
    model_load_succeeded: "loadDurationMs", model_load_failed: "errorCode",
    model_interacted: "interaction", ar_outcome: "outcome", locale_changed: "locale"
  }[eventName];
  if (requiredMetadata && metadata[requiredMetadata] === undefined) return invalid(`${requiredMetadata} is required for ${eventName}.`);
  const fieldValues = { dishSlug, categorySlug, filterName, ctaName };
  for (const field of REQUIRED_EVENT_FIELDS.get(eventName) ?? []) {
    if (!fieldValues[field]) return invalid(`${field} is required for ${eventName}.`);
  }
  if (["session_duration", "dish_dwell", "model_active_duration"].includes(eventName)) {
    const durationMs = Number(metadata?.durationMs);
    if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > (schemaVersion === 1 && eventName === "session_duration" ? 86_400_000 : 1_800_000)) {
      return invalid("durationMs is required for session_duration.");
    }
  }

  return {
    ok: true,
    payload: {
      schemaVersion,
      ...(schemaVersion === 2 ? { eventId: candidate.eventId, sequence: candidate.sequence } : {}),
      eventName,
      restaurantId,
      ...(menuId ? { menuId } : {}),
      sessionId,
      source,
      ...(dishSlug ? { dishSlug } : {}),
      ...(categorySlug ? { categorySlug } : {}),
      ...(filterName ? { filterName } : {}),
      ...(ctaName ? { ctaName } : {}),
      ...(metadata ? { metadata } : {})
    }
  };
}

export async function validateAnalyticsContext(payload, lookup) {
  if (payload.metadata?.qrId && (!payload.menuId || !lookup.publicQrBelongsToRestaurant || !await lookup.publicQrBelongsToRestaurant(payload.metadata.qrId, payload.restaurantId))) return false;
  if (payload.menuId) {
    return Boolean(
      await lookup.menuBelongsToRestaurant(payload.menuId, payload.restaurantId)
    );
  }

  return Boolean(await lookup.restaurantExists(payload.restaurantId));
}

/** Old browsers may continue baseline ingestion during a schema-first rollout.
 * Never discard v2 deduplication, ordering or deployment isolation guarantees. */
export function canRetryLegacyAnalyticsInsert(payload, error) {
  if ((payload.schemaVersion ?? 1) !== 1 || !EVENT_NAME_SET.has(payload.eventName) || V2_EVENT_NAMES.includes(payload.eventName)) return false;
  if (payload.source !== "demo" && !(payload.source === "production" && payload.environment === "production")) return false;
  return ["42703", "PGRST204"].includes(error?.code)
    && /(?:schema_version|event_id|sequence|environment)/i.test(error?.message ?? "")
    && /(?:column.*does not exist|could not find.*column.*schema cache)/i.test(error?.message ?? "");
}


/** Public QR row identity only. Never propagate QR tokens or admin credentials. */
export function publicQrAttributionPath(resolved) {
  if (resolved.targetKind !== "menu" || !UUID_PATTERN.test(resolved.qrId)) return resolved.targetPath;
  try {
    const url = new URL(resolved.targetPath, "https://vistaire.local");
    if (url.origin !== "https://vistaire.local" || !/^\/menu\/[^/]+\/?$/.test(url.pathname)) return resolved.targetPath;
    url.searchParams.set("source", "qr");
    url.searchParams.set("qrId", resolved.qrId);
    return `${url.pathname}${url.search}`;
  } catch { return resolved.targetPath; }
}
