import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return buildSitemapEntries([], lastModified);
}
