export type AvailabilityFeedback = { tone: "success" | "error" | null; message: string | null };
export type AvailabilityOverride = { base: boolean; value: boolean };
export const resolveAvailability = (serverValue: boolean, override?: AvailabilityOverride) => override?.base === serverValue ? override.value : serverValue;
export const resolveAvailabilityForSource = <T>(serverValue: boolean, source: T, overrideSource: T, override?: AvailabilityOverride) => source === overrideSource ? resolveAvailability(serverValue, override) : serverValue;

type ResponseLike = { ok: boolean; json(): Promise<{ ok: boolean; available?: boolean; error?: string }> };
type Dependencies = {
  fetcher: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<ResponseLike>;
  setAvailable: (available: boolean) => void;
  setFeedback: (feedback: AvailabilityFeedback) => void;
  refresh: () => void;
  committed?: (available: boolean) => void;
  setPending?: (pending: boolean) => void;
};

export function createAvailabilityMutation(dependencies: Dependencies) {
  let pending = false;
  let sequence = 0;
  return {
    invalidate() { sequence += 1; pending = false; },
    isPending() { return pending; },
    async run(input: { dishId: string; dishName: string; available: boolean }) {
      if (pending) return "ignored" as const;
      pending = true;
      dependencies.setPending?.(true);
      const requestId = ++sequence;
      const nextAvailable = !input.available;
      dependencies.setFeedback({ tone: null, message: null });
      dependencies.setAvailable(nextAvailable);
      try {
        const response = await dependencies.fetcher(`/admin/api/dishes/${encodeURIComponent(input.dishId)}/availability`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ available: nextAvailable })
        });
        const result = await response.json();
        if (sequence !== requestId) return "stale" as const;
        if (!response.ok || !result.ok || result.available !== nextAvailable) {
          dependencies.setAvailable(input.available);
          dependencies.setFeedback({ tone: "error", message: result.error ?? "La disponibilité n’a pas pu être mise à jour." });
          return "error" as const;
        }
        dependencies.committed?.(nextAvailable);
        dependencies.setFeedback({ tone: "success", message: nextAvailable ? `${input.dishName} est disponible.` : `${input.dishName} est indisponible.` });
        dependencies.refresh();
        return "success" as const;
      } catch {
        if (sequence !== requestId) return "stale" as const;
        dependencies.setAvailable(input.available);
        dependencies.setFeedback({ tone: "error", message: "La disponibilité n’a pas pu être mise à jour." });
        return "error" as const;
      } finally {
        if (sequence === requestId) { pending = false; dependencies.setPending?.(false); }
      }
    }
  };
}
