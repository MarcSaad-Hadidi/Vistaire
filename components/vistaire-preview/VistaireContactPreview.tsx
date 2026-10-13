import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { CinematicPage, type CinematicChapter } from "@/components/immersive/CinematicPage.jsx";
import { CinematicFooter } from "@/components/immersive/pages/CinematicFooter";
import { SeoFaq } from "@/components/seo/SeoFaq";
import type { Locale } from "@/lib/i18n";
import { buildFaqPageJsonLd, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/seo";
import {
  getVistaireChromeRoutes,
  PreviewNav,
  type VistaireRouteMode,
} from "./VistairePreviewChrome";

const COPY = {
  en: {
    badge: "Vistaire contact",
    title: "Let’s talk about your",
    titleAccent: "restaurant.",
    contactBody: "Tell us about your restaurant, your menu and the experience you want to offer.",
    restaurantBadge: "For restaurants",
    bodyA: "Vistaire turns a restaurant QR code into a premium digital menu that opens on mobile, without an app.",
    bodyB: "We can discuss your menu, dish pages, brand identity, selective 3D/AR and adaptation to your guests.",
    bodyC: "Available for restaurants in the Montreal area.",
    appointment: "Book a call",
    contactTitle: "Contact Vistaire",
    email: "Email",
    company: "Company",
    region: "Region",
    regionValue: "Montreal, Quebec, Canada",
    phone: "Phone",
    closing: "A menu designed for",
    closingAccent: "your tables.",
    explore: "Discover the Vistaire menus",
    faq: [
      { question: "How can I reach Vistaire?", answer: `By email at contact@vistaire.ca or by phone at ${CONTACT_PHONE_DISPLAY}. You can also book a call online.` },
      { question: "What do we discuss in a first call?", answer: "We can discuss your menu, dish pages, brand identity, selective 3D/AR and adaptation to your guests." },
    ],
  },
  fr: {
    badge: "Contact Vistaire",
    title: "Parlons de votre",
    titleAccent: "restaurant.",
    contactBody: "Parlez-nous de votre restaurant, de votre carte et de l'expérience que vous souhaitez offrir.",
    restaurantBadge: "Pour les restaurants",
    bodyA: "Vistaire transforme le QR code d'un restaurant en carte digitale premium consultable sur mobile, sans application.",
    bodyB: "Nous pouvons discuter de votre menu, de vos fiches plats, de votre image de marque, de la 3D/AR sélective et de l'adaptation à votre clientèle.",
    bodyC: "Disponible pour les restaurants de la région de Montréal.",
    appointment: "Prendre rendez-vous",
    contactTitle: "Contacter Vistaire",
    email: "Courriel",
    company: "Entreprise",
    region: "Région",
    regionValue: "Montréal, Québec, Canada",
    phone: "Téléphone",
    closing: "Une carte pensée pour",
    closingAccent: "vos tables.",
    explore: "Découvrir les cartes Vistaire",
    faq: [
      { question: "Comment joindre Vistaire ?", answer: `Par courriel à contact@vistaire.ca ou par téléphone au ${CONTACT_PHONE_DISPLAY}. Vous pouvez aussi prendre rendez-vous en ligne.` },
      { question: "De quoi parle-t-on lors d’un premier échange ?", answer: "Nous pouvons discuter de votre menu, de vos fiches plats, de votre image de marque, de la 3D/AR sélective et de l'adaptation à votre clientèle." },
    ],
  },
} as const;

// Contact page, "let's talk": Trouvable's menu turns toward the guest, then
// rests beside its burger while the restaurant's questions are answered.
export function VistaireContactPreview({
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
      id: "contact-preview",
      shot: "contact-hero",
      titleId: "contact-preview-title",
      content: (
        <>
          <span className="eyebrow">{copy.badge}</span>
          <h1 id="contact-preview-title">{copy.title} <em>{copy.titleAccent}</em></h1>
          <p>{copy.contactBody}</p>
          <dl aria-label={copy.contactTitle} className="cinematic-contact">
            <div><dt>{copy.email}</dt><dd><a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a></dd></div>
            <div><dt>{copy.phone}</dt><dd><a href={`tel:${CONTACT_PHONE_TEL}`}>{CONTACT_PHONE_DISPLAY}</a></dd></div>
            <div><dt>{copy.region}</dt><dd>{copy.regionValue}</dd></div>
            <div><dt>{copy.company}</dt><dd>Vistaire</dd></div>
          </dl>
          <div className="cinematic-actions">
            <Link className="action" href={routes.appointment} prefetch={false}>{copy.appointment}</Link>
          </div>
        </>
      ),
    },
    {
      id: "contact-restaurants",
      shot: "contact-table",
      align: "right",
      titleId: "contact-restaurants-title",
      content: (
        <>
          <span className="eyebrow">{copy.restaurantBadge}</span>
          <h2 id="contact-restaurants-title">{copy.closing} <em>{copy.closingAccent}</em></h2>
          <p>{copy.bodyA}</p>
          <p>{copy.bodyB}</p>
          <p><strong>{copy.bodyC}</strong></p>
          <div className="cinematic-actions">
            <Link className="action" href={routes.appointment} prefetch={false}>{copy.appointment}</Link>
            <Link className="action action-dark" href={routes.menu} prefetch={false}>{copy.explore}</Link>
          </div>
        </>
      ),
    },
  ];
  return (
    <>
      <PreviewNav activeSection="contact" currentPath={routes.contact} locale={locale} routeMode={routeMode} />
      <CinematicPage chapters={chapters} scene={{ dish: "burger", phoneDemo: "trouvable" }} footer={<CinematicFooter locale={locale} id="contact" />}>
        <JsonLd data={buildFaqPageJsonLd([...copy.faq], routes.contact)} />
        <section className="cinematic-guide" aria-label={copy.contactTitle}>
          <section className="landing-faq cinematic-faq" aria-labelledby="contact-faq-title">
            <div className="landing-faq-heading">
              <span className="pricing-eyebrow">FAQ</span>
              <h2 id="contact-faq-title">{locale === "en" ? "Your questions." : "Vos questions."}</h2>
            </div>
            <SeoFaq className="landing-faq-items" layout="stack" locale={locale} faqs={[...copy.faq]} />
          </section>
        </section>
      </CinematicPage>
    </>
  );
}
