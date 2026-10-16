// One original photographic composition per logical placement; FR/EN share it.
// Source fidelity, semantic intent and checksums: docs/marketing-photography.json.
export type SeoMarketingImage = { src: string; alt: string };

export const SEO_MARKETING_IMAGES: Record<string, { src: string; alt: { fr: string; en: string } }> = {
  "G10:hero": {
    "src": "/images/marketing/geo-brossard-room.webp",
    "alt": {
      "fr": "Salon chaleureux aux rideaux clairs, inspiré de Maison Élyse",
      "en": "Warm restaurant salon with sheer curtains, inspired by Maison Élyse"
    }
  },
  "G12:premium": {
    "src": "/images/marketing/geo-gastronomy-room.webp",
    "alt": {
      "fr": "Menu Maison Élyse ouvert sur un téléphone à une table gastronomique baignée de lumière",
      "en": "Maison Élyse menu open on a phone at a sunlit fine-dining table"
    }
  },
  "G8:hero": {
    "src": "/images/marketing/geo-montreal-room.webp",
    "alt": {
      "fr": "Grande salle lumineuse aux tables nappées, inspirée de Maison Élyse",
      "en": "Large bright linen-dressed dining room inspired by Maison Élyse"
    }
  },
  "HOME:social-content:maison-elyse": {
    "src": "/images/marketing/maison-elyse-dining-room.webp",
    "alt": {
      "fr": "Ambiance de salle de restaurant inspirée de Maison Élyse",
      "en": "Restaurant dining-room scene inspired by Maison Élyse"
    }
  },
  "HOME:testimonies:maison-elyse": {
    "src": "/images/marketing/home-identity-maison-elyse.webp",
    "alt": {
      "fr": "Alcôve lumineuse aux fauteuils en noyer, inspirée de Maison Élyse",
      "en": "Bright walnut-chair dining alcove inspired by Maison Élyse"
    }
  },
  "CONTACT:hero": {
    "src": "/images/marketing/contact-trouvable-room.webp",
    "alt": {
      "fr": "Entrée de bistrot lumineuse donnant sur un bar, inspirée de Trouvable",
      "en": "Sunlit bistro entrance opening onto a bar, inspired by Trouvable"
    }
  },
  "HOME:social-content:trouvable": {
    "src": "/images/marketing/trouvable-dining-room.webp",
    "alt": {
      "fr": "Ambiance de salle de restaurant inspirée de Trouvable",
      "en": "Restaurant dining-room scene inspired by Trouvable"
    }
  },
  "HOME:testimonies:trouvable": {
    "src": "/images/marketing/home-identity-trouvable.webp",
    "alt": {
      "fr": "Banquette en cuir cognac et mur de brique, inspirés de Trouvable",
      "en": "Cognac leather banquette and brick wall inspired by Trouvable"
    }
  },
  "ABOUT:closing": {
    "src": "/images/marketing/about-sauge-noire-room.webp",
    "alt": {
      "fr": "Table près d’un jardin au crépuscule, inspirée de Sauge Noire",
      "en": "Twilight garden-facing table inspired by Sauge Noire"
    }
  },
  "BOOK:panel": {
    "src": "/images/marketing/book-sauge-noire-table.webp",
    "alt": {
      "fr": "Table pour deux près d’une fenêtre, dans l’univers botanique Sauge Noire",
      "en": "Table for two by a window in the Sauge Noire botanical style"
    }
  },
  "G11:hero": {
    "src": "/images/marketing/geo-premium-room.webp",
    "alt": {
      "fr": "Salon feutré aux sièges verts et au décor botanique, inspiré de Sauge Noire",
      "en": "Quiet salon with green seats and botanical decor inspired by Sauge Noire"
    }
  },
  "G9:hero": {
    "src": "/images/marketing/geo-laval-room.webp",
    "alt": {
      "fr": "Banquette verte sous une arche de pierre, inspirée de Sauge Noire",
      "en": "Green booth beneath a stone arch inspired by Sauge Noire"
    }
  },
  "HOME:social-content:sauge-noire": {
    "src": "/images/marketing/sauge-noire-dining-room.webp",
    "alt": {
      "fr": "Ambiance de salle de restaurant inspirée de Sauge Noire",
      "en": "Restaurant dining-room scene inspired by Sauge Noire"
    }
  },
  "HOME:testimonies:sauge-noire": {
    "src": "/images/marketing/home-identity-sauge-noire.webp",
    "alt": {
      "fr": "Table intime aux assises vertes et aux feuillages, inspirée de Sauge Noire",
      "en": "Intimate table with green seats and foliage inspired by Sauge Noire"
    }
  },
  "AR:premium": {
    "src": "/images/marketing/ar-premium-dessert.webp",
    "alt": {
      "fr": "Chocolat fumé Sauge Noire accompagné de sa vraie fiche sur téléphone",
      "en": "Sauge Noire smoked chocolate dessert beside its authentic phone dish page"
    }
  },
  "DIGITAL:hero": {
    "src": "/images/marketing/maison-elyse-souffle-phone.webp",
    "alt": {
      "fr": "Soufflé au chocolat et fiche dessert Maison Élyse sur téléphone",
      "en": "Chocolate soufflé beside the Maison Élyse dessert page on a phone"
    }
  },
  "G1:premium": {
    "src": "/images/marketing/geo-qr-premium.webp",
    "alt": {
      "fr": "Carte Maison Élyse ouverte sur téléphone au-dessus d’une table dressée",
      "en": "Maison Élyse menu open on a phone above a set dining table"
    }
  },
  "G2:hero": {
    "src": "/images/marketing/geo-app-free-hero.webp",
    "alt": {
      "fr": "Catégories et plats du menu Trouvable affichés sur un téléphone à table",
      "en": "Trouvable menu categories and dishes displayed on a phone at a table"
    }
  },
  "G3:premium": {
    "src": "/images/marketing/geo-replace-pdf-dessert.webp",
    "alt": {
      "fr": "Dessert Chocolat fumé Sauge Noire et sa fiche digitale sur téléphone",
      "en": "Sauge Noire Chocolat fumé dessert and its digital dish page on a phone"
    }
  },
  "G5:proof": {
    "src": "/images/marketing/geo-dish-page-dessert.webp",
    "alt": {
      "fr": "Fiche Chocolat fumé Sauge Noire avec photo et prix, à côté du dessert",
      "en": "Sauge Noire Chocolat fumé page with its photo and price beside the dessert"
    }
  },
  "G6:premium": {
    "src": "/images/marketing/geo-food-photography-souffle.webp",
    "alt": {
      "fr": "Soufflé au chocolat en ramequin et glace vanille sur une table de restaurant",
      "en": "Chocolate soufflé in its ramekin with vanilla ice cream at a restaurant table"
    }
  },
  "G7:hero": {
    "src": "/images/marketing/geo-allergens-menu.webp",
    "alt": {
      "fr": "Téléphone affichant les déclarations allergènes du soufflé au chocolat de Maison Élyse, à côté du dessert",
      "en": "Phone showing Maison Élyse chocolate soufflé allergen declarations beside the dessert"
    }
  },
  "G9:proof": {
    "src": "/images/marketing/geo-laval-menu.webp",
    "alt": {
      "fr": "Menu Sauge Noire ouvert sur les accompagnements et desserts à table",
      "en": "Sauge Noire menu open to sides and desserts at a restaurant table"
    }
  },
  "GUIDE-A:hero": {
    "src": "/images/marketing/guide-anatomy-menu.webp",
    "alt": {
      "fr": "Carte Maison Élyse sur un téléphone tenu au-dessus d’une table dressée",
      "en": "Maison Élyse menu on a phone held over a set dining table"
    }
  },
  "G11:proof": {
    "src": "/images/marketing/geo-premium-dish.webp",
    "alt": {
      "fr": "Téléphone présentant la fiche du homard bleu de Maison Élyse, à côté du plat",
      "en": "Phone showing the Maison Élyse blue lobster page beside the matching dish"
    }
  },
  "G12:hero": {
    "src": "/images/marketing/geo-gastronomy-souffle.webp",
    "alt": {
      "fr": "Téléphone présentant la fiche du soufflé au chocolat de Maison Élyse, à côté du plat",
      "en": "Phone showing the Maison Élyse chocolate soufflé page beside the matching dish"
    }
  },
  "G3:proof": {
    "src": "/images/marketing/geo-replace-pdf-detail.webp",
    "alt": {
      "fr": "Téléphone présentant la fiche du homard bleu de Maison Élyse, à côté du plat",
      "en": "Phone showing the Maison Élyse blue lobster page beside the matching dish"
    }
  },
  "G4:hero": {
    "src": "/images/marketing/geo-pdf-alternative-hero.webp",
    "alt": {
      "fr": "Téléphone présentant la fiche du burger signature de Trouvable, à côté du plat",
      "en": "Phone showing the Trouvable signature burger page beside the matching dish"
    }
  },
  "G5:hero": {
    "src": "/images/marketing/geo-dish-page-hero.webp",
    "alt": {
      "fr": "Fiche du homard bleu Maison Élyse sur un téléphone à côté du plat",
      "en": "Maison Élyse blue lobster page on a phone beside the dish"
    }
  },
  "PDF:detail": {
    "src": "/images/marketing/maison-elyse-homard-phone.webp",
    "alt": {
      "fr": "Homard et fiche plat Maison Élyse sur téléphone",
      "en": "Lobster beside the Maison Élyse dish page on a phone"
    }
  },
  "AR:proof": {
    "src": "/images/marketing/ar-proof-browse.webp",
    "alt": {
      "fr": "Un convive consulte la fiche du burger Trouvable et son accès 3D optionnel",
      "en": "A diner browses the Trouvable burger page with its optional 3D entry point"
    }
  },
  "DIGITAL:proof": {
    "src": "/images/marketing/trouvable-guest-menu.webp",
    "alt": {
      "fr": "Main tenant un téléphone affichant le menu Trouvable à table",
      "en": "Hand holding a phone displaying the Trouvable menu at the table"
    }
  },
  "G2:proof": {
    "src": "/images/marketing/geo-app-free-dish.webp",
    "alt": {
      "fr": "Fiche du homard bleu Maison Élyse sur un téléphone à côté du plat",
      "en": "Maison Élyse blue lobster page on a phone beside the dish"
    }
  },
  "G4:premium": {
    "src": "/images/marketing/geo-pdf-alternative-menu.webp",
    "alt": {
      "fr": "Carte des accompagnements et desserts Sauge Noire ouverte à une table de restaurant",
      "en": "Sauge Noire sides and dessert menu open at a restaurant table"
    }
  },
  "G8:proof": {
    "src": "/images/marketing/geo-montreal-menu.webp",
    "alt": {
      "fr": "Carte Trouvable avec catégories, photos et prix, affichée sur un téléphone à table",
      "en": "Trouvable menu with categories, photos and prices displayed on a phone at a table"
    }
  },
  "G3:hero": {
    "src": "/images/marketing/geo-replace-pdf-hero.webp",
    "alt": {
      "fr": "Deux téléphones comparent la présentation PDF et la carte mobile du vrai menu Trouvable",
      "en": "Two phones compare the PDF-style presentation and mobile version of the authentic Trouvable menu"
    }
  },
  "G4:proof": {
    "src": "/images/marketing/geo-pdf-alternative-compare.webp",
    "alt": {
      "fr": "Burger Trouvable et sa vraie fiche digitale sur un téléphone, au centre d’une table de bistrot",
      "en": "Trouvable burger and its authentic digital dish page on a phone at a bistro table"
    }
  },
  "PDF:hero": {
    "src": "/images/marketing/trouvable-pdf-digital.webp",
    "alt": {
      "fr": "Présentation PDF et menu digital Trouvable côte à côte sur deux téléphones",
      "en": "Trouvable PDF-style and digital menus displayed side by side on two phones"
    }
  },
  "ABOUT:hero": {
    "src": "/images/marketing/about-menu-portrait.webp",
    "alt": {
      "fr": "Couverture du menu Sauge Noire sur un téléphone dans un décor végétal",
      "en": "Sauge Noire menu cover on a phone in a leafy dining setting"
    }
  },
  "G10:proof": {
    "src": "/images/marketing/geo-brossard-qr.webp",
    "alt": {
      "fr": "Support QR Signature Sauge Noire à côté du sommaire de la carte sur téléphone",
      "en": "Sauge Noire Signature QR display beside the menu table of contents on a phone"
    }
  },
  "G1:hero": {
    "src": "/images/marketing/geo-qr-hero.webp",
    "alt": {
      "fr": "Support QR Sculpté Sauge Noire à côté du vrai menu sur téléphone",
      "en": "Sauge Noire Sculpté QR display beside its authentic menu on a phone"
    }
  },
  "GUIDE-Q:hero": {
    "src": "/images/marketing/guide-qr-menu.webp",
    "alt": {
      "fr": "Support QR Carré Sauge Noire à côté du sommaire de la carte sur téléphone",
      "en": "Sauge Noire Carré QR display beside the menu table of contents on a phone"
    }
  },
  "QR:hero": {
    "src": "/images/marketing/sauge-noire-qr-menu.webp",
    "alt": {
      "fr": "Menu Sauge Noire sur téléphone à côté du support QR Vistaire",
      "en": "Sauge Noire menu on a phone beside a Vistaire QR display"
    }
  },
  "AR:hero": {
    "src": "/images/marketing/ar-hero-lobster.webp",
    "alt": {
      "fr": "Fiche du homard bleu Maison Élyse avec le bouton Voir en 3D, à côté du plat",
      "en": "Maison Élyse blue lobster page with its View in 3D button beside the dish"
    }
  },
  "DIGITAL:premium": {
    "src": "/images/marketing/digital-premium-burger.webp",
    "alt": {
      "fr": "Burger signature Trouvable servi au comptoir avec sa fiche sur téléphone",
      "en": "Trouvable signature burger served at the counter with its dish page on a phone"
    }
  },
  "G1:proof": {
    "src": "/images/marketing/geo-qr-breakfast.webp",
    "alt": {
      "fr": "Catégorie Matin doré du menu Trouvable sur un téléphone à côté d’un café",
      "en": "Trouvable Matin doré breakfast category on a phone beside a coffee"
    }
  },
  "G2:premium": {
    "src": "/images/marketing/geo-app-free-contents.webp",
    "alt": {
      "fr": "Sommaire du menu Sauge Noire ouvert sur téléphone dans un décor végétal",
      "en": "Sauge Noire menu table of contents open on a phone in a leafy dining setting"
    }
  },
  "GUIDE-3:hero": {
    "src": "/images/marketing/guide-3d-burger.webp",
    "alt": {
      "fr": "Burger Trouvable servi à côté de sa fiche avec l’accès Voir en 3D",
      "en": "Trouvable burger served beside its dish page with the View in 3D entry point"
    }
  },
  "QR:proof": {
    "src": "/images/marketing/sauge-noire-dessert-phone.webp",
    "alt": {
      "fr": "Chocolat fumé et fiche dessert Sauge Noire sur téléphone",
      "en": "Chocolat fumé beside the Sauge Noire dessert page on a phone"
    }
  },
  "G11:premium": {
    "src": "/images/marketing/restaurant-signature-drink.webp",
    "alt": {
      "fr": "Spritz Riviera Trouvable avec tranche d’orange dans une ambiance de bistrot",
      "en": "Trouvable Spritz Riviera with an orange slice in a bistro setting"
    }
  },
  "HOME:pricing:acrylique": {
    "src": "/images/marketing/home-pricing-acrylique.webp",
    "alt": {
      "fr": "Support Acrylique Sauge Noire sur un comptoir en travertin, près d’un brin de sauge",
      "en": "Sauge Noire Acrylique stand on a travertine counter beside a sprig of sage"
    }
  },
  "PRICING:collection:acrylique": {
    "src": "/images/marketing/pricing-acrylique-setting.webp",
    "alt": {
      "fr": "Support Acrylique Sauge Noire vu de gauche sur une table en zellige vert près d’une fenêtre",
      "en": "Sauge Noire Acrylique stand seen from the left on a green zellige table beside a window"
    }
  },
  "HOME:pricing:sculpte": {
    "src": "/images/marketing/home-pricing-sculpte.webp",
    "alt": {
      "fr": "Support Sculpté Sauge Noire sur une table en pierre noire dans une ambiance botanique",
      "en": "Sauge Noire Sculpté stand on a black stone table in a botanical restaurant setting"
    }
  },
  "PRICING:collection:sculpte": {
    "src": "/images/marketing/pricing-sculpte-setting.webp",
    "alt": {
      "fr": "Support Sculpté Sauge Noire vu de gauche sur une table en chêne fumé, près d’une serviette en lin",
      "en": "Sauge Noire Sculpté stand seen from the left on smoked oak beside a linen napkin"
    }
  },
  "HOME:pricing:carre": {
    "src": "/images/marketing/home-pricing-carre.webp",
    "alt": {
      "fr": "Support Carré Sauge Noire sur une table en noyer devant une verrière vert sauge",
      "en": "Sauge Noire Carré stand on a walnut table in front of sage-green fluted glass"
    }
  },
  "PRICING:collection:carre": {
    "src": "/images/marketing/pricing-carre-setting.webp",
    "alt": {
      "fr": "Support Carré Sauge Noire vu de gauche sur une table en calcaire devant un jardin",
      "en": "Sauge Noire Carré stand seen from the left on limestone overlooking a garden"
    }
  },
  "HOME:pricing:signature": {
    "src": "/images/marketing/home-pricing-signature.webp",
    "alt": {
      "fr": "Support Signature Sauge Noire sur une table en ardoise dans une cour végétale",
      "en": "Sauge Noire Signature stand on a slate table in a leafy courtyard"
    }
  },
  "PRICING:collection:signature": {
    "src": "/images/marketing/pricing-signature-setting.webp",
    "alt": {
      "fr": "Support Signature Sauge Noire vu de gauche sur une table en marbre brun dans une alcôve végétale",
      "en": "Sauge Noire Signature stand seen from the left on brown marble in a botanical alcove"
    }
  },
  "G5:premium": {
    "src": "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
    "alt": {
      "fr": "Homard bleu, bisque et fenouil, exemple photographique de plat Maison Élyse",
      "en": "Blue lobster with bisque and fennel, an example Maison Élyse dish photograph"
    }
  },
  "G6:hero": {
    "src": "/images/demo/dishes/tartare-saumon-label-rouge.png",
    "alt": {
      "fr": "Tartare de saumon, exemple photographique de plat Maison Élyse",
      "en": "Salmon tartare, an example Maison Élyse dish photograph"
    }
  },
  "G6:proof": {
    "src": "/images/marketing/geo-photos-in-menu.webp",
    "alt": {
      "fr": "Photos de plats intégrées à la vraie carte Maison Élyse sur un téléphone",
      "en": "Dish photos integrated into the authentic Maison Élyse menu on a phone"
    }
  },
  "G7:proof": {
    "src": "/images/marketing/geo-allergens-detail.webp",
    "alt": {
      "fr": "Fiche du homard de Maison Élyse ouverte sur les déclarations allergènes, à côté du plat",
      "en": "Maison Élyse lobster dish page open to its allergen declarations beside the dish"
    }
  },
  "G7:premium": {
    "src": "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
    "alt": {
      "fr": "Tarte au citron et basilic pourpre, exemple photographique de plat Maison Élyse",
      "en": "Lemon tart with purple basil, an example Maison Élyse dish photograph"
    }
  },
  "G8:premium": {
    "src": "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    "alt": {
      "fr": "Pavé de bœuf et sauce bordelaise, exemple photographique de plat Maison Élyse",
      "en": "Beef with Bordelaise sauce, an example Maison Élyse dish photograph"
    }
  },
  "G9:premium": {
    "src": "/images/demo/dishes/canette-rotie-figues-epices.png",
    "alt": {
      "fr": "Canette rôtie aux figues et épices, exemple photographique de plat Maison Élyse",
      "en": "Roast duck with figs and spices, an example Maison Élyse dish photograph"
    }
  },
  "G10:premium": {
    "src": "/images/demo/dishes/bar-de-ligne-artichaut-citron.png",
    "alt": {
      "fr": "Bar de ligne, artichaut et citron, exemple photographique de plat Maison Élyse",
      "en": "Line-caught sea bass with artichoke and lemon, an example Maison Élyse dish photograph"
    }
  },
  "G12:proof": {
    "src": "/images/demo/dishes/souffle-chocolat-grand-cru.png",
    "alt": {
      "fr": "Soufflé au chocolat grand cru, exemple photographique de plat Maison Élyse",
      "en": "Grand cru chocolate soufflé, an example Maison Élyse dish photograph"
    }
  }
};

export function getSeoMarketingImage(
  slot: string,
  locale: "fr" | "en" = "fr",
): SeoMarketingImage {
  const image = SEO_MARKETING_IMAGES[slot];
  if (!image) throw new Error(`Unknown marketing image slot: ${slot}`);
  return { src: image.src, alt: image.alt[locale] };
}
