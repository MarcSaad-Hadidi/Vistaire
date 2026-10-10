import Image from "next/image";
import Link from "next/link";
import tableImage from "@/Framer/Photo table.png";
import type { Locale } from "@/lib/i18n";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/seo";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode,
} from "./VistairePreviewChrome";
import { VistaireContactForm } from "./VistaireContactForm";
import styles from "./VistaireRendezVousPreview.module.css";

export function VistaireRendezVousPreview({
  locale = "fr",
  routeMode = "production",
}: {
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const copy =
    locale === "en"
      ? {
          formLabel: "Book a call",
          kicker: "Let’s talk about Vistaire",
          h1: "Let’s talk about your",
          titleAccent: "restaurant.",
          proposition: "Book a call for a Vistaire digital menu.",
          intro:
            "Tell us about your restaurant, your menu and the experience you want to offer.",
          serviceLine: "High-end restaurants · Montreal, Quebec",
          exchangeTitle: "During the call, we review your current menu.",
          exchangeBody:
            "Signature dishes, allergens, visuals, readable prices, PDF replacement and cases where 3D/AR brings real value.",
          photoAlt:
            "An elegantly set restaurant table with glasses, a candle and a Vistaire QR code",
          directContact: "Direct contact",
          back: "Back to contact",
          closing: "A menu designed for your tables.",
        }
      : {
          formLabel: "Prendre rendez-vous",
          kicker: "Parlons de Vistaire",
          h1: "Parlons de votre",
          titleAccent: "restaurant.",
          proposition: "Prendre rendez-vous pour une carte digitale Vistaire.",
          intro:
            "Parlez-nous de votre restaurant, de votre carte et de l'expérience que vous souhaitez offrir.",
          serviceLine: "Restaurants haut de gamme · Montréal, Québec",
          exchangeTitle:
            "Pendant l'échange, nous regardons votre carte actuelle.",
          exchangeBody:
            "Plats signatures, allergènes, visuels, prix lisibles, remplacement PDF et cas où la 3D/AR apporte une vraie valeur.",
          photoAlt:
            "Une table de restaurant élégante avec verres, chandelle et QR code Vistaire",
          directContact: "Contact direct",
          back: "Retour au contact",
          closing: "Une carte pensée pour vos tables.",
        };

  return (
    <main className={styles.page} data-public-vistaire>
      <PreviewNav
        activeSection="contact"
        contactHref={routes.contact}
        currentPath={routes.appointment}
        locale={locale}
        routeMode={routeMode}
      />
      <section
        aria-labelledby="rendez-vous-preview-title"
        className={styles.hero}
        id="rendez-vous-preview"
      >
        <div className={styles.editorial}>
          <p className={styles.kicker}>{copy.kicker}</p>
          <h1 id="rendez-vous-preview-title">
            {copy.h1} <em>{copy.titleAccent}</em>
          </h1>
          <p className={styles.proposition}>{copy.proposition}</p>
          <p className={styles.introText}>{copy.intro}</p>
          <p className={styles.serviceLine}>{copy.serviceLine}</p>
          <div className={styles.imagePanel}>
            <Image
              alt={copy.photoAlt}
              className={styles.imagePanelPhoto}
              fill
              priority
              quality={90}
              sizes="(max-width: 800px) calc(100vw - 40px), 620px"
              src={tableImage}
            />
          </div>
          <div className={styles.directContact} aria-label={copy.directContact}>
            <span>{copy.directContact}</span>
            <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>
            <a href={`tel:${CONTACT_PHONE_TEL}`}>{CONTACT_PHONE_DISPLAY}</a>
          </div>
        </div>
        <section
          className={styles.formPanel}
          aria-labelledby="rendez-vous-form-title"
        >
          <h2 id="rendez-vous-form-title">{copy.formLabel}</h2>
          <VistaireContactForm locale={locale} />
          <Link
            className={styles.backLink}
            href={routes.contact}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
            {copy.back}
          </Link>
        </section>
      </section>
      <section
        aria-labelledby="rendez-vous-exchange-title"
        className={styles.exchangeBlock}
      >
        <h2 id="rendez-vous-exchange-title">{copy.exchangeTitle}</h2>
        <p>{copy.exchangeBody}</p>
      </section>
      <div className={styles.closing}>
        <p>{copy.closing}</p>
      </div>
      <PreviewFooter
        currentPath={routes.appointment}
        locale={locale}
        routeMode={routeMode}
      />
    </main>
  );
}
