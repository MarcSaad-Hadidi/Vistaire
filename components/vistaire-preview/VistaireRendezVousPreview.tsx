import Link from "next/link";
import { CinematicPage, type CinematicChapter } from "@/components/immersive/CinematicPage.jsx";
import { CinematicFooter } from "@/components/immersive/pages/CinematicFooter";
import type { Locale } from "@/lib/i18n";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/seo";
import {
  getVistaireChromeRoutes,
  PreviewNav,
  type VistaireRouteMode,
} from "./VistairePreviewChrome";
import { VistaireContactForm } from "./VistaireContactForm";

const COPY = {
  en: {
    formLabel: "Book a call",
    kicker: "Let’s talk about Vistaire",
    h1: "Let’s talk about your",
    titleAccent: "restaurant.",
    proposition: "Book a call for a Vistaire digital menu.",
    intro: "Tell us about your restaurant, your menu and the experience you want to offer.",
    serviceLine: "High-end restaurants · Montreal, Quebec",
    exchangeTitle: "During the call, we review your current menu.",
    exchangeBody:
      "Signature dishes, allergens, visuals, readable prices, PDF replacement and cases where 3D/AR brings real value.",
    directContact: "Direct contact",
    toForm: "Go to the form",
    back: "Back to contact",
    closing: "A menu designed for your tables.",
  },
  fr: {
    formLabel: "Prendre rendez-vous",
    kicker: "Parlons de Vistaire",
    h1: "Parlons de votre",
    titleAccent: "restaurant.",
    proposition: "Prendre rendez-vous pour une carte digitale Vistaire.",
    intro: "Parlez-nous de votre restaurant, de votre carte et de l'expérience que vous souhaitez offrir.",
    serviceLine: "Restaurants haut de gamme · Montréal, Québec",
    exchangeTitle: "Pendant l'échange, nous regardons votre carte actuelle.",
    exchangeBody:
      "Plats signatures, allergènes, visuels, prix lisibles, remplacement PDF et cas où la 3D/AR apporte une vraie valeur.",
    directContact: "Contact direct",
    toForm: "Aller au formulaire",
    back: "Retour au contact",
    closing: "Une carte pensée pour vos tables.",
  },
} as const;

// Booking page, "around your table": Sauge Noire's Carré stand and its menu,
// then the whole table seen from above, as reviewed during the call. The
// form follows in free reading so it is never pinned or animated.
export function VistaireRendezVousPreview({
  locale = "fr",
  routeMode = "production",
}: {
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const copy = COPY[locale];
  const chapters: CinematicChapter[] = [
    {
      id: "rendez-vous-preview",
      shot: "book-hero",
      titleId: "rendez-vous-preview-title",
      content: (
        <>
          <span className="eyebrow">{copy.kicker}</span>
          <h1 id="rendez-vous-preview-title">{copy.h1} <em>{copy.titleAccent}</em></h1>
          <p><strong>{copy.proposition}</strong></p>
          <p>{copy.intro}</p>
          <p className="cinematic-note">{copy.serviceLine}</p>
          <div className="cinematic-actions">
            <a className="action" href="#rendez-vous-form">{copy.toForm}</a>
          </div>
        </>
      ),
    },
    {
      id: "rendez-vous-echange",
      shot: "book-exchange",
      align: "right",
      titleId: "rendez-vous-exchange-title",
      content: (
        <>
          <h2 id="rendez-vous-exchange-title">{copy.exchangeTitle}</h2>
          <p>{copy.exchangeBody}</p>
          <p><strong>{copy.closing}</strong></p>
          <p className="cinematic-contact-line" aria-label={copy.directContact}>
            <span>{copy.directContact}</span>
            <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>
            <a href={`tel:${CONTACT_PHONE_TEL}`}>{CONTACT_PHONE_DISPLAY}</a>
          </p>
        </>
      ),
    },
  ];
  return (
    <>
      <PreviewNav
        activeSection="contact"
        contactHref={routes.contact}
        currentPath={routes.appointment}
        locale={locale}
        routeMode={routeMode}
      />
      <CinematicPage chapters={chapters} scene={{ dish: "chocolat-fume", phoneDemo: "sauge-noire", collection: "carre" }} footer={<CinematicFooter locale={locale} id="rendez-vous" />}>
        <section className="cinematic-guide">
          <section id="rendez-vous-form" className="cinematic-panel cinematic-form" aria-labelledby="rendez-vous-form-title">
            <h2 id="rendez-vous-form-title">{copy.formLabel}</h2>
            <VistaireContactForm locale={locale} />
            <Link className="cinematic-back" href={routes.contact} prefetch={false}>
              <span aria-hidden="true">←</span> {copy.back}
            </Link>
          </section>
        </section>
      </CinematicPage>
    </>
  );
}
