import type { AvailabilitySchedulingCapability } from "@/lib/admin/availability/contracts";
import { capabilityReasonCopy } from "./availabilityCopy";
import styles from "./AdminAvailability.module.css";

export function AvailabilityCapabilityNotice({ capability, locale = "fr" }: { capability: AvailabilitySchedulingCapability; locale?: "fr" | "en" }) {
  if (capability.kind === "available") return null;
  return <aside className={styles.capabilityNotice} role={capability.kind === "error" ? "alert" : "status"}><strong>{locale === "fr" ? "Retours planifiés indisponibles" : "Scheduled returns unavailable"}</strong><p>{capabilityReasonCopy(capability, locale)}</p><small>{locale === "fr" ? "Les changements immédiats restent disponibles." : "Immediate availability changes remain available."}</small></aside>;
}
