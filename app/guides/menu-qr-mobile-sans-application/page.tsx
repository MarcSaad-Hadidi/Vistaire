import {
  buildEditorialGuideMetadata,
  VistaireEditorialGuide
} from "@/components/guides/VistaireEditorialGuide";
import { getEditorialGuide } from "@/lib/editorialGuides";

const guide = getEditorialGuide("mobile-qr-without-app", "fr");

export const metadata = buildEditorialGuideMetadata(guide);

export default function MenuQrMobileSansApplicationPage() {
  return <VistaireEditorialGuide guide={guide} />;
}
