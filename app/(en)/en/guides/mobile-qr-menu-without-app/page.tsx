import {
  buildEditorialGuideMetadata,
  VistaireEditorialGuide
} from "@/components/guides/VistaireEditorialGuide";
import { getEditorialGuide } from "@/lib/editorialGuides";

const guide = getEditorialGuide("mobile-qr-without-app", "en");

export const metadata = buildEditorialGuideMetadata(guide);

export default function MobileQrMenuWithoutAppPage() {
  return <VistaireEditorialGuide guide={guide} />;
}
