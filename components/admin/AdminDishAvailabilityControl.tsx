"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AdminToast, AdminToggle } from "@/components/admin/system/AdminPrimitives";

type AvailabilityResponse = { ok: boolean; available?: boolean; error?: string };

export function AdminDishAvailabilityControl({ dishId, dishName, initialAvailable, onAvailabilityChange }: { dishId: string; dishName: string; initialAvailable: boolean; onAvailabilityChange?: (available: boolean) => void }) {
  const router = useRouter();
  const [available, setAvailable] = useState(initialAvailable);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const requestSequence = useRef(0);
  const latestRequest = useRef(0);

  async function updateAvailability() {
    if (isPending) return;
    const previousAvailable = available;
    const nextAvailable = !available;
    const requestId = ++requestSequence.current;
    latestRequest.current = requestId;
    setError(null); setSuccess(null); setAvailable(nextAvailable); setIsPending(true);
    try {
      const response = await fetch(`/admin/api/dishes/${encodeURIComponent(dishId)}/availability`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: nextAvailable }) });
      const result = (await response.json()) as AvailabilityResponse;
      if (latestRequest.current !== requestId) return;
      if (!response.ok || !result.ok || result.available !== nextAvailable) { setAvailable(previousAvailable); setError(result.error ?? "La disponibilité n’a pas pu être mise à jour."); return; }
      setSuccess(nextAvailable ? `${dishName} est disponible.` : `${dishName} est indisponible.`);
      onAvailabilityChange?.(nextAvailable);
      router.refresh();
    } catch {
      if (latestRequest.current !== requestId) return;
      setAvailable(previousAvailable); setError("La disponibilité n’a pas pu être mise à jour.");
    } finally { if (latestRequest.current === requestId) setIsPending(false); }
  }

  return <div data-admin-availability-slot className="min-w-0">
    <AdminToggle checked={available} label={available ? `Rendre ${dishName} indisponible` : `Rendre ${dishName} disponible`} disabled={isPending} onClick={updateAvailability} />
    {error ? <div aria-live="assertive"><AdminToast tone="error">{error}</AdminToast></div> : null}
    {success ? <AdminToast>{success}</AdminToast> : null}
  </div>;
}
