import "server-only";

/**
 * Public menu data is intentionally cached for a short bounded interval.
 * Signed media URLs are rejected before the loader can return to Next's
 * durable cache; only versioned public delivery metadata belongs here.
 */
export const PUBLIC_MENU_CACHE_REVALIDATE_SECONDS = 60;
export const PUBLIC_MENU_CACHE_VERSION = "v3";

type CacheEnvironment = {
  nodeEnv: string | undefined;
  ci: string | undefined;
  ownerE2EAuthBypass: string | undefined;
};

type UnstableCacheFactory = <T>(
  loader: () => Promise<T>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] }
) => (() => Promise<T>) | Promise<() => Promise<T>>;

export type PublicMenuCacheDependencies = {
  environment?: CacheEnvironment;
  unstableCache?: UnstableCacheFactory;
};

type PublicMenuRevalidationDependencies = {
  revalidateTag?: (
    tag: string,
    profile: { expire: number }
  ) => Promise<void> | void;
};

export type PublicMenuRevalidationResult = {
  ok: boolean;
  invalidatedTags: string[];
  failedTags: string[];
};

export class PublicMenuCacheInvalidatedDuringLoadError extends Error {
  constructor() {
    super("Public menu cache invalidated during load.");
    this.name = "PublicMenuCacheInvalidatedDuringLoadError";
  }
}

export function isPublicMenuCacheInvalidatedDuringLoadError(
  error: unknown
): error is PublicMenuCacheInvalidatedDuringLoadError {
  return error instanceof PublicMenuCacheInvalidatedDuringLoadError;
}

const publicMenuInFlight = new Map<string, Promise<unknown>>();
const publicMenuTagGenerations = new Map<string, number>();

function normalizeTagPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
}

export function publicMenuCacheTags(args: {
  slug?: string;
  restaurantId?: string;
  locale?: string;
}): string[] {
  const slug = args.slug ? normalizeTagPart(args.slug) : "";
  const restaurantId = args.restaurantId
    ? normalizeTagPart(args.restaurantId)
    : "";
  const locale = args.locale ? normalizeTagPart(args.locale) : "";
  const tags: string[] = [];
  if (slug) tags.push(`public-menu:${slug}`, `menu-slug:${slug}`);
  if (restaurantId) {
    tags.push(
      `public-menu:restaurant:${restaurantId}`,
      `restaurant:${restaurantId}`
    );
  }
  if (slug && locale) {
    tags.push(
      `public-menu:${slug}:locale:${locale}`,
      `menu-locale:${slug}:${locale}`
    );
  }
  return [...new Set(tags)];
}

function currentTagGeneration(tags: string[]): string {
  return tags
    .map((tag) => `${tag}:${publicMenuTagGenerations.get(tag) ?? 0}`)
    .join("|");
}

function advanceTagGenerations(tags: string[]): void {
  for (const tag of tags) {
    publicMenuTagGenerations.set(
      tag,
      (publicMenuTagGenerations.get(tag) ?? 0) + 1
    );
  }
  // An invalidation racing an unresolved cold read must not keep serving that
  // promise to post-commit callers. The generation guard below also prevents
  // the old loader from becoming a durable cache entry.
  publicMenuInFlight.clear();
}

export async function revalidatePublicMenuCache(
  args: { slug?: string; restaurantId?: string; locale?: string },
  dependencies: PublicMenuRevalidationDependencies = {}
): Promise<PublicMenuRevalidationResult> {
  const tags = publicMenuCacheTags(args);
  advanceTagGenerations(tags);
  const revalidateTag =
    dependencies.revalidateTag ??
    (await import("next/cache")).revalidateTag;
  const invalidatedTags: string[] = [];
  const failedTags: string[] = [];
  for (const tag of tags) {
    try {
      await revalidateTag(tag, { expire: 0 });
      invalidatedTags.push(tag);
    } catch {
      failedTags.push(tag);
    }
  }
  return {
    ok: failedTags.length === 0,
    invalidatedTags,
    failedTags
  };
}

function containsSignedAssetMaterial(
  value: unknown,
  seen: Set<object> = new Set()
): boolean {
  if (typeof value === "string") {
    return (
      value.includes("/storage/v1/object/sign/") ||
      /[?&]token=[^&#\s]+/i.test(value)
    );
  }
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => containsSignedAssetMaterial(entry, seen));
  }
  return Object.values(value as Record<string, unknown>).some((entry) =>
    containsSignedAssetMaterial(entry, seen)
  );
}

function assertDurableMenuCacheSafe(value: unknown): void {
  if (containsSignedAssetMaterial(value)) {
    throw new Error("Public menu cache refused signed asset material.");
  }
}

function defaultEnvironment(): CacheEnvironment {
  return {
    nodeEnv: process.env.NODE_ENV,
    ci: process.env.CI,
    ownerE2EAuthBypass: process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS
  };
}

async function getCachedPublicMenuValue<T>(args: {
  keyKind: "identity" | "menu";
  slug: string;
  locale: string;
  restaurantId?: string;
  loader: () => Promise<T>;
  dependencies?: PublicMenuCacheDependencies;
}): Promise<T> {
  const environment = args.dependencies?.environment ?? defaultEnvironment();
  const isHermeticE2E =
    environment.ci === "true" && environment.ownerE2EAuthBypass === "1";
  if (environment.nodeEnv !== "production" || isHermeticE2E) {
    return args.loader();
  }

  const slug = normalizeTagPart(args.slug);
  const locale = normalizeTagPart(args.locale);
  const restaurantId = args.restaurantId
    ? normalizeTagPart(args.restaurantId)
    : "";
  const tags = publicMenuCacheTags({
    slug,
    ...(args.keyKind === "menu" ? { locale, restaurantId } : {})
  });
  const inFlightKey = [
    PUBLIC_MENU_CACHE_VERSION,
    args.keyKind,
    restaurantId,
    slug,
    locale
  ].join("\u0000");
  const existing = publicMenuInFlight.get(inFlightKey) as Promise<T> | undefined;
  if (existing) return existing;

  const generation = currentTagGeneration(tags);
  const guardedLoader = async (): Promise<T> => {
    const value = await args.loader();
    assertDurableMenuCacheSafe(value);
    if (generation !== currentTagGeneration(tags)) {
      throw new PublicMenuCacheInvalidatedDuringLoadError();
    }
    return value;
  };
  const promise = (async () => {
    const unstableCache =
      args.dependencies?.unstableCache ??
      (await import("next/cache")).unstable_cache;
    const cachedLoader = await unstableCache(
      guardedLoader,
      [
        "public-menu",
        PUBLIC_MENU_CACHE_VERSION,
        args.keyKind,
        restaurantId,
        slug,
        locale
      ],
      {
        revalidate: PUBLIC_MENU_CACHE_REVALIDATE_SECONDS,
        tags
      }
    );
    return cachedLoader();
  })();
  publicMenuInFlight.set(inFlightKey, promise);
  try {
    return await promise;
  } finally {
    if (publicMenuInFlight.get(inFlightKey) === promise) {
      publicMenuInFlight.delete(inFlightKey);
    }
  }
}

/**
 * Builds one durable entry per normalized restaurant, slug, and locale. The
 * restaurant dimension is deliberate: it makes restaurant-tag invalidation
 * reliable even if the post-commit slug lookup fails.
 */
export function getCachedPublicMenu<T>(args: {
  slug: string;
  locale: string;
  restaurantId: string;
  loader: () => Promise<T>;
  dependencies?: PublicMenuCacheDependencies;
}): Promise<T> {
  return getCachedPublicMenuValue({ ...args, keyKind: "menu" });
}

/**
 * The lightweight slug lookup is cached separately so the full menu cache can
 * be tagged with its real restaurant id. The full loader still reads a fresh
 * restaurant row on a cache miss instead of reusing identity data as content.
 */
export function getCachedPublicMenuIdentity<T>(args: {
  slug: string;
  loader: () => Promise<T>;
  dependencies?: PublicMenuCacheDependencies;
}): Promise<T> {
  return getCachedPublicMenuValue({
    ...args,
    keyKind: "identity",
    locale: "identity"
  });
}
