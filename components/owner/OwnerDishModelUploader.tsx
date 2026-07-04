"use client";

import {
  createContext,
  useCallback,
  useContext,
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

export type UsdzOptimizationProfileOption = "premium" | "balanced" | "light";

type OwnerDishModelUploaderProps = {
  restaurantId: string;
  dishId: string;
  dishName?: string;
  initialStatus?: string;
  initialWebModel3dUrl?: string;
  initialWebModel3dBytes?: number;
  initialViewerGlbStatus?: string;
  initialArUsdzUrl?: string;
  initialArUsdzBytes?: number;
  initialUsdzRuntimeStatus?: string;
  initialUsdzOptimizationProfile?: string;
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
  status?: string;
  version?: string;
  arUsdzUrl?: string;
  usdzRuntimeBytes?: number;
  usdzSourceBytes?: number;
  usdzSourceStored?: boolean;
  reductionPercent?: number;
  profile?: string;
  geometryOptimization?: string;
  quickLookQaStatus?: string;
  warnings?: string[];
  fails?: string[];
  job?: { id?: string };
};

type DeletePayload = {
  ok?: boolean;
  error?: string;
  target?: string;
  modelDeleted?: boolean;
  modelStatus?: string;
};

const PROFILE_OPTIONS: { value: UsdzOptimizationProfileOption; label: string }[] = [
  { value: "premium", label: "Premium (qualite max)" },
  { value: "balanced", label: "Balanced (defaut)" },
  { value: "light", label: "Light (fallback leger)" }
];

function isProfileOption(value: string): value is UsdzOptimizationProfileOption {
  return value === "premium" || value === "balanced" || value === "light";
}

function reductionPercent(sourceBytes: number, runtimeBytes: number): number {
  if (sourceBytes <= 0 || runtimeBytes <= 0) return 0;
  return Math.max(0, Math.round((1 - runtimeBytes / sourceBytes) * 100));
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
  initialWebModel3dUrl = "",
  initialWebModel3dBytes = 0,
  initialArUsdzUrl = "",
  initialArUsdzBytes = 0,
  initialUsdzOptimizationProfile = "balanced",
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
    isProfileOption(initialUsdzOptimizationProfile) ? initialUsdzOptimizationProfile : "balanced"
  );

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

  async function runViewerUpload(file: File) {
    setError("");
    setMessage("");
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
    const formData = new FormData();
    formData.set("file", file);
    formData.set("profile", profile);
    const response = await fetch(
      `/api/owner/restaurants/${encodeURIComponent(restaurantId)}/dishes/${encodeURIComponent(dishId)}/model/usdz-runtime`,
      { method: "POST", body: formData }
    );
    const payload = (await response.json().catch(() => ({}))) as UsdzRuntimePayload;
    if (!response.ok || !payload.ok || !payload.arUsdzUrl) {
      throw new Error(payload.error || "Optimisation USDZ impossible. Aucun fichier stocke.");
    }
    setArUsdzUrl(payload.arUsdzUrl ?? "");
    setArUsdzBytes(payload.usdzRuntimeBytes ?? 0);
    setUsdzSourceBytes(payload.usdzSourceBytes ?? 0);
    setUsdzSourceOriginalName(file.name);
    setQuickLookQaStatus(payload.quickLookQaStatus ?? "not-tested");
    if (payload.profile && isProfileOption(payload.profile)) setProfile(payload.profile);
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
    </div>
  );
}
