"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicMenuRenderer } from "@/components/menu/PublicMenuRenderer";
import {
  MENU_UI_BACKGROUND_SHAPE_VALUES,
  MENU_UI_BACKGROUND_STYLE_VALUES,
  MENU_UI_BODY_STYLE_VALUES,
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
  MENU_THEME_PRESETS,
  buildConfigFromTheme,
  createMenuThemeVariation,
  mergeCustomConfig
} from "@/lib/menu/menuThemePresets";
import type { PublicMenu, PublicMenuCategory, PublicMenuDish } from "@/lib/menu/publicMenuCore";
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

type LoadState = "idle" | "loading" | "ready" | "error";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "publishing" | "published" | "error";

type QuickImportResult = {
  menu: PublicMenu;
  errors: string[];
  categoryCount: number;
  dishCount: number;
};

type ApiFailure = {
  ok: false;
  error?: string;
};

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
    arModel3dUrl: "",
    usdzUrl: "",
    arUsdzUrl: "",
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
  const [configPersisted, setConfigPersisted] = useState(false);
  const [configStatus, setConfigStatus] = useState<ConfigPayload["status"]>("draft");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [qrState, setQrState] = useState<{
    redirectUrl: string;
    targetPath: string;
    persisted: boolean;
  } | null>(null);

  const publicMenuPath = selectedRestaurant?.publicMenuPath ?? "/menu/resto-marc";
  const publicMenuUrl = selectedRestaurant?.publicMenuUrl ?? publicMenuPath;
  const previewMenu = localDraft?.menu ?? menuData?.menu ?? emptyMenu(selectedRestaurant);
  const previewConfig = pendingVariation ?? config;
  const photoCount = previewMenu.dishes.filter((dish) => dish.hasPhoto).length;
  const modelCount = previewMenu.dishes.filter((dish) => dish.has3d).length;
  const arCount = previewMenu.dishes.filter((dish) => dish.hasAr).length;
  const categoryCount = new Set(previewMenu.dishes.map((dish) => dish.category)).size;
  const sourceLabel = localDraft
    ? "Source : Draft local importe"
    : menuData?.source === "supabase"
      ? "Source : Supabase"
      : "Source : Fallback demo";

  useEffect(() => {
    if (!selectedRestaurant?.id) return;
    const controller = new AbortController();

    async function load() {
      setLoadState("loading");
      setErrorMessage("");
      setLocalDraft(null);
      setQuickImportText("");
      setQrState(null);
      setConfig(menuUiConfigForRestaurant(selectedRestaurant));
      setPendingVariation(null);
      setConfigPersisted(false);
      setConfigStatus("draft");

      try {
        const id = encodeURIComponent(selectedRestaurant.id);
        const [menuResponse, configResponse] = await Promise.all([
          fetch(`/api/owner/menu-data?restaurantId=${id}`, {
            signal: controller.signal
          }),
          fetch(`/api/owner/menu-ui-config?restaurantId=${id}`, {
            signal: controller.signal
          })
        ]);
        const menuPayload = (await menuResponse.json()) as
          | MenuDataPayload
          | ApiFailure;
        const configPayload = (await configResponse.json()) as
          | ConfigPayload
          | ApiFailure;

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
            setConfigPersisted(configPayload.persisted);
            setConfigStatus(configPayload.status);
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
    return () => controller.abort();
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
      setConfigPersisted(payload.persisted);
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
      setConfigPersisted(payload.persisted);
      setConfigStatus(payload.status);
      setSaveState("published");
    } catch {
      setSaveState("error");
      setErrorMessage("Erreur reseau pendant la publication.");
    }
  }

  async function generateQr() {
    if (!selectedRestaurant) return;
    setErrorMessage("");
    try {
      const response = await fetch("/api/owner/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          label: `QR menu - ${selectedRestaurant.name}`,
          targetKind: "menu",
          targetPath: publicMenuPath,
          style: {
            ...DEFAULT_OWNER_QR_STYLE,
            logoText: monogramFromName(selectedRestaurant.name)
          }
        })
      });
      const payload = (await response.json()) as QrPayload | ApiFailure;
      if (!response.ok || !payload.ok) {
        setErrorMessage(
          payload.ok
            ? "Generation QR impossible."
            : apiErrorMessage(payload, "Generation QR impossible.")
        );
        return;
      }
      setQrState({
        redirectUrl: payload.redirectUrl,
        targetPath: payload.targetPath,
        persisted: payload.persisted
      });
    } catch {
      setErrorMessage("Erreur reseau pendant la generation QR.");
    }
  }

  function applyQuickImport() {
    const parsed = parseQuickImport(quickImportText, selectedRestaurant);
    setLocalDraft(parsed);
    setSaveState("dirty");
  }

  function applyTheme(theme: MenuUiConfig["theme"]) {
    setConfig(configFromTheme(theme, selectedRestaurant));
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

  const qualityChecks = [
    {
      label: selectedRestaurant
        ? `Restaurant selectionne : ${selectedRestaurant.name}`
        : "Aucun restaurant selectionne",
      level: selectedRestaurant ? "ok" : "blocker"
    },
    {
      label: `Slug public : ${selectedRestaurant?.slug || "manquant"}`,
      level: selectedRestaurant?.slug ? "ok" : "blocker"
    },
    {
      label: configPersisted
        ? `Config UI persistee (${configStatus})`
        : "Config UI non persistee",
      level: configPersisted ? "ok" : "warning"
    },
    {
      label:
        configStatus === "published"
          ? "Config publiee pour le menu public"
          : "Config non publiee",
      level: configStatus === "published" ? "ok" : "warning"
    },
    {
      label: `${categoryCount} categorie(s) presentes`,
      level: categoryCount > 0 ? "ok" : "blocker"
    },
    {
      label: `${previewMenu.dishes.length} plat(s) presents`,
      level: previewMenu.dishes.length > 0 ? "ok" : "blocker"
    },
    {
      label: "Vue Tout activee",
      level: previewConfig.defaultView === "all" ? "ok" : "warning"
    },
    {
      label: "Fiche detail activee",
      level: previewConfig.detail.style ? "ok" : "blocker"
    },
    {
      label: `Photos ${photoCount}/${previewMenu.dishes.length}`,
      level: photoCount === previewMenu.dishes.length && photoCount > 0 ? "ok" : "warning"
    },
    {
      label: `3D ${modelCount}/${previewMenu.dishes.length}`,
      level: modelCount > 0 ? "ok" : "warning"
    },
    {
      label: `AR ${arCount}/${previewMenu.dishes.length}`,
      level: arCount > 0 ? "ok" : "warning"
    },
    {
      label: "Aucun modele lourd charge automatiquement",
      level: "ok"
    },
    {
      label: qrState
        ? `QR menu genere : ${qrState.redirectUrl}`
        : "QR menu generable",
      level: qrState ? "ok" : "warning"
    },
    {
      label: `Menu public path : ${publicMenuPath}`,
      level: publicMenuPath.startsWith("/menu/") || publicMenuPath === "/demo" ? "ok" : "blocker"
    },
    {
      label:
        selectedRestaurant?.slug === "resto-marc" &&
        previewMenu.dishes.some((dish) => /elyse/i.test(dish.name))
          ? "Maison Elyse detecte dans Resto Marc"
          : "Pas de melange Maison Elyse / Resto Marc",
      level:
        selectedRestaurant?.slug === "resto-marc" &&
        previewMenu.dishes.some((dish) => /elyse/i.test(dish.name))
          ? "blocker"
          : "ok"
    },
    {
      label: sourceLabel,
      level: localDraft || menuData ? "ok" : "warning"
    },
    {
      label: "Aucun secret stocke dans config_json",
      level: "ok"
    }
  ] as const;

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
                </div>
              </>
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
              <h3>Checklist</h3>
            </div>
          </div>

          <div className={styles.qualityList}>
            {qualityChecks.map((check) => (
              <div
                key={check.label}
                className={`${styles.qualityItem} ${
                  check.level === "ok"
                    ? styles.qualityOk
                    : check.level === "blocker"
                      ? styles.qualityBad
                      : styles.qualityWarn
                }`}
              >
                <span>{check.level === "ok" ? "OK" : check.level === "blocker" ? "!" : "~"}</span>
                <p>{check.label}</p>
              </div>
            ))}
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
              disabled={saveState === "saving" || saveState === "publishing"}
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
            <button type="button" className={styles.secondaryButton} onClick={generateQr}>
              Generer QR menu
            </button>
            <a
              className={styles.secondaryButton}
              href={qrState?.redirectUrl ?? "#"}
              target={qrState ? "_blank" : undefined}
              rel={qrState ? "noreferrer" : undefined}
              onClick={(event) => {
                if (!qrState) event.preventDefault();
              }}
            >
              Tester scan QR
            </a>
          </div>

          {qrState ? (
            <div className={styles.qrResult}>
              <strong>Destination QR</strong>
              <p>{qrState.redirectUrl} -&gt; {qrState.targetPath}</p>
              <small>{qrState.persisted ? "QR persiste" : "QR non persiste"}</small>
            </div>
          ) : null}

          <p className={styles.saveStatus} aria-live="polite">
            {statusLabel(saveState)}
            {errorMessage ? ` ${errorMessage}` : ""}
          </p>
        </section>
      </aside>

      <section className={styles.previewPane}>
        <div className={styles.previewHeader}>
          <div>
            <p className={styles.eyebrow}>Preview client</p>
            <h3>{previewMenu.name}</h3>
          </div>
          <span className={styles.previewUrl}>{publicMenuPath}</span>
        </div>

        <div className={styles.phoneShell}>
          <div className={styles.phoneScreen}>
            <PublicMenuRenderer
              menu={previewMenu}
              config={previewConfig}
              mode="builder-preview"
              disableHeavyAssets
            />
          </div>
        </div>
      </section>
    </div>
  );
}
