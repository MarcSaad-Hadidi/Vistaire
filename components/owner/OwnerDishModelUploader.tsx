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

type OwnerDishModelUploaderProps = {
  restaurantId: string;
  dishId: string;
  dishName?: string;
  initialStatus?: string;
  initialWebModel3dUrl?: string;
  initialWebModel3dBytes?: number;
  initialArUsdzUrl?: string;
  initialArUsdzBytes?: number;
  initialPreparedGlbJobId?: string;
  initialPreparedGlbStoragePath?: string;
};

type UploadPayload = {
  ok?: boolean;
  error?: string;
  status?: string;
  storagePath?: string;
  manifestPath?: string;
  manifestUrl?: string;
  webModel3dUrl?: string;
  arModel3dUrl?: string;
  arUsdzUrl?: string;
  webModel3dBytes?: number;
  arModel3dBytes?: number;
  arUsdzBytes?: number;
  job?: { id?: string };
};

type PublishPayload = {
  ok?: boolean;
  error?: string;
  status?: string;
  storagePath?: string;
  manifestPath?: string;
  webModel3dUrl?: string;
  arModel3dUrl?: string;
  arUsdzUrl?: string;
  webModel3dBytes?: number;
  arModel3dBytes?: number;
  arUsdzBytes?: number;
};

type DeletePayload = {
  ok?: boolean;
  error?: string;
  modelDeleted?: boolean;
  modelStatus?: string;
};

const DELETABLE_MODEL_STATUSES = new Set([
  "ready",
  "web_ready",
  "web_ready_usdz_pending",
  "pending_manual_usdz",
  "usdz_conversion_failed"
]);

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

function buildUsdzDownloadFileName(dishName?: string): string {
  const normalized = (dishName?.trim() || "vistaire-usdz")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${slug || "vistaire-usdz"}.usdz`;
}

export function OwnerDishModelUploader({
  restaurantId,
  dishId,
  dishName,
  initialStatus = "missing",
  initialWebModel3dUrl = "",
  initialWebModel3dBytes = 0,
  initialArUsdzUrl = "",
  initialArUsdzBytes = 0,
  initialPreparedGlbJobId = "",
  initialPreparedGlbStoragePath = ""
}: OwnerDishModelUploaderProps) {
  const router = useRouter();
  const uploadQueue = useContext(OwnerDishModelUploadQueueContext);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState(
    initialWebModel3dUrl && initialArUsdzUrl ? "ready" : initialWebModel3dUrl ? "web_ready" : initialStatus
  );
  const [storagePath, setStoragePath] = useState(initialPreparedGlbStoragePath);
  const [jobId, setJobId] = useState(initialPreparedGlbJobId);
  const [webModel3dUrl, setWebModel3dUrl] = useState(initialWebModel3dUrl);
  const [webModel3dBytes, setWebModel3dBytes] = useState(initialWebModel3dBytes);
  const [arUsdzUrl, setArUsdzUrl] = useState(initialArUsdzUrl);
  const [arUsdzBytes, setArUsdzBytes] = useState(initialArUsdzBytes);
  const [localQueueState, setLocalQueueState] =
    useState<OwnerDishModelUploadQueueState>("idle");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const hasDeletableModel = Boolean(
    webModel3dUrl ||
      arUsdzUrl ||
      storagePath ||
      jobId ||
      DELETABLE_MODEL_STATUSES.has(status)
  );
  const queueState = uploadQueue?.states[dishId] ?? localQueueState;
  const isUploading = queueState === "running";
  const isUploadQueued = queueState === "queued";
  const isUploadBusy = isUploading || isUploadQueued;
  const isBusy = isUploadBusy || isPublishing || isDeleting;
  const dishLabel = dishName?.trim() || "ce plat";
  const usdzDownloadFileName = buildUsdzDownloadFileName(dishName);
  const uploadStatusLabel = isUploadQueued
    ? "En file..."
    : isUploading
      ? "Pipeline..."
      : "";
  const statusLabel =
    uploadStatusLabel || message || (status === "missing" ? "Aucun modèle" : status);

  async function runUpload(file: File) {
    setError("");
    setMessage("");
    setStatus("pipeline_meshy");

    const formData = new FormData();
    formData.set("file", file);

    const response = await fetch(
      `/api/owner/restaurants/${encodeURIComponent(restaurantId)}/dishes/${encodeURIComponent(dishId)}/model/glb`,
      {
        method: "POST",
        body: formData
      }
    );
    const payload = (await response.json().catch(() => ({}))) as UploadPayload;
    if (!response.ok || !payload.ok || !payload.webModel3dUrl || !payload.arUsdzUrl) {
      throw new Error(payload.error || "Pipeline GLB vers USDZ impossible.");
    }

    setStoragePath(payload.storagePath ?? payload.manifestPath ?? "");
    setJobId(payload.job?.id ?? "");
    setStatus(payload.status || "ready");
    setWebModel3dUrl(payload.webModel3dUrl ?? "");
    setWebModel3dBytes(payload.webModel3dBytes ?? 0);
    setArUsdzUrl(payload.arUsdzUrl ?? "");
    setArUsdzBytes(payload.arUsdzBytes ?? 0);
    setShowDeleteConfirm(false);
    router.refresh();
  }

  function handleUploadError(uploadError: unknown) {
    setError(uploadError instanceof Error ? uploadError.message : "Pipeline GLB vers USDZ impossible.");
    setStatus(initialStatus);
  }

  async function upload(file: File) {
    if (uploadQueue) {
      setLocalQueueState("queued");
      void uploadQueue
        .enqueueUpload({
          dishId,
          run: () => runUpload(file),
          onQueued: () => {
            setError("");
            setMessage("En file...");
          },
          onStart: () => {
            setMessage("");
          },
          onSuccess: () => {
            setMessage("Pipeline termine.");
          },
          onError: handleUploadError,
          onSettled: () => {
            if (inputRef.current) inputRef.current.value = "";
          }
        })
        .catch(() => undefined);
      return;
    }

    setLocalQueueState("running");
    try {
      await runUpload(file);
      setLocalQueueState("success");
      setMessage("Pipeline termine.");
    } catch (uploadError) {
      setLocalQueueState("error");
      handleUploadError(uploadError);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function publish() {
    setIsPublishing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/owner/restaurants/${encodeURIComponent(restaurantId)}/dishes/${encodeURIComponent(dishId)}/model/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, sourceStoragePath: storagePath })
        }
      );
      const payload = (await response.json().catch(() => ({}))) as PublishPayload;
      if (!response.ok || !payload.ok || !payload.webModel3dUrl || !payload.arUsdzUrl) {
        throw new Error(payload.error || "Publication 3D impossible.");
      }

      setStoragePath(payload.storagePath ?? payload.manifestPath ?? "");
      setWebModel3dUrl(payload.webModel3dUrl);
      setWebModel3dBytes(payload.webModel3dBytes ?? 0);
      setArUsdzUrl(payload.arUsdzUrl ?? "");
      setArUsdzBytes(payload.arUsdzBytes ?? 0);
      setStatus(payload.status || "ready");
      setShowDeleteConfirm(false);
      router.refresh();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Publication 3D impossible.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function deleteModel() {
    setIsDeleting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/owner/restaurants/${encodeURIComponent(restaurantId)}/dishes/${encodeURIComponent(dishId)}/model`,
        {
          method: "DELETE"
        }
      );
      const payload = (await response.json().catch(() => ({}))) as DeletePayload;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Suppression du modèle impossible.");
      }

      setStatus(payload.modelStatus || "missing");
      setStoragePath("");
      setJobId("");
      setWebModel3dUrl("");
      setWebModel3dBytes(0);
      setArUsdzUrl("");
      setArUsdzBytes(0);
      setShowDeleteConfirm(false);
      setMessage(payload.modelDeleted ? "Modèle supprimé" : "Aucun modèle");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Suppression du modèle impossible."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className={styles.tableActions}>
      <input
        ref={inputRef}
        type="file"
        accept=".glb,model/gltf-binary"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        className={`${styles.btn} ${styles.btnSmall}`}
        disabled={isBusy}
        onClick={() => inputRef.current?.click()}
      >
        {isUploadQueued ? "En file..." : isUploading ? "Pipeline..." : "Ajouter GLB"}
      </button>
      {storagePath && status !== "ready" ? (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSmall}`}
          disabled={isBusy}
          onClick={() => void publish()}
        >
          {isPublishing ? "Finalisation..." : "Finaliser GLB + USDZ"}
        </button>
      ) : null}
      {hasDeletableModel ? (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
          disabled={isBusy}
          onClick={() => setShowDeleteConfirm(true)}
        >
          {isDeleting ? "Suppression..." : "Supprimer modèle"}
        </button>
      ) : null}
      <span className={styles.cellSub}>{statusLabel}</span>
      {webModel3dUrl ? (
        <a className={styles.cellSub} href={webModel3dUrl} target="_blank" rel="noreferrer">
          GLB public · {formatModelAssetBytes(webModel3dBytes)}
        </a>
      ) : null}
      {arUsdzUrl ? (
        <a className={styles.cellSub} href={arUsdzUrl} target="_blank" rel="noreferrer">
          USDZ public · {formatModelAssetBytes(arUsdzBytes)}
        </a>
      ) : null}
      {arUsdzUrl ? (
        <a
          className={`${styles.btn} ${styles.btnSmall}`}
          href={arUsdzUrl}
          download={usdzDownloadFileName}
          type="model/vnd.usdz+zip"
          aria-label={`Telecharger l'USDZ genere pour ${dishLabel}`}
        >
          Telecharger USDZ
        </a>
      ) : null}
      {showDeleteConfirm ? (
        <div
          className={styles.modelDeleteConfirm}
          role="alertdialog"
          aria-label="Confirmer la suppression du modèle 3D"
        >
          <strong>Supprimer le modèle 3D de {dishLabel} ?</strong>
          <span>
            Cette action retire le GLB web, l’AR-lite, l’USDZ iPhone et les
            metadata associées du menu public. Vous pourrez ensuite uploader un
            nouveau GLB.
          </span>
          <div className={styles.tableActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSmall}`}
              disabled={isDeleting}
              onClick={() => setShowDeleteConfirm(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
              disabled={isDeleting}
              onClick={() => void deleteModel()}
            >
              {isDeleting ? "Suppression..." : "Supprimer le modèle"}
            </button>
          </div>
        </div>
      ) : null}
      {error ? <span className={styles.errorText}>{error}</span> : null}
    </div>
  );
}
