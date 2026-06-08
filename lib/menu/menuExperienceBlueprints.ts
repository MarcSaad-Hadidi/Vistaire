export const MENU_EXPERIENCE_BLUEPRINT_IDS = [
  "classic-tabs",
  "editorial-magazine",
  "photo-grid",
  "fast-board",
  "bento-showcase",
  "story-first",
  "minimal-list",
  "lounge-cocktail",
  "family-comfort",
  "immersive-first",
  "tasting-journey",
  "compact-qr"
] as const;

export type MenuExperienceBlueprintId =
  (typeof MENU_EXPERIENCE_BLUEPRINT_IDS)[number];

export const MENU_HOME_LAYOUT_VALUES = [
  "compact-welcome",
  "editorial-hero",
  "visual-home",
  "menu-first",
  "no-welcome",
  "story-intro",
  "immersive-poster",
  "tasting-path"
] as const;

export const MENU_SECTION_ORDER_VALUES = [
  "categories-then-featured",
  "featured-then-categories",
  "all-menu-first",
  "category-grid-first",
  "immersive-then-menu",
  "journey-order",
  "drinks-first",
  "bento-mixed"
] as const;

export const MENU_FEATURED_MODE_VALUES = [
  "signature-first",
  "photo-led",
  "none",
  "tags",
  "immersive-ready",
  "comfort-picks",
  "tasting-highlights"
] as const;

export const MENU_CATEGORY_PRESENTATION_VALUES = [
  "tabs",
  "sticky-pills",
  "visual-grid",
  "editorial-sections",
  "compact-pills",
  "none",
  "bento"
] as const;

export const MENU_DISH_LIST_PRESENTATION_VALUES = [
  "grouped-cards",
  "photo-grid",
  "dense-board",
  "bento-grid",
  "minimal-lines",
  "immersive-showcase",
  "journey-steps",
  "comfort-blocks",
  "compact-list",
  "editorial-cards"
] as const;

export const MENU_DETAIL_PRESENTATION_VALUES = [
  "bottom-sheet",
  "route",
  "photo-hero",
  "modal-card",
  "editorial-page",
  "compact-route",
  "inline-card"
] as const;

export type MenuHomeLayout = (typeof MENU_HOME_LAYOUT_VALUES)[number];
export type MenuSectionOrder = (typeof MENU_SECTION_ORDER_VALUES)[number];
export type MenuFeaturedMode = (typeof MENU_FEATURED_MODE_VALUES)[number];
export type MenuCategoryPresentation =
  (typeof MENU_CATEGORY_PRESENTATION_VALUES)[number];
export type MenuDishListPresentation =
  (typeof MENU_DISH_LIST_PRESENTATION_VALUES)[number];
export type MenuDetailPresentation =
  (typeof MENU_DETAIL_PRESENTATION_VALUES)[number];

export type MenuExperienceBlueprint = {
  id: MenuExperienceBlueprintId;
  name: string;
  description: string;
  bestFor: string[];
  defaultNavigation:
    | "tabs"
    | "cards"
    | "tabs-cards"
    | "sticky-pills"
    | "rail"
    | "minimal";
  defaultCardVariant:
    | "compact"
    | "photo-compact"
    | "photo-large"
    | "editorial"
    | "split"
    | "minimal-list"
    | "price-forward";
  defaultDetailStyle:
    | "bottom-sheet"
    | "full-page"
    | "modal-card"
    | "editorial-detail"
    | "compact-detail";
  defaultDishOpenMode: "inline" | "route" | "hybrid";
  defaultWelcomeLayout: "compact" | "hero" | "editorial" | "split" | "minimal";
  sectionOrder: MenuSectionOrder[];
  renderStrategy: string;
  previewNotes: string[];
  experienceDefaults: {
    homeLayout: MenuHomeLayout;
    sectionOrder: MenuSectionOrder;
    featuredMode: MenuFeaturedMode;
    categoryPresentation: MenuCategoryPresentation;
    dishListPresentation: MenuDishListPresentation;
    detailPresentation: MenuDetailPresentation;
  };
};

export const MENU_EXPERIENCE_BLUEPRINTS: MenuExperienceBlueprint[] = [
  {
    id: "classic-tabs",
    name: "Classic Tabs",
    description: "Header compact, tabs sticky, tout le menu et sections verticales.",
    bestFor: ["Cartes polyvalentes", "Restaurants deja organises", "QR standard"],
    defaultNavigation: "tabs-cards",
    defaultCardVariant: "photo-compact",
    defaultDetailStyle: "bottom-sheet",
    defaultDishOpenMode: "hybrid",
    defaultWelcomeLayout: "compact",
    sectionOrder: ["categories-then-featured", "all-menu-first"],
    renderStrategy: "classic-tabs",
    previewNotes: ["Accueil court", "Navigation visible", "Sections verticales"],
    experienceDefaults: {
      homeLayout: "compact-welcome",
      sectionOrder: "categories-then-featured",
      featuredMode: "signature-first",
      categoryPresentation: "tabs",
      dishListPresentation: "grouped-cards",
      detailPresentation: "bottom-sheet"
    }
  },
  {
    id: "editorial-magazine",
    name: "Editorial Magazine",
    description: "Hero editorial, plats signatures d'abord et sections type article.",
    bestFor: ["Gastronomique", "Restaurant premium", "Carte courte"],
    defaultNavigation: "minimal",
    defaultCardVariant: "editorial",
    defaultDetailStyle: "editorial-detail",
    defaultDishOpenMode: "route",
    defaultWelcomeLayout: "editorial",
    sectionOrder: ["featured-then-categories", "journey-order"],
    renderStrategy: "editorial-magazine",
    previewNotes: ["Hero narratif", "Signatures en avant", "Detail pleine page"],
    experienceDefaults: {
      homeLayout: "editorial-hero",
      sectionOrder: "featured-then-categories",
      featuredMode: "signature-first",
      categoryPresentation: "editorial-sections",
      dishListPresentation: "editorial-cards",
      detailPresentation: "editorial-page"
    }
  },
  {
    id: "photo-grid",
    name: "Photo Grid",
    description: "Categories en grille visuelle, plats en cartes photo, detail photo hero.",
    bestFor: ["Brunch", "Cafe", "Patisserie", "Cartes avec photos"],
    defaultNavigation: "cards",
    defaultCardVariant: "photo-large",
    defaultDetailStyle: "bottom-sheet",
    defaultDishOpenMode: "hybrid",
    defaultWelcomeLayout: "split",
    sectionOrder: ["category-grid-first", "featured-then-categories"],
    renderStrategy: "photo-grid",
    previewNotes: ["Grille photo", "Categories visuelles", "Photos utiles"],
    experienceDefaults: {
      homeLayout: "visual-home",
      sectionOrder: "category-grid-first",
      featuredMode: "photo-led",
      categoryPresentation: "visual-grid",
      dishListPresentation: "photo-grid",
      detailPresentation: "photo-hero"
    }
  },
  {
    id: "fast-board",
    name: "Fast Board",
    description: "Menu dense, prix tres visibles, peu d'images et navigation rapide.",
    bestFor: ["Fast casual", "Comptoir", "Grande carte"],
    defaultNavigation: "sticky-pills",
    defaultCardVariant: "price-forward",
    defaultDetailStyle: "compact-detail",
    defaultDishOpenMode: "hybrid",
    defaultWelcomeLayout: "compact",
    sectionOrder: ["all-menu-first", "categories-then-featured"],
    renderStrategy: "fast-board",
    previewNotes: ["Prix a droite", "Densite forte", "Peu d'espaces"],
    experienceDefaults: {
      homeLayout: "menu-first",
      sectionOrder: "all-menu-first",
      featuredMode: "none",
      categoryPresentation: "compact-pills",
      dishListPresentation: "dense-board",
      detailPresentation: "compact-route"
    }
  },
  {
    id: "bento-showcase",
    name: "Bento Showcase",
    description: "Layout asymetrique melangeant categories et plats en cards bento.",
    bestFor: ["Concept visuel", "Carte moyenne", "Experience distinctive"],
    defaultNavigation: "cards",
    defaultCardVariant: "split",
    defaultDetailStyle: "modal-card",
    defaultDishOpenMode: "hybrid",
    defaultWelcomeLayout: "hero",
    sectionOrder: ["bento-mixed", "featured-then-categories"],
    renderStrategy: "bento-showcase",
    previewNotes: ["Grille asymetrique", "Mix categories/plats", "Rythme visuel"],
    experienceDefaults: {
      homeLayout: "visual-home",
      sectionOrder: "bento-mixed",
      featuredMode: "tags",
      categoryPresentation: "bento",
      dishListPresentation: "bento-grid",
      detailPresentation: "modal-card"
    }
  },
  {
    id: "story-first",
    name: "Story First",
    description: "Intro narrative, section a decouvrir, puis categories.",
    bestFor: ["Restaurant maison", "Cuisine familiale", "Adresse de quartier"],
    defaultNavigation: "tabs-cards",
    defaultCardVariant: "photo-compact",
    defaultDetailStyle: "bottom-sheet",
    defaultDishOpenMode: "hybrid",
    defaultWelcomeLayout: "hero",
    sectionOrder: ["featured-then-categories", "categories-then-featured"],
    renderStrategy: "story-first",
    previewNotes: ["Accueil plus humain", "A decouvrir avant les categories"],
    experienceDefaults: {
      homeLayout: "story-intro",
      sectionOrder: "featured-then-categories",
      featuredMode: "comfort-picks",
      categoryPresentation: "visual-grid",
      dishListPresentation: "grouped-cards",
      detailPresentation: "bottom-sheet"
    }
  },
  {
    id: "minimal-list",
    name: "Minimal List",
    description: "Sans gros hero, listes fines, details route et lecture sobre.",
    bestFor: ["Sushi", "Carte minimaliste", "Restaurant calme"],
    defaultNavigation: "tabs",
    defaultCardVariant: "minimal-list",
    defaultDetailStyle: "full-page",
    defaultDishOpenMode: "route",
    defaultWelcomeLayout: "minimal",
    sectionOrder: ["all-menu-first", "categories-then-featured"],
    renderStrategy: "minimal-list",
    previewNotes: ["Pas de category cards", "Liste sobre", "Detail route"],
    experienceDefaults: {
      homeLayout: "no-welcome",
      sectionOrder: "all-menu-first",
      featuredMode: "none",
      categoryPresentation: "tabs",
      dishListPresentation: "minimal-lines",
      detailPresentation: "route"
    }
  },
  {
    id: "lounge-cocktail",
    name: "Lounge Cocktail",
    description: "Ambiance sombre, sections compactes et boissons en avant.",
    bestFor: ["Bar", "Lounge", "Cocktails", "Night market"],
    defaultNavigation: "rail",
    defaultCardVariant: "price-forward",
    defaultDetailStyle: "modal-card",
    defaultDishOpenMode: "hybrid",
    defaultWelcomeLayout: "compact",
    sectionOrder: ["drinks-first", "all-menu-first"],
    renderStrategy: "lounge-cocktail",
    previewNotes: ["Boissons d'abord", "Sections compactes", "Detail modal/card"],
    experienceDefaults: {
      homeLayout: "compact-welcome",
      sectionOrder: "drinks-first",
      featuredMode: "tags",
      categoryPresentation: "compact-pills",
      dishListPresentation: "dense-board",
      detailPresentation: "modal-card"
    }
  },
  {
    id: "family-comfort",
    name: "Family Comfort",
    description: "Gros blocs faciles, categories larges et placeholders chaleureux.",
    bestFor: ["Restaurant maison", "Familles", "Carte comfort food"],
    defaultNavigation: "cards",
    defaultCardVariant: "photo-compact",
    defaultDetailStyle: "bottom-sheet",
    defaultDishOpenMode: "hybrid",
    defaultWelcomeLayout: "hero",
    sectionOrder: ["categories-then-featured", "featured-then-categories"],
    renderStrategy: "family-comfort",
    previewNotes: ["Blocs lisibles", "Categories larges", "Photos ou placeholders"],
    experienceDefaults: {
      homeLayout: "story-intro",
      sectionOrder: "categories-then-featured",
      featuredMode: "comfort-picks",
      categoryPresentation: "visual-grid",
      dishListPresentation: "comfort-blocks",
      detailPresentation: "bottom-sheet"
    }
  },
  {
    id: "immersive-first",
    name: "Immersive First",
    description: "Plats 3D/AR en vedette avec poster/CTA seulement, sans auto-load.",
    bestFor: ["Cartes avec 3D", "AR a table", "Demo immersive controlee"],
    defaultNavigation: "sticky-pills",
    defaultCardVariant: "photo-large",
    defaultDetailStyle: "modal-card",
    defaultDishOpenMode: "hybrid",
    defaultWelcomeLayout: "editorial",
    sectionOrder: ["immersive-then-menu", "all-menu-first"],
    renderStrategy: "immersive-first",
    previewNotes: ["3D/AR priorise", "CTA explicite", "Aucun modele charge avant clic"],
    experienceDefaults: {
      homeLayout: "immersive-poster",
      sectionOrder: "immersive-then-menu",
      featuredMode: "immersive-ready",
      categoryPresentation: "compact-pills",
      dishListPresentation: "immersive-showcase",
      detailPresentation: "modal-card"
    }
  },
  {
    id: "tasting-journey",
    name: "Tasting Journey",
    description: "Menu comme parcours premium, entree puis plat puis dessert.",
    bestFor: ["Gastronomique", "Menu degustation", "Experience guidee"],
    defaultNavigation: "minimal",
    defaultCardVariant: "editorial",
    defaultDetailStyle: "editorial-detail",
    defaultDishOpenMode: "route",
    defaultWelcomeLayout: "editorial",
    sectionOrder: ["journey-order", "featured-then-categories"],
    renderStrategy: "tasting-journey",
    previewNotes: ["Parcours ordonne", "Etapes visibles", "Tres premium"],
    experienceDefaults: {
      homeLayout: "tasting-path",
      sectionOrder: "journey-order",
      featuredMode: "tasting-highlights",
      categoryPresentation: "editorial-sections",
      dishListPresentation: "journey-steps",
      detailPresentation: "editorial-page"
    }
  },
  {
    id: "compact-qr",
    name: "Compact QR",
    description: "Ultra rapide apres scan, presque pas d'animation et tout le menu direct.",
    bestFor: ["Menus de table", "Grande rotation", "Consultation pratique"],
    defaultNavigation: "sticky-pills",
    defaultCardVariant: "compact",
    defaultDetailStyle: "compact-detail",
    defaultDishOpenMode: "hybrid",
    defaultWelcomeLayout: "minimal",
    sectionOrder: ["all-menu-first", "categories-then-featured"],
    renderStrategy: "compact-qr",
    previewNotes: ["Header reduit", "Tout le menu direct", "Tres peu d'animation"],
    experienceDefaults: {
      homeLayout: "menu-first",
      sectionOrder: "all-menu-first",
      featuredMode: "none",
      categoryPresentation: "sticky-pills",
      dishListPresentation: "compact-list",
      detailPresentation: "inline-card"
    }
  }
];

const BLUEPRINT_BY_ID = new Map(
  MENU_EXPERIENCE_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint])
);

export function isMenuExperienceBlueprintId(
  value: unknown
): value is MenuExperienceBlueprintId {
  return (
    typeof value === "string" &&
    MENU_EXPERIENCE_BLUEPRINT_IDS.includes(value as MenuExperienceBlueprintId)
  );
}

export function getMenuExperienceBlueprint(
  value: unknown
): MenuExperienceBlueprint {
  return BLUEPRINT_BY_ID.get(value as MenuExperienceBlueprintId) ?? MENU_EXPERIENCE_BLUEPRINTS[0];
}
