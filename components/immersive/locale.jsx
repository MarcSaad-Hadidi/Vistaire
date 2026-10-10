import { createContext, useContext } from "react";
import { getLocalizedPath } from "@/lib/i18n";

const LocaleContext = createContext("fr");

export function LandingLocaleProvider({ locale = "fr", children }) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

// One scene and one set of components serve both public landing routes.
// French remains the source copy; only presentation text is translated.
const EN = {
  "Faites défiler pour découvrir": "Scroll to discover",
  "Aperçu du menu": "Menu preview",
  "Rotation du plat 3D": "Rotate the 3D dish",
  Fermer: "Close",
  "Aller au contenu": "Skip to content",
  "Préparons votre table.": "Preparing your table.",
  "Vistaire — retour à l’introduction": "Vistaire — return to the introduction",
  "Navigation principale": "Main navigation",
  "L’expérience": "The experience",
  Tarifs: "Pricing",
  "Explorer en 3D": "Explore in 3D",
  "Menu mobile": "Mobile menu",
  "Les pages Vistaire": "Vistaire pages",
  "Les cartes": "The menus",
  "À propos": "About",
  "L’offre complète": "The complete offer",
  "Le Dashboard": "The dashboard",
  "Nous contacter": "Contact us",
  "Prendre rendez-vous": "Book a call",
  "Découvrir Vistaire": "Discover Vistaire",
  "Une carte qui vous ressemble.": "A menu that feels like you.",
  "Fermer le menu": "Close the menu",
  "Pensé pour vos plats. Créé pour vos tables.":
    "Designed for your dishes. Created for your tables.",
  "Donnez envie avant la première bouchée. Une carte mobile, visuelle et fidèle à votre restaurant.":
    "Make them crave the first bite. A mobile, visual menu that stays true to your restaurant.",
  "Votre cuisine.": "Your cuisine.",
  "Votre univers.": "Your world.",
  "Une autre": "Another",
  "dimension.": "dimension.",
  "Du QR code à une carte qui se vit. Sans application à télécharger.":
    "From a QR code to a menu you experience. No app to download.",
  "Explorer la carte": "Explore the menu",
  "Ce n’est pas": "More than",
  "juste un": "just a",
  "01 · Du scan à la découverte": "01 · From scanning to discovery",
  "Un simple geste ouvre tout l’univers de votre restaurant. Vos plats, vos prix, vos histoires. Une vraie carte, pensée pour le mobile.":
    "One simple gesture opens your restaurant’s world. Your dishes, your prices, your stories. A real menu, designed for mobile.",
  "Essayez l’expérience": "Try the experience",
  "Scan. Découvrez. Choisissez.": "Scan. Discover. Choose.",
  "Sans compte. Sans application.": "No account. No app.",
  "02 · Au creux de la main": "02 · In the palm of your hand",
  "Votre carte.": "Your menu.",
  "À portée de main.": "At your fingertips.",
  "Un menu qui s’ouvre instantanément. Une expérience fidèle à votre restaurant.":
    "A menu that opens instantly. An experience that stays true to your restaurant.",
  "Choisir une expérience mobile": "Choose a mobile experience",
  "Chaque détail compte": "Every detail matters",
  "Une carte claire": "A clear menu",
  "Des plats qui se racontent": "Dishes with a story",
  "Le bon choix, simplement": "The right choice, simply",
  "De l’envie à la première bouchée.": "From anticipation to the first bite.",
  "Vos signatures, sous tous les angles.":
    "Your signature dishes, from every angle.",
  "Les bonnes informations. Au bon endroit.":
    "The right information. In the right place.",
  "Des catégories lisibles, une navigation intuitive et une expérience rapide. Le menu s’ouvre dans le navigateur du client.":
    "Clear categories, intuitive navigation and a fast experience. The menu opens in your guest’s browser.",
  "La 3D apporte un vrai plus aux plats qui le méritent. Explorez leur présentation avant de les découvrir à table.":
    "3D adds something meaningful to the dishes that deserve it. Explore their presentation before discovering them at the table.",
  "Prix, descriptions, langues et allergènes : votre carte aide chacun à choisir avec confiance.":
    "Prices, descriptions, languages and allergens: your menu helps every guest choose with confidence.",
  "Manipuler le plat": "Explore the dish",
  "Découvrir la carte": "Discover the menu",
  "Votre restaurant. Votre signature.": "Your restaurant. Your signature.",
  "La signature": "The signature",
  "de votre table.": "of your table.",
  "Des matières et des lignes choisies pour votre lieu.":
    "Materials and lines chosen for your space.",
  "Voir le QR code": "See the QR code",
  "Retourner le support": "Turn the stand over",
  "Voir avant de savourer": "See it before you savour it",
  "Chaque angle.": "Every angle.",
  "Chaque détail.": "Every detail.",
  "Un plat en volume, à explorer du bout des doigts.":
    "A dish in three dimensions, ready to explore with your fingertips.",
  "Choisir un plat 3D": "Choose a 3D dish",
  "Préparation de": "Preparing",
  "votre plat": "your dish",
  "Faire tourner le plat en 3D": "Rotate the dish in 3D",
  "Ce plat ne peut pas être chargé. Le dernier modèle reste disponible.":
    "This dish could not be loaded. The previous model remains available.",
  Réessayer: "Try again",
  "Tourner le plat": "Rotate the dish",
  "Zoom du plat 3D": "3D dish zoom",
  "Dézoomer le plat": "Zoom out from the dish",
  "Zoomer le plat": "Zoom in on the dish",
  "Recentrer le plat": "Reset the dish view",
  "Glissez pour tourner. Écartez deux doigts pour vous rapprocher.":
    "Drag to rotate. Spread two fingers to move closer.",
  "Votre Dashboard restaurateur.": "Your restaurant dashboard.",
  Toujours: "Always",
  "vivante.": "evolving.",
  "Changez un prix. Ajoutez un plat.": "Change a price. Add a dish.",
  "Votre QR code reste le même.": "Your QR code stays the same.",
  "Aperçu du Dashboard Vistaire · données de démonstration":
    "Vistaire dashboard preview · demo data",
  "Explorer l’aperçu restaurateur": "Explore the restaurant preview",
  "Contenus & disponibilités": "Content & availability",
  "Allergènes structurés": "Structured allergens",
  "Langues de votre carte": "Your menu’s languages",
  "Trois expériences.": "Three experiences.",
  "Trois identités.": "Three identities.",
  "Votre restaurant a son propre univers.":
    "Your restaurant has a world of its own.",
  "Votre carte doit le prolonger.": "Your menu should be part of it.",
  "Vistaire à table": "Vistaire at the table",
  "L’envie.": "Anticipation.",
  "Le choix.": "The choice.",
  "L’expérience.": "The experience.",
  Explorer: "Explore",
  "Choisissez votre collection": "Choose your collection",
  "Collections de supports": "Stand collections",
  "Glissez le support pour le tourner": "Drag the stand to rotate it",
  "Recentrer le support": "Reset the stand view",
  Recentrer: "Reset",
  Dès: "From",
  "Puis 200 CAD / mois": "Then CAD 200 / month",
  "Composer votre expérience": "Create your experience",
  "La prochaine expérience commence ici.": "The next experience starts here.",
  "À la hauteur": "An experience",
  "de votre": "worthy of your",
  "restaurant.": "restaurant.",
  "Un projet ?": "Have a project?",
  "Une expérience à partager.": "An experience to share.",
  "Lien copié": "Link copied",
  "Copier le lien Vistaire": "Copy the Vistaire link",
  "Voir les cartes Vistaire": "See the Vistaire menus",
  "Montréal, Québec": "Montréal, Québec",
  "Version vidéo · 3D disponible sur navigateur compatible":
    "Video version · 3D available in a compatible browser",
  "Votre plat est à table.": "Your dish is on the table.",
  "Ouverture de la caméra…": "Opening the camera…",
  "Bougez doucement pour repérer la table, puis touchez le cercle.":
    "Move gently to find the table, then tap the circle.",
  "Fermer la réalité augmentée": "Close augmented reality",
  "Taille du plat ·": "Dish size ·",
  "Taille du plat en réalité augmentée": "Dish size in augmented reality",
  Tourner: "Rotate",
  Replacer: "Reposition",
  "La taille est indicative et peut être ajustée.":
    "The size is indicative and can be adjusted.",
  "L’accès à la caméra a été refusé. Autorisez-le pour essayer la réalité augmentée.":
    "Camera access was denied. Allow it to try augmented reality.",
  "La réalité augmentée n’est pas disponible dans ce navigateur. Essayez Chrome sur un Android compatible.":
    "Augmented reality is not available in this browser. Try Chrome on a compatible Android device.",
  "Carte de démonstration Vistaire": "Vistaire demo menu",
  "Fiche du plat": "Dish details",
  "Composer votre expérience Vistaire": "Create your Vistaire experience",
  "Expérience Vistaire": "Vistaire experience",
  "Menu de démonstration": "Demo menu",
  "La sélection Vistaire": "The Vistaire selection",
  "La carte": "The menu",
  "Disponible en 3D": "Available in 3D",
  "Ouvrir la carte complète": "Open the full menu",
  "· Démonstration": "· Demo",
  Allergènes: "Allergens",
  "Les informations présentées appartiennent au menu de démonstration.":
    "The information shown belongs to the demo menu.",
  "L’expérience Vistaire ·": "The Vistaire experience ·",
  "Une autre dimension à table": "Another dimension at the table",
  "Ouvrir le menu interactif": "Open the interactive menu",
  "Votre expérience Vistaire": "Your Vistaire experience",
  "Une collection.": "One collection.",
  "Votre signature.": "Your signature.",
  "Votre collection": "Your collection",
  "Nombre de supports": "Number of stands",
  "Ajouter Pilotage · +100 CAD / mois": "Add Pilotage · +CAD 100 / month",
  "Mise en place · à partir de · CAD": "Setup · starting from · CAD",
  "CAD / mois": "CAD / month",
  Les: "The",
  "supports supplémentaires sont sur devis et ne sont pas compris dans ce montant.":
    "additional stands are quoted separately and are not included in this amount.",
  "Jusqu’à 20 supports et 5 plats 3D inclus. Taxes en sus. Engagement initial de 12 mois.":
    "Up to 20 stands and 5 3D dishes included. Taxes extra. Initial 12-month commitment.",
  "Détails et conditions de l’offre": "Offer details and terms",
  "Partagez l’expérience.": "Share the experience.",
  "Adresse Vistaire": "Vistaire address",
  "Voir à ma table": "View on my table",
  "Voir la fiche du plat": "View dish details",
  "Réalité augmentée ·": "Augmented reality ·",
  "Invitez ce plat": "Invite this dish",
  "à votre table.": "to your table.",
  "Ouvrez cette page sur votre téléphone, choisissez « Voir à ma table », puis dirigez la caméra vers une surface dégagée.":
    "Open this page on your phone, choose “View on my table”, then point the camera at a clear surface.",
  "iPhone ou iPad :": "iPhone or iPad:",
  "Android :": "Android:",
  "ouvrez dans Safari.": "open in Safari.",
  "ouvrez dans Chrome sur un appareil compatible avec la réalité augmentée.":
    "open in Chrome on an AR-compatible device.",
  "Ouvrir ce plat": "Open this dish",
  "Une présence légère et lumineuse. Le support laisse toute la place à votre identité.":
    "A light, luminous presence. The stand gives your identity room to shine.",
  "Une forme expressive, pensée pour prolonger le caractère du lieu.":
    "An expressive shape, designed to complement the character of your space.",
  "Des lignes nettes et une silhouette discrète, naturellement à sa place à table.":
    "Clean lines and a subtle silhouette, naturally at home on your table.",
  "Une pièce de caractère, pour une expérience qui porte votre signature.":
    "A distinctive piece for an experience that carries your signature.",
  "La chair délicate du homard rencontre une bisque profonde et les notes anisées du fenouil.":
    "Delicate lobster meets a rich bisque and the anise notes of fennel.",
  "Crustacés, lait": "Crustaceans, milk",
  "Un soufflé aérien au chocolat intense, un cœur coulant et une glace délicatement parfumée à la vanille.":
    "An airy, intensely chocolate soufflé with a molten centre and delicately flavoured vanilla ice cream.",
  "Gluten / céréales, produits laitiers, œufs":
    "Gluten / grains, dairy products, eggs",
  Entrées: "Starters",
  "Plats signatures": "Signature dishes",
  "Trois huîtres tièdes au kombu sont servies avec de la pomme verte, du beurre noisette et une huile de livèche.":
    "Three warm kombu oysters are served with green apple, brown butter and lovage oil.",
  "Mollusques, produits laitiers": "Molluscs, dairy products",
  "Voyage à l’assiette": "A journey on a plate",
  "Une présentation à découvrir sous tous les angles.":
    "A presentation to discover from every angle.",
  "Le chocolat noir à 70 % est servi avec de l’huile d’olive, du sel fumé et du grué de cacao.":
    "70% dark chocolate is served with olive oil, smoked salt and cocoa nibs.",
  "Classiques réinventés": "Reimagined classics",
  "Éditoriale & gastronomique": "Editorial & gastronomic",
  "Une carte lumineuse, des compositions soignées, une cuisine qui se raconte.":
    "A luminous menu, considered compositions and cuisine with a story to tell.",
  "Moderne & interactive": "Modern & interactive",
  "Une navigation directe et des plats qui prennent toute leur place.":
    "Direct navigation and dishes that take centre stage.",
  "Signature & immersive": "Signature & immersive",
  "Un univers botanique, sombre et singulier. La carte devient une expérience.":
    "A dark, distinctive botanical world. The menu becomes an experience.",
  "Votre menu digital": "Your digital menu",
  "Acrylique transparent, base en bois.": "Clear acrylic with a wooden base.",
  "Bois sculpté, coin supérieur arrondi.":
    "Sculpted wood with a rounded upper corner.",
  "Format compact en bois, plusieurs finitions.":
    "Compact wooden format, available in several finishes.",
  "Bois premium, insert QR noir amovible.":
    "Premium wood with a removable black QR insert.",
  "Menu personnalisé à l’identité du restaurant":
    "A menu tailored to your restaurant’s identity",
  "Intégration de votre carte": "Integration of your menu",
  "Expérience mobile optimisée": "Optimized mobile experience",
  "Plusieurs langues et devises": "Multiple languages and currencies",
  "Sur vos tables": "On your tables",
  "Jusqu’à 20 supports QR personnalisés": "Up to 20 personalized QR stands",
  "QR code personnalisé": "Personalized QR code",
  "Jusqu’à 5 plats en 3D": "Up to 5 dishes in 3D",
  "Expériences 3D / AR lorsque disponibles":
    "3D / AR experiences where available",
  "À vos côtés": "By your side",
  "Photographie des plats sur place par Vistaire":
    "On-site dish photography by Vistaire",
  "Configuration initiale et mise en place": "Initial configuration and setup",
  "Hébergement et maintenance": "Hosting and maintenance",
  "Accompagnement Vistaire": "Vistaire support",
  Préparer: "Prepare",
  "Photographie sur place et collecte des éléments du projet.":
    "On-site photography and collection of project materials.",
  Créer: "Create",
  "Maquettes du menu digital et des supports personnalisés.":
    "Mockups of the digital menu and personalized stands.",
  Valider: "Approve",
  "Votre restaurant approuve les maquettes avant production.":
    "Your restaurant approves the mockups before production.",
  Produire: "Produce",
  "Fabrication des supports et finalisation du menu.":
    "Stand production and menu finalization.",
  Activer: "Activate",
  "Mise en ligne du menu et démarrage du service.":
    "Menu launch and service activation.",
  "Pourquoi les prix sont-ils indiqués « à partir de » ?":
    "Why are the prices shown as “starting from”?",
  "Le montant final tient compte de la taille et du nombre de menus, des plats, du contenu à préparer, des expériences 3D, des établissements, des supports et de la complexité du projet. Nous confirmons votre estimation avant le lancement.":
    "The final amount depends on the size and number of menus, dishes, content preparation, 3D experiences, locations, stands and project complexity. We confirm your estimate before launch.",
  "Et si j’ai besoin de plus de 20 supports ?":
    "What if I need more than 20 stands?",
  "Les supports supplémentaires ou de remplacement font l’objet d’une estimation selon la collection et votre besoin. Aucun tarif unitaire supplémentaire n’est présumé.":
    "Additional or replacement stands are quoted according to the collection and your needs. No additional unit price is assumed.",
  "Un nouveau plat remplace-t-il gratuitement un ancien modèle 3D ?":
    "Can a new dish replace an existing 3D model for free?",
  "Un nouveau plat nécessitant une nouvelle production 3D est facturé séparément, même s’il remplace un ancien plat. Une correction d’un modèle défectueux imputable à Vistaire n’est pas considérée comme une nouvelle production.":
    "A new dish requiring new 3D production is billed separately, even if it replaces an old dish. Correcting a faulty model attributable to Vistaire is not considered a new production.",
  "Que permet l’option Pilotage ?": "What does the Pilotage option include?",
  "Le dashboard permet de gérer les disponibilités, répercutées sur la carte après validation, et de suivre les ouvertures du menu, les plats consultés par catégorie et les interactions 3D / AR. Les recherches sont anonymisées lorsque l’échantillon est suffisant. Les périodes Aujourd’hui, 7 jours et 30 jours se comparent à la période précédente ; les plages horaires d’activité sont en UTC. Les données dépendent de l’activité enregistrée et respectent les seuils de confidentialité du produit.":
    "The dashboard lets you manage availability, reflected in the menu after validation, and track menu opens, dish views by category and 3D / AR interactions. Searches are anonymized when the sample is sufficient. Today, 7-day and 30-day periods are compared with the previous period; activity time slots are in UTC. Data depends on recorded activity and respects the product’s privacy thresholds.",
  "Quand mon abonnement commence-t-il ?": "When does my subscription start?",
  "La facturation mensuelle commence à l’activation du service. L’engagement initial est de 12 mois et le tarif mensuel convenu reste fixe sur cette période. Les conditions de la période suivante sont établies et communiquées au renouvellement.":
    "Monthly billing starts when the service is activated. The initial commitment is 12 months and the agreed monthly rate stays fixed during that period. Terms for the next period are established and communicated at renewal.",
  "Quel délai prévoir pour la mise en place ?": "How long does setup take?",
  "Généralement environ deux semaines après validation du menu et des maquettes des supports, et réception de tous les éléments nécessaires. Ce délai peut varier selon la complexité du projet et les délais de production.":
    "Usually around two weeks after the menu and stand mockups are approved and all necessary materials are received. Timing can vary with project complexity and production lead times.",
  "L’offre Vistaire · Tarifs": "The Vistaire offer · Pricing",
  "Votre collection.": "Your collection.",
  "L’essentiel compris.": "The essentials included.",
  "Quatre collections, une même expérience digitale et le même accompagnement. Choisissez la présence qui s’accorde à votre lieu.":
    "Four collections, the same digital experience and the same support. Choose the presence that suits your space.",
  "Choisir la collection pour votre offre Vistaire":
    "Choose a collection for your Vistaire offer",
  "À partir de": "Starting from",
  "Mise en place ·": "Setup ·",
  "Une seule fois, avant le début du projet.":
    "A one-time payment before the project starts.",
  "Votre service mensuel": "Your monthly service",
  "/ mois": "/ month",
  "À l’activation du service. Engagement de 12 mois.":
    "From service activation. A 12-month commitment.",
  "Prix en CAD · Taxes en sus": "Prices in CAD · Taxes extra",
  "01 · L’offre, au complet": "01 · The complete offer",
  "Tout commence ici.": "It all starts here.",
  "Les services inclus restent les mêmes. La différence de prix vient principalement du support physique et de son positionnement.":
    "The included services stay the same. The price difference comes mainly from the physical stand and its positioning.",
  "02 · Selon vos besoins": "02 · For your needs",
  "Une carte qui peut évoluer.": "A menu that can evolve.",
  "Prenez le contrôle.": "Take control.",
  "+ 100 $": "+ $100",
  "Votre dashboard pour gérer les disponibilités après validation et analyser l’expérience de vos clients.":
    "Your dashboard to manage availability after validation and understand your guests’ experience.",
  "Disponibilités des plats": "Dish availability",
  "Ouvertures et consultations du menu": "Menu opens and views",
  "Comparaison des périodes d’activité": "Activity-period comparisons",
  "Ajouter Pilotage": "Add Pilotage",
  "200 $ + 100 $ = 300 $ CAD / mois": "CAD 200 + CAD 100 = CAD 300 / month",
  "Ajouter Vistaire Pilotage pour 100 CAD par mois":
    "Add Vistaire Pilotage for CAD 100 per month",
  "Les données dépendent de l’activité enregistrée et des seuils de confidentialité. Détails dans les questions ci-dessous.":
    "Data depends on recorded activity and privacy thresholds. See the questions below for details.",
  "Productions 3D supplémentaires": "Additional 3D productions",
  "De nouvelles envies, en volume.": "New dishes, in three dimensions.",
  "Au-delà des 5 plats inclus, les nouvelles productions 3D sont facturées séparément.":
    "Beyond the 5 included dishes, new 3D productions are billed separately.",
  plats: "dishes",
  "Un plat supplémentaire :": "One additional dish:",
  "35 à 50 $ CAD": "CAD 35 to 50",
  ", selon la complexité de sa production.":
    ", depending on production complexity.",
  "Plus de 20 supports ou un remplacement ? Une estimation est établie selon la collection et votre besoin.":
    "More than 20 stands or a replacement? An estimate is prepared for your collection and needs.",
  "03 · De votre lieu à leur écran": "03 · From your space to their screen",
  "Un lancement, étape par étape.": "A launch, step by step.",
  "Généralement environ deux semaines": "Usually around two weeks",
  "après validation du menu et des maquettes, et réception des éléments nécessaires. Le délai varie selon la complexité et la production.":
    "after menu and mockup approval and receipt of the necessary materials. Timing varies with complexity and production.",
  "Des repères clairs.": "Clear terms.",
  "Prix en dollars canadiens, taxes en sus.":
    "Prices in Canadian dollars, taxes extra.",
  "100 % des frais de mise en place avant le début du projet.":
    "100% of setup fees before the project begins.",
  "Engagement initial de 12 mois.": "Initial 12-month commitment.",
  "L’abonnement débute à l’activation du service.":
    "The subscription starts at service activation.",
  "Tarif mensuel convenu fixe pendant ces 12 mois. Les conditions suivantes sont communiquées au renouvellement.":
    "The agreed monthly rate stays fixed for those 12 months. Subsequent terms are communicated at renewal.",
  "Avant de commencer": "Before you begin",
  "Vos questions.": "Your questions.",
  "Votre lieu. Votre signature.": "Your space. Your signature.",
  "Faisons place à votre expérience.": "Make room for your experience.",
  "Parlons de votre restaurant": "Let’s talk about your restaurant",
};

export function useLandingLocale() {
  const locale = useContext(LocaleContext);
  const languageTag = locale === "en" ? "en-CA" : "fr-CA";
  const t = (text) => (locale === "en" ? (EN[text] ?? text) : text);
  const currency = (amount) =>
    new Intl.NumberFormat(languageTag, {
      style: "currency",
      currency: "CAD",
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    }).format(amount);
  const href = (path) => {
    const menuOrigin = "https://www.vistaire.ca";
    if (path.startsWith("/menu/") || path.startsWith(`${menuOrigin}/menu/`)) {
      const url = new URL(path, menuOrigin);
      url.searchParams.set("lang", languageTag);
      return path.startsWith("/")
        ? `${url.pathname}${url.search}${url.hash}`
        : url.href;
    }
    if (!path.startsWith("/")) return path;
    const suffix = path.match(/[?#].*$/)?.[0] || "";
    return getLocalizedPath(path, locale) + suffix;
  };
  return { locale, languageTag, t, href, currency };
}
