"use client";

import { trackMenuEvent } from "@/lib/analytics/client";
import {
  getGoogleReviewCta,
  type GoogleReviewConfig,
  type PublicMenu
} from "@/lib/menu/publicMenuCore";
import styles from "./GoogleReviewCard.module.css";

type GoogleReviewCardProps = {
  googleReview: GoogleReviewConfig;
  restaurantId: string;
  restaurantName: string;
  source: PublicMenu["source"];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatRating(rating: number): string {
  return String(rating).replace(".", ",");
}

function formatReviewCount(count: number): string {
  return new Intl.NumberFormat("fr-CA").format(count);
}

export function GoogleReviewCard({
  googleReview,
  restaurantId,
  restaurantName,
  source
}: GoogleReviewCardProps) {
  const cta = getGoogleReviewCta(googleReview);
  if (!cta) return null;

  const cleanRestaurantName = restaurantName.trim() || "le restaurant";
  const metadata = [
    cta.googleRating === undefined
      ? ""
      : `${formatRating(cta.googleRating)}/5 sur Google`,
    cta.googleReviewCount === undefined
      ? ""
      : `${formatReviewCount(cta.googleReviewCount)} avis Google`
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
      aria-labelledby="google-review-title"
    >
      <div className={styles.googleReviewCopy}>
        <h2 id="google-review-title">Votre expérience compte</h2>
        <p>
          Si vous avez apprécié votre moment chez {cleanRestaurantName}, votre avis Google aide l’équipe à se faire découvrir.
        </p>
      </div>

      {metadata.length ? (
        <div className={styles.googleReviewMeta} aria-label="Résumé Google">
          {metadata.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}

      <a
        className={styles.googleReviewAction}
        href={cta.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={trackOutboundClick}
      >
        Laisser un avis Google
      </a>

      <p className={styles.googleReviewNote}>
        Aucun avantage n’est offert en échange d’un avis. Votre avis doit refléter votre expérience réelle.
      </p>
    </aside>
  );
}
