import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

type CreateOwnerMeshyRuntimeWorkspaceArgs = {
  tempRoot?: string;
  restaurantSlug: string;
  dishSlug: string;
  jobId: string;
};

type ResolveOwnerMeshyAssetPathArgs = {
  outputRoot: string;
  assetRoot: string;
  assetUrl: string;
  localPath?: string;
};

type OwnerMeshyRuntimeWorkspace = {
  rootDir: string;
  outputRoot: string;
  sourceDir: string;
  tempSourcePath: string;
  cleanup: () => void;
};

function assertSafePathSegment(value: string, label: string): string {
  const segment = value.trim();
  if (!segment) {
    throw new Error(`${label} invalide pour le workspace temporaire 3D.`);
  }
  for (const char of segment) {
    const code = char.charCodeAt(0);
    const isDigit = code >= 48 && code <= 57;
    const isUppercaseLetter = code >= 65 && code <= 90;
    const isLowercaseLetter = code >= 97 && code <= 122;
    if (!isDigit && !isUppercaseLetter && !isLowercaseLetter && char !== "_" && char !== "-") {
      throw new Error(`${label} invalide pour le workspace temporaire 3D.`);
    }
  }
  return segment;
}

function isInside(parent: string, child: string): boolean {
  const resolvedParent = resolve(parent);
  const resolvedChild = resolve(child);
  const path = relative(resolvedParent, resolvedChild);
  return path === "" || (!!path && !path.startsWith("..") && !isAbsolute(path));
}

function assertInside(parent: string, child: string, label: string): string {
  const resolved = resolve(child);
  if (!isInside(parent, resolved)) {
    throw new Error(`${label} sort du workspace temporaire 3D.`);
  }
  return resolved;
}

function cleanRelativeAssetPath(path: string): string[] {
  const normalized = path.trim();
  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.includes("\\") ||
    normalized.includes("//") ||
    normalized.includes("?") ||
    normalized.includes("#")
  ) {
    throw new Error("Chemin asset Meshy invalide.");
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Chemin asset Meshy invalide.");
  }
  return segments;
}

export function createOwnerMeshyRuntimeWorkspace(
  args: CreateOwnerMeshyRuntimeWorkspaceArgs
): OwnerMeshyRuntimeWorkspace {
  const restaurantSlug = assertSafePathSegment(args.restaurantSlug, "Slug restaurant");
  const dishSlug = assertSafePathSegment(args.dishSlug, "Slug plat");
  const jobId = assertSafePathSegment(args.jobId, "Job");
  const tempRoot = resolve(args.tempRoot || tmpdir());
  mkdirSync(tempRoot, { recursive: true });

  const rootDir = mkdtempSync(join(tempRoot, "vistaire-owner-meshy-"));
  const outputRoot = join(rootDir, "output");
  const sourceDir = join(rootDir, "uploads", restaurantSlug, dishSlug, jobId);
  const tempSourcePath = join(sourceDir, `${dishSlug}-source.glb`);

  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(sourceDir, { recursive: true });

  return {
    rootDir,
    outputRoot,
    sourceDir,
    tempSourcePath,
    cleanup: () => rmSync(rootDir, { recursive: true, force: true })
  };
}

export function resolveOwnerMeshyAssetPath(args: ResolveOwnerMeshyAssetPathArgs): string {
  const outputRoot = resolve(args.outputRoot);
  const assetRoot = assertInside(outputRoot, args.assetRoot, "Asset root Meshy");

  if (args.localPath?.trim()) {
    if (isAbsolute(args.localPath)) {
      throw new Error("Chemin local Meshy absolu refuse.");
    }
    const segments = cleanRelativeAssetPath(args.localPath);
    return assertInside(assetRoot, join(assetRoot, ...segments), "Asset Meshy");
  }

  const assetUrl = args.assetUrl.trim();
  if (
    !assetUrl.startsWith("/models/restaurants/") ||
    assetUrl.includes("..") ||
    assetUrl.includes("\\") ||
    assetUrl.includes("//") ||
    assetUrl.includes("?") ||
    assetUrl.includes("#")
  ) {
    throw new Error("URL asset Meshy invalide.");
  }

  const segments = cleanRelativeAssetPath(assetUrl.replace(/^\//, ""));
  return assertInside(assetRoot, join(outputRoot, ...segments), "Asset Meshy");
}
