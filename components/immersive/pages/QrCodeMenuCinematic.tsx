import Link from "next/link";
import { CinematicPage, type CinematicChapter } from "../CinematicPage.jsx";
import { PreviewNav } from "@/components/vistaire-preview/VistairePreviewChrome";
import { CinematicFooter } from "./CinematicFooter";
import { CinematicGuide } from "./CinematicGuide";
import type { SeoPageData } from "@/lib/seoPages";

// QR code menu page: the stand, the scan, the menu that opens, the dish it
// leads to, then the collection. Every word comes from the SEO page data.
export function QrCodeMenuCinematic({ page }: { page: SeoPageData }) {
  const locale = page.locale ?? "fr";
  const [scan, premium] = page.sections;
  const chapters: CinematicChapter[] = [
    {
      id: "qr-introduction",
      shot: "qr-hero",
      align: "left",
      titleId: "qr-title",
      content: (
        <>
          <span className="eyebrow">{page.eyebrow}</span>
          <h1 id="qr-title">{page.h1}</h1>
          <p>{page.answer[0]}</p>
          <div className="cinematic-actions">
            <Link className="action" href={page.primaryCta.href}>{page.primaryCta.label}</Link>
            {page.secondaryCta && <Link className="action action-dark" href={page.secondaryCta.href}>{page.secondaryCta.label}</Link>}
          </div>
        </>
      ),
    },
    {
      id: "qr-scan",
      shot: "qr-scan",
      align: "right",
      titleId: "qr-scan-title",
      content: (
        <>
          <span className="eyebrow">01</span>
          <h2 id="qr-scan-title">{scan.heading}</h2>
          <p>{scan.body[0]}</p>
          {scan.points && <ul>{scan.points.map((point) => <li key={point}>{point}</li>)}</ul>}
        </>
      ),
    },
    {
      id: "qr-menu",
      shot: "wearable",
      align: "left",
      titleId: "qr-menu-title",
      content: (
        <>
          <span className="eyebrow">02</span>
          <h2 id="qr-menu-title">{premium.heading}</h2>
          <p>{premium.body[0]}</p>
        </>
      ),
    },
    {
      id: "qr-dish",
      shot: "grip",
      align: "right",
      titleId: "qr-dish-title",
      content: (
        <>
          <span className="eyebrow">03</span>
          <h2 id="qr-dish-title">{page.takeaway.heading}</h2>
          <p>{page.takeaway.text}</p>
          <p>{page.answer[1]}</p>
        </>
      ),
    },
    {
      id: "qr-collection",
      shot: "product",
      align: "center",
      titleId: "qr-collection-title",
      content: (
        <>
          <h2 id="qr-collection-title">{page.service.name}</h2>
          {premium.body[1] && <p>{premium.body[1]}</p>}
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
      <CinematicPage chapters={chapters} scene={{ dish: "huitres", phoneDemo: "sauge-noire", collection: "signature" }} footer={<CinematicFooter locale={locale} id={page.slug} />}>
        <CinematicGuide page={page} />
      </CinematicPage>
    </>
  );
}
