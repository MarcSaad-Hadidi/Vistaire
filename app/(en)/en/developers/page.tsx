import type { Metadata } from "next";
import { VistaireDevelopersPage } from "@/components/developers/VistaireDevelopersPage";
import { DEVELOPERS_PAGE, DEVELOPERS_PATH } from "@/lib/developersPage";

const page = DEVELOPERS_PAGE.en;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: {
    canonical: page.path,
    languages: { "fr-CA": DEVELOPERS_PATH.fr, "en-CA": DEVELOPERS_PATH.en }
  }
};

export default function EnglishDevelopersPage() {
  return <VistaireDevelopersPage locale="en" />;
}
