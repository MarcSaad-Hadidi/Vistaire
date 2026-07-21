"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PublicDishDetailExperience } from "@/components/menu/PublicDishDetailExperience";
import { PublicMenuRenderer } from "@/components/menu/PublicMenuRenderer";
import {
  MENU_UI_BACKGROUND_SHAPE_VALUES,
  MENU_UI_BACKGROUND_STYLE_VALUES,
  MENU_UI_BODY_STYLE_VALUES,
  MENU_CATEGORY_PRESENTATION_VALUES,
  MENU_DETAIL_PRESENTATION_VALUES,
  MENU_DISH_LIST_PRESENTATION_VALUES,
  MENU_FEATURED_MODE_VALUES,
  MENU_HOME_LAYOUT_VALUES,
  MENU_SECTION_ORDER_VALUES,
  MENU_UI_CATEGORY_NAVIGATION_VALUES,
  MENU_UI_DENSITY_VALUES,
  MENU_UI_DESCRIPTION_LENGTH_VALUES,
  MENU_UI_DETAIL_PHOTO_HERO_VALUES,
  MENU_UI_DETAIL_STYLE_VALUES,
  MENU_UI_DISH_OPEN_MODE_VALUES,
  MENU_UI_DISH_CARD_STYLE_VALUES,
  MENU_UI_HEADING_STYLE_VALUES,
  MENU_UI_MODEL_PANEL_STYLE_VALUES,
  MENU_UI_MOTION_VALUES,
  MENU_UI_PHOTO_PLACEHOLDER_STYLE_VALUES,
  MENU_UI_PHOTO_SHAPE_VALUES,
  MENU_UI_PRICE_STYLE_VALUES,
  MENU_UI_PUBLIC_MISSING_PHOTO_VALUES,
  MENU_UI_RADIUS_VALUES,
  MENU_UI_SHADOW_VALUES,
  MENU_UI_TITLE_SCALE_VALUES,
  MENU_UI_WELCOME_LAYOUT_VALUES,
  menuUiConfigForRestaurant,
  normalizeMenuUiConfig,
  type MenuUiConfig,
} from "@/lib/menu/menuUiConfig";
import {
  evaluateMenuDesignQuality,
  type MenuDesignQualityResult
} from "@/lib/menu/menuDesignQuality";
import {
  duplicateMenuDesignConfig,
  exportMenuDesignConfig,
  importMenuDesignConfig
} from "@/lib/menu/menuConfigTransfer";
import type {
  MenuStyleAdvisorProposal,
  MenuStyleAdvisorRecommendation
} from "@/lib/menu/menuStyleAdvisor";
import { MENU_EXPERIENCE_BLUEPRINTS } from "@/lib/menu/menuExperienceBlueprints";
import {
  MENU_THEME_PRESETS,
  buildConfigFromTheme,
  createMenuThemeVariation,
  mergeCustomConfig
} from "@/lib/menu/menuThemePresets";
import type { PublicMenu, PublicMenuCategory, PublicMenuDish } from "@/lib/menu/publicMenuCore";
import {
  DEFAULT_PUBLIC_MENU_SETTINGS,
  serializePublicMenuSettings
} from "@/lib/menu/publicMenuSettings";
import { DEFAULT_OWNER_QR_STYLE, monogramFromName } from "@/lib/owner/qrStyle";
import type { OwnerRestaurant, OwnerQrTargetKind } from "@/lib/owner/types";
import styles from "./MenuUiBuilder.module.css";

type MenuBuilderRestaurant = Pick<
  OwnerRestaurant,
  "id" | "name" | "slug" | "publicMenuPath" | "publicMenuUrl"
>;

type MenuUiBuilderProps = {
  restaurants: MenuBuilderRestaurant[];
  source: "supabase" | "fallback";
  note: string;
};

type MenuDataPayload = {
  ok: true;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    publicMenuPath: string;
  };
  menu: PublicMenu;
  categories: PublicMenuCategory[];
  dishes: PublicMenuDish[];
  source: "supabase" | "fallback";
  note: string;
};

type ConfigPayload = {
  ok: true;
  config: MenuUiConfig;
  status: "draft" | "published" | "archived";
  persisted: boolean;
  dataSource: "supabase" | "default";
  updatedAt: string;
  error?: string;
};

type QrPayload = {
  ok: true;
  redirectUrl: string;
  targetPath: string;
  targetKind: OwnerQrTargetKind;
  persisted: boolean;
  record?: unknown;
};

type BuilderQrRecord = {
  redirectUrl?: string;
  targetPath: string;
  persisted: boolean;
};

type QrReadPayload = {
  ok: true;
  found: boolean;
  recoverable: boolean;
  canonical?: BuilderQrRecord | null;
  record?: BuilderQrRecord | null;
};

type QrAvailability =
  | "loading"
  | "absent"
  | "creating"
  | "available"
  | "unrecoverable"
  | "failed";

function isOpaqueQrRedirect(value: string): boolean {
  return /^\/q\/[A-Za-z0-9._~-]+$/.test(value);
}

function qrPreviewCopy(state: QrAvailability): {
  badge: string;
  message: string;
  detail: string;
} {
  switch (state) {
    case "loading":
      return {
        badge: "Chargement",
        message: "Verification du QR menu en cours",
        detail: "Le parcours sera disponible apres verification."
      };
    case "creating":
      return {
        badge: "Creation",
        message: "Creation securisee du QR en cours",
        detail: "Aucune adresse n'est affichee avant confirmation."
      };
    case "unrecoverable":
      return {
        badge: "Inaccessible",
        message: "Le QR existant ne peut pas etre recupere",
        detail: "Rechargez la page avant toute action."
      };
    case "failed":
      return {
        badge: "Indisponible",
        message: "Etat du QR indisponible",
        detail: "Rechargez la page pour verifier le QR existant."
      };
    default:
      return {
        badge: "Absent",
        message: "Aucun QR actif a previsualiser",
        detail: "Creez un QR pour tester le parcours."
      };
  }
}

type AdvisorPayload = {
  ok: true;
  source: "mistral" | "rules";
  recommendation: MenuStyleAdvisorRecommendation;
};

type LoadState = "idle" | "loading" | "ready" | "error";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "publishing" | "published" | "error";
type AdvisorState = "idle" | "loading" | "ready" | "error";
type PreviewDeviceId = "phone-390" | "phone-430" | "tablet" | "desktop";
type PreviewMode =
  | "client-menu"
  | "dish-detail"
  | "qr-flow"
  | "empty-state"
  | "missing-photos"
  | "immersive-state";

type QuickImportResult = {
  menu: PublicMenu;
  errors: string[];
  categoryCount: number;
  dishCount: number;
};

type ApiFailure = {
  ok: false;
  error?: string;
  code?: string;
};

const PREVIEW_DEVICES: Array<{
  id: PreviewDeviceId;
  label: string;
  width: number;
}> = [
  { id: "phone-390", label: "Phone 390px", width: 390 },
  { id: "phone-430", label: "Phone 430px", width: 430 },
  { id: "tablet", label: "Tablet", width: 768 },
  { id: "desktop", label: "Desktop", width: 1120 }
];

const PREVIEW_MODES: Array<{ id: PreviewMode; label: string }> = [
  { id: "client-menu", label: "Client menu" },
  { id: "dish-detail", label: "Dish detail" },
  { id: "qr-flow", label: "QR scan flow" },
  { id: "empty-state", label: "Empty state" },
  { id: "missing-photos", label: "Missing photos" },
  { id: "immersive-state", label: "3D/AR available" }
];

function apiErrorMessage(payload: ApiFailure, fallback: string): string {
  return payload.error || fallback;
}

const PALETTE_FIELDS: Array<keyof MenuUiConfig["palette"]> = [
  "background",
  "surface",
  "text",
  "muted",
  "accent",
  "accent2",
  "accent3",
  "border",
  "success",
  "warning",
  "danger"
];

const IMPORT_PLACEHOLDER = `Entrees
Nom du plat | 12.00 | Description fournie par le restaurant.

Plats
Nom du plat principal | 24.00 | Description fournie par le restaurant.`;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function formatPriceLabel(value: string): string {
  const parsed = Number(value.replace(",", ".").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return value.trim();
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD"
  }).format(parsed);
}

function preferRestaurant(restaurants: MenuBuilderRestaurant[]): string {
  const restoMarc = restaurants.find(
    (restaurant) =>
      restaurant.slug === "resto-marc" ||
      restaurant.name.toLowerCase().includes("resto marc")
  );
  return restoMarc?.id ?? restaurants[0]?.id ?? "";
}

function emptyMenu(restaurant: MenuBuilderRestaurant | undefined): PublicMenu {
  return {
    restaurantId: restaurant?.id ?? "",
    slug: restaurant?.slug ?? "restaurant",
    name: restaurant?.name ?? "Restaurant",
    location: "",
    cuisineType: "",
    googleReview: {
      enabled: false,
      googleReviewUrl: ""
    },
    settings: serializePublicMenuSettings(DEFAULT_PUBLIC_MENU_SETTINGS),
    source: "supabase",
    dishes: []
  };
}

function localDish(args: {
  id: string;
  name: string;
  category: string;
  description: string;
  priceLabel: string;
}): PublicMenuDish {
  return {
    id: args.id,
    slug: args.id,
    name: args.name,
    description: args.description,
    category: args.category,
    priceLabel: args.priceLabel,
    priceCents:
      Math.max(
        0,
        Math.round(
          Number(args.priceLabel.replace(",", ".").replace(/[^0-9.]/g, "")) * 100
        )
      ) || 0,
    priceCurrency: "CAD",
    baseCurrency: "CAD",
    displayPriceMode: "auto",
    imageUrl: "",
    thumbnailUrl: "",
    hasPhoto: false,
    photoStatus: "missing",
    hasImmersive: false,
    has3d: false,
    hasAr: false,
    hasIosAr: false,
    hasAndroidAr: false,
    model3dUrl: "",
    webModel3dUrl: "",
    webModel3dBytes: 0,
    arModel3dUrl: "",
    arModel3dBytes: 0,
    usdzUrl: "",
    arUsdzUrl: "",
    arUsdzBytes: 0,
    posterUrl: "",
    modelStatus: "missing",
    available: true,
    ingredients: [],
    allergens: [],
    options: [],
    houseNote: "",
    tags: []
  };
}

function parseQuickImport(
  raw: string,
  restaurant: MenuBuilderRestaurant | undefined
): QuickImportResult {
  const errors: string[] = [];
  const dishes: PublicMenuDish[] = [];
  const categories = new Set<string>();
  let currentCategory = "";

  raw
    .split("\n")
    .map((line) => line.trim())
    .forEach((line, index) => {
      if (!line) return;
      if (!line.includes("|")) {
        currentCategory = line.slice(0, 80) || "Carte";
        categories.add(currentCategory);
        return;
      }

      const [rawName = "", rawPrice = "", rawDescription = ""] = line
        .split("|")
        .map((item) => item.trim());
      if (!rawName) {
        errors.push(`Ligne ${index + 1}: nom du plat manquant.`);
        return;
      }
      if (!currentCategory) {
        currentCategory = "Carte";
        categories.add(currentCategory);
      }
      const id = slugify(`${currentCategory}-${rawName}`) || `plat-${dishes.length + 1}`;
      dishes.push(
        localDish({
          id,
          name: rawName.slice(0, 120),
          category: currentCategory,
          description: rawDescription.slice(0, 360),
          priceLabel: formatPriceLabel(rawPrice)
        })
      );
    });

  return {
    menu: {
      ...emptyMenu(restaurant),
      source: "demo",
      dishes
    },
    errors,
    categoryCount: categories.size,
    dishCount: dishes.length
  };
}

function statusLabel(state: SaveState): string {
  if (state === "saving") return "Sauvegarde en cours...";
  if (state === "saved") return "Draft UI sauvegarde.";
  if (state === "publishing") return "Publication en cours...";
  if (state === "published") return "Config UI publiee.";
  if (state === "error") return "Action impossible pour le moment.";
  if (state === "dirty") return "Modifications non sauvegardees.";
  return "Pret.";
}

function optionLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function configFromTheme(
  theme: MenuUiConfig["theme"],
  restaurant: MenuBuilderRestaurant | undefined
): MenuUiConfig {
  return normalizeMenuUiConfig(
    buildConfigFromTheme(theme, {
      name: restaurant?.name,
      slug: restaurant?.slug
    })
  );
}

export function MenuUiBuilder({
  restaurants,
  source,
  note
}: MenuUiBuilderProps) {
  const initialRestaurantId = preferRestaurant(restaurants);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(initialRestaurantId);
  const selectedRestaurant = useMemo(
    () =>
      restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ??
      restaurants[0],
    [restaurants, selectedRestaurantId]
  );
  const [config, setConfig] = useState<MenuUiConfig>(() =>
    menuUiConfigForRestaurant(selectedRestaurant ?? {})
  );
  const [pendingVariation, setPendingVariation] = useState<MenuUiConfig | null>(
    null
  );
  const [menuData, setMenuData] = useState<MenuDataPayload | null>(null);
  const [localDraft, setLocalDraft] = useState<QuickImportResult | null>(null);
  const [quickImportText, setQuickImportText] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [configStatus, setConfigStatus] = useState<ConfigPayload["status"]>("draft");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [qrState, setQrState] = useState<{
    redirectUrl: string;
    targetPath: string;
    persisted: boolean;
  } | null>(null);
  const [qrAvailability, setQrAvailability] =
    useState<QrAvailability>("loading");
  const qrGenerationRequest = useRef<AbortController | null>(null);
  const [advisorState, setAdvisorState] = useState<AdvisorState>("idle");
  const [advisorRecommendation, setAdvisorRecommendation] =
    useState<MenuStyleAdvisorRecommendation | null>(null);
  const [previewDevice, setPreviewDevice] =
    useState<PreviewDeviceId>("phone-430");
  const [previewMode, setPreviewMode] =
    useState<PreviewMode>("client-menu");
  const [themeCompare, setThemeCompare] = useState(false);
  const [blueprintCompare, setBlueprintCompare] = useState(false);
  const [qualityDetailsOpen, setQualityDetailsOpen] = useState(false);
  const [designImportText, setDesignImportText] = useState("");

  const publicMenuPath = selectedRestaurant?.publicMenuPath ?? "/menu/resto-marc";
  const publicMenuUrl = selectedRestaurant?.publicMenuUrl ?? publicMenuPath;
  const previewMenu = localDraft?.menu ?? menuData?.menu ?? emptyMenu(selectedRestaurant);
  const previewConfig = pendingVariation ?? config;
  const photoCount = previewMenu.dishes.filter((dish) => dish.hasPhoto).length;
  const modelCount = previewMenu.dishes.filter((dish) => dish.has3d).length;
  const arCount = previewMenu.dishes.filter((dish) => dish.hasAr).length;
  const activeBlueprint = blueprintById(previewConfig.experience.blueprint);
  const selectedPreviewDevice =
    PREVIEW_DEVICES.find((device) => device.id === previewDevice) ??
    PREVIEW_DEVICES[1];
  const designExportText = useMemo(
    () => exportMenuDesignConfig(previewConfig),
    [previewConfig]
  );
  const qualityResult: MenuDesignQualityResult = useMemo(
    () =>
      evaluateMenuDesignQuality({
        restaurant: selectedRestaurant,
        menu: previewMenu,
        config: previewConfig,
        publicMenuPath,
        publicRouteOk: true,
        qrTargetKind: "menu",
        qrTargetPath: qrState?.targetPath ?? publicMenuPath,
        configStatus,
        publicOwnerWarningsExposed: false
      }),
    [
      selectedRestaurant,
      previewMenu,
      previewConfig,
      publicMenuPath,
      qrState?.targetPath,
      configStatus
    ]
  );
  const sourceLabel = localDraft
    ? "Source : Draft local importe"
    : menuData?.source === "supabase"
      ? "Source : Supabase"
      : "Source : Fallback demo";
  const labMenu = useMemo(() => {
    if (previewMode === "empty-state") {
      return { ...previewMenu, dishes: [] };
    }
    if (previewMode === "missing-photos") {
      return {
        ...previewMenu,
        dishes: previewMenu.dishes.map((dish) => ({
          ...dish,
          imageUrl: "",
          thumbnailUrl: "",
          hasPhoto: false,
          photoStatus: "missing" as const
        }))
      };
    }
    if (previewMode === "immersive-state") {
      return {
        ...previewMenu,
        dishes: previewMenu.dishes.map((dish, index) => ({
          ...dish,
          hasImmersive: index < 4 ? true : dish.hasImmersive,
          has3d: index < 4 ? true : dish.has3d,
          hasAr: index < 4 ? true : dish.hasAr,
          hasIosAr: index < 4 ? true : dish.hasIosAr,
          hasAndroidAr: index < 4 ? true : dish.hasAndroidAr,
          modelStatus: index < 4 ? ("ready" as const) : dish.modelStatus
        }))
      };
    }
    return previewMenu;
  }, [previewMenu, previewMode]);
  const labDish = labMenu.dishes[0] ?? previewMenu.dishes[0] ?? null;

  useEffect(() => {
    if (!selectedRestaurant?.id) return;
    const controller = new AbortController();
    qrGenerationRequest.current?.abort();
    qrGenerationRequest.current = null;

    async function load() {
      setLoadState("loading");
      setErrorMessage("");
      setLocalDraft(null);
      setQuickImportText("");
      setQrState(null);
      setQrAvailability("loading");
      setConfig(menuUiConfigForRestaurant(selectedRestaurant));
      setPendingVariation(null);
      setConfigStatus("draft");

      try {
        const id = encodeURIComponent(selectedRestaurant.id);
        const qrQuery = new URLSearchParams({
          restaurantId: selectedRestaurant.id,
          targetKind: "menu",
          purposeKey: "default"
        });
        const [menuResponse, configResponse, qrResponse] = await Promise.all([
          fetch(`/api/owner/menu-data?restaurantId=${id}`, {
            signal: controller.signal
          }),
          fetch(`/api/owner/menu-ui-config?restaurantId=${id}`, {
            signal: controller.signal
          }),
          fetch(`/api/owner/qr-codes?${qrQuery}`, {
            cache: "no-store",
            signal: controller.signal
          }).catch(() => null)
        ]);
        const menuPayload = (await menuResponse.json()) as
          | MenuDataPayload
          | ApiFailure;
        const configPayload = (await configResponse.json()) as
          | ConfigPayload
          | ApiFailure;
        const qrPayload = qrResponse
          ? ((await qrResponse.json()) as QrReadPayload | ApiFailure)
          : null;
        const canonicalQr = qrPayload?.ok
          ? qrPayload.canonical ?? qrPayload.record
          : null;

        if (!controller.signal.aborted) {
          if (menuResponse.ok && menuPayload.ok) {
            setMenuData(menuPayload);
          } else {
            setMenuData(null);
            setErrorMessage(
              menuPayload.ok
                ? "Chargement des plats impossible."
                : apiErrorMessage(menuPayload, "Chargement des plats impossible.")
            );
          }
          if (configResponse.ok && configPayload.ok) {
            setConfig(configPayload.config);
            setConfigStatus(configPayload.status);
          }
          if (
            qrResponse?.ok &&
            qrPayload?.ok &&
            qrPayload.found &&
            qrPayload.recoverable &&
            canonicalQr?.redirectUrl &&
            isOpaqueQrRedirect(canonicalQr.redirectUrl)
          ) {
            setQrState({
              redirectUrl: canonicalQr.redirectUrl,
              targetPath: canonicalQr.targetPath,
              persisted: canonicalQr.persisted
            });
            setQrAvailability("available");
          } else if (qrResponse?.ok && qrPayload?.ok && qrPayload.found) {
            setQrAvailability("unrecoverable");
          } else if (qrResponse?.ok && qrPayload?.ok) {
            setQrAvailability("absent");
          } else {
            setQrAvailability("failed");
          }
          setLoadState("ready");
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadState("error");
          setMenuData(null);
          setErrorMessage("Erreur reseau pendant le chargement du builder.");
        }
      }
    }

    void load();
    return () => {
      controller.abort();
      qrGenerationRequest.current?.abort();
      qrGenerationRequest.current = null;
    };
  }, [selectedRestaurant]);

  function updateConfig(patch: Partial<MenuUiConfig>) {
    setConfig((current) =>
      normalizeMenuUiConfig(
        mergeCustomConfig(current, {
          ...patch,
          custom: true,
          updatedAt: new Date().toISOString()
        })
      )
    );
    setPendingVariation(null);
    setSaveState("dirty");
  }

  async function saveDraft(configOverride?: MenuUiConfig) {
    if (!selectedRestaurant) return;
    const configToSave = configOverride ?? pendingVariation ?? config;
    setSaveState("saving");
    setErrorMessage("");
    try {
      const response = await fetch("/api/owner/menu-ui-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          config: configToSave
        })
      });
      const payload = (await response.json()) as
        | ConfigPayload
        | ApiFailure;
      if (!response.ok || !payload.ok) {
        setSaveState("error");
        setErrorMessage(
          payload.ok ? "Sauvegarde impossible." : apiErrorMessage(payload, "Sauvegarde impossible.")
        );
        return;
      }
      setConfig(payload.config);
      setPendingVariation(null);
      setConfigStatus(payload.status);
      setSaveState("saved");
    } catch {
      setSaveState("error");
      setErrorMessage("Erreur reseau pendant la sauvegarde.");
    }
  }

  async function publishConfig() {
    if (!selectedRestaurant) return;
    const configToPublish = pendingVariation ?? config;
    if (qualityResult.blockers.length > 0) {
      setSaveState("error");
      setErrorMessage(
        `Publication bloquee: ${qualityResult.blockers.slice(0, 2).join(" ")}`
      );
      return;
    }
    setSaveState("publishing");
    setErrorMessage("");
    try {
      const response = await fetch("/api/owner/menu-ui-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          action: "publish",
          config: configToPublish
        })
      });
      const payload = (await response.json()) as
        | ConfigPayload
        | ApiFailure;
      if (!response.ok || !payload.ok) {
        setSaveState("error");
        setErrorMessage(
          payload.ok ? "Publication impossible." : apiErrorMessage(payload, "Publication impossible.")
        );
        return;
      }
      setConfig(payload.config);
      setPendingVariation(null);
      setConfigStatus(payload.status);
      setSaveState("published");
    } catch {
      setSaveState("error");
      setErrorMessage("Erreur reseau pendant la publication.");
    }
  }

  async function revertToPublishedConfig() {
    if (!selectedRestaurant) return;
    setSaveState("saving");
    setErrorMessage("");
    try {
      const response = await fetch("/api/owner/menu-ui-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          action: "revert-to-published"
        })
      });
      const payload = (await response.json()) as ConfigPayload | ApiFailure;
      if (!response.ok || !payload.ok) {
        setSaveState("error");
        setErrorMessage(
          payload.ok
            ? "Retour a la config publiee impossible."
            : apiErrorMessage(payload, "Retour a la config publiee impossible.")
        );
        return;
      }
      setConfig(payload.config);
      setPendingVariation(null);
      setConfigStatus(payload.status);
      setSaveState("saved");
    } catch {
      setSaveState("error");
      setErrorMessage("Erreur reseau pendant le retour a la config publiee.");
    }
  }

  async function rollbackPublishedConfig() {
    if (!selectedRestaurant) return;
    setSaveState("publishing");
    setErrorMessage("");
    try {
      const response = await fetch("/api/owner/menu-ui-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          action: "rollback"
        })
      });
      const payload = (await response.json()) as ConfigPayload | ApiFailure;
      if (!response.ok || !payload.ok) {
        setSaveState("error");
        setErrorMessage(
          payload.ok
            ? "Rollback impossible."
            : apiErrorMessage(payload, "Rollback impossible.")
        );
        return;
      }
      setConfig(payload.config);
      setPendingVariation(null);
      setConfigStatus(payload.status);
      setSaveState("published");
    } catch {
      setSaveState("error");
      setErrorMessage("Erreur reseau pendant le rollback.");
    }
  }

  async function generateQr() {
    if (!selectedRestaurant || qrState) return;
    if (qrAvailability !== "absent") return;
    qrGenerationRequest.current?.abort();
    const controller = new AbortController();
    qrGenerationRequest.current = controller;
    const restaurant = selectedRestaurant;
    setErrorMessage("");
    setQrAvailability("creating");
    try {
      const response = await fetch("/api/owner/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          restaurantId: restaurant.id,
          label: `QR menu - ${restaurant.name}`,
          targetKind: "menu",
          style: {
            ...DEFAULT_OWNER_QR_STYLE,
            logoText: monogramFromName(restaurant.name)
          }
        })
      });
      const payload = (await response.json()) as QrPayload | ApiFailure;
      if (controller.signal.aborted) return;
      if (!response.ok || !payload.ok) {
        setQrAvailability(
          !payload.ok && payload.code === "canonical-unrecoverable"
            ? "unrecoverable"
            : "failed"
        );
        setErrorMessage(
          payload.ok
            ? "Generation QR impossible."
            : apiErrorMessage(payload, "Generation QR impossible.")
        );
        return;
      }
      if (
        payload.targetKind !== "menu" ||
        !isOpaqueQrRedirect(payload.redirectUrl) ||
        !payload.targetPath
      ) {
        setQrAvailability("failed");
        setErrorMessage("La reponse QR recue est invalide. Rechargez la page.");
        return;
      }
      setQrState({
        redirectUrl: payload.redirectUrl,
        targetPath: payload.targetPath,
        persisted: payload.persisted
      });
      setQrAvailability("available");
    } catch {
      if (!controller.signal.aborted) {
        setQrAvailability("failed");
        setErrorMessage("Erreur reseau pendant la generation QR.");
      }
    } finally {
      if (qrGenerationRequest.current === controller) {
        qrGenerationRequest.current = null;
      }
    }
  }

  function blueprintById(id: MenuUiConfig["experience"]["blueprint"]) {
    return (
      MENU_EXPERIENCE_BLUEPRINTS.find((blueprint) => blueprint.id === id) ??
      MENU_EXPERIENCE_BLUEPRINTS[0]
    );
  }

  function applyBlueprint(id: MenuUiConfig["experience"]["blueprint"]) {
    const blueprint = blueprintById(id);
    updateConfig({
      experience: {
        blueprint: blueprint.id,
        ...blueprint.experienceDefaults
      },
      welcome: {
        ...previewConfig.welcome,
        layout: blueprint.defaultWelcomeLayout
      },
      navigation: {
        ...previewConfig.navigation,
        style: blueprint.defaultNavigation
      },
      cards: {
        ...previewConfig.cards,
        variant: blueprint.defaultCardVariant
      },
      detail: {
        ...previewConfig.detail,
        style: blueprint.defaultDetailStyle,
        dishOpenMode: blueprint.defaultDishOpenMode
      },
      defaultView: blueprint.id === "compact-qr" ? "all" : previewConfig.defaultView,
      welcomeEnabled: blueprint.id === "compact-qr" ? false : previewConfig.welcomeEnabled
    });
  }

  function configWithAdvisorProposal(proposal: MenuStyleAdvisorProposal): MenuUiConfig {
    return normalizeMenuUiConfig(
      mergeCustomConfig(previewConfig, {
        ...proposal.configPatch,
        custom: true,
        updatedAt: new Date().toISOString()
      })
    );
  }

  function configWithAdvisorPatch(
    recommendation: MenuStyleAdvisorRecommendation
  ): MenuUiConfig {
    return configWithAdvisorProposal(recommendation.primary);
  }

  async function requestMistralAdvisor() {
    if (!selectedRestaurant) return;
    setAdvisorState("loading");
    setAdvisorRecommendation(null);
    setErrorMessage("");

    try {
      const response = await fetch("/api/owner/menu-style-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          restaurantName: selectedRestaurant.name,
          restaurantSlug: selectedRestaurant.slug,
          cuisineType: previewMenu.cuisineType,
          location: previewMenu.location,
          dishCount: previewMenu.dishes.length,
          categories: Array.from(new Set(previewMenu.dishes.map((dish) => dish.category))),
          sampleDishes: previewMenu.dishes.slice(0, 8).map((dish) => dish.name),
          photoCount,
          modelCount,
          arCount,
          currentConfig: previewConfig
        })
      });
      const payload = (await response.json()) as AdvisorPayload | ApiFailure;
      if (!response.ok || !payload.ok) {
        setAdvisorState("error");
        setErrorMessage(
          payload.ok
            ? "Conseil Mistral impossible."
            : apiErrorMessage(payload, "Conseil Mistral impossible.")
        );
        return;
      }
      setAdvisorRecommendation(payload.recommendation);
      setAdvisorState("ready");
    } catch {
      setAdvisorState("error");
      setErrorMessage("Erreur reseau pendant le conseil Mistral.");
    }
  }

  function applyAdvisorRecommendation() {
    if (!advisorRecommendation) return;
    setConfig(configWithAdvisorPatch(advisorRecommendation));
    setPendingVariation(null);
    setSaveState("dirty");
  }

  function previewAdvisorVariation() {
    if (!advisorRecommendation) return;
    setPendingVariation(configWithAdvisorPatch(advisorRecommendation));
    setSaveState("dirty");
  }

  function applyAdvisorProposal(proposal: MenuStyleAdvisorProposal) {
    setConfig(configWithAdvisorProposal(proposal));
    setPendingVariation(null);
    setSaveState("dirty");
  }

  function previewAdvisorProposal(proposal: MenuStyleAdvisorProposal) {
    setPendingVariation(configWithAdvisorProposal(proposal));
    setSaveState("dirty");
  }

  function ignoreAdvisorRecommendation() {
    setAdvisorRecommendation(null);
    setAdvisorState("idle");
  }

  function applyQuickImport() {
    const parsed = parseQuickImport(quickImportText, selectedRestaurant);
    setLocalDraft(parsed);
    setSaveState("dirty");
  }

  function importDesignConfig() {
    const imported = importMenuDesignConfig(designImportText);
    if (!imported.ok) {
      setErrorMessage(imported.error);
      setSaveState("error");
      return;
    }
    setConfig(imported.config);
    setPendingVariation(null);
    setSaveState("dirty");
    setErrorMessage("");
  }

  async function copyDesignConfig() {
    try {
      await navigator.clipboard.writeText(designExportText);
      setErrorMessage("");
    } catch {
      setErrorMessage("Copie JSON indisponible sur ce navigateur.");
    }
  }

  function duplicateCurrentDesign() {
    setPendingVariation(duplicateMenuDesignConfig(previewConfig));
    setSaveState("dirty");
  }

  function applyQualityQuickFix(kind: "compact-qr" | "hide-owner-warnings" | "safe-missing" | "default-all" | "no-autoload") {
    if (kind === "compact-qr") {
      applyBlueprint("compact-qr");
      return;
    }
    if (kind === "hide-owner-warnings") {
      updateConfig({
        photos: {
          ...previewConfig.photos,
          ownerMissingWarnings: false
        }
      });
      return;
    }
    if (kind === "safe-missing") {
      updateConfig({
        photos: {
          ...previewConfig.photos,
          publicMissingBehavior: "placeholder"
        }
      });
      return;
    }
    if (kind === "default-all") {
      updateConfig({ defaultView: "all" });
      return;
    }
    updateConfig({
      immersive: {
        ...previewConfig.immersive,
        autoLoad: false
      }
    });
  }

  function applyTheme(theme: MenuUiConfig["theme"]) {
    const themed = configFromTheme(theme, selectedRestaurant);
    setConfig(
      normalizeMenuUiConfig({
        ...themed,
        experience: previewConfig.experience
      })
    );
    setPendingVariation(null);
    setSaveState("dirty");
  }

  function createUniqueVariation() {
    setPendingVariation(
      normalizeMenuUiConfig(
        createMenuThemeVariation(
          previewConfig,
          `${selectedRestaurant?.id ?? "restaurant"}:${Date.now()}`
        )
      )
    );
    setSaveState("dirty");
  }

  function applyVariation() {
    if (!pendingVariation) return;
    setConfig(pendingVariation);
    setPendingVariation(null);
    setSaveState("dirty");
  }

  function cancelVariation() {
    setPendingVariation(null);
  }

  if (restaurants.length === 0) {
    return (
      <section className={styles.emptyBuilder}>
        <p className={styles.eyebrow}>Menu Design Studio</p>
        <h3>Aucun restaurant disponible</h3>
        <p>
          Creez d&apos;abord un restaurant dans le owner dashboard pour generer une
          experience menu.
        </p>
      </section>
    );
  }

  return (
    <div className={styles.builderShell}>
      <aside className={styles.controls}>
        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Source</p>
              <h3>Restaurant</h3>
            </div>
            <span className={styles.sourceBadge}>{source}</span>
          </div>

          <label className={styles.field}>
            Restaurant
            <select
              value={selectedRestaurantId}
              onChange={(event) => {
                setSelectedRestaurantId(event.target.value);
                setSaveState("idle");
              }}
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name} - {restaurant.slug}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.infoBox}>
            <span>{sourceLabel}</span>
            <strong>{publicMenuPath}</strong>
            <small>{menuData?.note ?? note}</small>
            <small>
              {loadState === "loading"
                ? "Chargement des vrais plats..."
                : loadState === "error"
                  ? "Chargement impossible."
                  : "Donnees pretes."}
            </small>
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Style preset</p>
              <h3>Menu Design Studio</h3>
            </div>
          </div>

          <div className={styles.themeGrid}>
            {MENU_THEME_PRESETS.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`${styles.themeButton} ${
                  theme.id === previewConfig.theme ? styles.themeButtonActive : ""
                }`}
                onClick={() => applyTheme(theme.id)}
              >
                <strong>{theme.name}</strong>
                <span>{theme.description}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setThemeCompare((value) => !value)}
          >
            Comparer les 12 themes
          </button>
          {themeCompare ? (
            <div className={styles.compareGrid}>
              {MENU_THEME_PRESETS.map((theme) => (
                <button
                  key={`themeCompare-${theme.id}`}
                  type="button"
                  className={styles.compareTile}
                  onClick={() => applyTheme(theme.id)}
                  style={{
                    "--tile-bg": theme.palette.background,
                    "--tile-surface": theme.palette.surface,
                    "--tile-text": theme.palette.text,
                    "--tile-accent": theme.palette.accent
                  } as CSSProperties}
                >
                  <span>{theme.name}</span>
                  <strong>{theme.global.backgroundStyle}</strong>
                  <small>{theme.cards.variant}</small>
                </button>
              ))}
            </div>
          ) : null}

          <div className={styles.variationBox}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={createUniqueVariation}
            >
              Créer variation unique
            </button>
            {pendingVariation ? (
              <>
                <p className={styles.saveStatus}>
                  Variation locale non sauvegardée
                </p>
                <div className={styles.actionGrid}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={applyVariation}
                  >
                    Appliquer
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={cancelVariation}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => saveDraft(pendingVariation)}
                  >
                    Sauvegarder draft
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={duplicateCurrentDesign}
                >
                  Dupliquer design
                </button>
              </div>
            </>
          ) : null}
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Structure du menu</p>
              <h3>Experience blueprint</h3>
            </div>
          </div>

          <div className={styles.themeGrid}>
            {MENU_EXPERIENCE_BLUEPRINTS.map((blueprint) => (
              <button
                key={blueprint.id}
                type="button"
                className={`${styles.themeButton} ${
                  blueprint.id === previewConfig.experience.blueprint
                    ? styles.themeButtonActive
                    : ""
                }`}
                onClick={() => applyBlueprint(blueprint.id)}
              >
                <strong>{blueprint.name}</strong>
                <span>{blueprint.description}</span>
                <small>{blueprint.bestFor.join(" / ")}</small>
              </button>
            ))}
          </div>

          <div className={styles.infoBox}>
            <span>{activeBlueprint.name}</span>
            <strong>{activeBlueprint.previewNotes.join(" / ")}</strong>
            <small>
              Theme = couleurs/tokens. Blueprint = ordre, densite, navigation et
              experience de lecture.
            </small>
          </div>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setBlueprintCompare((value) => !value)}
          >
            Comparer les 12 structures
          </button>
          {blueprintCompare ? (
            <div className={styles.compareGrid}>
              {MENU_EXPERIENCE_BLUEPRINTS.map((blueprint) => (
                <button
                  key={`blueprintCompare-${blueprint.id}`}
                  type="button"
                  className={styles.compareTile}
                  onClick={() => applyBlueprint(blueprint.id)}
                >
                  <span>{blueprint.name}</span>
                  <strong>{blueprint.renderStrategy}</strong>
                  <small>{blueprint.previewNotes.join(" / ")}</small>
                </button>
              ))}
            </div>
          ) : null}

          <div className={styles.optionGrid}>
            <label className={styles.field}>
              Home layout
              <select
                value={previewConfig.experience.homeLayout}
                onChange={(event) =>
                  updateConfig({
                    experience: {
                      ...previewConfig.experience,
                      homeLayout: event.target
                        .value as MenuUiConfig["experience"]["homeLayout"]
                    }
                  })
                }
              >
                {MENU_HOME_LAYOUT_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Category presentation
              <select
                value={previewConfig.experience.categoryPresentation}
                onChange={(event) =>
                  updateConfig({
                    experience: {
                      ...previewConfig.experience,
                      categoryPresentation: event.target
                        .value as MenuUiConfig["experience"]["categoryPresentation"]
                    }
                  })
                }
              >
                {MENU_CATEGORY_PRESENTATION_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Dish list presentation
              <select
                value={previewConfig.experience.dishListPresentation}
                onChange={(event) =>
                  updateConfig({
                    experience: {
                      ...previewConfig.experience,
                      dishListPresentation: event.target
                        .value as MenuUiConfig["experience"]["dishListPresentation"]
                    }
                  })
                }
              >
                {MENU_DISH_LIST_PRESENTATION_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Detail presentation
              <select
                value={previewConfig.experience.detailPresentation}
                onChange={(event) =>
                  updateConfig({
                    experience: {
                      ...previewConfig.experience,
                      detailPresentation: event.target
                        .value as MenuUiConfig["experience"]["detailPresentation"]
                    }
                  })
                }
              >
                {MENU_DETAIL_PRESENTATION_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Featured dishes mode
              <select
                value={previewConfig.experience.featuredMode}
                onChange={(event) =>
                  updateConfig({
                    experience: {
                      ...previewConfig.experience,
                      featuredMode: event.target
                        .value as MenuUiConfig["experience"]["featuredMode"]
                    }
                  })
                }
              >
                {MENU_FEATURED_MODE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Section order
              <select
                value={previewConfig.experience.sectionOrder}
                onChange={(event) =>
                  updateConfig({
                    experience: {
                      ...previewConfig.experience,
                      sectionOrder: event.target
                        .value as MenuUiConfig["experience"]["sectionOrder"]
                    }
                  })
                }
              >
                {MENU_SECTION_ORDER_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.toggleGrid}>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={previewConfig.welcomeEnabled}
                onChange={(event) => updateConfig({ welcomeEnabled: event.target.checked })}
              />
              Show hero
            </label>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={previewConfig.experience.sectionOrder === "categories-then-featured"}
                onChange={(event) =>
                  updateConfig({
                    experience: {
                      ...previewConfig.experience,
                      sectionOrder: event.target.checked
                        ? "categories-then-featured"
                        : previewConfig.experience.sectionOrder
                    }
                  })
                }
              />
              Show categories first
            </label>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={previewConfig.experience.sectionOrder === "all-menu-first"}
                onChange={(event) =>
                  updateConfig({
                    experience: {
                      ...previewConfig.experience,
                      sectionOrder: event.target.checked
                        ? "all-menu-first"
                        : previewConfig.experience.sectionOrder
                    }
                  })
                }
              />
              Show all menu first
            </label>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={previewConfig.experience.blueprint === "compact-qr"}
                onChange={(event) =>
                  event.target.checked
                    ? applyBlueprint("compact-qr")
                    : applyBlueprint("classic-tabs")
                }
              />
              Compact QR mode
            </label>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={previewConfig.experience.blueprint === "immersive-first"}
                onChange={(event) =>
                  event.target.checked
                    ? applyBlueprint("immersive-first")
                    : applyBlueprint("classic-tabs")
                }
              />
              Immersive first mode
            </label>
          </div>

          <div className={styles.variationBox}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={requestMistralAdvisor}
              disabled={advisorState === "loading"}
            >
              Me conseiller avec Mistral
            </button>
            {advisorState === "loading" ? (
              <p className={styles.saveStatus}>Analyse du restaurant...</p>
            ) : null}
            {advisorRecommendation ? (
              <div className={styles.infoBox}>
                <span>
                  {advisorRecommendation.source === "rules"
                    ? "Conseil genere par regles locales"
                    : "Conseil Mistral"}
                </span>
                <strong>
                  {optionLabel(advisorRecommendation.primary.theme)} /{" "}
                  {optionLabel(advisorRecommendation.primary.blueprint)}
                </strong>
                <small>{advisorRecommendation.primary.reason}</small>
                <small>
                  Confidence {Math.round(advisorRecommendation.primary.confidence * 100)}%
                </small>
                <small>
                  Analyse: {advisorRecommendation.analysis.restaurantType} /{" "}
                  {advisorRecommendation.analysis.photoReadiness} photos /{" "}
                  {advisorRecommendation.analysis.immersiveReadiness} immersive
                </small>
                {advisorRecommendation.primary.warnings.map((warning) => (
                  <small key={warning}>{warning}</small>
                ))}
                <div className={styles.actionGrid}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={applyAdvisorRecommendation}
                  >
                    Appliquer
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={previewAdvisorVariation}
                  >
                    Voir variation
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={ignoreAdvisorRecommendation}
                  >
                    Ignorer
                  </button>
                </div>
                {advisorRecommendation.alternatives.length ? (
                  <div className={styles.proposalGrid}>
                    {advisorRecommendation.alternatives.map((proposal) => (
                      <div
                        key={`${proposal.theme}-${proposal.blueprint}-${proposal.bestFor ?? proposal.reason}`}
                        className={styles.proposalCard}
                      >
                        <span>{proposal.bestFor ?? "Alternative"}</span>
                        <strong>
                          {optionLabel(proposal.theme)} / {optionLabel(proposal.blueprint)}
                        </strong>
                        <small>{proposal.reason}</small>
                        <small>Confidence {Math.round(proposal.confidence * 100)}%</small>
                        <div className={styles.actionGrid}>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => previewAdvisorProposal(proposal)}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => applyAdvisorProposal(proposal)}
                          >
                            Appliquer
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => saveDraft(configWithAdvisorProposal(proposal))}
                          >
                            Sauvegarder draft
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Custom couleurs</p>
              <h3>Palette</h3>
            </div>
          </div>

          <div className={styles.colorGrid}>
            {PALETTE_FIELDS.map((field) => (
              <label key={field} className={styles.colorField}>
                <span>{optionLabel(field)}</span>
                <input
                  type="color"
                  value={previewConfig.palette[field]}
                  onChange={(event) =>
                    updateConfig({
                      palette: {
                        ...previewConfig.palette,
                        [field]: event.target.value
                      }
                    })
                  }
                />
                <small>{previewConfig.palette[field]}</small>
              </label>
            ))}
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Typography</p>
              <h3>Type system</h3>
            </div>
          </div>

          <div className={styles.optionGrid}>
            <label className={styles.field}>
              Heading style
              <select
                value={previewConfig.typography.headingStyle}
                onChange={(event) =>
                  updateConfig({
                    typography: {
                      ...previewConfig.typography,
                      headingStyle: event.target
                        .value as MenuUiConfig["typography"]["headingStyle"]
                    }
                  })
                }
              >
                {MENU_UI_HEADING_STYLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Body style
              <select
                value={previewConfig.typography.bodyStyle}
                onChange={(event) =>
                  updateConfig({
                    typography: {
                      ...previewConfig.typography,
                      bodyStyle: event.target
                        .value as MenuUiConfig["typography"]["bodyStyle"]
                    }
                  })
                }
              >
                {MENU_UI_BODY_STYLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Price style
              <select
                value={previewConfig.typography.priceStyle}
                onChange={(event) =>
                  updateConfig({
                    typography: {
                      ...previewConfig.typography,
                      priceStyle: event.target
                        .value as MenuUiConfig["typography"]["priceStyle"]
                    },
                    cards: {
                      ...previewConfig.cards,
                      priceStyle: event.target
                        .value as MenuUiConfig["cards"]["priceStyle"]
                    }
                  })
                }
              >
                {MENU_UI_PRICE_STYLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Title scale
              <select
                value={previewConfig.typography.titleScale}
                onChange={(event) =>
                  updateConfig({
                    typography: {
                      ...previewConfig.typography,
                      titleScale: event.target
                        .value as MenuUiConfig["typography"]["titleScale"]
                    }
                  })
                }
              >
                {MENU_UI_TITLE_SCALE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Background</p>
              <h3>Surface globale</h3>
            </div>
          </div>

          <div className={styles.optionGrid}>
            <label className={styles.field}>
              Background style
              <select
                value={previewConfig.global.backgroundStyle}
                onChange={(event) =>
                  updateConfig({
                    global: {
                      ...previewConfig.global,
                      backgroundStyle: event.target
                        .value as MenuUiConfig["global"]["backgroundStyle"]
                    }
                  })
                }
              >
                {MENU_UI_BACKGROUND_STYLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Radius
              <select
                value={previewConfig.global.radius}
                onChange={(event) =>
                  updateConfig({
                    global: {
                      ...previewConfig.global,
                      radius: event.target.value as MenuUiConfig["global"]["radius"]
                    }
                  })
                }
              >
                {MENU_UI_RADIUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Shadow
              <select
                value={previewConfig.global.shadow}
                onChange={(event) =>
                  updateConfig({
                    global: {
                      ...previewConfig.global,
                      shadow: event.target.value as MenuUiConfig["global"]["shadow"]
                    }
                  })
                }
              >
                {MENU_UI_SHADOW_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Densite
              <select
                value={previewConfig.global.density}
                onChange={(event) =>
                  updateConfig({
                    global: {
                      ...previewConfig.global,
                      density: event.target.value as MenuUiConfig["global"]["density"]
                    }
                  })
                }
              >
                {MENU_UI_DENSITY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Accueil</p>
              <h3>Welcome</h3>
            </div>
          </div>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={previewConfig.welcomeEnabled}
              onChange={(event) => updateConfig({ welcomeEnabled: event.target.checked })}
            />
            Afficher l&apos;accueil
          </label>

          <label className={styles.field}>
            Titre
            <input
              maxLength={120}
              value={previewConfig.welcomeTitle}
              onChange={(event) => updateConfig({ welcomeTitle: event.target.value })}
            />
          </label>

          <label className={styles.field}>
            Sous-titre
            <input
              maxLength={180}
              value={previewConfig.welcomeSubtitle}
              onChange={(event) => updateConfig({ welcomeSubtitle: event.target.value })}
            />
          </label>

          <label className={styles.field}>
            Motion
            <select
              value={previewConfig.motion}
              onChange={(event) =>
                updateConfig({ motion: event.target.value as MenuUiConfig["motion"] })
              }
            >
              {MENU_UI_MOTION_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.optionGrid}>
            <label className={styles.field}>
              Welcome layout
              <select
                value={previewConfig.welcome.layout}
                onChange={(event) =>
                  updateConfig({
                    welcome: {
                      ...previewConfig.welcome,
                      layout: event.target
                        .value as MenuUiConfig["welcome"]["layout"]
                    }
                  })
                }
              >
                {MENU_UI_WELCOME_LAYOUT_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Background shapes
              <select
                value={previewConfig.welcome.backgroundShapes}
                onChange={(event) =>
                  updateConfig({
                    welcome: {
                      ...previewConfig.welcome,
                      backgroundShapes: event.target
                        .value as MenuUiConfig["welcome"]["backgroundShapes"]
                    }
                  })
                }
              >
                {MENU_UI_BACKGROUND_SHAPE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              setConfig(configFromTheme(previewConfig.theme, selectedRestaurant));
              setPendingVariation(null);
              setSaveState("dirty");
            }}
          >
            Reinitialiser avec le restaurant
          </button>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Navigation</p>
              <h3>Navigation & Cards plats</h3>
            </div>
          </div>

          <div className={styles.optionGrid}>
            <label className={styles.field}>
              Navigation style
              <select
                value={previewConfig.navigation.style}
                onChange={(event) =>
                  updateConfig({
                    navigation: {
                      ...previewConfig.navigation,
                      style: event.target
                        .value as MenuUiConfig["navigation"]["style"]
                    }
                  })
                }
              >
                {MENU_UI_CATEGORY_NAVIGATION_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Card variant
              <select
                value={previewConfig.cards.variant}
                onChange={(event) =>
                  updateConfig({
                    cards: {
                      ...previewConfig.cards,
                      variant: event.target.value as MenuUiConfig["cards"]["variant"]
                    }
                  })
                }
              >
                {MENU_UI_DISH_CARD_STYLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Photo shape
              <select
                value={previewConfig.cards.photoShape}
                onChange={(event) =>
                  updateConfig({
                    cards: {
                      ...previewConfig.cards,
                      photoShape: event.target
                        .value as MenuUiConfig["cards"]["photoShape"]
                    }
                  })
                }
              >
                {MENU_UI_PHOTO_SHAPE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Description length
              <select
                value={previewConfig.cards.descriptionLength}
                onChange={(event) =>
                  updateConfig({
                    cards: {
                      ...previewConfig.cards,
                      descriptionLength: event.target
                        .value as MenuUiConfig["cards"]["descriptionLength"]
                    }
                  })
                }
              >
                {MENU_UI_DESCRIPTION_LENGTH_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.toggleGrid}>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={previewConfig.navigation.showAll}
                onChange={(event) =>
                  updateConfig({
                    navigation: {
                      ...previewConfig.navigation,
                      showAll: event.target.checked
                    }
                  })
                }
              />
              Afficher &quot;Tout&quot;
            </label>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={previewConfig.navigation.showDishCounts}
                onChange={(event) =>
                  updateConfig({
                    navigation: {
                      ...previewConfig.navigation,
                      showDishCounts: event.target.checked
                    }
                  })
                }
              />
              Afficher compteurs plats
            </label>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={previewConfig.navigation.showIcons}
                onChange={(event) =>
                  updateConfig({
                    navigation: {
                      ...previewConfig.navigation,
                      showIcons: event.target.checked
                    }
                  })
                }
              />
              Afficher icons categories
            </label>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={previewConfig.cards.showTags}
                onChange={(event) =>
                  updateConfig({
                    cards: {
                      ...previewConfig.cards,
                      showTags: event.target.checked
                    }
                  })
                }
              />
              Afficher tags plats
            </label>
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Fiche detail</p>
              <h3>Ouverture plat</h3>
            </div>
          </div>

          <div className={styles.optionGrid}>
            <label className={styles.field}>
              Detail style
              <select
                value={previewConfig.detail.style}
                onChange={(event) =>
                  updateConfig({
                    detail: {
                      ...previewConfig.detail,
                      style: event.target.value as MenuUiConfig["detail"]["style"]
                    }
                  })
                }
              >
                {MENU_UI_DETAIL_STYLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Photo hero
              <select
                value={previewConfig.detail.photoHero}
                onChange={(event) =>
                  updateConfig({
                    detail: {
                      ...previewConfig.detail,
                      photoHero: event.target
                        .value as MenuUiConfig["detail"]["photoHero"]
                    }
                  })
                }
              >
                {MENU_UI_DETAIL_PHOTO_HERO_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Dish open mode
              <select
                value={previewConfig.detail.dishOpenMode}
                onChange={(event) =>
                  updateConfig({
                    detail: {
                      ...previewConfig.detail,
                      dishOpenMode: event.target
                        .value as MenuUiConfig["detail"]["dishOpenMode"]
                    }
                  })
                }
              >
                {MENU_UI_DISH_OPEN_MODE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              3D panel
              <select
                value={previewConfig.detail.modelPanelStyle}
                onChange={(event) =>
                  updateConfig({
                    detail: {
                      ...previewConfig.detail,
                      modelPanelStyle: event.target
                        .value as MenuUiConfig["detail"]["modelPanelStyle"]
                    }
                  })
                }
              >
                {MENU_UI_MODEL_PANEL_STYLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={previewConfig.detail.showShare}
              onChange={(event) =>
                updateConfig({
                  detail: {
                    ...previewConfig.detail,
                    showShare: event.target.checked
                  }
                })
              }
            />
            Afficher partage fiche
          </label>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Photos</p>
              <h3>Traitement photo</h3>
            </div>
          </div>

          <div className={styles.optionGrid}>
            <label className={styles.field}>
              Placeholder style
              <select
                value={previewConfig.photos.placeholderStyle}
                onChange={(event) =>
                  updateConfig({
                    photos: {
                      ...previewConfig.photos,
                      placeholderStyle: event.target
                        .value as MenuUiConfig["photos"]["placeholderStyle"]
                    }
                  })
                }
              >
                {MENU_UI_PHOTO_PLACEHOLDER_STYLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Public missing behavior
              <select
                value={previewConfig.photos.publicMissingBehavior}
                onChange={(event) =>
                  updateConfig({
                    photos: {
                      ...previewConfig.photos,
                      publicMissingBehavior: event.target
                        .value as MenuUiConfig["photos"]["publicMissingBehavior"]
                    }
                  })
                }
              >
                {MENU_UI_PUBLIC_MISSING_PHOTO_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={previewConfig.photos.ownerMissingWarnings}
              onChange={(event) =>
                updateConfig({
                  photos: {
                    ...previewConfig.photos,
                    ownerMissingWarnings: event.target.checked
                  }
                })
              }
            />
            Afficher warnings photos manquantes owner
          </label>

          <div className={styles.metricGrid}>
            <span>{photoCount}/{previewMenu.dishes.length} photos</span>
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>3D / AR</p>
              <h3>Immersive safe</h3>
            </div>
          </div>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={previewConfig.immersive.show3dBadge}
              onChange={(event) =>
                updateConfig({
                  immersive: {
                    ...previewConfig.immersive,
                    show3dBadge: event.target.checked
                  }
                })
              }
            />
            Afficher badges 3D si disponible
          </label>
          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={previewConfig.immersive.showArBadge}
              onChange={(event) =>
                updateConfig({
                  immersive: {
                    ...previewConfig.immersive,
                    showArBadge: event.target.checked
                  }
                })
              }
            />
            Afficher badges AR si disponible
          </label>
          <label className={styles.checkField}>
            <input type="checkbox" checked={false} disabled />
            Auto-load 3D force desactive
          </label>
          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={previewConfig.immersive.posterUntilClick}
              onChange={(event) =>
                updateConfig({
                  immersive: {
                    ...previewConfig.immersive,
                    posterUntilClick: event.target.checked
                  }
                })
              }
            />
            Garder poster jusqu&apos;au clic
          </label>

          <div className={styles.optionGrid}>
            <label className={styles.field}>
              CTA 3D
              <input
                maxLength={40}
                value={previewConfig.immersive.cta3d}
                onChange={(event) =>
                  updateConfig({
                    immersive: {
                      ...previewConfig.immersive,
                      cta3d: event.target.value
                    }
                  })
                }
              />
            </label>
            <label className={styles.field}>
              CTA AR
              <input
                maxLength={40}
                value={previewConfig.immersive.ctaAr}
                onChange={(event) =>
                  updateConfig({
                    immersive: {
                      ...previewConfig.immersive,
                      ctaAr: event.target.value
                    }
                  })
                }
              />
            </label>
          </div>

          <div className={styles.metricGrid}>
            <span>{modelCount}/{previewMenu.dishes.length} 3D</span>
            <span>{arCount}/{previewMenu.dishes.length} AR</span>
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Design config</p>
              <h3>Import / Export / Rollback</h3>
            </div>
          </div>

          <textarea
            className={styles.menuTextarea}
            readOnly
            value={designExportText}
            aria-label="Config design exportee"
          />
          <div className={styles.actionGrid}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={copyDesignConfig}
            >
              Copier config JSON
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={duplicateCurrentDesign}
            >
              Dupliquer config actuelle
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setConfig(configFromTheme(previewConfig.theme, selectedRestaurant))}
            >
              Reset theme
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => applyBlueprint("classic-tabs")}
            >
              Reset blueprint
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={revertToPublishedConfig}
            >
              Revenir a published
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={rollbackPublishedConfig}
            >
              Rollback published
            </button>
          </div>
          <textarea
            className={styles.menuTextarea}
            value={designImportText}
            placeholder="Coller une config design Vistaire JSON. Plats/prix/photos/modeles refuses."
            onChange={(event) => setDesignImportText(event.target.value)}
          />
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={importDesignConfig}
            disabled={!designImportText.trim()}
          >
            Importer config JSON safe
          </button>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Donnees</p>
              <h3>Import rapide</h3>
            </div>
          </div>

          <textarea
            className={styles.menuTextarea}
            value={quickImportText}
            placeholder={IMPORT_PLACEHOLDER}
            onChange={(event) => setQuickImportText(event.target.value)}
          />
          <div className={styles.actionGrid}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={applyQuickImport}
              disabled={!quickImportText.trim()}
            >
              Appliquer au draft preview
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setLocalDraft(null)}
            >
              Revenir aux donnees Supabase
            </button>
          </div>
          <p className={styles.helpText}>
            Donnees locales non sauvegardees. Format : categorie puis lignes
            Nom | Prix | Description.
          </p>
          {localDraft ? (
            <p className={styles.helpText}>
              Draft local : {localDraft.categoryCount} categorie(s), {localDraft.dishCount} plat(s).
            </p>
          ) : null}
          {localDraft?.errors.length ? (
            <ul className={styles.parseErrors}>
              {localDraft.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Quality</p>
              <h3>Menu Design Quality</h3>
            </div>
            <span className={styles.sourceBadge}>{qualityResult.score}/100</span>
          </div>

          <div className={styles.qualitySummary}>
            <strong>{optionLabel(qualityResult.status)}</strong>
            <span>
              {qualityResult.blockers.length === 0
                ? "Pret a publier"
                : `${qualityResult.blockers.length} blocker(s)`}
            </span>
          </div>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setQualityDetailsOpen((value) => !value)}
          >
            Voir details qualite
          </button>
          {qualityDetailsOpen ? (
            <div className={styles.qualityList}>
              {qualityResult.blockers.map((blocker) => (
                <div
                  key={blocker}
                  className={`${styles.qualityItem} ${styles.qualityBad}`}
                >
                  <span>!</span>
                  <p>{blocker}</p>
                </div>
              ))}
              {qualityResult.warnings.map((warning) => (
                <div
                  key={warning}
                  className={`${styles.qualityItem} ${styles.qualityWarn}`}
                >
                  <span>~</span>
                  <p>{warning}</p>
                </div>
              ))}
              {qualityResult.suggestions.map((suggestion) => (
                <div
                  key={suggestion}
                  className={`${styles.qualityItem} ${styles.qualityOk}`}
                >
                  <span>OK</span>
                  <p>{suggestion}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className={styles.actionGrid}>
            {previewMenu.dishes.length > 45 ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => applyQualityQuickFix("compact-qr")}
              >
                Fix compact QR
              </button>
            ) : null}
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => applyQualityQuickFix("hide-owner-warnings")}
            >
              Masquer warnings owner
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => applyQualityQuickFix("safe-missing")}
            >
              Missing photos safe
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => applyQualityQuickFix("default-all")}
            >
              Default view all
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => applyQualityQuickFix("no-autoload")}
            >
              Force no auto-load
            </button>
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Actions</p>
              <h3>Sauvegarder / publier / QR</h3>
            </div>
          </div>

          <div className={styles.actionGrid}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => saveDraft()}
              disabled={saveState === "saving" || saveState === "publishing"}
            >
              Sauvegarder draft UI
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={publishConfig}
              disabled={
                saveState === "saving" ||
                saveState === "publishing" ||
                qualityResult.blockers.length > 0
              }
            >
              Publier UI
            </button>
            <a
              className={styles.secondaryButton}
              href={publicMenuUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir menu public
            </a>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={generateQr}
              disabled={
                qrAvailability === "loading" ||
                qrAvailability === "creating" ||
                qrAvailability === "available" ||
                qrAvailability === "unrecoverable" ||
                qrAvailability === "failed"
              }
              aria-describedby="menu-builder-qr-status"
            >
              {qrAvailability === "loading"
                ? "Chargement du QR..."
                : qrAvailability === "creating"
                  ? "Creation du QR..."
                : qrAvailability === "available"
                    ? "QR menu actif"
                    : qrAvailability === "unrecoverable"
                      ? "QR inaccessible"
                      : qrAvailability === "failed"
                        ? "Etat QR indisponible"
                        : "Creer le QR menu"}
            </button>
            {qrState ? (
              <a
                className={styles.secondaryButton}
                href={qrState.redirectUrl}
                target="_blank"
                rel="noreferrer"
              >
                Tester scan QR
              </a>
            ) : (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled
                aria-describedby="menu-builder-qr-status"
              >
                Tester scan QR
              </button>
            )}
          </div>

          {qrState ? (
            <div className={styles.qrResult}>
              <strong>Destination QR</strong>
              <p>{qrState.redirectUrl} -&gt; {qrState.targetPath}</p>
              <small>{qrState.persisted ? "QR persiste" : "QR non persiste"}</small>
            </div>
          ) : null}

          <p
            id="menu-builder-qr-status"
            className={styles.saveStatus}
            aria-live="polite"
          >
            {statusLabel(saveState)}
            {qrAvailability === "absent"
              ? " Aucun QR menu n'existe encore."
              : qrAvailability === "creating"
                ? " Creation securisee du QR en cours."
                : qrAvailability === "unrecoverable"
                  ? " Le QR existant ne peut pas etre recupere. Rechargez avant toute action."
                  : qrAvailability === "failed"
                    ? " Etat du QR indisponible."
                    : ""}
            {errorMessage ? ` ${errorMessage}` : ""}
          </p>
        </section>
      </aside>

      <section className={styles.previewPane}>
        <div className={styles.previewHeader}>
          <div>
            <p className={styles.eyebrow}>Preview Lab</p>
            <h3>{previewMenu.name}</h3>
          </div>
          <span className={styles.previewUrl}>
            {optionLabel(previewConfig.theme)} + {optionLabel(previewConfig.experience.blueprint)} /{" "}
            {qualityResult.score}
          </span>
        </div>

        <div className={styles.labToolbar}>
          <div className={styles.segmentedControl} aria-label="Preview device">
            {PREVIEW_DEVICES.map((device) => (
              <button
                key={device.id}
                type="button"
                className={device.id === previewDevice ? styles.segmentActive : ""}
                onClick={() => setPreviewDevice(device.id)}
              >
                {device.label}
              </button>
            ))}
          </div>
          <div className={styles.segmentedControl} aria-label="Preview mode">
            {PREVIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={mode.id === previewMode ? styles.segmentActive : ""}
                onClick={() => setPreviewMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`${styles.phoneShell} ${styles.previewLabShell}`}
          style={{ "--preview-width": `${selectedPreviewDevice.width}px` } as CSSProperties}
          data-preview-device={previewDevice}
          data-preview-mode={previewMode}
        >
          <div className={styles.phoneScreen}>
            {previewMode === "dish-detail" && labDish ? (
              <PublicDishDetailExperience
                config={previewConfig}
                dish={labDish}
                menu={labMenu}
              />
            ) : previewMode === "qr-flow" ? (
              <div className={styles.qrFlowPreview}>
                <span>
                  {qrState ? "QR actif" : qrPreviewCopy(qrAvailability).badge}
                </span>
                <strong>
                  {qrState?.redirectUrl ?? qrPreviewCopy(qrAvailability).message}
                </strong>
                <p>
                  {qrState?.targetPath ?? qrPreviewCopy(qrAvailability).detail}
                </p>
                <PublicMenuRenderer
                  menu={labMenu}
                  config={previewConfig}
                  mode="builder-preview"
                  disableHeavyAssets
                />
              </div>
            ) : (
              <PublicMenuRenderer
                menu={labMenu}
                config={previewConfig}
                mode="builder-preview"
                disableHeavyAssets
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
