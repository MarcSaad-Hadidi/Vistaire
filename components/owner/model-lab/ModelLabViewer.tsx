"use client";

import { createElement, useCallback, useEffect, useRef, useState } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";
import type { ModelLabInspectionReport } from "@/lib/owner/modelLab/inspectGlb";
import { configureModelViewerAssetDecoders } from "@/lib/modelViewerAssetDecoders";

export type ModelLabComparePane = "source" | "candidate";

export type ModelLabCameraState = {
  orbit: string;
  target: string;
  fieldOfView: string;
};

export type ModelLabViewerElement = HTMLElement & {
  loaded?: boolean;
  cameraOrbit?: string;
  cameraTarget?: string;
  fieldOfView?: string;
  jumpCameraToGoal?: () => void;
};

export const MODEL_LAB_DEFAULT_CAMERA: ModelLabCameraState = {
  orbit: "0deg 68deg 145%",
  target: "0m 0.015m 0m",
  fieldOfView: "34deg"
};

let modelViewerReadyPromise: Promise<void> | null = null;

async function ensureModelViewerLoaded(): Promise<void> {
  if (!modelViewerReadyPromise) {
    configureModelViewerAssetDecoders();
    modelViewerReadyPromise = import("@google/model-viewer").then(async () => {
      if (!customElements.get("model-viewer")) {
        await customElements.whenDefined("model-viewer");
      }
      configureModelViewerAssetDecoders();
    });
  }
  await modelViewerReadyPromise;
}

export function readModelLabCameraState(
  node: ModelLabViewerElement | null
): ModelLabCameraState | null {
  if (!node) return null;
  const orbit = node.cameraOrbit || node.getAttribute("camera-orbit") || "";
  const target = node.cameraTarget || node.getAttribute("camera-target") || "";
  const fieldOfView =
    node.fieldOfView || node.getAttribute("field-of-view") || "";

  if (!orbit || !target || !fieldOfView) return null;
  return { orbit, target, fieldOfView };
}

export function applyModelLabCameraState(
  node: ModelLabViewerElement | null,
  state: ModelLabCameraState
) {
  if (!node) return;
  node.cameraOrbit = state.orbit;
  node.cameraTarget = state.target;
  node.fieldOfView = state.fieldOfView;
  node.setAttribute("camera-orbit", state.orbit);
  node.setAttribute("camera-target", state.target);
  node.setAttribute("field-of-view", state.fieldOfView);
  node.jumpCameraToGoal?.();
}

export function ModelLabViewer({
  pane,
  modelUrl,
  label,
  eyebrow,
  stats,
  compareTo,
  loadSignal,
  blockedReason = "",
  compactHidden,
  onViewerReady,
  onCameraChange
}: {
  pane: ModelLabComparePane;
  modelUrl: string | null;
  label: string;
  eyebrow: string;
  stats: ModelLabInspectionReport | null;
  compareTo?: ModelLabInspectionReport | null;
  loadSignal: number;
  blockedReason?: string;
  compactHidden?: boolean;
  onViewerReady: (pane: ModelLabComparePane, node: ModelLabViewerElement | null) => void;
  onCameraChange: (pane: ModelLabComparePane) => void;
}) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ url: string | null; message: string }>({
    url: null,
    message: ""
  });
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastLoadSignal = useRef(loadSignal);
  const canLoad = Boolean(modelUrl && !blockedReason);
  const loaded = Boolean(canLoad && modelUrl && loadedUrl === modelUrl);
  const visibleError = error.url === modelUrl ? error.message : "";

  useEffect(() => {
    if (loadSignal === lastLoadSignal.current) return;
    lastLoadSignal.current = loadSignal;
    if (canLoad) void loadViewer();
    // loadViewer is intentionally kept local so each pane owns its explicit load state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, loadSignal, modelUrl]);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      onViewerReady(pane, null);
    },
    [onViewerReady, pane]
  );

  async function loadViewer() {
    if (!canLoad || !modelUrl) return;
    setLoading(true);
    setError({ url: modelUrl, message: "" });
    try {
      await ensureModelViewerLoaded();
      setLoadedUrl(modelUrl);
    } catch {
      setError({
        url: modelUrl,
        message: "Viewer 3D indisponible dans ce navigateur."
      });
    } finally {
      setLoading(false);
    }
  }

  const bindViewer = useCallback((node: ModelLabViewerElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    onViewerReady(pane, node);
    if (!node) return;

    const handleCameraChange = () => onCameraChange(pane);
    const handleLoad = () => {
      const source = node.getAttribute("src");
      setError((current) =>
        current.url === source ? { url: source, message: "" } : current
      );
    };
    const handleError = () => {
      setError({
        url: node.getAttribute("src"),
        message:
          "Affichage 3D impossible pour ce GLB. Le fichier reste local; regenerez un candidat ou verifiez les extensions requises."
      });
    };
    node.addEventListener("camera-change", handleCameraChange);
    node.addEventListener("load", handleLoad);
    node.addEventListener("error", handleError);
    cleanupRef.current = () => {
      node.removeEventListener("camera-change", handleCameraChange);
      node.removeEventListener("load", handleLoad);
      node.removeEventListener("error", handleError);
    };
  }, [onCameraChange, onViewerReady, pane]);

  return (
    <section
      id={`model-lab-${pane}-panel`}
      className={styles.reviewModelPane}
      aria-label={label}
      role="tabpanel"
      aria-labelledby={`model-lab-${pane}-tab`}
      hidden={compactHidden}
    >
      <div className={styles.reviewModelPaneHeader}>
        <div>
          <p className={styles.sourceUploadEyebrow}>{eyebrow}</p>
          <h3 className={styles.panelTitle}>{label}</h3>
        </div>
        {stats ? <span className={styles.sourceTag}>{summaryTag(stats, compareTo)}</span> : null}
      </div>

      {stats ? (
        <dl className={styles.modelLabViewerStats}>
          <SmallStat label="Poids" value={formatBytes(stats.bytes)} />
          <SmallStat label="Tris" value={formatNumber(stats.triangles)} />
          <SmallStat label="Verts" value={formatNumber(stats.vertices)} />
          <SmallStat label="Textures" value={formatNumber(stats.textures)} />
        </dl>
      ) : null}

      {loaded && modelUrl ? (
        <div className={styles.reviewModelStage}>
          {createElement("model-viewer", {
            ref: bindViewer,
            src: modelUrl,
            alt: label,
            "data-testid": `model-lab-viewer-${pane}`,
            className: styles.reviewModelViewer,
            "camera-controls": true,
            "interaction-prompt": "none",
            "disable-tap": true,
            loading: "eager",
            reveal: "auto",
            "camera-orbit": MODEL_LAB_DEFAULT_CAMERA.orbit,
            "camera-target": MODEL_LAB_DEFAULT_CAMERA.target,
            "field-of-view": MODEL_LAB_DEFAULT_CAMERA.fieldOfView
          })}
          {visibleError ? <p className={styles.qrWarning}>{visibleError}</p> : null}
        </div>
      ) : (
        <div className={styles.reviewModelPlaceholder}>
          <p>
            {modelUrl
              ? blockedReason || "Modele pret pour inspection owner explicite."
              : pane === "source"
                ? "Ajoutez un GLB pour ouvrir la source."
                : "Generez un candidat pour comparer l'apres."}
          </p>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => void loadViewer()}
            disabled={!canLoad || loading}
            aria-busy={loading}
          >
            {loading
              ? "Chargement"
              : pane === "source"
                ? "Charger la source"
                : "Charger le candidat"}
          </button>
          {visibleError ? <p className={styles.qrWarning}>{visibleError}</p> : null}
        </div>
      )}
    </section>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function summaryTag(
  report: ModelLabInspectionReport,
  compareTo?: ModelLabInspectionReport | null
) {
  if (!compareTo) return "Blob URL";
  const gain = Math.round((1 - report.bytes / Math.max(compareTo.bytes, 1)) * 1000) / 10;
  return `${gain >= 0 ? "-" : "+"}${Math.abs(gain)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-CA").format(value);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
