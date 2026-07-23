"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge } from "@/components/owner/OwnerUi";
import {
  uniqueMenuDesignOwnerStatusLabel,
  type UniqueMenuDesign,
  type UniqueMenuDesignAction,
  type UniqueMenuDesignStatus
} from "@/lib/menu/uniqueMenuDesign";

type RendererMeta = {
  key: string;
  designId: string;
  version: number;
  displayName: string;
};

type OwnerUniqueMenuDesignPanelProps = {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  publicMenuHref: string;
  designStudioHref: string;
  initialDesign: UniqueMenuDesign | null;
  initialRenderers: RendererMeta[];
  style: string;
};

function statusTone(
  status: UniqueMenuDesignStatus | null
): "ready" | "warn" | "muted" | "danger" {
  switch (status) {
    case "published":
      return "ready";
    case "ready":
    case "draft":
      return "warn";
    case "archived":
      return "muted";
    default:
      return "warn";
  }
}

export function OwnerUniqueMenuDesignPanel({
  restaurantId,
  restaurantName,
  restaurantSlug,
  publicMenuHref,
  designStudioHref,
  initialDesign,
  initialRenderers,
  style
}: OwnerUniqueMenuDesignPanelProps) {
  const [design, setDesign] = useState<UniqueMenuDesign | null>(initialDesign);
  const [renderers, setRenderers] = useState(initialRenderers);
  const [selectedRendererKey, setSelectedRendererKey] = useState(
    initialRenderers[0]?.key ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(action: UniqueMenuDesignAction) {
    if (!design && action !== "create-new") {
      setError("Identité unique manquante.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/owner/unique-menu-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          action,
          expectedDesignId: design?.designId,
          expectedVersion: design?.version,
          ...(action === "mark-ready"
            ? { rendererKey: selectedRendererKey || null }
            : {})
        })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        uniqueDesign?: UniqueMenuDesign;
        availableRenderers?: RendererMeta[];
      };
      if (!response.ok || !payload.ok || !payload.uniqueDesign) {
        setError(payload.error ?? "Action unique refusée.");
        return;
      }
      setDesign(payload.uniqueDesign);
      setRenderers(payload.availableRenderers ?? []);
      setMessage(`Action « ${action} » enregistrée.`);
    } catch {
      setError("Impossible de contacter l'API unique.");
    } finally {
      setBusy(false);
    }
  }

  const status = design?.status ?? null;
  const hasRenderer = renderers.length > 0;

  return (
    <div className={styles.restaurantOverviewGrid}>
      <article className={styles.moduleCard}>
        <header>
          <h2>UI unique</h2>
          <Badge tone={statusTone(status)}>
            {uniqueMenuDesignOwnerStatusLabel(status)}
          </Badge>
        </header>
        <p>
          Restaurant <strong>{restaurantName}</strong> · type UI unique
          {style !== "unique" ? " (style actuel non unique)" : ""}.
        </p>
        <p>
          Statut : {uniqueMenuDesignOwnerStatusLabel(status)} · version{" "}
          {design?.version ?? "—"}
        </p>
        <p>
          Renderer :{" "}
          {design?.rendererKey
            ? `${design.rendererKey} · v${design.rendererVersion ?? "?"}`
            : "Aucun renderer lié"}
        </p>
        <details>
          <summary>Zone technique owner</summary>
          <p>
            designId : <code>{design?.designId ?? "—"}</code>
          </p>
          <p>
            slug : <code>{restaurantSlug}</code>
          </p>
          <p>
            createdAt : <code>{design?.createdAt ?? "—"}</code>
          </p>
          <p>
            updatedAt : <code>{design?.updatedAt ?? "—"}</code>
          </p>
        </details>
      </article>

      <article className={styles.moduleCard}>
        <header>
          <h2>Actions autorisées</h2>
        </header>
        {!hasRenderer && status === "draft" ? (
          <p role="status">
            Aucun renderer React n’est enregistré pour ce designId. Le bouton
            « Marquer prêt » reste désactivé jusqu’à un enregistrement
            statique côté serveur.
          </p>
        ) : null}

        {status === "draft" && hasRenderer ? (
          <label className={styles.field}>
            Renderer disponible
            <select
              value={selectedRendererKey}
              onChange={(event) => setSelectedRendererKey(event.target.value)}
              disabled={busy}
            >
              {renderers.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.displayName} ({entry.key} · v{entry.version})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className={styles.restaurantHeaderActions}>
          {status === "pending" ? (
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.btn}`}
              disabled={busy}
              onClick={() => void runAction("start")}
            >
              Démarrer le développement
            </button>
          ) : null}
          {status === "draft" ? (
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.btn}`}
              disabled={busy || !hasRenderer || !selectedRendererKey}
              onClick={() => void runAction("mark-ready")}
            >
              Marquer prêt
            </button>
          ) : null}
          {status === "ready" ? (
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.btn}`}
              disabled={busy}
              onClick={() => void runAction("publish")}
            >
              Publier le UI unique
            </button>
          ) : null}
          {status === "published" ? (
            <>
              <a
                className={`${styles.btnPrimary} ${styles.btn}`}
                href={publicMenuHref}
                target="_blank"
                rel="noreferrer"
              >
                Voir le UI publié
              </a>
              <button
                type="button"
                className={styles.btn}
                disabled={busy}
                onClick={() => void runAction("archive")}
              >
                Archiver
              </button>
            </>
          ) : null}
          {status === "archived" || !design ? (
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.btn}`}
              disabled={busy}
              onClick={() => void runAction("create-new")}
            >
              Créer une nouvelle identité unique
            </button>
          ) : null}
          {status === "pending" || status === "draft" || status === "ready" ? (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void runAction("archive")}
            >
              Archiver
            </button>
          ) : null}
        </div>

        <div className={styles.restaurantHeaderActions}>
          <Link className={styles.btn} href={designStudioHref} prefetch={false}>
            Personnaliser le fallback
          </Link>
          <a
            className={styles.btn}
            href={publicMenuHref}
            target="_blank"
            rel="noreferrer"
          >
            Voir le fallback public
          </a>
        </div>

        {error ? (
          <p className={styles.qrStatus} role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className={styles.qrStatus} role="status">
            {message}
          </p>
        ) : null}
      </article>

      <article className={styles.moduleCard}>
        <header>
          <h2>Fallback public</h2>
        </header>
        <p>
          Le Design Studio personnalise uniquement le rendu générique de
          secours. La publication du renderer unique se fait ici, jamais via
          « Publier le fallback ».
        </p>
        <p>
          Historique minimal : version courante {design?.version ?? "—"} ·
          statut {uniqueMenuDesignOwnerStatusLabel(status)}.
        </p>
      </article>
    </div>
  );
}
