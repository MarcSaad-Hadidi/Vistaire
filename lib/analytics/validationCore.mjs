const ANALYTICS_EVENT_NAMES = [
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
export const ADMIN_INSTRUMENTATION_VERSION = "admin-vnext-observed-v1";
const ALLOWED_KEYS = new Set([
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
  ["search_used", ["searchQuery"]],
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

function cleanSearchQuery(value) {
  const normalized = cleanShortText(value, 80);
  if (!normalized) return undefined;

  const withoutEmails = normalized.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[email]"
  );
  return withoutEmails.replace(/(?:\+?\d[\s().-]*){7,}\d/g, "[telephone]");
}

function cleanSlug(value) {
  const slug = cleanShortText(value, 80);
  if (!slug || !SLUG_PATTERN.test(slug)) return undefined;
  return slug.toLowerCase();
}

function cleanViewport(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value;
  const width = Number(candidate.width);
  const height = Number(candidate.height);
  const dpr = Number(candidate.dpr);

  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;

  return {
    width: Math.max(0, Math.min(10_000, Math.round(width))),
    height: Math.max(0, Math.min(10_000, Math.round(height))),
    ...(Number.isFinite(dpr) ? { dpr: Math.max(0, Math.min(8, dpr)) } : {})
  };
}

function hasSensitiveKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  return Object.entries(value).some(([key, child]) => {
    if (/(?:email|phone|telephone|token|secret|password|authorization|cookie|address)/i.test(key)) {
      return true;
    }
    return hasSensitiveKey(child);
  });
}

function cleanMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (hasSensitiveKey(value)) return undefined;
  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).byteLength > MAX_METADATA_BYTES) return undefined;
  return JSON.parse(json);
}

function invalid(error) {
  return { ok: false, error };
}

export function isAnalyticsRequestSameOrigin(input) {
  if (typeof input?.secFetchSite === "string" && input.secFetchSite.toLowerCase() === "cross-site") return false;
  return !input?.origin || input.origin === input.expectedOrigin;
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
  const sessionId = cleanShortText(candidate.sessionId, 128);
  const source = asString(candidate.source) ?? "demo";

  if (!eventName || !EVENT_NAME_SET.has(eventName)) {
    return invalid("Unknown analytics event.");
  }
  if (!restaurantId || !UUID_PATTERN.test(restaurantId)) {
    return invalid("Invalid restaurant id.");
  }
  if (menuId !== undefined && !UUID_PATTERN.test(menuId)) {
    return invalid("Invalid menu id.");
  }
  if (!sessionId) return invalid("Invalid session id.");
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
  const searchQuery = cleanSearchQuery(candidate.searchQuery);
  const filterName = cleanShortText(candidate.filterName, 80);
  const ctaName = cleanShortText(candidate.ctaName, 80);
  const viewport = cleanViewport(candidate.viewport);
  const metadata = cleanMetadata(candidate.metadata);
  if (candidate.viewport !== undefined && !viewport) {
    return invalid("Invalid analytics viewport.");
  }
  if (candidate.metadata !== undefined && !metadata) {
    return invalid("Invalid analytics metadata.");
  }
  const fieldValues = { dishSlug, categorySlug, searchQuery, filterName, ctaName };
  for (const field of REQUIRED_EVENT_FIELDS.get(eventName) ?? []) {
    if (!fieldValues[field]) return invalid(`${field} is required for ${eventName}.`);
  }
  if (eventName === "session_duration") {
    const durationMs = Number(metadata?.durationMs);
    if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 86_400_000) {
      return invalid("durationMs is required for session_duration.");
    }
  }
  if (source === "production" && metadata?.instrumentationVersion !== ADMIN_INSTRUMENTATION_VERSION) {
    return invalid("Invalid analytics instrumentation version.");
  }

  return {
    ok: true,
    payload: {
      eventName,
      restaurantId,
      ...(menuId ? { menuId } : {}),
      sessionId,
      source,
      ...(dishSlug ? { dishSlug } : {}),
      ...(categorySlug ? { categorySlug } : {}),
      ...(searchQuery ? { searchQuery } : {}),
      ...(filterName ? { filterName } : {}),
      ...(ctaName ? { ctaName } : {}),
      ...(viewport ? { viewport } : {}),
      ...(metadata ? { metadata } : {})
    }
  };
}

export async function validateAnalyticsContext(payload, lookup) {
  if (payload.menuId) {
    const menuMatches = await lookup.menuBelongsToRestaurant(payload.menuId, payload.restaurantId);
    if (!menuMatches) return false;
    if (payload.dishSlug && !(await lookup.dishBelongsToMenu(payload.dishSlug, payload.menuId, payload.restaurantId))) return false;
    if (payload.categorySlug && !(await lookup.categoryBelongsToMenu(payload.categorySlug, payload.menuId, payload.restaurantId))) return false;
    return true;
  }

  return Boolean(await lookup.restaurantExists(payload.restaurantId));
}
