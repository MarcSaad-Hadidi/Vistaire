"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, EmptyState, Panel } from "@/components/owner/OwnerUi";
import { ModelLabBeforeAfter } from "@/components/owner/model-lab/ModelLabBeforeAfter";
import { ModelLabDropzone } from "@/components/owner/model-lab/ModelLabDropzone";
import { ModelLabStatsPanel } from "@/components/owner/model-lab/ModelLabStatsPanel";
import {
  MODEL_LAB_PRESETS,
  type ModelLabPreset,
  type ModelLabPresetId
} from "@/lib/owner/modelLab/modelLabPresets";
import type { ModelLabInspectionReport } from "@/lib/owner/modelLab/inspectGlb";
import { assessModelLabCandidate } from "@/lib/owner/modelLab/modelLabRiskScore";

type ApiPayload =
  | { ok: true; report: ModelLabInspectionReport }
  | {
      ok: false;
      error?: string;
      warnings?: string[];
      externalUris?: string[];
      errors?: string[];
    };

type ModelLabConfig = {
  inspectionMaxBytes: number;
  optimizationMaxBytes: number;
  hardMaxBytes: number;
  notes: string[];
};

type ConfigPayload =
  | { ok: true; config: ModelLabConfig }
  | { ok: false; error?: string };

type CandidateStatus = "idle" | "running" | "ready" | "error";

type ModelLabCandidate = {
  mode: ModelLabPresetId;
  status: CandidateStatus;
  blobUrl: string | null;
  fileName: string;
  report: ModelLabInspectionReport | null;
  error: string;
};

function emptyCandidates(): ModelLabCandidate[] {
  return MODEL_LAB_PRESETS.map((preset) => ({
    mode: preset.id,
    status: "idle",
    blobUrl: null,
    fileName: "",
    report: null,
    error: ""
  }));
}

export function ModelLabClient() {
  const managedUrls = useRef(new Set<string>());
  const fileToken = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceReport, setSourceReport] = useState<ModelLabInspectionReport | null>(null);
  const [candidates, setCandidates] = useState<ModelLabCandidate[]>(() => emptyCandidates());
  const [selectedMode, setSelectedMode] = useState<ModelLabPresetId | null>(null);
  const [message, setMessage] = useState("Ajoutez un GLB pour lancer l'inspection locale.");
  const [error, setError] = useState("");
  const [config, setConfig] = useState<ModelLabConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const [busy, setBusy] = useState(false);
  const [runningMode, setRunningMode] = useState<ModelLabPresetId | null>(null);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const response = await fetch("/api/owner/model-lab/config", {
          cache: "no-store",
          credentials: "same-origin"
        });
        const payload = (await response.json()) as ConfigPayload;
        if (!active) return;
        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.ok
              ? "Configuration Model Lab indisponible."
              : payload.error || "Configuration Model Lab indisponible."
          );
        }
        setConfig(payload.config);
        setConfigError("");
      } catch (configLoadError) {
        if (!active) return;
        setConfig(null);
        setConfigError(
          configLoadError instanceof Error
            ? configLoadError.message
            : "Configuration Model Lab indisponible."
        );
      }
    }

    void loadConfig();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const urls = managedUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  function createManagedUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    managedUrls.current.add(url);
    return url;
  }

  function revokeManagedUrl(url: string | null) {
    if (!url || !managedUrls.current.has(url)) return;
    URL.revokeObjectURL(url);
    managedUrls.current.delete(url);
  }

  function resetCandidates() {
    setSelectedMode(null);
    setCandidates((current) => {
      current.forEach((candidate) => revokeManagedUrl(candidate.blobUrl));
      return emptyCandidates();
    });
  }

  async function inspectFile(targetFile: File): Promise<ModelLabInspectionReport> {
    const formData = new FormData();
    formData.set("file", targetFile, targetFile.name);
    const response = await fetch("/api/owner/model-lab/inspect", {
      method: "POST",
      body: formData,
      cache: "no-store",
      credentials: "same-origin"
    });
    const payload = (await response.json()) as ApiPayload;
    if (!response.ok) {
      throw new Error(payload.ok ? "Inspection GLB impossible." : payload.error || "Inspection GLB impossible.");
    }
    if (!payload.ok) {
      throw new Error(payload.error || "Inspection GLB impossible.");
    }
    return payload.report;
  }

  async function onFile(nextFile: File | null) {
    const token = fileToken.current + 1;
    fileToken.current = token;
    setError("");
    setMessage("Validation du GLB.");
    setSourceReport(null);
    resetCandidates();
    setSourceUrl((current) => {
      revokeManagedUrl(current);
      return null;
    });

    if (!nextFile) {
      setFile(null);
      setMessage("Ajoutez un GLB pour lancer l'inspection locale.");
      return;
    }

    if (!nextFile.name.toLowerCase().endsWith(".glb")) {
      setFile(null);
      setError("Seuls les fichiers .glb sont acceptes.");
      setMessage("Fichier refuse.");
      return;
    }
    if (nextFile.size <= 0) {
      setFile(null);
      setError("Le GLB doit etre non vide.");
      setMessage("Fichier refuse.");
      return;
    }
    if (config && nextFile.size > config.inspectionMaxBytes) {
      setFile(null);
      setError(
        `Taille refusee: ${formatBytes(nextFile.size)} depasse la limite d'inspection configuree (${formatBytes(config.inspectionMaxBytes)}).`
      );
      setMessage("Fichier refuse.");
      return;
    }

    setBusy(true);
    setFile(nextFile);
    const url = createManagedUrl(nextFile);
    setSourceUrl(url);
    try {
      const report = await inspectFile(nextFile);
      if (token !== fileToken.current) return;
      setSourceReport(report);
      setMessage("Inspection terminee. Generez un mode puis comparez l'avant/apres.");
    } catch (inspectionError) {
      if (token !== fileToken.current) return;
      setSourceReport(null);
      setError(inspectionError instanceof Error ? inspectionError.message : "Inspection impossible.");
      setMessage("Inspection refusee.");
    } finally {
      if (token === fileToken.current) setBusy(false);
    }
  }

  function updateCandidate(mode: ModelLabPresetId, patch: Partial<ModelLabCandidate>) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.mode === mode ? { ...candidate, ...patch } : candidate
      )
    );
  }

  function optimizationLimitError(targetFile: File): string {
    if (!config || targetFile.size <= config.optimizationMaxBytes) return "";
    return `Optimisation refusee: ${formatBytes(targetFile.size)} depasse la limite configuree (${formatBytes(config.optimizationMaxBytes)}).`;
  }

  async function generateCandidate(mode: ModelLabPresetId, allowWhileBusy = false) {
    if (!file || !sourceReport) {
      setError("Ajoutez et inspectez un GLB avant optimisation.");
      return;
    }
    if ((busy || runningMode) && !allowWhileBusy) return;

    const token = fileToken.current;
    const sourceFile = file;
    const limitError = optimizationLimitError(sourceFile);
    if (limitError) {
      setError(limitError);
      setMessage("Optimisation refusee.");
      return;
    }
    const current = candidates.find((candidate) => candidate.mode === mode);
    revokeManagedUrl(current?.blobUrl ?? null);
    updateCandidate(mode, {
      status: "running",
      blobUrl: null,
      report: null,
      error: "",
      fileName: ""
    });
    setBusy(true);
    setRunningMode(mode);
    setError("");
    setMessage(`Generation ${presetLabel(mode)} en cours.`);

    try {
      const formData = new FormData();
      formData.set("file", sourceFile, sourceFile.name);
      formData.set("mode", mode);
      const response = await fetch("/api/owner/model-lab/optimize", {
        method: "POST",
        body: formData,
        cache: "no-store",
        credentials: "same-origin"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiPayload | null;
        const detail = payload && !payload.ok ? payload.error || payload.errors?.join(" ") : null;
        throw new Error(detail || "Optimisation GLB refusee.");
      }

      if (token !== fileToken.current) return;
      const blob = await response.blob();
      if (token !== fileToken.current) return;

      const fileName = fileNameFromDisposition(
        response.headers.get("content-disposition"),
        `${stripGlb(sourceFile.name)}-${mode}.glb`
      );
      const blobUrl = createManagedUrl(blob);
      const optimizedFile = new File([blob], fileName, {
        type: "model/gltf-binary"
      });
      const report = await inspectFile(optimizedFile);
      if (token !== fileToken.current) {
        revokeManagedUrl(blobUrl);
        return;
      }

      updateCandidate(mode, {
        status: "ready",
        blobUrl,
        fileName,
        report,
        error: ""
      });
      setSelectedMode(mode);
      setMessage(`${presetLabel(mode)} pret pour comparaison locale.`);
    } catch (candidateError) {
      if (token !== fileToken.current) return;
      updateCandidate(mode, {
        status: "error",
        blobUrl: null,
        report: null,
        fileName: "",
        error: candidateError instanceof Error ? candidateError.message : "Optimisation impossible."
      });
      setError(candidateError instanceof Error ? candidateError.message : "Optimisation impossible.");
      setMessage(`${presetLabel(mode)} refuse.`);
    } finally {
      if (token === fileToken.current) {
        setRunningMode(null);
        setBusy(false);
      }
    }
  }

  async function generateAllSequentially() {
    if (!file || !sourceReport || busy || runningMode) return;
    const limitError = optimizationLimitError(file);
    if (limitError) {
      setError(limitError);
      setMessage("Optimisation refusee.");
      return;
    }
    setBusy(true);
    try {
      for (const preset of MODEL_LAB_PRESETS) {
        await generateCandidate(preset.id, true);
      }
    } finally {
      setBusy(false);
      setRunningMode(null);
    }
  }

  const selectedCandidate =
    (selectedMode
      ? candidates.find((candidate) => candidate.mode === selectedMode && candidate.status === "ready")
      : null) ?? candidates.find((candidate) => candidate.status === "ready");
  const sourceBlockedReason =
    sourceReport && sourceReport.externalUris.length > 0
      ? "Source non chargee dans le viewer: ce GLB reference des ressources externes. Emballez textures et buffers dans le GLB pour rester local."
      : "";
  const optimizationBlockedReason =
    file && config ? optimizationLimitError(file) : "";

  return (
    <div className={styles.restaurantTabPanel}>
      <section className={styles.sourceUploadPanel} aria-label="Vistaire Model Lab">
        <div className={styles.sourceUploadHeader}>
          <div>
            <p className={styles.sourceUploadEyebrow}>Laboratoire GLB owner</p>
            <h2 className={styles.panelTitle}>Inspection et candidats locaux</h2>
          </div>
          <Badge tone="muted">no storage</Badge>
        </div>

        <div className={styles.sourceUploadControls}>
          <ModelLabDropzone file={file} disabled={busy} onFile={(next) => void onFile(next)} />
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => void generateAllSequentially()}
            disabled={!sourceReport || busy || Boolean(runningMode) || Boolean(optimizationBlockedReason)}
          >
            Generer la serie
          </button>
        </div>

        <div className={styles.modelLabNoticeGrid} aria-label="Garanties Model Lab">
          <p>No storage: fichiers en memoire/Blob, aucun Supabase/CDN/DB/public/models.</p>
          <p>Gros modeles: inspection possible; optimisation serverless limitee; mode local-heavy a venir.</p>
          <p>Model Lab optimise uniquement des GLB. USDZ / Quick Look reste dans le pipeline 3D / AR existant.</p>
          <p>
            Limites actives:{" "}
            {config
              ? `inspection ${formatBytes(config.inspectionMaxBytes)}, optimisation ${formatBytes(config.optimizationMaxBytes)}.`
              : "chargement de la configuration owner."}
          </p>
          <p>Note: le rapport candidat relit temporairement le Blob optimise via /inspect, sans stockage.</p>
        </div>
        {configError ? <p className={styles.qrWarning}>{configError}</p> : null}
        {optimizationBlockedReason ? (
          <p className={styles.qrWarning}>{optimizationBlockedReason}</p>
        ) : null}

        <p className={styles.qrStatusLine} aria-live="polite" data-testid="model-lab-status">
          {message}
        </p>
        {error ? <p className={styles.qrWarning}>{error}</p> : null}
      </section>

      <Panel
        title="Modes GLB"
        action={<span className={styles.sourceTag}>1 candidat actif max</span>}
      >
        <div className={styles.moduleCardGrid}>
          {MODEL_LAB_PRESETS.map((preset) => {
            const candidate = candidates.find((entry) => entry.mode === preset.id);
            return (
              <CandidateCard
                key={preset.id}
                preset={preset}
                candidate={candidate}
                selected={selectedCandidate?.mode === preset.id}
                sourceReport={sourceReport}
                disabled={
                  !sourceReport ||
                  busy ||
                  Boolean(runningMode) ||
                  Boolean(optimizationBlockedReason)
                }
                running={runningMode === preset.id}
                onGenerate={() => void generateCandidate(preset.id)}
                onSelect={() => setSelectedMode(preset.id)}
              />
            );
          })}
        </div>
      </Panel>

      <ModelLabBeforeAfter
        key={`${sourceUrl ?? "source-none"}:${selectedCandidate?.blobUrl ?? "candidate-none"}`}
        sourceUrl={sourceUrl}
        sourceLabel={file?.name || "GLB source"}
        sourceReport={sourceReport}
        sourceBlockedReason={sourceBlockedReason}
        candidateUrl={selectedCandidate?.blobUrl ?? null}
        candidateLabel={selectedCandidate?.fileName || "Candidat optimise"}
        candidateReport={selectedCandidate?.report ?? null}
      />

      <ModelLabStatsPanel title="Stats source" report={sourceReport} />

      {selectedCandidate?.report ? (
        <ModelLabStatsPanel
          title={`Stats candidat - ${presetLabel(selectedCandidate.mode)}`}
          report={selectedCandidate.report}
          compareTo={sourceReport}
          sourceReport={sourceReport}
          preset={presetForMode(selectedCandidate.mode)}
        />
      ) : (
        <section className={styles.moduleCard}>
          <p className={styles.moduleCardTitle}>Stats candidat</p>
          <EmptyState>Aucun candidat genere pour le moment.</EmptyState>
        </section>
      )}
    </div>
  );
}

function CandidateCard({
  preset,
  candidate,
  selected,
  sourceReport,
  disabled,
  running,
  onGenerate,
  onSelect
}: {
  preset: ModelLabPreset;
  candidate: ModelLabCandidate | undefined;
  selected: boolean;
  sourceReport: ModelLabInspectionReport | null;
  disabled: boolean;
  running: boolean;
  onGenerate: () => void;
  onSelect: () => void;
}) {
  const report = candidate?.report ?? null;
  const gain =
    sourceReport && report
      ? Math.round((1 - report.bytes / Math.max(sourceReport.bytes, 1)) * 1000) / 10
      : null;
  const assessment = assessModelLabCandidate({
    source: sourceReport,
    candidate: report,
    preset
  });
  const geometryLabel =
    preset.geometryCompression === "meshopt"
      ? "Meshopt"
      : preset.geometryCompression === "reorder"
        ? "AR-safe"
        : "Clean";
  const targetLabel =
    report && assessment.targetPass !== null
      ? assessment.targetPass
        ? "ok"
        : "haut"
      : preset.targetLabel;

  return (
    <article className={`${styles.moduleCard} ${styles.modelLabPresetCard}`}>
      <div className={styles.pipelineSectionTitleRow}>
        <h3>{preset.label}</h3>
        <Badge tone={preset.isRisky ? "warn" : candidateTone(candidate?.status ?? "idle")}>
          {running ? "Generation" : statusLabel(candidate?.status ?? "idle")}
        </Badge>
      </div>
      <p>{preset.summary}</p>
      <span>{preset.details}</span>
      <dl className={`${styles.sourceUploadRecord} ${styles.modelLabPresetStats}`}>
        <SmallStat label="Texture" value={preset.textureMax ? `${preset.textureMax}px` : "source"} />
        <SmallStat label="Target" value={targetLabel} />
        <SmallStat label="Geom" value={geometryLabel} />
        <SmallStat label="Gain" value={gain !== null ? `${gain}%` : "-"} />
        <SmallStat label="Risque" value={`${assessment.score}/5`} />
      </dl>
      {report ? (
        <p className={styles.cellSub}>
          {assessment.targetPass === null
            ? "Reference sans cible."
            : assessment.targetPass
              ? `Cible ${preset.targetLabel} atteinte.`
              : `Cible ${preset.targetLabel} non atteinte: ${formatBytes(report.bytes)}.`}
        </p>
      ) : null}
      {candidate?.error ? <p className={styles.qrWarning}>{candidate.error}</p> : null}
      <div className={styles.moduleActions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={disabled || running}
          aria-busy={running}
          onClick={onGenerate}
        >
          {running ? "Generation" : "Generer"}
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={candidate?.status !== "ready"}
          aria-pressed={selected}
          onClick={onSelect}
        >
          Comparer
        </button>
        {candidate?.blobUrl ? (
          <a className={styles.btn} href={candidate.blobUrl} download={candidate.fileName}>
            Telecharger
          </a>
        ) : null}
      </div>
    </article>
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

function candidateTone(status: CandidateStatus) {
  if (status === "ready") return "ready";
  if (status === "error") return "danger";
  if (status === "running") return "warn";
  return "muted";
}

function statusLabel(status: CandidateStatus) {
  if (status === "ready") return "Pret";
  if (status === "error") return "Erreur";
  if (status === "running") return "Generation";
  return "En attente";
}

function presetLabel(mode: ModelLabPresetId): string {
  return MODEL_LAB_PRESETS.find((preset) => preset.id === mode)?.label ?? mode;
}

function presetForMode(mode: ModelLabPresetId): ModelLabPreset {
  return MODEL_LAB_PRESETS.find((preset) => preset.id === mode) ?? MODEL_LAB_PRESETS[0];
}

function stripGlb(name: string): string {
  return name.replace(/\.glb$/i, "") || "model";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileNameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}
