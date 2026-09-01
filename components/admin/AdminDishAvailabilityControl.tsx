"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminToggle } from "@/components/admin/system/AdminPrimitives";
import { createAvailabilityMutation, type AvailabilityFeedback } from "@/components/admin/availability/availabilityMutation";

export function AdminDishAvailabilityControl({ dishId, dishName, initialAvailable, canWrite = true, onAvailabilityChange, onFeedback }: { dishId: string; dishName: string; initialAvailable: boolean; canWrite?: boolean; onAvailabilityChange?: (available: boolean) => void; onFeedback?: (feedback: AvailabilityFeedback) => void }) {
  const router = useRouter();
  const [available, setAvailable] = useState(initialAvailable);
  const [isPending, setIsPending] = useState(false);
  const [mutation] = useState(() => createAvailabilityMutation({
    fetcher: (url, init) => fetch(url, init),
    setAvailable,
    setPending: setIsPending,
    setFeedback: (feedback) => onFeedback?.(feedback),
    committed: (nextAvailable) => onAvailabilityChange?.(nextAvailable),
    refresh: () => router.refresh()
  }));
  useEffect(() => () => mutation.invalidate(), [mutation]);
  const updateAvailability = () => canWrite ? mutation.run({ dishId, dishName, available }) : undefined;
  return <div data-admin-availability-slot className="flex min-w-0 flex-col items-center"><AdminToggle checked={available} label={canWrite ? (available ? `Rendre ${dishName} indisponible` : `Rendre ${dishName} disponible`) : `${dishName} — accès en lecture seule`} disabled={isPending || !canWrite} onClick={updateAvailability} /><span className="text-center text-[11px] leading-tight text-[#918b82]">{canWrite ? (available ? "Visible sur le menu" : "Affiché comme indisponible") : "Lecture seule"}</span></div>;
}
