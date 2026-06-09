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
  routeMode = "preview"
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
            "Tell us about your restaurant, your menu and the experience you want to offer.",
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
            "Parlez-nous de votre restaurant, de votre carte et de l'expérience que vous souhaitez offrir.",
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
        quality={100}
        sizes="100vw"
        src={appointmentBackground}
        unoptimized
      />

      <section
        aria-labelledby="rendez-vous-preview-title"
        className={styles.hero}
        id="rendez-vous-preview"
      >
        <div className={styles.previewFrame}>
          <article className={styles.imagePanel}>
            <Image
              alt="Table de restaurant haut de gamme avec verres, chandelle et QR code Vistaire"
              className={styles.imagePanelPhoto}
              fill
              priority
              quality={100}
              sizes="(max-width: 920px) calc(100vw - 36px), 490px"
              src={tableImage}
              unoptimized
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

              <div className={styles.directContact} aria-label="Contact direct">
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
