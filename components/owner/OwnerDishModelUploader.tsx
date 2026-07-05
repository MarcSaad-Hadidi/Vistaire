"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { formatModelAssetBytes } from "@/lib/owner/modelAssetSize";
import {
  createOwnerDishModelUploadQueue,
  type OwnerDishModelUploadQueueState
} from "@/lib/owner/ownerDishModelUploadQueue";
import {
  USDZ_DISH_KIND_OPTIONS,
  resolveUsdzDishKindPreset,
  type UsdzDishKindPreset
} from "@/lib/owner/usdzDishKind";

export type UsdzOptimizationProfileOption = "premium" | "balanced" | "light" | "emergency";

type OwnerDishModelUploaderProps = {
  restaurantId: string;
  dishId: string;
  dishName?: string;
  category?: string;
  initialStatus?: string;
  initialWebModel3dUrl?: string;
  initialWebModel3dBytes?: number;
  initialViewerGlbStatus?: string;
  initialArUsdzUrl?: string;
  initialArUsdzBytes?: number;
  initialUsdzRuntimeStatus?: string;
  initialUsdzOptimizationRequestedProfile?: string;
  initialUsdzOptimizationProfile?: string;
  initialUsdzOptimizationSelectedRecipe?: string;
  initialUsdzOptimizationProfileFallbackApplied?: boolean;
  initialUsdzOptimizationRecipeFallbackApplied?: boolean;
  initialUsdzGeometryOptimization?: string;
  initialUsdzTriangleCountBefore?: number;
  initialUsdzTriangleCountAfter?: number;
  initialUsdzGeometryReductionPercent?: number;
  initialUsdzPhysicalScaleStatus?: string;
  initialUsdzPhysicalScaleDishKind?: string;
  initialUsdzPhysicalScaleDimension?: string;
  initialUsdzPhysicalScaleHeightAfterMeters?: number;
  initialUsdzPhysicalScaleWidthAfterMeters?: number;
  initialUsdzPhysicalScaleDepthAfterMeters?: number;
  initialUsdzPhysicalScaleFootprintAfterMeters?: number;
  initialUsdzPhysicalScaleScaleFactor?: number;
  initialUsdzPhysicalScaleWarnings?: string[];
  initialUsdzOptimizationAttemptCount?: number;
  initialUsdzChangedTextures?: number;
  initialUsdzSourceBytes?: number;
  initialUsdzSourceOriginalName?: string;
  initialQuickLookQaStatus?: string;
};

type ViewerUploadPayload = {
  ok?: boolean;
  error?: string;
  status?: string;
  modelStatus?: string;
  version?: string;
  webModel3dUrl?: string;
  arModel3dUrl?: string;
  viewerGlbBytes?: number;
  usdzTriggered?: boolean;
  job?: { id?: string };
};

type UsdzRuntimePayload = {
  ok?: boolean;
  error?: string;
  failureKind?: string;
  stage?: string;
  selectedCandidate?: unknown;
  candidateAttempts?: UsdzOptimizationAttemptPayload[];
  attempts?: UsdzOptimizationAttemptPayload[];
  status?: string;
  version?: string;
  arUsdzUrl?: string;
  usdzRuntimeBytes?: number;
  usdzSourceBytes?: number;
  usdzSourceStored?: boolean;
  reductionPercent?: number;
  profile?: string;
  requestedProfile?: string;
  selectedProfile?: string;
  selectedRecipe?: string;
  profileFallbackApplied?: boolean;
  recipeFallbackApplied?: boolean;
  geometryOptimization?: string;
  triangleCountBefore?: number;
  triangleCountAfter?: number;
  geometryReductionPercent?: number;
  physicalScale?: UsdzPhysicalScalePayload | null;
  attemptCount?: number;
  textureCount?: number;
  changedTextures?: number;
  quickLookQaStatus?: string;
  warnings?: string[];
  fails?: string[];
  job?: { id?: string };
};

type UsdzOptimizationAttemptPayload = {
  profile?: string;
  stage?: string;
  error?: string;
  runtimeBytes?: number;
  targetBytes?: number;
  passedBudget?: boolean;
  recipe?: string;
  selectedRecipe?: string;
  fails?: string[];
  physicalScale?: { status?: string } | null;
};

type UsdzPhysicalScalePayload = {
  status?: string;
  dishKind?: string;
  dimension?: string;
  heightAfterMeters?: number;
  widthAfterMeters?: number;
  depthAfterMeters?: number;
  footprintAfterMeters?: number;
  scaleFactor?: number;
  warnings?: string[];
};

type UsdzRuntimeStartPayload = {
  ok?: boolean;
  error?: string;
  jobId?: string;
  jobToken?: string;
  profile?: string;
  endpoints?: {
    prepareUpload?: string;
    complete?: string;
    fail?: string;
  };
};

type DeletePayload = {
  ok?: boolean;
  error?: string;
  target?: string;
  modelDeleted?: boolean;
  modelStatus?: string;
};

const PROFILE_OPTIONS: { value: UsdzOptimizationProfileOption; label: string }[] = [
  { value: "premium", label: "Premium (24 MB max)" },
  { value: "balanced", label: "Balanced (16 MB max)" },
  { value: "light", label: "Light mobile safe (10 MB max)" },
  { value: "emergency", label: "Emergency 6 MB (fallback agressif)" }
];

const LOCAL_USDZ_WORKER_URL =
  process.env.NEXT_PUBLIC_USDZ_WORKER_URL || "http://127.0.0.1:8787";
const REQUIRED_USDZ_WORKER_VERSION = 3;
const REQUIRED_USDZ_WORKER_CAPABILITY = "physicalScaleNormalization";

function isProfileOption(value: string): value is UsdzOptimizationProfileOption {
  return value === "premium" || value === "balanced" || value === "light" || value === "emergency";
}

function isDishKindPreset(value: string): value is UsdzDishKindPreset {
  return USDZ_DISH_KIND_OPTIONS.some((option) => option.value === value);
}

function reductionPercent(sourceBytes: number, runtimeBytes: number): number {
  if (sourceBytes <= 0 || runtimeBytes <= 0) return 0;
  return Math.max(0, Math.round((1 - runtimeBytes / sourceBytes) * 100));
}

function formatScaleCentimeters(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${Math.round(value * 100)} cm`;
}

function physicalScaleSizeLabel(args: {
  dimension: string;
  heightMeters: number;
  widthMeters: number;
  depthMeters: number;
  footprintMeters: number;
}): string {
  if (args.dimension === "footprint") {
    const footprint = formatScaleCentimeters(args.footprintMeters || Math.max(args.widthMeters, args.depthMeters));
    const width = formatScaleCentimeters(args.widthMeters);
    const depth = formatScaleCentimeters(args.depthMeters);
    return [
      footprint ? `Footprint ${footprint}` : "",
      width ? `Width ${width}` : "",
      depth ? `Depth ${depth}` : ""
    ]
      .filter(Boolean)
      .join(" Â· ");
  }

  const dimension = args.dimension === "height" ? "Height" : "Width";
  const meters = args.dimension === "height" ? args.heightMeters : args.widthMeters;
  const primary = formatScaleCentimeters(meters);
  const depth = formatScaleCentimeters(args.depthMeters);
  return [primary ? `${dimension} ${primary}` : "", depth ? `Depth ${depth}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function physicalScaleStatusLabel(status: string): string {
  if (status === "normalized") return "Scale normalized";
  if (status === "unchanged") return "Scale unchanged";
  return `Scale ${status}`;
}

function dedupeWarnings(...warnings: string[][]): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const list of warnings) {
    for (const warning of list) {
      const value = String(warning ?? "").trim();
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      values.push(value);
    }
  }
  return values;
}

function dishKindLabel(value: string): string {
  return USDZ_DISH_KIND_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function profileLabel(value: string): string {
  return PROFILE_OPTIONS.find((option) => option.value === value)?.label.split(" ")[0] ?? value;
}

function formatUsdzFailureDiagnostic(payload: UsdzRuntimePayload): string {
  const attempts = payload.candidateAttempts || payload.attempts || [];
  const firstAttempts = attempts.slice(0, 2).map((attempt) => {
    const profile = attempt.profile || "profil";
    const recipe = attempt.selectedRecipe || attempt.recipe || "";
    const cause =
      attempt.fails?.[0] ||
      attempt.error ||
      (attempt.physicalScale?.status === "failed" ? "physicalScale failed" : attempt.stage || "failed");
    const budget =
      Number(attempt.runtimeBytes) > 0 && Number(attempt.targetBytes) > 0
        ? ` ${formatModelAssetBytes(Number(attempt.runtimeBytes))}/${formatModelAssetBytes(Number(attempt.targetBytes))}`
        : "";
    return `${profile}${recipe ? ` / ${recipe}` : ""}: ${cause}${budget}`;
  });
  const prefix = [payload.failureKind, payload.stage].filter(Boolean).join(" / ");
  const budgetFailure = payload.failureKind === "byte-budget" || payload.stage === "budget";
  const requestedProfile = payload.profile || payload.requestedProfile || attempts[0]?.profile || "";
  const headline =
    budgetFailure && requestedProfile
      ? `${profileLabel(requestedProfile)} impossible: runtime au-dessus du budget`
      : prefix
        ? `Diagnostic USDZ ${prefix}`
        : "Diagnostic USDZ";
  const attemptLabel =
    attempts.length > 1 ? `${attempts.length} recettes tentees` : attempts.length === 1 ? "1 recette tentee" : "";
  return [prefix ? `Diagnostic USDZ ${prefix}` : "Diagnostic USDZ", attemptLabel, ...firstAttempts]
    .filter(Boolean)
    .map((entry, index) => (index === 0 ? headline : entry))
    .join(" - ");
}

type QueueUploadArgs = {
  dishId: string;
  run: () => Promise<void>;
  onQueued?: () => void;
  onStart?: () => void;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
};

type OwnerDishModelUploadQueueContextValue = {
  states: Record<string, OwnerDishModelUploadQueueState>;
  enqueueUpload: (args: QueueUploadArgs) => Promise<void>;
};

const OwnerDishModelUploadQueueContext =
  createContext<OwnerDishModelUploadQueueContextValue | null>(null);

export function OwnerDishModelUploadQueueProvider({
  children
}: {
  children: ReactNode;
}) {
  const [queue] = useState(() => createOwnerDishModelUploadQueue());
  const [states, setStates] = useState<Record<string, OwnerDishModelUploadQueueState>>(
    {}
  );

  const setDishState = useCallback(
    (dishId: string, state: OwnerDishModelUploadQueueState) => {
      setStates((current) => ({ ...current, [dishId]: state }));
    },
    []
  );

  const enqueueUpload = useCallback(
    ({
      dishId,
      run,
      onQueued,
      onStart,
      onSuccess,
      onError,
      onSettled
    }: QueueUploadArgs) =>
      queue.enqueue({
        dishId,
        run,
        onQueued: () => {
          setDishState(dishId, "queued");
          onQueued?.();
        },
        onStart: () => {
          setDishState(dishId, "running");
          onStart?.();
        },
        onSuccess: () => {
          setDishState(dishId, "success");
          onSuccess?.();
        },
        onError: (error) => {
          setDishState(dishId, "error");
          onError?.(error);
        },
        onSettled
      }),
    [queue, setDishState]
  );

  const value = useMemo(
    () => ({ states, enqueueUpload }),
    [enqueueUpload, states]
  );

  return (
    <OwnerDishModelUploadQueueContext.Provider value={value}>
      {children}
    </OwnerDishModelUploadQueueContext.Provider>
  );
}

function buildDownloadFileName(dishName: string | undefined, extension: "glb" | "usdz"): string {
  const normalized = (dishName?.trim() || `vistaire-${extension}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${slug || `vistaire-${extension}`}.${extension}`;
}

type DeleteTarget = "all" | "viewer-glb" | "usdz-runtime" | "report";

export function OwnerDishModelUploader({
  restaurantId,
  dishId,
  dishName,
  category,
  initialWebModel3dUrl = "",
  initialWebModel3dBytes = 0,
  initialArUsdzUrl = "",
  initialArUsdzBytes = 0,
  initialUsdzOptimizationProfile = "balanced",
  initialUsdzOptimizationRequestedProfile = initialUsdzOptimizationProfile,
  initialUsdzOptimizationSelectedRecipe = "",
  initialUsdzOptimizationProfileFallbackApplied = false,
  initialUsdzOptimizationRecipeFallbackApplied = false,
  initialUsdzGeometryOptimization = "",
  initialUsdzTriangleCountBefore = 0,
  initialUsdzTriangleCountAfter = 0,
  initialUsdzGeometryReductionPercent = 0,
  initialUsdzPhysicalScaleStatus = "",
  initialUsdzPhysicalScaleDishKind = "",
  initialUsdzPhysicalScaleDimension = "",
  initialUsdzPhysicalScaleHeightAfterMeters = 0,
  initialUsdzPhysicalScaleWidthAfterMeters = 0,
  initialUsdzPhysicalScaleDepthAfterMeters = 0,
  initialUsdzPhysicalScaleFootprintAfterMeters = 0,
  initialUsdzPhysicalScaleScaleFactor = 1,
  initialUsdzPhysicalScaleWarnings = [],
  initialUsdzOptimizationAttemptCount = 0,
  initialUsdzChangedTextures = 0,
  initialUsdzSourceBytes = 0,
  initialUsdzSourceOriginalName = "",
  initialQuickLookQaStatus = ""
}: OwnerDishModelUploaderProps) {
  const router = useRouter();
  const uploadQueue = useContext(OwnerDishModelUploadQueueContext);
  const glbInputRef = useRef<HTMLInputElement | null>(null);
  const usdzInputRef = useRef<HTMLInputElement | null>(null);

  const [webModel3dUrl, setWebModel3dUrl] = useState(initialWebModel3dUrl);
  const [webModel3dBytes, setWebModel3dBytes] = useState(initialWebModel3dBytes);
  const [arUsdzUrl, setArUsdzUrl] = useState(initialArUsdzUrl);
  const [arUsdzBytes, setArUsdzBytes] = useState(initialArUsdzBytes);
  const [usdzSourceBytes, setUsdzSourceBytes] = useState(initialUsdzSourceBytes);
  const [usdzSourceOriginalName, setUsdzSourceOriginalName] = useState(
    initialUsdzSourceOriginalName
  );
  const [quickLookQaStatus, setQuickLookQaStatus] = useState(
    initialQuickLookQaStatus || (initialArUsdzUrl ? "not-tested" : "")
  );
  const [profile, setProfile] = useState<UsdzOptimizationProfileOption>(
    isProfileOption(initialUsdzOptimizationRequestedProfile)
      ? initialUsdzOptimizationRequestedProfile
      : isProfileOption(initialUsdzOptimizationProfile)
        ? initialUsdzOptimizationProfile
        : "balanced"
  );
  const [runtimeProfile, setRuntimeProfile] = useState<UsdzOptimizationProfileOption>(
    isProfileOption(initialUsdzOptimizationProfile) ? initialUsdzOptimizationProfile : "balanced"
  );
  const [runtimeRequestedProfile, setRuntimeRequestedProfile] = useState<UsdzOptimizationProfileOption>(
    isProfileOption(initialUsdzOptimizationRequestedProfile)
      ? initialUsdzOptimizationRequestedProfile
      : isProfileOption(initialUsdzOptimizationProfile)
        ? initialUsdzOptimizationProfile
        : "balanced"
  );
  const [selectedRecipe, setSelectedRecipe] = useState(initialUsdzOptimizationSelectedRecipe);
  const [profileFallbackApplied, setProfileFallbackApplied] = useState(
    initialUsdzOptimizationProfileFallbackApplied
  );
  const [recipeFallbackApplied, setRecipeFallbackApplied] = useState(
    initialUsdzOptimizationRecipeFallbackApplied
  );
  const [selectedDishKindPreset, setSelectedDishKindPreset] =
    useState<UsdzDishKindPreset>("auto");
  const [workerStatus, setWorkerStatus] = useState<"checking" | "available" | "missing">(
    "checking"
  );
  const [geometryOptimization, setGeometryOptimization] = useState(
    initialUsdzGeometryOptimization
  );
  const [triangleCountBefore, setTriangleCountBefore] = useState(
    initialUsdzTriangleCountBefore
  );
  const [triangleCountAfter, setTriangleCountAfter] = useState(
    initialUsdzTriangleCountAfter
  );
  const [geometryReduction, setGeometryReduction] = useState(
    initialUsdzGeometryReductionPercent
  );
  const [physicalScaleStatus, setPhysicalScaleStatus] = useState(
    initialUsdzPhysicalScaleStatus
  );
  const [physicalScaleDishKind, setPhysicalScaleDishKind] = useState(
    initialUsdzPhysicalScaleDishKind
  );
  const [physicalScaleDimension, setPhysicalScaleDimension] = useState(
    initialUsdzPhysicalScaleDimension
  );
  const [physicalScaleHeightMeters, setPhysicalScaleHeightMeters] = useState(
    initialUsdzPhysicalScaleHeightAfterMeters
  );
  const [physicalScaleWidthMeters, setPhysicalScaleWidthMeters] = useState(
    initialUsdzPhysicalScaleWidthAfterMeters
  );
  const [physicalScaleDepthMeters, setPhysicalScaleDepthMeters] = useState(
    initialUsdzPhysicalScaleDepthAfterMeters
  );
  const [physicalScaleFootprintMeters, setPhysicalScaleFootprintMeters] = useState(
    initialUsdzPhysicalScaleFootprintAfterMeters
  );
  const [physicalScaleFactor, setPhysicalScaleFactor] = useState(
    initialUsdzPhysicalScaleScaleFactor
  );
  const [physicalScaleWarnings, setPhysicalScaleWarnings] = useState(
    initialUsdzPhysicalScaleWarnings
  );
  const [attemptCount, setAttemptCount] = useState(initialUsdzOptimizationAttemptCount);
  const [changedTextures, setChangedTextures] = useState(initialUsdzChangedTextures);
  const [lastWarnings, setLastWarnings] = useState<string[]>(initialUsdzPhysicalScaleWarnings);
  const [lastFailureDiagnostic, setLastFailureDiagnostic] = useState("");

  const [localQueueState, setLocalQueueState] = useState<OwnerDishModelUploadQueueState>("idle");
  const [activeUpload, setActiveUpload] = useState<"" | "viewer-glb" | "usdz-runtime">("");
  const [deletingTarget, setDeletingTarget] = useState<DeleteTarget | "">("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const queueState = uploadQueue?.states[dishId] ?? localQueueState;
  const isUploading = queueState === "running";
  const isUploadQueued = queueState === "queued";
  const isBusy = isUploading || isUploadQueued || deletingTarget !== "";
  const dishLabel = dishName?.trim() || "ce plat";
  const glbFileName = buildDownloadFileName(dishName, "glb");
  const usdzFileName = buildDownloadFileName(dishName, "usdz");
  const hasViewer = Boolean(webModel3dUrl);
  const hasUsdz = Boolean(arUsdzUrl);
  const savings = reductionPercent(usdzSourceBytes, arUsdzBytes);
  const physicalScaleSize = physicalScaleSizeLabel({
    dimension: physicalScaleDimension,
    heightMeters: physicalScaleHeightMeters,
    widthMeters: physicalScaleWidthMeters,
    depthMeters: physicalScaleDepthMeters,
    footprintMeters: physicalScaleFootprintMeters
  });
  const physicalScaleFootprintLabel = formatScaleCentimeters(physicalScaleFootprintMeters);
  const visibleWarnings = dedupeWarnings(physicalScaleWarnings, lastWarnings);
  const workerStatusLabel =
    workerStatus === "available"
      ? "Worker local detecte"
      : workerStatus === "checking"
        ? "Detection du worker local..."
        : "Worker local manquant";
  const workerHint =
    workerStatus === "available"
      ? "Le master USDZ sera envoye au worker local, pas a Vercel."
      : "Lance npm run owner:usdz-worker puis reessayez.";

  const statusLabel = (() => {
    if (isUploadQueued) return "En file...";
    if (isUploading) {
      return activeUpload === "usdz-runtime" ? "Optimisation USDZ..." : "Upload GLB...";
    }
    if (message) return message;
    if (hasViewer && hasUsdz) return "GLB viewer + USDZ runtime prets";
    if (hasViewer) return "GLB viewer pret, USDZ runtime manquant";
    if (hasUsdz) return "USDZ runtime pret, GLB viewer manquant";
    return "Aucun modele";
  })();

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1500);
    fetch(`${LOCAL_USDZ_WORKER_URL}/health`, {
      method: "GET",
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          version?: number;
          capabilities?: string[];
        };
        const hasPhysicalScaleCapability =
          Number(payload.version) >= REQUIRED_USDZ_WORKER_VERSION &&
          Array.isArray(payload.capabilities) &&
          payload.capabilities.includes(REQUIRED_USDZ_WORKER_CAPABILITY);
        setWorkerStatus(response.ok && payload.ok && hasPhysicalScaleCapability ? "available" : "missing");
      })
      .catch(() => setWorkerStatus("missing"))
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  async function runViewerUpload(file: File) {
    setError("");
    setMessage("");
    setLastFailureDiagnostic("");
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(
      `/api/owner/restaurants/${encodeURIComponent(restaurantId)}/dishes/${encodeURIComponent(dishId)}/model/viewer-glb`,
      { method: "POST", body: formData }
    );
    const payload = (await response.json().catch(() => ({}))) as ViewerUploadPayload;
    if (!response.ok || !payload.ok || !payload.webModel3dUrl) {
      throw new Error(payload.error || "Upload du GLB viewer impossible.");
    }
    setWebModel3dUrl(payload.webModel3dUrl ?? "");
    setWebModel3dBytes(payload.viewerGlbBytes ?? 0);
    setShowDeleteConfirm(false);
    router.refresh();
  }

  async function runUsdzUpload(file: File) {
    setError("");
    setMessage("");
    if (workerStatus !== "available") {
      throw new Error("Worker local USDZ V3 requis. Relance npm run owner:usdz-worker.");
    }
    const basePath = `/api/owner/restaurants/${encodeURIComponent(restaurantId)}/dishes/${encodeURIComponent(dishId)}/model/usdz-runtime`;
    const startResponse = await fetch(`${basePath}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalName: file.name,
        sourceBytes: file.size,
        profile
      })
    });
    const startPayload = (await startResponse.json().catch(() => ({}))) as UsdzRuntimeStartPayload;
    if (
      !startResponse.ok ||
      !startPayload.ok ||
      !startPayload.jobId ||
      !startPayload.jobToken ||
      !startPayload.endpoints?.prepareUpload ||
      !startPayload.endpoints.complete ||
      !startPayload.endpoints.fail
    ) {
      throw new Error(startPayload.error || "Initialisation USDZ worker impossible.");
    }

    const formData = new FormData();
    const resolvedDishKind = resolveUsdzDishKindPreset({
      selectedPreset: selectedDishKindPreset,
      dishName,
      category
    });
    formData.set("file", file);
    formData.set("profile", startPayload.profile || profile);
    formData.set("jobId", startPayload.jobId);
    formData.set("jobToken", startPayload.jobToken);
    formData.set("dishKind", resolvedDishKind);
    formData.set("apiBaseUrl", window.location.origin);
    formData.set("prepareUploadEndpoint", startPayload.endpoints.prepareUpload);
    formData.set("completeEndpoint", startPayload.endpoints.complete);
    formData.set("failEndpoint", startPayload.endpoints.fail);
    const response = await fetch(`${LOCAL_USDZ_WORKER_URL}/optimize-usdz`, {
      method: "POST",
      body: formData
    });
    const payload = (await response.json().catch(() => ({}))) as UsdzRuntimePayload;
    if (!response.ok || !payload.ok || !payload.arUsdzUrl) {
      setLastFailureDiagnostic(formatUsdzFailureDiagnostic(payload));
      throw new Error(payload.error || "Optimisation USDZ locale impossible. Aucun fichier stocke.");
    }
    setArUsdzUrl(payload.arUsdzUrl ?? "");
    setArUsdzBytes(payload.usdzRuntimeBytes ?? 0);
    setUsdzSourceBytes(payload.usdzSourceBytes ?? 0);
    setUsdzSourceOriginalName(file.name);
    setQuickLookQaStatus(payload.quickLookQaStatus ?? "not-tested");
    const selectedProfile = payload.selectedProfile || payload.profile || profile;
    const requestedProfile = payload.requestedProfile || payload.profile || profile;
    if (isProfileOption(selectedProfile)) setRuntimeProfile(selectedProfile);
    if (isProfileOption(requestedProfile)) setRuntimeRequestedProfile(requestedProfile);
    setSelectedRecipe(payload.selectedRecipe || "");
    setProfileFallbackApplied(payload.profileFallbackApplied === true);
    setRecipeFallbackApplied(payload.recipeFallbackApplied === true);
    setGeometryOptimization(payload.geometryOptimization ?? "");
    setTriangleCountBefore(payload.triangleCountBefore ?? 0);
    setTriangleCountAfter(payload.triangleCountAfter ?? 0);
    setGeometryReduction(payload.geometryReductionPercent ?? 0);
    setPhysicalScaleStatus(payload.physicalScale?.status ?? "");
    setPhysicalScaleDishKind(payload.physicalScale?.dishKind ?? "");
    setPhysicalScaleDimension(payload.physicalScale?.dimension ?? "");
    setPhysicalScaleHeightMeters(payload.physicalScale?.heightAfterMeters ?? 0);
    setPhysicalScaleWidthMeters(payload.physicalScale?.widthAfterMeters ?? 0);
    setPhysicalScaleDepthMeters(payload.physicalScale?.depthAfterMeters ?? 0);
    setPhysicalScaleFootprintMeters(payload.physicalScale?.footprintAfterMeters ?? 0);
    setPhysicalScaleFactor(payload.physicalScale?.scaleFactor ?? 1);
    setPhysicalScaleWarnings(payload.physicalScale?.warnings ?? []);
    setAttemptCount(payload.attemptCount ?? 0);
    setChangedTextures(payload.changedTextures ?? 0);
    setLastWarnings(dedupeWarnings(payload.physicalScale?.warnings ?? [], payload.warnings ?? []));
    setLastFailureDiagnostic("");
    setShowDeleteConfirm(false);
    router.refresh();
  }

  function enqueue(kind: "viewer-glb" | "usdz-runtime", run: () => Promise<void>, busyLabel: string) {
    const onError = (uploadError: unknown) => {
      setError(uploadError instanceof Error ? uploadError.message : busyLabel);
    };
    const resetInputs = () => {
      if (glbInputRef.current) glbInputRef.current.value = "";
      if (usdzInputRef.current) usdzInputRef.current.value = "";
      setActiveUpload("");
    };

    if (uploadQueue) {
      setLocalQueueState("queued");
      setActiveUpload(kind);
      void uploadQueue
        .enqueueUpload({
          dishId,
          run,
          onQueued: () => {
            setError("");
            setMessage("En file...");
          },
          onStart: () => setMessage(""),
          onSuccess: () =>
            setMessage(kind === "usdz-runtime" ? "Runtime USDZ optimise." : "GLB viewer uploade."),
          onError,
          onSettled: resetInputs
        })
        .catch(() => undefined);
      return;
    }

    setLocalQueueState("running");
    setActiveUpload(kind);
    void (async () => {
      try {
        await run();
        setLocalQueueState("success");
        setMessage(kind === "usdz-runtime" ? "Runtime USDZ optimise." : "GLB viewer uploade.");
      } catch (uploadError) {
        setLocalQueueState("error");
        onError(uploadError);
      } finally {
        resetInputs();
      }
    })();
  }

  async function deleteModel(target: DeleteTarget) {
    setDeletingTarget(target);
    setError("");
    setMessage("");
    try {
      const query = target === "all" ? "" : `?target=${target}`;
      const response = await fetch(
        `/api/owner/restaurants/${encodeURIComponent(restaurantId)}/dishes/${encodeURIComponent(dishId)}/model${query}`,
        { method: "DELETE" }
      );
      const payload = (await response.json().catch(() => ({}))) as DeletePayload;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Suppression impossible.");
      }
      if (target === "all" || target === "viewer-glb") {
        setWebModel3dUrl("");
        setWebModel3dBytes(0);
      }
      if (target === "all" || target === "usdz-runtime") {
        setArUsdzUrl("");
        setArUsdzBytes(0);
        setUsdzSourceBytes(0);
        setUsdzSourceOriginalName("");
        setQuickLookQaStatus("");
        setRuntimeProfile(profile);
        setRuntimeRequestedProfile(profile);
        setProfileFallbackApplied(false);
        setPhysicalScaleStatus("");
        setPhysicalScaleDishKind("");
        setPhysicalScaleDimension("");
        setPhysicalScaleHeightMeters(0);
        setPhysicalScaleWidthMeters(0);
        setPhysicalScaleDepthMeters(0);
        setPhysicalScaleFootprintMeters(0);
        setPhysicalScaleFactor(1);
        setPhysicalScaleWarnings([]);
        setLastWarnings([]);
      }
      setShowDeleteConfirm(false);
      setMessage(payload.modelDeleted ? "Supprime." : "Rien a supprimer.");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
    } finally {
      setDeletingTarget("");
    }
  }

  return (
    <div className={styles.modelSplitUploader}>
      <input
        ref={glbInputRef}
        type="file"
        accept=".glb,model/gltf-binary"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) enqueue("viewer-glb", () => runViewerUpload(file), "Upload du GLB viewer impossible.");
        }}
      />
      <input
        ref={usdzInputRef}
        type="file"
        accept=".usdz,model/vnd.usdz+zip"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) enqueue("usdz-runtime", () => runUsdzUpload(file), "Optimisation USDZ impossible.");
        }}
      />

      <div className={styles.modelUploadZones}>
        <div className={styles.modelUploadZone}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}
            disabled={isBusy}
            onClick={() => glbInputRef.current?.click()}
          >
            {isUploading && activeUpload === "viewer-glb"
              ? "Upload GLB..."
              : hasViewer
                ? "Remplacer GLB viewer"
                : "Uploader GLB viewer"}
          </button>
          <span className={styles.modelUploadHint}>
            GLB deja optimise pour la vue 3D web. Ne genere pas d’USDZ.
          </span>
          {hasViewer ? (
            <div className={styles.modelStatChips}>
              <span className={styles.cellSub}>
                GLB public · {formatModelAssetBytes(webModel3dBytes)}
              </span>
              <a
                className={`${styles.btn} ${styles.btnSmall}`}
                href={webModel3dUrl}
                download={glbFileName}
                type="model/gltf-binary"
                aria-label={`Telecharger le GLB viewer pour ${dishLabel}`}
              >
                Telecharger GLB
              </a>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                disabled={isBusy}
                onClick={() => void deleteModel("viewer-glb")}
              >
                {deletingTarget === "viewer-glb" ? "..." : "Supprimer GLB viewer"}
              </button>
            </div>
          ) : null}
        </div>

        <div className={styles.modelUploadZone}>
          <label className={styles.fieldLabel} htmlFor={`usdz-profile-${dishId}`}>
            Profil d’optimisation USDZ
          </label>
          <select
            id={`usdz-profile-${dishId}`}
            className={styles.select}
            value={profile}
            disabled={isBusy}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (isProfileOption(value)) setProfile(value);
            }}
          >
            {PROFILE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className={styles.fieldLabel} htmlFor={`usdz-dish-kind-${dishId}`}>
            AR size preset
          </label>
          <select
            id={`usdz-dish-kind-${dishId}`}
            className={styles.select}
            aria-label="AR size preset: Burger / Sandwich, Plateau / Sharing, Fallback / Generique"
            value={selectedDishKindPreset}
            disabled={isBusy}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (isDishKindPreset(value)) setSelectedDishKindPreset(value);
            }}
          >
            {USDZ_DISH_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}
            disabled={isBusy}
            onClick={() => usdzInputRef.current?.click()}
          >
            {isUploading && activeUpload === "usdz-runtime"
              ? "Optimisation USDZ..."
              : hasUsdz
                ? "Remplacer USDZ master"
                : "Uploader USDZ master"}
          </button>
          <span className={styles.modelUploadHint}>
            {workerStatusLabel}. {workerHint}
          </span>
          <span className={styles.modelUploadHint}>
            USDZ source haute qualite traite temporairement. Vistaire ne stocke que
            l’USDZ optimise final. Le master n’est jamais stocke.
          </span>
          {hasUsdz ? (
            <div className={styles.modelStatChips}>
              <span className={styles.cellSub}>
                USDZ runtime · {formatModelAssetBytes(arUsdzBytes)}
                {usdzSourceBytes > 0
                  ? ` · source traitee ${formatModelAssetBytes(usdzSourceBytes)}${savings > 0 ? ` · -${savings}%` : ""}`
                  : ""}
              </span>
              <span className={`${styles.badge} ${styles.badgeWarn}`}>Source USDZ non stockee</span>
              <span className={`${styles.badge} ${styles.badgeWarn}`}>
                Quick Look QA {quickLookQaStatus || "not-tested"}
              </span>
              <span className={styles.cellSub}>Profil runtime: {profileLabel(runtimeProfile)}</span>
              <span className={styles.cellSub}>Profil demande: {profileLabel(runtimeRequestedProfile)}</span>
              {selectedRecipe ? (
                <span className={styles.cellSub}>Recette runtime: {selectedRecipe}</span>
              ) : null}
              {profileFallbackApplied ? (
                <span className={styles.cellSub}>
                  Fallback profil applique: {profileLabel(runtimeRequestedProfile)} -&gt;{" "}
                  {profileLabel(runtimeProfile)}
                </span>
              ) : null}
              {recipeFallbackApplied && selectedRecipe ? (
                <span className={styles.cellSub}>
                  Fallback recette applique: {profileLabel(runtimeRequestedProfile)} -&gt;{" "}
                  {selectedRecipe}
                </span>
              ) : null}
              {geometryOptimization ? (
                <span className={`${styles.badge} ${styles.badgeWarn}`}>
                  Geometry {geometryOptimization}
                </span>
              ) : null}
              {triangleCountBefore > 0 || triangleCountAfter > 0 ? (
                <span className={styles.cellSub}>
                  Triangles {triangleCountBefore.toLocaleString("fr-CA")} -&gt;{" "}
                  {triangleCountAfter.toLocaleString("fr-CA")}
                  {geometryReduction > 0 ? ` · -${Math.round(geometryReduction)}%` : ""}
                </span>
              ) : null}
              {physicalScaleStatus ? (
                <span className={`${styles.badge} ${styles.badgeWarn}`}>
                  {physicalScaleStatusLabel(physicalScaleStatus)}
                </span>
              ) : null}
              {physicalScaleDishKind ? (
                <span className={styles.cellSub}>Type de plat: {physicalScaleDishKind}</span>
              ) : null}
              {physicalScaleDishKind ? (
                <span className={styles.cellSub}>
                  AR scale preset: {dishKindLabel(physicalScaleDishKind)}
                </span>
              ) : null}
              {physicalScaleSize ? (
                <span className={styles.cellSub}>Taille finale: {physicalScaleSize}</span>
              ) : null}
              {physicalScaleFootprintLabel && physicalScaleDimension !== "footprint" ? (
                <span className={styles.cellSub}>Footprint AR: {physicalScaleFootprintLabel}</span>
              ) : null}
              {physicalScaleDishKind === "fallback" ? (
                <span className={styles.cellSub}>Fallback scale utilise</span>
              ) : null}
              {physicalScaleFactor && physicalScaleFactor !== 1 ? (
                <span className={styles.cellSub}>Scale factor: {physicalScaleFactor.toFixed(2)}</span>
              ) : null}
              {attemptCount > 0 ? (
                <span className={styles.cellSub}>Attempts: {attemptCount}</span>
              ) : null}
              {changedTextures > 0 ? (
                <span className={styles.cellSub}>Textures optimisees: {changedTextures}</span>
              ) : null}
              {visibleWarnings.length > 0 ? (
                <span className={styles.cellSub}>Warnings: {visibleWarnings.slice(0, 2).join(" · ")}</span>
              ) : null}
              {usdzSourceOriginalName ? (
                <span className={styles.cellSub}>Master: {usdzSourceOriginalName}</span>
              ) : null}
              <a
                className={`${styles.btn} ${styles.btnSmall}`}
                href={arUsdzUrl}
                download={usdzFileName}
                type="model/vnd.usdz+zip"
                aria-label={`Telecharger l'USDZ runtime optimise pour ${dishLabel}`}
              >
                Telecharger USDZ runtime
              </a>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                disabled={isBusy}
                onClick={() => void deleteModel("usdz-runtime")}
              >
                {deletingTarget === "usdz-runtime" ? "..." : "Supprimer USDZ runtime"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.tableActions}>
        <span className={styles.cellSub}>{statusLabel}</span>
        {hasViewer || hasUsdz ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
            disabled={isBusy}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Tout supprimer
          </button>
        ) : null}
      </div>

      {showDeleteConfirm ? (
        <div
          className={styles.modelDeleteConfirm}
          role="alertdialog"
          aria-label="Confirmer la suppression complete du modele 3D"
        >
          <strong>Tout supprimer pour {dishLabel} ?</strong>
          <span>
            Retire le GLB viewer, l’USDZ runtime, l’AR-lite et le rapport
            d’optimisation du menu public. Aucun master USDZ n’est stocke, il n’y a
            donc rien d’autre a supprimer.
          </span>
          <div className={styles.tableActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSmall}`}
              disabled={deletingTarget !== ""}
              onClick={() => setShowDeleteConfirm(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
              disabled={deletingTarget !== ""}
              onClick={() => void deleteModel("all")}
            >
              {deletingTarget === "all" ? "Suppression..." : "Tout supprimer"}
            </button>
          </div>
        </div>
      ) : null}
      {error ? <span className={styles.errorText}>{error}</span> : null}
      {lastFailureDiagnostic ? (
        <span className={styles.cellSub}>{lastFailureDiagnostic}</span>
      ) : null}
    </div>
  );
}
