import "server-only";

/**
 * Public menu data is intentionally cached for a short bounded interval.
 * Signed media URLs are not stored here; the menu cache only contains the
 * versioned delivery metadata needed to render a menu.
 */
export const PUBLIC_MENU_CACHE_REVALIDATE_SECONDS = 60;
export const PUBLIC_MENU_CACHE_VERSION = "v2";

function normalizeTagPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
}

export function publicMenuCacheTags(args: {
  slug: string;
  restaurantId?: string;
  locale?: string;
}): string[] {
  const slug = normalizeTagPart(args.slug);
  const restaurantId = args.restaurantId
    ? normalizeTagPart(args.restaurantId)
    : "";
  const locale = args.locale ? normalizeTagPart(args.locale) : "";
  const tags = [`public-menu:${slug}`, `menu-slug:${slug}`];
  if (restaurantId) {
    tags.push(`public-menu:restaurant:${restaurantId}`, `restaurant:${restaurantId}`);
  }
  if (locale) {
    tags.push(`public-menu:${slug}:locale:${locale}`, `menu-locale:${slug}:${locale}`);
  }
  return tags;
}

export async function revalidatePublicMenuCache(args: {
  slug: string;
  restaurantId?: string;
}): Promise<void> {
  // Keep the Next server-only dependency lazy so dependency-injected menu
  // contract tests can exercise the loader without booting the Next runtime.
  const { revalidateTag } = await import("next/cache");
  // Owner/Admin mutations are route-handler writes: expire immediately for
  // read-your-writes. The 60s TTL only applies when no mutation invalidation
  // has occurred.
  for (const tag of publicMenuCacheTags(args)) revalidateTag(tag, { expire: 0 });
}

/**
 * Build a cache entry per normalized slug/locale. Creating the wrapper per
 * key lets us attach exact invalidation tags without caching user/session
 * state. The loader is only invoked by the cache and receives no request
 * object, cookies, or authorization context.
 */
export async function getCachedPublicMenu<T>(args: {
  slug: string;
  locale: string;
  loader: () => Promise<T>;
}): Promise<T> {
  const { unstable_cache } = await import("next/cache");
  const slug = normalizeTagPart(args.slug);
  const locale = normalizeTagPart(args.locale);
  const cachedLoader = unstable_cache(
    args.loader,
    ["public-menu", PUBLIC_MENU_CACHE_VERSION, slug, locale],
    {
      revalidate: PUBLIC_MENU_CACHE_REVALIDATE_SECONDS,
      tags: publicMenuCacheTags({ slug, locale })
    }
  );
  return cachedLoader();
}
