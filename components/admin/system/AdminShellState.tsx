import type { ReactNode } from "react";
import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import { AlertIcon, InfoIcon } from "./AdminIcons";
import { AdminSkeleton } from "./AdminPresentationPrimitives";
import styles from "./AdminSystem.module.css";

export type AdminShellStateKind = "loading" | "empty" | "error" | "forbidden";
export type AdminShellStateProps = Readonly<{
  kind: AdminShellStateKind;
  locale: AdminLocale;
  title?: string;
  description?: string;
  action?: ReactNode;
}>;

const STATE_COPY: Record<AdminLocale, Record<AdminShellStateKind, { title: string; description: string }>> = {
  fr: {
    loading: { title: "Chargement en cours", description: "Votre espace restaurant se prépare." },
    empty: { title: "Aucun élément", description: "Aucun contenu n’est disponible pour le moment." },
    error: { title: "Impossible de charger", description: "Réessayez dans quelques instants." },
    forbidden: { title: "Accès requis", description: "Utilisez votre accès restaurant pour continuer." }
  },
  en: {
    loading: { title: "Loading", description: "Your restaurant workspace is getting ready." },
    empty: { title: "Nothing here yet", description: "No content is available right now." },
    error: { title: "Unable to load", description: "Try again in a moment." },
    forbidden: { title: "Access required", description: "Use your restaurant access to continue." }
  }
};

export function AdminShellState({ kind, locale, title, description, action }: AdminShellStateProps) {
  const copy = STATE_COPY[locale][kind];
  const role = kind === "error" || kind === "forbidden" ? "alert" : "status";

  if (kind === "loading") {
    return (
      <main className={styles.loading} role={role} aria-busy={kind === "loading" ? true : undefined} aria-label={title ?? copy.title}>
        <span className={styles.visuallyHidden}>{description ?? copy.description}</span>
        <AdminSkeleton className={styles.loadingHeader} />
        <AdminSkeleton className={styles.loadingTabs} />
        <div className={styles.loadingGrid}>{Array.from({ length: 5 }, (_, index) => <AdminSkeleton className={styles.loadingCard} key={index} />)}</div>
        <AdminSkeleton className={styles.loadingPanel} />
      </main>
    );
  }

  return (
    <main className={styles.shellState} role={kind === "error" || kind === "forbidden" ? "alert" : "status"}>
      <span className={styles.shellStateIcon}>{kind === "empty" ? <InfoIcon /> : <AlertIcon />}</span>
      <h1>{title ?? copy.title}</h1>
      <p>{description ?? copy.description}</p>
      {action ? <div className={styles.shellStateAction}>{action}</div> : null}
    </main>
  );
}
