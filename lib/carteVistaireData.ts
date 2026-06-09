export type CarteVistaireCategory = {
  slug: string;
  label: string;
};

export type CarteVistaireDish = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: string;
  shortDescription: string;
  description: string;
  allergens: string[];
  options: string[];
  tags: string[];
  has3d: boolean;
};

export const CARTE_VISTAIRE_CATEGORIES: CarteVistaireCategory[] = [
  { slug: "all", label: "Tout" },
  { slug: "entrees", label: "Entrées" },
  { slug: "signatures", label: "Signatures" },
  { slug: "desserts", label: "Desserts" },
  { slug: "boissons", label: "Boissons" }
];

export const CARTE_VISTAIRE_DISHES: CarteVistaireDish[] = [
  {
    id: "dish-ravioles",
    slug: "ravioles-chevre-miel",
    name: "Ravioles de chèvre frais & miel de Montérégie",
    category: "entrees",
    price: "34 $",
    shortDescription: "Beurre noisette, romarin brûlé, fleur de sel.",
    description:
      "Une entrée fine, lisible en quelques secondes, avec allergènes et note maison visibles dans la fiche plat.",
    allergens: ["Gluten", "Produits laitiers"],
    options: ["Option sans gluten à confirmer selon le service"],
    tags: ["Recommandé"],
    has3d: true
  },
  {
    id: "dish-tartare",
    slug: "tartare-saumon",
    name: "Tartare de saumon Label Rouge",
    category: "entrees",
    price: "42 $",
    shortDescription: "Agrumes confits, huile d’olive verte, chips de sarrasin.",
    description:
      "Une fiche courte pour aider le client à comprendre le plat sans feuilleter toute la carte.",
    allergens: ["Poisson"],
    options: ["Sans agrumes sur demande"],
    tags: [],
    has3d: true
  },
  {
    id: "dish-homard",
    slug: "homard-bisque-fenouil",
    name: "Homard bleu, bisque corsée & fenouil",
    category: "signatures",
    price: "104 $",
    shortDescription: "Mijoté lent, carottes fanes, pastis en finition.",
    description:
      "Un plat signature présenté avec prix, description, allergènes et badge 3D pour créer un moment plus mémorable.",
    allergens: ["Crustacés", "Poisson"],
    options: ["Remplacement selon arrivage"],
    tags: ["Signature", "Populaire"],
    has3d: true
  },
  {
    id: "dish-canette",
    slug: "canette-figues",
    name: "Canette rôtie aux figues & épices douces",
    category: "signatures",
    price: "96 $",
    shortDescription: "Jus corsé, polenta crémeuse, réduction au Porto rouge.",
    description:
      "Une fiche premium garde le plat désirable même lorsque la 3D n’est pas affichée.",
    allergens: ["Produits laitiers"],
    options: ["Format à partager sur réservation"],
    tags: ["Signature"],
    has3d: true
  },
  {
    id: "dish-risotto",
    slug: "risotto-cepes",
    name: "Risotto aux cèpes & parmesan Reggiano",
    category: "signatures",
    price: "54 $",
    shortDescription: "Onctueux, jus court, huile de persil plat.",
    description:
      "Un plat sans volume publié peut rester premium avec une fiche claire et une photo validée.",
    allergens: ["Produits laitiers"],
    options: ["Version végétarienne possible"],
    tags: [],
    has3d: false
  },
  {
    id: "dish-souffle",
    slug: "souffle-chocolat",
    name: "Soufflé tiède au chocolat grand cru",
    category: "desserts",
    price: "28 $",
    shortDescription: "Cœur coulant, glace vanille Tonka, cacao.",
    description:
      "Les desserts visuels sont de bons candidats pour une présentation 3D validée.",
    allergens: ["Œufs", "Produits laitiers"],
    options: ["Cuisson minute"],
    tags: ["Recommandé"],
    has3d: true
  },
  {
    id: "dish-tarte",
    slug: "tarte-citron-basilic",
    name: "Tarte citron confit & basilic pourpre",
    category: "desserts",
    price: "24 $",
    shortDescription: "Meringue italienne, shortbread sablé, citron vert.",
    description:
      "Chaque fiche peut réunir histoire courte, prix et informations utiles pour commander avec confiance.",
    allergens: ["Gluten", "Œufs", "Produits laitiers"],
    options: [],
    tags: [],
    has3d: true
  },
  {
    id: "dish-maison",
    slug: "maison-n1",
    name: "Maison Élyse N°1",
    category: "boissons",
    price: "28 $",
    shortDescription: "Bulles rosées, verveine fraîche, eau de rose.",
    description:
      "Une carte digitale peut aussi mieux présenter cocktails, accords et boissons signatures.",
    allergens: [],
    options: ["Version sans alcool possible"],
    tags: ["Nouveauté"],
    has3d: true
  }
];
