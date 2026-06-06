"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicMenuRenderer } from "@/components/menu/PublicMenuRenderer";
import {
  MENU_UI_CATEGORY_NAVIGATION_VALUES,
  MENU_UI_DENSITY_VALUES,
  MENU_UI_DETAIL_STYLE_VALUES,
  MENU_UI_DISH_CARD_STYLE_VALUES,
  MENU_UI_MOTION_VALUES,
  menuUiConfigForRestaurant,
  type MenuUiConfig,
  type MenuUiThemeId
} from "@/lib/menu/menuUiConfig";
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

const THEME_OPTIONS: Array<{
  id: MenuUiThemeId;
  name: string;
  description: string;
}> = [
  {
    id: "fresh-homemade",
    name: "Fresh Homemade",
    description: "Clair, colore, maison. Parfait pour Resto Marc."
  },
  {
    id: "premium-gastronomic",
    name: "Premium Gastronomic",
    description: "Sombre, elegant, gastronomique. Plus proche de Maison Elyse."
  },
  {
    id: "street-casual",
    name: "Street Casual",
    description: "Punchy, rapide, comptoir, prix tres visibles."
  },
  {
    id: "cafe-brunch",
    name: "Cafe Brunch",
    description: "Chaud, doux, lumineux, cafe et brunch."
  },
  {
    id: "minimal-clean",
    name: "Minimal Clean",
    description: "Sobre, propre, tres simple, neutre."
  }
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
    setConfig((current) => ({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    }));
    setSaveState("dirty");
  }

  async function saveDraft() {
    if (!selectedRestaurant) return;
    setSaveState("saving");
    setErrorMessage("");
    try {
      const response = await fetch("/api/owner/menu-ui-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          config
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
    setSaveState("publishing");
    setErrorMessage("");
    try {
      const response = await fetch("/api/owner/menu-ui-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          action: "publish",
          config
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

  if (restaurants.length === 0) {
    return (
      <section className={styles.emptyBuilder}>
        <p className={styles.eyebrow}>Menu Builder</p>
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
      level: config.defaultView === "all" ? "ok" : "warning"
    },
    {
      label: "Fiche detail activee",
      level: config.detailStyle ? "ok" : "blocker"
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
              <p className={styles.eyebrow}>Theme</p>
              <h3>Style UI</h3>
            </div>
          </div>

          <div className={styles.themeGrid}>
            {THEME_OPTIONS.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`${styles.themeButton} ${
                  theme.id === config.theme ? styles.themeButtonActive : ""
                }`}
                onClick={() => updateConfig({ theme: theme.id })}
              >
                <strong>{theme.name}</strong>
                <span>{theme.description}</span>
              </button>
            ))}
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
              checked={config.welcomeEnabled}
              onChange={(event) => updateConfig({ welcomeEnabled: event.target.checked })}
            />
            Afficher l&apos;accueil
          </label>

          <label className={styles.field}>
            Titre
            <input
              maxLength={120}
              value={config.welcomeTitle}
              onChange={(event) => updateConfig({ welcomeTitle: event.target.value })}
            />
          </label>

          <label className={styles.field}>
            Sous-titre
            <input
              maxLength={180}
              value={config.welcomeSubtitle}
              onChange={(event) => updateConfig({ welcomeSubtitle: event.target.value })}
            />
          </label>

          <label className={styles.field}>
            Motion
            <select
              value={config.motion}
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

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => updateConfig(menuUiConfigForRestaurant(selectedRestaurant ?? {}))}
          >
            Reinitialiser avec le restaurant
          </button>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Menu</p>
              <h3>Navigation & cards</h3>
            </div>
          </div>

          <div className={styles.optionGrid}>
            <label className={styles.field}>
              Navigation
              <select
                value={config.categoryNavigation}
                onChange={(event) =>
                  updateConfig({
                    categoryNavigation: event.target
                      .value as MenuUiConfig["categoryNavigation"]
                  })
                }
              >
                {MENU_UI_CATEGORY_NAVIGATION_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Cards plats
              <select
                value={config.dishCardStyle}
                onChange={(event) =>
                  updateConfig({
                    dishCardStyle: event.target.value as MenuUiConfig["dishCardStyle"]
                  })
                }
              >
                {MENU_UI_DISH_CARD_STYLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Fiche detail
              <select
                value={config.detailStyle}
                onChange={(event) =>
                  updateConfig({
                    detailStyle: event.target.value as MenuUiConfig["detailStyle"]
                  })
                }
              >
                {MENU_UI_DETAIL_STYLE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Densite
              <select
                value={config.density}
                onChange={(event) =>
                  updateConfig({ density: event.target.value as MenuUiConfig["density"] })
                }
              >
                {MENU_UI_DENSITY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Assets</p>
              <h3>Photos + 3D / AR</h3>
            </div>
          </div>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={config.showPhotoPlaceholders}
              onChange={(event) =>
                updateConfig({ showPhotoPlaceholders: event.target.checked })
              }
            />
            Afficher les placeholders photo
          </label>
          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={config.show3dBadges}
              onChange={(event) => updateConfig({ show3dBadges: event.target.checked })}
            />
            Afficher badges 3D si disponible
          </label>
          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={config.showArBadges}
              onChange={(event) => updateConfig({ showArBadges: event.target.checked })}
            />
            Afficher badges AR si disponible
          </label>

          <div className={styles.metricGrid}>
            <span>{photoCount}/{previewMenu.dishes.length} photos</span>
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
              onClick={saveDraft}
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
              config={config}
              mode="builder-preview"
              disableHeavyAssets
            />
          </div>
        </div>
      </section>
    </div>
  );
}
