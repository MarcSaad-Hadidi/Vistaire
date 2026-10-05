import "server-only";

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { cache } from "react";
import {
  filterOwner3dAccessibleItems,
  type Owner3dAccessIdentity
} from "@/lib/auth/owner3dAccess";
import { getAllDishes, getRestaurant } from "@/lib/demoMenuData";
import {
  PIPELINE_ACTIONS,
  PIPELINE_OVERVIEW_CARDS,
  formatPipelineBytes,
  pipelineStatusNextAction,
  resolvePipelineStatus,
  shouldPreserveDemoFallbackAssets,
  type PipelineAssetSource,
  type PipelineActionId,
  type PipelineStatusId,
  type PipelineStatusTone
} from "@/lib/owner/threeDArPipelineModel";
import {
  buildCdnWorkflowState,
  cdnStorageConfigured,
  type CdnWorkflowState
} from "@/lib/owner/threeDCdnWorkflow";
import {
  buildOwner3dLifecycleState,
  type Owner3dLifecycleState
} from "@/lib/owner/threeDLifecycleModel";
import { cleanOwner3dPathSegment } from "@/lib/owner/owner3dPathSegments";

type JsonObject = Record<string, unknown>;

export type Owner3dPipelineAction = {
  id: PipelineActionId;
  label: string;
  command: string;
  disabledReason: string;
  confirmationRequired: boolean;
  confirmationCopy: string | null;
  destructive: boolean;
  executesInUi: false;
};

export type Owner3dPipelineSection = {
  title: string;
  status: string;
  tone: PipelineStatusTone;
  rows: Array<{
    label: string;
    value: string;
    detail?: string;
  }>;
};

export type Owner3dPipelineAsset = {
  id: string;
  restaurantSlug: string;
  restaurantName: string;
  menuSlug: string;
  menuName: string;
  dishSlug: string;
  dishName: string;
  version: string;
  status: PipelineStatusId;
  statusLabel: string;
  statusTone: PipelineStatusTone;
  selectedCandidate: string;
  lastRun: string;
  nextAction: string;
  source: PipelineAssetSource;
  manifestPath: string | null;
  reportDirectory: string | null;
  detailHref: string;
  versionHref: string;
  reviewHref: string;
  sections: Owner3dPipelineSection[];
  actions: Owner3dPipelineAction[];
  cdn: CdnWorkflowState;
  lifecycle: Owner3dLifecycleState;
};

export type Owner3dPipelineOverview = {
  cards: Array<{
    id: PipelineStatusId;
    label: string;
    tone: PipelineStatusTone;
    value: number;
  }>;
  assets: Owner3dPipelineAsset[];
  source: "manifests" | "fallback";
  note: string;
};

type PipelineIdentity = {
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
  version: string;
};

type ReportBundle = {
  directory: string;
  sourceAnalysis: JsonObject | null;
  candidateReport: JsonObject | null;
  visualQuality: JsonObject | null;
  visualReport: JsonObject | null;
  optimizationReport: JsonObject | null;
  uploadPlan: JsonObject | null;
  networkValidation: JsonObject | null;
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function objectValue(value: unknown): JsonObject | null {
  return isObject(value) ? value : null;
}

function readJsonObject(filePath: string): JsonObject | null {
  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) return null;
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toRepoPath(filePath: string): string {
  return relative(/* turbopackIgnore: true */ process.cwd(), filePath).replaceAll("\\", "/");
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateLabel(value: unknown): string {
  const raw = stringValue(value);
  if (!raw) return "Aucune exécution";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("fr-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function shortFingerprint(value: unknown): string {
  const fingerprint = stringValue(value);
  if (!fingerprint) return "Non disponible";
  if (fingerprint.length <= 18) return fingerprint;
  return `${fingerprint.slice(0, 8)}...${fingerprint.slice(-8)}`;
}

function latestDateLabel(values: unknown[]): string {
  const dates = values
    .map((value) => new Date(stringValue(value)).getTime())
    .filter((value) => Number.isFinite(value));
  if (dates.length === 0) return "Aucune exécution";
  return formatDateLabel(new Date(Math.max(...dates)).toISOString());
}

function commandIdentity(identity: PipelineIdentity): string {
  return [
    "--restaurant",
    identity.restaurantSlug,
    "--menu",
    identity.menuSlug,
    "--dish",
    identity.dishSlug,
    "--version",
    identity.version
  ].join(" ");
}

function manifestPathFor(identity: PipelineIdentity): string {
  return `public/models/restaurants/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}/manifest.json`;
}

function reportsPathFor(identity: PipelineIdentity): string {
  return `assets/3d/reports/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}`;
}

function sourcePathFor(identity: PipelineIdentity): string {
  return `assets/3d/source/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}/source.glb`;
}

function commandFor(action: PipelineActionId, identity: PipelineIdentity): string {
  const manifest = manifestPathFor(identity);
  const reports = reportsPathFor(identity);
  const source = sourcePathFor(identity);
  const prefix = commandIdentity(identity);

  if (action === "upload_source") {
    return `Place source outside Git, then copy into ignored ${source}`;
  }
  if (action === "run_analyze") {
    return `npm run 3d:analyze-source -- ${prefix} --source ${source} --out ${reports}/source-analysis.json --markdown ${reports}/source-analysis.md`;
  }
  if (action === "run_optimize") {
    return `npm run 3d:optimize-dish -- ${prefix} --source ${source} --write --cdn-base-url <https://cdn.example.com/vistaire>`;
  }
  if (action === "run_visual_compare") {
    return `npm run 3d:visual-compare -- --source ${source} --candidate assets/3d/work/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}/mobile/${identity.dishSlug}-mobile.glb --variant mobile --out ${reports}/visual/mobile --threshold strict`;
  }
  if (action === "approve_visual") {
    return `npm run 3d:approve-visual -- --manifest ${manifest} --approved-by "<owner>" --write`;
  }
  if (action === "record_device_qa") {
    return `npm run 3d:record-device-qa -- --manifest ${manifest} --device iphoneQuickLook --status passed --device-name "<device>" --os "<os>" --tested-by "<owner>" --tested-at "<iso-date>" --evidence ${reports}/device-qa/iphone.md --write`;
  }
  if (action === "prepare_cdn") {
    return `npm run 3d:prepare-cdn-upload -- --manifest ${manifest} --out ${reports}/upload-plan.json --write`;
  }
  if (action === "finalize") {
    return `npm run 3d:finalize-manifest -- --manifest ${manifest} --network-validation-report ${reports}/network-validation.json --write`;
  }
  if (action === "publish") {
    return `npm run 3d:publish -- --manifest ${manifest} --network-validation-report ${reports}/network-validation.json --quality-approved --approved-by "<owner>" --write`;
  }
  return `npm run 3d:rollback -- --restaurant ${identity.restaurantSlug} --menu ${identity.menuSlug} --dish ${identity.dishSlug} --to <previous-version> --approved-by "<owner>" --write`;
}

function buildActions(identity: PipelineIdentity): Owner3dPipelineAction[] {
  return PIPELINE_ACTIONS.map((action) => ({
    ...action,
    command: commandFor(action.id, identity),
    disabledReason:
      action.id === "upload_source"
        ? "Upload branché sur un staging privé Supabase seulement si le storage est configuré ; aucun fichier n'est écrit dans public/models."
        : "Action non exécutée depuis l'UI : copiez la commande et lancez-la dans le terminal après revue.",
    confirmationCopy: action.confirmationRequired
      ? action.destructive
        ? "Confirmation explicite requise avant toute promotion ou rollback."
        : "Confirmation humaine requise avant d'écrire dans le manifest."
      : null
  }));
}

function reportBundle(rootDir: string, identity: PipelineIdentity): ReportBundle {
  const directory = join(
    rootDir,
    "assets",
    "3d",
    "reports",
    identity.restaurantSlug,
    identity.menuSlug,
    identity.dishSlug,
    identity.version
  );

  return {
    directory,
    sourceAnalysis: readJsonObject(join(directory, "source-analysis.json")),
    candidateReport: readJsonObject(join(directory, "candidate-report.json")),
    visualQuality: readJsonObject(join(directory, "visual-quality.json")),
    visualReport: readJsonObject(join(directory, "visual-report.json")),
    optimizationReport: readJsonObject(join(directory, "optimization-report.json")),
    uploadPlan: readJsonObject(join(directory, "upload-plan.json")),
    networkValidation: readJsonObject(join(directory, "network-validation.json"))
  };
}

function identityFromManifest(path: string, manifest: JsonObject): PipelineIdentity | null {
  const normalized = path.replaceAll("\\", "/");
  const match = normalized.match(
    /public\/models\/restaurants\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/manifest\.json$/
  );
  const restaurantSlug = cleanOwner3dPathSegment(
    stringValue(manifest.restaurantSlug, match?.[1] ?? "")
  );
  const menuSlug = cleanOwner3dPathSegment(stringValue(manifest.menuSlug, match?.[2] ?? ""));
  const dishSlug = cleanOwner3dPathSegment(stringValue(manifest.dishSlug, match?.[3] ?? ""));
  const version = cleanOwner3dPathSegment(
    stringValue(manifest.activeVersion, match?.[4] ?? stringValue(manifest.version))
  );

  if (!restaurantSlug || !menuSlug || !dishSlug || !version) return null;
  return { restaurantSlug, menuSlug, dishSlug, version };
}

function scanManifestFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const next = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanManifestFiles(next));
    } else if (entry.isFile() && entry.name === "manifest.json") {
      files.push(next);
    }
  }

  return files;
}

function scanReportIdentities(rootDir: string): PipelineIdentity[] {
  const reportsRoot = join(rootDir, "assets", "3d", "reports");
  if (!existsSync(reportsRoot)) return [];
  const identities: PipelineIdentity[] = [];

  function walk(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    const hasReport = entries.some(
      (entry) => entry.isFile() && entry.name.endsWith(".json")
    );
    if (hasReport) {
      const parts = relative(reportsRoot, dir).split(/[\\/]+/).filter(Boolean);
      if (parts.length >= 4) {
        const [restaurantSlug, menuSlug, dishSlug, version] = parts;
        identities.push({ restaurantSlug, menuSlug, dishSlug, version });
      }
    }

    for (const entry of entries) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
    }
  }

  walk(reportsRoot);
  return identities;
}

function maybeNameFromManifest(manifest: JsonObject, key: string, slug: string): string {
  return stringValue(manifest[key], titleFromSlug(slug));
}

function candidateLabel(candidateReport: JsonObject | null, manifest: JsonObject | null): string {
  const fromReport = candidateReport?.selectedCandidate;
  if (fromReport === null) return "No candidate passed";
  if (typeof fromReport === "string" && fromReport) return fromReport;

  const fromManifest = objectValue(manifest?.candidateReport)?.selectedCandidate;
  if (fromManifest === null) return "No candidate passed";
  if (typeof fromManifest === "string" && fromManifest) return fromManifest;

  return "Non sélectionné";
}

function deviceStatus(realDeviceQa: JsonObject | null, key: string): string {
  const item = objectValue(realDeviceQa?.[key]);
  return stringValue(item?.status, "not-tested");
}

function hasDeviceEvidence(realDeviceQa: JsonObject | null, key: string): boolean {
  const item = objectValue(realDeviceQa?.[key]);
  const evidence = objectValue(item?.evidence);
  return Boolean(
    evidence &&
      typeof evidence.sha256 === "string" &&
      /^[a-f0-9]{64}$/i.test(evidence.sha256) &&
      Number.isFinite(evidence.bytes) &&
      Number(evidence.bytes) > 0
  );
}

function deviceQaSectionStatus(realDeviceQa: JsonObject | null): string {
  const iphone = deviceStatus(realDeviceQa, "iphoneQuickLook");
  const android = deviceStatus(realDeviceQa, "androidSceneViewer");
  if (iphone === "passed" && android === "passed") {
    return hasDeviceEvidence(realDeviceQa, "iphoneQuickLook") &&
      hasDeviceEvidence(realDeviceQa, "androidSceneViewer")
      ? "passed"
      : "needs evidence";
  }
  if ([iphone, android].some((status) => status === "failed" || status === "blocked")) {
    return "failed";
  }
  return "not-tested";
}

function toneForSection(status: string): PipelineStatusTone {
  if (/passed|approved|ready|published|prepared/i.test(status)) return "ready";
  if (/failed|rejected|missing/i.test(status)) return "danger";
  if (/pending|review|warning|not-tested|needs evidence/i.test(status)) return "warn";
  return "muted";
}

function section(title: string, status: string, rows: Owner3dPipelineSection["rows"]): Owner3dPipelineSection {
  return {
    title,
    status,
    tone: toneForSection(status),
    rows
  };
}

function sectionsForAsset(args: {
  identity: PipelineIdentity;
  manifest: JsonObject | null;
  reports: ReportBundle;
  cdn: CdnWorkflowState;
  fallback?: {
    dishName: string;
    runtimeModelCount: number;
  };
}): Owner3dPipelineSection[] {
  const manifestSourceAnalysis = objectValue(args.manifest?.sourceAnalysis);
  const sourceAnalysis = manifestSourceAnalysis ?? args.reports.sourceAnalysis;
  const candidateReport =
    args.reports.candidateReport ?? objectValue(args.manifest?.candidateReport);
  const visualQuality =
    objectValue(args.manifest?.visualQuality) ?? args.reports.visualQuality;
  const quality = objectValue(args.manifest?.quality);
  const realDeviceQa = objectValue(quality?.realDeviceQa);
  const uploadPlanUploads = args.cdn.variants.filter(
    (variant) => variant.uploadStatus !== "missing_manifest" && variant.uploadStatus !== "missing_plan"
  ).length;
  const networkValidated = args.cdn.variants.filter((variant) => variant.network.ok).length;

  return [
    section(
      "Source analysis",
      sourceAnalysis ? "Disponible" : "Non disponible",
      [
        {
          label: "Bytes source",
          value: formatPipelineBytes(sourceAnalysis?.bytes),
          detail: "Lecture metadata uniquement ; aucun fichier modèle n'est chargé par l'UI."
        },
        {
          label: "Triangles",
          value: stringValue(sourceAnalysis?.triangles, "Non disponible")
        },
        {
          label: "Classification",
          value: stringValue(sourceAnalysis?.classification, "Non classée")
        },
        {
          label: "SHA-256",
          value: shortFingerprint(sourceAnalysis?.sha256)
        }
      ]
    ),
    section(
      "Candidate report",
      candidateReport ? stringValue(candidateReport.decision && objectValue(candidateReport.decision)?.status, "Report présent") : "Aucun rapport",
      [
        {
          label: "Selected candidate",
          value: candidateLabel(candidateReport, args.manifest)
        },
        {
          label: "Decision",
          value: stringValue(objectValue(candidateReport?.decision)?.reason, "En attente de comparaison stricte")
        },
        {
          label: "Optimization report",
          value: args.reports.optimizationReport ? "Disponible" : "Non disponible"
        }
      ]
    ),
    section(
      "Visual quality",
      stringValue(visualQuality?.status, "unvalidated"),
      [
        {
          label: "Méthode",
          value: stringValue(visualQuality?.method, "Aucune preuve rendue stricte")
        },
        {
          label: "Mean SSIM",
          value: stringValue(visualQuality?.meanSsim, "Non disponible")
        },
        {
          label: "Manual review",
          value: stringValue(
            objectValue(visualQuality?.manualReview)?.status,
            quality?.manualVisualApproved === true ? "approved" : "pending"
          )
        },
        {
          label: "Visual report",
          value: args.reports.visualReport || visualQuality?.report ? "Disponible" : "Non disponible"
        }
      ]
    ),
    section(
      "Device QA",
      deviceQaSectionStatus(realDeviceQa),
      [
        {
          label: "iPhone Quick Look",
          value: deviceStatus(realDeviceQa, "iphoneQuickLook")
        },
        {
          label: "Android Scene Viewer",
          value: deviceStatus(realDeviceQa, "androidSceneViewer")
        },
        {
          label: "Caveat",
          value: "Ne pas déclarer validé sans appareil réel."
        }
      ]
    ),
    section(
      "CDN",
      args.cdn.networkReportOk
        ? "Network validated"
        : args.cdn.uploadPlanGenerated
          ? "Upload plan ready"
          : args.cdn.storageStatusLabel,
      [
        {
          label: "Upload plan",
          value: args.cdn.uploadPlanGenerated ? `${uploadPlanUploads} assets` : "Plan only / manual runner"
        },
        {
          label: "Network validation",
          value: args.cdn.networkReportOk
            ? `${networkValidated}/5 variants validated`
            : args.cdn.blockReason || "Network report required"
        },
        {
          label: "Storage",
          value: args.cdn.storageStatusLabel
        },
        {
          label: "Ready to finalize",
          value: args.cdn.readyToFinalize ? "Oui" : "Non"
        }
      ]
    ),
    section(
      "Publish status",
      stringValue(args.manifest?.status, args.fallback ? "demo runtime hors pipeline" : "Non publié"),
      [
        {
          label: "Manifest",
          value: args.manifest ? manifestPathFor(args.identity) : "Aucun manifest production"
        },
        {
          label: "Published at",
          value: formatDateLabel(args.manifest?.publishedAt)
        },
        {
          label: "Fallback",
          value: args.fallback
            ? `${args.fallback.dishName} possède ${args.fallback.runtimeModelCount} asset(s) démo, sans état pipeline production.`
            : "Non"
        }
      ]
    )
  ];
}

function assetFromManifest(rootDir: string, manifestPath: string, manifest: JsonObject): Owner3dPipelineAsset | null {
  const identity = identityFromManifest(toRepoPath(manifestPath), manifest);
  if (!identity) return null;
  const reports = reportBundle(rootDir, identity);
  const cdn = buildCdnWorkflowState({
    identity,
    manifest,
    uploadPlan: reports.uploadPlan,
    networkReport: reports.networkValidation,
    storageConfigured: cdnStorageConfigured()
  });
  const reportDirectory = existsSync(reports.directory) ? toRepoPath(reports.directory) : null;
  const lifecycle = buildOwner3dLifecycleState({
    identity,
    manifest,
    source: "manifest",
    manifestPath: toRepoPath(manifestPath),
    reportDirectory,
    visualReport: reports.visualReport,
    cdn
  });
  const status = resolvePipelineStatus({
    manifest,
    candidateReport: reports.candidateReport,
    hasSourceAnalysis: Boolean(reports.sourceAnalysis),
    requiresCdnValidation: cdn.requiresNetworkValidation,
    hasPassingCdnValidation: cdn.networkReportOk
  });
  const lastRun = latestDateLabel([
    manifest.publishedAt,
    manifest.approvedAt,
    manifest.generatedAt,
    objectValue(manifest.lifecycle)?.publishedAt,
    objectValue(manifest.lifecycle)?.finalizedAt,
    objectValue(manifest.lifecycle)?.generatedAt,
    reports.uploadPlan?.generatedAt,
    reports.networkValidation?.generatedAt,
    reports.optimizationReport?.generatedAt,
    reports.candidateReport?.generatedAt,
    reports.sourceAnalysis?.generatedAt
  ]);

  return {
    id: `${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}`,
    ...identity,
    restaurantName: maybeNameFromManifest(manifest, "restaurantName", identity.restaurantSlug),
    menuName: titleFromSlug(identity.menuSlug),
    dishName: maybeNameFromManifest(manifest, "dishName", identity.dishSlug),
    status: status.id,
    statusLabel: status.label,
    statusTone: status.tone,
    selectedCandidate: candidateLabel(reports.candidateReport, manifest),
    lastRun,
    nextAction: pipelineStatusNextAction(status.id),
    source: "manifest",
    manifestPath: toRepoPath(manifestPath),
    reportDirectory,
    detailHref: `/owner/3d-ar/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}`,
    versionHref: `/owner/3d-ar/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}`,
    reviewHref: `/owner/3d-ar/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}/review`,
    sections: sectionsForAsset({ identity, manifest, reports, cdn }),
    actions: buildActions(identity),
    cdn,
    lifecycle
  };
}

function assetFromReports(rootDir: string, identity: PipelineIdentity): Owner3dPipelineAsset {
  const reports = reportBundle(rootDir, identity);
  const cdn = buildCdnWorkflowState({
    identity,
    manifest: null,
    uploadPlan: reports.uploadPlan,
    networkReport: reports.networkValidation,
    storageConfigured: cdnStorageConfigured()
  });
  const reportDirectory = existsSync(reports.directory) ? toRepoPath(reports.directory) : null;
  const lifecycle = buildOwner3dLifecycleState({
    identity,
    manifest: null,
    source: "report",
    manifestPath: null,
    reportDirectory,
    visualReport: reports.visualReport,
    cdn
  });
  const status = resolvePipelineStatus({
    candidateReport: reports.candidateReport,
    hasSourceAnalysis: Boolean(reports.sourceAnalysis),
    hasRunningReport: Boolean(reports.optimizationReport && !reports.candidateReport),
    requiresCdnValidation: cdn.requiresNetworkValidation,
    hasPassingCdnValidation: cdn.networkReportOk
  });

  return {
    id: `${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}`,
    ...identity,
    restaurantName: titleFromSlug(identity.restaurantSlug),
    menuName: titleFromSlug(identity.menuSlug),
    dishName: titleFromSlug(identity.dishSlug),
    status: status.id,
    statusLabel: status.label,
    statusTone: status.tone,
    selectedCandidate: candidateLabel(reports.candidateReport, null),
    lastRun: latestDateLabel([
      reports.uploadPlan?.generatedAt,
      reports.networkValidation?.generatedAt,
      reports.optimizationReport?.generatedAt,
      reports.candidateReport?.generatedAt,
      reports.visualReport?.generatedAt,
      reports.sourceAnalysis?.generatedAt
    ]),
    nextAction: pipelineStatusNextAction(status.id),
    source: "report",
    manifestPath: null,
    reportDirectory,
    detailHref: `/owner/3d-ar/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}`,
    versionHref: `/owner/3d-ar/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}`,
    reviewHref: `/owner/3d-ar/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}/review`,
    sections: sectionsForAsset({ identity, manifest: null, reports, cdn }),
    actions: buildActions(identity),
    cdn,
    lifecycle
  };
}

function fallbackAssets(rootDir: string): Owner3dPipelineAsset[] {
  const restaurant = getRestaurant();
  const menuSlug = "demo";

  return getAllDishes()
    .filter(
      (dish) =>
        Boolean(dish.model3dUrl) ||
        Boolean(dish.webModel3dUrl) ||
        Boolean(dish.arModel3dUrl) ||
        Boolean(dish.usdzUrl) ||
        Boolean(dish.arUsdzUrl)
    )
    .map((dish) => {
      const identity: PipelineIdentity = {
        restaurantSlug: restaurant.slug,
        menuSlug,
        dishSlug: dish.slug,
        version: "demo-runtime"
      };
      const reports = reportBundle(rootDir, identity);
      const cdn = buildCdnWorkflowState({
        identity,
        manifest: null,
        uploadPlan: reports.uploadPlan,
        networkReport: reports.networkValidation,
        storageConfigured: cdnStorageConfigured()
      });
      const reportDirectory = existsSync(reports.directory) ? toRepoPath(reports.directory) : null;
      const lifecycle = buildOwner3dLifecycleState({
        identity,
        manifest: null,
        source: "demo-fallback",
        manifestPath: null,
        reportDirectory,
        visualReport: reports.visualReport,
        cdn
      });
      const runtimeModelCount = [
        dish.model3dUrl,
        dish.webModel3dUrl,
        dish.arModel3dUrl,
        dish.usdzUrl,
        dish.arUsdzUrl
      ].filter(Boolean).length;
      const status = resolvePipelineStatus({
        hasSourceAnalysis: Boolean(reports.sourceAnalysis)
      });
      const fallbackStatus = status.id === "source_uploaded" ? status : resolvePipelineStatus({});

      return {
        id: `${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}`,
        ...identity,
        restaurantName: restaurant.name,
        menuName: "Menu démo",
        dishName: dish.name,
        status: fallbackStatus.id,
        statusLabel: fallbackStatus.label,
        statusTone: fallbackStatus.tone,
        selectedCandidate: "Démo runtime hors pipeline",
        lastRun: "Aucun manifest pipeline",
        nextAction: "Créer une version pipeline depuis la source approuvée",
        source: "demo-fallback",
        manifestPath: null,
        reportDirectory,
        detailHref: `/owner/3d-ar/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}`,
        versionHref: `/owner/3d-ar/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}`,
        reviewHref: `/owner/3d-ar/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}/review`,
        sections: sectionsForAsset({
          identity,
          manifest: null,
          reports,
          cdn,
          fallback: { dishName: dish.name, runtimeModelCount }
        }),
        actions: buildActions(identity),
        cdn,
        lifecycle
      };
    });
}

function sortAssets(a: Owner3dPipelineAsset, b: Owner3dPipelineAsset): number {
  const rank: Record<PipelineStatusId, number> = {
    rejected: 0,
    needs_review: 1,
    source_uploaded: 2,
    running: 3,
    ready_to_finalize: 4,
    ready_to_publish: 5,
    published: 6
  };
  return (
    rank[a.status] - rank[b.status] ||
    a.restaurantName.localeCompare(b.restaurantName, "fr") ||
    a.dishName.localeCompare(b.dishName, "fr")
  );
}

function buildOverview(assets: Owner3dPipelineAsset[], source: Owner3dPipelineOverview["source"]): Owner3dPipelineOverview {
  return {
    cards: PIPELINE_OVERVIEW_CARDS.map((card) => ({
      ...card,
      value: assets.filter((asset) => asset.status === card.id).length
    })),
    assets,
    source,
    note:
      source === "manifests"
        ? "Données construites depuis les manifests production et les rapports 3D légers disponibles localement."
        : "Fallback démo : assets runtime détectés, mais aucun succès pipeline production n'est inventé sans manifest."
  };
}

function readOverview(): Owner3dPipelineOverview {
  const rootDir = /* turbopackIgnore: true */ process.cwd();
  const manifestsRoot = join(rootDir, "public", "models", "restaurants");
  const manifestAssets = scanManifestFiles(manifestsRoot)
    .map((manifestPath) => {
      const manifest = readJsonObject(manifestPath);
      return manifest ? assetFromManifest(rootDir, manifestPath, manifest) : null;
    })
    .filter((asset): asset is Owner3dPipelineAsset => Boolean(asset));

  const knownIds = new Set(manifestAssets.map((asset) => asset.id));
  const reportAssets = scanReportIdentities(rootDir)
    .filter((identity) => !knownIds.has(`${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}`))
    .map((identity) => assetFromReports(rootDir, identity));

  const assets = [...manifestAssets, ...reportAssets].sort(sortAssets);
  if (assets.length > 0) {
    if (shouldPreserveDemoFallbackAssets(assets)) {
      const fallback = fallbackAssets(rootDir)
        .filter((asset) => !knownIds.has(asset.id))
        .sort(sortAssets);
      return buildOverview([...assets, ...fallback].sort(sortAssets), "manifests");
    }

    return buildOverview(assets, "manifests");
  }

  return buildOverview(fallbackAssets(rootDir).sort(sortAssets), "fallback");
}

export const getOwner3dPipelineOverview = cache(readOverview);

export function filterOwner3dPipelineOverviewForOwner(
  overview: Owner3dPipelineOverview,
  owner: Owner3dAccessIdentity
): Owner3dPipelineOverview {
  const assets = filterOwner3dAccessibleItems(owner, overview.assets);
  return {
    ...overview,
    cards: overview.cards.map((card) => ({
      ...card,
      value: assets.filter((asset) => asset.status === card.id).length
    })),
    assets,
    note:
      assets.length > 0
        ? overview.note
        : `${overview.note} Acces 3D/AR restaurant non configure pour cet owner.`
  };
}

export function getOwner3dPipelineAsset(params: {
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
  version?: string;
}): Owner3dPipelineAsset | null {
  const overview = getOwner3dPipelineOverview();
  const matching = overview.assets.filter(
    (asset) =>
      asset.restaurantSlug === params.restaurantSlug &&
      asset.menuSlug === params.menuSlug &&
      asset.dishSlug === params.dishSlug
  );
  if (matching.length === 0) return null;
  if (params.version) {
    return matching.find((asset) => asset.version === params.version) ?? null;
  }
  return matching[0] ?? null;
}

export function getOwner3dPipelineVersions(params: {
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
}): Owner3dPipelineAsset[] {
  const overview = getOwner3dPipelineOverview();
  return overview.assets
    .filter(
      (asset) =>
        asset.restaurantSlug === params.restaurantSlug &&
        asset.menuSlug === params.menuSlug &&
        asset.dishSlug === params.dishSlug
    )
    .sort((a, b) => a.version.localeCompare(b.version, "fr"));
}

export function owner3dPipelineSourceLabel(source: Owner3dPipelineAsset["source"]): string {
  if (source === "manifest") return "Manifest production";
  if (source === "report") return "Rapports locaux";
  return "Fallback démo";
}
