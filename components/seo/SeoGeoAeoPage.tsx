import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CinematicPage, type CinematicChapter, type CinematicScene } from "@/components/immersive/CinematicPage.jsx";
import { CinematicFooter } from "@/components/immersive/pages/CinematicFooter";
import { SEO_GEO_ROUTE_PAIRS } from "@/lib/seoGeoRoutes";
import type { SeoGeoPageData } from "@/lib/seoGeoPages";
import { getSeoMarketingImage } from "@/lib/seoMarketingImages";
import { buildSeoGeoPublicFaq, seoGeoPublicText } from "@/lib/seoGeoPublicText";
import { PreviewNav } from "../vistaire-preview/VistairePreviewChrome";
import { SeoFaq } from "./SeoFaq";

// Need and audience pages: the same four beats (answer, context, proof,
// comparison), told by each page's own shots, dish, restaurant and stand
// (PageShots.js "geo-<n>-<chapter>"), then free reading with the page's own
// photographs and tools. Keyed by the French path of each pair.
const GEO_SCRIPTS: Record<string, { n: number; composition: string; scene: CinematicScene }> = {
  "/menu-qr-sans-pdf": { n: 1, composition: "qr-access-gate", scene: { dish: "huitres", phoneDemo: "sauge-noire", collection: "acrylique" } },
  "/menu-digital-sans-application": { n: 2, composition: "browser-first-story", scene: { dish: "burger", phoneDemo: "trouvable" } },
  "/remplacer-menu-pdf-restaurant": { n: 3, composition: "pdf-migration-folio", scene: { dish: "homard", phoneDemo: "maison-elyse" } },
  "/alternative-menu-pdf-restaurant": { n: 4, composition: "pdf-alternative-choice-spread", scene: { dish: "souffle", phoneDemo: "maison-elyse" } },
  "/fiche-plat-digitale-restaurant": { n: 5, composition: "annotated-dish-portrait", scene: { dish: "poutine", phoneDemo: "trouvable" } },
  "/menu-restaurant-photos": { n: 6, composition: "food-photography-essay", scene: { dish: "chocolat-fume", phoneDemo: "sauge-noire", collection: "sculpte" } },
  "/menu-restaurant-allergenes": { n: 7, composition: "allergen-information-inspection", scene: { dish: "sushi", phoneDemo: "trouvable" } },
  "/menu-digital-restaurant-montreal": { n: 8, composition: "montreal-editorial-dossier", scene: { dish: "homard", phoneDemo: "maison-elyse" } },
  "/menu-digital-restaurant-laval": { n: 9, composition: "laval-shared-table-story", scene: { dish: "burger", phoneDemo: "trouvable" } },
  "/menu-digital-restaurant-brossard": { n: 10, composition: "brossard-destination-arrival", scene: { dish: "poutine", phoneDemo: "trouvable" } },
  "/menu-digital-restaurant-haut-de-gamme": { n: 11, composition: "high-end-brand-manifesto", scene: { dish: "huitres", phoneDemo: "sauge-noire", collection: "signature" } },
  "/menu-digital-restaurant-gastronomique": { n: 12, composition: "gastronomy-paced-narrative", scene: { dish: "souffle", phoneDemo: "maison-elyse" } },
};

// Where a page's own slots show the same dish twice, borrow a distinct photograph.
const PHOTO_OVERRIDES: Record<string, Partial<Record<"hero" | "proof" | "premium", string>>> = {
  G4: { hero: "DIGITAL:hero", premium: "PDF:hero" },
  G5: { premium: "DIGITAL:premium" },
  G7: { hero: "DIGITAL:proof" },
  G12: { proof: "PDF:detail" },
};

// The page's three restaurant photographs (G<n>:hero|proof|premium slots).
function GeoGallery({ page, group }: { page: SeoGeoPageData; group: string }) {
  const en = page.locale === "en";
  return (
    <div className="cinematic-gallery">
      {(["hero", "proof", "premium"] as const).map((placement) => {
        const slot = `${group}:${placement}`;
        const photo = getSeoMarketingImage(PHOTO_OVERRIDES[group]?.[placement] ?? slot, page.locale ?? "fr");
        const frame = (
          <div className="cinematic-photo-frame">
            <Image alt={photo.alt} src={photo.src} fill quality={84} sizes="(max-width: 767px) calc(100vw - 32px), 360px" />
          </div>
        );
        return (
          <figure className="cinematic-photo" data-seo-photo-slot={slot} key={slot}>
            {group === "G7" && placement === "proof" ? (
              <a href={photo.src} target="_blank" rel="noopener noreferrer">
                {frame}
                <span>{en ? "View the allergen panel at full size (new tab)" : "Voir le panneau des allergènes en grand (nouvel onglet)"}</span>
              </a>
            ) : frame}
            {group === "G7" && placement === "premium" ? (
              <figcaption>{en ? "A dish example. Its photograph does not establish its allergen information." : "Un exemple de plat. Sa photographie ne permet pas d’établir ses allergènes."}</figcaption>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}

// Tools some needs keep from their former pages: a migration checklist, the
// allergen caution, a dish page's anatomy, photography criteria.
function GeoTools({ page, n, text }: { page: SeoGeoPageData; n: number; text: (value: string) => string }) {
  const en = page.locale === "en";
  const tools: Record<number, ReactNode> = {
    3: (
      <form className="cinematic-panel cinematic-checklist">
        <fieldset>
          <legend>{en ? "Prepare your menu" : "Préparer votre carte"}</legend>
          <p>{en ? "A checklist for your team. Your choices stay on this page." : "Un aide-mémoire pour votre équipe. Vos choix restent sur cette page."}</p>
          {page.context.points?.map((point, index) => <label key={point}><input type="checkbox" name={`preparation-${index}`} /><span>{text(point)}</span></label>)}
          <button type="reset">{en ? "Start again" : "Recommencer"}</button>
        </fieldset>
      </form>
    ),
    5: (
      <section className="cinematic-panel" aria-label={en ? "Explore a dish page" : "Explorer une fiche plat"}>
        <h3>{en ? "The anatomy of a dish page" : "L’anatomie d’une fiche plat"}</h3>
        {[page.included[3], page.included[2], page.included[4], page.included[5]].filter(Boolean).map((item, index) => (
          <details key={item.title}><summary><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span> {text(item.title)}</summary><p>{text(item.text)}</p></details>
        ))}
      </section>
    ),
    6: (
      <section className="cinematic-panel" aria-label={en ? "Look closely" : "Regarder de près"}>
        <h3>{en ? "The dish. The detail. The menu." : "Le plat. Le détail. La carte."}</h3>
        <ol>{page.context.points?.map((point) => <li key={point}>{text(point)}</li>)}</ol>
      </section>
    ),
    7: (
      <section className="cinematic-panel">
        <p><strong>{en ? "For a sensitive dietary need, always confirm the information with the restaurant team." : "Pour un besoin alimentaire sensible, confirmez toujours l’information avec l’équipe du restaurant."}</strong></p>
        <details data-allergen-service-note>
          <summary>{en ? "What to confirm with the team" : "Ce qu’il faut confirmer avec l’équipe"}</summary>
          <p>{text(page.context.body[0])}</p>
          {page.comparison.rows[2] && <p>{text(page.comparison.rows[2].vistaire)}</p>}
        </details>
      </section>
    ),
  };
  return tools[n] ?? null;
}

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
      id: "accueil",
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
        <section className="cinematic-guide" aria-labelledby={`${page.slug}-guide-title`} data-seo-composition={script.composition}>
          <div className="cinematic-panel cinematic-guide-intro">
            <span className="eyebrow">{en ? "Vistaire guide" : "Guide Vistaire"}</span>
            <h2 id={`${page.slug}-guide-title`}>{en ? "Direct answer" : "Réponse directe"}</h2>
            <p>{text(page.directAnswer)}</p>
            {page.context.body.slice(1).map((paragraph) => <p key={paragraph}>{text(paragraph)}</p>)}
          </div>
          <GeoTools page={page} n={script.n} text={text} />
          <GeoGallery page={page} group={`G${script.n}`} />
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
                  <tr key={row.label}><th scope="row">{text(row.label)}</th><td data-label={text(page.comparison.basicLabel)}>{text(row.basic)}</td><td data-label={text(page.comparison.vistaireLabel)}>{text(row.vistaire)}</td></tr>
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
