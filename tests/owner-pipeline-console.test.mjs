import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

async function consoleFixture(t, workerMode = "success") {
  const root = mkdtempSync(join(tmpdir(), "vistaire-console-test-"));
  mkdirSync(join(root, "public"));
  mkdirSync(join(root, "repo/scripts/owner"), { recursive: true });
  for (const file of ["server.mjs", "public/index.html"]) {
    copyFileSync(resolve("scripts/owner/pipeline-console", file), join(root, file));
  }
  writeFileSync(join(root, "config.json"), JSON.stringify({
    host: "127.0.0.1", port: 0, python: "./tools/python", blender: "./tools/blender",
    vistaireRepo: "./repo", variantsScript: "./fallback.mjs",
  }));
  writeFileSync(join(root, "fallback.mjs"), 'throw new Error("Fallback must not run");');
  writeFileSync(join(root, "repo/scripts/owner/optimize-restaurant-usdz.mjs"), [
    'import { writeFileSync } from "node:fs";',
    'import { join } from "node:path";',
    'import { setTimeout } from "node:timers/promises";',
    'const arg = (name) => process.argv[process.argv.indexOf(name) + 1];',
    'await setTimeout(200);',
    'if (process.env.WORKER_MODE === "failure") process.exit(2);',
    'const output = arg("--output");',
    'const variants = ["r50", "r25", "r15", "r10"].map((v) => {',
    ' const file = "dish_" + v + ".usdz"; writeFileSync(join(output, file), "model-data");',
    ' return { ok: true, file, bytes: 10, reductionPercent: 50 };',
    '});',
    'writeFileSync(arg("--report"), JSON.stringify({ok:true, variants}));',
    'writeFileSync(join(output, "env.json"), JSON.stringify({python:process.env.VISTAIRE_USDZ_PYTHON, blender:process.env.BLENDER_BIN}));',
  ].join("\n"));
  let child;
  let base;
  let token;
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const closed = once(child, "close");
    child.kill();
    await closed;
  }
  async function start(nextToken) {
    token = nextToken;
    child = spawn(process.execPath, [join(root, "server.mjs")], {
      // Deliberately start outside ROOT: relative config paths must still work.
      cwd: tmpdir(),
      env: { ...process.env, CONSOLE_PORT: "0", CONSOLE_HOST: "127.0.0.1",
        CONSOLE_TOKEN: token, VISTAIRE_USDZ_PYTHON: "", VISTAIRE_USDZ_BLENDER: "",
        BLENDER_BIN: "", WORKER_MODE: workerMode },
      windowsHide: true,
    });
    let log = "";
    child.stdout.on("data", (d) => { log += d; });
    child.stderr.on("data", (d) => { log += d; });
    for (let i = 0; i < 100; i++) {
      const m = log.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
      if (m) { base = "http://127.0.0.1:" + m[1]; return; }
      assert.equal(child.exitCode, null, log);
      await delay(30);
    }
    throw new Error("Console startup timeout: " + log);
  }
  t.after(async () => { await stop(); rmSync(root, { recursive: true, force: true }); });
  const url = (path) => base + path + (path.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
  const request = (path, options) => fetch(url(path), options);
  async function run(fields = {}) {
    const body = new FormData();
    body.set("file", new File(["fixture"], "dish.usdz"));
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return request("/api/run", { method: "POST", body });
  }
  async function finished(id) {
    for (let i = 0; i < 100; i++) {
      const { job } = await (await request("/api/jobs/" + id)).json();
      if (job.status !== "running") return job;
      await delay(30);
    }
    throw new Error("Job timeout");
  }
  await start('qa&+"<script>#%');
  return { root, request, run, finished, start, stop, url, get base() { return base; } };
}

test("console: authenticated generation, downloads, choices and restart preserve results", async (t) => {
  const c = await consoleFixture(t);
  for (const path of ["/", "/index.html", "/api/health", "/api/jobs"]) {
    assert.equal((await fetch(c.base + path)).status, 401, path + " requires a token");
  }
  const page = await c.request("/");
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("referrer-policy"), "no-referrer");
  assert.ok(!(await page.text()).includes("__CONSOLE_TOKEN__"), "no raw credential injection");
  const accepted = await c.run();
  assert.equal(accepted.status, 202);
  const { jobId } = await accepted.json();
  assert.equal((await c.run()).status, 409, "only one generation at a time");
  const job = await c.finished(jobId);
  assert.equal(job.status, "done");
  assert.equal(job.results.length, 4);
  assert.equal("proc" in job, false);
  const env = JSON.parse(readFileSync(join(c.root, "data/jobs", jobId, "variants/env.json")));
  assert.equal(env.python, join(c.root, "tools/python"));
  assert.equal(env.blender, join(c.root, "tools/blender"));
  const path = job.results[0].url;
  assert.equal(path.includes("token"), false, "persist no startup credential");
  const bytes = await c.request(path, { headers: { Range: "bytes=0-4" } });
  assert.equal(bytes.status, 206);
  assert.equal(await bytes.text(), "model");
  assert.equal((await c.request(path, { headers: { Range: "bytes=99-" } })).status, 416);
  assert.equal((await c.request(path, { method: "HEAD" })).headers.get("content-length"), "10");
  assert.equal((await c.request("/api/files/" + jobId + "/source_dish.usdz")).status, 403);
  assert.equal((await c.request("/api/files/" + jobId + "/%2e%2e%2f" + jobId + ".json")).status, 403);
  const choose = (variant) => c.request("/api/jobs/" + jobId + "/choose", {
    method: "POST", body: JSON.stringify({ variant }), headers: { "Content-Type": "application/json" },
  });
  assert.equal((await choose("r25")).status, 200);
  assert.equal((await choose("r10")).status, 200);
  assert.equal((await (await c.request("/api/choices")).json()).choices[0].variant, "r10");
  await c.stop();
  await c.start("second&token");
  const restored = (await (await c.request("/api/jobs/" + jobId)).json()).job;
  assert.equal(restored.status, "done");
  assert.equal(restored.choice, "r10");
  assert.equal((await c.request(restored.results[0].url)).status, 200);
  const saved = readFileSync(join(c.root, "data/jobs", jobId + ".json"), "utf8");
  assert.ok(!saved.includes('"proc"'));
  assert.ok(!saved.includes("?token="));
});

test("console: rejects invalid inputs and surfaces optimizer failures without fallback", async (t) => {
  const c = await consoleFixture(t, "failure");
  assert.equal((await c.run({ mode: "arbitrary" })).status, 400);
  assert.equal((await c.run({ profile: "<script>" })).status, 400);
  assert.equal((await c.run({ dishKind: "invalid" })).status, 400);
  const first = await c.run();
  assert.equal(first.status, 202);
  const job = await c.finished((await first.json()).jobId);
  assert.equal(job.status, "error");
  assert.match(job.error, /Optimiseur en échec/);
  assert.ok(!job.log.some((event) => event.text?.includes("script autonome")));
  assert.equal((await c.request("/api/files/" + job.id + "/runtime.usdz")).status, 404);
  assert.equal((await c.run()).status, 202, "failure releases generation slot");
  // Wait for the last worker so fixture cleanup cannot orphan a process.
  const jobs = (await (await c.request("/api/jobs")).json()).jobs;
  await c.finished(jobs.find((j) => j.status === "running").id);
});
