import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { CinematicPage, type CinematicChapter } from "@/components/immersive/CinematicPage.jsx";
import { CinematicFooter } from "@/components/immersive/pages/CinematicFooter";
import { SeoFaq } from "@/components/seo/SeoFaq";
import type { Locale } from "@/lib/i18n";
import { buildFaqPageJsonLd } from "@/lib/seo";
import {
  getVistaireChromeRoutes,
  PreviewNav,
  type VistaireRouteMode,
} from "./VistairePreviewChrome";

const COPY = {
  en: {
    badge: "About Vistaire",
    title: "Digital should extend the restaurant",
    titleAccent: "experience.",
    proposition: "Vistaire turns the restaurant QR code into a premium digital menu.",
    intro:
      "Vistaire helps high-end restaurants present their menu in an elegant mobile experience: clear navigation, visual dish pages, allergens, prices and selective 3D/AR.",
    appointment: "Book a call",
    discover: "Discover Vistaire",
    visionBadge: "Our vision",
    visionTitle: "A Montreal studio dedicated to high-end restaurants",
    visionA:
      "Digital should extend the restaurant experience, not replace it. Vistaire keeps the dish at the center: a clear, visual, mobile-first menu designed to create desire without turning the dining room into a cold app.",
    visionB:
      "Vistaire supports restaurants in Montreal, Quebec and Canada that want to present their menu on mobile without losing the elegance of the room.",
    serviceTitle: "Built for table service.",
    values: [
      { title: "Mobile-first", body: "A clear, visual menu designed for your guests’ phones." },
      { title: "Selective 3D", body: "Dishes presented in detail, wherever 3D/AR brings real value." },
      { title: "No app", body: "Your menu opens directly from the table QR code." },
    ],
    closing: "Your cuisine. Your world.",
    closingAccent: "Another dimension.",
    explore: "Explore the menus",
    faq: [
      { question: "What is Vistaire?", answer: "Vistaire turns the restaurant QR code into a premium digital menu. It helps high-end restaurants present their menu in an elegant mobile experience: clear navigation, visual dish pages, allergens, prices and selective 3D/AR." },
      { question: "Where is Vistaire based?", answer: "Vistaire is a Montreal studio dedicated to high-end restaurants. It supports restaurants in Montreal, Quebec and Canada that want to present their menu on mobile without losing the elegance of the room." },
      { question: "Do guests need to install an app?", answer: "No. The menu opens directly from the table QR code, in the guest’s phone browser." },
      { question: "Is every dish shown in 3D?", answer: "No. 3D/AR is selective: it is used for the dishes where it brings real value, while every dish keeps a clear, visual page." },
    ],
  },
  fr: {
    badge: "À propos de Vistaire",
    title: "Le digital doit prolonger l’expérience du",
    titleAccent: "restaurant.",
    proposition: "Vistaire transforme le QR code restaurant en carte digitale premium.",
    intro:
      "Vistaire aide les restaurants haut de gamme à présenter leur carte dans une expérience mobile élégante : menu clair, fiches plats visuelles, allergènes, prix et 3D/AR sélective.",
    appointment: "Prendre rendez-vous",
    discover: "Découvrir Vistaire",
    visionBadge: "Notre vision",
    visionTitle: "Une maison montréalaise dédiée aux restaurants haut de gamme",
    visionA:
      "Le digital doit prolonger l'expérience du restaurant, pas la remplacer. Vistaire garde le plat au centre : une carte claire, visuelle et mobile-first, conçue pour donner envie sans transformer la salle en application froide.",
    visionB:
      "Vistaire accompagne les restaurants de Montréal, du Québec et du Canada qui veulent présenter leur carte sur mobile sans perdre l'élégance de la salle.",
    serviceTitle: "Pensée pour le service à table.",
    values: [
      { title: "Mobile-first", body: "Une carte claire et visuelle, pensée pour le téléphone de vos clients." },
      { title: "3D sélective", body: "Des plats mis en valeur avec justesse, quand la 3D/AR apporte une vraie valeur." },
      { title: "Sans application", body: "Votre carte s’ouvre directement depuis le QR code de la table." },
    ],
    closing: "Votre cuisine. Votre univers.",
    closingAccent: "Une autre dimension.",
    explore: "Explorer les cartes",
    faq: [
      { question: "Qu’est-ce que Vistaire ?", answer: "Vistaire transforme le QR code restaurant en carte digitale premium. Vistaire aide les restaurants haut de gamme à présenter leur carte dans une expérience mobile élégante : menu clair, fiches plats visuelles, allergènes, prix et 3D/AR sélective." },
      { question: "Où se trouve Vistaire ?", answer: "Vistaire est une maison montréalaise dédiée aux restaurants haut de gamme. Elle accompagne les restaurants de Montréal, du Québec et du Canada qui veulent présenter leur carte sur mobile sans perdre l'élégance de la salle." },
      { question: "Le client doit-il installer une application ?", answer: "Non. La carte s’ouvre directement depuis le QR code de la table, dans le navigateur du téléphone." },
      { question: "Tous les plats sont-ils en 3D ?", answer: "Non. La 3D/AR est sélective : elle sert les plats où elle apporte une vraie valeur, et chaque plat garde une fiche claire et visuelle." },
    ],
  },
} as const;

// About page, "a Montreal house for restaurants": the room seen from afar,
// the plate up close, the three values side by side, the table from above.
export function VistaireAboutPreview({
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
      id: "a-propos",
      shot: "about-room",
      titleId: "about-preview-title",
      content: (
        <>
          <span className="eyebrow">{copy.badge}</span>
          <h1 id="about-preview-title">{copy.title} <em>{copy.titleAccent}</em></h1>
          <p><strong>{copy.proposition}</strong></p>
          <p>{copy.intro}</p>
          <div className="cinematic-actions">
            <Link className="action" href={routes.appointment} prefetch={false}>{copy.appointment}</Link>
            <Link className="action action-dark" href="#vision" prefetch={false}>{copy.discover}</Link>
          </div>
        </>
      ),
    },
    {
      id: "vision",
      shot: "about-vision",
      align: "right",
      titleId: "about-vision-title",
      content: (
        <>
          <span className="eyebrow">{copy.visionBadge}</span>
          <h2 id="about-vision-title">{copy.visionTitle}</h2>
          <p>{copy.visionA}</p>
          <p>{copy.visionB}</p>
        </>
      ),
    },
    {
      id: "service",
      shot: "about-values",
      align: "center",
      titleId: "about-service-title",
      content: (
        <>
          <h2 id="about-service-title">{copy.serviceTitle}</h2>
          <dl className="cinematic-values">
            {copy.values.map((value, index) => (
              <div key={value.title}>
                <dt><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{value.title}</dt>
                <dd>{value.body}</dd>
              </div>
            ))}
          </dl>
        </>
      ),
    },
    {
      id: "univers",
      shot: "about-closing",
      titleId: "about-closing-title",
      content: (
        <>
          <h2 id="about-closing-title">{copy.closing}<br /><em>{copy.closingAccent}</em></h2>
          <div className="cinematic-actions">
            <Link className="action" href={routes.menu} prefetch={false}>{copy.explore}</Link>
            <Link className="action action-dark" href={routes.appointment} prefetch={false}>{copy.appointment}</Link>
          </div>
        </>
      ),
    },
  ];
  return (
    <>
      <PreviewNav activeSection="about" currentPath={routes.about} locale={locale} routeMode={routeMode} />
      <CinematicPage chapters={chapters} scene={{ dish: "huitres", phoneDemo: "sauge-noire", collection: "acrylique" }} footer={<CinematicFooter locale={locale} id="about" />}>
        <JsonLd data={buildFaqPageJsonLd([...copy.faq], routes.about)} />
        <section className="cinematic-guide" aria-label={copy.badge}>
          <section className="landing-faq cinematic-faq" aria-labelledby="about-faq-title">
            <div className="landing-faq-heading">
              <span className="pricing-eyebrow">FAQ</span>
              <h2 id="about-faq-title">{locale === "en" ? "Your questions." : "Vos questions."}</h2>
            </div>
            <SeoFaq className="landing-faq-items" layout="stack" locale={locale} faqs={[...copy.faq]} />
          </section>
        </section>
      </CinematicPage>
    </>
  );
}
