"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type AvailabilityResponse = {
  ok: boolean;
  available?: boolean;
  error?: string;
};

export function AdminDishAvailabilityControl({
  dishId,
  dishName,
  initialAvailable,
  onAvailabilityChange
}: {
  dishId: string;
  dishName: string;
  initialAvailable: boolean;
  onAvailabilityChange?: (available: boolean) => void;
}) {
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
    setError(null);
    setSuccess(null);
    setAvailable(nextAvailable);
    setIsPending(true);
    try {
      const response = await fetch(
        `/admin/api/dishes/${encodeURIComponent(dishId)}/availability`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ available: nextAvailable })
        }
      );
      const result = (await response.json()) as AvailabilityResponse;
      if (latestRequest.current !== requestId) return;
      if (!response.ok || !result.ok || result.available !== nextAvailable) {
        setAvailable(previousAvailable);
        setError(
          result.error ?? "La disponibilité n’a pas pu être mise à jour."
        );
        return;
      }

      setSuccess(
        nextAvailable ? `${dishName} est disponible.` : `${dishName} est indisponible.`
      );
      onAvailabilityChange?.(nextAvailable);
      router.refresh();
    } catch {
      if (latestRequest.current !== requestId) return;
      setAvailable(previousAvailable);
      setError("La disponibilité n’a pas pu être mise à jour.");
    } finally {
      if (latestRequest.current === requestId) setIsPending(false);
    }
  }

  return (
    <div data-admin-availability-slot className="min-w-0">
      <button
        aria-label={
          available
            ? `Rendre ${dishName} indisponible`
            : `Rendre ${dishName} disponible`
        }
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-champagne/35 bg-champagne/[0.08] px-4 text-sm font-semibold text-cream transition hover:border-champagne/60 hover:bg-champagne/[0.13] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        disabled={isPending}
        onClick={updateAvailability}
        type="button"
      >
        {isPending
          ? "Mise à jour…"
          : available
            ? "Rendre indisponible"
            : "Rendre disponible"}
      </button>
      {error ? (
        <p aria-live="assertive" className="mt-2 text-xs leading-relaxed text-[#efb6a8]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p aria-live="polite" className="sr-only">
          {success}
        </p>
      ) : null}
    </div>
  );
}
