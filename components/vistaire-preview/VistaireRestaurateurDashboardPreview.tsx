import Image from "next/image";
import Link from "next/link";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import type { Locale } from "@/lib/i18n";
import { RESTAURATEUR_PREVIEW_COPY } from "@/lib/restaurateurPreview/copy";
import { RestaurateurDashboardDemo } from "./RestaurateurDashboardDemo";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

function ArrowIcon() {
  return <svg aria-hidden="true" className={styles.buttonIcon} fill="none" viewBox="0 0 12 12"><path d="M3.1 8.9 8.7 3.3m0 0H4.1m4.6 0v4.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" /></svg>;
}

export function VistaireRestaurateurDashboardPreview({
  demoQrSvg,
  locale = "fr",
  routeMode = "production"
}: {
  demoQrSvg: string;
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const copy = RESTAURATEUR_PREVIEW_COPY[locale];

  return (
    <div className={styles.page}>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        priority
        quality={100}
        sizes="100vw"
        src={restaurantBackground}
        unoptimized
      />
      <div className={styles.backgroundWash} aria-hidden="true" />
      <div className={styles.topNav}>
        <PreviewNav currentPath={routes.restaurateurDashboard} locale={locale} routeMode={routeMode} />
      </div>
      <main className={styles.previewFrame}>
        <section aria-labelledby="restaurateur-dashboard-title" className={`${styles.card} ${styles.hero}`}>
          <p className={styles.introBadge}>{copy.introBadge}</p>
          <h1 id="restaurateur-dashboard-title">{copy.h1}</h1>
          <p className={styles.lead}>{copy.lead}</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href={routes.appointment} prefetch={false}>{copy.appointment}<ArrowIcon /></Link>
            <Link className={styles.secondaryButton} href={routes.menu} prefetch={false}>{copy.sampleMenu}</Link>
          </div>
        </section>
        <section aria-labelledby="demo-data-title" className={`${styles.card} ${styles.dashboardSection}`}>
          <header className={styles.demoDisclosure}>
            <h2 id="demo-data-title">{copy.demoLabel}</h2>
            <p>{copy.demoStatement}</p>
          </header>
          <RestaurateurDashboardDemo locale={locale} />
        </section>
        <section className={styles.afterDemo}>
          <article className={`${styles.card} ${styles.finalCopy}`}>
            <h2>{copy.finalTitle}</h2>
            <p>{copy.finalBody}</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href={routes.appointment} prefetch={false}>{copy.appointment}<ArrowIcon /></Link>
              <Link className={styles.secondaryButton} href={routes.menu} prefetch={false}>{copy.sampleMenu}</Link>
            </div>
          </article>
          <aside className={`${styles.card} ${styles.qrCard}`}>
            <div><p>{copy.qrBadge}</p><h2>{copy.qrTitle}</h2><span>{copy.qrBody}</span></div>
            <span aria-label={copy.qrAria} className={styles.qrMark} dangerouslySetInnerHTML={{ __html: demoQrSvg }} role="img" />
          </aside>
        </section>
      </main>
      <PreviewFooter currentPath={routes.restaurateurDashboard} locale={locale} routeMode={routeMode} width="wide" />
    </div>
  );
}
