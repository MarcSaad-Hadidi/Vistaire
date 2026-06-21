"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge } from "@/components/owner/OwnerUi";
import {
  ownerRestaurantRoute,
  previewAvailabilityLabel,
  qrTone,
  restaurantStatusLabel,
  statusTone,
  type OwnerRestaurantPreparation
} from "@/lib/owner/restaurantPreparation";
import type { OwnerRestaurant } from "@/lib/owner/types";

type OwnerRestaurantDashboardProps = {
  restaurant: OwnerRestaurant;
  preparation: OwnerRestaurantPreparation;
};

function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-CA").format(value);
}

function ModuleCard({
  title,
  body,
  meta,
  href,
  action
}: {
  title: string;
  body: string;
  meta: string;
  href: string;
  action: string;
}) {
  return (
    <article className={styles.moduleCard}>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <span>{meta}</span>
      <Link className={styles.ownerOpenLink} href={href} prefetch={false}>
        {action}
      </Link>
    </article>
  );
}

export function OwnerRestaurantDashboard({
  restaurant,
  preparation
}: OwnerRestaurantDashboardProps) {
  const [copyStatus, setCopyStatus] = useState("");
  const { summary, checklist, nextAction, issues } = preparation;

  async function copyMenuUrl() {
    try {
      await navigator.clipboard.writeText(restaurant.menuUrl);
      setCopyStatus("Lien de la carte copié.");
    } catch {
      setCopyStatus("Copie indisponible dans ce navigateur.");
    }
  }

  return (
    <div className={styles.restaurantDashboard}>
      <article className={styles.restaurantCommandHeader}>
        <div>
          <Link className={styles.backLink} href="/owner" prefetch={false}>
            Retour portefeuille
          </Link>
          <h2>{restaurant.name}</h2>
          <p>
            {restaurant.location} · {restaurant.cuisineType}
          </p>
          <div className={styles.pillRow}>
            <Badge tone={statusTone(restaurant)}>{restaurantStatusLabel(restaurant)}</Badge>
            <Badge tone={restaurant.readinessScore >= 80 ? "ready" : "warn"}>
              Préparation {restaurant.readinessScore}%
            </Badge>
            <Badge tone={qrTone(restaurant.qrStatus)}>{restaurant.qrStatusLabel}</Badge>
          </div>
        </div>
        <div className={styles.restaurantHeaderActions}>
          <a
            className={`${styles.btnPrimary} ${styles.btn}`}
            href={restaurant.menuUrl}
            target="_blank"
            rel="noreferrer"
          >
            Voir comme client
          </a>
          <button type="button" className={styles.btn} onClick={copyMenuUrl}>
            Copier le lien
          </button>
          <Link
            className={styles.btn}
            href={ownerRestaurantRoute(restaurant, "preview")}
            prefetch={false}
          >
            Aperçu du menu
          </Link>
        </div>
      </article>

      {copyStatus ? (
        <p className={styles.qrStatus} role="status">
          {copyStatus}
        </p>
      ) : null}

      <section className={styles.commandKpiGrid} aria-label="Résumé restaurant">
        <article>
          <span>Plats</span>
          <strong>{formatCount(summary.dishCount)}</strong>
          <small>
            {summary.categoryCount > 0
              ? `${summary.categoryCount} catégorie(s)`
              : "Catégories à créer"}
          </small>
        </article>
        <article>
          <span>Photos</span>
          <strong>
            {summary.photoDishCount}/{summary.dishCount || 0}
          </strong>
          <small>
            {summary.missingPhotoCount === 0 && summary.dishCount > 0
              ? "Couverture prête"
              : "À compléter"}
          </small>
        </article>
        <article>
          <span>QR</span>
          <strong>{restaurant.qrStatus === "ready" ? "Prêt" : "À préparer"}</strong>
          <small>{restaurant.qrStatusLabel}</small>
        </article>
        <article>
          <span>Médias</span>
          <strong>{formatCount(summary.immersiveDishCount)}</strong>
          <small>
            {summary.immersiveDishCount > 0 ? "GLB/AR détectés" : "Statut à vérifier"}
          </small>
        </article>
      </section>

      <div className={styles.restaurantOverviewGrid}>
        <article className={styles.nextActionPanel}>
          <span className={styles.metricLabel}>Prochaine action</span>
          <strong>{nextAction.title}</strong>
          <div className={styles.ownerProgress} aria-hidden="true">
            <span style={{ width: `${restaurant.readinessScore}%` }} />
          </div>
          <p>{nextAction.body}</p>
          <Link className={`${styles.btnPrimary} ${styles.btn}`} href={nextAction.href}>
            {nextAction.label}
          </Link>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Checklist de préparation</h3>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.checklist}>
              {checklist.map((item) => (
                <div key={item.id} className={styles.checkItem}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <Badge tone={item.tone}>{item.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Problèmes à corriger</h3>
          <span className={styles.sourceTag}>Maximum 5 priorités</span>
        </div>
        <div className={styles.panelBody}>
          {issues.length === 0 ? (
            <div className={styles.emptyState}>
              Aucun problème bloquant détecté. Vérifiez l’aperçu client avant publication.
            </div>
          ) : (
            <div className={styles.issueList}>
              {issues.map((issue) => (
                <div key={issue.id} className={styles.issueRow}>
                  <Badge tone={issue.tone}>{issue.title}</Badge>
                  <p>{issue.body}</p>
                  <Link className={`${styles.btn} ${styles.btnSmall}`} href={issue.href}>
                    {issue.label}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>

      <section className={styles.moduleCardGrid} aria-label="Modules restaurant">
        <ModuleCard
          title="Carte & plats"
          body="Catégories, plats, prix, descriptions, disponibilité et qualité de contenu."
          meta={`${summary.dishCount} plat(s) · ${summary.missingPriceCount} prix manquant(s)`}
          href={ownerRestaurantRoute(restaurant, "menu")}
          action="Gérer la carte"
        />
        <ModuleCard
          title="Médias"
          body="Photos de plats, GLB, modèles 3D et statuts AR liés aux plats."
          meta={`${summary.missingPhotoCount} photo(s) manquante(s) · ${summary.webModelCount} GLB`}
          href={ownerRestaurantRoute(restaurant, "medias")}
          action="Ouvrir Médias"
        />
        <ModuleCard
          title="3D / AR"
          body="Upload GLB par plat, conversion USDZ Quick Look et comparaison visuelle."
          meta={`${summary.webModelCount} GLB · ${summary.arModelCount} USDZ`}
          href={ownerRestaurantRoute(restaurant, "3d")}
          action="Ouvrir workflow"
        />
        <ModuleCard
          title="Aperçu du menu"
          body="Rendu mobile réel du menu public que le client voit après scan QR."
          meta={previewAvailabilityLabel(restaurant)}
          href={ownerRestaurantRoute(restaurant, "preview")}
          action="Prévisualiser"
        />
        <ModuleCard
          title="QR & publication"
          body="Lien public, QR téléchargeable et checklist avant impression."
          meta={restaurant.qrStatusLabel}
          href={ownerRestaurantRoute(restaurant, "qr")}
          action="Préparer le QR"
        />
        <ModuleCard
          title="Paramètres"
          body="Nom, slug, localisation, cuisine, statut et actions de cycle de vie."
          meta={restaurant.statusLabel}
          href={ownerRestaurantRoute(restaurant, "settings")}
          action="Ouvrir"
        />
      </section>
    </div>
  );
}
