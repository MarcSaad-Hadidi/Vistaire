import Link from "next/link";
import { CinematicPage, type CinematicChapter } from "@/components/immersive/CinematicPage.jsx";
import { CinematicFooter } from "@/components/immersive/pages/CinematicFooter";
import type { Locale } from "@/lib/i18n";
import { RESTAURATEUR_PREVIEW_COPY } from "@/lib/restaurateurPreview/copy";
import { DashboardWalkthrough } from "./DashboardWalkthrough";
import {
  getVistaireChromeRoutes,
  PreviewNav,
  type VistaireRouteMode,
} from "./VistairePreviewChrome";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

// Restaurant preview, "the other side of the table": the laptop opens on the
// Studio, turns toward the reader, then sits beside the QR stand guests scan.
// The recorded walkthrough and the sample-menu QR follow in free reading.
export function VistaireRestaurateurDashboardPreview({
  demoQrSvg,
  locale = "fr",
  routeMode = "production",
}: {
  demoQrSvg: string;
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const copy = RESTAURATEUR_PREVIEW_COPY[locale];
  const actions = (
    <div className="cinematic-actions">
      <Link className="action" href={routes.appointment} prefetch={false}>{copy.appointment}</Link>
      <Link className="action action-dark" href={routes.menu} prefetch={false}>{copy.sampleMenu}</Link>
    </div>
  );
  const chapters: CinematicChapter[] = [
    {
      id: "apercu-studio",
      shot: "apercu-laptop",
      titleId: "restaurateur-dashboard-title",
      // Closed at arrival; the lid opens with the scroll, as on the landing.
      laptopLid: [0, 1],
      content: (
        <>
          <span className="eyebrow">{copy.introBadge}</span>
          <h1 id="restaurateur-dashboard-title">{copy.h1}</h1>
          <p>{copy.lead}</p>
          {actions}
        </>
      ),
    },
    {
      id: "apercu-donnees",
      shot: "apercu-dashboard",
      align: "right",
      titleId: "apercu-demo-title",
      content: (
        <>
          <h2 id="apercu-demo-title">{copy.demoLabel}</h2>
          <p>{copy.screenStatement}</p>
        </>
      ),
    },
    {
      id: "apercu-service",
      shot: "apercu-qr",
      titleId: "apercu-final-title",
      content: (
        <>
          <h2 id="apercu-final-title">{copy.finalTitle}</h2>
          <p>{copy.finalBody}</p>
          {actions}
        </>
      ),
    },
  ];
  return (
    <>
      <PreviewNav currentPath={routes.restaurateurDashboard} locale={locale} routeMode={routeMode} />
      <CinematicPage
        chapters={chapters}
        scene={{ dish: "huitres", phoneDemo: "sauge-noire", collection: "acrylique" }}
        footer={<CinematicFooter locale={locale} id="apercu" />}
      >
        <section className="cinematic-guide" aria-labelledby="demo-data-title">
          <section className="cinematic-panel">
            <h2 id="demo-data-title">{copy.demoLabel}</h2>
            <DashboardWalkthrough locale={locale} />
            <p>{copy.demoStatement}</p>
          </section>
          <aside className={`cinematic-panel ${styles.qrCard}`}>
            <div>
              <p>{copy.qrBadge}</p>
              <h2>{copy.qrTitle}</h2>
              <span>{copy.qrBody}</span>
            </div>
            <span
              aria-label={copy.qrAria}
              className={styles.qrMark}
              dangerouslySetInnerHTML={{ __html: demoQrSvg }}
              role="img"
            />
          </aside>
        </section>
      </CinematicPage>
    </>
  );
}
