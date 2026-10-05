export type PipelineJobStatus =
  | "queued"
  | "running"
  | "analyzing"
  | "optimizing"
  | "visual_comparing"
  | "needs_visual_review"
  | "needs_device_qa"
  | "needs_cdn_upload"
  | "needs_finalize"
  | "ready_to_publish"
  | "published"
  | "rejected"
  | "failed"
  | "rolled_back"
  | "cancelled";

export type PipelineJobStep =
  | "analyze"
  | "optimize"
  | "visual_compare"
  | "visual_review"
  | "device_qa"
  | "cdn"
  | "finalize"
  | "publish"
  | "rollback";

export type PipelineJobIdentity = {
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
  version: string;
};

export type PipelineJobArtifact = {
  id: string;
  type: string;
  label: string;
  path: string;
  sha256?: string | null;
};

export type PipelineStepRunStatus =
  | "queued"
  | "running"
  | "passed"
  | "warning"
  | "failed"
  | "skipped"
  | "cancelled";

export type PipelineQualityStatus =
  | "queued"
  | "running"
  | "passed"
  | "warning"
  | "failed"
  | "unvalidated"
  | "needs_visual_review"
  | "needs_device_qa"
  | "needs_cdn_upload"
  | "needs_finalize"
  | "ready_to_publish"
  | "published"
  | "rejected"
  | "rolled_back"
  | "cancelled";

export type PipelineStepLog = {
  id: string;
  step: PipelineJobStep;
  status: PipelineStepRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  logs: string[];
  error: string | null;
  artifactIds: string[];
};

export type PipelineJobObservabilityMetrics = {
  sourceSizeBytes: number | null;
  selectedCandidateSizeBytes: number | null;
  reductionPercent: number | null;
  visualStatus: "passed" | "failed" | "not_run" | "missing" | "warning";
  candidatesRejected: number;
  durationMs: number | null;
};

export type PipelineJobObservability = {
  qualityStatus: PipelineQualityStatus;
  metrics: PipelineJobObservabilityMetrics;
  errors: Array<{
    step: PipelineJobStep | null;
    message: string;
  }>;
  artifactRefs: PipelineJobArtifact[];
};

export type PipelineObservabilityDashboard = {
  metrics: {
    sourceSizeBytes: number | null;
    selectedCandidateSizeBytes: number | null;
    reductionPercent: number | null;
    visualPassRate: number;
    candidatesRejected: number;
    averageRunDurationMs: number | null;
    failedStepCounts: Partial<Record<PipelineJobStep, number>>;
    assetsNeedingReview: number;
    assetsReadyToPublish: number;
    deviceQaPending: number;
    cdnValidationPending: number;
    rollbackCount: number;
  };
  durationTimeline: Array<{
    jobId: string;
    label: string;
    status: PipelineJobStatus;
    durationMs: number | null;
  }>;
  failureReasons: Array<{
    jobId: string;
    step: PipelineJobStep;
    reason: string;
  }>;
  topBlockers: Array<{
    id: string;
    label: string;
    count: number;
  }>;
  aiRecommendations: Array<{
    id: string;
    priority: "high" | "medium" | "low";
    title: string;
    message: string;
    action: string;
    confidence: "derived";
  }>;
};

export type PipelineJobReport = {
  job: Omit<PipelineJob, "logs" | "stepLogs" | "artifacts" | "error" | "manualRunnerCommand"> & {
    logs: string[];
    stepLogs: PipelineStepLog[];
    artifacts: PipelineJobArtifact[];
    error: string | null;
    manualRunnerCommand: string;
  };
  generatedAt: string;
  summary: {
    durationMs: number | null;
    qualityStatus: PipelineQualityStatus;
    artifactCount: number;
    errorCount: number;
  };
};

export type PipelineJob = PipelineJobIdentity & {
  id: string;
  step: PipelineJobStep;
  status: PipelineJobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  stepLogs: PipelineStepLog[];
  artifacts: PipelineJobArtifact[];
  error: string | null;
  initiatedBy: string;
  nextAction: string;
  manualRunnerCommand: string;
  createdAt: string;
  updatedAt: string;
  observability: PipelineJobObservability;
};

export type PipelineJobQueue = {
  mode: "supabase" | "fallback";
  persisted: boolean;
  jobs: PipelineJob[];
  note: string;
};

export const PIPELINE_JOB_STATUSES: PipelineJobStatus[] = [
  "queued",
  "running",
  "analyzing",
  "optimizing",
  "visual_comparing",
  "needs_visual_review",
  "needs_device_qa",
  "needs_cdn_upload",
  "needs_finalize",
  "ready_to_publish",
  "published",
  "rejected",
  "failed",
  "rolled_back",
  "cancelled"
];

export const PIPELINE_JOB_STEPS: PipelineJobStep[] = [
  "analyze",
  "optimize",
  "visual_compare",
  "visual_review",
  "device_qa",
  "cdn",
  "finalize",
  "publish",
  "rollback"
];

const ALLOWED_TRANSITIONS: Record<PipelineJobStatus, PipelineJobStatus[]> = {
  queued: ["running", "cancelled", "failed"],
  running: ["analyzing", "optimizing", "visual_comparing", "failed", "cancelled"],
  analyzing: ["optimizing", "needs_visual_review", "failed"],
  optimizing: ["visual_comparing", "needs_visual_review", "failed"],
  visual_comparing: ["needs_visual_review", "rejected", "failed"],
  needs_visual_review: ["needs_device_qa", "rejected", "failed"],
  needs_device_qa: ["needs_cdn_upload", "failed"],
  needs_cdn_upload: ["needs_finalize", "failed"],
  needs_finalize: ["ready_to_publish", "failed"],
  ready_to_publish: ["published", "failed"],
  published: [],
  rejected: [],
  failed: ["queued"],
  rolled_back: [],
  cancelled: []
};

const STEP_LABELS: Record<PipelineJobStep, string> = {
  analyze: "Analyze source",
  optimize: "Optimize dish",
  visual_compare: "Visual compare",
  visual_review: "Visual review",
  device_qa: "Device QA",
  cdn: "Prepare CDN",
  finalize: "Finalize",
  publish: "Publish",
  rollback: "Rollback"
};

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bAuthorization:\s*Bearer\s+[^\s]+/gi, "Authorization: Bearer [redacted]"],
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/g, "Bearer [redacted]"],
  [/\b(Cookie|Set-Cookie):\s*[^\n\r]+/gi, "$1: [redacted]"],
  [/\b(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|BLOB_READ_WRITE_TOKEN|VERCEL_BLOB_TOKEN|CLERK_SECRET_KEY|OPENAI_API_KEY)=\S+/gi, "$1=[redacted]"],
  [/\b(password|pass|secret|token|signature|sig|key)=([^&\s]+)/gi, "$1=[redacted]"],
  [/\bsk_(live|test)_[A-Za-z0-9]+/g, "sk_$1_[redacted]"]
];

const IDENTITY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;

function isSafeSegment(value: string): boolean {
  return (
    value.length > 0 &&
    value === value.trim() &&
    value === value.toLowerCase() &&
    !value.includes("..") &&
    IDENTITY_PATTERN.test(value)
  );
}

function commandIdentity(identity: PipelineJobIdentity): string {
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

function sourcePath(identity: PipelineJobIdentity): string {
  return `assets/3d/source/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}/source.glb`;
}

function reportsPath(identity: PipelineJobIdentity): string {
  return `assets/3d/reports/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}`;
}

function workPath(identity: PipelineJobIdentity): string {
  return `assets/3d/work/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}`;
}

function manifestPath(identity: PipelineJobIdentity): string {
  return `public/models/restaurants/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}/manifest.json`;
}

function safeHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMetric(value: number | null, digits = 1): number | null {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function isPipelineStep(value: unknown): value is PipelineJobStep {
  return typeof value === "string" && PIPELINE_JOB_STEPS.includes(value as PipelineJobStep);
}

function isStepRunStatus(value: unknown): value is PipelineStepRunStatus {
  return (
    value === "queued" ||
    value === "running" ||
    value === "passed" ||
    value === "warning" ||
    value === "failed" ||
    value === "skipped" ||
    value === "cancelled"
  );
}

function isPipelineQualityStatus(value: unknown): value is PipelineQualityStatus {
  return (
    value === "queued" ||
    value === "running" ||
    value === "passed" ||
    value === "warning" ||
    value === "failed" ||
    value === "unvalidated" ||
    value === "needs_visual_review" ||
    value === "needs_device_qa" ||
    value === "needs_cdn_upload" ||
    value === "needs_finalize" ||
    value === "ready_to_publish" ||
    value === "published" ||
    value === "rejected" ||
    value === "rolled_back" ||
    value === "cancelled"
  );
}

function qualityStatusForJobStatus(status: PipelineJobStatus): PipelineQualityStatus {
  if (status === "queued") return "queued";
  if (status === "running" || status === "analyzing" || status === "optimizing" || status === "visual_comparing") {
    return "running";
  }
  return status;
}

function normalizeMetrics(value: Partial<PipelineJobObservabilityMetrics> | undefined): PipelineJobObservabilityMetrics {
  const sourceSizeBytes = finiteNumber(value?.sourceSizeBytes);
  const selectedCandidateSizeBytes = finiteNumber(value?.selectedCandidateSizeBytes);
  const reductionPercent =
    finiteNumber(value?.reductionPercent) ??
    (sourceSizeBytes && selectedCandidateSizeBytes
      ? roundMetric(((sourceSizeBytes - selectedCandidateSizeBytes) / sourceSizeBytes) * 100)
      : null);
  const visualStatus = value?.visualStatus;

  return {
    sourceSizeBytes,
    selectedCandidateSizeBytes,
    reductionPercent,
    visualStatus:
      visualStatus === "passed" ||
      visualStatus === "failed" ||
      visualStatus === "missing" ||
      visualStatus === "warning"
        ? visualStatus
        : "not_run",
    candidatesRejected: Math.max(0, Math.trunc(finiteNumber(value?.candidatesRejected) ?? 0)),
    durationMs: finiteNumber(value?.durationMs)
  };
}

function sanitizeArtifactRef(artifact: PipelineJobArtifact): PipelineJobArtifact | null {
  const path = String(artifact.path ?? "").trim().replaceAll("\\", "/").split(/[?#]/)[0];
  if (
    !path ||
    path.includes("..") ||
    !/^(assets\/3d\/|public\/models\/restaurants\/|https:\/\/)/.test(path)
  ) {
    return null;
  }
  return {
    id: sanitizePipelineLogLine(artifact.id).slice(0, 96),
    type: sanitizePipelineLogLine(artifact.type).slice(0, 96),
    label: sanitizePipelineLogLine(artifact.label).slice(0, 160),
    path,
    sha256:
      typeof artifact.sha256 === "string" && /^[a-f0-9]{64}$/i.test(artifact.sha256)
        ? artifact.sha256.toLowerCase()
        : null
  };
}

function sanitizeStepLog(value: PipelineStepLog): PipelineStepLog | null {
  if (!isPipelineStep(value.step) || !isStepRunStatus(value.status)) return null;
  return {
    id: sanitizePipelineLogLine(value.id).slice(0, 96) || `step_${safeHash(value.step)}`,
    step: value.step,
    status: value.status,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
    finishedAt: typeof value.finishedAt === "string" ? value.finishedAt : null,
    durationMs: finiteNumber(value.durationMs) ?? calculateJobDurationMs(value.startedAt, value.finishedAt),
    logs: (Array.isArray(value.logs) ? value.logs : [])
      .map(sanitizePipelineLogLine)
      .filter(Boolean)
      .slice(0, 50),
    error: value.error ? sanitizePipelineLogLine(value.error) : null,
    artifactIds: (Array.isArray(value.artifactIds) ? value.artifactIds : [])
      .map((id) => sanitizePipelineLogLine(id).slice(0, 96))
      .filter(Boolean)
      .slice(0, 50)
  };
}

function normalizeObservability(job: {
  step: PipelineJobStep;
  status: PipelineJobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  artifacts?: PipelineJobArtifact[];
  error?: string | null;
  observability?: Partial<PipelineJobObservability>;
}): PipelineJobObservability {
  const durationMs = calculateJobDurationMs(job.startedAt, job.finishedAt);
  const rawMetrics = normalizeMetrics(job.observability?.metrics);
  const metrics = {
    ...rawMetrics,
    durationMs: rawMetrics.durationMs ?? durationMs
  };
  const errors = [
    ...(job.observability?.errors ?? []),
    ...(job.error ? [{ step: job.step, message: job.error }] : [])
  ]
    .map((error) => ({
      step: isPipelineStep(error.step) ? error.step : null,
      message: sanitizePipelineLogLine(error.message)
    }))
    .filter((error) => error.message)
    .slice(0, 20);

  return {
    qualityStatus: isPipelineQualityStatus(job.observability?.qualityStatus)
      ? job.observability.qualityStatus
      : qualityStatusForJobStatus(job.status),
    metrics,
    errors,
    artifactRefs: (job.observability?.artifactRefs ?? job.artifacts ?? [])
      .map(sanitizeArtifactRef)
      .filter((artifact): artifact is PipelineJobArtifact => Boolean(artifact))
      .slice(0, 50)
  };
}

function stepRunStatusForJob(status: PipelineJobStatus): PipelineStepRunStatus {
  if (status === "queued") return "queued";
  if (status === "cancelled") return "cancelled";
  if (status === "failed" || status === "rejected") return "failed";
  if (status === "running" || status === "analyzing" || status === "optimizing" || status === "visual_comparing") {
    return "running";
  }
  if (status === "needs_visual_review" || status === "needs_device_qa" || status === "needs_cdn_upload" || status === "needs_finalize") {
    return "warning";
  }
  return "passed";
}

function stepLogForJob(job: PipelineJob): PipelineStepLog {
  return {
    id: `step_${safeHash(`${job.id}:${job.step}:1`)}`,
    step: job.step,
    status: stepRunStatusForJob(job.status),
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    durationMs: job.observability.metrics.durationMs,
    logs: job.logs.slice(0, 20),
    error: job.error,
    artifactIds: job.artifacts.map((artifact) => artifact.id).slice(0, 50)
  };
}

export function hydratePipelineJobObservability(
  job: Omit<PipelineJob, "stepLogs" | "observability"> & {
    stepLogs?: PipelineStepLog[];
    observability?: Partial<PipelineJobObservability>;
  }
): PipelineJob {
  const logs = job.logs.map(sanitizePipelineLogLine).filter(Boolean).slice(0, 300);
  const artifacts = job.artifacts
    .map(sanitizeArtifactRef)
    .filter((artifact): artifact is PipelineJobArtifact => Boolean(artifact));
  const error = job.error ? sanitizePipelineLogLine(job.error) : null;
  const observability = normalizeObservability({
    step: job.step,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    artifacts,
    error,
    observability: job.observability
  });
  const hydrated = {
    ...job,
    logs,
    artifacts,
    error,
    manualRunnerCommand: sanitizePipelineLogLine(job.manualRunnerCommand),
    observability,
    stepLogs: []
  };
  const stepLogs = (job.stepLogs ?? [])
    .map(sanitizeStepLog)
    .filter((entry): entry is PipelineStepLog => Boolean(entry));
  return {
    ...hydrated,
    stepLogs: stepLogs.length > 0 ? stepLogs : [stepLogForJob(hydrated)]
  };
}

export function calculateJobDurationMs(startedAt: string | null, finishedAt: string | null): number | null {
  if (!startedAt || !finishedAt) return null;
  const started = new Date(startedAt).getTime();
  const finished = new Date(finishedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) {
    return null;
  }
  return Math.round(finished - started);
}

export function sanitizePipelineLogLine(message: unknown): string {
  let line = String(message ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  for (const [pattern, replacement] of SECRET_PATTERNS) {
    line = line.replace(pattern, replacement);
  }

  line = line.replace(/(https:\/\/[^\s?#]+)[?#][^\s]+/gi, "$1");
  return line;
}

function formatDuration(durationMs: number | null): string {
  if (!Number.isFinite(durationMs)) return "not recorded";
  const seconds = Math.round(Number(durationMs) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function bytesLabel(value: number | null): string {
  if (!Number.isFinite(value)) return "not recorded";
  const mb = Number(value) / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MiB`;
}

function incrementCounter<T extends string>(map: Partial<Record<T, number>>, key: T): void {
  map[key] = (map[key] ?? 0) + 1;
}

function cleanDashId(value: string, fallback: string): string {
  const bounded = value.slice(0, 512).toLowerCase();
  let cleaned = "";
  let dashRun = true;

  for (let index = 0; index < bounded.length && cleaned.length < 80; index += 1) {
    const code = bounded.charCodeAt(index);
    const safe = (code >= 48 && code <= 57) || (code >= 97 && code <= 122);

    if (safe) {
      cleaned += bounded[index];
      dashRun = false;
    } else if (!dashRun) {
      cleaned += "-";
      dashRun = true;
    }
  }

  if (cleaned.endsWith("-")) cleaned = cleaned.slice(0, -1);
  return cleaned || fallback;
}

function cleanPathId(value: string): string {
  const bounded = value.slice(0, 512).toLowerCase();
  let cleaned = "";
  let replacingUnsafeRun = false;

  for (let index = 0; index < bounded.length && cleaned.length < 80; index += 1) {
    const code = bounded.charCodeAt(index);
    const safe =
      (code >= 48 && code <= 57) ||
      (code >= 97 && code <= 122) ||
      code === 45 ||
      code === 46 ||
      code === 95;

    if (safe) {
      cleaned += bounded[index];
      replacingUnsafeRun = false;
    } else if (!replacingUnsafeRun) {
      cleaned += "-";
      replacingUnsafeRun = true;
    }
  }

  let start = 0;
  while (start < cleaned.length && cleaned.charCodeAt(start) === 45) start += 1;

  let end = cleaned.length;
  while (end > start && cleaned.charCodeAt(end - 1) === 45) end -= 1;

  return cleaned.slice(start, end);
}

function blockerId(value: string): string {
  return cleanDashId(value, "pipeline-blocker");
}

let fallbackJobSequence = 0;

function jobNonce(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return randomUuid;
  fallbackJobSequence = (fallbackJobSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now()}:${fallbackJobSequence}:${Math.random()}`;
}

function jobIdSuffix(): string {
  const cleaned = cleanPathId(jobNonce());
  if (cleaned.length >= 16) return cleaned.slice(0, 64);
  return safeHash(`${cleaned}:${fallbackJobSequence}:${Date.now()}`);
}

function assertValidIdentity(identity: PipelineJobIdentity): void {
  for (const [key, value] of Object.entries(identity)) {
    if (!isSafeSegment(value)) {
      throw new Error(`Invalid pipeline job identity: ${key}`);
    }
  }
}

export function manualRunnerCommandForJob(
  step: PipelineJobStep,
  identity: PipelineJobIdentity
): string {
  assertValidIdentity(identity);
  const prefix = commandIdentity(identity);
  const source = sourcePath(identity);
  const reports = reportsPath(identity);
  const manifest = manifestPath(identity);

  if (step === "analyze") {
    return `npm run 3d:analyze-source -- ${prefix} --source ${source} --out ${reports}/source-analysis.json --markdown ${reports}/source-analysis.md`;
  }
  if (step === "optimize") {
    return `npm run 3d:optimize-dish -- ${prefix} --source ${source} --write --cdn-base-url <https://cdn.example.com/vistaire>`;
  }
  if (step === "visual_compare") {
    return `npm run 3d:visual-compare -- --source ${source} --candidate ${workPath(identity)}/mobile/${identity.dishSlug}-mobile.glb --variant mobile --out ${reports}/visual/mobile --threshold strict`;
  }
  if (step === "visual_review") {
    return `npm run 3d:approve-visual -- --manifest ${manifest} --approved-by "<owner>" --write`;
  }
  if (step === "device_qa") {
    return `npm run 3d:record-device-qa -- --manifest ${manifest} --device iphoneQuickLook --status passed --device-name "<device>" --os "<os>" --tested-by "<owner>" --tested-at "<iso-date>" --evidence ${reports}/device-qa/iphone.md --write`;
  }
  if (step === "cdn") {
    return `npm run 3d:prepare-cdn-upload -- --manifest ${manifest} --out ${reports}/upload-plan.json --write`;
  }
  if (step === "finalize") {
    return `npm run 3d:finalize-manifest -- --manifest ${manifest} --network-validation-report ${reports}/network-validation.json --write`;
  }
  if (step === "publish") {
    return `npm run 3d:publish -- --manifest ${manifest} --network-validation-report ${reports}/network-validation.json --quality-approved --approved-by "<owner>" --write`;
  }
  return `npm run 3d:rollback -- --restaurant ${identity.restaurantSlug} --menu ${identity.menuSlug} --dish ${identity.dishSlug} --to <previous-version> --approved-by "<owner>" --write`;
}

export function canTransitionJob(
  from: PipelineJobStatus,
  to: PipelineJobStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionJobStatus(
  from: PipelineJobStatus,
  to: PipelineJobStatus
): { ok: true; status: PipelineJobStatus } | { ok: false; error: string } {
  if (!canTransitionJob(from, to)) {
    return {
      ok: false,
      error: `Invalid pipeline job transition: ${from} -> ${to}`
    };
  }
  return { ok: true, status: to };
}

export function nextActionForJob(status: PipelineJobStatus, step: PipelineJobStep): string {
  if (status === "queued") return "Run manual runner command";
  if (status === "failed") return "Retry failed step";
  if (status === "needs_visual_review") return "Approve visual or reject candidate";
  if (status === "needs_device_qa") return "Record device QA";
  if (status === "needs_cdn_upload") return "Prepare CDN and validate headers";
  if (status === "needs_finalize") return "Finalize manifest";
  if (status === "ready_to_publish") return "Publish after final confirmation";
  if (status === "published") return "Monitor published version";
  if (status === "cancelled") return "Create a fresh job if needed";
  if (status === "rejected") return "Optimize a new candidate";
  if (status === "rolled_back") return "Review previous active version";
  return STEP_LABELS[step];
}

export function queuePolicyForStep(
  step: PipelineJobStep
): { ok: true } | { ok: false; error: string; status: 409 } {
  if (step === "publish" || step === "rollback") {
    return {
      ok: false,
      status: 409,
      error:
        "Publish and rollback jobs require persisted readiness checks and are visible as manual actions only in this version."
    };
  }

  return { ok: true };
}

export function createPipelineJobDraft(args: {
  identity: PipelineJobIdentity;
  step: PipelineJobStep;
  initiatedBy: string;
  now?: string;
}): PipelineJob {
  assertValidIdentity(args.identity);
  const now = args.now ?? new Date().toISOString();
  const id = `job_${jobIdSuffix()}`;
  const manualRunnerCommand = manualRunnerCommandForJob(args.step, args.identity);

  return hydratePipelineJobObservability({
    id,
    ...args.identity,
    step: args.step,
    status: "queued",
    startedAt: null,
    finishedAt: null,
    logs: [
      "Job queued only. Vistaire does not run long 3D/AR pipeline commands inside a request."
    ],
    artifacts: [],
    error: null,
    initiatedBy: args.initiatedBy,
    nextAction: nextActionForJob("queued", args.step),
    manualRunnerCommand,
    createdAt: now,
    updatedAt: now
  });
}

export function buildFallbackPipelineJobs(
  identities: PipelineJobIdentity[],
  initiatedBy: string
): PipelineJobQueue {
  return {
    mode: "fallback",
    persisted: false,
    note: "Fallback dev queue: Supabase job tables are not configured, so jobs are not persisted.",
    jobs: identities.slice(0, 6).map((identity, index) =>
      createPipelineJobDraft({
        identity,
        step: index === 0 ? "analyze" : "visual_compare",
        initiatedBy,
        now: new Date(Date.UTC(2026, 4, 31, 12, index, 0)).toISOString()
      })
    )
  };
}

export function buildPipelineObservabilityDashboard(
  jobs: PipelineJob[]
): PipelineObservabilityDashboard {
  const hydratedJobs = jobs.map((job) => hydratePipelineJobObservability(job));
  const sourceSizeBytes = hydratedJobs.reduce((sum, job) => {
    const value = job.observability.metrics.sourceSizeBytes;
    return Number.isFinite(value) ? sum + Number(value) : sum;
  }, 0);
  const selectedCandidateSizeBytes = hydratedJobs.reduce((sum, job) => {
    const value = job.observability.metrics.selectedCandidateSizeBytes;
    return Number.isFinite(value) ? sum + Number(value) : sum;
  }, 0);
  const visualRuns = hydratedJobs.filter((job) =>
    job.observability.metrics.visualStatus === "passed" ||
    job.observability.metrics.visualStatus === "failed"
  );
  const durationRuns = hydratedJobs
    .map((job) => job.observability.metrics.durationMs)
    .filter((value): value is number => Number.isFinite(value));
  const failedStepCounts: Partial<Record<PipelineJobStep, number>> = {};
  const failureReasons: PipelineObservabilityDashboard["failureReasons"] = [];
  const blockerCounts = new Map<string, { label: string; count: number }>();

  function addBlocker(label: string): void {
    const id = blockerId(label);
    const current = blockerCounts.get(id);
    blockerCounts.set(id, { label, count: (current?.count ?? 0) + 1 });
  }

  for (const job of hydratedJobs) {
    if (job.status === "failed") incrementCounter(failedStepCounts, job.step);
    for (const error of job.observability.errors) {
      const reason = error.message || "Pipeline error";
      failureReasons.push({
        jobId: job.id,
        step: error.step ?? job.step,
        reason
      });
      addBlocker(reason);
    }
    if (job.status === "needs_visual_review") addBlocker("Visual review pending");
    if (job.status === "needs_device_qa") addBlocker("Device QA pending evidence");
    if (job.status === "needs_cdn_upload") addBlocker("CDN validation pending");
    if (job.status === "needs_finalize") addBlocker("Finalize runner command pending");
    if (job.status === "failed") addBlocker(`${STEP_LABELS[job.step]} failed`);
  }

  const topBlockers = [...blockerCounts.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 6);
  const averageRunDurationMs =
    durationRuns.length > 0
      ? Math.round(durationRuns.reduce((sum, value) => sum + value, 0) / durationRuns.length)
      : null;
  const recommendations: PipelineObservabilityDashboard["aiRecommendations"] = [];

  if (hydratedJobs.some((job) => job.status === "needs_device_qa")) {
    recommendations.push({
      id: "device-qa-evidence",
      priority: "high",
      title: "Device QA evidence required",
      message: "Device QA evidence must include iPhone Quick Look and Android Scene Viewer proof before publish remains available.",
      action: "Open Device QA and attach real-device evidence.",
      confidence: "derived"
    });
  }
  if (hydratedJobs.some((job) => job.status === "needs_cdn_upload")) {
    recommendations.push({
      id: "cdn-validation",
      priority: "high",
      title: "CDN validation pending",
      message: "Validate bytes, SHA-256, MIME, cache headers, inline USDZ, and CORS before finalization.",
      action: "Run the CDN validation command from the external runner.",
      confidence: "derived"
    });
  }
  if (hydratedJobs.some((job) => job.status === "failed")) {
    recommendations.push({
      id: "failed-step-review",
      priority: "high",
      title: "Failed pipeline step",
      message: "Inspect the sanitized logs and rerun only the failed step after fixing the blocker.",
      action: "Open the logs drawer and copy the runner command.",
      confidence: "derived"
    });
  }
  if (hydratedJobs.some((job) => job.status === "queued")) {
    recommendations.push({
      id: "manual-runner-required",
      priority: "medium",
      title: "Runner externe requis",
      message: "Queued jobs need an external runner; Vistaire does not run long 3D/AR commands inside owner requests.",
      action: "Copy the command into the external runner.",
      confidence: "derived"
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: "monitoring",
      priority: "low",
      title: "Pipeline monitoring",
      message: "No critical blocker is visible in the current job queue.",
      action: "Keep monitoring logs and artifact refs after each runner update.",
      confidence: "derived"
    });
  }

  return {
    metrics: {
      sourceSizeBytes: sourceSizeBytes > 0 ? sourceSizeBytes : null,
      selectedCandidateSizeBytes: selectedCandidateSizeBytes > 0 ? selectedCandidateSizeBytes : null,
      reductionPercent:
        sourceSizeBytes > 0 && selectedCandidateSizeBytes > 0
          ? roundMetric(((sourceSizeBytes - selectedCandidateSizeBytes) / sourceSizeBytes) * 100)
          : null,
      visualPassRate:
        visualRuns.length > 0
          ? roundMetric(
              (visualRuns.filter((job) => job.observability.metrics.visualStatus === "passed").length /
                visualRuns.length) *
                100
            ) ?? 0
          : 0,
      candidatesRejected: hydratedJobs.reduce(
        (sum, job) => sum + job.observability.metrics.candidatesRejected,
        0
      ),
      averageRunDurationMs,
      failedStepCounts,
      assetsNeedingReview: hydratedJobs.filter((job) => job.status === "needs_visual_review").length,
      assetsReadyToPublish: hydratedJobs.filter((job) => job.status === "ready_to_publish").length,
      deviceQaPending: hydratedJobs.filter((job) => job.status === "needs_device_qa").length,
      cdnValidationPending: hydratedJobs.filter((job) => job.status === "needs_cdn_upload").length,
      rollbackCount: hydratedJobs.filter((job) => job.status === "rolled_back").length
    },
    durationTimeline: hydratedJobs.slice(0, 12).map((job) => ({
      jobId: job.id,
      label: `${job.restaurantSlug}/${job.dishSlug}/${job.step}`,
      status: job.status,
      durationMs: job.observability.metrics.durationMs
    })),
    failureReasons: failureReasons.slice(0, 8),
    topBlockers,
    aiRecommendations: recommendations.slice(0, 5)
  };
}

export function buildPipelineJobReport(job: PipelineJob): PipelineJobReport {
  const hydrated = hydratePipelineJobObservability(job);
  return {
    job: hydrated,
    generatedAt: new Date().toISOString(),
    summary: {
      durationMs: hydrated.observability.metrics.durationMs,
      qualityStatus: hydrated.observability.qualityStatus,
      artifactCount: hydrated.observability.artifactRefs.length,
      errorCount: hydrated.observability.errors.length
    }
  };
}

export function renderPipelineJobMarkdownReport(report: PipelineJobReport): string {
  const { job } = report;
  const metrics = job.observability.metrics;
  const lines = [
    "# Vistaire 3D/AR Pipeline Job Report",
    "",
    `Generated at: \`${report.generatedAt}\``,
    `Job: \`${job.id}\``,
    `Identity: \`${job.restaurantSlug}/${job.menuSlug}/${job.dishSlug}/${job.version}\``,
    `Step: \`${job.step}\``,
    `Status: \`${job.status}\``,
    `Quality status: \`${job.observability.qualityStatus}\``,
    `Duration: ${formatDuration(metrics.durationMs)}`,
    "",
    "## Metrics",
    "",
    `- Source size: ${bytesLabel(metrics.sourceSizeBytes)}`,
    `- Selected candidate size: ${bytesLabel(metrics.selectedCandidateSizeBytes)}`,
    `- Reduction: ${Number.isFinite(metrics.reductionPercent) ? `${metrics.reductionPercent}%` : "not recorded"}`,
    `- Visual status: \`${metrics.visualStatus}\``,
    `- Candidates rejected: ${metrics.candidatesRejected}`,
    "",
    "## Errors",
    "",
    ...(job.observability.errors.length > 0
      ? job.observability.errors.map((error) => `- ${error.step ?? job.step}: ${error.message}`)
      : ["- None recorded."]),
    "",
    "## Logs",
    "",
    "```text",
    ...(job.logs.length > 0 ? job.logs : ["No logs recorded."]),
    "```",
    "",
    "## Artifact refs",
    "",
    ...(job.observability.artifactRefs.length > 0
      ? job.observability.artifactRefs.map((artifact) => `- ${artifact.label}: \`${artifact.path}\``)
      : ["- None recorded."]),
    "",
    "## Copy command",
    "",
    "```powershell",
    job.manualRunnerCommand,
    "```",
    ""
  ];
  return `${lines.join("\n")}\n`;
}
