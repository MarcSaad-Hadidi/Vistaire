import Link from "next/link";
import { CinematicPage, type CinematicChapter } from "../CinematicPage.jsx";
import { PreviewFooter, PreviewNav } from "@/components/vistaire-preview/VistairePreviewChrome";
import { VistaireSeoProductionSections } from "@/components/vistaire-preview/VistaireSeoProductionSections";
import type { SeoPageData } from "@/lib/seoPages";

// Digital menu page, "from appetite to decision": the phone at eye level, the
// camera circling it, a dish rising beside it, a top-down read of the
// comparison, then the table in service. Copy comes from the SEO page data.
export function DigitalMenuCinematic({ page }: { page: SeoPageData }) {
  const locale = page.locale ?? "fr";
  const [first, second] = page.sections;
  const chapters: CinematicChapter[] = [
    {
      id: "digital-introduction",
      shot: "digital-hero",
      align: "right",
      titleId: "digital-title",
      content: (
        <>
          <span className="eyebrow">{page.eyebrow}</span>
          <h1 id="digital-title">{page.h1}</h1>
          <p>{page.answer[0]}</p>
          <div className="cinematic-actions">
            <Link className="action" href={page.primaryCta.href}>{page.primaryCta.label}</Link>
          </div>
        </>
      ),
    },
    {
      id: "digital-journey",
      shot: "digital-orbit",
      align: "left",
      titleId: "digital-journey-title",
      content: (
        <>
          <h2 id="digital-journey-title">{first.heading}</h2>
          {first.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {first.points && <ul>{first.points.map((point) => <li key={point}>{point}</li>)}</ul>}
        </>
      ),
    },
    {
      id: "digital-dish",
      shot: "digital-dish",
      align: "right",
      titleId: "digital-dish-title",
      content: (
        <>
          <h2 id="digital-dish-title">{second.heading}</h2>
          <p>{second.body[0]}</p>
        </>
      ),
    },
    {
      id: "digital-compare",
      shot: "digital-topdown",
      align: "left",
      titleId: "digital-compare-title",
      content: (
        <>
          <h2 id="digital-compare-title">{page.comparison.heading}</h2>
          <dl className="cinematic-compare">
            {page.comparison.rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd><span>{page.comparison.beforeLabel}</span>{row.before}</dd>
                <dd><span>{page.comparison.afterLabel}</span>{row.after}</dd>
              </div>
            ))}
          </dl>
        </>
      ),
    },
    {
      id: "digital-service",
      shot: "digital-room",
      align: "center",
      titleId: "digital-service-title",
      content: (
        <>
          <h2 id="digital-service-title">{page.takeaway.heading}</h2>
          <p>{page.takeaway.text}</p>
          <p>{page.answer[1]}</p>
          <div className="cinematic-actions">
            <Link className="action" href={page.primaryCta.href}>{page.primaryCta.label}</Link>
            {page.secondaryCta && <Link className="action action-dark" href={page.secondaryCta.href}>{page.secondaryCta.label}</Link>}
          </div>
        </>
      ),
    },
  ];
  return (
    <>
      <PreviewNav currentPath={page.path} locale={locale} routeMode="production" />
      <CinematicPage chapters={chapters}>
        <VistaireSeoProductionSections page={page} />
        <PreviewFooter currentPath={page.path} locale={locale} routeMode="production" width="wide" />
      </CinematicPage>
    </>
  );
}
