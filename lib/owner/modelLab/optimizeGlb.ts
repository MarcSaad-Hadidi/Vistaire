import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
  compressionPath: "gltf-transform" | "gltfpack-cc";
};

type WorkerPreset = ReturnType<typeof getModelLabPreset>;

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
  let output = await runOptimizeWorker({
    bytes: args.bytes,
    preset,
    timeoutMs: MODEL_LAB_OPTIMIZE_TIMEOUT_MS,
    maxOutputBytes: MODEL_LAB_OPTIMIZED_MAX_BYTES
  });
  let compressionPath: OptimizeGlbCandidateResult["compressionPath"] = "gltf-transform";

  if (preset.useGltfpack) {
    const packed = await tryGltfpackCc({
      bytes: output,
      timeoutMs: MODEL_LAB_OPTIMIZE_TIMEOUT_MS,
      maxOutputBytes: MODEL_LAB_OPTIMIZED_MAX_BYTES
    });
    if (packed && packed.byteLength < output.byteLength) {
      output = packed;
      compressionPath = "gltfpack-cc";
    }
  }

  const stem = baseNameWithoutGlb(args.originalName);
  return {
    bytes: output,
    fileName: `${stem}-${preset.id}.glb`,
    mode: args.mode,
    elapsedMs: Date.now() - startedAt,
    compressionPath
  };
}

function runOptimizeWorker(args: {
  bytes: Buffer;
  preset: WorkerPreset;
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
    let stdinError: Error | null = null;

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

    child.stdin.on("error", (error: Error) => {
      stdinError = error;
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
        reject(
          new Error(
            detail ||
              (stdinError
                ? `Model Lab optimizer worker closed before reading input: ${stdinError.message}`
                : "Model Lab optimizer worker failed.")
          )
        );
        return;
      }
      if (stdinError) {
        reject(
          new Error(`Model Lab optimizer input stream failed: ${stdinError.message}`)
        );
        return;
      }
      resolve(Buffer.concat(stdout));
    });

    try {
      child.stdin.end(args.bytes);
    } catch (error) {
      stdinError =
        error instanceof Error
          ? error
          : new Error("Model Lab optimizer input stream failed.");
      child.kill("SIGKILL");
    }
  });
}

function gltfpackCommand(): string {
  return process.env.VISTAIRE_MODEL_LAB_GLTFPACK_PATH?.trim() || "gltfpack";
}

function canRunGltfpack(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, ["-h"], {
      stdio: "ignore",
      windowsHide: true
    });
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve(false);
    }, 3_000);
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(ok);
    };
    child.once("error", () => settle(false));
    child.once("close", (code) => settle(code === 0 || code === 1));
  });
}

function runGltfpackCommand(args: {
  command: string;
  inputPath: string;
  outputPath: string;
  timeoutMs: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(args.command, ["-i", args.inputPath, "-o", args.outputPath, "-cc"], {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true
    });
    const stderr: Buffer[] = [];
    let settled = false;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, args.timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.reduce((sum, part) => sum + part.byteLength, 0) < 16_384) {
        stderr.push(Buffer.from(chunk));
      }
    });

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error("gltfpack timed out."));
        return;
      }
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString("utf8").trim();
        reject(new Error(detail || "gltfpack failed."));
        return;
      }
      resolve();
    });
  });
}

async function tryGltfpackCc(args: {
  bytes: Buffer;
  timeoutMs: number;
  maxOutputBytes: number;
}): Promise<Buffer | null> {
  const command = gltfpackCommand();
  if (!(await canRunGltfpack(command))) {
    console.warn("Vistaire Model Lab: gltfpack unavailable; using glTF-Transform fallback.");
    return null;
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "vistaire-model-lab-"));
  try {
    const inputPath = join(tempRoot, "input.glb");
    const outputPath = join(tempRoot, "output.glb");
    await writeFile(inputPath, args.bytes);
    await runGltfpackCommand({
      command,
      inputPath,
      outputPath,
      timeoutMs: args.timeoutMs
    });
    const output = await readFile(outputPath);
    if (output.byteLength <= 0 || output.byteLength > args.maxOutputBytes) {
      throw new Error("gltfpack output exceeded the Model Lab output cap.");
    }
    return Buffer.from(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : "gltfpack failed.";
    console.warn(`Vistaire Model Lab: gltfpack fallback skipped (${message}).`);
    return null;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
