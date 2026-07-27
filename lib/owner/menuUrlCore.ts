import type { Locale } from "../i18n.ts";
import { normalizePublicMenuLocale } from "../menu/publicMenuSettings.ts";

export type OwnerQrTargetKind = "menu" | "admin";

export type OwnerQrTarget = {
  targetKind: OwnerQrTargetKind;
  label: string;
  usage: string;
  targetPath: string;
  badgeLabel: string;
};

type BuildOwnerQrTargetArgs = {
  targetKind: OwnerQrTargetKind;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
};

const MAX_OWNER_QR_TARGET_PATH_LENGTH = 512;

export function slugifyRestaurantSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildRestaurantMenuPath(slugOrName: string): string {
  const slug = slugifyRestaurantSlug(slugOrName);
  if (!slug) return "/demo";

  return `/demo?restaurant=${encodeURIComponent(slug)}`;
}

export function buildRestaurantDashboardPath(restaurantIdOrSlug: string): string {
  const safeId = restaurantIdOrSlug.trim();
  if (!safeId) return "/owner";

  return `/owner/restaurants/${encodeURIComponent(safeId)}`;
}

/**
 * Production public menu path served by app/menu/[slug].
 * Distinct from buildRestaurantMenuPath (which stays the /demo preview link
 * relied on by marketing pages and tests).
 */
export function buildPublicMenuPath(
  slugOrName: string,
  params?: {
    lang?: Locale | string;
    currency?: string;
    table?: string;
    zone?: string;
    view?: string;
  }
): string {
  const slug = slugifyRestaurantSlug(slugOrName);
  if (!slug) return "/demo";

  const query = new URLSearchParams();
  const lang = params?.lang?.toString().trim();
  const currency = params?.currency?.toString().trim();
  const table = params?.table?.toString().trim();
  const zone = params?.zone?.toString().trim();
  const view = params?.view?.toString().trim();
  if (lang) query.set("lang", normalizePublicMenuLocale(lang));
  if (currency) query.set("currency", currency.toUpperCase().slice(0, 3));
  if (table) query.set("table", table.slice(0, 24));
  if (zone) query.set("zone", zone.slice(0, 24));
  if (view) query.set("view", view.slice(0, 24));

  const suffix = query.toString();
  return suffix
    ? `/menu/${encodeURIComponent(slug)}?${suffix}`
    : `/menu/${encodeURIComponent(slug)}`;
}

/**
 * Public secure QR redirect path. The token is opaque and resolved server-side
 * (app/q/[token]); it is never derived from the slug or a DB id.
 */
export function buildQrRedirectPath(token: string): string {
  return `/q/${encodeURIComponent(token)}`;
}

export function sanitizeOwnerQrTargetPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\")) return null;

  try {
    const parsed = new URL(trimmed, "https://vistaire.local");
    if (parsed.origin !== "https://vistaire.local") return null;
    return `${parsed.pathname}${parsed.search}`.slice(0, MAX_OWNER_QR_TARGET_PATH_LENGTH);
  } catch {
    return null;
  }
}

export function isOwnerQrTargetPathAllowed(
  targetKind: OwnerQrTargetKind,
  input: string
): boolean {
  const targetPath = sanitizeOwnerQrTargetPath(input);
  if (!targetPath) return false;

  if (targetKind === "menu") {
    return targetPath === "/demo" || targetPath.startsWith("/menu/");
  }

  return targetPath === "/admin";
}

/**
 * Resolution policy for persisted rows. New admin QR codes must target /admin,
 * while already printed owner QR codes remain valid during migration.
 */
export function isOwnerQrResolvedTargetPathAllowed(
  targetKind: OwnerQrTargetKind,
  input: string
): boolean {
  const targetPath = sanitizeOwnerQrTargetPath(input);
  if (!targetPath) return false;
  if (isOwnerQrTargetPathAllowed(targetKind, targetPath)) return true;
  if (targetKind !== "admin") return false;
  return (
    targetPath === "/owner" ||
    targetPath.startsWith("/owner/") ||
    targetPath.startsWith("/owner?")
  );
}

export function inferOwnerQrTargetKind(targetPath: string): OwnerQrTargetKind {
  return isOwnerQrResolvedTargetPathAllowed("admin", targetPath)
    ? "admin"
    : "menu";
}

export function buildOwnerQrTarget(args: BuildOwnerQrTargetArgs): OwnerQrTarget {
  const restaurantName = args.restaurantName.trim() || "Restaurant";

  if (args.targetKind === "admin") {
    return {
      targetKind: "admin",
      label: `QR dashboard restaurant - ${restaurantName}`,
      usage: "Ne pas imprimer pour les clients.",
      targetPath: "/admin",
      badgeLabel: "Interne restaurant"
    };
  }

  const targetPath = buildPublicMenuPath(args.restaurantSlug || restaurantName);
  return {
    targetKind: "menu",
    label: `QR menu - ${restaurantName}`,
    usage: "A imprimer sur les tables ou a donner aux clients.",
    targetPath,
    badgeLabel: "Public client"
  };
}
