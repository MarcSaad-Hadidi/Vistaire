"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminToggle } from "@/components/admin/system/AdminPrimitives";
import { createAvailabilityMutation, type AvailabilityFeedback } from "@/components/admin/availability/availabilityMutation";

export function AdminDishAvailabilityControl({ dishId, dishName, initialAvailable, onAvailabilityChange, onFeedback }: { dishId: string; dishName: string; initialAvailable: boolean; onAvailabilityChange?: (available: boolean) => void; onFeedback?: (feedback: AvailabilityFeedback) => void }) {
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
  const updateAvailability = () => mutation.run({ dishId, dishName, available });
  return <div data-admin-availability-slot className="min-w-0"><AdminToggle checked={available} label={available ? `Rendre ${dishName} indisponible` : `Rendre ${dishName} disponible`} disabled={isPending} onClick={updateAvailability} /></div>;
}
