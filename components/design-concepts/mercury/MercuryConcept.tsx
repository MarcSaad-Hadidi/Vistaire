import shared from "./shared.module.css";
import styles from "./MercuryConcept.module.css";
import { MercuryNavbar } from "./MercuryNavbar";
import { MercuryHero } from "./MercuryHero";
import {
  MercuryAccordionSection,
  type AccordionItem
} from "./MercuryAccordionSection";
import { MercuryMarquee } from "./MercuryMarquee";
import { MercuryTestimonials } from "./MercuryTestimonials";
import { MercuryShowcase, type ShowcaseCard } from "./MercuryShowcase";
import { MercuryStats } from "./MercuryStats";
import { MercuryTrust } from "./MercuryTrust";
import { MercuryClosing } from "./MercuryClosing";
import { MercuryFooter } from "./MercuryFooter";
import { MercuryReveal } from "./MercuryReveal";

const TOOLS: AccordionItem[] = [
  {
    title: "Fiches plats riches",
    text: "Ingrédients, description, prix et allergènes réunis dans une lecture claire.",
    image: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
    alt: "Homard dressé dans une assiette gastronomique"
  },
  {
    title: "3D / AR sélective",
    text: "Déclenchée par intention sur les plats pertinents, avec une image de repli.",
    image: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
    alt: "Ravioles dressées avec soin dans une assiette sombre"
  },
  {
    title: "Disponibilités en un geste",
    text: "Mettez à jour le contenu et la disponibilité de la carte.",
    image: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    alt: "Pavé de bœuf dressé au restaurant"
  },
  {
    title: "Multilingue FR + EN",
    text: "Publiez les langues prêtes et gérez les cartes de vos établissements.",
    image: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    alt: "Tartare de saumon dressé avec précision"
  }
];

const OWNER: AccordionItem[] = [
  {
    title: "Plats, prix et visuels",
    text: "Mettez à jour le contenu et la disponibilité de la carte.",
    image: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
    alt: "Soufflé au chocolat présenté dans une vaisselle sombre"
  },
  {
    title: "Allergènes structurés",
    text: "Présentez les informations utiles de façon plus claire.",
    image: "/images/demo/dishes/risotto-cepes-parmesan.png",
    alt: "Risotto crémeux aux cèpes et parmesan"
  },
  {
    title: "Langues et restaurants",
    text: "Publiez les langues prêtes et gérez les cartes de vos établissements.",
    image: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
    alt: "Tarte au citron et basilic pourpre"
  },
  {
    title: "Signaux de consultation",
    text: "Consultez les interactions disponibles sans métrique inventée.",
    image: "/images/demo/dishes/canette-rotie-figues-epices.png",
    alt: "Canette rôtie aux figues et épices"
  }
];

const FRESH: AccordionItem[] = [
  {
    title: "Prix et plats à jour",
    text: "Une modification, et toute la salle voit la carte à jour.",
    image: "/images/demo/dishes/bar-de-ligne-artichaut-citron.png",
    alt: "Bar de ligne, artichaut et citron"
  },
  {
    title: "Plats épuisés retirés",
    text: "Retirez un plat en un geste, il revient quand vous voulez.",
    image: "/images/demo/dishes/elixir-bergamote-earl-grey.png",
    alt: "Élixir bergamote et earl grey"
  },
  {
    title: "FR + EN instantané",
    text: "Chaque convive lit la carte dans sa langue.",
    image: "/images/demo/dishes/negroni-vieilli-fut.png",
    alt: "Negroni vieilli en fût"
  }
];

const HEADACHE: ShowcaseCard[] = [
  {
    title: "Fiches plats riches",
    text: "Ingrédients, description, prix et allergènes réunis dans une lecture claire.",
    visual: "chips"
  },
  {
    title: "3D / AR sélective",
    text: "Déclenchée par intention sur les plats pertinents, avec une image de repli.",
    visual: "sonar"
  },
  {
    title: "Photos qui donnent envie",
    text: "Des visuels qui présentent la cuisine avec justesse et cohérence.",
    visual: "photo",
    image: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
    alt: "Homard dressé dans une assiette gastronomique"
  },
  {
    title: "Sans application",
    text: "Une expérience mobile fluide, sans rien à télécharger.",
    visual: "toggles"
  }
];

const PRO: ShowcaseCard[] = [
  {
    title: "Fidèle à votre identité",
    text: "La carte épouse l'univers du lieu : visuels, ton et niveau de service.",
    visual: "photo",
    image: "/images/landing/maison-elyse-experience.jpg",
    alt: "Salle de restaurant chaleureuse",
    wide: true
  },
  {
    title: "Simple pour vos équipes",
    text: "Ajoutez un plat, changez un prix : c'est en ligne aussitôt.",
    visual: "chips",
    wide: true
  },
  {
    title: "Disponibilités en temps réel",
    text: "Un plat épuisé disparaît de la carte aussitôt.",
    visual: "toggles"
  },
  {
    title: "Signaux de consultation",
    text: "Voyez ce que les clients regardent vraiment.",
    visual: "sonar"
  }
];

export function MercuryConcept() {
  return (
    <div className={shared.page}>
      <MercuryNavbar />
      <main>
        <MercuryHero />

        <MercuryAccordionSection
          id="outils"
          theme="dark"
          title="Tout ce que fait votre carte. Au même endroit."
          items={TOOLS}
        />

        <MercuryMarquee />

        <MercuryTestimonials />

        <MercuryShowcase
          theme="dark"
          title="Un PDF ne fait pas vivre votre menu."
          cards={HEADACHE}
        />

        <section
          className={`${shared.section} ${shared.sectionLight}`}
          data-mtheme="light"
          aria-label="Citation"
        >
          <div className={`${shared.wrap} ${styles.quoteWrap}`}>
            <MercuryReveal>
              <p className={styles.quote}>
                « Le QR code n&apos;est pas le problème. Ce qui compte,
                c&apos;est ce que le client découvre après le scan. »
              </p>
              <p className={styles.quoteBy}>Vistaire</p>
            </MercuryReveal>
          </div>
        </section>

        <MercuryAccordionSection
          id="restaurateurs"
          theme="light"
          title="Gérez votre carte en toute simplicité."
          items={OWNER}
        />

        <MercuryAccordionSection
          id="frais"
          theme="light"
          title="Fini les cartes imprimées. Place au vivant."
          items={FRESH}
        />

        <MercuryShowcase
          theme="light"
          title="Pensée pour la salle, simple en cuisine."
          cards={PRO}
        />

        <MercuryStats />

        <MercuryTrust />

        <MercuryClosing />
      </main>
      <MercuryFooter />
    </div>
  );
}
