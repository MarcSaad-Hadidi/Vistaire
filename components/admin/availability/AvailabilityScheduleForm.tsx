"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AvailabilitySchedulingCapability } from "@/lib/admin/availability/contracts";
import styles from "./AdminAvailability.module.css";

export function AvailabilityScheduleForm({ capability, dishId, dishName }: { capability: AvailabilitySchedulingCapability; dishId?: string; dishName?: string }) {
  const noteId = useId(); const router = useRouter();
  const idempotencyKeys = useRef(new Map<string, string>());
  const [note, setNote] = useState(""); const [date, setDate] = useState(""); const [time, setTime] = useState("");
  const [pending, setPending] = useState(false); const [feedback, setFeedback] = useState<string | null>(null);
  if (capability.kind !== "available") return null;
  async function submit(event: FormEvent) { event.preventDefault(); if (!dishId || pending) return; const idempotencyKey = idempotencyKeys.current.get(dishId) ?? crypto.randomUUID(); idempotencyKeys.current.set(dishId, idempotencyKey); setPending(true); setFeedback(null); try { const response = await fetch(`/admin/api/dishes/${encodeURIComponent(dishId)}/availability/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: true, scheduledLocalDate: date, scheduledLocalTime: time, idempotencyKey, internalNote: note }) }); if (!response.ok) { const result = await response.json().catch(() => ({})); setFeedback(typeof result.error === "string" ? result.error : "La programmation a échoué."); return; } idempotencyKeys.current.delete(dishId); setFeedback("Retour planifié et confirmé par le serveur."); router.refresh(); } catch { setFeedback("Le service de planification ne répond pas."); } finally { setPending(false); } }
  return <form className={styles.scheduleForm} onSubmit={submit}><fieldset disabled={pending}><legend>Programmer le retour de disponibilité</legend><p>{dishName ? `Choisissez quand ${dishName} sera de nouveau disponible.` : "Sélectionnez d’abord un plat indisponible."}</p><label>Date locale<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Heure locale<input type="time" required value={time} onChange={(event) => setTime(event.target.value)} /></label><label htmlFor={noteId}>Note interne <span>{note.length}/120</span></label><textarea id={noteId} maxLength={120} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ajouter un commentaire…" /><button type="submit" disabled={!dishId || !date || !time}>{pending ? "Programmation…" : "Programmer le retour"}</button>{feedback ? <p role="status">{feedback}</p> : null}</fieldset></form>;
}
