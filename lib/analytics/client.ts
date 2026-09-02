"use client";

import { hasAnalyticsConsent } from "@/lib/privacy/consent";
import type {
  AnalyticsEventName,
  AnalyticsEventPayload
} from "./types.ts";

type TrackMenuEventInput = Partial<
  Omit<AnalyticsEventPayload, "eventName" | "sessionId" | "source">
> & {
  eventName: AnalyticsEventName;
  source?: AnalyticsEventPayload["source"];
};

const SESSION_KEY = "vistaire.analytics.sessionId.v1";
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
  source: "production";
};

type PublicMenuAnalyticsInput = {
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

  const timestamp = Date.now().toString(36);
  const monotonic =
    typeof performance !== "undefined"
      ? performance.now().toString(36).replace(".", "")
      : timestamp;
  return `session-${timestamp}-${monotonic}`;
}

function getSessionId(): string {
  if (typeof window === "undefined") return createSessionId();

  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = createSessionId();
    window.sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return createSessionId();
  }
}

function getViewport(): AnalyticsEventPayload["viewport"] {
  if (typeof window === "undefined") return undefined;
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio
  };
}

export function trackMenuEvent(input: TrackMenuEventInput): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  const source = input.source ?? "demo";
  const restaurantId =
    input.restaurantId ?? (source === "demo" ? DEMO_RESTAURANT_ID : undefined);
  const menuId = input.menuId ?? (source === "demo" ? DEMO_MENU_ID : undefined);
  if (!restaurantId || (source === "production" && !menuId)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Vistaire analytics] missing relational menu context");
    }
    return;
  }
  const dedupeKey = [
    restaurantId,
    menuId,
    input.eventName,
    input.dishSlug,
    input.categorySlug,
    input.searchQuery,
    input.filterName,
    input.ctaName
  ].join(":");
  const now = Date.now();
  const lastSeen = recentEvents.get(dedupeKey) ?? 0;
  if (now - lastSeen < 1_000) return;
  recentEvents.set(dedupeKey, now);

  const payload: AnalyticsEventPayload = {
    eventName: input.eventName,
    restaurantId,
    menuId,
    sessionId: getSessionId(),
    source,
    dishSlug: input.dishSlug,
    categorySlug: input.categorySlug,
    searchQuery: input.searchQuery,
    filterName: input.filterName,
    ctaName: input.ctaName,
    viewport: getViewport(),
    metadata: input.metadata
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
}

export function getPublicMenuAnalyticsContext(
  menu: PublicMenuAnalyticsInput
): PublicMenuAnalyticsContext | null {
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
  trackMenuEvent({ ...input, ...context });
}
