import { createHash } from "node:crypto";

import {
  DISH_PHOTO_DERIVATIVE_VARIANTS,
  DISH_PHOTO_RECIPE,
  isDishPhotoDerivativeVariant,
  type DishPhotoDerivativeVariant
} from "./dishPhotoRecipe.ts";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_MEASURE_AGE_MS = 15 * 60 * 1000;
const RESTAURANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CheckpointInput = {
  dishId: string;
  restaurantId: string;
  sourcePath: string;
  sourceSha256: string;
  recipeId: string;
  schemaVersion: number;
  expectedVariants: string[];
  outputs: Record<string, string>;
  validatedAt: string;
};

type CheckpointRecordIdentity = Pick<
  CheckpointInput,
  | "dishId"
  | "restaurantId"
  | "sourcePath"
  | "sourceSha256"
  | "recipeId"
  | "schemaVersion"
>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function normalizedCheckpointInput(input: CheckpointInput) {
  return {
    dishId: input.dishId,
    restaurantId: input.restaurantId,
    sourcePath: input.sourcePath,
    sourceSha256: input.sourceSha256.toLowerCase(),
    recipeId: input.recipeId,
    schemaVersion: input.schemaVersion,
    expectedVariants: [...input.expectedVariants].sort(),
    outputs: Object.fromEntries(
      Object.entries(input.outputs)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([variant, sha256]) => [variant, sha256.toLowerCase()])
    ),
    validatedAt: input.validatedAt
  };
}

export function buildCheckpointEnvelope(input: CheckpointInput) {
  const normalized = normalizedCheckpointInput(input);
  return {
    checkpointVersion: 1,
    key: digest(normalized),
    ...normalized
  };
}

export function checkpointEntryMatches(
  envelope: unknown,
  input: CheckpointInput
): boolean {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return false;
  const expected = buildCheckpointEnvelope(input);
  return stableJson(envelope) === stableJson(expected);
}

export function deterministicSourceSetDigest(
  rows: Array<{
    dishId: string;
    restaurantId: string;
    sourcePath: string;
    sourceSha256: string;
  }>
): string {
  return digest(rows.map((row) => ({
    dishId: row.dishId,
    restaurantId: row.restaurantId,
    sourcePath: row.sourcePath,
    sourceSha256: row.sourceSha256.toLowerCase()
  })).sort((left, right) => stableJson(left).localeCompare(stableJson(right))));
}

export async function paginateProviderRows<T>(args: {
  pageSize: number;
  fetchPage: (offset: number, limit: number) => Promise<{
    data: T[] | null;
    error: unknown;
  }>;
  identity: (row: T) => string;
}): Promise<T[]> {
  if (!Number.isInteger(args.pageSize) || args.pageSize < 1) {
    throw new Error("Provider page size is invalid.");
  }
  const rows = new Map<string, T>();
  for (let offset = 0; ; offset += args.pageSize) {
    const page = await args.fetchPage(offset, args.pageSize);
    if (page.error) throw new Error("Provider pagination unavailable.");
    if (!Array.isArray(page.data)) throw new Error("Provider returned a partial page.");
    for (const row of page.data) {
      const identity = args.identity(row);
      if (!identity) throw new Error("Provider row identity is unavailable.");
      const prior = rows.get(identity);
      if (prior !== undefined && stableJson(prior) !== stableJson(row)) {
        throw new Error(`Provider returned conflicting duplicate row: ${identity}`);
      }
      if (prior === undefined) rows.set(identity, row);
    }
    if (page.data.length < args.pageSize) break;
  }
  return [...rows.values()];
}

export function deduplicateMediaObjectBytes(
  objects: Array<{ bucket: string; path: string; bytes: number }>
): number {
  const byIdentity = new Map<string, number>();
  for (const object of objects) {
    if (
      !object.bucket.trim() ||
      !object.path.trim() ||
      !Number.isSafeInteger(object.bytes) ||
      object.bytes < 0
    ) throw new Error("Media object identity or byte size is invalid.");
    const identity = `${object.bucket.trim()}/${object.path.trim()}`;
    const previous = byIdentity.get(identity);
    if (previous !== undefined && previous !== object.bytes) {
      throw new Error(`Conflicting media object byte size: ${identity}`);
    }
    byIdentity.set(identity, object.bytes);
  }
  return [...byIdentity.values()].reduce((total, bytes) => total + bytes, 0);
}

export function buildMeasureReport(args: {
  projectRef: string;
  target: string;
  generatedAt: string;
  usageMeasuredAt: string;
  codeVersion: string;
  recipeId: string;
  schemaVersion: number;
  sourceSetDigest: string;
  rowCount: number;
  sourceCount: number;
  currentGlobalBytes: number;
  existingSourceBytes: number;
  existingDerivativeBytes: number;
  measuredDerivativeBytes: number;
  uniqueAdditionalBytes: number;
  authoritativeQuotaBytes: number;
  errors: string[];
  reasons?: string[];
}) {
  const headroomBeforeBytes = args.authoritativeQuotaBytes - args.currentGlobalBytes;
  const headroomAfterBytes = headroomBeforeBytes - args.uniqueAdditionalBytes;
  const headroomBeforePercent = args.authoritativeQuotaBytes > 0
    ? (headroomBeforeBytes / args.authoritativeQuotaBytes) * 100
    : Number.NaN;
  const headroomAfterPercent = args.authoritativeQuotaBytes > 0
    ? (headroomAfterBytes / args.authoritativeQuotaBytes) * 100
    : Number.NaN;
  const reasons = [...(args.reasons ?? [])];
  if (!isFreshMediaUsageMeasurement(args.usageMeasuredAt, new Date(args.generatedAt))) {
    reasons.push("stale-capacity-usage-measurement");
  }
  if (!Number.isSafeInteger(args.authoritativeQuotaBytes) || args.authoritativeQuotaBytes <= 0) {
    reasons.push("authoritative-quota-unavailable");
  }
  if (!Number.isFinite(headroomAfterPercent) || headroomAfterPercent < 20) {
    reasons.push("minimum-headroom-not-met");
  }
  if (args.errors.length) reasons.push("measurement-errors");
  const uniqueReasons = [...new Set(reasons)];
  const capacityGateStatus = uniqueReasons.length === 0 ? "pass" : "fail";
  return {
    reportSchemaVersion: 1,
    reportVersion: 1,
    projectRef: args.projectRef,
    target: args.target,
    generatedAt: args.generatedAt,
    usageMeasuredAt: args.usageMeasuredAt,
    gitCommit: args.codeVersion,
    gitHead: args.codeVersion,
    codeVersion: args.codeVersion,
    recipeId: args.recipeId,
    schemaVersion: args.schemaVersion,
    sourceSetDigest: args.sourceSetDigest,
    rowCount: args.rowCount,
    rows: args.rowCount,
    sourceCount: args.sourceCount,
    sources: args.sourceCount,
    currentGlobalBytes: args.currentGlobalBytes,
    existingStorageBytes: args.currentGlobalBytes,
    existingSourceBytes: args.existingSourceBytes,
    existingDerivativeBytes: args.existingDerivativeBytes,
    measuredDerivativeBytes: args.measuredDerivativeBytes,
    uniqueAdditionalBytes: args.uniqueAdditionalBytes,
    additionalBytes: args.uniqueAdditionalBytes,
    authoritativeQuotaBytes: args.authoritativeQuotaBytes,
    headroomBeforeBytes,
    headroomBeforePercent,
    headroomAfterBytes,
    headroomAfterPercent,
    headroomPercent: headroomAfterPercent,
    headroomBefore: {
      bytes: headroomBeforeBytes,
      percent: headroomBeforePercent
    },
    headroomAfter: {
      bytes: headroomAfterBytes,
      percent: headroomAfterPercent
    },
    capacity: {
      headroomBeforeBytes,
      headroomBeforePercent,
      headroomAfterBytes,
      headroomAfterPercent
    },
    capacityGate: {
      status: capacityGateStatus,
      minimumHeadroomPercent: 20,
      reasons: uniqueReasons
    },
    status: capacityGateStatus,
    pass: capacityGateStatus === "pass",
    reasons: uniqueReasons,
    errors: [...args.errors]
  };
}

export function validateApplyMeasureReport(
  report: Record<string, unknown>,
  context: {
    now: Date;
    projectRef: string;
    usageMeasuredAt: string;
    codeVersion: string;
    compatibleCommit?: string;
    recipeId: string;
    schemaVersion: number;
    sourceSetDigest: string;
    productionOptIn: boolean;
    mediaWritesEnabled: boolean;
  }
): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  const requiredStrings = [
    "projectRef", "target", "generatedAt", "usageMeasuredAt", "gitCommit", "codeVersion",
    "recipeId", "sourceSetDigest"
  ] as const;
  if (requiredStrings.some((key) => typeof report[key] !== "string" || !(report[key] as string).trim())) {
    reasons.push("invalid-measure-report-schema");
  }
  const requiredIntegers = [
    "schemaVersion", "rowCount", "sourceCount", "currentGlobalBytes",
    "existingSourceBytes", "existingDerivativeBytes", "measuredDerivativeBytes",
    "uniqueAdditionalBytes", "authoritativeQuotaBytes", "headroomBeforeBytes",
    "headroomAfterBytes"
  ] as const;
  if (requiredIntegers.some((key) => (
    typeof report[key] !== "number" ||
    !Number.isSafeInteger(report[key]) ||
    (report[key] as number) < 0
  ))) {
    reasons.push("invalid-measure-report-schema");
  }
  if (
    report.reportSchemaVersion !== 1 ||
    report.reportVersion !== 1 ||
    report.schemaVersion !== context.schemaVersion ||
    typeof report.headroomBeforePercent !== "number" ||
    !Number.isFinite(report.headroomBeforePercent) ||
    typeof report.headroomAfterPercent !== "number" ||
    !Number.isFinite(report.headroomAfterPercent) ||
    report.pass !== true ||
    report.status !== "pass" ||
    !Array.isArray(report.errors) ||
    !report.errors.every((error) => typeof error === "string") ||
    report.errors.length !== 0 ||
    !Array.isArray(report.reasons) ||
    !report.reasons.every((reason) => typeof reason === "string") ||
    report.reasons.length !== 0 ||
    !SHA256_PATTERN.test(String(report.sourceSetDigest ?? "")) ||
    report.gitCommit !== report.codeVersion
  ) {
    reasons.push("invalid-measure-report-schema");
  }
  if (
    report.gitHead !== report.codeVersion ||
    report.rows !== report.rowCount ||
    report.sources !== report.sourceCount ||
    report.existingStorageBytes !== report.currentGlobalBytes ||
    report.additionalBytes !== report.uniqueAdditionalBytes ||
    report.headroomPercent !== report.headroomAfterPercent
  ) {
    reasons.push("inconsistent-measure-report-aliases");
  }
  const headroomBefore = record(report.headroomBefore);
  const headroomAfter = record(report.headroomAfter);
  const capacityGate = record(report.capacityGate);
  if (
    !headroomBefore ||
    headroomBefore.bytes !== report.headroomBeforeBytes ||
    headroomBefore.percent !== report.headroomBeforePercent ||
    !headroomAfter ||
    headroomAfter.bytes !== report.headroomAfterBytes ||
    headroomAfter.percent !== report.headroomAfterPercent ||
    !capacityGate ||
    capacityGate.status !== report.status ||
    capacityGate.minimumHeadroomPercent !== 20 ||
    !Array.isArray(capacityGate.reasons) ||
    stableJson(capacityGate.reasons) !== stableJson(report.reasons)
  ) {
    reasons.push("inconsistent-measure-report-aliases");
  }
  const capacity = record(report.capacity);
  if (!capacity) {
    reasons.push("invalid-measure-report-schema");
  } else {
    for (const key of [
      "headroomBeforeBytes", "headroomBeforePercent",
      "headroomAfterBytes", "headroomAfterPercent"
    ] as const) {
      if (
        typeof capacity[key] !== "number" ||
        !Number.isFinite(capacity[key]) ||
        capacity[key] !== report[key]
      ) reasons.push("inconsistent-capacity-report");
    }
  }
  if (!reasons.includes("invalid-measure-report-schema")) {
    const quotaBytes = report.authoritativeQuotaBytes as number;
    const currentGlobalBytes = report.currentGlobalBytes as number;
    const additionalBytes = report.uniqueAdditionalBytes as number;
    const expectedHeadroomBeforeBytes = quotaBytes - currentGlobalBytes;
    const expectedHeadroomAfterBytes = expectedHeadroomBeforeBytes - additionalBytes;
    const expectedHeadroomBeforePercent = (expectedHeadroomBeforeBytes / quotaBytes) * 100;
    const expectedHeadroomAfterPercent = (expectedHeadroomAfterBytes / quotaBytes) * 100;
    const approximatelyEqual = (left: number, right: number) =>
      Math.abs(left - right) <= 1e-9;
    if (
      quotaBytes <= 0 ||
      report.headroomBeforeBytes !== expectedHeadroomBeforeBytes ||
      report.headroomAfterBytes !== expectedHeadroomAfterBytes ||
      !approximatelyEqual(report.headroomBeforePercent as number, expectedHeadroomBeforePercent) ||
      !approximatelyEqual(report.headroomAfterPercent as number, expectedHeadroomAfterPercent)
    ) reasons.push("inconsistent-capacity-report");
  }
  const generatedAt = Date.parse(String(report.generatedAt ?? ""));
  const age = context.now.getTime() - generatedAt;
  if (!Number.isFinite(generatedAt) || age < 0 || age > MAX_MEASURE_AGE_MS) reasons.push("stale-measure-report");
  const usageMeasuredAt = String(report.usageMeasuredAt ?? "");
  if (
    !isFreshMediaUsageMeasurement(usageMeasuredAt, context.now) ||
    Date.parse(usageMeasuredAt) > generatedAt
  ) reasons.push("stale-capacity-usage-measurement");
  if (usageMeasuredAt !== context.usageMeasuredAt) {
    reasons.push("capacity-usage-measurement-mismatch");
  }
  if (report.reportVersion !== 1) reasons.push("incompatible-report-version");
  if (report.projectRef !== context.projectRef) reasons.push("project-mismatch");
  if (report.recipeId !== context.recipeId || report.schemaVersion !== context.schemaVersion) reasons.push("recipe-mismatch");
  if (report.sourceSetDigest !== context.sourceSetDigest) reasons.push("source-set-mismatch");
  if (
    report.codeVersion !== context.codeVersion &&
    report.codeVersion !== context.compatibleCommit &&
    report.gitCommit !== context.codeVersion &&
    report.gitCommit !== context.compatibleCommit
  ) reasons.push("code-version-mismatch");
  if (typeof report.headroomAfterPercent !== "number" || report.headroomAfterPercent < 20) reasons.push("minimum-headroom-not-met");
  if (typeof report.authoritativeQuotaBytes !== "number" || !Number.isSafeInteger(report.authoritativeQuotaBytes) || report.authoritativeQuotaBytes <= 0) reasons.push("authoritative-quota-unavailable");
  if (report.status !== "pass" || report.pass !== true || !Array.isArray(report.errors) || report.errors.length) reasons.push("measure-report-failed");
  if (!context.productionOptIn) reasons.push("production-opt-in-required");
  if (!context.mediaWritesEnabled) reasons.push("media-write-kill-switch-disabled");
  return reasons.length ? { ok: false, reasons: [...new Set(reasons)] } : { ok: true };
}

export function buildCheckpointRecordKey(input: CheckpointRecordIdentity): string {
  return digest({
    dishId: input.dishId,
    restaurantId: input.restaurantId,
    sourcePath: input.sourcePath,
    sourceSha256: input.sourceSha256.toLowerCase(),
    recipeId: input.recipeId,
    schemaVersion: input.schemaVersion
  });
}

export function isFreshMediaUsageMeasurement(
  value: unknown,
  now: Date = new Date()
): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const measuredAt = Date.parse(value);
  const nowMs = now.getTime();
  const age = nowMs - measuredAt;
  return (
    Number.isFinite(nowMs) &&
    Number.isFinite(measuredAt) &&
    age >= 0 &&
    age <= MAX_MEASURE_AGE_MS
  );
}

function hasDishPhotoSignal(
  metadata: Record<string, unknown>,
  imageUrl: unknown
): boolean {
  const hasImageUrl = typeof imageUrl === "string" && imageUrl.trim().length > 0;
  const hasReadyStatus = metadata.photoStatus === "ready";
  const contractKeys = [
    "photoStorageBucket",
    "photoStoragePath",
    "photoSha256",
    "photoContentType",
    "photoBytes",
    "photoDerivatives"
  ];
  return (
    hasImageUrl ||
    hasReadyStatus ||
    contractKeys.some((key) => Object.hasOwn(metadata, key))
  );
}

export function planDishPhotoBackfillSource(
  row: Record<string, unknown>,
  filters: { restaurantId?: string; dishId?: string } = {}
):
  | { status: "filtered" | "no-photo" }
  | { status: "invalid"; error: string }
  | {
      status: "valid";
      metadata: Record<string, unknown>;
      restaurantId: string;
      sourcePath: string;
      sourceSha: string;
    } {
  const dishId = typeof row.id === "string" ? row.id : String(row.id ?? "");
  const restaurantId = typeof row.restaurant_id === "string"
    ? row.restaurant_id
    : "";
  if (filters.dishId && dishId !== filters.dishId) return { status: "filtered" };
  if (filters.restaurantId && restaurantId !== filters.restaurantId) {
    return { status: "filtered" };
  }

  const parsed = parseMediaMetadata(row.metadata);
  const metadata = parsed.metadata;
  const sourcePath = typeof metadata.photoStoragePath === "string"
    ? metadata.photoStoragePath
    : "";
  const rawSourceSha = typeof metadata.photoSha256 === "string"
    ? metadata.photoSha256
    : "";
  const imageUrl = typeof row.image_url === "string" ? row.image_url.trim() : "";
  const hasPhotoSignal = hasDishPhotoSignal(metadata, imageUrl);
  if (parsed.valid && !hasPhotoSignal) return { status: "no-photo" };

  const sourceSha = rawSourceSha.toLowerCase();
  const safePath = RESTAURANT_ID_PATTERN.test(restaurantId) &&
    sourcePath === sourcePath.trim() &&
    new RegExp(
      `^restaurants/${restaurantId}/photos/originals/[a-z0-9][a-z0-9._-]*\\.(?:jpg|png|webp)$`,
      "i"
    ).test(sourcePath) &&
    !sourcePath.includes("..");
  if (
    !parsed.valid ||
    !RESTAURANT_ID_PATTERN.test(restaurantId) ||
    rawSourceSha !== rawSourceSha.trim() ||
    !/^[a-f0-9]{64}$/i.test(rawSourceSha) ||
    !safePath
  ) {
    return {
      status: "invalid",
      error: `Invalid photo source contract for dish ${dishId || "unknown"}.`
    };
  }
  return { status: "valid", metadata, restaurantId, sourcePath, sourceSha };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parseMediaMetadata(value: unknown): {
  metadata: Record<string, unknown>;
  valid: boolean;
} {
  const objectValue = record(value);
  if (objectValue) return { metadata: objectValue, valid: true };
  if (typeof value === "string") {
    try {
      const parsed = record(JSON.parse(value));
      return parsed
        ? { metadata: parsed, valid: true }
        : { metadata: {}, valid: false };
    } catch {
      return { metadata: {}, valid: false };
    }
  }
  return { metadata: {}, valid: value === null || value === undefined };
}

export function requireStorageObjectBytes(
  metadata: unknown,
  identity: string
): number {
  const value = record(metadata);
  const bytes = value?.size ?? value?.size_bytes;
  if (typeof bytes !== "number" || !Number.isSafeInteger(bytes) || bytes < 0) {
    throw new Error(`unknown object size: ${identity}`);
  }
  return bytes;
}

export function validateDerivativeMetadata(args: {
  restaurantId: string;
  sourceSha256: string;
  variant: DishPhotoDerivativeVariant;
  metadata: unknown;
}): string[] {
  const reasons: string[] = [];
  const metadata = record(args.metadata);
  if (!metadata) return ["invalid-metadata"];
  const outputSha256 = String(metadata.outputSha256 ?? "").toLowerCase();
  const legacySha256 = String(metadata.sha256 ?? "").toLowerCase();
  const canonicalPath = `restaurants/${args.restaurantId}/photos/derivatives/${args.sourceSha256.toLowerCase()}/${DISH_PHOTO_RECIPE.id}/${args.variant}-${outputSha256}.webp`;
  if (metadata.schemaVersion !== DISH_PHOTO_RECIPE.schemaVersion) reasons.push("wrong-schema-version");
  if (metadata.recipeId !== DISH_PHOTO_RECIPE.id) reasons.push("wrong-recipe");
  if (metadata.variant !== args.variant) reasons.push("wrong-variant");
  if (String(metadata.sourceSha256 ?? "").toLowerCase() !== args.sourceSha256.toLowerCase()) reasons.push("wrong-source-sha");
  if (!SHA256_PATTERN.test(outputSha256)) reasons.push("wrong-output-sha");
  if (legacySha256 && legacySha256 !== outputSha256) reasons.push("wrong-legacy-sha");
  if (metadata.storagePath !== canonicalPath) reasons.push("wrong-canonical-path");
  if (metadata.contentType !== "image/webp" || metadata.format !== "webp") reasons.push("wrong-content-type");
  if (!Number.isSafeInteger(Number(metadata.bytes)) || Number(metadata.bytes) <= 0) reasons.push("wrong-size");
  return [...new Set(reasons)];
}

export function validateLegacyDerivativeMetadata(args: {
  restaurantId: string;
  sourceSha256: string;
  variant: DishPhotoDerivativeVariant;
  metadata: unknown;
}): string[] {
  const reasons: string[] = [];
  const metadata = record(args.metadata);
  if (!metadata) return ["invalid-metadata"];
  const sourceSha256 = args.sourceSha256.toLowerCase();
  const outputSha256 = String(metadata.outputSha256 ?? metadata.sha256 ?? "").toLowerCase();
  const legacySha256 = String(metadata.sha256 ?? "").toLowerCase();
  const canonicalPath = `restaurants/${args.restaurantId}/photos/derivatives/${sourceSha256}/${args.variant}.webp`;
  if (metadata.schemaVersion !== 1) reasons.push("wrong-schema-version");
  if (metadata.recipeId !== "dish-photo-v1") reasons.push("wrong-recipe");
  if (metadata.variant !== args.variant) reasons.push("wrong-variant");
  if (String(metadata.sourceSha256 ?? "").toLowerCase() !== sourceSha256) reasons.push("wrong-source-sha");
  if (!SHA256_PATTERN.test(outputSha256)) reasons.push("wrong-output-sha");
  if (!SHA256_PATTERN.test(legacySha256) || legacySha256 !== outputSha256) reasons.push("wrong-legacy-sha");
  if (metadata.storagePath !== canonicalPath) reasons.push("wrong-canonical-path");
  if (metadata.contentType !== "image/webp" || metadata.format !== "webp") reasons.push("wrong-content-type");
  if (typeof metadata.bytes !== "number" || !Number.isSafeInteger(metadata.bytes) || metadata.bytes <= 0) reasons.push("wrong-size");
  return [...new Set(reasons)];
}

export async function verifyLegacyDerivativeObject(args: {
  restaurantId: string;
  sourceSha256: string;
  variant: DishPhotoDerivativeVariant;
  metadata: unknown;
  object: { bytes: number; contentType: string; body?: Buffer } | null;
  verifyHash: boolean;
}) {
  const reasons = validateLegacyDerivativeMetadata(args);
  const metadata = record(args.metadata) ?? {};
  if (!args.object) reasons.push("missing-object");
  else {
    if (args.object.bytes !== metadata.bytes) reasons.push("wrong-size");
    if (args.object.contentType.split(";")[0].toLowerCase() !== "image/webp") reasons.push("wrong-content-type");
    if (args.verifyHash) {
      if (!args.object.body) reasons.push("hash-unavailable");
      else {
        const actualSha = createHash("sha256").update(args.object.body).digest("hex");
        const expectedSha = String(metadata.outputSha256 ?? metadata.sha256 ?? "").toLowerCase();
        if (actualSha !== expectedSha) reasons.push("wrong-hash");
      }
    }
  }
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export async function verifyDerivativeObject(args: {
  restaurantId: string;
  sourceSha256: string;
  variant: DishPhotoDerivativeVariant;
  metadata: unknown;
  object: { bytes: number; contentType: string; body?: Buffer } | null;
  verifyHash: boolean;
}) {
  const reasons = validateDerivativeMetadata(args);
  const metadata = record(args.metadata) ?? {};
  if (!args.object) reasons.push("missing-object");
  else {
    if (args.object.bytes !== Number(metadata.bytes)) reasons.push("wrong-size");
    if (args.object.contentType.split(";")[0].toLowerCase() !== "image/webp") reasons.push("wrong-content-type");
    if (args.verifyHash) {
      if (!args.object.body) reasons.push("hash-unavailable");
      else {
        const actualSha = createHash("sha256").update(args.object.body).digest("hex");
        if (actualSha !== String(metadata.outputSha256 ?? "").toLowerCase()) reasons.push("wrong-hash");
      }
    }
  }
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function classifyDishPhotoUsage(args: {
  metadata: unknown;
  metadataValid?: boolean;
  imageUrl?: unknown;
  objectResults?: Partial<Record<DishPhotoDerivativeVariant | "source", { reasons?: string[] }>>;
}) {
  const metadata = record(args.metadata) ?? {};
  if (args.metadataValid === false) {
    return { classification: "invalid-metadata", status: "fail", reasons: ["invalid-metadata"] };
  }
  const sourcePath = String(metadata.photoStoragePath ?? "");
  const sourceSha256 = String(metadata.photoSha256 ?? "").toLowerCase();
  if (!sourcePath && !sourceSha256) {
    if (hasDishPhotoSignal(metadata, undefined)) {
      return { classification: "invalid-metadata", status: "fail", reasons: ["invalid-metadata"] };
    }
    if (typeof args.imageUrl === "string" && args.imageUrl.trim()) {
      return { classification: "image-url-only", status: "partial", reasons: ["image-url-fallback"] };
    }
    return { classification: "no-photo", status: "pass", reasons: [] as string[] };
  }
  if (!sourcePath || !SHA256_PATTERN.test(sourceSha256) || metadata.photoStorageBucket !== "vistaire-media") {
    return { classification: "invalid-metadata", status: "fail", reasons: ["invalid-metadata"] };
  }
  const sourceReasons = args.objectResults?.source?.reasons ?? [];
  if (sourceReasons.length) {
    return { classification: sourceReasons[0], status: "fail", reasons: sourceReasons };
  }
  const derivatives = record(metadata.photoDerivatives);
  if (!derivatives) {
    return { classification: "original-only", status: "partial", reasons: ["original-fallback"] };
  }
  if (Object.keys(derivatives).length === 0) {
    return { classification: "partial", status: "partial", reasons: ["empty-derivatives"] };
  }
  const allReasons: string[] = [];
  let v2Count = 0;
  let legacyCount = 0;
  for (const variant of DISH_PHOTO_DERIVATIVE_VARIANTS) {
    const value = derivatives[variant];
    if (!value) {
      allReasons.push("missing-object");
      continue;
    }
    const valueRecord = record(value) ?? {};
    if (valueRecord.schemaVersion === 1 || valueRecord.recipeId === "dish-photo-v1") {
      const reasons = validateLegacyDerivativeMetadata({
        restaurantId: sourcePath.split("/")[1] ?? "",
        sourceSha256,
        variant,
        metadata: value
      });
      allReasons.push(...reasons);
      if (!reasons.length) legacyCount += 1;
    } else {
      const reasons = validateDerivativeMetadata({
        restaurantId: sourcePath.split("/")[1] ?? "",
        sourceSha256,
        variant,
        metadata: value
      });
      allReasons.push(...reasons);
      if (!reasons.length) v2Count += 1;
    }
    allReasons.push(...(args.objectResults?.[variant]?.reasons ?? []));
  }
  const uniqueReasons = [...new Set(allReasons)];
  if (uniqueReasons.length) {
    const priority = [
      "invalid-metadata", "wrong-recipe", "wrong-schema-version", "wrong-source-sha",
      "wrong-output-sha", "wrong-legacy-sha", "wrong-hash", "wrong-canonical-path",
      "wrong-size", "wrong-content-type", "missing-object"
    ];
    const classification = priority.find((reason) => uniqueReasons.includes(reason)) ?? "partial";
    return { classification, status: classification === "missing-object" ? "partial" : "fail", reasons: uniqueReasons };
  }
  if (v2Count === DISH_PHOTO_DERIVATIVE_VARIANTS.length) {
    return { classification: "v2-complete", status: "pass", reasons: [] as string[] };
  }
  if (legacyCount === DISH_PHOTO_DERIVATIVE_VARIANTS.length) {
    return { classification: "legacy-v1-complete", status: "pass", reasons: [] as string[] };
  }
  return { classification: "partial", status: "partial", reasons: ["incomplete-variant-set"] };
}

export function isExpectedDerivativeVariant(value: unknown): value is DishPhotoDerivativeVariant {
  return isDishPhotoDerivativeVariant(value);
}

type PhotoCoverageEntry = {
  classification?: unknown;
  status?: unknown;
  reasons?: unknown;
};

export function buildStrictPhotoCoverageCounts(entries: PhotoCoverageEntry[]) {
  const hasClassification = (entry: PhotoCoverageEntry, value: string) =>
    entry.classification === value;
  const hasReason = (entry: PhotoCoverageEntry, value: string) =>
    Array.isArray(entry.reasons) && entry.reasons.includes(value);
  const matches = (entry: PhotoCoverageEntry, value: string) =>
    hasClassification(entry, value) || hasReason(entry, value);
  const count = (predicate: (entry: PhotoCoverageEntry) => boolean) =>
    entries.filter(predicate).length;

  return {
    rowsWithoutPhoto: count((entry) => hasClassification(entry, "no-photo")),
    rowsOriginalOnly: count((entry) => hasClassification(entry, "original-only")),
    rowsV1Complete: count((entry) => hasClassification(entry, "legacy-v1-complete")),
    rowsV2Complete: count((entry) => hasClassification(entry, "v2-complete")),
    rowsPartial: count((entry) => entry.status === "partial"),
    rowsInvalidMetadata: count((entry) => matches(entry, "invalid-metadata")),
    rowsWrongRecipe: count((entry) => matches(entry, "wrong-recipe")),
    rowsWrongSourceSha: count((entry) => matches(entry, "wrong-source-sha")),
    rowsWrongOutputSha: count((entry) => matches(entry, "wrong-output-sha")),
    rowsMissingObject: count((entry) => matches(entry, "missing-object")),
    rowsWrongSize: count((entry) => matches(entry, "wrong-size")),
    rowsWrongContentType: count((entry) => matches(entry, "wrong-content-type")),
    rowsHashMismatch: count((entry) => matches(entry, "wrong-hash")),
    rowsOriginalFallback: count((entry) =>
      hasClassification(entry, "original-only") ||
      hasClassification(entry, "image-url-only") ||
      hasReason(entry, "original-fallback") ||
      hasReason(entry, "image-url-fallback")
    )
  };
}

export const MEDIA_MEASURE_MAX_AGE_MS = MAX_MEASURE_AGE_MS;
