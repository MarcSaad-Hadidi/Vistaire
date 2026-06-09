import type { MetadataRoute } from "next";
import { absoluteUrl, buildSitemapEntries } from "@/lib/seo";

const newPublicEntries = [
  {
    path: "/tarifs-menu-digital-restaurant",
    changeFrequency: "monthly",
    priority: 0.9
  },
  {
    path: "/carte-vistaire",
    changeFrequency: "monthly",
    priority: 0.8
  }
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    ...buildSitemapEntries([], lastModified),
    ...newPublicEntries.map((entry) => ({
      url: absoluteUrl(entry.path),
      lastModified,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority
    }))
  ];
}
