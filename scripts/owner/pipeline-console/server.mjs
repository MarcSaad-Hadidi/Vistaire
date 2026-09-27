#!/usr/bin/env node
/**
 * Console locale — Pipeline USDZ Vistaire.
 *
 * UI web pour lancer le pipeline en local, sans passer par le dashboard :
 *   1. déposer un .usdz
 *   2. choisir le type de plat + le mode (4 variantes / profil unique)
 *   3. suivre la progression en direct
 *   4. comparer les résultats, tester en AR, choisir la gagnante
 *
 * Zéro dépendance (node:http uniquement).
 *
 *   node server.mjs   →  http://127.0.0.1:8130
 */

import { spawn, execFile } from "node:child_process";
import { createServer } from "node:http";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ROOT, "public");
const DATA = join(ROOT, "data");
const CONFIG = JSON.parse(readFileSync(join(ROOT, "config.json"), "utf8"));

const HOST = process.env.CONSOLE_HOST || CONFIG.host || "127.0.0.1";
const PORT = Number(process.env.CONSOLE_PORT || CONFIG.port || 8130);
const MAX_UPLOAD = 250 * 1024 * 1024;

const VARIANTS_PY = resolve(ROOT, CONFIG.variantsScript || "./usdz_variants.py");
const OPTIMIZER_MJS = CONFIG.vistaireRepo
  ? resolve(CONFIG.vistaireRepo, "scripts/owner/optimize-restaurant-usdz.mjs")
  : null;

mkdirSync(join(DATA, "uploads"), { recursive: true });
mkdirSync(join(DATA, "jobs"), { recursive: true });

const DISH_KINDS = [
  { id: "plate", label: "Assiette" },
  { id: "burger", label: "Burger" },
  { id: "pizza", label: "Pizza" },
  { id: "bowl", label: "Bol" },
  { id: "dessert", label: "Dessert" },
  { id: "drink", label: "Boisson" },
  { id: "platter", label: "Plateau" },
  { id: "fallback", label: "Autre" },
];
const PROFILES = ["balanced", "light", "premium", "emergency"];

/* ---------------- jobs en mémoire ---------------- */

const jobs = new Map(); // id -> job
const subscribers = new Map(); // id -> Set<res>

function getJob(id) {
  return jobs.get(id);
}

function emit(id, event) {
  const job = jobs.get(id);
  if (!job) return;
  job.log.push(event);
  const subs = subscribers.get(id);
  if (!subs) return;
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of subs) {
    try {
      res.write(line);
    } catch {
      /* client parti */
    }
  }
}

function persistJob(job) {
  try {
    writeFileSync(
      join(DATA, "jobs", `${job.id}.json`),
      JSON.stringify({ ...job, log: job.log.slice(-200) }, null, 2)
    );
  } catch {
    /* non bloquant */
  }
}

function loadPersistedJobs() {
  try {
    for (const f of readdirSync(join(DATA, "jobs"))) {
      if (!f.endsWith(".json")) continue;
      try {
        const job = JSON.parse(readFileSync(join(DATA, "jobs", f), "utf8"));
        if (job.status === "running") job.status = "interrompu";
        jobs.set(job.id, { ...job, log: job.log || [] });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/* ---------------- utilitaires ---------------- */

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendFile(res, path, contentType) {
  try {
    const stat = statSync(path);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes",
    });
    res.end(readFileSync(path));
  } catch {
    sendJson(res, 404, { ok: false, error: "Fichier introuvable." });
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".usdz": "model/vnd.usdz+zip",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function readFormData(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_UPLOAD) throw new Error("Fichier trop volumineux (max 250 Mo).");
    chunks.push(chunk);
  }
  const request = new Request("http://127.0.0.1/api/run", {
    method: "POST",
    headers: req.headers,
    body: Buffer.concat(chunks),
  });
  return request.formData();
}

function checkBin(cmd, args) {
  return new Promise((resolveOk) => {
    execFile(cmd, args, { timeout: 15000 }, (err, stdout) => {
      if (err) return resolveOk({ ok: false });
      resolveOk({ ok: true, version: String(stdout || "").split("\n")[0].trim().slice(0, 80) });
    });
  });
}

/* ---------------- exécution pipeline ---------------- */

function runVariantsJob(job) {
  const jobDir = join(DATA, "jobs", job.id);
  const variantsDir = join(jobDir, "variants");
  mkdirSync(variantsDir, { recursive: true });

  const child = spawn(
    CONFIG.python || "python3",
    [VARIANTS_PY, job.sourcePath, "--out-dir", variantsDir],
    { cwd: ROOT }
  );
  job.proc = child;

  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d.toString();
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      emit(job.id, { type: "log", text: t });
      const m = t.match(/OK ratio ([\d.]+)/);
      if (m) {
        const order = ["0.5", "0.25", "0.15", "0.1"];
        const idx = order.indexOf(m[1]);
        if (idx >= 0) {
          job.progress = (idx + 1) / order.length;
          emit(job.id, { type: "progress", value: job.progress });
        }
      }
    }
  });
  child.stderr.on("data", (d) => {
    const t = d.toString().trim();
    if (t) emit(job.id, { type: "log", text: t, err: true });
  });
  child.on("error", (err) => {
    job.status = "error";
    job.error = `Lancement impossible : ${err.message}`;
    emit(job.id, { type: "error", error: job.error });
    persistJob(job);
  });
  child.on("close", (code) => {
    if (buf.trim()) emit(job.id, { type: "log", text: buf.trim() });
    if (code !== 0) {
      job.status = "error";
      job.error = `Le pipeline a échoué (code ${code}).`;
      emit(job.id, { type: "error", error: job.error });
      persistJob(job);
      return;
    }
    try {
      const manifest = JSON.parse(readFileSync(join(variantsDir, "manifest.json"), "utf8"));
      const order = ["0.5", "0.25", "0.15", "0.1"];
      job.results = order
        .filter((r) => manifest.variantes[r])
        .map((r) => {
          const v = manifest.variantes[r];
          return {
            variant: v.fichier.replace(/.*_([a-z0-9]+)\.usdz$/i, "$1"),
            label: { "0.5": "Douce", "0.25": "Équilibrée", "0.15": "Poussée", "0.1": "Maximale" }[r],
            ratio: r,
            file: v.fichier,
            bytes: v.octets,
            reduction: v.reduction_pct,
            url: `/api/files/${job.id}/variants/${encodeURIComponent(v.fichier)}`,
          };
        });
      job.sourceBytes = manifest.source_octets;
      job.status = "done";
      job.progress = 1;
      emit(job.id, { type: "progress", value: 1 });
      emit(job.id, { type: "done", results: job.results });
    } catch (err) {
      job.status = "error";
      job.error = `Manifest illisible : ${err.message}`;
      emit(job.id, { type: "error", error: job.error });
    }
    persistJob(job);
  });
}

function runSingleJob(job) {
  const jobDir = join(DATA, "jobs", job.id);
  const outPath = join(jobDir, "runtime.usdz");
  const reportPath = join(jobDir, "report.json");

  const child = spawn(
    process.execPath,
    [
      OPTIMIZER_MJS,
      "--source", job.sourcePath,
      "--output", outPath,
      "--report", reportPath,
      "--profile", job.profile,
      "--dish-kind", job.dishKind,
    ],
    { cwd: CONFIG.vistaireRepo }
  );
  job.proc = child;

  let out = "";
  child.stdout.on("data", (d) => {
    out += d.toString();
    const t = d.toString().trim();
    if (t) emit(job.id, { type: "log", text: t.split("\n").pop().slice(0, 300) });
  });
  child.stderr.on("data", (d) => {
    const t = d.toString().trim();
    if (t) emit(job.id, { type: "log", text: t.slice(0, 300), err: true });
  });
  child.on("error", (err) => {
    job.status = "error";
    job.error = `Lancement impossible : ${err.message}`;
    emit(job.id, { type: "error", error: job.error });
    persistJob(job);
  });
  child.on("close", (code) => {
    if (code !== 0) {
      job.status = "error";
      job.error = `Le pipeline a échoué (code ${code}).`;
      emit(job.id, { type: "error", error: job.error });
      persistJob(job);
      return;
    }
    try {
      const line = out.trim().split("\n").filter(Boolean).pop() || "{}";
      const summary = JSON.parse(line);
      job.results = [
        {
          variant: job.profile,
          label: `Profil ${job.profile}`,
          file: "runtime.usdz",
          bytes: summary.runtimeBytes || statSync(outPath).size,
          reduction: summary.reductionPercent ?? 0,
          trianglesBefore: summary.triangleCountBefore ?? 0,
          trianglesAfter: summary.triangleCountAfter ?? 0,
          url: `/api/files/${job.id}/runtime.usdz`,
        },
      ];
      job.sourceBytes = summary.sourceBytes || job.sourceBytes;
      job.status = "done";
      job.progress = 1;
      emit(job.id, { type: "progress", value: 1 });
      emit(job.id, { type: "done", results: job.results });
    } catch (err) {
      job.status = "error";
      job.error = `Rapport illisible : ${err.message}`;
      emit(job.id, { type: "error", error: job.error });
    }
    persistJob(job);
  });
}

/* ---------------- routes ---------------- */

async function handleHealth(res) {
  const [python, blender] = await Promise.all([
    checkBin(CONFIG.python || "python3", ["--version"]),
    checkBin(CONFIG.blender || "blender", ["--version"]),
  ]);
  sendJson(res, 200, {
    ok: true,
    python,
    blender,
    variantsScript: { ok: existsSync(VARIANTS_PY) },
    optimizer: OPTIMIZER_MJS
      ? { ok: existsSync(OPTIMIZER_MJS), repo: CONFIG.vistaireRepo }
      : { ok: false, repo: null },
    dishKinds: DISH_KINDS,
    profiles: PROFILES,
  });
}

async function handleRun(req, res) {
  let form;
  try {
    form = await readFormData(req);
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err.message });
    return;
  }
  const file = form.get("file");
  const dishKind = String(form.get("dishKind") || "plate");
  const mode = String(form.get("mode") || "variants");
  const profile = String(form.get("profile") || "balanced");

  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".usdz")) {
    sendJson(res, 400, { ok: false, error: "Un fichier .usdz est requis." });
    return;
  }
  if (mode === "single" && !OPTIMIZER_MJS) {
    sendJson(res, 400, { ok: false, error: "Mode profil unique indisponible : vistaireRepo non configuré." });
    return;
  }
  if (mode === "variants" && !existsSync(VARIANTS_PY)) {
    sendJson(res, 400, { ok: false, error: "Module de variantes introuvable." });
    return;
  }

  const id = randomUUID().slice(0, 8);
  const jobDir = join(DATA, "jobs", id);
  mkdirSync(jobDir, { recursive: true });
  const safeName = basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
  const sourcePath = join(jobDir, `source_${safeName}`);
  writeFileSync(sourcePath, Buffer.from(await file.arrayBuffer()));

  const job = {
    id,
    status: "running",
    mode,
    profile,
    dishKind,
    fileName: file.name,
    sourcePath,
    sourceBytes: file.size,
    createdAt: new Date().toISOString(),
    progress: 0,
    log: [],
    results: [],
    choice: null,
  };
  jobs.set(id, job);
  emit(id, { type: "log", text: `Source : ${file.name} (${(file.size / 1048576).toFixed(1)} Mo)` });
  emit(id, {
    type: "log",
    text: mode === "variants" ? "Mode : 4 variantes (r50 / r25 / r15 / r10)" : `Mode : profil unique (${profile})`,
  });
  persistJob(job);

  if (mode === "variants") runVariantsJob(job);
  else runSingleJob(job);

  sendJson(res, 202, { ok: true, jobId: id });
}

function handleStream(req, res, id) {
  const job = getJob(id);
  if (!job) {
    sendJson(res, 404, { ok: false, error: "Job introuvable." });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  // rejoue l'historique
  for (const ev of job.log) res.write(`data: ${JSON.stringify(ev)}\n\n`);
  if (job.status === "done") res.write(`data: ${JSON.stringify({ type: "done", results: job.results })}\n\n`);
  if (job.status === "error") res.write(`data: ${JSON.stringify({ type: "error", error: job.error })}\n\n`);
  if (!subscribers.has(id)) subscribers.set(id, new Set());
  subscribers.get(id).add(res);
  req.on("close", () => {
    const set = subscribers.get(id);
    if (set) set.delete(res);
  });
}

function handleChoose(req, res, id) {
  const job = getJob(id);
  if (!job || job.status !== "done") {
    sendJson(res, 400, { ok: false, error: "Job non terminé." });
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      const { variant } = JSON.parse(body || "{}");
      const found = job.results.find((r) => r.variant === variant);
      if (!found) throw new Error("Variante inconnue.");
      job.choice = variant;
      persistJob(job);
      const choicesPath = join(DATA, "choices.json");
      let choices = [];
      try {
        choices = JSON.parse(readFileSync(choicesPath, "utf8"));
      } catch {
        /* premier choix */
      }
      choices.push({
        at: new Date().toISOString(),
        jobId: id,
        dish: job.fileName,
        dishKind: job.dishKind,
        variant,
        file: found.file,
        bytes: found.bytes,
      });
      writeFileSync(choicesPath, JSON.stringify(choices, null, 2));
      emit(id, { type: "choice", variant });
      sendJson(res, 200, { ok: true, choice: variant });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message });
    }
  });
}

function handleChoices(res) {
  try {
    const choices = JSON.parse(readFileSync(join(DATA, "choices.json"), "utf8"));
    sendJson(res, 200, { ok: true, choices: choices.reverse() });
  } catch {
    sendJson(res, 200, { ok: true, choices: [] });
  }
}

function handleJobs(res) {
  const list = [...jobs.values()]
    .map((j) => ({
      id: j.id,
      status: j.status,
      mode: j.mode,
      fileName: j.fileName,
      dishKind: j.dishKind,
      createdAt: j.createdAt,
      progress: j.progress,
      choice: j.choice,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 20);
  sendJson(res, 200, { ok: true, jobs: list });
}

/* ---------------- serveur ---------------- */

loadPersistedJobs();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/api/health") return handleHealth(res);
    if (req.method === "GET" && path === "/api/choices") return handleChoices(res);
    if (req.method === "GET" && path === "/api/jobs") return handleJobs(res);
    if (req.method === "POST" && path === "/api/run") return handleRun(req, res);

    let m = path.match(/^\/api\/jobs\/([a-zA-Z0-9-]+)\/stream$/);
    if (req.method === "GET" && m) return handleStream(req, res, m[1]);

    m = path.match(/^\/api\/jobs\/([a-zA-Z0-9-]+)\/choose$/);
    if (req.method === "POST" && m) return handleChoose(req, res, m[1]);

    m = path.match(/^\/api\/jobs\/([a-zA-Z0-9-]+)$/);
    if (req.method === "GET" && m) {
      const job = getJob(m[1]);
      if (!job) return sendJson(res, 404, { ok: false, error: "Job introuvable." });
      const { proc, ...safe } = job;
      return sendJson(res, 200, { ok: true, job: safe });
    }

    m = path.match(/^\/api\/files\/([a-zA-Z0-9-]+)\/(.+)$/);
    if (req.method === "GET" && m) {
      const jobDir = join(DATA, "jobs", m[1]);
      const filePath = resolve(join(jobDir, decodeURIComponent(m[2])));
      if (!filePath.startsWith(resolve(jobDir))) return sendJson(res, 403, { ok: false });
      return sendFile(res, filePath, MIME[extname(filePath).toLowerCase()] || "application/octet-stream");
    }

    // statique
    let filePath = join(PUBLIC, path === "/" ? "index.html" : decodeURIComponent(path.slice(1)));
    const resolved = resolve(filePath);
    if (!resolved.startsWith(resolve(PUBLIC))) return sendJson(res, 403, { ok: false });
    if (!existsSync(resolved) || statSync(resolved).isDirectory()) {
      filePath = join(PUBLIC, "index.html");
    }
    return sendFile(res, filePath, MIME[extname(filePath).toLowerCase()] || "application/octet-stream");
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Console pipeline USDZ → http://${HOST}:${PORT}`);
});
