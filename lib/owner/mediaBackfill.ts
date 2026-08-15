import { createHash } from "node:crypto";

import {
  DISH_PHOTO_DERIVATIVE_VARIANTS,
  DISH_PHOTO_RECIPE,
  isDishPhotoDerivativeVariant,
  type DishPhotoDerivativeVariant
} from "./dishPhotoRecipe.ts";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_MEASURE_AGE_MS = 15 * 60 * 1000;

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

export function buildMeasureReport(args: {
  projectRef: string;
  target: string;
  generatedAt: string;
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
  if (!Number.isSafeInteger(args.authoritativeQuotaBytes) || args.authoritativeQuotaBytes <= 0) {
    reasons.push("authoritative-quota-unavailable");
  }
  if (!Number.isFinite(headroomAfterPercent) || headroomAfterPercent < 20) {
    reasons.push("minimum-headroom-not-met");
  }
  if (args.errors.length) reasons.push("measurement-errors");
  return {
    reportVersion: 1,
    projectRef: args.projectRef,
    target: args.target,
    generatedAt: args.generatedAt,
    gitCommit: args.codeVersion,
    codeVersion: args.codeVersion,
    recipeId: args.recipeId,
    schemaVersion: args.schemaVersion,
    sourceSetDigest: args.sourceSetDigest,
    rowCount: args.rowCount,
    sourceCount: args.sourceCount,
    currentGlobalBytes: args.currentGlobalBytes,
    existingSourceBytes: args.existingSourceBytes,
    existingDerivativeBytes: args.existingDerivativeBytes,
    measuredDerivativeBytes: args.measuredDerivativeBytes,
    uniqueAdditionalBytes: args.uniqueAdditionalBytes,
    authoritativeQuotaBytes: args.authoritativeQuotaBytes,
    headroomBeforeBytes,
    headroomBeforePercent,
    headroomAfterBytes,
    headroomAfterPercent,
    capacity: {
      headroomBeforeBytes,
      headroomBeforePercent,
      headroomAfterBytes,
      headroomAfterPercent
    },
    status: reasons.length === 0 ? "pass" : "fail",
    pass: reasons.length === 0,
    reasons: [...new Set(reasons)],
    errors: [...args.errors]
  };
}

export function validateApplyMeasureReport(
  report: Record<string, unknown>,
  context: {
    now: Date;
    projectRef: string;
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
  const generatedAt = Date.parse(String(report.generatedAt ?? ""));
  const age = context.now.getTime() - generatedAt;
  if (!Number.isFinite(generatedAt) || age < 0 || age > MAX_MEASURE_AGE_MS) reasons.push("stale-measure-report");
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
  const capacity = report.capacity && typeof report.capacity === "object"
    ? report.capacity as Record<string, unknown>
    : {};
  if (Number(capacity.headroomAfterPercent) < 20) reasons.push("minimum-headroom-not-met");
  if (!Number.isSafeInteger(Number(report.authoritativeQuotaBytes)) || Number(report.authoritativeQuotaBytes) <= 0) reasons.push("authoritative-quota-unavailable");
  if (report.status !== "pass" || (Array.isArray(report.errors) && report.errors.length)) reasons.push("measure-report-failed");
  if (!context.productionOptIn) reasons.push("production-opt-in-required");
  if (!context.mediaWritesEnabled) reasons.push("media-write-kill-switch-disabled");
  return reasons.length ? { ok: false, reasons: [...new Set(reasons)] } : { ok: true };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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
  objectResults?: Partial<Record<DishPhotoDerivativeVariant | "source", { reasons?: string[] }>>;
}) {
  const metadata = record(args.metadata) ?? {};
  const sourcePath = String(metadata.photoStoragePath ?? "");
  const sourceSha256 = String(metadata.photoSha256 ?? "").toLowerCase();
  if (!sourcePath && !sourceSha256) {
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
      legacyCount += 1;
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

export const MEDIA_MEASURE_MAX_AGE_MS = MAX_MEASURE_AGE_MS;
