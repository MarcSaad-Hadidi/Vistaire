"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { formatModelAssetBytes } from "@/lib/owner/modelAssetSize";

type OwnerDishModelUploaderProps = {
  restaurantId: string;
  dishId: string;
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

export function OwnerDishModelUploader({
  restaurantId,
  dishId,
  initialStatus = "missing",
  initialWebModel3dUrl = "",
  initialWebModel3dBytes = 0,
  initialArUsdzUrl = "",
  initialArUsdzBytes = 0,
  initialPreparedGlbJobId = "",
  initialPreparedGlbStoragePath = ""
}: OwnerDishModelUploaderProps) {
  const router = useRouter();
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
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setIsUploading(true);
    setError("");
    setStatus("pipeline_meshy");

    const formData = new FormData();
    formData.set("file", file);

    try {
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
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Pipeline GLB vers USDZ impossible.");
      setStatus(initialStatus);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function publish() {
    setIsPublishing(true);
    setError("");

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
      router.refresh();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Publication 3D impossible.");
    } finally {
      setIsPublishing(false);
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
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? "Pipeline..." : "Ajouter GLB"}
      </button>
      {storagePath && status !== "ready" ? (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSmall}`}
          disabled={isPublishing}
          onClick={() => void publish()}
        >
          {isPublishing ? "Finalisation..." : "Finaliser GLB + USDZ"}
        </button>
      ) : null}
      <span className={styles.cellSub}>{status}</span>
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
      {error ? <span className={styles.errorText}>{error}</span> : null}
    </div>
  );
}
