import Image from "next/image";
import Link from "next/link";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import lobsterPlate from "@/Framer/PlatHomard.png";
import pageDigitalPhoto from "@/Framer/PageDigital.png";
import restaurantTable from "@/Framer/Photo table.png";
import type { Locale } from "@/lib/i18n";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

const stats = [
  { label: "Menu actif", value: "12 plats" },
  { label: "QR menu", value: "Prêt" },
  { label: "Photos", value: "10/12" },
  { label: "3D / AR", value: "4 signatures" }
] as const;

const attentionSignals = [
  "Homard bleu attire le plus d'attention au souper.",
  "Deux fiches restent à compléter avant présentation.",
  "Le QR pointe vers la carte client, jamais vers l'admin.",
  "Les plats signatures guident les prochains visuels."
] as const;

const readinessItems = [
  { label: "Carte client", value: "Visible" },
  { label: "Lien public", value: "Stable" },
  { label: "Photos", value: "À compléter" },
  { label: "Immersion", value: "Sélective" }
] as const;

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.buttonIcon}
      fill="none"
      viewBox="0 0 12 12"
    >
      <path
        d="M3.1 8.9 8.7 3.3m0 0H4.1m4.6 0v4.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
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
  const pageStats =
    locale === "en"
      ? [
          { label: "Active menu", value: "12 dishes" },
          { label: "Menu QR", value: "Ready" },
          { label: "Photos", value: "10/12" },
          { label: "3D / AR", value: "4 signatures" }
        ]
      : stats;
  const pageSignals =
    locale === "en"
      ? [
          "Blue lobster draws the most attention at dinner.",
          "Two dish pages remain to complete before presentation.",
          "The QR points to the client menu, never to admin.",
          "Signature dishes guide the next visuals."
        ]
      : attentionSignals;
  const pageReadiness =
    locale === "en"
      ? [
          { label: "Client menu", value: "Visible" },
          { label: "Public link", value: "Stable" },
          { label: "Photos", value: "To complete" },
          { label: "Immersion", value: "Selective" }
        ]
      : readinessItems;
  const copy =
    locale === "en"
      ? {
          badge: "Restaurant preview",
          h1: "The restaurant view stays in service of the menu.",
          lead:
            "Vistaire shows the restaurant what matters after the scan: active menu, table QR, dish pages to complete, dishes that draw attention and readiness before presenting the menu.",
          appointment: "Book a call",
          sampleMenu: "View the sample menu",
          sampleDashboard: "View the sample dashboard",
          dashboardLabel: "Restaurant preview",
          ready: "Public menu ready",
          trackedDish: "Tracked dish",
          qrBadge: "Menu QR code",
          qrTitle: "A restrained QR connected to the public menu.",
          qrBody:
            "This public page shows a simulation. Real QR codes stay generated in the owner cockpit and point to the restaurant menu, not an internal route.",
          qrAria: "Demonstration QR code to the Vistaire sample menu",
          readinessBadge: "Readiness",
          readinessTitle: "What the restaurant understands quickly.",
          whyBadge: "Why it helps",
          whyTitle: "Not a cold SaaS. A living reading of the menu.",
          whyBody:
            "The restaurant preview does not replace service. It helps keep the menu beautiful, complete and presentable, with simple actions instead of a wall of charts."
        }
      : {
          badge: "Aperçu restaurateur",
          h1: "Le tableau de bord reste au service de la carte.",
          lead:
            "Vistaire montre au restaurateur ce qui compte vraiment après le scan : menu actif, QR de table, fiches à compléter, plats qui attirent l'oeil et readiness avant de présenter la carte.",
          appointment: "Prendre rendez-vous",
          sampleMenu: "Voir la carte exemple",
          sampleDashboard: "Regarder le dashboard exemple",
          dashboardLabel: "Aperçu dashboard",
          ready: "Menu public prêt",
          trackedDish: "Plat suivi",
          qrBadge: "QR code du menu",
          qrTitle: "Un QR sobre, relié à la carte publique.",
          qrBody:
            "La page publique montre une simulation. Les vrais QR restent générés dans le cockpit owner et pointent vers le menu du restaurant, pas vers une route interne.",
          qrAria: "QR code démonstratif vers la carte exemple Vistaire",
          readinessBadge: "Readiness",
          readinessTitle: "Ce que le restaurant comprend vite.",
          whyBadge: "Pourquoi ça aide",
          whyTitle: "Pas un SaaS froid. Une lecture vivante de la carte.",
          whyBody:
            "Le dashboard restaurateur ne remplace pas le service. Il aide a garder la carte belle, complète et présentable, avec des actions simples plutôt qu'un mur de graphes."
        };

  return (
    <main className={styles.page}>
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

      <div className={styles.topNav}>
        <PreviewNav
          currentPath={routes.restaurateurDashboard}
          locale={locale}
          routeMode={routeMode}
        />
      </div>

      <section
        aria-labelledby="restaurateur-dashboard-title"
        className={styles.hero}
      >
        <div className={styles.previewFrame}>
          <section className={`${styles.card} ${styles.heroPanel}`}>
            <div className={styles.heroCopy}>
              <p className={styles.badge}>{copy.badge}</p>
              <h1 id="restaurateur-dashboard-title">{copy.h1}</h1>
              <p className={styles.heroLead}>{copy.lead}</p>
              <div className={styles.heroActions}>
                <Link
                  className={styles.primaryButton}
                  href={routes.appointment}
                  prefetch={false}
                >
                  {copy.appointment}
                  <ArrowIcon />
                </Link>
                <Link
                  className={styles.secondaryButton}
                  href={routes.menu}
                  prefetch={false}
                >
                  {copy.sampleMenu}
                </Link>
                <Link
                  className={styles.secondaryButton}
                  href="/admin"
                  prefetch={false}
                >
                  {copy.sampleDashboard}
                </Link>
              </div>
            </div>

            <div className={styles.dashboardShell} aria-label={copy.dashboardLabel}>
              <div className={styles.dashboardTopline}>
                <span>Maison Élyse</span>
                <span>{copy.ready}</span>
              </div>
              <div className={styles.statsGrid}>
                {pageStats.map((stat) => (
                  <article key={stat.label}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </article>
                ))}
              </div>
              <div className={styles.dashboardBody}>
                <div className={styles.signatureDish}>
                  <Image
                    alt="Plat signature homard Vistaire"
                    fill
                    quality={100}
                    sizes="260px"
                    src={lobsterPlate}
                    unoptimized
                  />
                  <div>
                    <span>{copy.trackedDish}</span>
                    <strong>Homard bleu</strong>
                  </div>
                </div>
                <div className={styles.signalList}>
                  {pageSignals.map((signal) => (
                    <p key={signal}>{signal}</p>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.qrPanel}`}>
            <div className={styles.qrCopy}>
              <p className={styles.badge}>{copy.qrBadge}</p>
              <h2>{copy.qrTitle}</h2>
              <p>{copy.qrBody}</p>
            </div>
            <div className={styles.qrMark}>
              <span
                aria-label={copy.qrAria}
                role="img"
                dangerouslySetInnerHTML={{ __html: demoQrSvg }}
              />
            </div>
          </section>

          <section className={`${styles.card} ${styles.mobilePanel}`}>
            <figure className={styles.phonePreview}>
              <Image
                alt="Aperçu mobile d'une carte Vistaire"
                fill
                quality={100}
                sizes="(max-width: 920px) 100vw, 360px"
                src={pageDigitalPhoto}
                unoptimized
              />
            </figure>
            <div className={styles.readinessPanel}>
              <p className={styles.badge}>{copy.readinessBadge}</p>
              <h2>{copy.readinessTitle}</h2>
              <div className={styles.readinessGrid}>
                {pageReadiness.map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.finalPanel}`}>
            <div>
              <p className={styles.badge}>{copy.whyBadge}</p>
              <h2>{copy.whyTitle}</h2>
              <p>{copy.whyBody}</p>
            </div>
            <figure className={styles.tableImage}>
              <Image
                alt="Table de restaurant haut de gamme"
                fill
                quality={100}
                sizes="(max-width: 920px) 100vw, 420px"
                src={restaurantTable}
                unoptimized
              />
            </figure>
          </section>
        </div>
      </section>

      <PreviewFooter
        currentPath={routes.restaurateurDashboard}
        locale={locale}
        routeMode={routeMode}
        width="wide"
      />
    </main>
  );
}
