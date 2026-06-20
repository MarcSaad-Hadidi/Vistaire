import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawn } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/owner/threeDSourceUploadModel";

const PROJECT_ROOT = /* turbopackIgnore: true */ process.cwd();
const TEMP_UPLOAD_ROOT = join(PROJECT_ROOT, "tmp_owner_3d_uploads");
const PIPELINE_SCRIPT_RELATIVE_PATH = "scripts/owner/build-restaurant-meshy-dish.mjs";
const PIPELINE_SCRIPT_PATH = join(PROJECT_ROOT, PIPELINE_SCRIPT_RELATIVE_PATH);
const PIPELINE_TIMEOUT_MS = 10 * 60 * 1000;

type OwnerIdentity = {
  userId: string;
  email?: string | null;
};

type RestaurantMeshyPipelineArgs = {
  adminClient: SupabaseClient;
  owner: OwnerIdentity;
  restaurantId: string;
  restaurantSlug: string;
  menuSlug: string;
  dishId: string;
  dishSlug: string;
  existingMetadata: unknown;
  sourceBytes: Buffer;
  originalName?: string;
};

type MeshyManifest = {
  kind?: string;
  restaurantSlug?: string;
  menuSlug?: string;
  dishSlug?: string;
  version?: string;
  sourceFile?: string;
  assets?: {
    model3dUrl?: string;
    webModel3dUrl?: string;
    arModel3dUrl?: string;
    arUsdzUrl?: string;
  };
  sha256?: {
    meshy?: string;
    meshopt?: string;
    arLite?: string;
    arUsdz?: string;
  };
};

type PipelineRunResult = {
  ok: true;
  status: "ready";
  jobId: string;
  manifest: MeshyManifest;
  manifestPath: string;
  manifestUrl: string;
  model3dUrl: string;
  webModel3dUrl: string;
  arModel3dUrl: string;
  arUsdzUrl: string;
};

function getMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function assertSafeSlug(value: string, label: string): string {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${label} invalide pour le pipeline Meshy.`);
  }
  return slug;
}

function relativeForScript(path: string): string {
  return relative(PROJECT_ROOT, path).replaceAll("\\", "/");
}

function dateTag(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

async function runNodeScript(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [PIPELINE_SCRIPT_PATH, ...args], {
      cwd: PROJECT_ROOT,
      env: process.env,
      windowsHide: true
    });
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Pipeline Meshy trop long: ${PIPELINE_SCRIPT_RELATIVE_PATH}.`));
    }, PIPELINE_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(output.trim() || `Pipeline Meshy echoue: ${PIPELINE_SCRIPT_RELATIVE_PATH}.`));
      }
    });
  });
}

function manifestPathFor(args: {
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
  versionTag: string;
}): string {
  return join(
    PROJECT_ROOT,
    "public",
    "models",
    "restaurants",
    args.restaurantSlug,
    args.menuSlug,
    args.dishSlug,
    `meshy-${args.versionTag}`,
    "manifest.json"
  );
}

function readManifest(manifestPath: string): MeshyManifest {
  if (!existsSync(manifestPath)) {
    throw new Error("Manifest Meshy introuvable apres generation.");
  }
  return JSON.parse(readFileSync(manifestPath, "utf8")) as MeshyManifest;
}

function cleanManifestAssets(manifest: MeshyManifest) {
  const model3dUrl = manifest.assets?.model3dUrl?.trim() ?? "";
  const webModel3dUrl = manifest.assets?.webModel3dUrl?.trim() ?? "";
  const arModel3dUrl = manifest.assets?.arModel3dUrl?.trim() ?? "";
  const arUsdzUrl = manifest.assets?.arUsdzUrl?.trim() ?? "";
  for (const url of [model3dUrl, webModel3dUrl, arModel3dUrl, arUsdzUrl]) {
    if (!url.startsWith("/models/restaurants/") || url.includes("..") || url.includes("\\")) {
      throw new Error("Manifest Meshy contient une URL modele invalide.");
    }
  }
  if (!webModel3dUrl || !arUsdzUrl) {
    throw new Error("Manifest Meshy incomplet: GLB web ou USDZ manquant.");
  }
  return { model3dUrl, webModel3dUrl, arModel3dUrl, arUsdzUrl };
}

export async function runRestaurantMeshyDishPipeline(
  args: RestaurantMeshyPipelineArgs
): Promise<PipelineRunResult> {
  const restaurantSlug = assertSafeSlug(args.restaurantSlug, "Slug restaurant");
  const menuSlug = assertSafeSlug(args.menuSlug || "principal", "Slug menu");
  const dishSlug = assertSafeSlug(args.dishSlug, "Slug plat");
  const versionTag = dateTag();
  const jobId = `job_meshy_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const tempDir = join(TEMP_UPLOAD_ROOT, restaurantSlug, dishSlug, jobId);
  const tempSourcePath = join(tempDir, `${dishSlug}-source.glb`);
  const sourceSha256 = sha256Hex(args.sourceBytes);
  const startedAt = new Date();

  mkdirSync(tempDir, { recursive: true });
  writeFileSync(tempSourcePath, args.sourceBytes);

  try {
    await runNodeScript([
      "--restaurant",
      restaurantSlug,
      "--menu",
      menuSlug,
      "--dish",
      dishSlug,
      "--source",
      relativeForScript(tempSourcePath),
      "--date",
      versionTag
    ]);

    const manifestPath = manifestPathFor({ restaurantSlug, menuSlug, dishSlug, versionTag });
    const manifest = readManifest(manifestPath);
    const assets = cleanManifestAssets(manifest);
    const manifestRelativePath = relativeForScript(manifestPath);
    const nextMetadata = {
      ...getMetadata(args.existingMetadata),
      model3dUrl: assets.model3dUrl || assets.webModel3dUrl,
      webModel3dUrl: assets.webModel3dUrl,
      arModel3dUrl: assets.arModel3dUrl,
      arUsdzUrl: assets.arUsdzUrl,
      usdzUrl: "",
      modelStatus: "ready",
      meshyManifestVersion: manifest.version ?? `meshy-${versionTag}`,
      meshyManifestPath: manifestRelativePath,
      preparedGlbBytes: args.sourceBytes.byteLength,
      preparedGlbSha256: sourceSha256,
      preparedGlbOriginalName: args.originalName ?? "",
      ownerMeshyPipeline: true
    };

    const updated = await args.adminClient
      .from("menu_dishes")
      .update({
        has_immersive_view: true,
        metadata: nextMetadata
      })
      .eq("id", args.dishId)
      .eq("restaurant_id", args.restaurantId)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) {
      throw new Error("Plat impossible a mettre a jour avec les URLs Meshy.");
    }

    const finishedAt = new Date();
    const manualRunnerCommand = [
      "node",
      PIPELINE_SCRIPT_RELATIVE_PATH,
      "--restaurant",
      restaurantSlug,
      "--menu",
      menuSlug,
      "--dish",
      dishSlug,
      "--source",
      relativeForScript(tempSourcePath),
      "--date",
      versionTag
    ].join(" ");
    const insertedJob = await args.adminClient.from("owner_3d_pipeline_jobs").insert({
      id: jobId,
      restaurant_slug: restaurantSlug,
      menu_slug: menuSlug,
      dish_slug: dishSlug,
      asset_version: manifest.version ?? `meshy-${versionTag}`,
      step: "prepared_usdz",
      status: "published",
      logs: [
        "Owner GLB uploaded.",
        "Meshy restaurant pipeline generated web GLB, AR-lite GLB, and iOS USDZ.",
        "menu_dishes metadata was updated with final public asset URLs."
      ],
      step_logs: [],
      artifacts: [
        {
          id: `${jobId}_source_glb`,
          type: "source_glb",
          label: "Owner source GLB",
          path: assets.model3dUrl || assets.webModel3dUrl,
          sha256: sourceSha256
        },
        {
          id: `${jobId}_web_glb`,
          type: "web_glb",
          label: "Meshopt web GLB",
          path: assets.webModel3dUrl,
          sha256: manifest.sha256?.meshopt ?? ""
        },
        {
          id: `${jobId}_ar_lite_glb`,
          type: "ar_lite_glb",
          label: "Android AR-lite GLB",
          path: assets.arModel3dUrl,
          sha256: manifest.sha256?.arLite ?? ""
        },
        {
          id: `${jobId}_ios_usdz`,
          type: "ios_usdz",
          label: "iOS Quick Look USDZ",
          path: assets.arUsdzUrl,
          sha256: manifest.sha256?.arUsdz ?? ""
        }
      ],
      metrics: {
        sourceSizeBytes: args.sourceBytes.byteLength,
        sourceSha256,
        conversionMethod: "owner-meshy-pipeline"
      },
      quality_status: "published",
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      initiated_by_clerk_user_id: args.owner.userId,
      initiated_by_email: args.owner.email ?? null,
      next_action: "Review in browser and run real-device iPhone Quick Look QA.",
      manual_runner_command: manualRunnerCommand,
      worker_kind: "external_worker",
      dedupe_key: `${restaurantSlug}:${menuSlug}:${dishSlug}:${manifest.version ?? versionTag}:owner_meshy`,
      metadata: {
        restaurantId: args.restaurantId,
        dishId: args.dishId,
        manifestPath: manifestRelativePath,
        originalName: args.originalName ?? ""
      }
    });
    if (insertedJob.error) {
      throw new Error("Job Meshy impossible a enregistrer dans Supabase.");
    }

    return {
      ok: true,
      status: "ready",
      jobId,
      manifest,
      manifestPath: manifestRelativePath,
      manifestUrl: `/${manifestRelativePath.replace(/^public\//, "")}`,
      model3dUrl: assets.model3dUrl || assets.webModel3dUrl,
      webModel3dUrl: assets.webModel3dUrl,
      arModel3dUrl: assets.arModel3dUrl,
      arUsdzUrl: assets.arUsdzUrl
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    const parent = dirname(tempDir);
    try {
      rmSync(parent, { recursive: false, force: true });
    } catch {
      // Parent still has another upload; leave it.
    }
  }
}
