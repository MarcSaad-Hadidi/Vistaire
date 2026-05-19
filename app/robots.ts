import type { MetadataRoute } from "next";
import { absoluteUrl, buildRobotsRules } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: buildRobotsRules(),
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
