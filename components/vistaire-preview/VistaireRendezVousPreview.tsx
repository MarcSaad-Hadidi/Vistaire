import Image from "next/image";
import Link from "next/link";
import appointmentBackground from "@/Framer/PhotoRestoComplet.png";
import tableImage from "@/Framer/Photo table.png";
import type { Locale } from "@/lib/i18n";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/seo";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import { VistaireContactForm } from "./VistaireContactForm";
import styles from "./VistaireRendezVousPreview.module.css";

export function VistaireRendezVousPreview({
  locale = "fr",
  routeMode = "production"
}: {
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const copy =
    locale === "en"
      ? {
          formLabel: "Book a call",
          kicker: "Let's talk about Vistaire",
          h1: "Book a call for a Vistaire digital menu",
          intro:
            "Send your request using this form. The Vistaire team will contact you to discuss your project and agree on a time to talk.",
          serviceLine: "High-end restaurants · Montreal, Quebec",
          exchangeTitle: "During the call, we review your current menu.",
          exchangeBody:
            "Signature dishes, allergens, visuals, readable prices, PDF replacement and cases where 3D/AR brings real value.",
          directContact: "Direct contact",
          back: "Back to contact"
        }
      : {
          formLabel: "Prendre rendez-vous",
          kicker: "Parlons de Vistaire",
          h1: "Prendre rendez-vous pour une carte digitale Vistaire",
          intro:
            "Envoyez votre demande avec ce formulaire. L’équipe Vistaire vous recontactera pour discuter du projet et convenir d’un moment pour l’échange.",
          serviceLine: "Restaurants haut de gamme · Montréal, Québec",
          exchangeTitle:
            "Pendant l'échange, nous regardons votre carte actuelle.",
          exchangeBody:
            "Plats signatures, allergènes, visuels, prix lisibles, remplacement PDF et cas où la 3D/AR apporte une vraie valeur.",
          directContact: "Contact direct",
          back: "Retour au contact"
        };

  return (
    <main className={styles.page}>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        priority
        quality={90}
        sizes="100vw"
        src={appointmentBackground}
      />

      <section
        aria-labelledby="rendez-vous-preview-title"
        className={styles.hero}
        id="rendez-vous-preview"
      >
        <div className={styles.previewFrame}>
          <article className={styles.imagePanel}>
            <Image
              alt={locale === "en"
                ? "Restaurant table with glasses, a candle and a Vistaire QR display"
                : "Table de restaurant avec verres, chandelle et support QR Vistaire"}
              className={styles.imagePanelPhoto}
              fill
              priority
              quality={90}
              sizes="(max-width: 920px) calc(100vw - 36px), 490px"
              src={tableImage}
            />
            <div aria-hidden="true" className={styles.imagePanelShade} />
          </article>
          <section className={styles.formPanel} aria-label={copy.formLabel}>
            <div aria-hidden="true" className={styles.formPanelShade} />
            <div className={styles.formContent}>
              <p className={styles.kicker}>{copy.kicker}</p>
              <h1 id="rendez-vous-preview-title">{copy.h1}</h1>
              <p className={styles.introText}>{copy.intro}</p>
              <p className={styles.serviceLine}>{copy.serviceLine}</p>
              <section
                aria-labelledby="rendez-vous-exchange-title"
                className={styles.exchangeBlock}
              >
                <h2 id="rendez-vous-exchange-title">{copy.exchangeTitle}</h2>
                <p>{copy.exchangeBody}</p>
              </section>

              <VistaireContactForm locale={locale} />

              <div className={styles.directContact} aria-label={copy.directContact}>
                <span>{copy.directContact}</span>
                <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>
                <a href={`tel:${CONTACT_PHONE_TEL}`}>{CONTACT_PHONE_DISPLAY}</a>
              </div>
              <Link
                className={styles.backLink}
                href={routes.contact}
                prefetch={false}
              >
                {copy.back}
              </Link>
            </div>
          </section>
        </div>

        <PreviewNav
          activeSection="contact"
          contactHref={routes.contact}
          currentPath={routes.appointment}
          locale={locale}
          routeMode={routeMode}
        />
      </section>

      <PreviewFooter
        currentPath={routes.appointment}
        locale={locale}
        routeMode={routeMode}
      />
    </main>
  );
}
