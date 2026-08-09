import {
  buildEditorialGuideMetadata,
  VistaireEditorialGuide
} from "@/components/guides/VistaireEditorialGuide";
import { getEditorialGuide } from "@/lib/editorialGuides";

const guide = getEditorialGuide("restaurant-3d-decision", "fr");

export const metadata = buildEditorialGuideMetadata(guide);

export default function Restaurant3dUtileVsGadgetPage() {
  return <VistaireEditorialGuide guide={guide} />;
}
