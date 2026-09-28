#!/usr/bin/env node
import { storageBucket } from "../../lib/storage/backend.ts";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  parseAllowedRestaurantSlugs,
  resolveSourceUploadToLocalSource,
  safeLocalSourcePath
} from "./shared/source-upload-resolver.mjs";

const JOBS_TABLE = "owner_3d_pipeline_jobs";
const ARTIFACTS_TABLE = "owner_3d_pipeline_artifacts";
const DEFAULT_LEASE_SECONDS = 900;
const DEFAULT_POLL_INTERVAL_MS = 15_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 45 * 60 * 1000;
const DEFAULT_ARTIFACT_MAX_BYTES = 20 * 1024 * 1024;
const JOB_ID_PATTERN = /^job_[a-z0-9._-]{8,80}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;

const SECRET_PATTERNS = [
  [/\bAuthorization:\s*Bearer\s+[^\s"']+/gi, "Authorization: Bearer [redacted]"],
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/g, "Bearer [redacted]"],
  [/\b(Cookie|Set-Cookie):\s*[^\n\r]+/gi, "$1: [redacted]"],
  [/\b(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|BLOB_READ_WRITE_TOKEN|VERCEL_BLOB_TOKEN|CLERK_SECRET_KEY|OPENAI_API_KEY)=\S+/gi, "$1=[redacted]"],
  [/\b(password|pass|secret|token|signature|sig|key|apikey|api_key)=([^&\s]+)/gi, "$1=[redacted]"],
  [/\b(eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,})\b/g, "[redacted-jwt]"]
];

function isMainModule() {
  return process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

function parseInteger(value, key) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`--${key} must be an integer`);
  return parsed;
}

function cleanWorkerId(value) {
  const raw = String(value || `vistaire-runner-${randomUUID().slice(0, 8)}`).trim();
  const clean = raw.replace(/[^a-zA-Z0-9._:-]+/g, "-").slice(0, 120);
  if (clean.length < 3) throw new Error("Runner worker id is invalid");
  return clean;
}

function cleanCdnBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:") throw new Error("--cdn-base-url must use HTTPS");
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("--cdn-base-url must not include credentials, query, or hash");
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

export function sanitizeRunnerLogLine(message) {
  let line = String(message ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
  for (const [pattern, replacement] of SECRET_PATTERNS) line = line.replace(pattern, replacement);
  return line.replace(/(https:\/\/[^\s?#"']+)[?#][^\s"']+/gi, "$1");
}

export function parseRunnerArgs(argv = process.argv.slice(2)) {
  const args = {
    once: false,
    dryRun: false,
    json: false,
    uploadArtifacts: true,
    rootDir: process.cwd(),
    leaseSeconds: DEFAULT_LEASE_SECONDS,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    commandTimeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
    maxJobs: null,
    step: null,
    jobId: null,
    sourceUploadId: null,
    workerId: null,
    cdnBaseUrl: null,
    runnerLabel: null,
    help: false,
    allowedRestaurantSlugs: undefined
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (value !== true) index += 1;
    if (key === "once") args.once = true;
    else if (key === "dry-run") args.dryRun = true;
    else if (key === "json") args.json = true;
    else if (key === "no-upload-artifacts") args.uploadArtifacts = false;
    else if (key === "root") args.rootDir = String(value);
    else if (key === "lease-seconds") args.leaseSeconds = parseInteger(value, key);
    else if (key === "poll-interval-ms") args.pollIntervalMs = parseInteger(value, key);
    else if (key === "command-timeout-ms") args.commandTimeoutMs = parseInteger(value, key);
    else if (key === "max-jobs") args.maxJobs = parseInteger(value, key);
    else if (key === "step") args.step = String(value);
    else if (key === "job-id") {
      args.jobId = String(value);
      args.once = true;
    } else if (key === "source-upload-id") args.sourceUploadId = String(value);
    else if (key === "worker-id") args.workerId = String(value);
    else if (key === "cdn-base-url") args.cdnBaseUrl = String(value);
    else if (key === "runner-label") args.runnerLabel = String(value);
    else if (key === "help") args.help = true;
    else throw new Error(`Unknown runner option: --${key}`);
  }

  if (args.leaseSeconds < 60 || args.leaseSeconds > 7200) throw new Error("--lease-seconds must be between 60 and 7200");
  if (args.pollIntervalMs < 1000 || args.pollIntervalMs > 300_000) throw new Error("--poll-interval-ms must be between 1000 and 300000");
  if (args.maxJobs !== null && (args.maxJobs < 1 || args.maxJobs > 100)) throw new Error("--max-jobs must be between 1 and 100");
  if (args.jobId && !JOB_ID_PATTERN.test(args.jobId)) throw new Error("--job-id is invalid");
  if (args.sourceUploadId && !UUID_PATTERN.test(args.sourceUploadId)) throw new Error("--source-upload-id is invalid");
  if (args.step && !["analyze", "optimize", "visual_compare", "cdn", "finalize"].includes(args.step)) {
    throw new Error("--step is not automated by this runner");
  }
  args.rootDir = normalize(resolve(args.rootDir));
  args.workerId = cleanWorkerId(args.workerId ?? process.env.VISTAIRE_3D_RUNNER_ID ?? "");
  args.cdnBaseUrl = cleanCdnBaseUrl(args.cdnBaseUrl ?? process.env.VISTAIRE_3D_CDN_BASE_URL ?? "");
  args.runnerLabel = sanitizeRunnerLogLine(args.runnerLabel ?? process.env.VISTAIRE_3D_RUNNER_LABEL ?? args.workerId).slice(0, 120);
  const restaurantScope = process.env.VISTAIRE_3D_RUNNER_RESTAURANT_SLUGS ?? process.env.VISTAIRE_OWNER_3D_RESTAURANT_SLUGS;
  if (restaurantScope?.trim()) args.allowedRestaurantSlugs = parseAllowedRestaurantSlugs(restaurantScope);
  return args;
}

function isSafeSegment(value) {
  return typeof value === "string" && value === value.trim() && SAFE_SEGMENT_PATTERN.test(value) && !value.includes("..");
}

function identityFromJob(job) {
  const identity = {
    restaurantSlug: String(job.restaurant_slug ?? job.restaurantSlug ?? ""),
    menuSlug: String(job.menu_slug ?? job.menuSlug ?? ""),
    dishSlug: String(job.dish_slug ?? job.dishSlug ?? ""),
    version: String(job.asset_version ?? job.version ?? "")
  };
  for (const [key, value] of Object.entries(identity)) {
    if (!isSafeSegment(value)) throw new Error(`Invalid runner identity: ${key}`);
  }
  return identity;
}

function safeJoin(rootDir, ...segments) {
  const root = normalize(resolve(rootDir));
  const fullPath = normalize(resolve(rootDir, ...segments));
  if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) throw new Error(`Refusing path outside ${root}`);
  return fullPath;
}

function toRelativePath(rootDir, filePath) {
  const relativePath = relative(rootDir, filePath).replaceAll("\\", "/");
  if (!relativePath || relativePath.startsWith("..") || relativePath.includes("../") || /^[a-z]:/i.test(relativePath)) {
    throw new Error(`Path is outside runner root: ${filePath}`);
  }
  return relativePath;
}

export { safeLocalSourcePath };

function reportsDir(rootDir, identity) {
  return safeJoin(rootDir, "assets", "3d", "reports", identity.restaurantSlug, identity.menuSlug, identity.dishSlug, identity.version);
}

function workDir(rootDir, identity) {
  return safeJoin(rootDir, "assets", "3d", "work", identity.restaurantSlug, identity.menuSlug, identity.dishSlug, identity.version);
}

function manifestPath(rootDir, identity) {
  return safeJoin(rootDir, "public", "models", "restaurants", identity.restaurantSlug, identity.menuSlug, identity.dishSlug, identity.version, "manifest.json");
}

function scriptPath(rootDir, fileName) {
  return safeJoin(rootDir, "scripts", "3d", fileName);
}

function displayNpmCommand(scriptName, args) {
  return ["npm", "run", scriptName, "--", ...args];
}

export function buildStepPlan({ job, rootDir, sourcePath, cdnBaseUrl, runnerLabel }) {
  const identity = identityFromJob(job);
  const reports = reportsDir(rootDir, identity);
  const manifest = manifestPath(rootDir, identity);
  const relReports = toRelativePath(rootDir, reports);
  const relManifest = toRelativePath(rootDir, manifest);
  const source = normalize(resolve(rootDir, sourcePath));
  const relSource = toRelativePath(rootDir, source);
  const step = String(job.step ?? "");

  if (step === "analyze") {
    const args = ["--source", relSource, "--out", `${relReports}/source-analysis.json`, "--markdown", `${relReports}/source-analysis.md`];
    return {
      step,
      phaseStatus: "analyzing",
      successStatus: "needs_visual_review",
      successQualityStatus: "passed",
      failureStatus: "failed",
      failureQualityStatus: "failed",
      nextAction: "Review source analysis and queue optimization.",
      command: displayNpmCommand("3d:analyze-source", args),
      spawnFile: process.execPath,
      spawnArgs: [scriptPath(rootDir, "analyze-source.mjs"), ...args],
      expectedArtifacts: [`${relReports}/source-analysis.json`, `${relReports}/source-analysis.md`],
      artifactRoots: []
    };
  }

  if (step === "optimize") {
    if (!cdnBaseUrl) throw new Error("Optimize jobs require VISTAIRE_3D_CDN_BASE_URL or --cdn-base-url.");
    const args = [
      "--restaurant", identity.restaurantSlug,
      "--menu", identity.menuSlug,
      "--dish", identity.dishSlug,
      "--version", identity.version,
      "--source", relSource,
      "--write",
      "--cdn-base-url", cdnBaseUrl,
      "--run-visual-compare",
      "--visual-threshold", "strict",
      "--approved-by", runnerLabel || "Vistaire external runner"
    ];
    return {
      step,
      phaseStatus: "optimizing",
      successStatus: "needs_visual_review",
      successQualityStatus: "needs_visual_review",
      failureStatus: "failed",
      failureQualityStatus: "failed",
      nextAction: "Review strict visual artifacts before device QA.",
      command: displayNpmCommand("3d:optimize-heavy", args),
      spawnFile: process.execPath,
      spawnArgs: [scriptPath(rootDir, "optimize-heavy.mjs"), ...args],
      expectedArtifacts: [
        `${relReports}/repair-report.json`,
        `${relReports}/source-analysis.json`,
        `${relReports}/source-analysis.md`,
        `${relReports}/optimization-report.json`,
        `${relReports}/candidate-report.json`,
        `${relReports}/candidate-report.md`,
        `${relReports}/visual-quality.json`,
        relManifest
      ],
      artifactRoots: [relReports]
    };
  }

  if (step === "visual_compare") {
    const out = `${relReports}/visual/mobile`;
    const relCandidate = toRelativePath(rootDir, safeJoin(workDir(rootDir, identity), "mobile", `${identity.dishSlug}-mobile.glb`));
    const args = ["--source", relSource, "--candidate", relCandidate, "--variant", "mobile", "--out", out, "--root", ".", "--threshold", "strict", "--json"];
    return {
      step,
      phaseStatus: "visual_comparing",
      successStatus: "needs_visual_review",
      successQualityStatus: "needs_visual_review",
      failureStatus: "failed",
      failureQualityStatus: "failed",
      nextAction: "Review rendered visual evidence.",
      command: displayNpmCommand("3d:visual-compare", args),
      spawnFile: process.execPath,
      spawnArgs: [scriptPath(rootDir, "visual-compare.mjs"), ...args],
      expectedArtifacts: [`${out}/visual-report.json`, `${out}/visual-report.md`],
      artifactRoots: [out]
    };
  }

  if (step === "cdn") {
    const uploadPlan = `${relReports}/upload-plan.json`;
    const args = ["--manifest", relManifest, "--out", uploadPlan, "--write"];
    return {
      step,
      phaseStatus: "running",
      successStatus: "needs_finalize",
      successQualityStatus: "needs_finalize",
      failureStatus: "failed",
      failureQualityStatus: "failed",
      nextAction: "Upload CDN files and run strict network validation.",
      command: displayNpmCommand("3d:prepare-cdn-upload", args),
      spawnFile: process.execPath,
      spawnArgs: [scriptPath(rootDir, "prepare-cdn-upload.mjs"), ...args],
      expectedArtifacts: [uploadPlan],
      artifactRoots: []
    };
  }

  if (step === "finalize") {
    const networkReport = `${relReports}/network-validation.json`;
    const args = ["--manifest", relManifest, "--network-validation-report", networkReport, "--write"];
    return {
      step,
      phaseStatus: "running",
      successStatus: "ready_to_publish",
      successQualityStatus: "ready_to_publish",
      failureStatus: "failed",
      failureQualityStatus: "failed",
      nextAction: "Publish after final owner confirmation.",
      command: displayNpmCommand("3d:finalize-manifest", args),
      spawnFile: process.execPath,
      spawnArgs: [scriptPath(rootDir, "finalize-manifest.mjs"), ...args],
      expectedArtifacts: [relManifest, networkReport],
      artifactRoots: []
    };
  }

  throw new Error(`Pipeline step ${step || "<missing>"} is not automated by this runner.`);
}

export function buildStorageArtifactPath({ jobId, relativePath }) {
  if (!JOB_ID_PATTERN.test(String(jobId))) throw new Error("Invalid job id");
  const clean = String(relativePath ?? "").replaceAll("\\", "/").split(/[?#]/)[0];
  if (!clean || clean.startsWith("/") || /^[a-z]:/i.test(clean) || clean.includes("..") || clean.includes("//")) {
    throw new Error("Unsafe artifact path");
  }
  if (!/^(assets\/3d\/reports\/|public\/models\/restaurants\/)/.test(clean)) throw new Error("Unsafe artifact path");
  return ["pipeline-artifacts", jobId, clean].join("/");
}

function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

export function collectArtifactFiles({ rootDir, expectedArtifacts = [], artifactRoots = [] }) {
  const candidates = new Set(expectedArtifacts.map(String));
  for (const root of artifactRoots) {
    const fullRoot = safeJoin(rootDir, root);
    if (!existsSync(fullRoot)) continue;
    for (const filePath of walkFiles(fullRoot)) candidates.add(toRelativePath(rootDir, filePath));
  }
  const files = [];
  for (const relativePath of candidates) {
    const normalized = relativePath.replaceAll("\\", "/");
    if (!/^(assets\/3d\/reports\/|public\/models\/restaurants\/)/.test(normalized) || normalized.includes("..")) continue;
    const fullPath = safeJoin(rootDir, normalized);
    if (!existsSync(fullPath) || lstatSync(fullPath).isSymbolicLink()) continue;
    const stat = statSync(fullPath);
    if (stat.isFile()) files.push({ fullPath, relativePath: normalized, bytes: stat.size });
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function createSupabaseAdmin(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase runner credentials are missing.");
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "vistaire-owner-3d-runner" } }
  });
}

function normalizeRpcRow(data) {
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function artifactType(relativePath) {
  if (relativePath.endsWith("source-analysis.json") || relativePath.endsWith("source-analysis.md")) return "source_analysis";
  if (relativePath.endsWith("optimization-report.json")) return "optimization_report";
  if (relativePath.endsWith("candidate-report.json") || relativePath.endsWith("candidate-report.md")) return "candidate_report";
  if (relativePath.includes("/visual/") || relativePath.endsWith("visual-quality.json")) return "visual_report";
  if (relativePath.endsWith("upload-plan.json")) return "upload_plan";
  if (relativePath.endsWith("network-validation.json")) return "network_validation";
  if (relativePath.endsWith("manifest.json")) return "manifest";
  return "visual_report";
}

function artifactVariant(relativePath) {
  if (relativePath.includes("/web/")) return "web";
  if (relativePath.includes("/mobile/")) return "mobile";
  if (relativePath.includes("/ar-lite/")) return "ar_lite";
  if (relativePath.includes("/ios/")) return "ios_usdz";
  if (relativePath.includes("/poster/")) return "poster";
  return "report";
}

function mimeTypeFor(relativePath) {
  const ext = extname(relativePath).toLowerCase();
  if (ext === ".json") return "application/json";
  if (ext === ".md") return "text/markdown; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".glb") return "model/gltf-binary";
  if (ext === ".usdz") return "model/vnd.usdz+zip";
  return "application/octet-stream";
}

async function claimJob(client, args) {
  const { data, error } = await client.rpc("owner_3d_claim_pipeline_job", {
    p_worker_id: args.workerId,
    p_lease_seconds: args.leaseSeconds,
    p_step: args.step,
    p_job_id: args.jobId
  });
  if (error) throw new Error(`Claim failed: ${error.message}`);
  return normalizeRpcRow(data);
}

async function heartbeatJob(client, { job, args, log = null }) {
  const { data, error } = await client.rpc("owner_3d_heartbeat_pipeline_job", {
    p_job_id: job.id,
    p_worker_id: args.workerId,
    p_lock_token: job.lock_token,
    p_lease_seconds: args.leaseSeconds,
    p_log: log ? sanitizeRunnerLogLine(log) : null
  });
  if (error) throw new Error(`Heartbeat failed: ${error.message}`);
  const updated = normalizeRpcRow(data);
  if (!updated) throw new Error("Runner lock was lost before heartbeat.");
  return updated;
}

async function updateProgress(client, { job, args, status, logs = [], metrics = {}, nextAction = null }) {
  const { data, error } = await client.rpc("owner_3d_update_pipeline_job_progress", {
    p_job_id: job.id,
    p_worker_id: args.workerId,
    p_lock_token: job.lock_token,
    p_status: status,
    p_quality_status: "running",
    p_logs: logs.map(sanitizeRunnerLogLine).slice(-80),
    p_metrics: metrics,
    p_next_action: nextAction
  });
  if (error) throw new Error(`Progress update failed: ${error.message}`);
  return normalizeRpcRow(data);
}

async function completeJob(client, { job, args, status, qualityStatus, logs, artifacts, metrics, errorMessage, nextAction }) {
  const { data, error } = await client.rpc("owner_3d_complete_pipeline_job", {
    p_job_id: job.id,
    p_worker_id: args.workerId,
    p_lock_token: job.lock_token,
    p_status: status,
    p_quality_status: qualityStatus,
    p_logs: logs.map(sanitizeRunnerLogLine).slice(-300),
    p_step_logs: [],
    p_artifacts: artifacts,
    p_metrics: metrics,
    p_error_message: errorMessage ? sanitizeRunnerLogLine(errorMessage) : null,
    p_next_action: nextAction
  });
  if (error) throw new Error(`Complete failed: ${error.message}`);
  return normalizeRpcRow(data);
}

async function runCommandPlan(plan, { rootDir, timeoutMs, heartbeat }) {
  return await new Promise((resolvePromise) => {
    const start = Date.now();
    let stdout = "";
    let stderr = "";
    let timeoutHit = false;
    const child = spawn(plan.spawnFile, plan.spawnArgs, { cwd: rootDir, windowsHide: true });
    const heartbeatTimer = setInterval(() => void heartbeat(), Math.max(30_000, Math.floor(timeoutMs / 10)));
    const timer = setTimeout(() => {
      timeoutHit = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8").slice(-512 * 1024); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8").slice(-512 * 1024); });
    child.on("error", (error) => {
      clearTimeout(timer);
      clearInterval(heartbeatTimer);
      resolvePromise({ ok: false, exitCode: null, durationMs: Date.now() - start, stdout, stderr: `${stderr}\n${error.message}`, timeout: timeoutHit });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      clearInterval(heartbeatTimer);
      let output = null;
      const raw = stdout.trim();
      const startJson = raw.indexOf("{");
      const endJson = raw.lastIndexOf("}");
      if (startJson >= 0 && endJson > startJson) {
        try { output = JSON.parse(raw.slice(startJson, endJson + 1)); } catch {}
      }
      resolvePromise({ ok: code === 0 && output?.ok !== false && output?.status !== "failed", exitCode: code, durationMs: Date.now() - start, output, stdout, stderr, timeout: timeoutHit });
    });
  });
}

async function uploadArtifacts(client, { job, files, args }) {
  const bucket = String(process.env.VISTAIRE_3D_RUNNER_ARTIFACT_BUCKET || process.env.VISTAIRE_3D_SOURCE_BUCKET || "").trim();
  const maxBytes = Number(process.env.VISTAIRE_3D_RUNNER_ARTIFACT_MAX_BYTES ?? DEFAULT_ARTIFACT_MAX_BYTES);
  const refs = [];
  for (const file of files) {
    const bytes = readFileSync(file.fullPath);
    const digest = sha256(bytes);
    const ref = {
      id: `artifact_${digest.slice(0, 16)}`,
      type: artifactType(file.relativePath),
      label: basename(file.relativePath),
      path: file.relativePath,
      sha256: digest
    };
    refs.push(ref);
    if (!args.uploadArtifacts || bytes.length > maxBytes) continue;
    if (!bucket) throw new Error("VISTAIRE_3D_RUNNER_ARTIFACT_BUCKET or VISTAIRE_3D_SOURCE_BUCKET is required.");
    const storagePath = buildStorageArtifactPath({ jobId: job.id, relativePath: file.relativePath });
    const upload = await storageBucket(client.storage, bucket).upload(storagePath, bytes, {
      cacheControl: "0",
      contentType: mimeTypeFor(file.relativePath),
      upsert: true
    });
    if (upload.error) throw new Error(`Artifact upload failed: ${upload.error.message}`);
    const inserted = await client.from(ARTIFACTS_TABLE).insert({
      job_id: job.id,
      artifact_type: ref.type,
      variant: artifactVariant(file.relativePath),
      status: "staged",
      label: ref.label,
      storage_provider: "supabase-storage",
      storage_bucket: bucket,
      storage_path: storagePath,
      bytes: bytes.length,
      sha256: digest,
      mime_type: mimeTypeFor(file.relativePath),
      metadata: { runner: "external-runner", localPath: file.relativePath }
    }).select("id").single();
    if (inserted.error || !inserted.data) throw new Error(`Artifact metadata insert failed: ${inserted.error?.message ?? "missing row"}`);
    ref.id = String(inserted.data.id);
  }
  return refs;
}

export function resolveRunnerSourceUploadId({ job, args }) {
  const jobPinned = job?.source_upload_id ?? job?.metadata?.sourceUploadId ?? job?.metadata?.source_upload_id ?? null;
  const cliPinned = args?.sourceUploadId ?? null;
  if (jobPinned && cliPinned && jobPinned !== cliPinned) {
    throw new Error("CLI --source-upload-id does not match the job-bound source upload.");
  }
  return jobPinned ?? cliPinned ?? null;
}

function stepRequiresSource(step) {
  return ["analyze", "optimize", "visual_compare"].includes(String(step));
}

async function runClaimedJob(client, args, claimed) {
  let job = claimed;
  const identity = identityFromJob(job);
  const logs = [`Runner ${args.workerId} claimed ${job.id}.`];
  let sourcePath = safeLocalSourcePath({ rootDir: args.rootDir, identity });
  let sourceArtifact = null;
  if (stepRequiresSource(job.step)) {
    const resolved = await resolveSourceUploadToLocalSource(client, {
      rootDir: args.rootDir,
      identity,
      sourceUploadId: resolveRunnerSourceUploadId({ job, args }),
      allowedRestaurantSlugs: args.allowedRestaurantSlugs
    });
    sourcePath = resolved.sourcePath;
    sourceArtifact = resolved.artifact;
    logs.push(`Private source materialized at ${resolved.relativeSourcePath}.`);
  }
  const plan = buildStepPlan({ job, rootDir: args.rootDir, sourcePath, cdnBaseUrl: args.cdnBaseUrl, runnerLabel: args.runnerLabel });
  job = await updateProgress(client, { job, args, status: plan.phaseStatus, logs, nextAction: `Running ${plan.step} in the external runner.` });
  const commandResult = await runCommandPlan(plan, {
    rootDir: args.rootDir,
    timeoutMs: args.commandTimeoutMs,
    heartbeat: async () => { job = await heartbeatJob(client, { job, args }); }
  });
  const artifactRefs = [
    ...(sourceArtifact ? [sourceArtifact] : []),
    ...await uploadArtifacts(client, {
      job,
      args,
      files: collectArtifactFiles({ rootDir: args.rootDir, expectedArtifacts: plan.expectedArtifacts, artifactRoots: plan.artifactRoots })
    })
  ];
  const errorMessage = commandResult.ok ? null : commandResult.output?.fails?.join("; ") || commandResult.stderr || `Runner command failed with exit code ${commandResult.exitCode}`;
  const completed = await completeJob(client, {
    job,
    args,
    status: commandResult.ok ? plan.successStatus : plan.failureStatus,
    qualityStatus: commandResult.ok ? plan.successQualityStatus : plan.failureQualityStatus,
    logs: [...logs, ...String(commandResult.stdout).split(/\r?\n/), ...String(commandResult.stderr).split(/\r?\n/)].filter(Boolean).slice(-300),
    artifacts: artifactRefs,
    metrics: { durationMs: commandResult.durationMs },
    errorMessage,
    nextAction: commandResult.ok ? plan.nextAction : "Inspect sanitized runner logs and retry after fixing the blocker."
  });
  return { ok: commandResult.ok, job: completed, logs };
}

async function selectDryRunJob(client, args) {
  let query = client.from(JOBS_TABLE).select("*").eq("status", "queued").order("created_at", { ascending: true }).limit(1);
  if (args.jobId) query = query.eq("id", args.jobId);
  if (args.step) query = query.eq("step", args.step);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Dry-run lookup failed: ${error.message}`);
  return data ?? null;
}

export async function runOnce(options = {}) {
  const env = options.env ?? process.env;
  const args = { ...parseRunnerArgs([]), ...options };
  args.rootDir = normalize(resolve(args.rootDir ?? process.cwd()));
  args.workerId = cleanWorkerId(args.workerId ?? "");
  args.cdnBaseUrl = cleanCdnBaseUrl(args.cdnBaseUrl ?? env.VISTAIRE_3D_CDN_BASE_URL ?? "");
  args.runnerLabel = sanitizeRunnerLogLine(args.runnerLabel ?? args.workerId).slice(0, 120);
  args.allowedRestaurantSlugs = parseAllowedRestaurantSlugs(
    args.allowedRestaurantSlugs ?? env.VISTAIRE_3D_RUNNER_RESTAURANT_SLUGS ?? env.VISTAIRE_OWNER_3D_RESTAURANT_SLUGS ?? ""
  );
  const client = options.client ?? createSupabaseAdmin(env);
  if (args.dryRun) {
    const job = await selectDryRunJob(client, args);
    if (!job) return { ok: true, claimed: false, dryRun: true };
    const identity = identityFromJob(job);
    const source = safeLocalSourcePath({ rootDir: args.rootDir, identity, sha256: "0".repeat(64) });
    return { ok: true, claimed: true, dryRun: true, job, plan: buildStepPlan({ job, rootDir: args.rootDir, sourcePath: source, cdnBaseUrl: args.cdnBaseUrl, runnerLabel: args.runnerLabel }) };
  }
  const claimed = await claimJob(client, args);
  if (!claimed) return { ok: true, claimed: false };
  return { ...await runClaimedJob(client, args, claimed), claimed: true };
}

export function shouldStopRunnerLoop({ args, processed }) {
  return Boolean(
    args.once ||
      (args.maxJobs !== null && processed >= args.maxJobs)
  );
}

async function runLoop(args) {
  const results = [];
  let processed = 0;
  while (true) {
    const result = await runOnce(args);
    results.push(result);
    if (result.claimed) processed += 1;
    if (shouldStopRunnerLoop({ args, processed })) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, args.pollIntervalMs));
  }
  return { ok: results.every((result) => result.ok), processed, results };
}

function printHelp() {
  process.stdout.write(`Vistaire 3D/AR external runner

Usage:
  node scripts/3d/runner.mjs --once
  node scripts/3d/runner.mjs --dry-run --once

Options:
  --once
  --job-id <job_id>
  --source-upload-id <uuid>
  --step <analyze|optimize|visual_compare|cdn|finalize>
  --dry-run
  --no-upload-artifacts
  --worker-id <id>
  --cdn-base-url <https-url>
  --json
`);
}

if (isMainModule()) {
  try {
    const args = parseRunnerArgs();
    if (args.help) {
      printHelp();
      process.exitCode = 0;
    } else {
      const result = await runLoop(args);
      process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `${result.ok ? "ok" : "failed"}: processed ${result.processed} job(s)\n`);
      process.exitCode = result.ok ? 0 : 1;
    }
  } catch (error) {
    process.stderr.write(`${sanitizeRunnerLogLine(error instanceof Error ? error.message : String(error))}\n`);
    process.exitCode = 1;
  }
}
