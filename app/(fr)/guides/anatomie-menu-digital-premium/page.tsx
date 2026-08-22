import {
  buildEditorialGuideMetadata,
  VistaireEditorialGuide
} from "@/components/guides/VistaireEditorialGuide";
import { getEditorialGuide } from "@/lib/editorialGuides";

const guide = getEditorialGuide("premium-menu-anatomy", "fr");

export const metadata = buildEditorialGuideMetadata(guide);

export default function AnatomieMenuDigitalPremiumPage() {
  return <VistaireEditorialGuide guide={guide} />;
}
