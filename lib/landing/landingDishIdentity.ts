import type { PublicMenuDish } from "../menu/publicMenuCore";

export type LandingDishIdentity = {
  id?: string | null;
  slug?: string | null;
};

type DishIdentityCandidate = Pick<PublicMenuDish, "id" | "slug">;

export type LandingDishPhoto = {
  source: "imageUrl" | "thumbnailUrl" | "posterUrl";
  url: string;
};

export type LandingResolvedDishPhoto =
  | LandingDishPhoto
  | { source: "fallback"; url: string }
  | null;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedId(value: unknown): string {
  return text(value).toLowerCase();
}

function normalizedSlug(value: unknown): string {
  return text(value).toLowerCase();
}

function uniqueSlugMatch<T extends DishIdentityCandidate>(
  dishes: readonly T[],
  slug: string
): T | null {
  const matches = dishes.filter(
    (dish) => normalizedSlug(dish.slug) === normalizedSlug(slug)
  );
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Resolve a preferred public dish without letting a reused slug override a
 * known id. A slug is only a compatibility fallback when the id is absent or
 * no longer present and the slug identifies exactly one live dish.
 */
export function findLandingDishByIdentity<T extends DishIdentityCandidate>(
  dishes: readonly T[],
  identity: LandingDishIdentity
): T | null {
  const id = normalizedId(identity.id);
  if (id) {
    const idMatches = dishes.filter((dish) => normalizedId(dish.id) === id);
    if (idMatches.length === 1) return idMatches[0];
    if (idMatches.length > 1) return null;
  }

  const slug = normalizedSlug(identity.slug);
  return slug ? uniqueSlugMatch(dishes, slug) : null;
}

/**
 * Match a live dish to a verified landing fallback. Known ids are decisive;
 * slug matching is intentionally constrained to an unambiguous menu.
 */
export function landingDishIdentityMatches<T extends DishIdentityCandidate>(
  candidate: T,
  reference: LandingDishIdentity,
  siblings: readonly T[] = []
): boolean {
  const candidateId = normalizedId(candidate.id);
  const referenceId = normalizedId(reference.id);
  if (candidateId && referenceId) return candidateId === referenceId;

  const candidateSlug = normalizedSlug(candidate.slug);
  const referenceSlug = normalizedSlug(reference.slug);
  if (!candidateSlug || candidateSlug !== referenceSlug) return false;

  const menuDishes = [candidate, ...siblings.filter((dish) => dish !== candidate)];
  return (
    menuDishes.filter(
      (dish) => normalizedSlug(dish.slug) === candidateSlug
    ).length === 1
  );
}

export function canonicalLandingDishPhotoId(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, "https://landing-photo.invalid");
    const match = parsed.pathname.match(
      /^\/api\/public\/menu-dishes\/([^/]+)\/photo$/
    );
    return match ? decodeURIComponent(match[1]).toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Return only a photo that can belong to this dish. Versioned and unversioned
 * canonical URLs are both valid when their path id matches the dish id;
 * canonical URLs for another dish are discarded before any fallback logic.
 */
export function landingPhotoForDish(
  dish: Pick<PublicMenuDish, "id" | "imageUrl" | "thumbnailUrl" | "posterUrl">
): LandingDishPhoto | null {
  const fields = [
    ["imageUrl", dish.imageUrl],
    ["thumbnailUrl", dish.thumbnailUrl],
    ["posterUrl", dish.posterUrl]
  ] as const;
  const dishId = normalizedId(dish.id);
  const valid = fields.filter(([, value]) => {
    const url = text(value);
    if (!url) return false;
    const canonicalId = canonicalLandingDishPhotoId(url);
    return !canonicalId || (Boolean(dishId) && canonicalId === dishId);
  });

  const ownCanonical = valid.find(
    ([, value]) => canonicalLandingDishPhotoId(text(value)) !== null
  );
  const selected = ownCanonical ?? valid[0];
  return selected
    ? { source: selected[0], url: text(selected[1]) }
    : null;
}

export function resolveLandingDishPhoto<T extends DishIdentityCandidate>(
  dish: T & Pick<PublicMenuDish, "imageUrl" | "thumbnailUrl" | "posterUrl">,
  fallback: LandingDishIdentity & { image?: string | null },
  siblings: readonly T[] = []
): LandingResolvedDishPhoto {
  const livePhoto = landingPhotoForDish(dish);
  if (livePhoto) return livePhoto;
  if (
    !landingDishIdentityMatches(dish, fallback, siblings) ||
    !text(fallback.image)
  ) {
    return null;
  }
  return { source: "fallback", url: text(fallback.image) };
}

export function dedupeLandingDishPhotos<
  T extends { featuredDish: { image: string; imageSource: string } }
>(experiences: readonly T[]): T[] {
  const claimedImages = new Set<string>();
  return experiences.map((experience) => {
    const image = text(experience.featuredDish.image);
    if (!image || !claimedImages.has(image)) {
      if (image) claimedImages.add(image);
      return experience;
    }
    return {
      ...experience,
      featuredDish: {
        ...experience.featuredDish,
        image: "",
        imageSource: "unavailable"
      }
    } as T;
  });
}
