import type { PublicMenuSettings } from "@/lib/menu/publicMenuSettings";
import type { MenuAppearanceSelection } from "@/lib/menu/menuAppearance";
import type { DishAllergenDeclaration } from "@/lib/menu/allergens";

export type OwnerRestaurantStatus =
  | "demo"
  | "active"
  | "setup_needed"
  | "paused"
  | "archived";

export type OwnerReadinessStatus =
  | "ready"
  | "needs_setup"
  | "missing"
  | "demo";

export type OwnerQrStatus = "ready" | "generable" | "missing";

export type OwnerReadinessItem = {
  id: "profile" | "menu" | "photos" | "immersive" | "qr";
  label: string;
  detail: string;
  status: OwnerReadinessStatus;
};

export type OwnerRestaurant = {
  id: string;
  name: string;
  slug: string;
  isDemo: boolean;
  location: string;
  cuisineType: string;
  status: OwnerRestaurantStatus;
  statusLabel: string;
  dishCount: number;
  photoDishCount: number;
  immersiveDishCount: number;
  incompleteDishCount: number;
  openingsToday: number;
  interactionsToday: number;
  lastActivity: string;
  clientMenuHref: string;
  menuUrl: string;
  menuUrlSource: "column" | "derived_preview" | "demo";
  publicMenuPath: string;
  publicMenuUrl: string;
  mediaBasePath?: string;
  dashboardHref: string;
  qrTargetUrl: string;
  qrCodeUrl: string | null;
  qrStatus: OwnerQrStatus;
  qrStatusLabel: string;
  readinessScore: number;
  readinessItems: OwnerReadinessItem[];
  nextAction: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

export type OwnerQrLogoMode = "none" | "monogram" | "imageUrl";

export type OwnerQrTargetKind = "menu" | "admin";

export type OwnerQrErrorCorrectionLevel = "M" | "Q" | "H";

export type OwnerQrStyle = {
  foregroundColor: string;
  backgroundColor: string;
  accentColor: string;
  logoMode: OwnerQrLogoMode;
  logoText: string;
  logoImageUrl?: string;
  logoSizePercent: number;
  padding: number;
  errorCorrectionLevel: OwnerQrErrorCorrectionLevel;
  updatedAt?: string;
};

export type OwnerQrCodeStatus = "active" | "paused" | "archived" | "revoked";
export type OwnerQrLifecycleAction = "pause" | "resume" | "archive" | "revoke";
export type OwnerQrRotationDisposition =
  | "keep-active"
  | "pause"
  | "revoke";

export type OwnerQrCodeRecord = {
  id: string;
  restaurantId: string;
  label: string;
  targetKind: OwnerQrTargetKind;
  purposeKey: string;
  isCanonical: boolean;
  recoverable: boolean;
  tokenPreview: string;
  targetPath: string;
  redirectUrl?: string;
  status: OwnerQrCodeStatus;
  configVersion: number;
  scanCount: number;
  lastScannedAt: string | null;
  style: OwnerQrStyle;
  persisted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateOwnerQrCodeResult =
  | {
      ok: true;
      record: OwnerQrCodeRecord;
      created: boolean;
      persisted: boolean;
    }
  | { ok: false; error: string };

export type OwnerQrCanonicalRead = {
  found: boolean;
  recoverable: boolean;
  record: OwnerQrCodeRecord | null;
};

export type OwnerQrCanonicalError = {
  ok: false;
  error: string;
  code: "canonical-unrecoverable";
};

export type OwnerQrRequestError = {
  ok: false;
  error: string;
  code:
    | "not-found"
    | "invalid-input"
    | "config-version-conflict"
    | "idempotency-conflict";
  current?: OwnerQrInventoryRecord;
};

export type OwnerQrInventoryRecord = Omit<
  OwnerQrCodeRecord,
  "recoverable" | "redirectUrl" | "tokenPreview"
> & {
  supersedesQrCodeId: string | null;
  rotatedAt: string | null;
  revokedAt: string | null;
};

export type CanonicalQrMutationResult =
  | {
      ok: true;
      created: boolean;
      persisted: true;
      record: OwnerQrCodeRecord;
    }
  | OwnerQrCanonicalError;

export type CanonicalQrRotationResult =
  | {
      ok: true;
      previous: OwnerQrCodeRecord;
      current: OwnerQrCodeRecord;
    }
  | OwnerQrCanonicalError;

export type OwnerAiPriority = {
  id: string;
  title: string;
  body: string;
  priority: "high" | "medium" | "low";
  restaurantName?: string;
  action: string;
  href: string;
};

export type OwnerAiResult = {
  priorities: OwnerAiPriority[];
  recommendations: OwnerRecommendation[];
  prioritySource: "rules";
  recommendationSource: "stored" | "mistral" | "rules";
  note: string;
};

export type OwnerStats = {
  totalRestaurants: number;
  activeRestaurants: number;
  demoRestaurants: number;
  setupNeededRestaurants: number;
  menuReadyRestaurants: number;
  qrReadyRestaurants: number;
  totalDishes: number;
  dishesWithPhotos: number;
  dishesWithImmersive: number;
  actionsToTreat: number;
  menuOpensToday: number;
  dishViewsToday: number;
  immersiveInteractionsToday: number;
  mostActiveRestaurant: string;
};

export type OwnerRecommendation = {
  id: string;
  title: string;
  body: string;
  type: "opportunity" | "watch" | "setup" | "upsell";
  restaurantName?: string;
  source: "stored" | "mistral" | "rules";
};

export type OwnerAction = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  title: string;
  body: string;
  href: string;
  priority: "high" | "medium" | "low";
};

export type OwnerDashboardData = {
  stats: OwnerStats;
  restaurants: OwnerRestaurant[];
  actions: OwnerAction[];
  recommendations: OwnerRecommendation[];
  source: "supabase" | "fallback";
  recommendationSource: "stored" | "mistral" | "rules";
  note: string;
};

export type CreateRestaurantMenuLanguage = "fr" | "en";

export type CreateRestaurantDishPhotoStatus = "ready" | "planned" | "missing";

export type CreateRestaurantSectionInput = {
  id?: string;
  name: string;
  description?: string;
  order?: number;
  slug?: string;
};

export type CreateRestaurantDishInput = {
  name: string;
  section: string;
  price: string;
  displayPriceMode?: "integer" | "decimal" | "auto";
  description: string;
  imageUrl?: string;
  ingredients?: string[];
  allergens?: string[];
  customAllergens?: string[];
  allergenDeclarations?: DishAllergenDeclaration[];
  tags?: string[];
  options?: string[];
  chefNote?: string;
  available?: boolean;
  photoStatus?: CreateRestaurantDishPhotoStatus;
};

export type CreateRestaurantInput = {
  name: string;
  slug: string;
  location: string;
  cuisineType: string;
  status: OwnerRestaurantStatus;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  googleReviewUrl?: string;
  notes?: string;
  menuLanguages?: CreateRestaurantMenuLanguage[];
  publicMenuSettings?: PublicMenuSettings;
  menuAppearance?: MenuAppearanceSelection;
  sections?: CreateRestaurantSectionInput[];
  dishes?: CreateRestaurantDishInput[];
};
