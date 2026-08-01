import type { Locale } from "@/lib/i18n";

export const LANDING_COPY = {
  fr: {
    hero: {
      eyebrow: "Carte digitale premium",
      title: "Donnez envie avant la première bouchée.",
      body:
        "Vistaire transforme votre QR code en une carte mobile claire, visuelle et fidèle à l’identité de votre restaurant.",
      primaryCta: "Explorer Sauge Noire",
      secondaryCta: "Découvrir les expériences",
      visualEyebrow: "Des visuels à la hauteur",
      visualTitle: "Valorisez chaque plat avec élégance.",
      visualCta: "Explorer",
      mobileTitle: "Une expérience mobile sur mesure",
      mobileBody:
        "Une navigation fluide, pensée pour le service à table et l’identité du lieu.",
      simpleTitle: "Simple pour vous, mémorable pour eux.",
      simpleBody:
        "Une carte facile à faire évoluer et agréable à découvrir, sans application.",
      mobileCta: "Découvrir le menu digital",
      simpleCta: "Voir l’aperçu restaurateur"
    },
    value: {
      eyebrow: "Valeur",
      title: "Ce qu’apporte une carte digitale premium",
      body:
        "Bien plus qu’un menu. Une expérience qui valorise les plats, clarifie le choix et respecte l’identité du restaurant.",
      items: [
        "Navigation fluide et intuitive.",
        "Fiches plats visuelles et détaillées.",
        "Prix, allergènes et informations utiles plus clairs.",
        "Photos premium qui donnent envie.",
        "3D / AR sélective.",
        "Expérience mobile fluide, sans application à télécharger."
      ]
    },
    experiences: {
      eyebrow: "Expériences",
      title: "Trois expériences. Trois identités.",
      body:
        "Chaque restaurant possède son propre univers. Vistaire adapte la carte à l’identité, au menu et au niveau de service du lieu.",
      cta: "Découvrir l’expérience",
      newTabLabel: "S’ouvre dans un nouvel onglet."
    },
    comparison: {
      eyebrow: "Comparaison",
      title: "Un PDF ne fait pas vivre votre menu.",
      body:
        "Le QR code n’est pas le problème. Ce qui compte, c’est ce que le client découvre après le scan.",
      support:
        "Comparez le même geste dans trois directions Vistaire, sans charger les menus complets ni leurs expériences immersives.",
      tabLabel: "Choisir l’expérience Vistaire à comparer",
      openCta: "Ouvrir l’expérience complète",
      revealLabel: "Comparer le menu PDF et la carte digitale Vistaire",
      revealHint: "Glissez pour comparer",
      pdfTitle: "Carte",
      pdfRegionLabel: "Menu PDF complet de {restaurantName}",
      digitalRegionLabel: "{restaurantName}, carte digitale Vistaire",
      dishPhotoAlt: "Photo du plat : {dishName}",
      categoryPhotoAlt:
        "Photo de la catégorie {categoryName} : {dishName}",
      categoryAlt: "Catégorie {categoryName}",
      loadingStatus: "Chargement de l’aperçu de la carte actuelle",
      unavailableStatus: "Aperçu temporairement indisponible",
      figureCaption:
        "Comparaison interactive entre un menu PDF et une carte digitale Vistaire."
    },
    dishes: {
      eyebrow: "Mise en valeur",
      title: "Chaque plat a son histoire. Montrez-la.",
      body:
        "Des fiches utiles, des visuels soignés et une immersion réservée aux plats où elle apporte un vrai plus.",
      items: [
        {
          title: "Fiches plats riches",
          body:
            "Ingrédients, description, prix et allergènes réunis dans une lecture claire.",
          image: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
          alt: "Homard dressé dans une assiette gastronomique"
        },
        {
          title: "3D / AR sélective",
          body:
            "Déclenchée par intention sur les plats pertinents, avec une image de repli.",
          image: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
          alt: "Ravioles dressées avec soin dans une assiette sombre"
        },
        {
          title: "Visuels qui donnent envie",
          body:
            "Des photos qui présentent la cuisine avec justesse et cohérence.",
          image: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
          alt: "Soufflé au chocolat présenté dans une vaisselle sombre"
        }
      ]
    },
    owner: {
      eyebrow: "Pour les restaurateurs",
      title: "Gérez votre carte en toute simplicité.",
      body:
        "Les outils Vistaire couvrent les opérations réellement présentes dans le produit, sans inventer de tableau de bord ni de métrique.",
      cta: "Découvrir l’aperçu restaurateur",
      items: [
        {
          title: "Plats, prix et visuels",
          body: "Mettez à jour le contenu et la disponibilité de la carte."
        },
        {
          title: "Allergènes structurés",
          body: "Présentez les informations utiles de façon plus claire."
        },
        {
          title: "Langues et restaurants",
          body: "Publiez les langues prêtes et gérez les cartes de vos établissements."
        },
        {
          title: "Signaux de consultation",
          body: "Consultez les interactions disponibles sans métrique inventée."
        }
      ]
    },
    finalCta: {
      title: "Créons une carte digitale à la hauteur de votre restaurant.",
      body:
        "Présentez votre cuisine avec une expérience mobile claire, premium et fidèle à votre identité.",
      cta: "Prendre rendez-vous"
    }
  },
  en: {
    hero: {
      eyebrow: "Premium digital menu",
      title: "Make every dish tempting before the first bite.",
      body:
        "Vistaire turns your QR code into a clear, visual mobile menu that stays true to your restaurant.",
      primaryCta: "Explore Sauge Noire",
      secondaryCta: "Discover the experiences",
      visualEyebrow: "Visuals worthy of the plate",
      visualTitle: "Present every dish with elegance.",
      visualCta: "Explore",
      mobileTitle: "A tailored mobile experience",
      mobileBody:
        "Fluid navigation designed for table service and the identity of the venue.",
      simpleTitle: "Simple for you, memorable for them.",
      simpleBody:
        "A menu that is easy to evolve and pleasant to explore, with no app required.",
      mobileCta: "Explore digital menus",
      simpleCta: "View the restaurant preview"
    },
    value: {
      eyebrow: "Value",
      title: "What a premium digital menu brings",
      body:
        "More than a menu. An experience that presents dishes clearly, supports choice and respects the restaurant’s identity.",
      items: [
        "Fluid, intuitive navigation.",
        "Visual, detailed dish pages.",
        "Clearer prices, allergens and useful information.",
        "Premium photography that builds appetite.",
        "Selective 3D / AR.",
        "A fluid mobile experience with no app to download."
      ]
    },
    experiences: {
      eyebrow: "Experiences",
      title: "Three experiences. Three identities.",
      body:
        "Every restaurant has its own world. Vistaire adapts the menu to the venue’s identity, food and level of service.",
      cta: "Discover the experience",
      newTabLabel: "Opens in a new tab."
    },
    comparison: {
      eyebrow: "Comparison",
      title: "A PDF cannot bring your menu to life.",
      body:
        "The QR code is not the problem. What matters is what guests discover after the scan.",
      support:
        "Compare the same gesture across three Vistaire directions without loading full menus or immersive assets.",
      tabLabel: "Choose the Vistaire experience to compare",
      openCta: "Open the full experience",
      revealLabel: "Compare the PDF menu and the Vistaire digital menu",
      revealHint: "Drag to compare",
      pdfTitle: "Menu",
      pdfRegionLabel: "Full PDF menu for {restaurantName}",
      digitalRegionLabel: "{restaurantName}, Vistaire digital menu",
      dishPhotoAlt: "Dish photo: {dishName}",
      categoryPhotoAlt:
        "Category photo for {categoryName}: {dishName}",
      categoryAlt: "Category {categoryName}",
      loadingStatus: "Loading the current menu preview",
      unavailableStatus: "Preview temporarily unavailable",
      figureCaption:
        "Interactive comparison between a PDF menu and a Vistaire digital menu."
    },
    dishes: {
      eyebrow: "Dish storytelling",
      title: "Every dish has a story. Show it.",
      body:
        "Useful dish pages, considered visuals and immersion reserved for plates where it adds real value.",
      items: [
        {
          title: "Rich dish pages",
          body:
            "Ingredients, description, price and allergens in one clear reading experience.",
          image: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
          alt: "Lobster plated as a refined restaurant dish"
        },
        {
          title: "Selective 3D / AR",
          body:
            "Opened intentionally on relevant dishes, always with an image fallback.",
          image: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
          alt: "Carefully plated ravioli in a dark restaurant setting"
        },
        {
          title: "Appetite-building visuals",
          body:
            "Photography that presents the food with accuracy and consistency.",
          image: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
          alt: "Chocolate soufflé presented in dark tableware"
        }
      ]
    },
    owner: {
      eyebrow: "For restaurateurs",
      title: "Manage your menu with ease.",
      body:
        "Vistaire supports the operations that are genuinely present in the product, without invented dashboards or metrics.",
      cta: "Discover the restaurant preview",
      items: [
        {
          title: "Dishes, prices and visuals",
          body: "Update menu content and dish availability."
        },
        {
          title: "Structured allergens",
          body: "Present useful information with greater clarity."
        },
        {
          title: "Languages and restaurants",
          body: "Publish ready languages and manage your venues’ menus."
        },
        {
          title: "Consultation signals",
          body: "Review available interactions without invented metrics."
        }
      ]
    },
    finalCta: {
      title: "Let’s create a digital menu worthy of your restaurant.",
      body:
        "Present your food through a clear, premium mobile experience that stays true to your identity.",
      cta: "Book a call"
    }
  }
} as const;

export type LandingCopy = (typeof LANDING_COPY)[keyof typeof LANDING_COPY];

export function getLandingCopy(locale: Locale) {
  return LANDING_COPY[locale];
}

export function formatLandingCopyTemplate(
  template: string,
  values: Record<string, string>
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template
  );
}
