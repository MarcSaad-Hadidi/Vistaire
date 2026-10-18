import { trackMenuEvent, type PublicMenuAnalyticsContext } from "../../lib/analytics/client.ts";

/** Public viewing is opt-in. Missing context must never fall back to demo. */
export function trackPublicModelEvent(
  enabled: boolean,
  context: PublicMenuAnalyticsContext | undefined,
  event: Omit<Parameters<typeof trackMenuEvent>[0], "restaurantId" | "menuId" | "source">
): void {
  if (!enabled || !context?.restaurantId || !context.menuId ||
    (context.source !== "production" && context.source !== "demo")) return;
  trackMenuEvent({ ...event, ...context });
}

/** Bounded observable model lifecycle. No native-AR success is inferred from a link or promise. */
export type ModelInteraction = "rotate" | "zoom" | "pan";
export type ArObservedOutcome =
  | "launched"
  | "session-started"
  | "object-placed"
  | "failed"
  | "ended"
  | "unknown";
type ModelEvent = {
  eventName:
    | "model_load_started"
    | "model_load_succeeded"
    | "model_load_failed"
    | "model_interacted"
    | "model_active_duration"
    | "ar_outcome";
  metadata: Record<string, number | string>;
};
const IDLE_MS = 30_000;
const MAX_ACTIVE_MS = 1_800_000;
export function createModelTelemetry({
  now,
  emit,
}: {
  now: () => number;
  emit: (event: ModelEvent) => void;
}) {
  let started: number | null = null,
    ready = false,
    terminal = false,
    visible = false;
  let previous = now(),
    lastActivity = -Infinity,
    active = 0,
    sent = 0,
    arPending = false;
  const interactions = new Set<ModelInteraction>(),
    outcomes = new Set<ArObservedOutcome>();
  const tick = () => {
    const current = now();
    if (ready && visible)
      active = Math.min(
        MAX_ACTIVE_MS,
        active +
          Math.max(0, Math.min(current, lastActivity + IDLE_MS) - previous),
      );
    previous = current;
  };
  const arOutcome = (outcome: ArObservedOutcome) => {
    if (!arPending || outcomes.has(outcome)) return;
    outcomes.add(outcome);
    emit({ eventName: "ar_outcome", metadata: { outcome } });
    if (outcome === "ended" || outcome === "failed") arPending = false;
  };
  const flush = () => {
    tick();
    const durationMs = Math.floor(active - sent);
    if (durationMs > 0) {
      emit({ eventName: "model_active_duration", metadata: { durationMs } });
      sent += durationMs;
    }
  };
  return {
    start() {
      if (started !== null) return;
      started = now();
      emit({ eventName: "model_load_started", metadata: {} });
    },
    loaded() {
      if (started === null || terminal) return;
      terminal = true;
      ready = true;
      lastActivity = previous = now();
      emit({
        eventName: "model_load_succeeded",
        metadata: {
          loadDurationMs: Math.min(
            120000,
            Math.max(0, Math.round(now() - started)),
          ),
        },
      });
    },
    failed(errorCode: "load-failed" | "timeout" | "unsupported" | "unknown") {
      if (started === null || terminal) return;
      terminal = true;
      emit({
        eventName: "model_load_failed",
        metadata: {
          errorCode,
          loadDurationMs: Math.min(
            120000,
            Math.max(0, Math.round(now() - started)),
          ),
        },
      });
    },
    visibility(next: boolean) {
      tick();
      visible = next;
    },
    interact(interaction: ModelInteraction) {
      if (!ready) return;
      tick();
      lastActivity = now();
      if (interactions.has(interaction)) return;
      interactions.add(interaction);
      emit({ eventName: "model_interacted", metadata: { interaction } });
    },
    flush,
    arIntent() {
      outcomes.clear();
      arPending = true;
      arOutcome("launched");
    },
    arOutcome,
    dispose() {
      flush();
      if (
        arPending &&
        !outcomes.has("session-started") &&
        !outcomes.has("object-placed")
      )
        arOutcome("unknown");
      visible = false;
    },
  };
}
