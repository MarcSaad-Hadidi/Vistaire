import {
  buildEditorialGuideMetadata,
  VistaireEditorialGuide
} from "@/components/guides/VistaireEditorialGuide";
import { getEditorialGuide } from "@/lib/editorialGuides";

const guide = getEditorialGuide("restaurant-3d-decision", "en");

export const metadata = buildEditorialGuideMetadata(guide);

export default function Restaurant3dUsefulVsGimmickPage() {
  return <VistaireEditorialGuide guide={guide} />;
}
