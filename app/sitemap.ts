import type { MetadataRoute } from "next";
import { getAllDishes } from "@/lib/demoMenuData";
import { buildSitemapEntries } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemapEntries(getAllDishes());
}
