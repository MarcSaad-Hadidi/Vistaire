"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, EmptyState, Panel } from "@/components/owner/OwnerUi";
import { ModelLabBeforeAfter } from "@/components/owner/model-lab/ModelLabBeforeAfter";
import { ModelLabDropzone } from "@/components/owner/model-lab/ModelLabDropzone";
import { ModelLabStatsPanel } from "@/components/owner/model-lab/ModelLabStatsPanel";
import { DEFAULT_MODEL_LAB_MAX_BYTES } from "@/lib/owner/modelLab/modelLabLimits";
import {
  MODEL_LAB_PRESETS,
  type ModelLabPreset,
  type ModelLabPresetId
} from "@/lib/owner/modelLab/modelLabPresets";
import type { ModelLabInspectionReport } from "@/lib/owner/modelLab/inspectGlb";

type ApiPayload =
  | { ok: true; report: ModelLabInspectionReport }
  | {
      ok: false;
      error?: string;
      warnings?: string[];
      externalUris?: string[];
      errors?: string[];
    };

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
  const [busy, setBusy] = useState(false);
  const [runningMode, setRunningMode] = useState<ModelLabPresetId | null>(null);

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
    if (nextFile.size <= 0 || nextFile.size > DEFAULT_MODEL_LAB_MAX_BYTES) {
      setFile(null);
      setError("Le GLB doit etre non vide et rester sous 25 MB.");
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

  async function generateCandidate(mode: ModelLabPresetId, allowWhileBusy = false) {
    if (!file || !sourceReport) {
      setError("Ajoutez et inspectez un GLB avant optimisation.");
      return;
    }
    if ((busy || runningMode) && !allowWhileBusy) return;

    const token = fileToken.current;
    const sourceFile = file;
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
            disabled={!sourceReport || busy || Boolean(runningMode)}
          >
            Generer la serie
          </button>
        </div>

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
                disabled={!sourceReport || busy || Boolean(runningMode)}
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

  return (
    <article className={styles.moduleCard}>
      <div className={styles.pipelineSectionTitleRow}>
        <h3>{preset.label}</h3>
        <Badge tone={preset.isRisky ? "warn" : candidateTone(candidate?.status ?? "idle")}>
          {running ? "Generation" : statusLabel(candidate?.status ?? "idle")}
        </Badge>
      </div>
      <p>{preset.summary}</p>
      <span>{preset.details}</span>
      <dl className={styles.sourceUploadRecord}>
        <SmallStat label="Texture" value={preset.textureMax ? `${preset.textureMax}px` : "source"} />
        <SmallStat label="Ratio" value={preset.simplifyRatio ? String(preset.simplifyRatio) : "off"} />
        <SmallStat label="Meshopt" value={preset.useMeshopt ? "yes" : "no"} />
        <SmallStat label="Gain" value={gain !== null ? `${gain}%` : "-"} />
      </dl>
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

function stripGlb(name: string): string {
  return name.replace(/\.glb$/i, "") || "model";
}

function fileNameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}
