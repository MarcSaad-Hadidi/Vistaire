"use client";

import {
  getGoogleReviewCta,
  normalizeGoogleReviewConfig,
  type GoogleReviewConfig,
  type PublicMenu
} from "@/lib/menu/publicMenuCore";
import { normalizePublicMenuLocale } from "@/lib/menu/publicMenuSettings";
import { trackGoogleReviewClick } from "./googleReviewTracking";
import { resolveTrouvableCopy } from "./trouvableMenuControls";
import styles from "./GoogleReviewCard.module.css";

type GoogleReviewCardProps = {
  googleReview: GoogleReviewConfig;
  locale?: string;
  localizedUiCopy?: Record<string, unknown>;
  onReviewRequest?: () => void;
  restaurantId: string;
  restaurantName: string;
  showNote?: boolean;
  source: PublicMenu["source"];
};

type GoogleReviewCopy = ReturnType<typeof resolveTrouvableCopy>["copy"]["googleReview"];

function renderGoogleReviewTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(
    /\{(restaurantName|rating|count)\}/g,
    (_match, key: string) => values[key] ?? ""
  );
}

export function resolveGoogleReviewCopy(
  locale: string,
  localizedUiCopy?: Record<string, unknown>
): GoogleReviewCopy {
  return resolveTrouvableCopy(
    normalizePublicMenuLocale(locale),
    localizedUiCopy
  ).copy.googleReview;
}

function formatRating(rating: number, resolvedLocale: string): string {
  return new Intl.NumberFormat(resolvedLocale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(rating) ? 0 : 1
  }).format(rating);
}

function formatReviewCount(count: number, resolvedLocale: string): string {
  return new Intl.NumberFormat(resolvedLocale).format(count);
}

export function GoogleReviewCard({
  googleReview,
  locale = "fr",
  localizedUiCopy,
  onReviewRequest,
  restaurantId,
  restaurantName,
  showNote = true,
  source
}: GoogleReviewCardProps) {
  const resolvedLocale = normalizePublicMenuLocale(locale);
  const copy = resolveGoogleReviewCopy(resolvedLocale, localizedUiCopy);
  const normalizedGoogleReview = normalizeGoogleReviewConfig(googleReview);
  const cta = getGoogleReviewCta(normalizedGoogleReview);
  const isPresentationOnly =
    normalizedGoogleReview.enabled && normalizedGoogleReview.presentationOnly === true;
  if (!cta && !isPresentationOnly) return null;

  const cleanRestaurantName = restaurantName.trim() || copy.fallbackRestaurant;
  const metadata = [
    normalizedGoogleReview.googleRating === undefined
      ? ""
      : renderGoogleReviewTemplate(
          isPresentationOnly ? copy.presentationRatingLabel : copy.ratingLabel,
          {
            rating: formatRating(normalizedGoogleReview.googleRating, resolvedLocale)
          }
        ),
    normalizedGoogleReview.googleReviewCount === undefined
      ? ""
      : renderGoogleReviewTemplate(
          isPresentationOnly
            ? copy.presentationReviewCountLabel
            : copy.reviewCountLabel,
          {
            count: formatReviewCount(
              normalizedGoogleReview.googleReviewCount,
              resolvedLocale
            )
          }
        )
  ].filter(Boolean);

  function trackOutboundClick() {
    trackGoogleReviewClick({
      restaurantId,
      source
    });
  }

  return (
    <aside
      className={styles.googleReviewCard}
      data-google-review-card="true"
      aria-labelledby="google-review-title"
    >
      <div className={styles.googleReviewCopy}>
        <h2 id="google-review-title">{copy.title}</h2>
        <p>
          {renderGoogleReviewTemplate(copy.text, {
            restaurantName: cleanRestaurantName
          })}
        </p>
      </div>

      {metadata.length ? (
        <div className={styles.googleReviewMeta} aria-label={copy.metaLabel}>
          {metadata.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}

      {cta && onReviewRequest ? (
        <button
          className={styles.googleReviewAction}
          data-google-review-trigger="true"
          type="button"
          onClick={onReviewRequest}
        >
          {copy.action}
        </button>
      ) : cta ? (
        <a
          className={styles.googleReviewAction}
          data-google-review-action="true"
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={trackOutboundClick}
        >
          {copy.action}
        </a>
      ) : (
        <button
          className={styles.googleReviewAction}
          data-google-review-action="true"
          disabled
          type="button"
        >
          {copy.action}
        </button>
      )}

      {cta && showNote ? <p className={styles.googleReviewNote}>{copy.note}</p> : null}
    </aside>
  );
}
