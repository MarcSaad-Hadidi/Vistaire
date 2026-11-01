import type { Metadata } from "next";
import { StudioState } from "@/components/admin/studio/StudioState";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function InvalidQrPage() {
  return <StudioState kind="qr" title="QR introuvable ou désactivé" description="Ce QR n’est plus actif. Demandez au restaurant un QR à jour."/>;
}
