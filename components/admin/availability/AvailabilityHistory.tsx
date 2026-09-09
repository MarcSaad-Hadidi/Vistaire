import type { AvailabilityOperationsState } from "@/lib/admin/availability/contracts";
import styles from "./AdminAvailability.module.css";

type DishIdentity = Readonly<{ id: string; name: string }>;
const formatDate = (value: string, timezone: string) => { try { return new Intl.DateTimeFormat("fr-CA", { dateStyle: "short", timeStyle: "short", timeZone: timezone }).format(new Date(value)); } catch { return "Date invalide"; } };

export function AvailabilityHistory({ operations, dishes, timezone }: { operations: AvailabilityOperationsState; dishes: readonly DishIdentity[]; timezone: string }) {
  if (operations.kind === "unavailable") return <section className={styles.railCard}><h2>Historique récent</h2><p>L’historique auditable n’est pas encore disponible.</p></section>;
  if (operations.kind === "error") return <section className={styles.railCard} role="alert"><h2>Historique récent</h2><p>Impossible de confirmer l’historique pour le moment.</p></section>;
  return <section className={styles.railCard}><h2>Historique récent</h2>{operations.history.length ? <ol>{operations.history.map((item) => <li key={item.id}><strong>{dishes.find((dish) => dish.id === item.dishId)?.name ?? "Plat de la carte"}</strong><span>{item.finalAvailable ? "Rendu disponible" : "Rendu indisponible"} · {formatDate(item.createdAt, timezone)}</span></li>)}</ol> : <p>Aucun événement auditable n’a encore été enregistré.</p>}</section>;
}
