type Allergen =
  | "gluten"
  | "dairy"
  | "nuts"
  | "shellfish"
  | "eggs"
  | "sesame"
  | "soy"
  | "fish";
type Category = { id: string; slug: string; name: string };

export type PdfMenuRow = {
  name: string;
  price: string;
};

export type PdfMenuSection = {
  title: string;
  rows: PdfMenuRow[];
};

export type CompareCategoryTab = Pick<Category, "id" | "slug" | "name"> & {
  slug: string;
};

export type CompareCategoryPreview = Pick<Category, "id" | "slug" | "name"> & {
  slug: string;
  description: string;
  image: string | null;
  imageAlt: string;
  imageObjectPosition: string;
};

export type CompareDishPreview = {
  id?: string;
  slug: string;
  name: string;
  price: string;
  shortDescription: string;
  categoryId?: string;
  categorySlug?: string;
  categoryName?: string;
  image: string | null;
  imageAlt: string;
  imageObjectPosition: string;
  allergens: Allergen[];
  isSignature: boolean;
  isRecommended: boolean;
  has3d: boolean;
  isAvailable: boolean;
};

export type PdfComparePreviewData = {
  restaurant: {
    menuSlug?: string;
    name: string;
    tagline: string;
    location: string;
    logoMonogram: string;
    currency: string;
  };
  pdfSections: PdfMenuSection[];
  categoryTabs: CompareCategoryTab[];
  categoryCards: CompareCategoryPreview[];
  activeCategorySlug: string;
  vistaireDishes: CompareDishPreview[];
  featuredDish?: CompareDishPreview;
  presentation?: {
    theme: "maison-elyse" | "trouvable" | "sauge-noire";
    eyebrow: string;
    title: string;
    tagline: string;
    featuredKicker: string;
    featuredTitle: string;
    cta: string;
  };
};
