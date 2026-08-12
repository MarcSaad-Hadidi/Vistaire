"use client";
import { useId, useState } from "react";
import type { AvailabilitySchedulingCapability } from "@/lib/admin/availability/contracts";
import styles from "./AdminAvailability.module.css";

export function AvailabilityScheduleForm({ capability, dishName }: { capability: AvailabilitySchedulingCapability; dishName?: string }) {
  const noteId = useId();
  const [note, setNote] = useState("");
  if (capability.kind !== "available") return null;
  return <form className={styles.scheduleForm} onSubmit={(event) => event.preventDefault()}><fieldset><legend>Programmer le retour de disponibilité</legend><p>{dishName ? `Choisissez quand ${dishName} sera de nouveau disponible.` : "Sélectionnez d’abord un plat indisponible."}</p><label>Date locale<input type="date" required /></label><label>Heure locale<input type="time" required /></label><label htmlFor={noteId}>Note interne <span>{note.length}/120</span></label><textarea id={noteId} maxLength={120} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ajouter un commentaire…" /><button type="submit" disabled={!dishName}>Programmer le retour</button></fieldset></form>;
}
