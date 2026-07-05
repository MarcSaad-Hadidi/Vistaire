import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Documentation API publique Vistaire",
  description:
    "Documentation concise des endpoints publics Vistaire exposes aux agents et integrations."
};

export default function ApiDocsPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "64px 20px" }}>
      <p style={{ color: "#8a6a3e", fontWeight: 700, textTransform: "uppercase" }}>
        Vistaire
      </p>
      <h1>Documentation API publique</h1>
      <p>
        Cette page documente uniquement les endpoints publics et non destructifs
        exposes dans le catalogue API. Les routes owner/admin restent protegees
        et ne sont pas publiees comme API publique.
      </p>
      <ul>
        <li>
          <a href={absoluteUrl("/openapi.json")}>OpenAPI public</a>
        </li>
        <li>
          <a href={absoluteUrl("/.well-known/api-catalog")}>API catalog</a>
        </li>
        <li>
          <a href={absoluteUrl("/auth.md")}>auth.md</a>
        </li>
      </ul>
    </main>
  );
}
