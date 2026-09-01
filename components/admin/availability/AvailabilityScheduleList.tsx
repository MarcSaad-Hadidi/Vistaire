"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AvailabilityOperationsState, AvailabilityScheduleItem } from "@/lib/admin/availability/contracts";
import styles from "./AdminAvailability.module.css";

type DishIdentity = Readonly<{ id: string; name: string }>;

function localDateTime(value: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
  } catch {
    return "Échéance invalide";
  }
}

export function AvailabilityScheduleList({ operations, dishes, canWrite, timezone }: { operations: AvailabilityOperationsState; dishes: readonly DishIdentity[]; canWrite: boolean; timezone: string }) {
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (operations.kind === "unavailable") return <section className={styles.railCard}><h2>Retours planifiés</h2><p>Le registre des retours n’est pas encore disponible.</p></section>;
  if (operations.kind === "error") return <section className={styles.railCard} role="alert"><h2>Retours planifiés</h2><p>Impossible de confirmer les retours planifiés pour le moment.</p></section>;

  const visible = operations.schedules.filter((item) => !hiddenIds.has(item.id) && (item.status === "pending" || item.status === "failed"));
  async function cancel(item: AvailabilityScheduleItem) {
    if (!canWrite || pendingId) return;
    setPendingId(item.id); setFeedback(null);
    try {
      const response = await fetch(`/admin/api/dishes/${encodeURIComponent(item.dishId)}/availability/schedule/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!response.ok) { setFeedback("L’annulation n’a pas pu être confirmée."); return; }
      setHiddenIds((current) => new Set(current).add(item.id));
      setFeedback("Retour planifié annulé.");
      router.refresh();
    } catch {
      setFeedback("Le service d’annulation ne répond pas.");
    } finally {
      setPendingId(null);
    }
  }

  return <section className={styles.railCard}><h2>Retours planifiés</h2>{visible.length ? <ol>{visible.map((item) => {
    const dishName = dishes.find((dish) => dish.id === item.dishId)?.name ?? "Plat de la carte";
    return <li key={item.id}><strong>{dishName}</strong><span>{item.status === "failed" ? "Échec à vérifier" : localDateTime(item.scheduledFor, timezone)}</span>{item.status === "pending" && canWrite ? <button type="button" disabled={pendingId === item.id} onClick={() => cancel(item)}>{pendingId === item.id ? "Annulation…" : "Annuler"}</button> : null}</li>;
  })}</ol> : <p>Aucun retour n’est planifié.</p>}{feedback ? <p role="status">{feedback}</p> : null}</section>;
}
