import { SeoFaq } from "../seo/SeoFaq";
import { useLandingLocale } from "./locale.jsx";

// Short answers from Vistaire's existing public menu and pricing content.
const QUESTIONS = {
  fr: [
    [
      "Comment mes clients ouvrent-ils le menu ?",
      "Ils scannent le QR code à table. Votre carte s’ouvre sur leur téléphone, avec les catégories et les fiches de vos plats.",
    ],
    [
      "Faut-il télécharger une application ?",
      "Non. Le menu s’ouvre directement dans le navigateur mobile.",
    ],
    [
      "Tous mes plats doivent-ils être en 3D ?",
      "Non. La 3D est réservée aux plats pour lesquels le volume et la présentation apportent quelque chose. Le reste de la carte fonctionne avec vos textes et vos photos.",
    ],
    [
      "Puis-je faire évoluer ma carte ?",
      "Oui. Les outils de gestion Vistaire permettent de modifier les plats, les prix, les descriptions et les catégories. Les possibilités de Pilotage sont détaillées sur la page Tarifs.",
    ],
    [
      "Combien de temps prend la mise en place ?",
      "Généralement environ deux semaines après validation du menu et des maquettes, et réception des éléments nécessaires. Le délai dépend du projet et de la production.",
    ],
  ],
  en: [
    [
      "How do guests open the menu?",
      "They scan the QR code at the table. Your menu opens on their phone, with categories and individual dish pages.",
    ],
    [
      "Do guests need to download an app?",
      "No. The menu opens directly in their mobile browser.",
    ],
    [
      "Does every dish need to be in 3D?",
      "No. 3D is used for dishes where volume and presentation add value. The rest of the menu works with your text and photos.",
    ],
    [
      "Can I update my menu?",
      "Yes. Vistaire’s management tools let you update dishes, prices, descriptions and categories. Pilotage options are explained on the Pricing page.",
    ],
    [
      "How long does setup take?",
      "Usually around two weeks after the menu and mockups are approved and all necessary materials are received. Timing depends on the project and production.",
    ],
  ],
};

export default function LandingFaq() {
  const { locale } = useLandingLocale();
  return (
    <section className="landing-faq" aria-labelledby="landing-faq-title">
      <div className="landing-faq-heading">
        <span className="pricing-eyebrow">FAQ</span>
        <h2 id="landing-faq-title">
          {locale === "en" ? "Your questions." : "Vos questions."}
        </h2>
      </div>
      <SeoFaq
        className="landing-faq-items"
        layout="stack"
        locale={locale}
        faqs={QUESTIONS[locale].map(([question, answer]) => ({
          question,
          answer,
        }))}
      />
    </section>
  );
}

