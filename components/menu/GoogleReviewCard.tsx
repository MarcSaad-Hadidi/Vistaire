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
  dishSlug?: string;
  googleReview: GoogleReviewConfig;
  locale?: string;
  localizedUiCopy?: Record<string, unknown>;
  menuId?: string;
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

function getTextDirection(locale: string): "ltr" | "rtl" {
  try {
    return new Intl.Locale(locale).language.toLowerCase() === "ar" ? "rtl" : "ltr";
  } catch {
    return locale.toLowerCase().startsWith("ar") ? "rtl" : "ltr";
  }
}

export function GoogleReviewCard({
  dishSlug,
  googleReview,
  locale = "fr",
  localizedUiCopy,
  menuId,
  restaurantId,
  restaurantName,
  showNote = true,
  source
}: GoogleReviewCardProps) {
  const resolvedLocale = normalizePublicMenuLocale(locale);
  const textDirection = getTextDirection(resolvedLocale);
  const copy = resolveGoogleReviewCopy(resolvedLocale, localizedUiCopy);
  const normalizedGoogleReview = normalizeGoogleReviewConfig(googleReview);
  const cta = getGoogleReviewCta(normalizedGoogleReview);
  const isPresentationOnly =
    normalizedGoogleReview.enabled && normalizedGoogleReview.presentationOnly === true;
  if (!cta && !isPresentationOnly) return null;

  const cleanRestaurantName = cta
    ? restaurantName.trim() || copy.fallbackRestaurant
    : "";
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
      dishSlug,
      restaurantId,
      menuId,
      source
    });
  }

  return (
    <aside
      className={styles.googleReviewCard}
      data-google-review-card="true"
      data-no-dish-swipe="true"
      aria-labelledby="google-review-title"
      dir="ltr"
    >
      <div className={styles.googleReviewCopy} dir={textDirection}>
        <h2 id="google-review-title">{copy.title}</h2>
        {cta ? (
          <p>
            {renderGoogleReviewTemplate(copy.text, {
              restaurantName: cleanRestaurantName
            })}
          </p>
        ) : null}
      </div>

      {metadata.length ? (
        <div className={styles.googleReviewMeta} aria-label={copy.metaLabel}>
          {metadata.map((item) => (
            <span key={item} dir={textDirection}>{item}</span>
          ))}
        </div>
      ) : null}

      {cta ? (
        <a
          className={styles.googleReviewAction}
          data-google-review-action="true"
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${copy.action}. ${copy.opensInNewTab}`}
          onClick={trackOutboundClick}
        >
          <span dir={textDirection}>{copy.action}</span>
          <span className={styles.srOnly}>{copy.opensInNewTab}</span>
        </a>
      ) : null}

      {cta && showNote ? (
        <p className={styles.googleReviewNote} dir={textDirection}>{copy.note}</p>
      ) : null}
    </aside>
  );
}