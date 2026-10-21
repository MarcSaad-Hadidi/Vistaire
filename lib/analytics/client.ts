"use client";

import {
  currentAnalyticsSessionGeneration,
  hasAnalyticsConsent,
  VISTAIRE_ANALYTICS_SESSION_KEY
} from "../privacy/consent.ts";
import type {
  AnalyticsEventName,
  AnalyticsEventPayload
} from "./types.ts";

import { sanitizeAnalyticsMetadata } from "./validationCore.mjs";

type TrackMenuEventInput = Partial<
  Omit<AnalyticsEventPayload, "eventName" | "sessionId" | "source">
> & {
  eventName: AnalyticsEventName;
  source?: AnalyticsEventPayload["source"];
};

const SESSION_KEY = VISTAIRE_ANALYTICS_SESSION_KEY;
const DEMO_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ??
  "11111111-1111-1111-1111-111111111111";
const DEMO_MENU_ID =
  process.env.NEXT_PUBLIC_DEMO_MENU_ID ??
  "22222222-2222-2222-2222-222222222222";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const recentEvents = new Map<string, number>();

export type PublicMenuAnalyticsContext = {
  restaurantId: string;
  menuId: string;
  source: "production" | "demo";
};

type PublicMenuAnalyticsInput = {
  slug?: string;
  restaurantId: string;
  menuId?: string;
  source: "supabase" | "demo";
};

function createSessionId(): string {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
      12,
      16
    )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return ""; // Do not substitute identifying timestamps if secure randomness is unavailable.
}

let memorySession: { id: string; expires: number; sequence: number; started?: string[] } | undefined;
let memorySessionGeneration = currentAnalyticsSessionGeneration();
function getSessionId(reservedEvents = 1, allowRotation = true): string {
  const now = Date.now();
  if (memorySessionGeneration !== currentAnalyticsSessionGeneration()) {
    memorySession = undefined;
    memorySessionGeneration = currentAnalyticsSessionGeneration();
  }
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (UUID_PATTERN.test(saved.id) && saved.expires > now && saved.expires <= now + 1800000) memorySession = saved;
    }
  } catch { /* In-memory session works when storage is unavailable. */ }
  if (!memorySession || memorySession.expires <= now || memorySession.sequence + reservedEvents > 3600) {
    if (!allowRotation) return "";
    memorySession = { id: createSessionId(), expires: now + 1800000, sequence: 0 };
    try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(memorySession)); } catch { /* No persistence required. */ }
  }
  return memorySession.id;
}

function nextSessionSequence(): number {
  if (!memorySession) return 1;
  memorySession.sequence = Math.min(3600, (Number.isInteger(memorySession.sequence) ? memorySession.sequence : 0) + 1);
  try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(memorySession)); } catch { /* Memory-only session. */ }
  return memorySession.sequence;
}

function browserMetadata() {
  const params = new URLSearchParams(window.location?.search ?? "");
  return sanitizeAnalyticsMetadata({
    qrId: params.get("qrId"),
    placement: params.get("placement"), campaign: params.get("campaign"),
    entrySource: params.get("source") ?? "direct",
    locale: typeof document !== "undefined" ? document.documentElement.lang.split("-")[0] : undefined,
    deviceClass: window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop"
  });
}
let rateWindow = 0;
let rateCount = 0;

type VisibleMenu = { menu: PublicMenuAnalyticsInput; dish?: { slug: string; categorySlug?: string }; isVisible: () => boolean; opening: { sessionId?: string } };
const visibleMenus = new Set<VisibleMenu>();

/** Registration does not collect anything until the public surface is visibly active. */
export function registerPublicMenuVisibility(menu: PublicMenuAnalyticsInput, dish: VisibleMenu["dish"], isVisible: () => boolean, opening: { sessionId?: string } = {}): () => void {
  const registration = { menu, dish, isVisible, opening };
  if (visibleMenus.size < 120) visibleMenus.add(registration);
  return () => { visibleMenus.delete(registration); };
}

function collectionAllowed(): boolean {
  return typeof window !== "undefined" && process.env.NEXT_PUBLIC_ANALYTICS_DISABLED !== "true" && hasAnalyticsConsent() &&
    !(typeof navigator !== "undefined" && (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl));
}

export function trackMenuEvent(input: TrackMenuEventInput): void {
  sendMenuEvent(input);
}

function sendMenuEvent(input: TrackMenuEventInput, initialize = true, batchSessionId?: string): boolean {
  if (!collectionAllowed()) return false;
  const source = input.source ?? "demo";
  const restaurantId =
    input.restaurantId ?? (source === "demo" ? DEMO_RESTAURANT_ID : undefined);
  const menuId = input.menuId ?? (source === "demo" ? DEMO_MENU_ID : undefined);
  if (!restaurantId || (source === "production" && !menuId)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Vistaire analytics] missing relational menu context");
    }
    return false;
  }
  const matching = initialize ? [...visibleMenus].filter(entry => {
    const context = getPublicMenuAnalyticsContext(entry.menu);
    return context?.source === source && context.restaurantId === restaurantId && context.menuId === menuId &&
      (source !== "demo" || !input.metadata?.demoMenu || input.metadata.demoMenu === (entry.menu.slug === "trouvable" ? "le-trouvable" : entry.menu.slug));
  }) : [];
  const active = matching.filter(entry => entry.isVisible());
  const visible = (input.dishSlug ? active.find(entry => entry.dish?.slug === input.dishSlug) : undefined) ??
    active.find(entry => !entry.dish) ?? active[0];
  // Reserve start, page opening and triggering event together. Never recurse into initialization.
  const sessionId = batchSessionId ?? getSessionId(visible ? 3 : 1, Boolean(visible) || matching.length === 0);
  if (!sessionId) return false;
  if (visible && memorySession) {
    if (!startPublicMenuSession(visible.menu, sessionId)) return false;
    const opening = visible.dish ? "dish_opened" : "menu_opened";
    if (visible.opening.sessionId !== sessionId) {
      const accepted = sendMenuEvent({ ...getPublicMenuAnalyticsContext(visible.menu)!, eventName: opening,
        dishSlug: visible.dish?.slug, categorySlug: visible.dish?.categorySlug,
        metadata: { pageType: visible.dish ? "dish" : "menu", ...(source === "demo" ? sanitizeAnalyticsMetadata({demoMenu: visible.menu.slug === "trouvable" ? "le-trouvable" : visible.menu.slug}) : {}) } }, false, sessionId);
      if (!accepted) return false;
      visible.opening.sessionId = sessionId;
    }
    if (input.eventName === opening && input.dishSlug === visible.dish?.slug) return true;
  }
  const dedupeKey = [
    sessionId,
    source,
    restaurantId,
    menuId,
    input.eventName,
    input.dishSlug,
    input.categorySlug,
    input.filterName,
    input.ctaName,
    JSON.stringify(sanitizeAnalyticsMetadata(input.metadata))
  ].join(":");
  const now = Date.now();
  if (now - rateWindow >= 60000) { rateWindow = now; rateCount = 0; }
  if (rateCount >= 120) return false;
  for (const [key, timestamp] of recentEvents) if (now - timestamp >= 1000) recentEvents.delete(key);
  const lastSeen = recentEvents.get(dedupeKey) ?? 0;
  const durationDelta = ["session_duration", "dish_dwell", "model_active_duration"].includes(input.eventName);
  if (!durationDelta && now - lastSeen < 1_000) return false;
  recentEvents.set(dedupeKey, now);
  rateCount += 1;
  const eventId = createSessionId();
  if (!sessionId || !eventId) return false;
  const queryLength = input.searchQuery?.trim().length;

  const payload: AnalyticsEventPayload = {
    schemaVersion: 2,
    sequence: nextSessionSequence(),
    eventId,
    eventName: input.eventName,
    restaurantId,
    menuId,
    sessionId,
    source,
    dishSlug: input.dishSlug,
    categorySlug: input.categorySlug,
    filterName: input.filterName,
    ctaName: input.ctaName,
    metadata: sanitizeAnalyticsMetadata({
      ...browserMetadata(),
      ...(queryLength ? { queryLengthBucket: queryLength <= 3 ? "1-3" : queryLength <= 10 ? "4-10" : queryLength <= 30 ? "11-30" : "31+" } : {}),
      ...input.metadata
    })
  };

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify(payload)
  }).catch((error) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[Vistaire analytics] event skipped", error);
    }
  });
  return true;
}

export function getPublicMenuAnalyticsContext(
  menu: PublicMenuAnalyticsInput
): PublicMenuAnalyticsContext | null {
  if (menu.source === "demo") {
    return { restaurantId: DEMO_RESTAURANT_ID, menuId: DEMO_MENU_ID, source: "demo" };
  }
  if (
    menu.source !== "supabase" ||
    !UUID_PATTERN.test(menu.restaurantId) ||
    !menu.menuId ||
    !UUID_PATTERN.test(menu.menuId)
  ) {
    return null;
  }

  return {
    restaurantId: menu.restaurantId,
    menuId: menu.menuId,
    source: "production"
  };
}

export function trackPublicMenuEvent(
  menu: PublicMenuAnalyticsInput,
  input: Omit<TrackMenuEventInput, "restaurantId" | "menuId" | "source">
): void {
  const context = getPublicMenuAnalyticsContext(menu);
  if (!context) return;
  trackMenuEvent({ ...input, ...context, metadata: { ...input.metadata, ...(context.source === "demo" ? sanitizeAnalyticsMetadata({ demoMenu: menu.slug === "trouvable" ? "le-trouvable" : menu.slug }) : {}) } });
}

/** Call only when the menu or dish is actually visible. */
export function trackPublicMenuSessionStarted(menu: PublicMenuAnalyticsInput): boolean {
  return startPublicMenuSession(menu);
}

function startPublicMenuSession(menu: PublicMenuAnalyticsInput, batchSessionId?: string): boolean {
  if (!collectionAllowed()) return false;
  const context = getPublicMenuAnalyticsContext(menu);
  if (!context) return false;
  const sessionId = batchSessionId ?? getSessionId();
  if (!sessionId || !memorySession) return false;
  const demo = context.source === "demo" ? sanitizeAnalyticsMetadata({ demoMenu: menu.slug === "trouvable" ? "le-trouvable" : menu.slug }).demoMenu ?? "" : "";
  const key = `${context.source}:${context.restaurantId}:${context.menuId}:${demo}`;
  const started = Array.isArray(memorySession.started) ? memorySession.started.slice(0, 120) : [];
  if (started.includes(key)) return true;
  if (started.length >= 120) return false;
  if (!sendMenuEvent({ ...context, eventName: "session_started", metadata: demo ? { demoMenu: demo } : {} }, false, sessionId)) return false;
  memorySession.started = [...started, key];
  try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(memorySession)); } catch { /* Memory-only session. */ }
  return true;
}
