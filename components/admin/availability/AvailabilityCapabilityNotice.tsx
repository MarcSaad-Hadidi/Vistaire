import type { AvailabilitySchedulingCapability } from "@/lib/admin/availability/contracts";
import { capabilityReasonCopy } from "./availabilityCopy";
import styles from "./AdminAvailability.module.css";

export function AvailabilityCapabilityNotice({ capability, locale = "fr" }: { capability: AvailabilitySchedulingCapability; locale?: "fr" | "en" }) {
  if (capability.kind === "available") return null;
  const readOnly = capability.kind === "unavailable" && capability.reason === "write-access-required";
  return <aside className={styles.capabilityNotice} role={capability.kind === "error" ? "alert" : "status"}><strong>{locale === "fr" ? "Retours planifiés indisponibles" : "Scheduled returns unavailable"}</strong><p>{capabilityReasonCopy(capability, locale)}</p><small>{readOnly ? (locale === "fr" ? "Les changements nécessitant une écriture restent désactivés." : "Changes requiring write access remain disabled.") : (locale === "fr" ? "Les changements immédiats restent disponibles." : "Immediate availability changes remain available.")}</small></aside>;
}
