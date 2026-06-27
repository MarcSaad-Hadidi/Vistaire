import "server-only";

import { spawn } from "node:child_process";
import { join } from "node:path";
import {
  MODEL_LAB_OPTIMIZED_MAX_BYTES,
  MODEL_LAB_OPTIMIZE_TIMEOUT_MS
} from "@/lib/owner/modelLab/modelLabLimits";
import { getModelLabPreset, type ModelLabPresetId } from "@/lib/owner/modelLab/modelLabPresets";

export type OptimizeGlbCandidateResult = {
  bytes: Buffer;
  fileName: string;
  mode: ModelLabPresetId;
  elapsedMs: number;
};

function baseNameWithoutGlb(value: string): string {
  const base = value
    .split(/[\\/]+/)
    .filter(Boolean)
    .pop()
    ?.replace(/\.glb$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80);

  return base || "model";
}

export async function optimizeGlbCandidate(args: {
  bytes: Buffer;
  originalName: string;
  mode: ModelLabPresetId;
}): Promise<OptimizeGlbCandidateResult> {
  const preset = getModelLabPreset(args.mode);
  const startedAt = Date.now();
  const output = await runOptimizeWorker({
    bytes: args.bytes,
    preset,
    timeoutMs: MODEL_LAB_OPTIMIZE_TIMEOUT_MS,
    maxOutputBytes: MODEL_LAB_OPTIMIZED_MAX_BYTES
  });
  const stem = baseNameWithoutGlb(args.originalName);
  return {
    bytes: output,
    fileName: `${stem}-${preset.id}.glb`,
    mode: args.mode,
    elapsedMs: Date.now() - startedAt
  };
}

function runOptimizeWorker(args: {
  bytes: Buffer;
  preset: ReturnType<typeof getModelLabPreset>;
  timeoutMs: number;
  maxOutputBytes: number;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const workerPath = join(process.cwd(), "lib", "owner", "modelLab", "optimizeWorker.mjs");
    const child = spawn(process.execPath, [workerPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VISTAIRE_MODEL_LAB_WORKER_PRESET: JSON.stringify(args.preset)
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let settled = false;
    let timedOut = false;
    let outputTooLarge = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, args.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > args.maxOutputBytes) {
        outputTooLarge = true;
        child.kill("SIGKILL");
        return;
      }
      stdout.push(Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.reduce((sum, part) => sum + part.byteLength, 0) < 32_768) {
        stderr.push(Buffer.from(chunk));
      }
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error("Model Lab optimization timed out and was terminated."));
        return;
      }
      if (outputTooLarge) {
        reject(new Error("Optimized GLB exceeded the Model Lab output cap."));
        return;
      }
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString("utf8").trim();
        reject(new Error(detail || "Model Lab optimizer worker failed."));
        return;
      }
      resolve(Buffer.concat(stdout));
    });

    child.stdin.end(args.bytes);
  });
}
