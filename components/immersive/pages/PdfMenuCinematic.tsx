import Link from "next/link";
import { CinematicPage, type CinematicChapter } from "../CinematicPage.jsx";
import { PreviewNav } from "@/components/vistaire-preview/VistairePreviewChrome";
import { CinematicGuide } from "./CinematicGuide";
import type { SeoPageData } from "@/lib/seoPages";

// PDF vs digital page, "from a still sheet to a living menu": the phone lies
// flat like paper, rises while the camera comes down, stands beside the stand
// for the comparison, then gives way to the dish a sheet cannot show.
export function PdfMenuCinematic({ page }: { page: SeoPageData }) {
  const locale = page.locale ?? "fr";
  const [first, second] = page.sections;
  const chapters: CinematicChapter[] = [
    {
      id: "pdf-introduction",
      shot: "pdf-flat",
      align: "left",
      titleId: "pdf-title",
      content: (
        <>
          <span className="eyebrow">{page.eyebrow}</span>
          <h1 id="pdf-title">{page.h1}</h1>
          <p>{page.answer[0]}</p>
        </>
      ),
    },
    {
      id: "pdf-living",
      shot: "pdf-rise",
      align: "center",
      titleId: "pdf-living-title",
      content: (
        <>
          <h2 id="pdf-living-title">{first.heading}</h2>
          <p>{first.body[0]}</p>
        </>
      ),
    },
    {
      id: "pdf-versus",
      shot: "pdf-compare",
      align: "right",
      titleId: "pdf-versus-title",
      content: (
        <>
          <h2 id="pdf-versus-title">{page.comparison.heading}</h2>
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
      id: "pdf-dish",
      shot: "pdf-dish",
      align: "left",
      titleId: "pdf-dish-title",
      content: (
        <>
          <h2 id="pdf-dish-title">{second.heading}</h2>
          <p>{second.body[0]}</p>
          <p><strong>{page.takeaway.heading}</strong> {page.takeaway.text}</p>
          <div className="cinematic-actions">
            <Link className="action" href={page.primaryCta.href}>{page.primaryCta.label}</Link>
          </div>
        </>
      ),
    },
  ];
  return (
    <>
      <PreviewNav currentPath={page.path} locale={locale} routeMode="production" />
      <CinematicPage chapters={chapters} scene={{ dish: "huitres", phoneDemo: "maison-elyse", collection: "acrylique" }}>
        <CinematicGuide page={page} />
      </CinematicPage>
    </>
  );
}
