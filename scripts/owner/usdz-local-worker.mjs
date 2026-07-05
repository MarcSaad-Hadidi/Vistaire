#!/usr/bin/env node
/**
 * Vistaire local USDZ optimizer worker.
 *
 * Runs on the studio PC. The browser sends the large USDZ source here, never to
 * Vercel. This worker writes source/runtime/report only in a temp directory,
 * removes source before requesting signed runtime/report uploads, uploads only
 * the optimized runtime USDZ and JSON report, then calls Vercel `complete`.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "../..");
const OPTIMIZER = join(SCRIPT_DIR, "optimize-restaurant-usdz.mjs");
const HOST = process.env.VISTAIRE_USDZ_WORKER_HOST || "127.0.0.1";
const PORT = Number(process.env.VISTAIRE_USDZ_WORKER_PORT || 8787);
const MAX_SOURCE_BYTES = Number(process.env.VISTAIRE_USDZ_WORKER_MAX_SOURCE_BYTES || 150 * 1024 * 1024);
const WORKER_VERSION = 3;
const WORKER_CAPABILITIES = ["physicalScaleNormalization"];

function allowedOrigins() {
  return (process.env.VISTAIRE_USDZ_WORKER_ALLOWED_ORIGINS ||
    [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3100",
      "http://127.0.0.1:3100",
      "http://localhost:3200",
      "http://127.0.0.1:3200"
    ].join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(req) {
  const origin = req.headers.origin || "";
  const allowed = allowedOrigins();
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "600"
  };
  if (allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function writeJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function readFormData(req) {
  const length = Number(req.headers["content-length"] || 0);
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error("Content-Length requis.");
  }
  if (length > MAX_SOURCE_BYTES + 2 * 1024 * 1024) {
    throw new Error("USDZ source trop volumineux pour le worker local.");
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_SOURCE_BYTES + 2 * 1024 * 1024) {
      throw new Error("USDZ source trop volumineux pour le worker local.");
    }
    chunks.push(chunk);
  }
  const request = new Request("http://127.0.0.1/optimize-usdz", {
    method: "POST",
    headers: req.headers,
    body: Buffer.concat(chunks)
  });
  return request.formData();
}

function runOptimizer(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [
        OPTIMIZER,
        "--source",
        args.sourcePath,
        "--output",
        args.runtimePath,
        "--report",
        args.reportPath,
        "--profile",
        args.profile,
        "--dish-kind",
        args.dishKind
      ],
      { cwd: PROJECT_ROOT, env: process.env, windowsHide: true }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        const line = stdout.trim().split("\n").filter(Boolean).pop() || "";
        try {
          resolvePromise(JSON.parse(line));
        } catch (error) {
          reject(error);
        }
        return;
      }
      let message = stderr.trim() || stdout.trim() || "Optimiseur USDZ indisponible.";
      try {
        const parsed = JSON.parse(stderr.trim().split("\n").pop());
        if (parsed?.error) message = parsed.error;
      } catch {
        // keep raw message
      }
      reject(new Error(message));
    });
  });
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) {
    throw new Error(json.error || `Requete worker echouee (${response.status}).`);
  }
  return json;
}

async function uploadSigned(upload, bytes, contentType) {
  const response = await fetch(upload.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": contentType === "application/json" ? "max-age=3600" : "max-age=31536000"
    },
    body: bytes
  });
  if (!response.ok) {
    throw new Error(`Upload signe Supabase impossible (${response.status}).`);
  }
}

function absoluteApiUrl(apiBaseUrl, endpoint) {
  return new URL(endpoint, apiBaseUrl).toString();
}

async function notifyFail(form, message, apiBaseUrl, rollbackPayload = {}) {
  const failEndpoint = String(form.get("failEndpoint") || "");
  const jobToken = String(form.get("jobToken") || "");
  const jobId = String(form.get("jobId") || "");
  if (!failEndpoint || !jobToken || !apiBaseUrl) return;
  try {
    await postJson(absoluteApiUrl(apiBaseUrl, failEndpoint), {
      jobId,
      jobToken,
      error: message,
      ...rollbackPayload,
      usdzSourceStored: false
    });
  } catch {
    // Failure notification is best-effort; temp cleanup still runs.
  }
}

async function handleOptimize(req, res) {
  const headers = corsHeaders(req);
  if (!headers["Access-Control-Allow-Origin"]) {
    writeJson(res, 403, { ok: false, error: "Origine non autorisee." }, headers);
    return;
  }

  let workspace = "";
  let sourcePath = "";
  let form = null;
  let apiBaseUrl = "";
  let preparePayload = null;
  let prepared = null;
  let runtimeUploaded = false;
  let reportUploaded = false;
  try {
    form = await readFormData(req);
    apiBaseUrl = String(form.get("apiBaseUrl") || "");
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Error("Fichier USDZ requis.");
    }
    if (!file.name.toLowerCase().endsWith(".usdz")) {
      throw new Error("Seuls les fichiers .usdz sont acceptes.");
    }
    if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
      throw new Error("USDZ source trop volumineux.");
    }

    const profile = String(form.get("profile") || "balanced");
    const dishKind = String(form.get("dishKind") || "fallback");
    const jobId = String(form.get("jobId") || "");
    const jobToken = String(form.get("jobToken") || "");
    const prepareEndpoint = String(form.get("prepareUploadEndpoint") || "");
    const completeEndpoint = String(form.get("completeEndpoint") || "");
    if (!apiBaseUrl || !jobId || !jobToken || !prepareEndpoint || !completeEndpoint) {
      throw new Error("Job USDZ local incomplet.");
    }

    workspace = mkdtempSync(join(resolve(tmpdir()), "vistaire-usdz-local-worker-"));
    sourcePath = join(workspace, "source.usdz");
    const runtimePath = join(workspace, "runtime.usdz");
    const reportPath = join(workspace, "report.json");
    writeFileSync(sourcePath, Buffer.from(await file.arrayBuffer()));
    const sourceBytes = statSync(sourcePath).size;
    const sourceSha256 = sha256File(sourcePath);

    const summary = await runOptimizer({ sourcePath, runtimePath, reportPath, profile, dishKind });
    if (Array.isArray(summary.fails) && summary.fails.length > 0) {
      throw new Error(`Optimisation USDZ bloquee: ${summary.fails.join("; ")}`);
    }
    if (!existsSync(runtimePath) || !existsSync(reportPath)) {
      throw new Error("Runtime ou rapport USDZ manquant.");
    }

    const runtimeBytesBuffer = readFileSync(runtimePath);
    const reportBytesBuffer = readFileSync(reportPath);
    const runtimeSha256 = sha256File(runtimePath);
    rmSync(sourcePath, { force: true });

    preparePayload = {
      jobId,
      jobToken,
      profile: summary.profile || profile,
      sourceBytes,
      sourceSha256,
      runtimeBytes: runtimeBytesBuffer.byteLength,
      runtimeSha256,
      reportBytes: reportBytesBuffer.byteLength,
      geometryOptimization: summary.geometryOptimization || "unknown",
      warnings: summary.warnings || [],
      fails: summary.fails || []
    };
    prepared = await postJson(
      absoluteApiUrl(apiBaseUrl, prepareEndpoint),
      preparePayload
    );
    await uploadSigned(prepared.runtimeUpload, runtimeBytesBuffer, "model/vnd.usdz+zip");
    runtimeUploaded = true;
    await uploadSigned(prepared.reportUpload, reportBytesBuffer, "application/json");
    reportUploaded = true;

    const completed = await postJson(absoluteApiUrl(apiBaseUrl, completeEndpoint), {
      ...preparePayload,
      version: prepared.version,
      runtimeStoragePath: prepared.runtimeStoragePath,
      reportStoragePath: prepared.reportStoragePath,
      reductionPercent: summary.reductionPercent || 0,
      triangleCountBefore: summary.triangleCountBefore || 0,
      triangleCountAfter: summary.triangleCountAfter || 0,
      geometryReductionPercent: summary.geometryReductionPercent || 0,
      physicalScale: summary.physicalScale || null,
      textureCount: summary.textureCount || 0,
      changedTextures: summary.changedTextures || 0,
      candidateAttempts: summary.candidateAttempts || [],
      attemptCount: summary.attemptCount || 0
    });

    writeJson(res, 200, {
      ok: true,
      ...completed,
      worker: { sourceStored: false, cleanup: "finally" },
      report: summary
    }, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Optimisation USDZ locale impossible.";
    if (sourcePath) rmSync(sourcePath, { force: true });
    const rollbackPayload =
      prepared && preparePayload && (runtimeUploaded || reportUploaded)
        ? {
            ...preparePayload,
            version: prepared.version,
            runtimeStoragePath: runtimeUploaded ? prepared.runtimeStoragePath : undefined,
            reportStoragePath: reportUploaded ? prepared.reportStoragePath : undefined
          }
        : {};
    if (form) await notifyFail(form, message, apiBaseUrl, rollbackPayload);
    writeJson(res, 500, { ok: false, error: message, usdzSourceStored: false }, headers);
  } finally {
    if (workspace) rmSync(workspace, { recursive: true, force: true });
  }
}

const server = createServer((req, res) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    writeJson(
      res,
      200,
      {
        ok: true,
        worker: "vistaire-usdz-local-worker",
        version: WORKER_VERSION,
        capabilities: WORKER_CAPABILITIES,
        host: HOST,
        port: PORT,
        sourceStored: false
      },
      headers
    );
    return;
  }
  if (req.method === "POST" && req.url === "/optimize-usdz") {
    void handleOptimize(req, res);
    return;
  }
  writeJson(res, 404, { ok: false, error: "Route worker inconnue." }, headers);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Vistaire USDZ local worker listening on http://${HOST}:${PORT}\n`);
});
