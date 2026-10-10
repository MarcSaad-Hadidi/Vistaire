import { useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Plus } from "lucide-react";
import "./pricing.css";
import { useLandingLocale } from "./locale.jsx";
import { FaqAsk } from "../seo/FaqAsk";

// Verified against Vistaire's pricingPage.ts. Physical supports beyond the
// included quantity are quoted individually; no per-support rate is assumed.
const COLLECTIONS = [
  {
    id: "acrylique",
    name: "Acrylique",
    amount: 2000,
    description: "Acrylique transparent, base en bois.",
    image: "support-acrylique",
  },
  {
    id: "sculpte",
    name: "Sculpté",
    amount: 2050,
    description: "Bois sculpté, coin supérieur arrondi.",
    image: "support-sculpte",
  },
  {
    id: "carre",
    name: "Carré",
    amount: 2100,
    description: "Format compact en bois, plusieurs finitions.",
    image: "support-carre",
  },
  {
    id: "signature",
    name: "Signature",
    amount: 2200,
    description: "Bois premium, insert QR noir amovible.",
    image: "support-signature",
  },
];
const INCLUDED = [
  {
    title: "Votre menu digital",
    items: [
      "Menu personnalisé à l’identité du restaurant",
      "Intégration de votre carte",
      "Expérience mobile optimisée",
      "Plusieurs langues et devises",
    ],
  },
  {
    title: "Sur vos tables",
    items: [
      "Jusqu’à 20 supports QR personnalisés",
      "QR code personnalisé",
      "Jusqu’à 5 plats en 3D",
      "Expériences 3D / AR lorsque disponibles",
    ],
  },
  {
    title: "À vos côtés",
    items: [
      "Photographie des plats sur place par Vistaire",
      "Configuration initiale et mise en place",
      "Hébergement et maintenance",
      "Accompagnement Vistaire",
    ],
  },
];
const PACKS = [
  { quantity: 5, amount: 149 },
  { quantity: 10, amount: 249 },
  { quantity: 20, amount: 449 },
];
const STEPS = [
  ["Préparer", "Photographie sur place et collecte des éléments du projet."],
  ["Créer", "Maquettes du menu digital et des supports personnalisés."],
  ["Valider", "Votre restaurant approuve les maquettes avant production."],
  ["Produire", "Fabrication des supports et finalisation du menu."],
  ["Activer", "Mise en ligne du menu et démarrage du service."],
];
const FAQ = [
  {
    question: "Pourquoi les prix sont-ils indiqués « à partir de » ?",
    answer:
      "Le montant final tient compte de la taille et du nombre de menus, des plats, du contenu à préparer, des expériences 3D, des établissements, des supports et de la complexité du projet. Nous confirmons votre estimation avant le lancement.",
  },
  {
    question: "Et si j’ai besoin de plus de 20 supports ?",
    answer:
      "Les supports supplémentaires ou de remplacement font l’objet d’une estimation selon la collection et votre besoin. Aucun tarif unitaire supplémentaire n’est présumé.",
  },
  {
    question:
      "Un nouveau plat remplace-t-il gratuitement un ancien modèle 3D ?",
    answer:
      "Un nouveau plat nécessitant une nouvelle production 3D est facturé séparément, même s’il remplace un ancien plat. Une correction d’un modèle défectueux imputable à Vistaire n’est pas considérée comme une nouvelle production.",
  },
  {
    question: "Que permet l’option Pilotage ?",
    answer:
      "Le dashboard permet de gérer les disponibilités, répercutées sur la carte après validation, et de suivre les ouvertures du menu, les plats consultés par catégorie et les interactions 3D / AR. Les recherches sont anonymisées lorsque l’échantillon est suffisant. Les périodes Aujourd’hui, 7 jours et 30 jours se comparent à la période précédente ; les plages horaires d’activité sont en UTC. Les données dépendent de l’activité enregistrée et respectent les seuils de confidentialité du produit.",
  },
  {
    question: "Quand mon abonnement commence-t-il ?",
    answer:
      "La facturation mensuelle commence à l’activation du service. L’engagement initial est de 12 mois et le tarif mensuel convenu reste fixe sur cette période. Les conditions de la période suivante sont établies et communiquées au renouvellement.",
  },
  {
    question: "Quel délai prévoir pour la mise en place ?",
    answer:
      "Généralement environ deux semaines après validation du menu et des maquettes des supports, et réception de tous les éléments nécessaires. Ce délai peut varier selon la complexité du projet et les délais de production.",
  },
];
function EstimateAction({ onEstimate, estimate, children }) {
  const { href } = useLandingLocale();
  const className = "pricing-cta";
  return onEstimate ? (
    <button
      type="button"
      className={className}
      onClick={() => onEstimate(estimate)}
    >
      {children}
      <ArrowUpRight size={17} aria-hidden="true" />
    </button>
  ) : (
    <a
      className={className}
      href={href("/prendre-rendez-vous")}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  );
}

export default function Pricing({ collection, setCollection, onEstimate }) {
  const { t, locale, currency } = useLandingLocale();
  const [pilotage, setPilotage] = useState(false);
  const selected =
    COLLECTIONS.find((item) => item.id === collection) || COLLECTIONS[0];
  const monthlyAmount = pilotage ? 300 : 200;
  const estimate = {
    collection: selected.id,
    pilotage,
    setupAmount: selected.amount,
    monthlyAmount,
  };

  return (
    <div className="pricing-content">
      <header className="pricing-heading">
        <span className="pricing-eyebrow">
          {t("L’offre Vistaire · Tarifs")}
        </span>
        <h2 id="open-weight-title">
          {t("Votre collection.")}
          <br />
          <em>{t("L’essentiel compris.")}</em>
        </h2>
        <p>
          {t(
            "Quatre collections, une même expérience digitale et le même accompagnement. Choisissez la présence qui s’accorde à votre lieu.",
          )}
        </p>
      </header>

      <div
        className="pricing-collections"
        role="group"
        aria-label={t("Choisir la collection pour votre offre Vistaire")}
      >
        {COLLECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`pricing-collection ${selected.id === item.id ? "is-selected" : ""}`}
            aria-pressed={selected.id === item.id}
            onClick={() => setCollection(item.id)}
          >
            <span className="pricing-collection-image">
              <img
                src={`/immersive-assets/${item.image}.webp`}
                alt={
                  locale === "en"
                    ? `Vistaire ${item.name} stand`
                    : `Support Vistaire ${item.name}`
                }
                loading="eager"
                decoding="async"
                fetchPriority="low"
                width="480"
                height="360"
              />
              <span className="pricing-collection-check" aria-hidden="true">
                <Check size={15} />
              </span>
            </span>
            <span className="pricing-collection-name">{item.name}</span>
            <span className="pricing-collection-description">
              {t(item.description)}
            </span>
            <span className="pricing-collection-price">
              <span>{t("À partir de")}</span> {currency(item.amount)}
            </span>
          </button>
        ))}
      </div>

      <div className="pricing-summary">
        <div className="pricing-rate">
          <span className="pricing-eyebrow">
            {t("Mise en place ·")} {selected.name}
          </span>
          <output className="pricing-amount" aria-live="polite">
            <small>{t("À partir de")}</small>
            <span>{currency(selected.amount)}</span>
          </output>
          <p>{t("Une seule fois, avant le début du projet.")}</p>
        </div>
        <div className="pricing-rate">
          <span className="pricing-eyebrow">{t("Votre service mensuel")}</span>
          <output className="pricing-amount" aria-live="polite">
            <small>{pilotage ? "Vistaire + Pilotage" : "Vistaire"}</small>
            <span>
              {currency(monthlyAmount)} <small>{t("/ mois")}</small>
            </span>
          </output>
          <p>{t("À l’activation du service. Engagement de 12 mois.")}</p>
        </div>
        <div className="pricing-summary-action">
          <EstimateAction onEstimate={onEstimate} estimate={estimate}>
            {t("Composer votre expérience")}
          </EstimateAction>
          <span>{t("Prix en CAD · Taxes en sus")}</span>
        </div>
      </div>

      <section
        className="pricing-block"
        aria-labelledby="pricing-included-title"
      >
        <div className="pricing-block-heading">
          <span className="pricing-eyebrow">
            {t("01 · L’offre, au complet")}
          </span>
          <h3 id="pricing-included-title">{t("Tout commence ici.")}</h3>
          <p>
            {t(
              "Les services inclus restent les mêmes. La différence de prix vient principalement du support physique et de son positionnement.",
            )}
          </p>
        </div>
        <div className="pricing-included">
          {INCLUDED.map((group, index) => (
            <article key={group.title}>
              <span className="pricing-index">0{index + 1}</span>
              <h4>{t(group.title)}</h4>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>
                    <Check size={15} aria-hidden="true" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section
        className="pricing-block"
        aria-labelledby="pricing-options-title"
      >
        <div className="pricing-block-heading">
          <span className="pricing-eyebrow">{t("02 · Selon vos besoins")}</span>
          <h3 id="pricing-options-title">{t("Une carte qui peut évoluer.")}</h3>
        </div>
        <div className="pricing-options">
          <article className="pricing-pilotage">
            <div className="pricing-option-heading">
              <div>
                <span className="pricing-eyebrow">
                  Option · Vistaire Pilotage
                </span>
                <h4>{t("Prenez le contrôle.")}</h4>
              </div>
              <span className="pricing-option-price">
                {t("+ 100 $")} <small>{t("/ mois")}</small>
              </span>
            </div>
            <p>
              {t(
                "Votre dashboard pour gérer les disponibilités après validation et analyser l’expérience de vos clients.",
              )}
            </p>
            <ul className="pricing-pilotage-features">
              <li>{t("Disponibilités des plats")}</li>
              <li>{t("Ouvertures et consultations du menu")}</li>
              <li>Interactions 3D / AR</li>
              <li>{t("Comparaison des périodes d’activité")}</li>
            </ul>
            <label className="pricing-toggle">
              <span>
                <strong>{t("Ajouter Pilotage")}</strong>
                <small>{t("200 $ + 100 $ = 300 $ CAD / mois")}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={pilotage}
                onChange={(event) => setPilotage(event.target.checked)}
                aria-label={t(
                  "Ajouter Vistaire Pilotage pour 100 CAD par mois",
                )}
              />
            </label>
            <small className="pricing-note">
              {t(
                "Les données dépendent de l’activité enregistrée et des seuils de confidentialité. Détails dans les questions ci-dessous.",
              )}
            </small>
          </article>
          <article className="pricing-productions">
            <span className="pricing-eyebrow">
              {t("Productions 3D supplémentaires")}
            </span>
            <h4>{t("De nouvelles envies, en volume.")}</h4>
            <p>
              {t(
                "Au-delà des 5 plats inclus, les nouvelles productions 3D sont facturées séparément.",
              )}
            </p>
            <div className="pricing-packs">
              {PACKS.map((pack) => (
                <div key={pack.quantity}>
                  <span>
                    <Plus size={13} aria-hidden="true" /> {pack.quantity}
                    {t("plats")}
                  </span>
                  <strong>{currency(pack.amount)}</strong>
                  <small>CAD</small>
                </div>
              ))}
            </div>
            <p className="pricing-individual">
              {t("Un plat supplémentaire :")}
              <strong>{t("35 à 50 $ CAD")}</strong>
              {t(", selon la complexité de sa production.")}
            </p>
            <small className="pricing-note">
              {t(
                "Plus de 20 supports ou un remplacement ? Une estimation est établie selon la collection et votre besoin.",
              )}
            </small>
          </article>
        </div>
      </section>

      <section
        className="pricing-block"
        aria-labelledby="pricing-workflow-title"
      >
        <div className="pricing-block-heading">
          <span className="pricing-eyebrow">
            {t("03 · De votre lieu à leur écran")}
          </span>
          <h3 id="pricing-workflow-title">
            {t("Un lancement, étape par étape.")}
          </h3>
        </div>
        <ol className="pricing-workflow">
          {STEPS.map(([title, description], index) => (
            <li key={title}>
              <span className="pricing-index">0{index + 1}</span>
              <div>
                <h4>{t(title)}</h4>
                <p>{t(description)}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="pricing-lead-time">
          <strong>{t("Généralement environ deux semaines")}</strong>
          {t(
            "après validation du menu et des maquettes, et réception des éléments nécessaires. Le délai varie selon la complexité et la production.",
          )}
        </p>
      </section>

      <section className="pricing-terms" aria-labelledby="pricing-terms-title">
        <h3 id="pricing-terms-title">{t("Des repères clairs.")}</h3>
        <ul>
          <li>{t("Prix en dollars canadiens, taxes en sus.")}</li>
          <li>
            {t("100 % des frais de mise en place avant le début du projet.")}
          </li>
          <li>{t("Engagement initial de 12 mois.")}</li>
          <li>{t("L’abonnement débute à l’activation du service.")}</li>
          <li>
            {t(
              "Tarif mensuel convenu fixe pendant ces 12 mois. Les conditions suivantes sont communiquées au renouvellement.",
            )}
          </li>
        </ul>
      </section>

      <section className="pricing-faq" aria-labelledby="pricing-faq-title">
        <div>
          <span className="pricing-eyebrow">{t("Avant de commencer")}</span>
          <h3 id="pricing-faq-title">{t("Vos questions.")}</h3>
        </div>
        <div className="pricing-faq-list">
          {FAQ.map((item) => (
            <details key={item.question}>
              <summary>
                <span>{t(item.question)}</span>
                <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <p>{t(item.answer)}</p>
            </details>
          ))}
          <FaqAsk locale={locale} compact />
        </div>
      </section>

      <div className="pricing-closing">
        <div>
          <span className="pricing-eyebrow">
            {t("Votre lieu. Votre signature.")}
          </span>
          <h3>{t("Faisons place à votre expérience.")}</h3>
        </div>
        <EstimateAction onEstimate={onEstimate} estimate={estimate}>
          {t("Parlons de votre restaurant")}
        </EstimateAction>
      </div>
    </div>
  );
}
