"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Owner3dLazyModelViewer } from "@/components/owner/Owner3dLazyModelViewer";

type Identity = {
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
  version: string;
};

type VariantRole = "web" | "mobile" | "arLite" | "iosSource" | "posterSource";

type SourceRecord = {
  id?: string;
  originalName: string;
  bytes: number;
  sha256: string;
  status: string;
};

type CandidateRecord = Identity & {
  id: string;
  variantRole: VariantRole;
  presetLabel: string;
  originalName: string;
  bytes: number;
  sha256: string;
  triangleCount: number | null;
  status: string;
  budgetStatus: string;
  visualStatus: string;
  fails: string[];
  warnings: string[];
};

type SetSummary = {
  status: string;
  canApprove: boolean;
  missingRoles: VariantRole[];
  totalBytes: number;
  fails: string[];
  warnings: string[];
  recommended: Partial<Record<VariantRole, string | null>>;
};

const PRIVACY_COPY =
  "Vistaire does not send your source to OptimizeGLB or any external optimization API. You download the source and control any manual browser-local optimization step yourself. When you upload an optimized GLB back into Vistaire, Vistaire validates it with its own production gates.";

const FRAMING_COPY =
  "This panel does not automate OptimizeGLB. It is a browser-local handoff: you optimize manually, then upload candidates that Vistaire validates with its own production gates.";

const PRESET_OPTIONS: Array<{ value: string; label: string; role: VariantRole; guidance: string }> = [
  { value: "optimizeglb-web-quality", label: "Web quality (webp 2048, light)", role: "web", guidance: "Texture 2048, light simplification." },
  { value: "optimizeglb-mobile-balanced", label: "Mobile balanced (webp 1024, medium)", role: "mobile", guidance: "Texture 1024, medium simplification." },
  { value: "optimizeglb-ar-lite-aggressive", label: "AR-lite aggressive (512-1024, strong)", role: "arLite", guidance: "Texture 512-1024, strong simplification, no required extensions." },
  { value: "optimizeglb-ar-lite-emergency", label: "AR-lite emergency (512, strongest)", role: "arLite", guidance: "Texture 512, strongest acceptable simplification." },
  { value: "optimizeglb-ios-source", label: "iOS source (512-1024, no extensions)", role: "iosSource", guidance: "Texture 512-1024, no required extensions." },
  { value: "custom", label: "Custom", role: "web", guidance: "Operator-defined settings; Vistaire still validates." }
];

const ROLE_LABELS: Record<VariantRole, string> = {
  web: "Web",
  mobile: "Mobile",
  arLite: "AR-lite (Android)",
  iosSource: "iOS source (USDZ)",
  posterSource: "Poster source"
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function identityParams(identity: Identity): string {
  return new URLSearchParams(identity).toString();
}

function budgetTone(status: string): string {
  if (status === "fail") return styles.badgeWarn;
  if (status === "target" || status === "advisory") return styles.badgeReady;
  return styles.badge;
}

export function Owner3dOptimizeGlbWorkflowPanel({ identity }: { identity: Identity | null }) {
  const [source, setSource] = useState<SourceRecord | null>(null);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [set, setSet] = useState<SetSummary | null>(null);
  const [configured, setConfigured] = useState(false);
  const [variantRole, setVariantRole] = useState<VariantRole>("web");
  const [presetLabel, setPresetLabel] = useState<string>("optimizeglb-web-quality");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("Chargement du workflow OptimizeGLB local.");
  const [busy, setBusy] = useState(false);

  const params = useMemo(() => (identity ? identityParams(identity) : ""), [identity]);

  const refresh = useCallback(async () => {
    if (!identity || !params) {
      setMessage("Sélectionnez un asset 3D pour ouvrir le workflow OptimizeGLB local.");
      return;
    }
    try {
      // Resolve the active source first so the candidate list can be scoped to
      // it; otherwise candidates from older sources under the same identity mix
      // into recommendations and approval.
      const sourceResponse = await fetch(`/api/owner/3d-ar/sources/status?${params}`);
      const sourcePayload = (await sourceResponse.json()) as {
        ok: boolean;
        configured?: boolean;
        record?: SourceRecord | null;
      };
      setConfigured(Boolean(sourcePayload.configured));
      setSource(sourcePayload.record ?? null);

      const activeSourceId = sourcePayload.record?.id ?? "";
      const candidateQuery = activeSourceId
        ? `${params}&sourceUploadId=${encodeURIComponent(activeSourceId)}`
        : params;
      const candidateResponse = await fetch(`/api/owner/3d-ar/optimizeglb-candidates?${candidateQuery}`);
      const candidatePayload = (await candidateResponse.json()) as {
        ok: boolean;
        configured?: boolean;
        candidates?: CandidateRecord[];
        set?: SetSummary;
        error?: string;
      };
      if (candidatePayload.ok) {
        setCandidates(candidatePayload.candidates ?? []);
        setSet(candidatePayload.set ?? null);
        setMessage(
          sourcePayload.record
            ? "Source disponible. Téléchargez-la, optimisez en local, puis re-uploadez les candidats."
            : "Aucune source validée pour cet asset."
        );
      } else {
        setMessage(candidatePayload.error || "Candidats indisponibles.");
      }
    } catch {
      setMessage("Workflow OptimizeGLB local indisponible (réseau).");
    }
  }, [identity, params]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  function onPresetChange(value: string) {
    setPresetLabel(value);
    const preset = PRESET_OPTIONS.find((option) => option.value === value);
    if (preset && value !== "custom") setVariantRole(preset.role);
  }

  async function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identity || !source?.id || !file) {
      setMessage("Source et fichier candidat .glb requis.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setMessage("Candidat refusé : extension .glb requise.");
      return;
    }
    const formData = new FormData();
    formData.set("restaurantSlug", identity.restaurantSlug);
    formData.set("menuSlug", identity.menuSlug);
    formData.set("dishSlug", identity.dishSlug);
    formData.set("version", identity.version);
    formData.set("sourceUploadId", source.id);
    formData.set("variantRole", variantRole);
    formData.set("presetLabel", presetLabel);
    formData.set("notes", notes);
    formData.set("file", file);

    setBusy(true);
    setMessage("Upload candidat en cours.");
    try {
      const response = await fetch("/api/owner/3d-ar/optimizeglb-candidates", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; code?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.error || "Candidat refusé par les gates Vistaire.");
      } else {
        setMessage("Candidat validé et enregistré. Lancez la comparaison visuelle avant approbation.");
        setFile(null);
        await refresh();
      }
    } catch {
      setMessage("Erreur réseau pendant l'upload candidat.");
    } finally {
      setBusy(false);
    }
  }

  async function approveSet() {
    if (!identity || !source?.id || !set) return;
    const recommended = set.recommended;
    setBusy(true);
    setMessage("Approbation du candidate set.");
    try {
      const response = await fetch("/api/owner/3d-ar/optimizeglb-candidate-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...identity,
          sourceUploadId: source.id,
          webCandidateId: recommended.web ?? "",
          mobileCandidateId: recommended.mobile ?? "",
          arLiteCandidateId: recommended.arLite ?? "",
          iosSourceCandidateId: recommended.iosSource ?? null
        })
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; fails?: string[] };
      if (!response.ok || !payload.ok) {
        setMessage(payload.error || (payload.fails ?? []).join(" ") || "Candidate set non approuvable.");
      } else {
        setMessage("Candidate set approuvé. CDN, QA iPhone/Android et publish restent des gates séparés.");
        await refresh();
      }
    } catch {
      setMessage("Erreur réseau pendant l'approbation.");
    } finally {
      setBusy(false);
    }
  }

  const downloadHref =
    identity && source?.id
      ? `/api/owner/3d-ar/source-download?${params}&sourceUploadId=${encodeURIComponent(source.id)}`
      : null;

  const sourceModel =
    identity && source?.id
      ? {
          label: "Source GLB",
          url: `/api/owner/3d-ar/optimizeglb-preview?${params}&kind=source&sourceUploadId=${encodeURIComponent(source.id)}`,
          origin: "owner-artifact" as const
        }
      : null;

  const candidateModel =
    identity && selectedCandidateId
      ? {
          label: "Candidate GLB",
          url: `/api/owner/3d-ar/optimizeglb-preview?${params}&kind=candidate&candidateId=${encodeURIComponent(selectedCandidateId)}`,
          origin: "owner-artifact" as const
        }
      : null;

  const visualCompareHint =
    identity && source
      ? `npm run 3d:visual-compare -- --source <source.glb> --candidate <candidate.glb> --variant web --out assets/3d/reports/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}/optimizeglb`
      : "";

  return (
    <section className={styles.sourceUploadPanel} aria-label="OptimizeGLB browser-local workflow">
      <div className={styles.sourceUploadHeader}>
        <div>
          <p className={styles.sourceUploadEyebrow}>OptimizeGLB · browser-local handoff</p>
          <h3 className={styles.panelTitle}>Heavy-asset workflow (browser-local)</h3>
        </div>
        <span className={`${styles.badge} ${configured ? styles.badgeReady : styles.badgeWarn}`}>
          {configured ? "Storage prêt" : "storage not configured"}
        </span>
      </div>

      <p className={styles.cellSub}>{FRAMING_COPY}</p>
      <p className={styles.qrWarning} data-testid="owner-3d-optimizeglb-privacy">
        {PRIVACY_COPY}
      </p>

      {/* Step 1 - source */}
      <section className={styles.moduleCard} aria-label="Step 1 source">
        <p className={styles.moduleCardTitle}>1. Source</p>
        {source ? (
          <dl className={styles.sourceUploadRecord}>
            <div>
              <dt>Original</dt>
              <dd>{source.originalName}</dd>
            </div>
            <div>
              <dt>Bytes</dt>
              <dd>{formatBytes(source.bytes)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{source.status}</dd>
            </div>
            <div>
              <dt>SHA-256</dt>
              <dd>
                {source.sha256.slice(0, 8)}...{source.sha256.slice(-8)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className={styles.cellSub}>Aucune source validée. Uploadez d&apos;abord une source GLB.</p>
        )}
        {downloadHref ? (
          <a className={`${styles.btn} ${styles.btnPrimary}`} href={downloadHref} download data-testid="owner-3d-source-download">
            Download source GLB (audité)
          </a>
        ) : null}
      </section>

      {/* Step 2 - open OptimizeGLB (separate CTA, no source URL/token) */}
      <section className={styles.moduleCard} aria-label="Step 2 open OptimizeGLB">
        <p className={styles.moduleCardTitle}>2. Open OptimizeGLB (browser-local)</p>
        <p className={styles.cellSub}>
          Ouvre OptimizeGLB dans un nouvel onglet. Aucun lien ne contient l&apos;URL ou un token de la source.
        </p>
        <a
          className={styles.btn}
          href="https://optimizeglb.com"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="owner-3d-open-optimizeglb"
        >
          Open OptimizeGLB
        </a>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Preset</th>
                <th>Role</th>
                <th>Guidance</th>
              </tr>
            </thead>
            <tbody>
              {PRESET_OPTIONS.filter((option) => option.value !== "custom").map((option) => (
                <tr key={option.value}>
                  <td>{option.value}</td>
                  <td>{ROLE_LABELS[option.role]}</td>
                  <td className={styles.cellSub}>{option.guidance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Step 3/4 - upload candidate */}
      <form className={styles.sourceUploadForm} onSubmit={submitCandidate} aria-label="Step 4 upload candidate">
        <p className={styles.moduleCardTitle}>3-4. Optimisez en local, puis uploadez le candidat</p>
        <div className={styles.sourceUploadIdentityGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Preset</span>
            <select className={styles.input} value={presetLabel} onChange={(event) => onPresetChange(event.target.value)}>
              {PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Variant role</span>
            <select
              className={styles.input}
              value={variantRole}
              onChange={(event) => setVariantRole(event.target.value as VariantRole)}
            >
              {(Object.keys(ROLE_LABELS) as VariantRole[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Notes</span>
            <input
              className={styles.input}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="ex: texture 512, simplify 0.35"
              maxLength={600}
            />
          </label>
        </div>
        <div className={styles.sourceUploadControls}>
          <label className={styles.sourceUploadDrop}>
            <span className={styles.fieldLabel}>Candidat GLB optimisé</span>
            <input
              data-testid="owner-3d-optimizeglb-candidate-input"
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <span>{file ? `${file.name} · ${formatBytes(file.size)}` : "Choisir un .glb optimisé"}</span>
          </label>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy || !configured || !source?.id || !file}
          >
            {busy ? "..." : "Upload candidate"}
          </button>
        </div>
      </form>

      <p className={styles.qrStatusLine} aria-live="polite" data-testid="owner-3d-optimizeglb-status">
        {message}
      </p>

      {/* Step 5/6 - candidates + set */}
      {candidates.length > 0 ? (
        <section className={styles.moduleCard} aria-label="Step 5 candidates">
          <div className={styles.pipelineSectionTitleRow}>
            <p className={styles.moduleCardTitle}>5-6. Candidats &amp; set</p>
            {set ? (
              <span className={`${styles.badge} ${set.canApprove ? styles.badgeReady : styles.badgeWarn}`}>
                set: {set.status}
              </span>
            ) : null}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Preset</th>
                  <th>Bytes</th>
                  <th>Triangles</th>
                  <th>Budget</th>
                  <th>Status</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td>{ROLE_LABELS[candidate.variantRole]}</td>
                    <td className={styles.cellSub}>{candidate.presetLabel}</td>
                    <td>{formatBytes(candidate.bytes)}</td>
                    <td>{candidate.triangleCount ?? "-"}</td>
                    <td>
                      <span className={`${styles.badge} ${budgetTone(candidate.budgetStatus)}`}>
                        {candidate.budgetStatus}
                      </span>
                    </td>
                    <td className={styles.cellSub}>{candidate.status}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => setSelectedCandidateId(candidate.id)}
                      >
                        Sélectionner 3D
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {set && set.missingRoles.length > 0 ? (
            <p className={styles.qrWarning}>Rôles manquants pour un set complet : {set.missingRoles.join(", ")}.</p>
          ) : null}
          {set && set.fails.length > 0 ? (
            <ul className={styles.cellSub}>
              {set.fails.map((fail) => (
                <li key={fail}>{fail}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy || !set?.canApprove}
            onClick={() => void approveSet()}
            data-testid="owner-3d-optimizeglb-approve"
          >
            Approve candidate set
          </button>
          {!set?.canApprove ? (
            <p className={styles.cellSub}>
              L&apos;approbation exige un set complet (web + mobile + AR-lite), lié à la même source, avec comparaison
              visuelle réussie. CDN, QA iPhone/Android et publish restent des gates séparés.
            </p>
          ) : null}
        </section>
      ) : null}

      {visualCompareHint ? (
        <section className={styles.moduleCard} aria-label="Visual compare command">
          <p className={styles.moduleCardTitle}>Comparaison visuelle (runner / opérateur)</p>
          <p className={styles.cellSub}>
            La comparaison source vs candidat tourne hors du dashboard. Exécutez par variant (web, mobile, arLite) :
          </p>
          <code className={styles.pipelineCommand}>{visualCompareHint}</code>
        </section>
      ) : null}

      {/* Step 7 - explicit-load 3D */}
      <Owner3dLazyModelViewer sourceModel={sourceModel} candidateModel={candidateModel} />
    </section>
  );
}
