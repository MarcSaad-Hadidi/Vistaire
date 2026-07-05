import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertNoForbiddenSourceStorage,
  buildUsdzRuntimeMetadataPatch,
  buildUsdzRuntimeStoragePath,
  computeSplitModelStatus,
  createModelAssetVersion,
  defaultUsdzOptimizationRecipe,
  evaluateRuntimeUsdzUploadGate,
  getMetadataObject,
  isUsdzOptimizationRecipe,
  isUsdzOptimizationRecipeForProfile,
  MODEL_BUCKET,
  restampPublicModelUrls,
  sha256Hex,
  USDZ_OPTIMIZATION_PROFILES,
  type UsdzOptimizationProfile,
  type UsdzOptimizationRecipe
} from "./usdzRuntimeModel.ts";

const JOB_TOKEN_VERSION = "v1";
const DEFAULT_JOB_TOKEN_TTL_MS = 30 * 60 * 1000;

type OwnerIdentity = {
  userId: string;
  email?: string | null;
};

export type UsdzRuntimeJobClaims = {
  v: typeof JOB_TOKEN_VERSION;
  jobId: string;
  restaurantId: string;
  restaurantSlug: string;
  menuSlug: string;
  dishId: string;
  dishSlug: string;
  ownerUserId: string;
  ownerEmail?: string | null;
  profile: UsdzOptimizationProfile;
  sourceOriginalName: string;
  sourceBytes: number;
  iat: number;
  exp: number;
};

export type UsdzRuntimePrepareUploadInput = {
  jobId: string;
  jobToken: string;
  profile: UsdzOptimizationProfile;
  selectedProfile: UsdzOptimizationProfile;
  selectedRecipe: UsdzOptimizationRecipe;
  profileFallbackApplied: boolean;
  recipeFallbackApplied: boolean;
  sourceBytes: number;
  sourceSha256: string;
  runtimeBytes: number;
  runtimeSha256: string;
  reportBytes: number;
  geometryOptimization: string;
  warnings?: string[];
  fails?: string[];
};

export type UsdzRuntimeCompleteInput = UsdzRuntimePrepareUploadInput & {
  version: string;
  runtimeStoragePath: string;
  reportStoragePath: string;
  reductionPercent?: number;
  triangleCountBefore?: number;
  triangleCountAfter?: number;
  geometryReductionPercent?: number;
  textureCount?: number;
  changedTextures?: number;
  candidateAttempts?: unknown[];
  attemptCount?: number;
};

export type UsdzRuntimeRollbackInput = UsdzRuntimePrepareUploadInput & {
  version: string;
  runtimeStoragePath?: string;
  reportStoragePath?: string;
};

export type UsdzRuntimePreparedUpload = {
  ok: true;
  jobId: string;
  version: string;
  bucket: typeof MODEL_BUCKET;
  runtimeStoragePath: string;
  reportStoragePath: string;
  runtimeUpload: { signedUrl: string; token: string; path: string };
  reportUpload: { signedUrl: string; token: string; path: string };
  usdzSourceStored: false;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function tokenSecret(env: NodeJS.ProcessEnv): string | null {
  const secret = env.VISTAIRE_USDZ_JOB_TOKEN_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "";
  return secret.length >= 32 ? secret : null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanSha256(value: unknown): string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : "";
}

function cleanPositiveInt(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
}

function cleanNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function cleanStringArray(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function cleanCandidateAttempts(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => isRecord(item))
    .map((item) => ({
      profile: String(item.profile ?? ""),
      targetBytes: cleanPositiveInt(item.targetBytes),
      runtimeBytes: cleanPositiveInt(item.runtimeBytes),
      reductionPercent: typeof item.reductionPercent === "number" ? item.reductionPercent : 0,
      geometryOptimization: String(item.geometryOptimization ?? ""),
      passedBudget: item.passedBudget === true,
      targetTriangles: cleanPositiveInt(item.targetTriangles)
    }))
    .slice(0, 6);
}

function cleanProfile(value: unknown): UsdzOptimizationProfile | null {
  if (
    value === "premium" ||
    value === "balanced" ||
    value === "light" ||
    value === "emergency"
  ) {
    return value;
  }
  return null;
}

function cleanRecipe(value: unknown): UsdzOptimizationRecipe | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isUsdzOptimizationRecipe(normalized) ? normalized : null;
}

function cleanPhysicalScale(value: unknown) {
  if (!isRecord(value)) return undefined;
  return {
    status: typeof value.status === "string" ? value.status : "unknown",
    dishKind: typeof value.dishKind === "string" ? value.dishKind : "fallback",
    dimension: typeof value.dimension === "string" ? value.dimension : "",
    targetMeters: cleanNumber(value.targetMeters),
    minMeters: cleanNumber(value.minMeters),
    maxMeters: cleanNumber(value.maxMeters),
    heightBeforeMeters: cleanNumber(value.heightBeforeMeters),
    widthBeforeMeters: cleanNumber(value.widthBeforeMeters),
    depthBeforeMeters: cleanNumber(value.depthBeforeMeters),
    footprintBeforeMeters: cleanNumber(value.footprintBeforeMeters),
    heightAfterMeters: cleanNumber(value.heightAfterMeters),
    widthAfterMeters: cleanNumber(value.widthAfterMeters),
    depthAfterMeters: cleanNumber(value.depthAfterMeters),
    footprintAfterMeters: cleanNumber(value.footprintAfterMeters),
    scaleFactor: cleanNumber(value.scaleFactor) || 1,
    centeredX: value.centeredX === true,
    centeredY: value.centeredY === true,
    grounded: value.grounded === true,
    centerOffsetBeforeMeters: cleanNumber(value.centerOffsetBeforeMeters),
    centerOffsetAfterMeters: cleanNumber(value.centerOffsetAfterMeters),
    warnings: cleanStringArray(value.warnings)
  };
}

type CleanPhysicalScale = ReturnType<typeof cleanPhysicalScale>;

function assertPhysicalScalePublishable(value: CleanPhysicalScale): asserts value is NonNullable<CleanPhysicalScale> {
  if (!value) {
    throw new Error("Rapport USDZ invalide: physicalScale requis.");
  }
  if (value.status !== "normalized" && value.status !== "unchanged") {
    throw new Error("Rapport USDZ invalide: physicalScale non valide.");
  }
  if (value.dimension !== "height" && value.dimension !== "footprint") {
    throw new Error("Rapport USDZ invalide: dimension physicalScale invalide.");
  }
  if (value.minMeters <= 0 || value.maxMeters <= 0 || value.maxMeters < value.minMeters) {
    throw new Error("Rapport USDZ invalide: bornes physicalScale invalides.");
  }
  const finalMeters = value.dimension === "height" ? value.heightAfterMeters : value.footprintAfterMeters;
  if (finalMeters < value.minMeters || finalMeters > value.maxMeters) {
    throw new Error("Rapport USDZ invalide: taille physicalScale finale hors bornes.");
  }
  if (value.centeredX !== true || value.centeredY !== true || value.grounded !== true) {
    throw new Error("Rapport USDZ invalide: modele non centre ou non grounded.");
  }
}

export function createUsdzRuntimeSignedAssetVersion(args: {
  profile: UsdzOptimizationProfile;
  runtimeSha256: string;
  jobId: string;
}): string {
  const seed = createHmac("sha256", args.jobId)
    .update(`${args.profile}:${args.runtimeSha256}`)
    .digest("hex");
  return createModelAssetVersion(seed);
}

export function createUsdzRuntimeJobToken(args: {
  owner: OwnerIdentity;
  restaurantId: string;
  restaurantSlug: string;
  menuSlug: string;
  dishId: string;
  dishSlug: string;
  sourceOriginalName: string;
  sourceBytes: number;
  profile: UsdzOptimizationProfile;
  nowMs?: number;
  env?: NodeJS.ProcessEnv;
}): { ok: true; jobId: string; token: string; expiresAt: string } | { ok: false; error: string } {
  const env = args.env ?? process.env;
  const secret = tokenSecret(env);
  if (!secret) return { ok: false, error: "Secret jobToken USDZ manquant." };

  const nowMs = args.nowMs ?? Date.now();
  const ttlMs = cleanPositiveInt(Number(env.VISTAIRE_USDZ_JOB_TOKEN_TTL_MS))
    ? Number(env.VISTAIRE_USDZ_JOB_TOKEN_TTL_MS)
    : DEFAULT_JOB_TOKEN_TTL_MS;
  const claims: UsdzRuntimeJobClaims = {
    v: JOB_TOKEN_VERSION,
    jobId: `job_usdz_runtime_${randomUUID().replace(/-/g, "").slice(0, 18)}`,
    restaurantId: args.restaurantId,
    restaurantSlug: args.restaurantSlug,
    menuSlug: args.menuSlug,
    dishId: args.dishId,
    dishSlug: args.dishSlug,
    ownerUserId: args.owner.userId,
    ownerEmail: args.owner.email ?? null,
    profile: args.profile,
    sourceOriginalName: args.sourceOriginalName,
    sourceBytes: args.sourceBytes,
    iat: nowMs,
    exp: nowMs + ttlMs
  };
  const payload = base64UrlEncode(JSON.stringify(claims));
  return {
    ok: true,
    jobId: claims.jobId,
    token: `${payload}.${sign(payload, secret)}`,
    expiresAt: new Date(claims.exp).toISOString()
  };
}

export function verifyUsdzRuntimeJobToken(
  token: string,
  env: NodeJS.ProcessEnv = process.env,
  nowMs = Date.now()
): { ok: true; claims: UsdzRuntimeJobClaims } | { ok: false; error: string } {
  const secret = tokenSecret(env);
  if (!secret) return { ok: false, error: "Secret jobToken USDZ manquant." };
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) {
    return { ok: false, error: "jobToken USDZ invalide." };
  }
  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as unknown;
    if (!isRecord(parsed) || parsed.v !== JOB_TOKEN_VERSION) {
      return { ok: false, error: "jobToken USDZ invalide." };
    }
    const claims = parsed as UsdzRuntimeJobClaims;
    if (claims.exp < nowMs) return { ok: false, error: "jobToken USDZ expire." };
    return { ok: true, claims };
  } catch {
    return { ok: false, error: "jobToken USDZ invalide." };
  }
}

export function assertUsdzRuntimeJobClaimsMatchRoute(
  claims: UsdzRuntimeJobClaims,
  params: { restaurantId: string; dishId: string }
): void {
  if (claims.restaurantId !== params.restaurantId || claims.dishId !== params.dishId) {
    throw new Error("jobToken USDZ ne correspond pas a cette route.");
  }
}

export function parsePrepareUploadInput(value: unknown): UsdzRuntimePrepareUploadInput | null {
  if (!isRecord(value)) return null;
  const jobId = typeof value.jobId === "string" ? value.jobId : "";
  const jobToken = typeof value.jobToken === "string" ? value.jobToken : "";
  const profile = cleanProfile(value.profile);
  if (!profile) return null;
  const selectedProfile = cleanProfile(value.selectedProfile) ?? profile;
  const selectedRecipe = cleanRecipe(value.selectedRecipe) ?? defaultUsdzOptimizationRecipe(selectedProfile);
  return {
    jobId,
    jobToken,
    profile,
    selectedProfile,
    selectedRecipe,
    profileFallbackApplied: value.profileFallbackApplied === true,
    recipeFallbackApplied: value.recipeFallbackApplied === true,
    sourceBytes: cleanPositiveInt(value.sourceBytes),
    sourceSha256: cleanSha256(value.sourceSha256),
    runtimeBytes: cleanPositiveInt(value.runtimeBytes),
    runtimeSha256: cleanSha256(value.runtimeSha256),
    reportBytes: cleanPositiveInt(value.reportBytes),
    geometryOptimization:
      typeof value.geometryOptimization === "string" ? value.geometryOptimization : "unknown",
    warnings: cleanStringArray(value.warnings),
    fails: cleanStringArray(value.fails)
  };
}

export function parseCompleteInput(value: unknown): UsdzRuntimeCompleteInput | null {
  const base = parsePrepareUploadInput(value);
  if (!base || !isRecord(value)) return null;
  return {
    ...base,
    version: typeof value.version === "string" ? value.version.trim() : "",
    runtimeStoragePath:
      typeof value.runtimeStoragePath === "string" ? value.runtimeStoragePath.trim() : "",
    reportStoragePath:
      typeof value.reportStoragePath === "string" ? value.reportStoragePath.trim() : "",
    reductionPercent: typeof value.reductionPercent === "number" ? value.reductionPercent : 0,
    triangleCountBefore: cleanPositiveInt(value.triangleCountBefore),
    triangleCountAfter: cleanPositiveInt(value.triangleCountAfter),
    geometryReductionPercent:
      typeof value.geometryReductionPercent === "number" ? value.geometryReductionPercent : 0,
    textureCount: cleanPositiveInt(value.textureCount),
    changedTextures: cleanPositiveInt(value.changedTextures),
    candidateAttempts: cleanCandidateAttempts(value.candidateAttempts),
    attemptCount: cleanPositiveInt(value.attemptCount)
  };
}

export function parseRollbackInput(value: unknown): UsdzRuntimeRollbackInput | null {
  const base = parsePrepareUploadInput(value);
  if (!base || !isRecord(value)) return null;
  const runtimeStoragePath =
    typeof value.runtimeStoragePath === "string" ? value.runtimeStoragePath.trim() : "";
  const reportStoragePath =
    typeof value.reportStoragePath === "string" ? value.reportStoragePath.trim() : "";
  return {
    ...base,
    version: typeof value.version === "string" ? value.version.trim() : "",
    runtimeStoragePath: runtimeStoragePath || undefined,
    reportStoragePath: reportStoragePath || undefined
  };
}

function assertClaimsMatchInput(
  claims: UsdzRuntimeJobClaims,
  input: UsdzRuntimePrepareUploadInput
): void {
  if (claims.jobId !== input.jobId) throw new Error("jobId USDZ invalide.");
  if (claims.profile !== input.profile) throw new Error("Profil USDZ invalide.");
  const selectedProfile = input.selectedProfile ?? input.profile;
  if (selectedProfile !== input.profile || input.profileFallbackApplied === true) {
    throw new Error("Profil USDZ selectionne invalide.");
  }
  const selectedRecipe = input.selectedRecipe ?? defaultUsdzOptimizationRecipe(selectedProfile);
  if (!isUsdzOptimizationRecipeForProfile(input.profile, selectedRecipe)) {
    throw new Error("Recette USDZ selectionnee invalide.");
  }
  if (claims.sourceBytes !== input.sourceBytes) throw new Error("Taille source USDZ invalide.");
  if (!input.sourceSha256) throw new Error("SHA-256 source requis.");
  if (!input.runtimeSha256) throw new Error("SHA-256 runtime requis.");
  if (input.runtimeBytes <= 0 || input.reportBytes <= 0) {
    throw new Error("Tailles runtime/report requises.");
  }
  if ((input.fails ?? []).length > 0) {
    throw new Error(`Optimisation USDZ bloquee: ${(input.fails ?? []).join("; ")}`);
  }
}

export async function prepareUsdzRuntimeSignedUpload(args: {
  adminClient: SupabaseClient;
  input: UsdzRuntimePrepareUploadInput;
  maxRuntimeBytes: number;
  env?: NodeJS.ProcessEnv;
}): Promise<UsdzRuntimePreparedUpload> {
  const verified = verifyUsdzRuntimeJobToken(args.input.jobToken, args.env ?? process.env);
  if (!verified.ok) throw new Error(verified.error);
  assertClaimsMatchInput(verified.claims, args.input);
  const budgetProfile = args.input.selectedProfile ?? args.input.profile;
  const profileBudget = Math.floor(USDZ_OPTIMIZATION_PROFILES[budgetProfile].targetMaxBytes);
  const effectiveMaxRuntimeBytes = Math.min(args.maxRuntimeBytes, profileBudget);
  if (args.input.runtimeBytes > effectiveMaxRuntimeBytes) {
    throw new Error("Runtime USDZ au-dessus de la limite runtime.");
  }

  const expected = expectedUsdzRuntimePaths(verified.claims, args.input);
  const version = expected.version;
  const runtimeStoragePath = expected.runtimeStoragePath;
  const reportStoragePath = expected.reportStoragePath;

  const bucket = args.adminClient.storage.from(MODEL_BUCKET);
  const runtimeUpload = await bucket.createSignedUploadUrl(runtimeStoragePath);
  if (runtimeUpload.error || !runtimeUpload.data) {
    throw new Error("URL signee runtime USDZ impossible.");
  }
  const reportUpload = await bucket.createSignedUploadUrl(reportStoragePath);
  if (reportUpload.error || !reportUpload.data) {
    throw new Error("URL signee rapport USDZ impossible.");
  }

  return {
    ok: true,
    jobId: verified.claims.jobId,
    version,
    bucket: MODEL_BUCKET,
    runtimeStoragePath,
    reportStoragePath,
    runtimeUpload: {
      signedUrl: runtimeUpload.data.signedUrl,
      token: runtimeUpload.data.token,
      path: runtimeUpload.data.path
    },
    reportUpload: {
      signedUrl: reportUpload.data.signedUrl,
      token: reportUpload.data.token,
      path: reportUpload.data.path
    },
    usdzSourceStored: false
  };
}

async function rollbackStorageObjects(
  adminClient: SupabaseClient,
  paths: Array<string | undefined>
): Promise<void> {
  const cleanPaths = paths.filter((path): path is string => Boolean(path && path.trim()));
  if (cleanPaths.length === 0) return;
  try {
    await adminClient.storage.from(MODEL_BUCKET).remove(cleanPaths);
  } catch {
    // best-effort rollback; the local worker still removes transient files.
  }
}

function expectedUsdzRuntimePaths(claims: UsdzRuntimeJobClaims, input: UsdzRuntimePrepareUploadInput) {
  const version = createUsdzRuntimeSignedAssetVersion({
    profile: input.profile,
    runtimeSha256: input.runtimeSha256,
    jobId: claims.jobId
  });
  return {
    version,
    runtimeStoragePath: buildUsdzRuntimeStoragePath({
      restaurantId: claims.restaurantId,
      dishSlug: claims.dishSlug,
      version
    }),
    reportStoragePath: `restaurants/${claims.restaurantId}/models/manifests/${claims.dishSlug}-${version}-usdz-report.json`
  };
}

export async function rollbackUsdzRuntimeSignedUpload(args: {
  adminClient: SupabaseClient;
  input: UsdzRuntimeRollbackInput;
  env?: NodeJS.ProcessEnv;
}): Promise<{ ok: true; removedPaths: string[]; usdzSourceStored: false }> {
  const verified = verifyUsdzRuntimeJobToken(args.input.jobToken, args.env ?? process.env);
  if (!verified.ok) throw new Error(verified.error);
  assertClaimsMatchInput(verified.claims, args.input);
  const expected = expectedUsdzRuntimePaths(verified.claims, args.input);
  if (args.input.version !== expected.version) {
    throw new Error("Version rollback USDZ invalide.");
  }

  const paths: string[] = [];
  if (args.input.runtimeStoragePath) {
    if (args.input.runtimeStoragePath !== expected.runtimeStoragePath) {
      throw new Error("Chemin rollback runtime USDZ invalide.");
    }
    paths.push(args.input.runtimeStoragePath);
  }
  if (args.input.reportStoragePath) {
    if (args.input.reportStoragePath !== expected.reportStoragePath) {
      throw new Error("Chemin rollback rapport USDZ invalide.");
    }
    paths.push(args.input.reportStoragePath);
  }

  if (paths.length > 0) {
    const removal = await args.adminClient.storage.from(MODEL_BUCKET).remove(paths);
    if (removal.error) {
      throw new Error("Rollback Storage USDZ impossible.");
    }
  }

  return { ok: true, removedPaths: paths, usdzSourceStored: false };
}

async function downloadStorageBytes(
  adminClient: SupabaseClient,
  path: string
): Promise<Buffer> {
  const downloaded = await adminClient.storage.from(MODEL_BUCKET).download(path);
  if (downloaded.error || !downloaded.data) {
    throw new Error("Objet Storage USDZ introuvable apres upload signe.");
  }
  return Buffer.from(await downloaded.data.arrayBuffer());
}

async function fetchFreshDishMetadata(args: {
  adminClient: SupabaseClient;
  dishId: string;
  restaurantId: string;
}): Promise<Record<string, unknown>> {
  const result = await args.adminClient
    .from("menu_dishes")
    .select("metadata")
    .eq("id", args.dishId)
    .eq("restaurant_id", args.restaurantId)
    .maybeSingle();
  if (result.error || !result.data) {
    throw new Error("Metadata du plat impossible a relire avant publication USDZ.");
  }
  return getMetadataObject((result.data as { metadata?: unknown }).metadata);
}

export async function completeUsdzRuntimeSignedUpload(args: {
  adminClient: SupabaseClient;
  input: UsdzRuntimeCompleteInput;
  env?: NodeJS.ProcessEnv;
}): Promise<{
  status: "ready";
  jobId: string;
  version: string;
  arUsdzUrl: string;
  usdzRuntimeBytes: number;
  usdzSourceBytes: number;
  reductionPercent: number;
  profile: UsdzOptimizationProfile;
  selectedProfile: UsdzOptimizationProfile;
  selectedRecipe: UsdzOptimizationRecipe;
  profileFallbackApplied: boolean;
  recipeFallbackApplied: boolean;
  geometryOptimization: string;
  physicalScale?: ReturnType<typeof cleanPhysicalScale>;
  warnings: string[];
  fails: string[];
}> {
  const verified = verifyUsdzRuntimeJobToken(args.input.jobToken, args.env ?? process.env);
  if (!verified.ok) throw new Error(verified.error);
  assertClaimsMatchInput(verified.claims, args.input);

  const expected = expectedUsdzRuntimePaths(verified.claims, args.input);
  const expectedVersion = expected.version;
  if (args.input.version !== expectedVersion) throw new Error("Version runtime USDZ invalide.");

  const expectedRuntimePath = expected.runtimeStoragePath;
  const expectedReportPath = expected.reportStoragePath;
  if (
    args.input.runtimeStoragePath !== expectedRuntimePath ||
    args.input.reportStoragePath !== expectedReportPath
  ) {
    throw new Error("Chemins Storage USDZ invalides.");
  }

  try {
    const runtimeBytes = await downloadStorageBytes(args.adminClient, args.input.runtimeStoragePath);
    const reportBytes = await downloadStorageBytes(args.adminClient, args.input.reportStoragePath);
    if (runtimeBytes.byteLength !== args.input.runtimeBytes) {
      throw new Error("Taille runtime Storage invalide.");
    }
    if (reportBytes.byteLength !== args.input.reportBytes) {
      throw new Error("Taille rapport Storage invalide.");
    }
    if (sha256Hex(runtimeBytes) !== args.input.runtimeSha256) {
      throw new Error("SHA-256 runtime Storage invalide.");
    }
    const parsedReport = JSON.parse(reportBytes.toString("utf8")) as unknown;
    if (!isRecord(parsedReport) || parsedReport.sourceStored !== false) {
      throw new Error("Rapport USDZ invalide: sourceStored doit rester false.");
    }
    const reportFails = cleanStringArray(parsedReport.fails);
    if (reportFails.length > 0) {
      throw new Error(`Rapport USDZ invalide: ${reportFails.join("; ")}`);
    }
    const reportWarnings = cleanStringArray(parsedReport.warnings);
    const reportCandidateAttempts = cleanCandidateAttempts(parsedReport.candidateAttempts);
    const reportPhysicalScale = cleanPhysicalScale(parsedReport.physicalScale);
    const reportRequestedProfile = cleanProfile(parsedReport.requestedProfile) ?? cleanProfile(parsedReport.profile);
    const inputSelectedProfile = args.input.selectedProfile ?? args.input.profile;
    const reportSelectedProfile = cleanProfile(parsedReport.selectedProfile) ?? reportRequestedProfile;
    const inputSelectedRecipe = args.input.selectedRecipe ?? defaultUsdzOptimizationRecipe(inputSelectedProfile);
    const reportSelectedRecipe =
      cleanRecipe(parsedReport.selectedRecipe) ?? cleanRecipe(parsedReport.recipe);
    const reportFallbackApplied = parsedReport.profileFallbackApplied === true;
    const inputFallbackApplied = args.input.profileFallbackApplied === true;
    const reportRecipeFallbackApplied = parsedReport.recipeFallbackApplied === true;
    const inputRecipeFallbackApplied = args.input.recipeFallbackApplied === true;
    if (reportRequestedProfile && reportRequestedProfile !== args.input.profile) {
      throw new Error("Rapport USDZ invalide: profil demande incoherent.");
    }
    if (reportSelectedProfile && reportSelectedProfile !== inputSelectedProfile) {
      throw new Error("Rapport USDZ invalide: profil selectionne incoherent.");
    }
    if (reportFallbackApplied !== inputFallbackApplied) {
      throw new Error("Rapport USDZ invalide: fallback profil incoherent.");
    }
    if (!reportSelectedRecipe || reportSelectedRecipe !== inputSelectedRecipe) {
      throw new Error("Rapport USDZ invalide: recette selectionnee incoherente.");
    }
    if (!isUsdzOptimizationRecipeForProfile(args.input.profile, reportSelectedRecipe)) {
      throw new Error("Rapport USDZ invalide: recette hors profil.");
    }
    if (reportRecipeFallbackApplied !== inputRecipeFallbackApplied) {
      throw new Error("Rapport USDZ invalide: fallback recette incoherent.");
    }
    assertPhysicalScalePublishable(reportPhysicalScale);

    const gate = evaluateRuntimeUsdzUploadGate({
      runtimeBytes,
      sourceBytes: args.input.sourceBytes,
      sourceSha256: args.input.sourceSha256,
      maxRuntimeBytes: args.input.runtimeBytes,
      reportGenerated: true,
      sourceCleaned: true,
      optimizationExpected: true
    });
    if (!gate.ok) throw new Error(gate.error);

    const patch = buildUsdzRuntimeMetadataPatch(
      {
        restaurantId: verified.claims.restaurantId,
        dishId: verified.claims.dishId,
        dishSlug: verified.claims.dishSlug,
        version: expectedVersion,
        runtimeBytes: runtimeBytes.byteLength,
        runtimeSha256: args.input.runtimeSha256,
        reportStoragePath: args.input.reportStoragePath,
        profile: args.input.profile,
        selectedProfile: inputSelectedProfile,
        selectedRecipe: inputSelectedRecipe,
        profileFallbackApplied: inputFallbackApplied,
        recipeFallbackApplied: inputRecipeFallbackApplied,
        warnings: reportWarnings,
        fails: reportFails,
        reductionPercent: cleanNumber(parsedReport.reductionPercent),
        geometryOptimization:
          typeof parsedReport.geometryOptimization === "string"
            ? parsedReport.geometryOptimization
            : args.input.geometryOptimization,
        triangleCountBefore: cleanPositiveInt(parsedReport.triangleCountBefore),
        triangleCountAfter: cleanPositiveInt(parsedReport.triangleCountAfter),
        geometryReductionPercent: cleanNumber(parsedReport.geometryReductionPercent),
        physicalScale: reportPhysicalScale,
        textureCount: cleanPositiveInt(parsedReport.textureCount),
        changedTextures: cleanPositiveInt(parsedReport.changedTextures),
        candidateAttempts: reportCandidateAttempts,
        attemptCount:
          cleanPositiveInt(parsedReport.attemptCount) || reportCandidateAttempts.length,
        source: {
          originalName: verified.claims.sourceOriginalName,
          bytes: args.input.sourceBytes,
          sha256: args.input.sourceSha256,
          processedAt: new Date().toISOString()
        },
        uploadedAt: new Date().toISOString()
      },
      args.input.runtimeStoragePath
    );

    const freshMetadata = await fetchFreshDishMetadata({
      adminClient: args.adminClient,
      dishId: verified.claims.dishId,
      restaurantId: verified.claims.restaurantId
    });
    let merged = { ...freshMetadata, ...patch };
    merged = restampPublicModelUrls(merged, verified.claims.dishId, expectedVersion);
    merged.modelStatus = computeSplitModelStatus(merged);
    assertNoForbiddenSourceStorage(merged);

    const updated = await args.adminClient
      .from("menu_dishes")
      .update({ has_immersive_view: true, metadata: merged })
      .eq("id", verified.claims.dishId)
      .eq("restaurant_id", verified.claims.restaurantId)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) {
      throw new Error("Plat impossible a mettre a jour avec le runtime USDZ.");
    }

    return {
      status: "ready",
      jobId: verified.claims.jobId,
      version: expectedVersion,
      arUsdzUrl: String(patch.arUsdzUrl),
      usdzRuntimeBytes: runtimeBytes.byteLength,
      usdzSourceBytes: args.input.sourceBytes,
      reductionPercent: cleanNumber(parsedReport.reductionPercent),
      profile: args.input.profile,
      selectedProfile: inputSelectedProfile,
      selectedRecipe: inputSelectedRecipe,
      profileFallbackApplied: inputFallbackApplied,
      recipeFallbackApplied: inputRecipeFallbackApplied,
      geometryOptimization:
        typeof parsedReport.geometryOptimization === "string"
          ? parsedReport.geometryOptimization
          : args.input.geometryOptimization,
      physicalScale: reportPhysicalScale,
      warnings: reportWarnings,
      fails: reportFails
    };
  } catch (error) {
    await rollbackStorageObjects(args.adminClient, [
      args.input.runtimeStoragePath,
      args.input.reportStoragePath
    ]);
    throw error;
  }
}
