export const LANDING_DATA_CACHE_SECONDS = 900;
export const STATIC_LANDING_FALLBACK_RETRY_SECONDS = 60;

const LANDING_DATA_CACHE_MILLISECONDS = LANDING_DATA_CACHE_SECONDS * 1_000;
const PUBLIC_CACHE_NAMESPACE = "vistaire-public";
const PUBLIC_CACHE_POLICY_VERSION = "v1";
const MAX_NEXT_CACHE_TAG_LENGTH = 256;
const MAX_IDENTIFIER_LENGTH = 64;
const MAX_SLUG_LENGTH = 80;
const MAX_VERSION_LENGTH = 32;
const MAX_REVISION_LENGTH = 64;

export type PublicCacheLocale = "fr" | "en";

type LandingCacheAddress = {
  restaurantKey: unknown;
  experienceId: unknown;
  locale: unknown;
  version: unknown;
  epoch: unknown;
};

type LandingCacheScope = Pick<
  LandingCacheAddress,
  "restaurantKey" | "experienceId" | "locale"
>;

type FuturePublicMenuCacheAddress = {
  restaurantId: unknown;
  menuId: unknown;
  menuSlug: unknown;
  locale: unknown;
  version: unknown;
  revision: unknown;
};

function cacheInputError(field: string): TypeError {
  return new TypeError(`Invalid public cache ${field}.`);
}

function boundedString(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string") throw cacheInputError(field);
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > maximum ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw cacheInputError(field);
  }
  return normalized;
}

function safeIdentifier(value: unknown, field: string): string {
  const normalized = boundedString(value, field, MAX_IDENTIFIER_LENGTH).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    throw cacheInputError(field);
  }
  return normalized;
}

function safeSlug(value: unknown, field: string): string {
  const source = boundedString(value, field, MAX_SLUG_LENGTH);
  const normalized = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized || normalized.length > MAX_SLUG_LENGTH) {
    throw cacheInputError(field);
  }
  return normalized;
}

function safeVersionLike(value: unknown, field: string, maximum: number): string {
  const normalized = boundedString(value, field, maximum).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    throw cacheInputError(field);
  }
  return normalized;
}

function encoded(label: string, value: string): string {
  return `${label}=${encodeURIComponent(value)}`;
}

function assertedEpoch(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw cacheInputError("epoch");
  }
  return value;
}

function checkedTag(parts: readonly string[]): string {
  const tag = parts.join(":");
  if (tag.length > MAX_NEXT_CACHE_TAG_LENGTH) {
    throw new RangeError("Public cache tag length exceeds the platform limit.");
  }
  return tag;
}

export function normalizePublicCacheLocale(value: unknown): PublicCacheLocale {
  if (typeof value !== "string") throw cacheInputError("locale");
  const normalized = value.trim().toLowerCase();
  if (normalized !== "fr" && normalized !== "en") {
    throw cacheInputError("locale");
  }
  return normalized;
}

export function normalizePublicCacheExperience(value: unknown): string {
  return safeSlug(value, "experience");
}

export function normalizePublicCacheSlug(value: unknown): string {
  return safeSlug(value, "slug");
}

export function normalizePublicCacheRestaurantKey(value: unknown): string {
  return safeIdentifier(value, "restaurant");
}

export function normalizePublicCacheMenu(value: unknown): string {
  return safeIdentifier(value, "menu");
}

export function normalizePublicCacheVersion(value: unknown): string {
  return safeVersionLike(value, "version", MAX_VERSION_LENGTH);
}

export function normalizePublicCacheRevision(value: unknown): string {
  return safeVersionLike(value, "revision", MAX_REVISION_LENGTH);
}

export function landingCacheEpoch(nowMs: unknown): number {
  if (
    typeof nowMs !== "number" ||
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0
  ) {
    throw cacheInputError("timestamp");
  }
  return Math.floor(nowMs / LANDING_DATA_CACHE_MILLISECONDS);
}

function landingCacheKeyParts(
  kind: "experience" | "payload",
  address: LandingCacheAddress
): string[] {
  const version = normalizePublicCacheVersion(address.version);
  const restaurantKey = normalizePublicCacheRestaurantKey(address.restaurantKey);
  const experienceId = normalizePublicCacheExperience(address.experienceId);
  const locale = normalizePublicCacheLocale(address.locale);
  const epoch = assertedEpoch(address.epoch);
  return [
    PUBLIC_CACHE_NAMESPACE,
    PUBLIC_CACHE_POLICY_VERSION,
    "landing",
    kind,
    encoded("version", version),
    encoded("restaurant", restaurantKey),
    encoded("experience", experienceId),
    encoded("locale", locale),
    encoded("epoch", String(epoch))
  ];
}

export function landingExperienceCacheKeyParts(
  address: LandingCacheAddress
): string[] {
  return landingCacheKeyParts("experience", address);
}

export function landingPayloadCacheKeyParts(address: LandingCacheAddress): string[] {
  return landingCacheKeyParts("payload", address);
}

export function landingCacheTag(scope: LandingCacheScope): string {
  const restaurantKey = normalizePublicCacheRestaurantKey(scope.restaurantKey);
  const experienceId = normalizePublicCacheExperience(scope.experienceId);
  const locale = normalizePublicCacheLocale(scope.locale);
  return checkedTag([
    PUBLIC_CACHE_NAMESPACE,
    PUBLIC_CACHE_POLICY_VERSION,
    "landing",
    encoded("restaurant", restaurantKey),
    encoded("experience", experienceId),
    encoded("locale", locale)
  ]);
}

function futurePublicMenuParts(address: FuturePublicMenuCacheAddress): string[] {
  const version = normalizePublicCacheVersion(address.version);
  const restaurantId = safeIdentifier(address.restaurantId, "restaurant");
  const menuId = normalizePublicCacheMenu(address.menuId);
  const menuSlug = normalizePublicCacheSlug(address.menuSlug);
  const locale = normalizePublicCacheLocale(address.locale);
  const revision = normalizePublicCacheRevision(address.revision);
  return [
    PUBLIC_CACHE_NAMESPACE,
    PUBLIC_CACHE_POLICY_VERSION,
    "menu",
    encoded("version", version),
    encoded("restaurant", restaurantId),
    encoded("menu", menuId),
    encoded("slug", menuSlug),
    encoded("locale", locale),
    encoded("revision", revision)
  ];
}

/** Policy only: no production durable public-menu cache consumes this address. */
export function futurePublicMenuCacheKeyParts(
  address: FuturePublicMenuCacheAddress
): string[] {
  return futurePublicMenuParts(address);
}

/** Policy only: no production durable public-menu cache consumes this tag. */
export function futurePublicMenuCacheTag(
  address: FuturePublicMenuCacheAddress
): string {
  return checkedTag(futurePublicMenuParts(address));
}
