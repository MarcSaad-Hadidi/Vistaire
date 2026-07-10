"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  const [isPending, startTransition] = useTransition();

  function updateAvailability() {
    const nextAvailable = !available;
    setError(null);
    startTransition(async () => {
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
        if (!response.ok || !result.ok || result.available !== nextAvailable) {
          setError(
            result.error ?? "La disponibilité n’a pas pu être mise à jour."
          );
          return;
        }

        setAvailable(nextAvailable);
        onAvailabilityChange?.(nextAvailable);
        router.refresh();
      } catch {
        setError("La disponibilité n’a pas pu être mise à jour.");
      }
    });
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
        <p aria-live="polite" className="mt-2 text-xs leading-relaxed text-[#efb6a8]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
