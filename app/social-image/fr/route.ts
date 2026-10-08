import { buildVistaireSocialImage } from "@/lib/seoSocialImage";

export const dynamic = "force-static";

export function GET() {
  return buildVistaireSocialImage("fr");
}
