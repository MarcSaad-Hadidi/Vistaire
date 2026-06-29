"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, EmptyState } from "@/components/owner/OwnerUi";
import {
  applyModelLabCameraState,
  MODEL_LAB_DEFAULT_CAMERA,
  ModelLabViewer,
  readModelLabCameraState,
  type ModelLabCameraState,
  type ModelLabComparePane,
  type ModelLabViewerElement
} from "@/components/owner/model-lab/ModelLabViewer";
import type { ModelLabInspectionReport } from "@/lib/owner/modelLab/inspectGlb";

type MobileTab = ModelLabComparePane | "stats";

export function ModelLabBeforeAfter({
  sourceUrl,
  sourceLabel,
  sourceReport,
  sourceBlockedReason = "",
  candidateUrl,
  candidateLabel,
  candidateReport
}: {
  sourceUrl: string | null;
  sourceLabel: string;
  sourceReport: ModelLabInspectionReport | null;
  sourceBlockedReason?: string;
  candidateUrl: string | null;
  candidateLabel: string;
  candidateReport: ModelLabInspectionReport | null;
}) {
  const sourceRef = useRef<ModelLabViewerElement | null>(null);
  const candidateRef = useRef<ModelLabViewerElement | null>(null);
  const pendingPane = useRef<ModelLabComparePane | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCameraPane = useRef<ModelLabComparePane>("source");
  const ignoredCameraSignatures = useRef<Record<ModelLabComparePane, string | null>>({
    source: null,
    candidate: null
  });
  const compact = useCompactTabs();
  const [activeTab, setActiveTab] = useState<MobileTab>("source");
  const [loadSignal, setLoadSignal] = useState(0);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [loaded, setLoaded] = useState<Record<ModelLabComparePane, boolean>>({
    source: false,
    candidate: false
  });
  const [cameraMessage, setCameraMessage] = useState(
    sourceBlockedReason || "Chargez les deux vues pour synchroniser ou aligner la camera."
  );

  const sourceCanLoad = Boolean(sourceUrl && !sourceBlockedReason);
  const candidateCanLoad = Boolean(candidateUrl);
  const canCompare = Boolean(sourceCanLoad && candidateCanLoad);
  const bothLoaded = loaded.source && loaded.candidate;

  const cancelPendingSync = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingPane.current = null;
  }, []);

  useEffect(() => () => cancelPendingSync(), [cancelPendingSync]);

  const syncCamera = useCallback((fromPane: ModelLabComparePane) => {
    if (!syncEnabled || !bothLoaded) return;
    pendingPane.current = fromPane;
    if (rafRef.current !== null) return;

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const pane = pendingPane.current;
      pendingPane.current = null;
      if (!pane) return;

      const from = pane === "source" ? sourceRef.current : candidateRef.current;
      const targetPane: ModelLabComparePane = pane === "source" ? "candidate" : "source";
      const to = targetPane === "source" ? sourceRef.current : candidateRef.current;
      const state = readModelLabCameraState(from);
      if (!state || !to) {
        setCameraMessage("Synchronisation indisponible; utilisez Aligner apres chargement.");
        return;
      }

      applyCameraToPane(targetPane, to, state);
    });
  }, [bothLoaded, syncEnabled]);

  const handleViewerReady = useCallback((
    pane: ModelLabComparePane,
    node: ModelLabViewerElement | null
  ) => {
    if (pane === "source") sourceRef.current = node;
    if (pane === "candidate") candidateRef.current = node;
    setLoaded((current) => {
      const nextLoaded = Boolean(node);
      return current[pane] === nextLoaded ? current : { ...current, [pane]: nextLoaded };
    });
    if (node && !readModelLabCameraState(node)) {
      applyCameraToPane(pane, node, MODEL_LAB_DEFAULT_CAMERA);
    }
  }, []);

  const handleCameraChange = useCallback((pane: ModelLabComparePane) => {
    const node = pane === "source" ? sourceRef.current : candidateRef.current;
    const state = readModelLabCameraState(node);
    const signature = state ? cameraStateSignature(state) : "";
    if (signature && ignoredCameraSignatures.current[pane] === signature) {
      return;
    }
    lastCameraPane.current = pane;
    syncCamera(pane);
  }, [syncCamera]);

  function alignCamera() {
    const preferredPane = lastCameraPane.current;
    const from =
      preferredPane === "candidate" ? candidateRef.current : sourceRef.current;
    const fallback =
      preferredPane === "candidate" ? sourceRef.current : candidateRef.current;
    const state = readModelLabCameraState(from) ?? readModelLabCameraState(fallback);
    if (!state) {
      resetCamera();
      setCameraMessage("Camera remise au cadrage Vistaire par defaut.");
      return;
    }
    applyToLoaded(state);
    setCameraMessage("Cameras alignees manuellement.");
  }

  function resetCamera() {
    applyToLoaded(MODEL_LAB_DEFAULT_CAMERA);
    setCameraMessage("Camera reinitialisee sur les deux vues chargees.");
  }

  function applyToLoaded(state: ModelLabCameraState) {
    applyCameraToPane("source", sourceRef.current, state);
    applyCameraToPane("candidate", candidateRef.current, state);
  }

  function applyCameraToPane(
    pane: ModelLabComparePane,
    node: ModelLabViewerElement | null,
    state: ModelLabCameraState
  ) {
    if (!node) return;
    const nextSignature = cameraStateSignature(state);
    if (cameraStateSignature(readModelLabCameraState(node)) === nextSignature) {
      return;
    }
    ignoredCameraSignatures.current[pane] = nextSignature;
    applyModelLabCameraState(node, state);
  }

  return (
    <section className={styles.reviewModelsPanel} aria-label="Comparaison 3D avant apres">
      <div className={styles.pipelineSectionTitleRow}>
        <div>
          <p className={styles.sourceUploadEyebrow}>Comparaison 3D locale</p>
          <h2 className={styles.moduleTitle}>Avant / apres optimise</h2>
        </div>
        <div className={styles.reviewModeControls}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setLoadSignal((value) => value + 1)}
            disabled={!sourceCanLoad && !candidateCanLoad}
          >
            {sourceBlockedReason ? "Charger le candidat" : "Charger les deux"}
          </button>
          <button
            type="button"
            className={styles.btn}
            aria-pressed={syncEnabled}
            disabled={!bothLoaded}
            onClick={() => {
              setSyncEnabled((value) => !value);
              setCameraMessage(
                bothLoaded
                  ? "Synchronisation orbit/target/fov active apres mouvement camera."
                  : "Chargez les deux vues avant synchronisation."
              );
            }}
          >
            Synchroniser
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={!bothLoaded}
            onClick={alignCamera}
          >
            Aligner
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={!loaded.source && !loaded.candidate}
            onClick={resetCamera}
          >
            Reset camera
          </button>
        </div>
      </div>

      <p className={styles.qrStatusLine} aria-live="polite">
        {cameraMessage}
      </p>

      <div className={styles.modelLabMobileTabs} role="tablist" aria-label="Comparer les vues">
        <TabButton active={activeTab === "source"} tab="source" onSelect={setActiveTab}>
          Avant
        </TabButton>
        <TabButton active={activeTab === "candidate"} tab="candidate" onSelect={setActiveTab}>
          Apres
        </TabButton>
        <TabButton active={activeTab === "stats"} tab="stats" onSelect={setActiveTab}>
          Stats
        </TabButton>
      </div>

      <div className={styles.reviewModelGrid}>
        <ModelLabViewer
          pane="source"
          modelUrl={sourceUrl}
          label={sourceLabel}
          eyebrow="Avant"
          stats={sourceReport}
          blockedReason={sourceBlockedReason}
          loadSignal={loadSignal}
          compactHidden={compact && activeTab !== "source"}
          onViewerReady={handleViewerReady}
          onCameraChange={handleCameraChange}
        />
        <ModelLabViewer
          pane="candidate"
          modelUrl={candidateUrl}
          label={candidateLabel}
          eyebrow="Apres"
          stats={candidateReport}
          compareTo={sourceReport}
          loadSignal={loadSignal}
          compactHidden={compact && activeTab !== "candidate"}
          onViewerReady={handleViewerReady}
          onCameraChange={handleCameraChange}
        />
      </div>

      <section
        className={styles.modelLabCompareSummary}
        role={compact ? "tabpanel" : undefined}
        id="model-lab-stats-panel"
        aria-labelledby="model-lab-stats-tab"
        hidden={compact && activeTab !== "stats"}
      >
        <div className={styles.pipelineSectionTitleRow}>
          <div>
            <p className={styles.sourceUploadEyebrow}>Stats avant apres</p>
            <h3 className={styles.moduleCardTitle}>Impact du candidat selectionne</h3>
          </div>
          {canCompare ? <Badge tone="muted">Blob URLs</Badge> : null}
        </div>
        {sourceReport ? (
          <dl className={styles.sourceUploadRecord}>
            <CompareStat
              label="Poids"
              before={sourceReport.bytes}
              after={candidateReport?.bytes ?? null}
              formatter={formatBytes}
            />
            <CompareStat
              label="Triangles"
              before={sourceReport.triangles}
              after={candidateReport?.triangles ?? null}
              formatter={formatNumber}
            />
            <CompareStat
              label="Vertices"
              before={sourceReport.vertices}
              after={candidateReport?.vertices ?? null}
              formatter={formatNumber}
            />
            <CompareStat
              label="Textures"
              before={sourceReport.textures}
              after={candidateReport?.textures ?? null}
              formatter={formatNumber}
            />
          </dl>
        ) : (
          <EmptyState>Ajoutez un GLB pour afficher les stats avant/apres.</EmptyState>
        )}
      </section>
    </section>
  );
}

function TabButton({
  active,
  tab,
  onSelect,
  children
}: {
  active: boolean;
  tab: MobileTab;
  onSelect: (tab: MobileTab) => void;
  children: ReactNode;
}) {
  return (
    <button
      id={`model-lab-${tab}-tab`}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`model-lab-${tab}-panel`}
      className={styles.btn}
      onClick={() => onSelect(tab)}
    >
      {children}
    </button>
  );
}

function CompareStat({
  label,
  before,
  after,
  formatter
}: {
  label: string;
  before: number;
  after: number | null;
  formatter: (value: number) => string;
}) {
  const delta =
    after === null ? "" : `${Math.round((1 - after / Math.max(before, 1)) * 1000) / 10}%`;
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {formatter(before)} {"->"} {after === null ? "-" : formatter(after)}
      </dd>
      {delta ? <span className={styles.cellSub}>Gain {delta}</span> : null}
    </div>
  );
}

function useCompactTabs(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return compact;
}

function cameraStateSignature(state: ModelLabCameraState | null): string {
  if (!state) return "";
  return `${state.orbit.trim()}|${state.target.trim()}|${state.fieldOfView.trim()}`;
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
