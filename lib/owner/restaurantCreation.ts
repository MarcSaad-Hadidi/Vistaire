import type {
  CreateRestaurantInput,
  OwnerReadinessItem,
  OwnerRestaurant,
  OwnerRestaurantStatus
} from "@/lib/owner/types";

type SupabaseInsertError = {
  code?: string;
  message?: string;
};

type SupabaseRestaurantClient = {
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(columns: string): {
        single(): PromiseLike<{
          data: Record<string, unknown> | null;
          error: SupabaseInsertError | null;
        }>;
      };
    };
  };
};

type SupabaseAdminResult =
  | { ok: true; client: SupabaseRestaurantClient }
  | { ok: false; reason: string };

export type CreateRestaurantRecordResult =
  | {
      ok: true;
      persisted: true;
      dataSource: "supabase";
      restaurant: OwnerRestaurant;
    }
  | {
      ok: false;
      error: string;
      status: 400 | 409 | 502 | 503;
    };

type CreateRestaurantRecordDependencies = {
  admin: SupabaseAdminResult;
  getColumns: (table: string) => Promise<Set<string>>;
  env?: Record<string, string | undefined>;
};

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SITE_URL_ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL"
] as const;

function slugifyRestaurantSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildPublicMenuPath(slugOrName: string): string {
  const slug = slugifyRestaurantSlug(slugOrName);
  return slug ? `/menu/${encodeURIComponent(slug)}` : "/demo";
}

function buildRestaurantDashboardPath(restaurantIdOrSlug: string): string {
  const safeId = restaurantIdOrSlug.trim();
  return safeId
    ? `/owner/restaurants/${encodeURIComponent(safeId)}`
    : "/owner";
}

function getSiteOrigin(env: Record<string, string | undefined> = {}): string {
  for (const key of SITE_URL_ENV_KEYS) {
    const value = env[key];
    if (!value) continue;
    try {
      const withProtocol = /^https?:\/\//i.test(value)
        ? value
        : `https://${value}`;
      return new URL(withProtocol).origin;
    } catch {
      // Ignore malformed environment values and use the production fallback.
    }
  }
  return "https://www.vistaire.ca";
}

function buildPublicMenuUrl(
  slugOrName: string,
  env?: Record<string, string | undefined>
): string {
  return new URL(buildPublicMenuPath(slugOrName), getSiteOrigin(env)).toString();
}

function getString(
  row: Record<string, unknown>,
  candidates: string[],
  fallback = ""
): string {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function normalizeStatus(value: string): OwnerRestaurantStatus {
  return STATUS_VALUES.has(value as OwnerRestaurantStatus)
    ? (value as OwnerRestaurantStatus)
    : "setup_needed";
}

function pickColumn(columns: Set<string>, candidates: string[]): string | null {
  return candidates.find((candidate) => columns.has(candidate)) ?? null;
}

function assignInsertValue(
  row: Record<string, unknown>,
  columns: Set<string>,
  candidates: string[],
  value: unknown
) {
  if (value === undefined || value === "") return;
  const column = columns.size > 0 ? pickColumn(columns, candidates) : candidates[0];
  if (column) row[column] = value;
}

function isDuplicateSlugError(error: SupabaseInsertError): boolean {
  const message = error.message ?? "";
  return (
    error.code === "23505" &&
    (/slug/i.test(message) || /restaurants_slug/i.test(message))
  );
}

function createdReadinessItems(): OwnerReadinessItem[] {
  return [
    {
      id: "profile",
      label: "Restaurant",
      detail: "Profil cree dans Supabase, a completer avant mise en ligne.",
      status: "needs_setup"
    },
    {
      id: "menu",
      label: "Menu actif",
      detail: "Aucun plat relie pour l'instant.",
      status: "missing"
    },
    {
      id: "photos",
      label: "Photos",
      detail: "Photos a ajouter avec les plats.",
      status: "missing"
    },
    {
      id: "immersive",
      label: "3D / AR",
      detail: "Aucun asset 3D / AR detecte.",
      status: "needs_setup"
    },
    {
      id: "qr",
      label: "QR menu",
      detail: "QR generable depuis le lien menu public.",
      status: "needs_setup"
    }
  ];
}

function mapCreatedRestaurant(row: Record<string, unknown>, env?: Record<string, string | undefined>): OwnerRestaurant {
  const name = getString(row, ["name", "restaurant_name"], "Restaurant");
  const slug = getString(row, ["slug", "restaurant_slug"], slugifyRestaurantSlug(name));
  const id = getString(row, ["id", "restaurant_id"], "");
  const status = normalizeStatus(getString(row, ["status"], "setup_needed"));
  const publicMenuPath = buildPublicMenuPath(slug);
  const publicMenuUrl = buildPublicMenuUrl(slug, env);
  const readinessItems = createdReadinessItems();

  return {
    id,
    name,
    slug,
    isDemo: false,
    location: getString(row, ["location", "city", "address"], "Emplacement a preciser"),
    cuisineType: getString(row, ["cuisine_type", "cuisineType"], "Cuisine a preciser"),
    status,
    statusLabel: STATUS_LABELS[status],
    dishCount: 0,
    photoDishCount: 0,
    immersiveDishCount: 0,
    incompleteDishCount: 0,
    openingsToday: 0,
    interactionsToday: 0,
    lastActivity: "A l'instant",
    clientMenuHref: publicMenuPath,
    menuUrl: publicMenuUrl,
    menuUrlSource: "derived_preview",
    publicMenuPath,
    publicMenuUrl,
    dashboardHref: buildRestaurantDashboardPath(id),
    qrTargetUrl: publicMenuUrl,
    qrCodeUrl: null,
    qrStatus: "generable",
    qrStatusLabel: "QR generable",
    readinessScore: 0,
    readinessItems,
    nextAction: "Ajouter les plats du menu",
    contactName: getString(row, ["contact_name", "contactName"], ""),
    contactEmail: getString(row, ["contact_email", "contactEmail"], ""),
    contactPhone: getString(row, ["contact_phone", "contactPhone", "phone"], ""),
    notes: getString(row, ["notes", "internal_notes"], "")
  };
}

export function validateCreateRestaurantInput(
  input: unknown
): { ok: true; value: CreateRestaurantInput } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Formulaire invalide." };
  }

  const candidate = input as Record<string, unknown>;
  const name = getString(candidate, ["name"], "").slice(0, 120);
  const slug = slugifyRestaurantSlug(getString(candidate, ["slug"], name)).slice(0, 80);
  const location = getString(candidate, ["location"], "").slice(0, 160);
  const cuisineType = getString(candidate, ["cuisineType", "cuisine_type"], "").slice(0, 120);
  const status = normalizeStatus(getString(candidate, ["status"], "setup_needed"));
  const contactName = getString(candidate, ["contactName", "contact_name"], "").slice(0, 120);
  const contactEmail = getString(candidate, ["contactEmail", "contact_email"], "").slice(0, 160);
  const contactPhone = getString(candidate, ["contactPhone", "contact_phone"], "").slice(0, 60);
  const notes = getString(candidate, ["notes"], "").slice(0, 800);

  if (!name || name.length < 2) {
    return { ok: false, error: "Nom du restaurant requis." };
  }
  if (!slug || slug.length < 2) return { ok: false, error: "Slug invalide." };
  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "Email contact invalide." };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      location,
      cuisineType,
      status,
      contactName,
      contactEmail,
      ...(contactPhone ? { contactPhone } : {}),
      ...(notes ? { notes } : {})
    }
  };
}

export async function createRestaurantRecord(
  input: CreateRestaurantInput,
  dependencies: CreateRestaurantRecordDependencies
): Promise<CreateRestaurantRecordResult> {
  if (!dependencies.admin.ok) {
    return {
      ok: false,
      status: 503,
      error:
        "Creation impossible : Supabase n'est pas configure pour persister les restaurants."
    };
  }

  const columns = await dependencies.getColumns("restaurants");
  const row: Record<string, unknown> = {};
  const normalizedSlug = slugifyRestaurantSlug(input.slug || input.name);

  assignInsertValue(row, columns, ["name", "restaurant_name"], input.name);
  assignInsertValue(row, columns, ["slug", "restaurant_slug"], normalizedSlug);
  assignInsertValue(row, columns, ["location", "city"], input.location);
  assignInsertValue(row, columns, ["cuisine_type", "cuisineType"], input.cuisineType);
  assignInsertValue(row, columns, ["status"], input.status);
  assignInsertValue(row, columns, ["contact_name", "contactName"], input.contactName);
  assignInsertValue(row, columns, ["contact_email", "contactEmail"], input.contactEmail);
  assignInsertValue(row, columns, ["contact_phone", "contactPhone", "phone"], input.contactPhone);
  assignInsertValue(row, columns, ["notes", "internal_notes"], input.notes);

  const { data, error } = await dependencies.admin.client
    .from("restaurants")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    if (isDuplicateSlugError(error)) {
      return {
        ok: false,
        status: 409,
        error: "Ce slug public existe deja. Choisissez un slug unique."
      };
    }

    return {
      ok: false,
      status: 503,
      error:
        "Le restaurant n'a pas pu etre cree dans Supabase. Verifiez la table restaurants et les champs."
    };
  }

  if (!data || !UUID_PATTERN.test(getString(data, ["id", "restaurant_id"], ""))) {
    return {
      ok: false,
      status: 502,
      error:
        "Creation invalide : Supabase n'a pas retourne d'identifiant Supabase UUID."
    };
  }

  return {
    ok: true,
    persisted: true,
    dataSource: "supabase",
    restaurant: mapCreatedRestaurant(data, dependencies.env)
  };
}
