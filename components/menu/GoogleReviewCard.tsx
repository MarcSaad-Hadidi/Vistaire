"use client";

import {
  getGoogleReviewCta,
  normalizeGoogleReviewConfig,
  type GoogleReviewConfig,
  type PublicMenu
} from "@/lib/menu/publicMenuCore";
import { normalizePublicMenuLocale } from "@/lib/menu/publicMenuSettings";
import { trackGoogleReviewClick } from "./googleReviewTracking";
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

type GoogleReviewCopyLocale = "fr" | "en" | "es" | "it" | "ar";

const GOOGLE_REVIEW_COPY: Record<
  GoogleReviewCopyLocale,
  {
    action: string;
    fallbackRestaurant: string;
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
    fallbackRestaurant: "le restaurant",
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
    fallbackRestaurant: "the restaurant",
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
  },
  es: {
    action: "Dejar una resena en Google",
    fallbackRestaurant: "el restaurante",
    metaLabel: "Resumen de Google",
    note:
      "No se ofrece ningun beneficio a cambio de una resena. Tu resena debe reflejar tu experiencia real.",
    ratingLabel: (rating, isPresentationOnly) =>
      isPresentationOnly ? `Vista previa de Google: ${rating}/5` : `${rating}/5 en Google`,
    reviewCountLabel: (count, isPresentationOnly) =>
      isPresentationOnly ? `Vista previa: ${count} resenas` : `${count} resenas de Google`,
    text: (restaurantName) =>
      `Comparte tu experiencia en ${restaurantName}. Tu resena de Google ayuda al equipo a entender cada visita y a ser descubierto.`,
    title: "Tu experiencia cuenta"
  },
  it: {
    action: "Lascia una recensione Google",
    fallbackRestaurant: "il ristorante",
    metaLabel: "Riepilogo Google",
    note:
      "Non viene offerto alcun vantaggio in cambio di una recensione. La recensione deve riflettere la tua esperienza reale.",
    ratingLabel: (rating, isPresentationOnly) =>
      isPresentationOnly ? `Anteprima Google: ${rating}/5` : `${rating}/5 su Google`,
    reviewCountLabel: (count, isPresentationOnly) =>
      isPresentationOnly ? `Anteprima: ${count} recensioni` : `${count} recensioni Google`,
    text: (restaurantName) =>
      `Condividi la tua esperienza da ${restaurantName}. La tua recensione Google aiuta il team a capire ogni visita e a farsi scoprire.`,
    title: "La tua esperienza conta"
  },
  ar: {
    action: "اترك تقييما على Google",
    fallbackRestaurant: "المطعم",
    metaLabel: "ملخص Google",
    note:
      "لا يتم تقديم أي منفعة مقابل التقييم. يجب أن يعكس تقييمك تجربتك الحقيقية.",
    ratingLabel: (rating, isPresentationOnly) =>
      isPresentationOnly ? `معاينة Google: ${rating}/5` : `${rating}/5 على Google`,
    reviewCountLabel: (count, isPresentationOnly) =>
      isPresentationOnly ? `معاينة: ${count} تقييم` : `${count} تقييم Google`,
    text: (restaurantName) =>
      `شارك تجربتك لدى ${restaurantName}. يساعد تقييمك على Google الفريق على فهم كل زيارة والوصول إلى ضيوف جدد.`,
    title: "تجربتك مهمة"
  }
};

type GoogleReviewCopy = (typeof GOOGLE_REVIEW_COPY)[GoogleReviewCopyLocale];

const GOOGLE_REVIEW_OVERRIDE_KEYS = new Set([
  "action",
  "fallbackRestaurant",
  "metaLabel",
  "note",
  "presentationRatingLabel",
  "presentationReviewCountLabel",
  "ratingLabel",
  "reviewCountLabel",
  "text",
  "title"
]);

function normalizeGoogleReviewLocale(locale: string): GoogleReviewCopyLocale {
  const normalized = normalizePublicMenuLocale(locale);
  try {
    const language = new Intl.Locale(normalized).language.toLowerCase();
    return language in GOOGLE_REVIEW_COPY
      ? (language as GoogleReviewCopyLocale)
      : "en";
  } catch {
    const language = normalized.toLowerCase().split("-")[0] ?? "";
    return language in GOOGLE_REVIEW_COPY
      ? (language as GoogleReviewCopyLocale)
      : "en";
  }
}

function languageCodeForLocale(locale: string): string {
  try {
    return new Intl.Locale(normalizePublicMenuLocale(locale)).language.toLowerCase();
  } catch {
    return locale.toLowerCase().split("-")[0] ?? "";
  }
}

function normalizedLocaleKey(locale: string): string {
  return normalizePublicMenuLocale(locale).toLowerCase();
}

function objectInput(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringInput(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringOverride(
  overrides: Record<string, unknown> | null,
  keys: string[]
): string | undefined {
  if (!overrides) return undefined;
  for (const key of keys) {
    const value = stringInput(overrides[key]);
    if (value) return value;
  }
  return undefined;
}

function hasGoogleReviewOverrideKey(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => GOOGLE_REVIEW_OVERRIDE_KEYS.has(key));
}

function googleReviewOverrideInput(value: unknown): Record<string, unknown> | null {
  const object = objectInput(value);
  if (!object) return null;
  const nested =
    objectInput(object.googleReview) ??
    objectInput(object.google_review) ??
    objectInput(object.googleReviewCard) ??
    objectInput(object.google_review_card);
  if (nested) return nested;
  return hasGoogleReviewOverrideKey(object) ? object : null;
}

function localizedGoogleReviewOverride(
  locale: string,
  localizedUiCopy?: Record<string, unknown>
): Record<string, unknown> | null {
  const copyMap = objectInput(localizedUiCopy);
  if (!copyMap) return null;

  const exactLocale = normalizedLocaleKey(locale);
  const language = languageCodeForLocale(locale);
  const exactKey = Object.keys(copyMap).find(
    (key) => normalizedLocaleKey(key) === exactLocale
  );
  const exactOverride = exactKey
    ? googleReviewOverrideInput(copyMap[exactKey])
    : null;
  if (exactOverride) return exactOverride;

  const languageOverride = googleReviewOverrideInput(copyMap[language]);
  if (languageOverride) return languageOverride;

  return googleReviewOverrideInput(copyMap);
}

function renderGoogleReviewTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(
    /\{(restaurantName|rating|count)\}/g,
    (_match, key: string) => values[key] ?? ""
  );
}

function mergeGoogleReviewCopy(
  base: GoogleReviewCopy,
  overrides: Record<string, unknown> | null
): GoogleReviewCopy {
  if (!overrides) return base;

  const textTemplate = stringOverride(overrides, ["text", "body", "description"]);
  const ratingTemplate = stringOverride(overrides, ["ratingLabel"]);
  const presentationRatingTemplate = stringOverride(overrides, [
    "presentationRatingLabel",
    "ratingPresentationLabel"
  ]);
  const reviewCountTemplate = stringOverride(overrides, ["reviewCountLabel"]);
  const presentationReviewCountTemplate = stringOverride(overrides, [
    "presentationReviewCountLabel",
    "reviewCountPresentationLabel"
  ]);

  return {
    ...base,
    action: stringOverride(overrides, ["action", "cta", "buttonLabel"]) ?? base.action,
    fallbackRestaurant:
      stringOverride(overrides, ["fallbackRestaurant", "restaurantFallback"]) ??
      base.fallbackRestaurant,
    metaLabel: stringOverride(overrides, ["metaLabel", "summaryLabel"]) ?? base.metaLabel,
    note: stringOverride(overrides, ["note", "policyNote"]) ?? base.note,
    ratingLabel: (rating, isPresentationOnly) => {
      const template = isPresentationOnly
        ? presentationRatingTemplate ?? ratingTemplate
        : ratingTemplate;
      return template
        ? renderGoogleReviewTemplate(template, { rating })
        : base.ratingLabel(rating, isPresentationOnly);
    },
    reviewCountLabel: (count, isPresentationOnly) => {
      const template = isPresentationOnly
        ? presentationReviewCountTemplate ?? reviewCountTemplate
        : reviewCountTemplate;
      return template
        ? renderGoogleReviewTemplate(template, { count })
        : base.reviewCountLabel(count, isPresentationOnly);
    },
    text: textTemplate
      ? (restaurantName) =>
          renderGoogleReviewTemplate(textTemplate, { restaurantName })
      : base.text,
    title: stringOverride(overrides, ["title", "heading"]) ?? base.title
  };
}

export function resolveGoogleReviewCopy(
  locale: string,
  localizedUiCopy?: Record<string, unknown>
): GoogleReviewCopy {
  const resolvedLocale = normalizePublicMenuLocale(locale);
  const base = GOOGLE_REVIEW_COPY[normalizeGoogleReviewLocale(resolvedLocale)];
  return mergeGoogleReviewCopy(
    base,
    localizedGoogleReviewOverride(resolvedLocale, localizedUiCopy)
  );
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
        <p>{copy.text(cleanRestaurantName)}</p>
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
