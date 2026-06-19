"use client";

import { trackMenuEvent } from "@/lib/analytics/client";
import { LOCALE_LANGUAGE_TAG, normalizeLocale, type Locale } from "@/lib/i18n";
import {
  getGoogleReviewCta,
  normalizeGoogleReviewConfig,
  type GoogleReviewConfig,
  type PublicMenu
} from "@/lib/menu/publicMenuCore";
import styles from "./GoogleReviewCard.module.css";

type GoogleReviewCardProps = {
  googleReview: GoogleReviewConfig;
  locale?: Locale;
  restaurantId: string;
  restaurantName: string;
  source: PublicMenu["source"];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GOOGLE_REVIEW_COPY: Record<
  Locale,
  {
    action: string;
    metaLabel: string;
    note: string;
    ratingLabel: (rating: string, isPresentationOnly: boolean) => string;
    reviewCountLabel: (count: string, isPresentationOnly: boolean) => string;
    text: (restaurantName: string) => string;
    title: string;
  }
> = {
  fr: {
    action: "Laisser un avis Google",
    metaLabel: "Résumé Google",
    note:
      "Aucun avantage n’est offert en échange d’un avis. Votre avis doit refléter votre expérience réelle.",
    ratingLabel: (rating, isPresentationOnly) =>
      isPresentationOnly ? `Aperçu Google : ${rating}/5` : `${rating}/5 sur Google`,
    reviewCountLabel: (count, isPresentationOnly) =>
      isPresentationOnly ? `Aperçu : ${count} avis` : `${count} avis Google`,
    text: (restaurantName) =>
      `Partagez votre expérience chez ${restaurantName}. Votre avis Google aide l’équipe à mieux comprendre chaque visite et à se faire découvrir.`,
    title: "Votre expérience compte"
  },
  en: {
    action: "Leave a Google review",
    metaLabel: "Google summary",
    note:
      "No benefit is offered in exchange for a review. Your review should reflect your real experience.",
    ratingLabel: (rating, isPresentationOnly) =>
      isPresentationOnly ? `Google preview: ${rating}/5` : `${rating}/5 on Google`,
    reviewCountLabel: (count, isPresentationOnly) =>
      isPresentationOnly ? `Preview: ${count} reviews` : `${count} Google reviews`,
    text: (restaurantName) =>
      `Share your experience at ${restaurantName}. Your Google review helps the team understand each visit and be discovered.`,
    title: "Your experience matters"
  }
};

function formatRating(rating: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_LANGUAGE_TAG[locale], {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(rating) ? 0 : 1
  }).format(rating);
}

function formatReviewCount(count: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_LANGUAGE_TAG[locale]).format(count);
}

export function GoogleReviewCard({
  googleReview,
  locale = "fr",
  restaurantId,
  restaurantName,
  source
}: GoogleReviewCardProps) {
  const resolvedLocale = normalizeLocale(locale);
  const copy = GOOGLE_REVIEW_COPY[resolvedLocale];
  const normalizedGoogleReview = normalizeGoogleReviewConfig(googleReview);
  const cta = getGoogleReviewCta(normalizedGoogleReview);
  const isPresentationOnly =
    normalizedGoogleReview.enabled && normalizedGoogleReview.presentationOnly === true;
  if (!cta && !isPresentationOnly) return null;

  const cleanRestaurantName =
    restaurantName.trim() ||
    (resolvedLocale === "en" ? "the restaurant" : "le restaurant");
  const metadata = [
    normalizedGoogleReview.googleRating === undefined
      ? ""
      : copy.ratingLabel(
          formatRating(normalizedGoogleReview.googleRating, resolvedLocale),
          isPresentationOnly
        ),
    normalizedGoogleReview.googleReviewCount === undefined
      ? ""
      : copy.reviewCountLabel(
          formatReviewCount(normalizedGoogleReview.googleReviewCount, resolvedLocale),
          isPresentationOnly
        )
  ].filter(Boolean);

  function trackOutboundClick() {
    if (!UUID_PATTERN.test(restaurantId)) return;
    trackMenuEvent({
      eventName: "cta_clicked",
      restaurantId,
      source: source === "supabase" ? "production" : "demo",
      ctaName: "google_review",
      metadata: {
        destination: "google_review"
      }
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
        <p>{copy.text(cleanRestaurantName)}</p>
      </div>

      {metadata.length ? (
        <div className={styles.googleReviewMeta} aria-label={copy.metaLabel}>
          {metadata.map((item) => (
            <span key={item}>{item}</span>
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

      {cta ? <p className={styles.googleReviewNote}>{copy.note}</p> : null}
    </aside>
  );
}
