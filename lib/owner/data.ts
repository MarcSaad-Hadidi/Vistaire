import "server-only";

import { cache } from "react";

import { getAllDishes, getRestaurant } from "@/lib/demoMenuData";
import {
  filterRowsByRestaurantId,
  getBoolean,
  getDateLabel,
  getNumber,
  getString,
  getSupabaseTableColumns,
  readSupabaseRows,
  readSupabaseRowsByIn,
  type AnyRow
} from "@/lib/analytics/serverRows";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import { getDemoRestaurantId } from "@/lib/analytics/insights";
import {
  buildRuleBasedOwnerRecommendations,
  getAutomaticOwnerRecommendations
} from "@/lib/owner/recommendations";
import { buildActiveQrRestaurantIds } from "@/lib/owner/qrStore";
import {
  createRestaurantRecord,
  type CreateRestaurantRecordResult
} from "@/lib/owner/restaurantCreation";
import {
  buildPublicMenuPath,
  buildPublicMenuUrl,
  buildRestaurantDashboardPath,
  slugifyRestaurantSlug
} from "@/lib/owner/menuUrls";
import { absoluteUrl } from "@/lib/seo";
import type {
  CreateRestaurantInput,
  OwnerAction,
  OwnerDashboardData,
  OwnerQrStatus,
  OwnerReadinessItem,
  OwnerRecommendation,
  OwnerRestaurant,
  OwnerRestaurantStatus,
  OwnerStats
} from "@/lib/owner/types";

export { validateCreateRestaurantInput } from "@/lib/owner/restaurantCreation";

const STATUS_LABELS: Record<OwnerRestaurantStatus, string> = {
  demo: "Presentation",
  active: "Actif",
  setup_needed: "A configurer",
  paused: "Pause",
  archived: "Archive"
};

const STATUS_VALUES = new Set<OwnerRestaurantStatus>([
  "demo",
  "active",
  "setup_needed",
  "paused",
  "archived"
]);

const MEDIA_BASE_PATH_COLUMNS = [
  "media_base_path",
  "mediaBasePath",
  "asset_folder",
  "assetFolder",
  "storage_path",
  "storagePath"
];

type DishMetrics = {
  dishCount: number;
  photoDishCount: number;
  immersiveDishCount: number;
};

function normalizeStatus(value: string): OwnerRestaurantStatus {
  if (STATUS_VALUES.has(value as OwnerRestaurantStatus)) {
    return value as OwnerRestaurantStatus;
  }
  if (value === "setup") return "setup_needed";
  return "demo";
}

function todayEventCount(
  rows: AnyRow[],
  restaurantId: string,
  eventNames: string[]
): number {
  const today = new Date().toISOString().slice(0, 10);
  return filterRowsByRestaurantId(rows, restaurantId).filter((row) => {
    const eventName = getString(row, ["event_name", "eventName", "event_type"], "");
    const rawDate = getString(row, ["created_at", "timestamp", "occurred_at"], "");
    return eventNames.includes(eventName) && rawDate.slice(0, 10) === today;
  }).length;
}

function normalizeMenuUrl(href: string, fallbackPath: string): string {
  const target = href || fallbackPath;
  if (!target) return absoluteUrl("/");

  try {
    if (/^https?:\/\//i.test(target)) {
      return new URL(target).toString();
    }
  } catch {
    return absoluteUrl(fallbackPath || "/");
  }

  return absoluteUrl(target.startsWith("/") ? target : `/${target}`);
}

function buildMediaBasePath(restaurantId: string): string {
  return restaurantId ? `restaurants/${restaurantId}/photos/` : "";
}

function getQrStatus(args: {
  row: AnyRow;
  isDemo: boolean;
  menuUrl: string;
  hasActiveQrCode?: boolean;
}): {
  qrCodeUrl: string | null;
  qrStatus: OwnerQrStatus;
  qrStatusLabel: string;
} {
  const qrCodeUrl =
    getString(args.row, ["qr_code_url", "qr_url", "menu_qr_url"], "") || null;
  const hasGeneratedQr =
    Boolean(args.hasActiveQrCode) ||
    Boolean(qrCodeUrl) ||
    getBoolean(args.row, ["qr_ready", "qrReady"], false) ||
    Boolean(getString(args.row, ["qr_generated_at", "qr_deployed_at"], ""));

  if (args.isDemo || hasGeneratedQr) {
    return {
      qrCodeUrl,
      qrStatus: "ready",
      qrStatusLabel: args.isDemo ? "QR demo pret" : "QR pret"
    };
  }

  if (args.menuUrl) {
    return {
      qrCodeUrl,
      qrStatus: "generable",
      qrStatusLabel: "QR generable"
    };
  }

  return {
    qrCodeUrl,
    qrStatus: "missing",
    qrStatusLabel: "Lien menu manquant"
  };
}

function buildReadinessItems(args: {
  isDemo: boolean;
  status: OwnerRestaurantStatus;
  dishCount: number;
  photoDishCount: number;
  immersiveDishCount: number;
  qrStatus: OwnerQrStatus;
}): OwnerReadinessItem[] {
  if (args.isDemo) {
    return [
      {
        id: "profile",
        label: "Restaurant",
        detail: "Restaurant de presentation Vistaire.",
        status: "demo"
      },
      {
        id: "menu",
        label: "Menu actif",
        detail: "Carte exemple visible cote client.",
        status: "demo"
      },
      {
        id: "photos",
        label: "Photos",
        detail: "Visuels de demonstration disponibles.",
        status: "demo"
      },
      {
        id: "immersive",
        label: "Medias",
        detail: "Plats signatures avec medias immersifs de demo.",
        status: "demo"
      },
      {
        id: "qr",
        label: "QR",
        detail: "QR demo genere depuis le lien public.",
        status: "demo"
      }
    ];
  }

  const hasMenu = args.dishCount > 0;
  const allPhotosReady =
    args.dishCount > 0 && args.photoDishCount >= args.dishCount;

  return [
    {
      id: "profile",
      label: "Restaurant",
      detail:
        args.status === "setup_needed"
          ? "Profil encore en setup."
          : "Profil restaurant exploitable.",
      status: args.status === "setup_needed" ? "needs_setup" : "ready"
    },
    {
      id: "menu",
      label: "Menu actif",
      detail: hasMenu
        ? `${args.dishCount} plats relies au restaurant.`
        : "Aucun plat detecte pour ce restaurant.",
      status: hasMenu ? "ready" : "missing"
    },
    {
      id: "photos",
      label: "Photos",
      detail: `${args.photoDishCount}/${Math.max(args.dishCount, 1)} plats avec photo.`,
      status: allPhotosReady
        ? "ready"
        : args.photoDishCount > 0
          ? "needs_setup"
          : "missing"
    },
    {
      id: "immersive",
      label: "Medias",
      detail:
        args.immersiveDishCount > 0
          ? `${args.immersiveDishCount} plats avec media immersif.`
          : "Aucun modele 3D/AR detecte.",
      status: args.immersiveDishCount > 0 ? "ready" : "needs_setup"
    },
    {
      id: "qr",
      label: "QR menu",
      detail:
        args.qrStatus === "ready"
          ? "QR deja marque comme pret."
          : args.qrStatus === "generable"
            ? "QR generable depuis le lien menu."
            : "Lien menu requis avant QR.",
      status:
        args.qrStatus === "ready"
          ? "ready"
          : args.qrStatus === "generable"
            ? "needs_setup"
            : "missing"
    }
  ];
}

function readinessScore(items: OwnerReadinessItem[]): number {
  const ready = items.filter(
    (item) => item.status === "ready" || item.status === "demo"
  ).length;
  return Math.round((ready / Math.max(items.length, 1)) * 100);
}

function getNextAction(restaurant: {
  status: OwnerRestaurantStatus;
  dishCount: number;
  incompleteDishCount: number;
  immersiveDishCount: number;
  qrStatus: OwnerQrStatus;
}): string {
  if (restaurant.qrStatus !== "ready") return "Generer le QR du menu";
  if (restaurant.dishCount === 0) return "Ajouter les plats du menu";
  if (restaurant.incompleteDishCount > 0) return "Completer les photos des plats";
  if (restaurant.immersiveDishCount === 0) {
    return "Verifier les medias 3D/AR";
  }
  if (restaurant.status === "setup_needed") return "Valider la mise en ligne";
  return "Pret pour demonstration";
}

function dishRowsForRestaurant(
  rows: AnyRow[],
  restaurantId: string,
  slug: string
): AnyRow[] {
  const byId = filterRowsByRestaurantId(rows, restaurantId);
  if (byId.length > 0 || !slug) return byId;

  return rows.filter((row) =>
    ["restaurant_slug", "restaurantSlug", "restaurant"].some(
      (key) => String(row[key] ?? "") === slug
    )
  );
}

function getObject(row: AnyRow, candidates: string[]): AnyRow {
  for (const key of candidates) {
    const value = row[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as AnyRow;
    }
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed: unknown = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as AnyRow;
        }
      } catch {
        // Ignore non-JSON metadata.
      }
    }
  }
  return {};
}

function isSafeMediaReference(value: string): boolean {
  if (!value || /[\u0000-\u001f\\]/.test(value) || value.includes("..")) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function hasSafeMediaReference(row: AnyRow, candidates: string[]): boolean {
  return candidates.some((key) => isSafeMediaReference(getString(row, [key], "")));
}

function isSafeStoragePath(value: string, extension?: "glb" | "usdz"): boolean {
  if (
    !value ||
    value.startsWith("/") ||
    /[\u0000-\u001f\\]/.test(value) ||
    value.includes("..")
  ) {
    return false;
  }
  return extension ? value.toLowerCase().endsWith(`.${extension}`) : true;
}

function hasSafeStoragePath(
  row: AnyRow,
  candidates: string[],
  extension?: "glb" | "usdz"
): boolean {
  return candidates.some((key) =>
    isSafeStoragePath(getString(row, [key], ""), extension)
  );
}

function rowHasPhoto(row: AnyRow): boolean {
  const metadata = getObject(row, ["metadata", "meta"]);
  return (
    hasSafeMediaReference(row, [
      "image",
      "image_url",
      "imageUrl",
      "photo_url",
      "photoUrl",
      "thumbnail_url",
      "thumbnailUrl"
    ]) ||
    hasSafeStoragePath(metadata, ["photoStoragePath", "photo_storage_path"])
  );
}

function rowHasImmersiveAsset(row: AnyRow): boolean {
  const metadata = getObject(row, ["metadata", "meta"]);
  return (
    hasSafeMediaReference(row, [
      "model3d_url",
      "model3dUrl",
      "web_model_3d_url",
      "webModel3dUrl",
      "ar_model_3d_url",
      "arModel3dUrl",
      "usdz_url",
      "usdzUrl"
    ]) ||
    hasSafeMediaReference(metadata, [
      "model3dUrl",
      "model3d_url",
      "webModel3dUrl",
      "web_model_3d_url",
      "arModel3dUrl",
      "ar_model_3d_url",
      "arUsdzUrl",
      "ar_usdz_url",
      "usdzUrl",
      "usdz_url"
    ]) ||
    hasSafeStoragePath(metadata, [
      "webModel3dStoragePath",
      "web_model_3d_storage_path"
    ], "glb") ||
    hasSafeStoragePath(metadata, [
      "arModel3dStoragePath",
      "ar_model_3d_storage_path"
    ], "glb") ||
    hasSafeStoragePath(metadata, [
      "arUsdzStoragePath",
      "ar_usdz_storage_path",
      "usdzStoragePath",
      "usdz_storage_path"
    ], "usdz")
  );
}

function getDishMetrics(args: {
  rows: AnyRow[];
  restaurantId: string;
  slug: string;
  isDemo: boolean;
}): DishMetrics {
  if (args.isDemo) {
    const dishes = getAllDishes();
    return {
      dishCount: dishes.length,
      photoDishCount: dishes.filter((dish) => Boolean(dish.image)).length,
      immersiveDishCount: dishes.filter(
        (dish) =>
          Boolean(dish.model3dUrl) ||
          Boolean(dish.webModel3dUrl) ||
          Boolean(dish.arModel3dUrl) ||
          Boolean(dish.usdzUrl) ||
          Boolean(dish.arUsdzUrl)
      ).length
    };
  }

  const rows = dishRowsForRestaurant(args.rows, args.restaurantId, args.slug);

  return {
    dishCount: rows.length,
    photoDishCount: rows.filter(rowHasPhoto).length,
    immersiveDishCount: rows.filter(rowHasImmersiveAsset).length
  };
}

function mapRestaurantRow(args: {
  row: AnyRow;
  dishMetrics: DishMetrics;
  openingsToday: number;
  interactionsToday: number;
  hasActiveQrCode?: boolean;
}): OwnerRestaurant {
  const id = getString(args.row, ["id", "restaurant_id"], "");
  const name = getString(args.row, ["name", "restaurant_name"], "Restaurant");
  const slug = getString(
    args.row,
    ["slug", "restaurant_slug"],
    slugifyRestaurantSlug(name)
  );
  const status = normalizeStatus(getString(args.row, ["status"], "demo"));
  const isDemo = id === getDemoRestaurantId() || slug === "maison-elyse";
  const effectiveStatus = isDemo ? "demo" : status;
  const menuHrefColumn = getString(args.row, [
    "public_menu_url",
    "menu_url",
    "menu_href",
    "client_menu_url",
    "website_menu_url"
  ]);
  const publicMenuPath = isDemo ? "/demo" : buildPublicMenuPath(slug);
  const publicMenuUrl = isDemo ? absoluteUrl("/demo") : buildPublicMenuUrl(slug);
  const fallbackMenuPath = publicMenuPath;
  const clientMenuHref = menuHrefColumn || publicMenuPath;
  const menuUrl = isDemo
    ? absoluteUrl("/demo")
    : menuHrefColumn
      ? normalizeMenuUrl(menuHrefColumn, fallbackMenuPath)
      : publicMenuUrl;
  const qr = getQrStatus({
    row: args.row,
    isDemo,
    menuUrl,
    hasActiveQrCode: args.hasActiveQrCode
  });
  const incompleteDishCount = Math.max(
    0,
    args.dishMetrics.dishCount - args.dishMetrics.photoDishCount
  );
  const readinessItems = buildReadinessItems({
    isDemo,
    status: effectiveStatus,
    dishCount: args.dishMetrics.dishCount,
    photoDishCount: args.dishMetrics.photoDishCount,
    immersiveDishCount: args.dishMetrics.immersiveDishCount,
    qrStatus: qr.qrStatus
  });

  return {
    id: id || slug,
    name,
    slug,
    isDemo,
    location: getString(
      args.row,
      ["location", "city", "address"],
      "Emplacement a preciser"
    ),
    cuisineType: getString(
      args.row,
      ["cuisine_type", "cuisineType"],
      "Cuisine a preciser"
    ),
    status: effectiveStatus,
    statusLabel: STATUS_LABELS[effectiveStatus],
    dishCount: args.dishMetrics.dishCount,
    photoDishCount: args.dishMetrics.photoDishCount,
    immersiveDishCount: args.dishMetrics.immersiveDishCount,
    incompleteDishCount,
    openingsToday: args.openingsToday,
    interactionsToday: args.interactionsToday,
    lastActivity: getDateLabel(args.row, [
      "last_activity_at",
      "updated_at",
      "created_at"
    ]),
    clientMenuHref,
    menuUrl,
    menuUrlSource: isDemo
      ? "demo"
      : menuHrefColumn
        ? "column"
        : "derived_preview",
    publicMenuPath,
    publicMenuUrl,
    mediaBasePath:
      getString(args.row, MEDIA_BASE_PATH_COLUMNS, "") || buildMediaBasePath(id),
    dashboardHref: buildRestaurantDashboardPath(id || slug),
    qrTargetUrl: menuUrl,
    qrCodeUrl: qr.qrCodeUrl,
    qrStatus: qr.qrStatus,
    qrStatusLabel: qr.qrStatusLabel,
    readinessScore: readinessScore(readinessItems),
    readinessItems,
    nextAction: getNextAction({
      status: effectiveStatus,
      dishCount: args.dishMetrics.dishCount,
      incompleteDishCount,
      immersiveDishCount: args.dishMetrics.immersiveDishCount,
      qrStatus: qr.qrStatus
    }),
    contactName: getString(args.row, ["contact_name", "contactName"], ""),
    contactEmail: getString(args.row, ["contact_email", "contactEmail"], ""),
    contactPhone: getString(args.row, ["contact_phone", "contactPhone", "phone"], ""),
    notes: getString(args.row, ["notes", "internal_notes"], "")
  };
}

function fallbackOwnerRestaurant(): OwnerRestaurant {
  const restaurant = getRestaurant();
  return mapRestaurantRow({
    row: {
      id: getDemoRestaurantId(),
      name: restaurant.name,
      slug: restaurant.slug,
      location: restaurant.location,
      cuisine_type: restaurant.cuisineType,
      status: "demo",
      updated_at: new Date().toISOString(),
      qr_ready: true
    },
    dishMetrics: getDishMetrics({
      rows: [],
      restaurantId: getDemoRestaurantId(),
      slug: restaurant.slug,
      isDemo: true
    }),
    openingsToday: 248,
    interactionsToday: 118
  });
}

function buildStats(
  restaurants: OwnerRestaurant[],
  dailyRows: AnyRow[],
  actionCount: number
): OwnerStats {
  const menuOpensToday =
    dailyRows.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "menu_opens",
          "menu_opened",
          "open_count",
          "sessions",
          "session_count"
        ]),
      0
    ) || restaurants.reduce((sum, restaurant) => sum + restaurant.openingsToday, 0);
  const dishViewsToday = dailyRows.reduce(
    (sum, row) =>
      sum +
      getNumber(row, [
        "dish_views",
        "dish_view_count",
        "views",
        "view_count",
        "total_views"
      ]),
    0
  );
  const immersiveInteractionsToday =
    dailyRows.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "immersive_interactions",
          "immersive_count",
          "dish_3d_clicked",
          "three_d_clicks",
          "ar_clicks"
        ]),
      0
    ) ||
    restaurants.reduce(
      (sum, restaurant) => sum + restaurant.interactionsToday,
      0
    );
  const mostActive = [...restaurants].sort(
    (a, b) =>
      b.openingsToday +
      b.interactionsToday -
      (a.openingsToday + a.interactionsToday)
  )[0];

  return {
    totalRestaurants: restaurants.length,
    activeRestaurants: restaurants.filter(
      (restaurant) => restaurant.status === "active"
    ).length,
    demoRestaurants: restaurants.filter((restaurant) => restaurant.status === "demo")
      .length,
    setupNeededRestaurants: restaurants.filter(
      (restaurant) => restaurant.status === "setup_needed"
    ).length,
    menuReadyRestaurants: restaurants.filter((restaurant) => restaurant.dishCount > 0)
      .length,
    qrReadyRestaurants: restaurants.filter(
      (restaurant) => restaurant.qrStatus === "ready"
    ).length,
    totalDishes: restaurants.reduce(
      (sum, restaurant) => sum + restaurant.dishCount,
      0
    ),
    dishesWithPhotos: restaurants.reduce(
      (sum, restaurant) => sum + restaurant.photoDishCount,
      0
    ),
    dishesWithImmersive: restaurants.reduce(
      (sum, restaurant) => sum + restaurant.immersiveDishCount,
      0
    ),
    actionsToTreat: actionCount,
    menuOpensToday,
    dishViewsToday,
    immersiveInteractionsToday,
    mostActiveRestaurant: mostActive?.name ?? "Aucun signal"
  };
}

function buildOwnerActions(restaurants: OwnerRestaurant[]): OwnerAction[] {
  const actions: OwnerAction[] = [];

  for (const restaurant of restaurants) {
    if (restaurant.qrStatus !== "ready") {
      actions.push({
        id: `${restaurant.id}-qr`,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        title: "QR menu a generer",
        body: `${restaurant.name} a un lien menu, mais aucun QR marque comme pret.`,
        href: `${restaurant.dashboardHref}/qr`,
        priority: "high"
      });
    }

    if (restaurant.dishCount === 0) {
      actions.push({
        id: `${restaurant.id}-menu`,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        title: "Menu incomplet",
        body: "Aucun plat relie a ce restaurant dans les donnees disponibles.",
        href: `${restaurant.dashboardHref}/menu`,
        priority: "high"
      });
    }

    if (restaurant.incompleteDishCount > 0) {
      actions.push({
        id: `${restaurant.id}-photos`,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        title: "Photos a completer",
        body: `${restaurant.incompleteDishCount} plats restent sans photo detectee.`,
        href: `${restaurant.dashboardHref}/medias`,
        priority: "medium"
      });
    }

    if (restaurant.immersiveDishCount === 0 && restaurant.dishCount > 0) {
      actions.push({
        id: `${restaurant.id}-immersive`,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        title: "Medias 3D/AR a verifier",
        body: "Aucun modele immersif n'est detecte pour ce menu.",
        href: `${restaurant.dashboardHref}/medias`,
        priority: "low"
      });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return actions.sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 8);
}

function mapStoredRecommendations(rows: AnyRow[]): OwnerRecommendation[] {
  return rows.slice(0, 6).map((row, index) => {
    const type = getString(row, ["type", "recommendation_type"], "opportunity");
    const normalizedType: OwnerRecommendation["type"] =
      type === "watch" || type === "setup" || type === "upsell"
        ? type
        : "opportunity";

    return {
      id: getString(row, ["id"], `stored-${index}`),
      title: getString(row, ["title"], "Recommandation a traiter"),
      body: getString(row, ["body", "description", "recommendation"], ""),
      restaurantName: getString(row, ["restaurant_name", "restaurantName"], ""),
      type: normalizedType,
      source: "stored"
    };
  });
}

type OwnerRestaurantReadOptions = {
  includeDishes?: boolean;
  includeActivity?: boolean;
  includeQr?: boolean;
};

type OwnerRestaurantsData = {
  restaurants: OwnerRestaurant[];
  source: OwnerDashboardData["source"];
  note: string;
};

export type OwnerRestaurantDashboardData = OwnerRestaurantsData & {
  restaurant: OwnerRestaurant | null;
};

function decodeRestaurantLookup(value: string): string {
  try {
    return decodeURIComponent(value).trim().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

const skippedRowsResult = {
  ok: false as const,
  error: "not requested",
  rows: [] as AnyRow[]
};

async function getOwnerRestaurantRowsData(
  options: OwnerRestaurantReadOptions = {}
): Promise<OwnerRestaurantsData> {
  const restaurantsResult = await readSupabaseRows("restaurants", 200);
  const restaurantIds = restaurantsResult.ok
    ? restaurantsResult.rows
        .map((row) => getString(row, ["id", "restaurant_id"], ""))
        .filter(Boolean)
    : [];
  const [dishesResult, eventsResult, qrCodesResult] = restaurantIds.length
    ? await Promise.all([
        options.includeDishes
          ? readSupabaseRowsByIn({
              table: "menu_dishes",
              column: "restaurant_id",
              values: restaurantIds,
              limit: 1_000
            })
          : Promise.resolve(skippedRowsResult),
        options.includeActivity
          ? readSupabaseRowsByIn({
              table: "analytics_events",
              column: "restaurant_id",
              values: restaurantIds,
              limit: 1_000
            })
          : Promise.resolve(skippedRowsResult),
        options.includeQr
          ? readSupabaseRowsByIn({
              table: "qr_codes",
              column: "restaurant_id",
              values: restaurantIds,
              limit: 500
            })
          : Promise.resolve(skippedRowsResult)
      ])
    : [skippedRowsResult, skippedRowsResult, skippedRowsResult];

  const dishRows = dishesResult.ok ? dishesResult.rows : [];
  const activeQrRestaurantIds =
    qrCodesResult.ok && qrCodesResult.rows.length
      ? buildActiveQrRestaurantIds(qrCodesResult.rows)
      : new Set<string>();

  const restaurants =
    restaurantsResult.ok && restaurantsResult.rows.length
      ? restaurantsResult.rows.map((row) => {
          const restaurantId = getString(row, ["id", "restaurant_id"], "");
          const name = getString(row, ["name", "restaurant_name"], "Restaurant");
          const slug = getString(
            row,
            ["slug", "restaurant_slug"],
            slugifyRestaurantSlug(name)
          );
          const isDemo = restaurantId === getDemoRestaurantId() || slug === "maison-elyse";
          const openingsToday = eventsResult.ok
            ? todayEventCount(eventsResult.rows, restaurantId, [
                "menu_opened",
                "session_started"
              ])
            : 0;
          const interactionsToday = eventsResult.ok
            ? todayEventCount(eventsResult.rows, restaurantId, [
                "dish_opened",
                "dish_3d_clicked",
                "dish_ar_clicked",
                "cta_clicked"
              ])
            : 0;

          return mapRestaurantRow({
            row,
            dishMetrics: getDishMetrics({
              rows: dishRows,
              restaurantId,
            slug,
            isDemo
          }),
          openingsToday,
          interactionsToday,
            hasActiveQrCode: activeQrRestaurantIds.has(restaurantId)
          });
        })
      : [fallbackOwnerRestaurant()];

  return {
    restaurants,
    source:
      restaurantsResult.ok && restaurantsResult.rows.length ? "supabase" : "fallback",
    note:
      restaurantsResult.ok && restaurantsResult.rows.length
        ? "Donnees restaurants connectees a Supabase."
        : "Donnees de presentation affichees tant que Supabase ne repond pas."
  };
}

async function getOwnerRestaurantsDataUncached(): Promise<OwnerRestaurantsData> {
  return getOwnerRestaurantRowsData({
    includeDishes: true,
    includeQr: true
  });
}

export const getOwnerRestaurantsData = cache(getOwnerRestaurantsDataUncached);

async function getOwnerRestaurantDashboardDataUncached(
  restaurantIdOrSlug: string
): Promise<OwnerRestaurantDashboardData> {
  const data = await getOwnerRestaurantRowsData({
    includeDishes: true,
    includeActivity: true,
    includeQr: true
  });
  const lookup = decodeRestaurantLookup(restaurantIdOrSlug);
  const restaurant =
    data.restaurants.find(
      (item) =>
        item.id.toLowerCase() === lookup || item.slug.toLowerCase() === lookup
    ) ?? null;

  return {
    ...data,
    restaurant
  };
}

export const getOwnerRestaurantDashboardData = cache(
  getOwnerRestaurantDashboardDataUncached
);

async function getOwnerMenuStatusDataUncached(): Promise<OwnerRestaurantsData> {
  return getOwnerRestaurantRowsData({
    includeDishes: true
  });
}

export const getOwnerMenuStatusData = cache(getOwnerMenuStatusDataUncached);

export async function getOwnerDashboardData(
  options: { includeAiRecommendations?: boolean } = {}
): Promise<OwnerDashboardData> {
  const [restaurantData, dailyResult, storedResult] = await Promise.all([
    getOwnerRestaurantRowsData({
      includeDishes: true,
      includeActivity: true,
      includeQr: true
    }),
    readSupabaseRows("restaurant_daily_analytics", 300),
    readSupabaseRows("owner_ai_recommendations", 100)
  ]);

  const restaurants = restaurantData.restaurants;

  const actions = buildOwnerActions(restaurants);
  const stats = buildStats(
    restaurants,
    dailyResult.ok ? dailyResult.rows : [],
    actions.length
  );
  const storedRecommendations = storedResult.ok
    ? mapStoredRecommendations(storedResult.rows)
    : [];
  const automatic = options.includeAiRecommendations
    ? await getAutomaticOwnerRecommendations({
        stats,
        restaurants,
        storedRecommendations
      })
    : {
        recommendations: buildRuleBasedOwnerRecommendations({
          stats,
          restaurants,
          storedRecommendations
        }),
        source: storedRecommendations.length
          ? ("stored" as const)
          : ("rules" as const)
      };

  return {
    stats,
    restaurants,
    actions,
    recommendations: automatic.recommendations,
    recommendationSource: automatic.source,
    source: restaurantData.source,
    note: restaurantData.note
  };
}

export async function createRestaurant(
  input: CreateRestaurantInput
): Promise<CreateRestaurantRecordResult> {
  type CreateRestaurantDependencies = Parameters<typeof createRestaurantRecord>[1];

  return createRestaurantRecord(input, {
    admin: getSupabaseAdminClient() as unknown as CreateRestaurantDependencies["admin"],
    getColumns: getSupabaseTableColumns,
    env: process.env
  });
}
