import type { Metadata } from "next";
import Link from "next/link";
import { VistaireLegalPage } from "@/components/legal/VistaireLegalPage";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Développeurs et agents | Vistaire",
  description:
    "API publique en lecture seule de Vistaire, spécification OpenAPI, authentification et ressources pour agents IA.",
  alternates: { canonical: "/developers" }
};

const exchangeRatesExample = `curl "${absoluteUrl("/api/exchange-rates")}?base=CAD&quotes=USD,EUR"`;
const errorExample = `{ "ok": false, "error": "API route not found.", "code": "not_found", "hint": "See ${absoluteUrl("/openapi.json")} for the public API." }`;

export default function DevelopersPage() {
  return (
    <VistaireLegalPage
      eyebrow="Vistaire · Développeurs"
      intro="Vistaire est un service de menu digital pour restaurants. Cette page décrit la petite surface publique, en lecture seule, que les développeurs et les agents IA peuvent utiliser sans compte."
      languageHref="/en"
      languageLabel="EN"
      locale="fr"
      title="Vistaire pour les développeurs et les agents"
      updatedLabel="Dernière mise à jour : 21 octobre 2026"
    >
      <section>
        <h2>Ce qui est public</h2>
        <p>
          Les points d’accès publics sont en lecture seule et ne demandent aucune clé. Les API du back-office (restaurants, menus, QR) sont réservées aux propriétaires connectés et ne font pas partie de l’API publique.
        </p>
      </section>

      <section>
        <h2>Points d’accès</h2>
        <ul>
          <li>
            <code>GET /api/exchange-rates</code> : taux de change utilisés pour l’affichage des prix d’un menu public. Paramètres facultatifs <code>base</code> (CAD, USD ou EUR) et <code>quotes</code>.
          </li>
          <li>
            <code>GET /api/public/menu-dishes/{"{dishId}"}/photo</code>, <code>/model/glb</code> et <code>/model/usdz</code> : photo ou modèle 3D d’un plat publié. Répond par une redirection 307 vers le fichier signé.
          </li>
        </ul>
        <p>Exemple :</p>
        <pre>
          <code>{exchangeRatesExample}</code>
        </pre>
      </section>

      <section>
        <h2>Erreurs</h2>
        <p>Les erreurs de l’API sont en JSON, avec un code lisible par une machine et une piste de résolution :</p>
        <pre>
          <code>{errorExample}</code>
        </pre>
      </section>

      <section>
        <h2>Authentification</h2>
        <p>
          Aucune authentification n’est nécessaire pour les points d’accès publics. Vistaire n’offre pas encore de serveur OAuth, de clés d’API en libre-service ni d’environnement de test. Pour une intégration, écrivez à <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>. Le détail est publié dans <a href="/auth.md">/auth.md</a>.
        </p>
      </section>

      <section>
        <h2>Ressources lisibles par machine</h2>
        <ul>
          <li><a href="/openapi.json">/openapi.json</a> : spécification OpenAPI 3.1 de l’API publique.</li>
          <li><a href="/llms.txt">/llms.txt</a> et <a href="/llms-full.txt">/llms-full.txt</a> : présentation de Vistaire pour les modèles de langage.</li>
          <li><Link href="/.well-known/api-catalog" prefetch={false}>/.well-known/api-catalog</Link> : catalogue d’API (RFC 9727).</li>
          <li><a href="/.well-known/agent-skills/index.json">/.well-known/agent-skills/index.json</a> : compétences pour agents, avec quand les utiliser.</li>
          <li><a href="/.well-known/mcp/server-card.json">/.well-known/mcp/server-card.json</a> : fiche MCP (pas de serveur MCP pour l’instant).</li>
          <li>Chaque page publique répond aussi en Markdown avec l’en-tête <code>Accept: text/markdown</code>.</li>
        </ul>
        <p>
          Pour un projet de menu, passez par la page <Link href="/prendre-rendez-vous" prefetch={false}>Prendre rendez-vous</Link>.
        </p>
      </section>
    </VistaireLegalPage>
  );
}
