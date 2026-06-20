import type { OwnerRestaurantStatus } from "@/lib/owner/types";

type SupabaseUpdateError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type SupabaseStorageObject = {
  name: string;
  id?: string | null;
  metadata?: unknown;
};

type SupabaseStorageBucket = {
  list(
    path: string,
    options?: { limit?: number; offset?: number; sortBy?: { column: string; order: string } }
  ): PromiseLike<{
    data: SupabaseStorageObject[] | null;
    error: SupabaseUpdateError | null;
  }>;
  remove(paths: string[]): PromiseLike<{
    data: unknown[] | null;
    error: SupabaseUpdateError | null;
  }>;
};

type SupabaseStorageClient = {
  from(bucket: string): SupabaseStorageBucket;
};

type SupabaseRestaurantStatusClient = {
  storage?: SupabaseStorageClient;
  rpc?(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{
    data: unknown;
    error: SupabaseUpdateError | null;
  }>;
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): PromiseLike<{
          data: Record<string, unknown> | null;
          error: SupabaseUpdateError | null;
        }>;
        maybeSingle(): PromiseLike<{
          data: Record<string, unknown> | null;
          error: SupabaseUpdateError | null;
        }>;
      };
    };
    update(row: Record<string, unknown>): {
      eq(column: string, value: string): {
        select(columns: string): {
          single(): PromiseLike<{
            data: Record<string, unknown> | null;
            error: SupabaseUpdateError | null;
          }>;
        };
      };
    };
  };
};

type SupabaseAdminResult =
  | { ok: true; client: SupabaseRestaurantStatusClient }
  | { ok: false; reason: string };

type RestaurantStatusAction = "archive" | "restore";

const DEMO_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ??
  "11111111-1111-1111-1111-111111111111";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9._-]{1,126}$/;

type RestaurantStatusDependencies = {
  admin: SupabaseAdminResult;
  env?: Record<string, string | undefined>;
};

export type UpdateRestaurantStatusResult =
  | {
      ok: true;
      restaurantId: string;
      status: OwnerRestaurantStatus;
    }
  | {
      ok: false;
      error: string;
      status: 400 | 403 | 404 | 503;
    };

export type RestaurantDeleteDetails = {
  table: string;
  column?: string;
  supabaseCode?: string;
  supabaseMessage?: string;
};

export type RestaurantDeleteSkip = {
  table: string;
  column: string;
  reason: "missing_table" | "missing_column" | "empty_value" | "non_table_relation";
  message: string;
};

export type RestaurantStorageCleanupReport = {
  attempted: boolean;
  deletedFiles: number;
  buckets: string[];
  prefixes: string[];
  warnings: string[];
};

export type DeleteRestaurantResult =
  | {
      ok: true;
      restaurantId: string;
      restaurantDeleted: true;
      deleted: Record<string, number>;
      skipped: RestaurantDeleteSkip[];
      storage: RestaurantStorageCleanupReport;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
      status: 400 | 403 | 404 | 503;
      restaurantDeleted: false;
      deleted: Record<string, number>;
      storage: RestaurantStorageCleanupReport;
      warnings: string[];
      details?: RestaurantDeleteDetails;
    };

type RestaurantLookup = {
  kind: "id" | "slug";
  value: string;
};

type DeleteRestaurantConfirmation = {
  confirmed?: boolean;
  confirmName?: string;
  confirmation?: string;
  deleteStorage?: boolean;
};

function emptyStorageReport(): RestaurantStorageCleanupReport {
  return {
    attempted: false,
    deletedFiles: 0,
    buckets: [],
    prefixes: [],
    warnings: []
  };
}

function failureResult(args: {
  status: 400 | 403 | 404 | 503;
  error: string;
  deleted?: Record<string, number>;
  warnings?: string[];
  storage?: RestaurantStorageCleanupReport;
  details?: RestaurantDeleteDetails;
}): DeleteRestaurantResult {
  return {
    ok: false,
    status: args.status,
    error: args.error,
    restaurantDeleted: false,
    deleted: args.deleted ?? {},
    storage: args.storage ?? emptyStorageReport(),
    warnings: args.warnings ?? [],
    ...(args.details ? { details: args.details } : {})
  };
}

export function validateRestaurantStatusAction(
  input: unknown
):
  | { ok: true; action: RestaurantStatusAction; status: OwnerRestaurantStatus }
  | { ok: false; error: string } {
  const action =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>).action
      : undefined;

  if (action === "archive") {
    return { ok: true, action, status: "archived" };
  }

  if (action === "restore") {
    return { ok: true, action, status: "setup_needed" };
  }

  return { ok: false, error: "Action restaurant non supportee." };
}

function parseRestaurantLookup(value: string): RestaurantLookup | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (UUID_PATTERN.test(trimmed)) return { kind: "id", value: trimmed };
  if (SAFE_SLUG_PATTERN.test(trimmed) && !trimmed.includes("..")) {
    return { kind: "slug", value: trimmed };
  }
  return null;
}

function getString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

function isProtectedDemoRestaurant(row: Record<string, unknown>): boolean {
  const id = getString(row, "id");
  const slug = getString(row, "slug").toLowerCase();
  const status = getString(row, "status");
  return id === DEMO_RESTAURANT_ID || slug === "maison-elyse" || status === "demo";
}

function isNotFoundError(error: SupabaseUpdateError): boolean {
  return error.code === "PGRST116";
}

function errorMessage(error: SupabaseUpdateError): string {
  return error.message || error.details || error.hint || "Erreur Supabase inconnue.";
}

function isMissingRpcError(error: SupabaseUpdateError): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    error.code === "PGRST202" ||
    /could not find .*function/.test(message) ||
    /function .* does not exist/.test(message) ||
    /schema cache/.test(message)
  );
}

function tableFromRpcError(error: SupabaseUpdateError): string {
  const message = errorMessage(error);
  const match = /\bdans ([a-z0-9_]+)/i.exec(message);
  return match?.[1] ?? "delete_owner_restaurant_cascade";
}

async function lookupRestaurant(
  client: SupabaseRestaurantStatusClient,
  lookup: RestaurantLookup
): Promise<
  | { ok: true; restaurant: Record<string, unknown> }
  | { ok: false; status: 404 | 503; error: string }
> {
  const { data, error } = await client
    .from("restaurants")
    .select("id,name,slug,status")
    .eq(lookup.kind, lookup.value)
    .single();

  if (error) {
    return {
      ok: false,
      status: isNotFoundError(error) ? 404 : 503,
      error: isNotFoundError(error)
        ? "Restaurant introuvable."
        : "Le restaurant n'a pas pu etre verifie dans Supabase."
    };
  }

  if (!data) {
    return { ok: false, status: 404, error: "Restaurant introuvable." };
  }

  return { ok: true, restaurant: data };
}

export async function updateRestaurantStatusRecord(
  restaurantId: string,
  action: RestaurantStatusAction,
  dependencies: RestaurantStatusDependencies
): Promise<UpdateRestaurantStatusResult> {
  const lookup = parseRestaurantLookup(restaurantId);
  if (!lookup) {
    return { ok: false, status: 400, error: "Identifiant restaurant invalide." };
  }

  if (!dependencies.admin.ok) {
    return {
      ok: false,
      status: 503,
      error:
        "Archivage impossible : Supabase n'est pas configure pour persister les restaurants."
    };
  }

  const found = await lookupRestaurant(dependencies.admin.client, lookup);
  if (!found.ok) return found;

  if (isProtectedDemoRestaurant(found.restaurant)) {
    return {
      ok: false,
      status: 403,
      error: "Restaurant de demonstration protege contre l'archivage."
    };
  }

  const restaurantIdValue = getString(found.restaurant, "id");
  const nextStatus: OwnerRestaurantStatus =
    action === "archive" ? "archived" : "setup_needed";
  const { data, error } = await dependencies.admin.client
    .from("restaurants")
    .update({ status: nextStatus })
    .eq("id", restaurantIdValue)
    .select("id,status")
    .single();

  if (error) {
    return {
      ok: false,
      status: isNotFoundError(error) ? 404 : 503,
      error: isNotFoundError(error)
        ? "Restaurant introuvable."
        : "Le statut du restaurant n'a pas pu etre mis a jour dans Supabase."
    };
  }

  if (!data) {
    return { ok: false, status: 404, error: "Restaurant introuvable." };
  }

  return {
    ok: true,
    restaurantId: String(data.id ?? restaurantIdValue),
    status: nextStatus
  };
}

function confirmationText(input: DeleteRestaurantConfirmation): string {
  if (typeof input.confirmation === "string") return input.confirmation.trim();
  if (input.confirmed === true && typeof input.confirmName === "string") {
    return input.confirmName.trim();
  }
  return "";
}

function confirmationMatchesRestaurant(
  confirmation: string,
  restaurant: Record<string, unknown>
): boolean {
  const name = getString(restaurant, "name");
  const slug = getString(restaurant, "slug");
  return Boolean(confirmation && (confirmation === name || confirmation === slug));
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function storageBuckets(env: Record<string, string | undefined>): string[] {
  return uniqueValues([
    env.VISTAIRE_MEDIA_BUCKET ?? "",
    env.VISTAIRE_3D_CDN_BUCKET ?? "",
    env.VISTAIRE_3D_SOURCE_BUCKET ?? "",
    env.VISTAIRE_3D_QA_EVIDENCE_BUCKET ?? "",
    "vistaire-media",
    "vistaire-3d"
  ]).filter((bucket) => BUCKET_PATTERN.test(bucket));
}

function storagePrefixes(restaurant: Record<string, unknown>): string[] {
  const id = getString(restaurant, "id");
  const slug = getString(restaurant, "slug");
  return uniqueValues([
    id ? `restaurants/${id}` : "",
    id ? `restaurants/${id}/photos` : "",
    id ? `restaurants/${id}/models` : "",
    slug ? `restaurants/${slug}` : "",
    slug ? `restaurants/${slug}/photos` : "",
    slug ? `restaurants/${slug}/models` : "",
    slug ? `sources/${slug}` : "",
    slug ? `candidates/${slug}` : "",
    slug ? `device-qa/${slug}` : "",
    slug ? `models/restaurants/${slug}` : ""
  ]);
}

function joinStoragePath(prefix: string, name: string): string {
  return `${prefix.replace(/\/+$/, "")}/${name.replace(/^\/+/, "")}`;
}

function looksLikeFolder(item: SupabaseStorageObject): boolean {
  return item.id === null || (!item.id && !item.metadata && !item.name.includes("."));
}

async function listStorageFiles(args: {
  bucket: SupabaseStorageBucket;
  prefix: string;
  depth?: number;
}): Promise<{ ok: true; paths: string[] } | { ok: false; message: string }> {
  const depth = args.depth ?? 0;
  const { data, error } = await args.bucket.list(args.prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" }
  });

  if (error) return { ok: false, message: errorMessage(error) };

  const paths: string[] = [];
  for (const item of data ?? []) {
    if (!item.name || item.name === ".emptyFolderPlaceholder") continue;
    const path = joinStoragePath(args.prefix, item.name);
    if (looksLikeFolder(item) && depth < 5) {
      const nested = await listStorageFiles({
        bucket: args.bucket,
        prefix: path,
        depth: depth + 1
      });
      if (nested.ok) {
        paths.push(...nested.paths);
      }
      continue;
    }
    paths.push(path);
  }

  return { ok: true, paths };
}

async function cleanupRestaurantStorage(args: {
  client: SupabaseRestaurantStatusClient;
  restaurant: Record<string, unknown>;
  env: Record<string, string | undefined>;
  shouldAttempt: boolean;
}): Promise<RestaurantStorageCleanupReport> {
  const prefixes = storagePrefixes(args.restaurant);
  const buckets = storageBuckets(args.env);

  if (!args.shouldAttempt) {
    return {
      attempted: false,
      deletedFiles: 0,
      buckets,
      prefixes,
      warnings: [
        `Fichiers Storage/CDN non supprimes automatiquement. Chemins a verifier: ${prefixes.join(", ")}.`
      ]
    };
  }

  const report: RestaurantStorageCleanupReport = {
    attempted: true,
    deletedFiles: 0,
    buckets,
    prefixes,
    warnings: []
  };

  if (!args.client.storage) {
    report.warnings.push(
      `Client Supabase Storage indisponible. Chemins a nettoyer manuellement: ${prefixes.join(", ")}.`
    );
    return report;
  }

  for (const bucketName of buckets) {
    const bucket = args.client.storage.from(bucketName);
    for (const prefix of prefixes) {
      const listed = await listStorageFiles({ bucket, prefix });
      if (!listed.ok) {
        report.warnings.push(
          `Storage ${bucketName}/${prefix} non liste: ${listed.message}`
        );
        continue;
      }
      if (listed.paths.length === 0) continue;

      const removal = await bucket.remove(listed.paths);
      if (removal.error) {
        report.warnings.push(
          `Storage ${bucketName} non supprime pour ${prefix}: ${errorMessage(removal.error)}`
        );
        continue;
      }
      report.deletedFiles += listed.paths.length;
    }
  }

  return report;
}

function normalizedDeleted(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const deleted: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const count = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(count)) deleted[key] = count;
  }
  return deleted;
}

function normalizedSkipped(value: unknown): RestaurantDeleteSkip[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => {
      return Boolean(entry && typeof entry === "object" && !Array.isArray(entry));
    })
    .map((entry): RestaurantDeleteSkip => {
      const reason: RestaurantDeleteSkip["reason"] =
        entry.reason === "missing_table" ||
        entry.reason === "missing_column" ||
        entry.reason === "empty_value" ||
        entry.reason === "non_table_relation"
          ? entry.reason
          : "missing_table";

      return {
        table: typeof entry.table === "string" ? entry.table : "",
        column: typeof entry.column === "string" ? entry.column : "",
        reason,
        message: typeof entry.message === "string" ? entry.message : ""
      };
    })
    .filter((entry) => entry.table && entry.column && entry.message);
}

function normalizedWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

async function deleteRestaurantWithRpc(args: {
  client: SupabaseRestaurantStatusClient;
  restaurantId: string;
  confirmation: string;
}): Promise<
  | { kind: "missing" }
  | {
      kind: "deleted";
      restaurantId: string;
      deleted: Record<string, number>;
      skipped: RestaurantDeleteSkip[];
      warnings: string[];
    }
  | { kind: "failed"; error: string; details: RestaurantDeleteDetails }
> {
  if (!UUID_PATTERN.test(args.restaurantId)) {
    return {
      kind: "failed",
      error: "Identifiant restaurant Supabase invalide pour suppression transactionnelle.",
      details: {
        table: "restaurants",
        column: "id",
        supabaseMessage: "La RPC delete_owner_restaurant_cascade exige un UUID restaurant."
      }
    };
  }

  if (!args.client.rpc) {
    return { kind: "missing" };
  }

  const { data, error } = await args.client.rpc("delete_owner_restaurant_cascade", {
    p_restaurant_id: args.restaurantId,
    p_confirmation: args.confirmation
  });

  if (error) {
    if (isMissingRpcError(error)) return { kind: "missing" };
    return {
      kind: "failed",
      error: "La suppression transactionnelle du restaurant a echoue dans Supabase.",
      details: {
        table: tableFromRpcError(error),
        supabaseCode: error.code,
        supabaseMessage: errorMessage(error)
      }
    };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      kind: "failed",
      error: "La suppression transactionnelle n'a pas retourne de rapport Supabase.",
      details: {
        table: "delete_owner_restaurant_cascade",
        supabaseMessage: "Rapport RPC absent ou invalide."
      }
    };
  }

  const report = data as Record<string, unknown>;
  if (report.restaurantDeleted !== true) {
    return {
      kind: "failed",
      error: "Supabase n'a pas confirme la suppression du restaurant.",
      details: {
        table: "restaurants",
        supabaseMessage: "restaurantDeleted n'est pas true dans le rapport RPC."
      }
    };
  }

  return {
    kind: "deleted",
    restaurantId:
      typeof report.restaurantId === "string" ? report.restaurantId : args.restaurantId,
    deleted: normalizedDeleted(report.deleted),
    skipped: normalizedSkipped(report.skipped),
    warnings: normalizedWarnings(report.warnings)
  };
}

export async function deleteRestaurantRecord(
  restaurantId: string,
  confirmation: DeleteRestaurantConfirmation,
  dependencies: RestaurantStatusDependencies
): Promise<DeleteRestaurantResult> {
  const lookup = parseRestaurantLookup(restaurantId);
  if (!lookup) {
    return failureResult({
      status: 400,
      error: "Identifiant restaurant invalide."
    });
  }

  const confirmedText = confirmationText(confirmation);
  if (!confirmedText) {
    return failureResult({
      status: 400,
      error: "Confirmation de suppression requise."
    });
  }

  if (!dependencies.admin.ok) {
    return failureResult({
      status: 503,
      error:
        "Suppression impossible : Supabase n'est pas configure pour persister les restaurants."
    });
  }

  const found = await lookupRestaurant(dependencies.admin.client, lookup);
  if (!found.ok) {
    return failureResult({
      status: found.status,
      error: found.error
    });
  }

  const restaurant = found.restaurant;
  if (isProtectedDemoRestaurant(restaurant)) {
    return failureResult({
      status: 403,
      error: "Restaurant de demonstration protege contre la suppression."
    });
  }

  if (!confirmationMatchesRestaurant(confirmedText, restaurant)) {
    return failureResult({
      status: 400,
      error: "La confirmation ne correspond pas au restaurant."
    });
  }

  const restaurantIdValue = getString(restaurant, "id");
  const rpcResult = await deleteRestaurantWithRpc({
    client: dependencies.admin.client,
    restaurantId: restaurantIdValue,
    confirmation: confirmedText
  });

  if (rpcResult.kind === "failed") {
    return failureResult({
      status: 503,
      error: rpcResult.error,
      details: rpcResult.details
    });
  }

  if (rpcResult.kind === "deleted") {
    const storage = await cleanupRestaurantStorage({
      client: dependencies.admin.client,
      restaurant,
      env: dependencies.env ?? process.env,
      shouldAttempt: confirmation.deleteStorage === true
    });

    return {
      ok: true,
      restaurantId: rpcResult.restaurantId,
      restaurantDeleted: true,
      deleted: rpcResult.deleted,
      skipped: rpcResult.skipped,
      storage,
      warnings: rpcResult.warnings
    };
  }

  return failureResult({
    status: 503,
    error:
      "Suppression impossible : la fonction transactionnelle Supabase delete_owner_restaurant_cascade n'est pas disponible.",
    details: {
      table: "delete_owner_restaurant_cascade",
      supabaseMessage:
        "Appliquez la migration Supabase avant d'autoriser une suppression definitive."
    }
  });
}
