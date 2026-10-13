import Link from "next/link";
import { CinematicPage, type CinematicChapter } from "../CinematicPage.jsx";
import { PreviewNav } from "@/components/vistaire-preview/VistairePreviewChrome";
import { CinematicGuide } from "./CinematicGuide";
import type { SeoPageData } from "@/lib/seoPages";

// 3D/AR page, "the dish comes alive": a huge turning dish, a walk around the
// plate, the dish landing on the table as in AR, then selective 3D next to the
// stand with the questions restaurants ask first. Copy from the SEO page data.
export function ArMenuCinematic({ page }: { page: SeoPageData }) {
  const locale = page.locale ?? "fr";
  const [first, second] = page.sections;
  const chapters: CinematicChapter[] = [
    {
      id: "ar-introduction",
      shot: "ar-hero",
      align: "left",
      titleId: "ar-title",
      content: (
        <>
          <span className="eyebrow">{page.eyebrow}</span>
          <h1 id="ar-title">{page.h1}</h1>
          <p>{page.answer[0]}</p>
        </>
      ),
    },
    {
      id: "ar-around",
      shot: "ar-orbit",
      align: "center",
      titleId: "ar-around-title",
      content: (
        <>
          <h2 id="ar-around-title">{first.heading}</h2>
          <p>{first.body[0]}</p>
          {first.points && <ul>{first.points.map((point) => <li key={point}>{point}</li>)}</ul>}
        </>
      ),
    },
    {
      id: "ar-table",
      shot: "ar-place",
      align: "right",
      titleId: "ar-table-title",
      content: (
        <>
          <h2 id="ar-table-title">{second.heading}</h2>
          {second.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <p><strong>{page.takeaway.heading}</strong> {page.takeaway.text}</p>
        </>
      ),
    },
    {
      id: "ar-selective",
      shot: "ar-selective",
      align: "left",
      titleId: "ar-selective-title",
      content: (
        <>
          <h2 id="ar-selective-title">{page.faq[0].question}</h2>
          <p>{page.faq[0].answer}</p>
          {page.faq[1] && <p><strong>{page.faq[1].question}</strong> {page.faq[1].answer}</p>}
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
      <CinematicPage chapters={chapters} scene={{ dish: "chocolat-fume", phoneDemo: "sauge-noire", collection: "sculpte" }}>
        <CinematicGuide page={page} />
      </CinematicPage>
    </>
  );
}
