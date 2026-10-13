import Link from "next/link";
import { CinematicPage, type CinematicChapter, type CinematicScene } from "@/components/immersive/CinematicPage.jsx";
import { CinematicFooter } from "@/components/immersive/pages/CinematicFooter";
import { SEO_GEO_ROUTE_PAIRS } from "@/lib/seoGeoRoutes";
import type { SeoGeoPageData } from "@/lib/seoGeoPages";
import { buildSeoGeoPublicFaq, seoGeoPublicText } from "@/lib/seoGeoPublicText";
import { PreviewNav } from "../vistaire-preview/VistairePreviewChrome";
import { SeoFaq } from "./SeoFaq";

// Need and audience pages: the same four beats (answer, context, proof,
// comparison), told by each page's own shots, dish, restaurant and stand
// (PageShots.js "geo-<n>-<chapter>"). Keyed by the French path of each pair.
const GEO_SCRIPTS: Record<string, { n: number; scene: CinematicScene }> = {
  "/menu-qr-sans-pdf": { n: 1, scene: { dish: "huitres", phoneDemo: "sauge-noire", collection: "acrylique" } },
  "/menu-digital-sans-application": { n: 2, scene: { dish: "burger", phoneDemo: "trouvable" } },
  "/remplacer-menu-pdf-restaurant": { n: 3, scene: { dish: "homard", phoneDemo: "maison-elyse" } },
  "/alternative-menu-pdf-restaurant": { n: 4, scene: { dish: "souffle", phoneDemo: "maison-elyse" } },
  "/fiche-plat-digitale-restaurant": { n: 5, scene: { dish: "poutine", phoneDemo: "trouvable" } },
  "/menu-restaurant-photos": { n: 6, scene: { dish: "chocolat-fume", phoneDemo: "sauge-noire", collection: "sculpte" } },
  "/menu-restaurant-allergenes": { n: 7, scene: { dish: "sushi", phoneDemo: "trouvable" } },
  "/menu-digital-restaurant-montreal": { n: 8, scene: { dish: "homard", phoneDemo: "maison-elyse" } },
  "/menu-digital-restaurant-laval": { n: 9, scene: { dish: "burger", phoneDemo: "trouvable" } },
  "/menu-digital-restaurant-brossard": { n: 10, scene: { dish: "poutine", phoneDemo: "trouvable" } },
  "/menu-digital-restaurant-haut-de-gamme": { n: 11, scene: { dish: "huitres", phoneDemo: "sauge-noire", collection: "signature" } },
  "/menu-digital-restaurant-gastronomique": { n: 12, scene: { dish: "souffle", phoneDemo: "maison-elyse" } },
};

export function SeoGeoAeoPage({ page }: { page: SeoGeoPageData }) {
  const locale = page.locale ?? "fr";
  const en = locale === "en";
  const text = (value: string) => seoGeoPublicText(value, locale);
  const pair = SEO_GEO_ROUTE_PAIRS.find((route) => route.fr === page.path || route.en === page.path);
  const script = GEO_SCRIPTS[pair?.fr ?? page.path];
  if (!script) throw new Error(`Missing restaurant page composition: ${page.path}`);
  const shot = (index: number) => `geo-${script.n}-${index}`;
  const links = page.relatedLinks.filter((link, index, all) => all.findIndex((item) => item.href === link.href) === index);
  const faqs = buildSeoGeoPublicFaq(page);
  const chapters: CinematicChapter[] = [
    {
      id: `${page.slug}-answer`,
      shot: shot(1),
      titleId: `${page.slug}-title`,
      content: (
        <>
          <span className="eyebrow">{text(page.eyebrow)}</span>
          <h1 id={`${page.slug}-title`}>{text(page.h1)}</h1>
          <p>{text(page.directAnswer)}</p>
          <div className="cinematic-actions">
            <Link className="action" href={page.primaryCta.href} prefetch={false}>{text(page.primaryCta.label)}</Link>
            <Link className="action action-dark" href={page.secondaryCta.href} prefetch={false}>{text(page.secondaryCta.label)}</Link>
          </div>
        </>
      ),
    },
    {
      id: `${page.slug}-context`,
      shot: shot(2),
      align: script.n % 2 ? "right" : "left",
      titleId: `${page.slug}-context-title`,
      content: (
        <>
          <h2 id={`${page.slug}-context-title`}>{text(page.context.heading)}</h2>
          <p>{text(page.context.body[0])}</p>
          {page.context.points && <ul>{page.context.points.slice(0, 3).map((point) => <li key={point}>{text(point)}</li>)}</ul>}
        </>
      ),
    },
    {
      id: `${page.slug}-proof`,
      shot: shot(3),
      align: script.n % 3 === 0 ? "center" : script.n % 2 ? "left" : "right",
      titleId: `${page.slug}-proof-title`,
      content: (
        <>
          <h2 id={`${page.slug}-proof-title`}>{text(page.productProof.heading)}</h2>
          <p>{text(page.productProof.body)}</p>
          <ul>{page.productProof.points.slice(0, 3).map((point) => <li key={point}>{text(point)}</li>)}</ul>
        </>
      ),
    },
    {
      id: `${page.slug}-comparison`,
      shot: shot(4),
      align: script.n % 2 ? "right" : "left",
      titleId: `${page.slug}-comparison-title`,
      content: (
        <>
          <h2 id={`${page.slug}-comparison-title`}>{text(page.comparison.heading)}</h2>
          <dl className="cinematic-compare">
            {page.comparison.rows.slice(0, 3).map((row) => (
              <div key={row.label}>
                <dt>{text(row.label)}</dt>
                <dd><span>{text(page.comparison.basicLabel)}</span>{text(row.basic)}</dd>
                <dd><span>{text(page.comparison.vistaireLabel)}</span>{text(row.vistaire)}</dd>
              </div>
            ))}
          </dl>
        </>
      ),
    },
  ];
  return (
    <>
      <PreviewNav currentPath={page.path} locale={locale} routeMode="production" />
      <CinematicPage chapters={chapters} scene={script.scene} footer={<CinematicFooter locale={locale} id={page.slug} />}>
        <section className="cinematic-guide" aria-labelledby={`${page.slug}-guide-title`}>
          <div className="cinematic-panel cinematic-guide-intro">
            <span className="eyebrow">{en ? "Vistaire guide" : "Guide Vistaire"}</span>
            <h2 id={`${page.slug}-guide-title`}>{en ? "Direct answer" : "Réponse directe"}</h2>
            <p>{text(page.directAnswer)}</p>
            {page.context.body.slice(1).map((paragraph) => <p key={paragraph}>{text(paragraph)}</p>)}
          </div>
          <div className="cinematic-guide-sections">
            {page.included.map((item) => (
              <article className="cinematic-panel" key={item.title}>
                <h3>{text(item.title)}</h3>
                <p>{text(item.text)}</p>
              </article>
            ))}
          </div>
          <div className="cinematic-panel">
            <h3>{text(page.comparison.heading)}</h3>
            <table className="cinematic-table">
              <thead>
                <tr><th scope="col"><span className="sr-only">{en ? "Criterion" : "Critère"}</span></th><th scope="col">{text(page.comparison.basicLabel)}</th><th scope="col">{text(page.comparison.vistaireLabel)}</th></tr>
              </thead>
              <tbody>
                {page.comparison.rows.map((row) => (
                  <tr key={row.label}><th scope="row">{text(row.label)}</th><td>{text(row.basic)}</td><td>{text(row.vistaire)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <section className="landing-faq cinematic-faq" aria-labelledby={`${page.slug}-faq-title`}>
            <div className="landing-faq-heading">
              <span className="pricing-eyebrow">{en ? "Your questions" : "Vos questions"}</span>
              <h2 id={`${page.slug}-faq-title`}>{en ? "Common restaurant questions" : "Questions fréquentes des restaurateurs"}</h2>
            </div>
            <SeoFaq className="landing-faq-items" layout="stack" locale={locale} faqs={faqs} />
          </section>
          <nav className="cinematic-related" aria-label={en ? "Related restaurant guides" : "Guides pour votre restaurant"}>
            {links.map((link) => (
              <Link className="cinematic-panel" href={link.href} key={link.href} prefetch={false}>
                <strong>{text(link.label)}</strong>
              </Link>
            ))}
          </nav>
        </section>
      </CinematicPage>
    </>
  );
}
