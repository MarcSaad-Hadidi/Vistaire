import type { AvailabilitySchedulingCapability } from "@/lib/admin/availability/contracts";

export const availabilityCopy = {
  fr: { title: "Disponibilités — Gestion opérationnelle", subtitle: "Gérez la disponibilité de vos plats en temps réel et planifiez les retours avec précision.", scheduleUnavailable: "Les retours planifiés sont indisponibles tant que le service d’exécution n’est pas confirmé.", retry: "Réessayer" },
  en: { title: "Availability — Operations", subtitle: "Manage dish availability in real time and schedule returns with confidence.", scheduleUnavailable: "Scheduled returns are unavailable until the execution service is confirmed.", retry: "Try again" }
} as const;

export function capabilityReasonCopy(capability: AvailabilitySchedulingCapability, locale: "fr" | "en") {
  if (capability.kind === "available") return null;
  if (capability.kind === "error") return locale === "fr" ? "Le service de planification ne répond pas." : "The scheduling service is not responding.";
  const fr = { "feature-disabled": "La planification n’est pas encore activée.", "schema-not-deployed": "Le service de planification n’est pas encore déployé.", "rpc-version-mismatch": "Une mise à jour du service est requise.", "worker-not-active": "Le service d’exécution n’a pas confirmé son activité." } as const;
  const en = { "feature-disabled": "Scheduling is not enabled yet.", "schema-not-deployed": "The scheduling service is not deployed yet.", "rpc-version-mismatch": "The scheduling service must be updated.", "worker-not-active": "The execution service has not confirmed recent activity." } as const;
  return (locale === "fr" ? fr : en)[capability.reason];
}
