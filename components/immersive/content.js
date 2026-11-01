import { resolvePublicModelUrl } from "../../lib/publicModelAssets.ts";
import { getSeoMarketingImage } from "../../lib/seoMarketingImages.ts";
import { getPricingPage } from "../../lib/pricingPage.ts";
import { EXTRA_TABLE_PRICE_BY_COLLECTION } from "../../lib/pricingCalculator.ts";

export const site = "https://www.vistaire.ca";
const pricing = getPricingPage("fr");
export const collections = [
  {
    id: "acrylique",
    name: "Acrylique",
    image: "/images/marketing/sauge-noire-acrylique.webp",
    description:
      "Transparent et posé sur une base en bois, il laisse respirer la table et s’accorde aux décors épurés.",
    usage: "À placer au centre de la table pour partager l’accès au menu.",
  },
  {
    id: "sculpte",
    name: "Sculpté",
    image: "/images/marketing/sauge-noire-sculpte.webp",
    description:
      "Son coin arrondi adoucit la silhouette du bois. Une touche sculpturale à table, en écho aux matières naturelles.",
    usage: "À intégrer au dressage pour faire du menu un élément de la table.",
  },
  {
    id: "carre",
    name: "Carré",
    image: "/images/marketing/sauge-noire-carre.webp",
    description:
      "Un petit format aux lignes franches, à glisser près d’un couvert. Le bois apporte une touche chaleureuse aux tables de bistrot.",
    usage: "À poser sur un petit comptoir ou une table pour deux.",
  },
  {
    id: "signature",
    name: "Signature",
    image: "/images/marketing/sauge-noire-signature.webp",
    description:
      "Le contraste du bois et du noir dessine une présence affirmée. Sa ligne horizontale accompagne les tables aux tons profonds.",
    usage: "À disposer au bord de la table pour laisser le centre dégagé.",
  },
].map((collection) => ({
  ...collection,
  price: pricing.collections.find((offer) => offer.id === collection.id).setupAmount,
  extra: EXTRA_TABLE_PRICE_BY_COLLECTION[collection.id],
}));
export const presentationOptions = [
  ...pricing.collections.filter((offer) => offer.id === "digital").map((offer) => ({
    id: offer.id,
    name: offer.name,
    price: offer.setupAmount,
    image: offer.image,
    description: "Votre menu digital et votre QR livré numériquement, pour votre menu papier ou un support existant.",
    usage: "Livre Sauge Noire illustratif. Aucun support physique, livre, impression, fabrication ou livraison inclus.",
  })),
  ...collections,
];
export const dishes = [
  {
    id: "homard",
    iosModel: resolvePublicModelUrl("immersive.dish.homard.ios"),
    arWidthMeters: 0.26,
    label: "Homard bleu",
    name: "Homard bleu",
    fullName: "Homard bleu, bisque corsée & fenouil",
    price: 104,
    image: "homard",
    category: "Plats signatures",
    restaurant: "Maison Élyse",
    description:
      "La chair délicate du homard rencontre une bisque profonde et les notes anisées du fenouil.",
    model: true,
    allergens: "Crustacés, lait",
  },
  {
    id: "souffle",
    iosModel: resolvePublicModelUrl("immersive.dish.souffle.ios"),
    arWidthMeters: 0.12,
    label: "Soufflé chocolat",
    name: "Soufflé chocolat",
    fullName: "Soufflé tiède au chocolat grand cru",
    price: 28,
    image: "souffle",
    category: "Desserts",
    restaurant: "Maison Élyse",
    description:
      "Un soufflé aérien au chocolat intense, un cœur coulant et une glace délicatement parfumée à la vanille.",
    model: true,
    allergens: "Gluten / céréales, produits laitiers, œufs",
  },
  {
    id: "huitres",
    iosModel: resolvePublicModelUrl("immersive.dish.huitres.ios"),
    arWidthMeters: 0.1202,
    label: "Huîtres au kombu",
    name: "Huîtres au kombu",
    fullName: "Huîtres tièdes au kombu",
    price: 20,
    image: "huitres",
    category: "Entrées",
    restaurant: "Sauge Noire",
    description:
      "Trois huîtres tièdes au kombu sont servies avec de la pomme verte, du beurre noisette et une huile de livèche.",
    model: resolvePublicModelUrl("immersive.dish.huitres.web"),
    allergens: "Mollusques, produits laitiers",
  },
  {
    id: "sushi",
    iosModel: resolvePublicModelUrl("immersive.dish.sushi.ios"),
    arWidthMeters: 0.2602,
    label: "Plateau sushi Horizon",
    name: "Plateau sushi Horizon",
    fullName: "Plateau sushi Horizon",
    price: 30.99,
    image: "sushi",
    category: "Voyage à l’assiette",
    restaurant: "Trouvable",
    description: "Une présentation à découvrir sous tous les angles.",
    model: resolvePublicModelUrl("immersive.dish.sushi.web"),
    allergens: null,
  },
  {
    id: "chocolat-fume",
    iosModel: resolvePublicModelUrl("immersive.dish.chocolat-fume.ios"),
    arWidthMeters: 0.12,
    label: "Chocolat fumé",
    name: "Chocolat fumé",
    fullName: "Chocolat fumé",
    price: 15,
    image: "chocolat-fume",
    category: "Desserts",
    restaurant: "Sauge Noire",
    description:
      "Le chocolat noir à 70 % est servi avec de l’huile d’olive, du sel fumé et du grué de cacao.",
    model: resolvePublicModelUrl("immersive.dish.chocolat-fume.web"),
    allergens: null,
  },
  {
    id: "poutine",
    iosModel: resolvePublicModelUrl("immersive.dish.poutine.ios"),
    arWidthMeters: 0.18,
    label: "Poutine du Vieux-Montréal",
    name: "Poutine du Vieux-Montréal",
    fullName: "Poutine du Vieux-Montréal",
    price: 16.99,
    image: "poutine",
    category: "Classiques réinventés",
    restaurant: "Trouvable",
    description: "Une présentation à découvrir sous tous les angles.",
    model: resolvePublicModelUrl("immersive.dish.poutine.web"),
    allergens: null,
  },
  {
    id: "burger",
    iosModel: resolvePublicModelUrl("immersive.dish.burger.ios"),
    arWidthMeters: 0.1549,
    label: "Burger signature",
    name: "Burger signature",
    fullName: "Burger signature maison",
    price: 22.99,
    image: "burger",
    category: "Classiques réinventés",
    restaurant: "Trouvable",
    description: "Une présentation à découvrir sous tous les angles.",
    model: resolvePublicModelUrl("immersive.dish.burger.web"),
    allergens: null,
  },
];
/** The model a dish shows in the restaurant scene (Scene and page preloads share it). */
export function dishSceneModelUrl(name, mobile) {
  if (name === "homard")
    // Scene-only quantized meshopt copies; the AR files stay unchanged.
    return resolvePublicModelUrl(mobile ? "immersive.dish.homard.scene-mobile" : "immersive.dish.homard.scene");
  if (["huitres", "sushi", "chocolat-fume", "poutine", "burger"].includes(name))
    return resolvePublicModelUrl(`immersive.dish.${name}.scene-mobile`);
  const dish = dishes.find((item) => item.id === name && item.model);
  return typeof dish?.model === "string" ? dish.model : resolvePublicModelUrl("immersive.dish.souffle.scene");
}
// Scene copies (meshopt, 1024px webp) of the larger stands; acrylic's own file
// is already smaller than its optimized copy.
export const supportModelUrls = {
  acrylique: resolvePublicModelUrl("immersive.support.acrylique"),
  sculpte: resolvePublicModelUrl("immersive.support.sculpte.scene"),
  carre: resolvePublicModelUrl("immersive.support.carre.scene"),
  signature: resolvePublicModelUrl("immersive.support.signature.scene"),
};
export const presentationModelUrls = {
  digital: resolvePublicModelUrl("immersive.presentation.digital"),
  ...supportModelUrls,
};
export const experiences = [
  {
    id: "maison-elyse",
    name: "Maison Élyse",
    tag: "Éditoriale & gastronomique",
    image: getSeoMarketingImage("HOME:social-content:maison-elyse").src,
    thumbnail: getSeoMarketingImage("HOME:testimonies:maison-elyse").src,
    description:
      "Une carte lumineuse, des compositions soignées, une cuisine qui se raconte.",
  },
  {
    id: "trouvable",
    name: "Trouvable",
    tag: "Moderne & interactive",
    image: getSeoMarketingImage("HOME:social-content:trouvable").src,
    thumbnail: getSeoMarketingImage("HOME:testimonies:trouvable").src,
    description:
      "Une navigation directe et des plats qui prennent toute leur place.",
  },
  {
    id: "sauge-noire",
    name: "Sauge Noire",
    tag: "Signature & immersive",
    image: getSeoMarketingImage("HOME:social-content:sauge-noire").src,
    thumbnail: getSeoMarketingImage("HOME:testimonies:sauge-noire").src,
    description:
      "Un univers botanique, sombre et singulier. La carte devient une expérience.",
  },
];
export const chapters = [
  ["hero", "Introduction"],
  ["ai", "Du scan à la carte"],
  ["wearable", "Pensé pour le mobile"],
  ["features", "Chaque détail compte"],
  ["encryption", "Votre identité"],
  ["grip", "Plats en 3D"],
  ["sustainability", "Une carte vivante"],
  ["testimonies", "Trois identités"],
  ["social-content", "À table"],
  ["product", "Les collections"],
  ["open-weight", "Tarifs et accompagnement"],
  ["footer", "Contact"],
];
export const money = (n) =>
  new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(n);
