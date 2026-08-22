import {
  buildEditorialGuideMetadata,
  VistaireEditorialGuide
} from "@/components/guides/VistaireEditorialGuide";
import { getEditorialGuide } from "@/lib/editorialGuides";

const guide = getEditorialGuide("premium-menu-anatomy", "en");

export const metadata = buildEditorialGuideMetadata(guide);

export default function PremiumDigitalMenuAnatomyPage() {
  return <VistaireEditorialGuide guide={guide} />;
}
