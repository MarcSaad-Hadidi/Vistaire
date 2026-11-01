"use client";
import Link from "next/link";
import { LockKeyhole, CircleAlert } from "lucide-react";
import { useStudioTheme } from "./studioTheme";
import styles from "./Studio.module.css";

export function StudioState({
  kind,
  title,
  description,
  retryHref = "/admin",
  onRetry,
  localPreview = false,
}: {
  kind: "access" | "unavailable" | "loading" | "error" | "qr";
  title?: string;
  description?: string;
  retryHref?: string;
  onRetry?: () => void;
  localPreview?: boolean;
}) {
  const theme = useStudioTheme(kind === "qr");
  return (
    <main
      className={`${styles.studio} ${styles.stateShell}`}
      data-theme={theme}
      data-studio-state={kind}
      aria-busy={kind === "loading" || undefined}
    >
      <Link href="/" className={styles.stateBrand}>
        Vistaire{kind !== "qr" && <span>Espace restaurant</span>}
      </Link>
      {kind === "loading" ? (
        <section
          className={styles.stateLoading}
          aria-label="Chargement du tableau de bord"
          role="status"
        >
          <p>Chargement de votre espace…</p>
          <div className={styles.loadingLine} />
          <div className={styles.loadingCards}>
            {[0, 1, 2, 3].map((id) => (
              <div key={id} />
            ))}
          </div>
          <div className={styles.loadingChart} />
        </section>
      ) : (
        <section className={styles.stateCard}>
          {kind === "access" ? (
            <LockKeyhole size={26} />
          ) : (
            <CircleAlert size={26} />
          )}
          {kind !== "qr" && <p className={styles.muted}>Votre restaurant, en un coup d’œil</p>}
          <h1>{title ?? "Votre espace est momentanément indisponible"}</h1>
          <p>
            {description ??
              "Réessayez dans un instant. Vos données et disponibilités restent inchangées."}
          </p>
          {kind === "access" ? (
            <>
              <form
                action="/admin/access"
                method="post"
                className={styles.accessForm}
              >
                <label htmlFor="qrAccess">Code ou lien QR admin</label>
                <input
                  id="qrAccess"
                  name="qrAccess"
                  autoComplete="off"
                  maxLength={2048}
                  required
                  placeholder="Collez votre lien ou votre code"
                />
                <button type="submit">Accéder au dashboard</button>
              </form>
              {localPreview && (
                <form action="/admin/preview" method="post">
                  <button type="submit">
                    Ouvrir la prévisualisation locale
                  </button>
                </form>
              )}
              <p className={styles.muted}>
                Utilisez le QR interne de votre restaurant. Le QR du menu client
                ne donne pas accès à cet espace.
              </p>
            </>
          ) : kind === "qr" ? <Link href="/" prefetch={false} className={styles.button}>Accueil Vistaire</Link> : (
            <div className={styles.stateActions}>
              {onRetry ? (
                <button onClick={onRetry}>Réessayer</button>
              ) : (
                <a href={retryHref} className={styles.button}>
                  Réessayer
                </a>
              )}
              <Link href="/admin">Retour à l’espace restaurant</Link>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
